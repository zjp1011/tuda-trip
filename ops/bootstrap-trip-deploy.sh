#!/bin/bash
set -euo pipefail
umask 022

site=/srv/tuda-trip
deploy_user=tuda-deploy
app_user=tuda-trip
deploy_home=/var/lib/tuda-deploy
runtime_dir=/etc/tuda-trip
config=/etc/caddy/Caddyfile
program=/usr/local/libexec/tuda-receive-release.py
start=/usr/local/libexec/tuda-trip-start
unit=/etc/systemd/system/tuda-trip.service
sudo_rule=/etc/sudoers.d/tuda-deploy
bundle=$(cd -- "$(dirname -- "$0")" && pwd)

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $(id -u) == 0 && $(hostname -s) == hcss-ecs-3885 && $# == 2 ]] ||
  fail '请在新加坡服务器上以 root 执行，传入部署公钥和 root 专用环境文件。'
[[ -f "$1" && ! -L "$1" && $(wc -l < "$1") == 1 ]] || fail '需要一行 SSH 公钥。'
read -r key_type key_data _ < "$1"
[[ "$key_type" == ssh-ed25519 && "$key_data" =~ ^[A-Za-z0-9+/]{68}$ ]] &&
  ssh-keygen -l -f "$1" >/dev/null || fail '部署公钥格式无效。'
[[ -f "$2" && ! -L "$2" && $(stat -c '%u:%a' -- "$2") == 0:600 ]] ||
  fail '环境文件应为 root 所有的 0600 普通文件。'
[[ -f "$bundle/receive-release.py" && ! -L "$bundle/receive-release.py" ]] ||
  fail '缺少 ops/receive-release.py。'
[[ -f "$config" && ! -L "$config" ]] || fail 'Caddy 主配置文件无效。'
[[ -x /usr/bin/python3 && -x /usr/bin/sudo && -x /usr/bin/systemctl && -x /usr/bin/curl ]] ||
  fail '服务器缺少 Python 3、sudo、systemd 或 curl。'
command -v visudo >/dev/null || fail '服务器缺少 visudo。'

node=/opt/node-v24.22.3-linux-x64/bin/node
if [[ ! -x "$node" ]]; then node=$(command -v node) || fail '未找到 Node.js 24。'; fi
[[ "$("$node" --version)" == v24.* ]] || fail '途搭需要 Node.js 24。'

exec 9>/run/lock/yayapeng-home.lock
flock -n 9 || fail '已有网站配置变更正在执行。'
for target in "$site" "$deploy_home" "$runtime_dir" "$program" "$start" "$unit" "$sudo_rule" "/var/lib/$app_user"; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail "安装路径已存在，请先核对 $target。"
done
if id "$deploy_user" >/dev/null 2>&1 || id "$app_user" >/dev/null 2>&1; then
  fail '途搭账号已存在，请先核对。'
fi
! grep -Fq 'trip.yayapeng.xyz' "$config" || fail 'Caddy 主配置中已有途搭域名，请先核对。'

install -d -o root -g root -m 750 /var/backups/yayapeng
backup=$(mktemp -d /var/backups/yayapeng/tuda.XXXXXX)
cp -p -- "$config" "$backup/Caddyfile"
candidate=$(mktemp /etc/caddy/.tuda-trip.XXXXXX)
replaced=0
created_deploy=0
created_app=0
created_paths=0
finish() {
  local code=$? can_clean=1
  trap - EXIT HUP INT TERM
  if [[ $code != 0 && $replaced == 1 ]]; then
    if cp -p -- "$backup/Caddyfile" "$candidate" && mv -fT -- "$candidate" "$config" &&
      systemctl reload caddy; then
      printf '已恢复 Caddy 原配置。\n' >&2
    else
      printf '需手动恢复 Caddy，备份为 %s/Caddyfile。\n' "$backup" >&2
      can_clean=0
    fi
  fi
  if [[ $code != 0 && $can_clean == 1 ]]; then
    if [[ $created_paths == 1 ]]; then
      systemctl disable tuda-trip.service >/dev/null 2>&1 || true
      rm -f -- "$program" "$start" "$unit" "$sudo_rule"
      rm -rf --one-file-system -- "$site" "$deploy_home" "$runtime_dir"
      systemctl daemon-reload || true
    fi
    if [[ $created_deploy == 1 ]]; then userdel "$deploy_user" || true; fi
    if [[ $created_app == 1 ]]; then userdel "$app_user" || true; fi
  fi
  rm -f -- "$candidate"
  exit "$code"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

cp -p -- "$config" "$candidate"
cat >> "$candidate" <<'CADDY'

# BEGIN TUDA TRIP
trip.yayapeng.xyz {
	encode zstd gzip
	header {
		X-Content-Type-Options nosniff
		Referrer-Policy same-origin
		X-Frame-Options DENY
	}
	reverse_proxy 127.0.0.1:4192 {
		header_up X-Tuda-Client-IP {remote_host}
	}
}
# END TUDA TRIP
CADDY
caddy validate --config "$candidate" --adapter caddyfile > "$backup/caddy-validation.log" 2>&1 ||
  fail "Caddy 校验失败，日志位于 $backup。"

check_main_site() {
  local path status
  for path in / /fitting-room/ /admin/ /admin/api/state; do
    status=$(curl --disable --noproxy '*' --resolve 'yayapeng.xyz:443:127.0.0.1' \
      --max-time 10 -sS -o /dev/null -w '%{http_code}' "https://yayapeng.xyz$path")
    if [[ "$path" == /admin/api/state ]]; then
      [[ "$status" == 401 ]] || fail '主站后台登录保护检查失败。'
    else
      [[ "$status" == 200 ]] || fail '主站页面检查失败。'
    fi
  done
}
check_main_site

useradd --system --user-group --no-create-home --home-dir "$deploy_home" --shell /bin/bash "$deploy_user"
created_deploy=1
useradd --system --user-group --no-create-home --home-dir "/var/lib/$app_user" --shell /usr/sbin/nologin "$app_user"
created_app=1
created_paths=1
install -d -o "$deploy_user" -g "$deploy_user" -m 755 "$site" "$site/releases"
install -d -o root -g root -m 755 "$deploy_home" "$deploy_home/.ssh" /usr/local/libexec
install -d -o root -g root -m 700 "$runtime_dir"
install -o root -g root -m 600 "$2" "$runtime_dir/runtime.env"
install -o root -g root -m 644 "$bundle/receive-release.py" "$program"

{
  cat <<'START'
#!/bin/bash
set -euo pipefail
release=$(/usr/bin/readlink -e /srv/tuda-trip/current)
revision=${release##*/}
[[ "$revision" =~ ^[0-9a-f]{40}$ && "$release" == "/srv/tuda-trip/releases/$revision" ]] || exit 1
cd -- "$release"
export TUDA_RELEASE_SHA="$revision" TUDA_PUBLIC_ORIGIN=https://trip.yayapeng.xyz TUDA_TRUST_PROXY=1
export TUDA_DATA_DIR=/var/lib/tuda-trip HOSTNAME=127.0.0.1 PORT=4192 NODE_ENV=production
export NODE_OPTIONS=--max-old-space-size=192 NEXT_TELEMETRY_DISABLED=1
START
  printf 'exec %q server.js\n' "$node"
} > "$start"
chmod 755 "$start"

cat > "$unit" <<'UNIT'
[Unit]
Description=Tuda Trip Node.js service
After=network.target
ConditionPathExists=/srv/tuda-trip/current/server.js

[Service]
Type=exec
User=tuda-trip
Group=tuda-trip
WorkingDirectory=/srv/tuda-trip
EnvironmentFile=/etc/tuda-trip/runtime.env
ExecStart=/usr/local/libexec/tuda-trip-start
StateDirectory=tuda-trip
StateDirectoryMode=0700
UMask=0077
Restart=on-failure
RestartSec=3s
TimeoutStopSec=12s
MemoryHigh=256M
MemoryMax=320M
TasksMax=64
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6

[Install]
WantedBy=multi-user.target
UNIT

printf '%s\n' \
  'tuda-deploy ALL=(root) NOPASSWD: NOSETENV: /usr/bin/systemctl restart tuda-trip.service, /usr/bin/systemctl stop tuda-trip.service' \
  > "$backup/sudoers"
visudo -cf "$backup/sudoers" >/dev/null
install -o root -g root -m 440 "$backup/sudoers" "$sudo_rule"
systemctl daemon-reload
systemctl enable tuda-trip.service

replaced=1
mv -fT -- "$candidate" "$config"
systemctl reload caddy
check_main_site

printf 'restrict,command="/usr/bin/python3 -I %s" %s %s tuda-actions\n' "$program" "$key_type" "$key_data" \
  > "$deploy_home/.ssh/authorized_keys"
chmod 644 "$deploy_home/.ssh/authorized_keys"
printf 'TUDA_ACTIONS_SERVER_READY\n备份目录 %s\n' "$backup"
