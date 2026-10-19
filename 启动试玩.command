#!/bin/zsh
# 本地试玩：启动开发服务器并打开浏览器（http://127.0.0.1:5190）
set -e
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null || { echo '请先安装 Node.js 22 或更新版本。'; read -k 1; exit 1; }
[[ -d node_modules ]] || npm ci --cache "${TMPDIR:-/tmp}/realm-npm-cache"
npm run dev -- --open
