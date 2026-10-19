#!/bin/zsh
# Public preview of the production build through cpolar (reuses the reserved subdomain wildwoodguardiansgame).
#   start   build if needed, install/load LaunchAgents (vite preview :4180 + cpolar tunnel), take over the subdomain
#   stop    unload this game's agents (the subdomain stays free)
#   status  agent state + local and public health checks
#   update  rebuild dist/ (the public URL serves dist/, so this changes the live site immediately)
#   restore-wildwood  stop this game and hand the subdomain back to 森野守卫
set -euo pipefail

project_dir="${0:A:h:h}"
agent_dir="$HOME/Library/LaunchAgents"
log_dir="$HOME/Library/Logs/RealmRampage"
domain="gui/$(id -u)"
public_url="https://wildwoodguardiansgame.cpolar.cn"
local_url="http://127.0.0.1:4180"
web_label="com.realmrampage.web"
tunnel_label="com.realmrampage.cpolar"
network_label="com.wildwoodguardians.network"   # SOCKS proxy that the cpolar config depends on
old_labels=(com.wildwoodguardians.cpolar com.wildwoodguardians.web)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

write_plist() { # label, workdir, args...
  local label=$1 workdir=$2; shift 2
  local args=""
  for a in "$@"; do args+="		<string>${a}</string>"$'\n'; done
  cat > "$agent_dir/$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$label</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
	</dict>
	<key>ProgramArguments</key>
	<array>
$args	</array>
	<key>WorkingDirectory</key>
	<string>$workdir</string>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>ThrottleInterval</key>
	<integer>15</integer>
	<key>StandardOutPath</key>
	<string>$log_dir/${label##*.}.stdout.log</string>
	<key>StandardErrorPath</key>
	<string>$log_dir/${label##*.}.stderr.log</string>
</dict>
</plist>
PLIST
}

load() { launchctl enable "$domain/$1"; launchctl print "$domain/$1" >/dev/null 2>&1 || launchctl bootstrap "$domain" "$agent_dir/$1.plist"; }
unload() { launchctl disable "$domain/$1" 2>/dev/null || true; launchctl print "$domain/$1" >/dev/null 2>&1 && launchctl bootout "$domain/$1" || true; }

case "${1:-status}" in
  start)
    mkdir -p "$log_dir" "$agent_dir"
    cd "$project_dir"
    [[ -d node_modules ]] || npm ci --cache "${TMPDIR:-/tmp}/realm-npm-cache"
    [[ -f dist/index.html ]] || npm run build
    write_plist "$web_label" "$project_dir" /opt/homebrew/bin/node "$project_dir/node_modules/vite/bin/vite.js" preview
    write_plist "$tunnel_label" "$HOME" /opt/homebrew/bin/cpolar http "-config=$HOME/.cpolar/wildwoodguardiansgame.yml" -region=cn -subdomain=wildwoodguardiansgame -tunnelName=realmrampage \
      -proto=https -redirect-https=true -inspect-addr=false -dashboard=off -daemon=off -processMode=single "-log=$log_dir/cpolar.log" -log-level=INFO 127.0.0.1:4180
    for l in "${old_labels[@]}"; do unload "$l"; done
    load "$network_label"; load "$web_label"; load "$tunnel_label"
    print '后台服务已启动，正在检查……'
    for i in {1..15}; do
      body=$(curl --fail --silent --max-time 6 "$public_url/health.json" || true)
      if [[ "$body" == *'"app": "realm-rampage"'* ]]; then print "公网试玩已就绪：$public_url"; exit 0; fi
      sleep 2
    done
    print -u2 "服务已启动但公网检查尚未通过（cpolar 可能仍在连接）。稍后运行：$0 status"
    exit 1
    ;;
  stop)
    unload "$tunnel_label"; unload "$web_label"
    print '幻域无双公网试玩已停止。'
    ;;
  status)
    for l in "$network_label" "$web_label" "$tunnel_label"; do
      print "[$l]"; launchctl print "$domain/$l" 2>/dev/null | awk '$1 ~ /^(state|pid)$/ { if (!seen[$1]++) print }' || print '  未运行'
    done
    print -n '本机：'; curl --fail --silent --show-error --max-time 5 "$local_url/health.json" || true; print
    print -n '公网：'; curl --fail --silent --show-error --max-time 20 "$public_url/health.json" || true; print
    ;;
  update)
    cd "$project_dir" && npm run build && print "已重新构建，刷新 $public_url 即可看到新版本。"
    ;;
  restore-wildwood)
    unload "$tunnel_label"; unload "$web_label"
    for l in "${old_labels[@]}"; do launchctl enable "$domain/$l"; launchctl print "$domain/$l" >/dev/null 2>&1 || launchctl bootstrap "$domain" "$agent_dir/$l.plist"; done
    print "已将 $public_url 交还给森野守卫。"
    ;;
  *) print -u2 "用法：$0 {start|stop|status|update|restore-wildwood}"; exit 2 ;;
esac
