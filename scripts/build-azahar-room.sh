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

echo ">> pulling externals submodules (多线程 git clone, 第一次较慢)"
python3 - <<'PYEOF'
import os, re, subprocess, concurrent.futures, sys

data = open(".gitmodules", encoding="utf-8").read()
jobs = []
for m in re.finditer(r"\[submodule \"([^\"]+)\"\]\s*path = (\S+)\s*url = (\S+)", data):
    _, path, url = m.groups()
    # skip if the directory already exists with content or a .git
    if os.path.isdir(path):
        if os.path.exists(os.path.join(path, ".git")) or os.listdir(path):
            print(f"[skip] {path} already present")
            continue
    jobs.append((path, url))

print(f"[fetch] {len(jobs)} submodules")
def clone(job):
    path, url = job
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    if os.path.isdir(path) and os.listdir(path):
        return path, "skip(nonempty)"
    r = subprocess.run(["git", "clone", "--depth", "1", url, path],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return path, f"FAIL: {r.stderr.strip()[-200:]}"
    return path, "ok"

fails = []
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    for path, st in ex.map(clone, jobs):
        print(f"[fetch] {path}: {st}")
        if st != "ok":
            fails.append(path)
if fails:
    print("FAILED:", fails)
    sys.exit(1)
print("[fetch] all externals ready")
PYEOF

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
    -DUSE_SYSTEM_OPENSSL=ON \
    -DCITRA_USE_PRECOMPILED_HEADERS=OFF

echo ">> building azahar-room"
cmake --build build --target azahar-room -j"${NPROC:-$(nproc)}"

find build -name azahar-room -type f -executable | head -1 | xargs -r -I{} cp {} "$ROOT/build/bin/azahar-room"
[ -x "$ROOT/build/bin/azahar-room" ] || { echo "azahar-room binary not produced"; exit 1; }
strip -s "$ROOT/build/bin/azahar-room"
echo ">> azahar-room built: build/bin/azahar-room"