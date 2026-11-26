#!/usr/bin/env python3
"""Receive a standalone Next.js release via the dedicated SSH forced command."""

import fcntl
import gzip
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
import zlib


ROOT = Path("/srv/tuda-trip")
REVISION = re.compile(r"[0-9a-f]{40}")
COMPONENT = re.compile(r"[A-Za-z0-9_@.+()\[\]-]{1,160}")
TOP_LEVEL = {"server.js", "package.json", ".next", "node_modules", "public"}
UPLOAD_LIMIT = 64 * 1024 * 1024
ARCHIVE_LIMIT = 256 * 1024 * 1024
FILE_LIMIT = 48 * 1024 * 1024
MEMBER_LIMIT = 12_000
RETAIN_RELEASES = 4


class ReleaseError(Exception):
    pass


def parse_command(command):
    if command == "status":
        return command, None
    match = re.fullmatch(r"(deploy|rollback) ([0-9a-f]{40})", command)
    if not match:
        raise ReleaseError("仅接受 status、deploy <提交> 或 rollback <提交>。")
    return match.groups()


def bounded_copy(source, destination, limit):
    while chunk := source.read(min(64 * 1024, limit + 1)):
        limit -= len(chunk)
        if limit < 0:
            raise ReleaseError("发布包超出大小限制。")
        destination.write(chunk)


def receive_archive(source, directory):
    received = directory / "upload.tar.gz"
    with received.open("xb") as output:
        signal.alarm(120)
        try:
            bounded_copy(source, output, UPLOAD_LIMIT)
        finally:
            signal.alarm(0)
    return received


def valid_release(release):
    return all(
        path.is_file() and path.stat().st_size > 0
        for path in (release / "server.js", release / "package.json", release / ".next/BUILD_ID")
    ) and (release / ".next/static").is_dir()


def extract_release(received, work, stage):
    archive = work / "upload.tar"
    with gzip.open(received, "rb") as decompressed, archive.open("xb") as output:
        bounded_copy(decompressed, output, ARCHIVE_LIMIT)

    seen = set()
    with tarfile.open(archive, mode="r:") as package:
        for member in package:
            name = member.name.removeprefix("./")
            if name in {"", "."} and member.isdir():
                continue
            parts = name.split("/")
            if (
                len(name) > 500 or len(parts) > 32 or parts[0] not in TOP_LEVEL
                or any(part in {".", ".."} or not COMPONENT.fullmatch(part) for part in parts)
                or any(part.startswith(".env") for part in parts)
                or name in seen or len(seen) >= MEMBER_LIMIT
                or member.sparse or set(member.pax_headers) - {"path", "mtime", "atime", "ctime"}
            ):
                raise ReleaseError("发布包包含不允许的路径或归档属性。")
            seen.add(name)
            target = stage.joinpath(*parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if member.type not in {tarfile.REGTYPE, tarfile.AREGTYPE} or not 0 <= member.size <= FILE_LIMIT:
                raise ReleaseError("发布包只允许限定大小的普通文件和目录。")
            target.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(member) as contents, target.open("xb") as output:
                bounded_copy(contents, output, member.size)

    if not valid_release(stage):
        raise ReleaseError("发布包缺少 Next.js standalone 服务或静态资源。")


def active_release(root):
    target = root / "current"
    if not target.exists() and not target.is_symlink():
        return None
    if not target.is_symlink():
        raise ReleaseError("当前版本路径无效。")
    release = target.resolve(strict=True)
    if release.parent != root / "releases" or not REVISION.fullmatch(release.name) or not valid_release(release):
        raise ReleaseError("当前版本链接无效。")
    return release


def select_release(root, release):
    target = root / "current"
    if release is None:
        target.unlink(missing_ok=True)
        return
    with tempfile.TemporaryDirectory(prefix=".switch-", dir=root) as pending:
        link = Path(pending) / "release"
        link.symlink_to(Path("releases") / release.name, target_is_directory=True)
        link.replace(target)


def service(action):
    try:
        subprocess.run(
            ["/usr/bin/sudo", "-n", "/usr/bin/systemctl", action, "tuda-trip.service"],
            env={"PATH": "/usr/bin:/bin"}, check=True, timeout=35,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise ReleaseError("途搭服务无法完成重启或停止。") from error


def request(path):
    return subprocess.run(
        [
            "/usr/bin/curl", "--disable", "--noproxy", "*", "--silent", "--fail",
            "--connect-timeout", "2", "--max-time", "4", "--max-filesize", "262144",
            "--header", "Host: trip.yayapeng.xyz", f"http://127.0.0.1:4192{path}",
        ],
        env={"PATH": "/usr/bin:/bin"}, capture_output=True, check=True, timeout=5,
    ).stdout


def verify_release(release):
    for attempt in range(12):
        try:
            health = json.loads(request("/api/health"))
            if isinstance(health, dict) and health.get("ok") is True and health.get("commit") == release.name and request("/"):
                return
        except (OSError, subprocess.SubprocessError, ValueError):
            pass
        if attempt < 11:
            time.sleep(1)
    raise ReleaseError("途搭本机健康检查失败或版本不符。")


def activate(root, release, previous):
    if release == previous:
        verify_release(release)
        return
    try:
        select_release(root, release)
        service("restart")
        verify_release(release)
    except (Exception, KeyboardInterrupt) as failure:
        try:
            select_release(root, previous)
            if previous is None:
                service("stop")
            else:
                service("restart")
                verify_release(previous)
        except (Exception, KeyboardInterrupt) as restore_failure:
            raise ReleaseError("途搭候选版本失败，且无法确认恢复结果。") from restore_failure
        label = previous.name if previous else "未发布"
        raise ReleaseError(f"途搭候选版本失败，已恢复原状态 {label}。") from failure


def deploy(root, release, previous, source):
    with tempfile.TemporaryDirectory(prefix=".receive-", dir=root / "releases") as pending:
        work = Path(pending)
        received = receive_archive(source, work)
        if release.exists() or release.is_symlink():
            if release.is_symlink() or not valid_release(release):
                raise ReleaseError("目标版本目录无效。")
            activate(root, release, previous)
            return

        stage = work / "files"
        stage.mkdir()
        extract_release(received, work, stage)
        stage.rename(release)
        try:
            activate(root, release, previous)
        except (Exception, KeyboardInterrupt):
            if active_release(root) != release:
                shutil.rmtree(release)
            raise


def prune(root, keep):
    releases = [
        path for path in (root / "releases").iterdir()
        if REVISION.fullmatch(path.name) and path.is_dir() and not path.is_symlink()
    ]
    for release in sorted(releases, key=lambda path: path.stat().st_mtime_ns, reverse=True):
        if release in keep:
            continue
        if len(keep) < RETAIN_RELEASES:
            keep.add(release)
        else:
            shutil.rmtree(release)


def run(root, source, command):
    action, revision = parse_command(command)
    if action == "status":
        current = active_release(root)
        print(f"ACTIVE {current.name if current else 'none'}", flush=True)
        return
    with (root / "deploy.lock").open("ab") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ReleaseError("已有途搭发布任务在执行。") from error
        previous = active_release(root)
        release = root / "releases" / revision
        if action == "deploy":
            deploy(root, release, previous, source)
        else:
            if release.is_symlink() or not valid_release(release):
                raise ReleaseError("找不到指定的回滚版本。")
            activate(root, release, previous)
        print(f"ACTIVE {release.name}", flush=True)
        try:
            prune(root, {path for path in (release, previous) if path})
        except OSError:
            print("当前版本已上线，清理旧版本失败。", file=sys.stderr, flush=True)


def interrupt(signum, _frame):
    if signum == signal.SIGALRM:
        raise ReleaseError("接收发布包超时。")
    raise ReleaseError("发布连接已中断。")


def main():
    os.umask(0o022)
    for event in (signal.SIGALRM, signal.SIGHUP, signal.SIGINT, signal.SIGTERM):
        signal.signal(event, interrupt)
    try:
        if os.geteuid() == 0:
            raise ReleaseError("发布接收器必须由途搭专用部署账号执行。")
        run(ROOT, sys.stdin.buffer, os.environ.get("SSH_ORIGINAL_COMMAND", ""))
    except ReleaseError as error:
        print(str(error), file=sys.stderr, flush=True)
        return 1
    except (OSError, EOFError, tarfile.TarError, zlib.error):
        print("发布包格式无效或无法完成文件操作。", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
