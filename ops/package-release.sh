#!/bin/bash
set -euo pipefail

[[ $# == 1 && "$1" == /* ]] || { echo '请传入发布包的绝对路径。' >&2; exit 1; }
archive=$1
standalone=.next/standalone
test -s "$standalone/server.js"
test -s "$standalone/.next/BUILD_ID"
test -d .next/static

mkdir -p "$standalone/.next/static"
cp -a .next/static/. "$standalone/.next/static/"
files=(server.js package.json .next node_modules)
if [[ -d public ]]; then
  mkdir -p "$standalone/public"
  cp -a public/. "$standalone/public/"
  files+=(public)
fi
tar --format=posix --pax-option=delete=atime,delete=ctime -czf "$archive" -C "$standalone" "${files[@]}"

work=$(mktemp -d)
process=
cleanup() {
  if [[ -n "$process" ]]; then
    kill "$process" 2>/dev/null || true
    wait "$process" 2>/dev/null || true
  fi
  rm -rf -- "$work"
}
trap cleanup EXIT

python3 - "$archive" "$work" <<'PYTHON'
from pathlib import Path
from runpy import run_path
import sys

receiver = run_path("ops/receive-release.py")
archive, work = map(Path, sys.argv[1:])
if archive.stat().st_size > receiver["UPLOAD_LIMIT"]:
    raise SystemExit("发布包超出接收端大小限制。")
stage = work / "release"
stage.mkdir()
receiver["extract_release"](archive, work, stage)
PYTHON

revision=${GITHUB_SHA:-0000000000000000000000000000000000000000}
origin=https://trip.yayapeng.xyz
invite_password=fake-ci-invite-password
mkdir -m 700 "$work/data"
(
  cd "$work/release"
  export HOSTNAME=127.0.0.1 PORT=4192 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
  export TUDA_PUBLIC_ORIGIN="$origin" TUDA_DATA_DIR="$work/data"
  export TUDA_RELEASE_SHA="$revision"
  export TUDA_INVITE_PASSWORD="$invite_password" TUDA_SESSION_SECRET=fake-ci-session-secret-not-for-serving
  unset DEEPSEEK_API_KEY SILICONFLOW_API_KEY
  exec node server.js
) > "$work/service.log" 2>&1 &
process=$!

for attempt in {1..15}; do
  if curl --disable --noproxy '*' --silent --fail --max-time 2 \
      http://127.0.0.1:4192/api/health -o "$work/health" &&
    python3 -c 'import json, sys; data=json.load(open(sys.argv[1])); sys.exit(not (data["ok"] is True and data["commit"] == sys.argv[2]))' \
      "$work/health" "$revision" &&
    curl --disable --noproxy '*' --silent --fail --max-time 2 http://127.0.0.1:4192/ -o "$work/home" &&
    test -s "$work/home"; then
    echo '发布包可独立启动，首页和健康检查通过。'
    TUDA_PUBLIC_ORIGIN="$origin" TUDA_INVITE_PASSWORD="$invite_password" \
      node tests/access-smoke.mjs http://127.0.0.1:4192
    exit 0
  fi
  if ! kill -0 "$process" 2>/dev/null; then break; fi
  if [[ "$attempt" != 15 ]]; then sleep 1; fi
done
cat "$work/service.log" >&2
echo '发布包本机验证失败。' >&2
exit 1
