#!/usr/bin/env bash
# 打包发布版:合并全部产物 + 附带 node 运行时 -> dist/fushihuang-server-linux-<arch>.tar.gz
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH="${1:-$(uname -m)}"
case "$ARCH" in
  x86_64) NODE_ARCH=linux-x64 ;;
  aarch64|arm64) NODE_ARCH=linux-arm64 ;;
  *) echo "unsupported arch: $ARCH"; exit 1 ;;
esac

NODE_VER="${NODE_VER:-v22.14.0}"
STAGE="$ROOT/dist/stage"
rm -rf "$STAGE"; mkdir -p "$STAGE"

# 1) 二进制
mkdir -p "$STAGE/bin"
for b in pspnet_adhocctl_server azahar-room eden-room; do
  [ -x "$ROOT/build/bin/$b" ] && cp -f "$ROOT/build/bin/$b" "$STAGE/bin/"
done
cp -f "$ROOT/build/bin/database.db" "$STAGE/bin/" 2>/dev/null || true
mkdir -p "$STAGE/src/psp/postoffice"
cp -f "$ROOT/build/postoffice/aemu_postoffice.js" "$ROOT/build/postoffice/config.json" "$STAGE/src/psp/postoffice/"

# 2) webui
cp -r "$ROOT/src/webui" "$STAGE/src/"

# 3) 管理器 / 配置 / 模板
cp -r "$ROOT/scripts" "$STAGE/"
cp -r "$ROOT/config" "$STAGE/"
mkdir -p "$STAGE/custom" "$STAGE/data"
cp -f "$ROOT/custom/README.txt" "$STAGE/custom/" 2>/dev/null || true
cp -f "$ROOT/LICENSE" "$STAGE/" 2>/dev/null || true
cp -f "$ROOT/NOTICE.md" "$STAGE/" 2>/dev/null || true

# POSTOFFICE 配置路径:管理器默认找 config/postoffice.json
cp -f "$ROOT/config/postoffice.json" "$STAGE/config/" 2>/dev/null || true

# 4) node 运行时(免安装)
echo ">> downloading node $NODE_VER $NODE_ARCH"
cd "$ROOT/dist"
curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-$NODE_ARCH.tar.xz" -o node.tar.xz
tar -xJf node.tar.xz
mkdir -p "$STAGE/runtime"
mv "node-$NODE_VER-$NODE_ARCH" "$STAGE/runtime/node"
rm -f node.tar.xz
# 精简:去掉 npm 等非运行时文件
rm -rf "$STAGE/runtime/node/include" "$STAGE/runtime/node/share" "$STAGE/runtime/node/lib/node_modules" \
       "$STAGE/runtime/node/CHANGELOG.md" "$STAGE/runtime/node/LICENSE" "$STAGE/runtime/node/README.md"

# 5) 打包
OUT="fushihuang-server-linux-$ARCH.tar.gz"
tar -C "$STAGE" -czf "$OUT" .
echo ">> 打包完成: dist/$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "sha256: $(cat "$OUT.sha256")"