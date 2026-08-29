#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Trim the extracted room-server trees' src/CMakeLists.txt so they only
build the room-server chain (no emulator cores / GUIs)."""
import re, os

def apply_azahar(path):
    with open(path, encoding="utf-8") as f:
        data = f.read()
    # replace the add_subdirectory block at the bottom with room-chain only
    new = """add_subdirectory(common)
add_subdirectory(network)

if (ENABLE_ROOM)
    add_subdirectory(citra_room)
endif()

if (ENABLE_ROOM_STANDALONE)
    add_subdirectory(citra_room_standalone)
endif()

if (ENABLE_WEB_SERVICE)
    add_subdirectory(web_service)
endif()
"""
    # cut from first "add_subdirectory(common)" line to end
    idx = data.index("add_subdirectory(common)")
    data = data[:idx] + new
    with open(path, "w", encoding="utf-8") as f:
        f.write(data)

def apply_eden(path):
    with open(path, encoding="utf-8") as f:
        data = f.read()
    new = """add_subdirectory(common)
add_subdirectory(network)

if (ENABLE_WEB_SERVICE)
    add_subdirectory(web_service)
endif()

if (YUZU_ROOM)
    add_subdirectory(dedicated_room)
endif()

if (YUZU_ROOM_STANDALONE)
    add_subdirectory(yuzu_room_standalone)
    set_target_properties(yuzu-room PROPERTIES OUTPUT_NAME "eden-room")
endif()

if (YUZU_STATIC_ROOM)
    return()
endif()
"""
    idx = data.index("# Dynarmic")
    data = data[:idx] + new
    with open(path, "w", encoding="utf-8") as f:
        f.write(data)

apply_azahar("/workspace/unified/src/azahar-room/src/CMakeLists.txt")
apply_eden("/workspace/unified/src/eden-room/src/CMakeLists.txt")
print("trimmed")