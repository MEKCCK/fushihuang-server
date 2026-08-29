# NOTICE — 组件来源与许可

本仓库将以下上游项目的"服务端"部分提取并聚合(模拟器本体已被移除):

| 目录 | 上游项目 | 上游许可 | 提取成分 |
|---|---|---|---|
| src/psp/adhocctl | Kethen/aemu (PSP adhoc 联机软件) | GPL-3.0-only | pspnet_adhocctl_server 服务器 |
| src/psp/postoffice | Kethen/aemu_postoffice | GPL-3.0-only | aemu_postoffice 中继服务器(server_njs) |
| src/azahar-room | Azahar Emulator (azahar-emu/azahar) | GPL-2.0-or-later | azahar-room 独立房间服务器及其依赖库(common/network/web_service/citra_room),自模拟器源码提取并裁剪 |
| src/eden-room | Eden Emulator (MEKCCK/mirror, 原 yuzu 系) | GPL-3.0-or-later | eden-room 独立房间服务器及其依赖库(common/network/web_service/dedicated_room),自模拟器源码提取并裁剪 |
| src/webui | 本仓库 | GPL-3.0-or-later | 大一统 Web 前端(玩家状态页/管理面板/Lobby API) |

上游仓库:

- https://github.com/Kethen/aemu
- https://github.com/Kethen/aemu_postoffice
- https://github.com/azahar-emu/azahar
- https://github.com/MEKCCK/mirror (Eden Emulator 镜像)

各源码文件保留其原始版权头与 SPDX 标记。