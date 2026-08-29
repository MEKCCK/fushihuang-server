#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract the dedicated room-server components out of the azahar and eden (mirror)
emulators, producing self-contained source trees for:
  - azahar-room: 3DS dedicated room server
  - eden-room:   Switch dedicated room server
Everything the emulator GUIs / cores (audio/video/hid) are NOT copied.
"""
import os
import shutil
import sys

REPOS = "/workspace/repos"
UNIFIED = "/workspace/unified"

def copy_tree(src, dst, skip_dirs=(), skip_files=()):
    os.makedirs(dst, exist_ok=True)
    for name in os.listdir(src):
        if name in skip_dirs or name in skip_files:
            continue
        s = os.path.join(src, name)
        d = os.path.join(dst, name)
        if os.path.isdir(s):
            # skip empty dirs (uninitialized git submodules)
            if not os.listdir(s):
                continue
            copy_tree(s, d, skip_dirs, skip_files)
        else:
            shutil.copy2(s, d)

def copy_files(src_root, dst_root, rel_paths):
    for rel in rel_paths:
        s = os.path.join(src_root, rel)
        d = os.path.join(dst_root, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copy2(s, d)

azahar_root = os.path.join(REPOS, "azahar")
eden_root    = os.path.join(REPOS, "mirror")

# ---------------------------------------------------------------- azahar-room
az_dst = os.path.join(UNIFIED, "src/azahar-room/src")
shutil.rmtree(os.path.join(UNIFIED, "src/azahar-room"), ignore_errors=True)

for sub in ["common", "network", "web_service", "citra_room", "citra_room_standalone"]:
    copy_tree(os.path.join(azahar_root, "src", sub), os.path.join(az_dst, sub))

# cross-directory headers that the room server chain still needs
az_extra = [
    "audio_core/audio_types.h", "audio_core/dsp_interface.h",
    "audio_core/input_details.h", "audio_core/sink_details.h",
    "audio_core/time_stretch.h",
    "core/memory.h",
    "core/hle/service/cam/cam_params.h",
]
copy_files(os.path.join(azahar_root, "src"), az_dst, az_extra)

# build infrastructure (keep everything else out)
for item in ["CMakeLists.txt", ".gitmodules", "CMakeModules", "dist"]:
    s = os.path.join(azahar_root, item)
    d = os.path.join(UNIFIED, "src/azahar-room", item)
    if os.path.isdir(s):
        if item == "dist":
            # only what the room-server build / configure actually references
            keep = ("compatibility_list", "azahar-room.desktop", "azahar.desktop",
                    "azahar.ico", "azahar.manifest", "azahar.png", "azahar.svg",
                    "doc-icon.png", "license.md", "org.azahar_emu.Azahar.xml")
            os.makedirs(d, exist_ok=True)
            for name in keep:
                ss = os.path.join(s, name)
                if os.path.isdir(ss):
                    copy_tree(ss, os.path.join(d, name))
                elif os.path.isfile(ss):
                    shutil.copy2(ss, os.path.join(d, name))
        else:
            copy_tree(s, d, skip_dirs=("compatibility_list",))
    elif os.path.isfile(s):
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copy2(s, d)

# the top-level src/CMakeLists.txt of the emulator (will be trimmed afterwards)
shutil.copy2(os.path.join(azahar_root, "src/CMakeLists.txt"),
             os.path.join(UNIFIED, "src/azahar-room/src/CMakeLists.txt"))

# externals: only real files (submodule dirs are empty and skipped); keep .gitmodules
copy_tree(os.path.join(azahar_root, "externals"),
          os.path.join(UNIFIED, "src/azahar-room/externals"))

# ----------------------------------------------------------------- eden-room
ed_dst = os.path.join(UNIFIED, "src/eden-room/src")
shutil.rmtree(os.path.join(UNIFIED, "src/eden-room"), ignore_errors=True)

for sub in ["common", "network", "web_service", "dedicated_room", "yuzu_room_standalone"]:
    copy_tree(os.path.join(eden_root, "src", sub), os.path.join(ed_dst, sub))

for item in ["CMakeLists.txt", "CMakeModules", "externals"]:
    s = os.path.join(eden_root, item)
    d = os.path.join(UNIFIED, "src/eden-room", item)
    if os.path.isdir(s):
        copy_tree(s, d)
    elif os.path.isfile(s):
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copy2(s, d)

# dep hashes template referenced by GenerateDepHashes (lives under src/)
shutil.copy2(os.path.join(eden_root, "src/dep_hashes.h.in"),
             os.path.join(UNIFIED, "src/eden-room/src/dep_hashes.h.in"))

# dist files referenced by install() rules in root CMakeLists
os.makedirs(os.path.join(UNIFIED, "src/eden-room/dist"), exist_ok=True)
for name in os.listdir(os.path.join(eden_root, "dist")):
    s = os.path.join(eden_root, "dist", name)
    if os.path.isfile(s):
        shutil.copy2(s, os.path.join(UNIFIED, "src/eden-room/dist", name))
    elif os.path.isdir(s):
        copy_tree(s, os.path.join(UNIFIED, "src/eden-room/dist", name))

# the top-level src/CMakeLists.txt of the emulator (will be trimmed afterwards)
shutil.copy2(os.path.join(eden_root, "src/CMakeLists.txt"),
             os.path.join(UNIFIED, "src/eden-room/src/CMakeLists.txt"))

# patch: dedicated_room must not include the full emulator core header
p = os.path.join(ed_dst, "dedicated_room/yuzu_room.cpp")
with open(p, encoding="utf-8") as f:
    data = f.read()
data = data.replace('#include "core/core.h"\n', "")
with open(p, "w", encoding="utf-8") as f:
    f.write(data)

print("extraction done")