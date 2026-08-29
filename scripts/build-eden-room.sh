#!/usr/bin/env bash
# 构建 Switch 房间服务器 (eden-room)
# 源码: src/eden-room (自 eden/mirror 模拟器提取的 room-server 依赖树)
# 构建两种模式:
#   1) YUZU_STATIC_ROOM=ON  —— 静态裁剪模式(官方 CI 模式),优先
#   2) 退回动态模式(需要 libav*-dev)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/src/eden-room"
BUILD="$ROOT/build/eden-room"
mkdir -p "$BUILD"

cd "$SRC"

if [ ! -d .git ]; then
    git init -q
    git add -A >/dev/null 2>&1 || true
    git -c user.email=ci@local -c user.name=ci commit -qm init >/dev/null 2>&1 || true
fi

echo ">> configuring cmake (eden-room, static room mode)"
if cmake -S . -B build -G Ninja \
        -DCMAKE_BUILD_TYPE=Release \
        -DYUZU_STATIC_ROOM=ON 2>&1 | tee build-cmake.log
then
    echo ">> building eden-room (static)"
    if cmake --build build --target eden-room -j"${NPROC:-$(nproc)}"; then
        find build -name eden-room -type f -executable | head -1 | xargs -r -I{} cp {} "$ROOT/build/bin/eden-room"
        [ -x "$ROOT/build/bin/eden-room" ] && { strip -s "$ROOT/build/bin/eden-room"; echo ">> eden-room built (static)"; exit 0; }
    fi
fi

echo "!! static room build failed, falling back to dynamic build"
rm -rf build
cmake -S . -B build -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DYUZU_STATIC_ROOM=OFF \
    -DENABLE_QT=OFF \
    -DENABLE_WEB_SERVICE=ON \
    -DYUZU_CMD=OFF
cmake --build build --target eden-room -j"${NPROC:-$(nproc)}"
find build -name eden-room -type f -executable | head -1 | xargs -r -I{} cp {} "$ROOT/build/bin/eden-room"
[ -x "$ROOT/build/bin/eden-room" ] || { echo "eden-room build failed"; exit 1; }
strip -s "$ROOT/build/bin/eden-room"
echo ">> eden-room built (dynamic)"