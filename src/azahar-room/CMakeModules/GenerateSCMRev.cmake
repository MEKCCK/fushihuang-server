# Simplified for the room-server-only build: the shader version hash is not
# needed, so we only generate scm_rev.cpp from its template.
list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/CMakeModules")

include(GenerateBuildInfo)
generate_build_info()

set(SHADER_CACHE_VERSION "unified-room-server")
configure_file("${CMAKE_SOURCE_DIR}/src/common/scm_rev.cpp.in" "scm_rev.cpp" @ONLY)
