#!/usr/bin/env bash
# 构建 3DS 房间服务器 (azahar-room)
# 源码: src/azahar-room (自 azahar 模拟器提取的 room-server 依赖树)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/src/azahar-room"
BUILD="$ROOT/build/azahar-room"
mkdir -p "$BUILD"

cd "$SRC"

# 提供 git 上下文(生成 scm_rev 等)
if [ ! -d .git ]; then
    git init -q
    git add -A >/dev/null 2>&1 || true
    git -c user.email=ci@local -c user.name=ci commit -qm init >/dev/null 2>&1 || true
fi

echo ">> pulling externals submodules (enet/boost/fmt/...) (第一次较慢)"
git submodule update --init --recursive --depth 1 || { echo "submodule update failed"; exit 1; }

echo ">> configuring cmake (room-server only build)"
cmake -S . -B build -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DENABLE_QT=OFF \
    -DENABLE_GDBSTUB=OFF \
    -DENABLE_TESTS=OFF \
    -DENABLE_LIBRETRO=OFF \
    -DENABLE_ROOM=ON \
    -DENABLE_ROOM_STANDALONE=ON \
    -DENABLE_WEB_SERVICE=ON \
    -DCITRA_USE_PRECOMPILED_HEADERS=OFF

echo ">> building azahar-room"
cmake --build build --target azahar-room -j"${NPROC:-$(nproc)}"

find build -name azahar-room -type f -executable | head -1 | xargs -r -I{} cp {} "$ROOT/build/bin/azahar-room"
[ -x "$ROOT/build/bin/azahar-room" ] || { echo "azahar-room binary not produced"; exit 1; }
strip -s "$ROOT/build/bin/azahar-room"
echo ">> azahar-room built: build/bin/azahar-room"