# SPDX-FileCopyrightText: Copyright 2026 Eden Emulator Project
# SPDX-License-Identifier: GPL-3.0-or-later

# SPDX-FileCopyrightText: 2018 yuzu Emulator Project
# SPDX-License-Identifier: GPL-2.0-or-later

# Enable modules to include each other's files
include_directories(.)

add_subdirectory(common)
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
