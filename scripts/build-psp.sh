#!/usr/bin/env bash
# 构建 PSP 服务端组件:
#   - pspnet_adhocctl_server (C, 组管理, 27312)
#   - aemu_postoffice.js     (node, 数据中继, 27313/27314)
# 产物: build/bin/ 与 build/postoffice/
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/build/bin" "$ROOT/build/postoffice"

echo ">> building adhocctl server (C)"
cd "$ROOT/src/psp/adhocctl"
make 2>/dev/null || make CC="${CC:-gcc}" CFLAGS="-fpack-struct -I. -Wno-implicit-function-declaration"
[ -f "../dist/server/pspnet_adhocctl_server" ] || { echo "adhocctl build failed"; exit 1; }
cp -f ../dist/server/pspnet_adhocctl_server "$ROOT/build/bin/"
cp -f database.db "$ROOT/build/bin/"

echo ">> building aemu_postoffice (TypeScript -> JS)"
cd "$ROOT/src/psp/postoffice"
if [ ! -f aemu_postoffice.js ]; then
    npm install --no-audit --no-fund >/dev/null 2>&1 || true
    npm run build || npx tsc
fi
[ -f aemu_postoffice.js ] || { echo "postoffice build failed"; exit 1; }
cp -f aemu_postoffice.js config.json "$ROOT/build/postoffice/"
echo ">> PSP build done"