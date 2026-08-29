# 服始皇 · 大一统联机服务端 Makefile
# 用法:
#   make build        # 构建全部服务端组件(需 gcc/make/node/cmake/ninja)
#   make psp          # 仅 PSP 组件
#   make azahar-room  # 仅 3DS 房间服务器
#   make eden-room    # 仅 Switch 房间服务器
#   make package      # 打包 release tar.gz(含 node 运行时)
#   make start        # 启动全部服务
#   make stop         # 停止全部服务
#   make status       # 查看状态

.PHONY: build psp azahar-room eden-room package start stop status clean

build: psp azahar-room eden-room

psp:
	bash scripts/build-psp.sh

azahar-room:
	bash scripts/build-azahar-room.sh

eden-room:
	bash scripts/build-eden-room.sh

package:
	bash scripts/package.sh

start:
	scripts/unified-server start all

stop:
	scripts/unified-server stop all

status:
	scripts/unified-server status

clean:
	rm -rf build dist src/azahar-room/build src/eden-room/build src/psp/dist