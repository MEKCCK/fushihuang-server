# 服始皇 · Fu Shi Huang — 大一统联机服务端

一个把 **PSP / 3DS / Switch 三大平台联机服务端** 集成到单个部署单元的 Linux 服务端项目。
由 GitHub Actions 自动构建,产出 **x86_64 与 ARM64** 两个架构的发行物(含 AppImage 单文件版)。

```
┌──────────────────────────────────────────────────────┐
│                    服始皇 (Fu Shi Huang)               │
│                                                      │
│  PSP 平台        pspnet_adhocctl_server  组管理  TCP 27312 │
│                  aemu_postoffice         数据中继  TCP 27313/27314 │
│  3DS 平台        azahar-room             房间服务器 UDP 24872  │
│  Switch 平台     eden-room               房间服务器 UDP 24873  │
│                                                      │
│  Web 前端 (TCP 8080)                                   │
│   ├─ /       玩家状态页:聚合显示所有服务器与房间状态       │
│   ├─ /admin  管理面板:启停/重启、日志、在线改配置         │
│   └─ /lobby  房间公告 API(房间服务器每 15 秒上报,本地化)  │
│                                                      │
│  自定义:运行目录自动生成 custom/ 文件夹,替换界面        │
└──────────────────────────────────────────────────────┘
```

## 重要概念:服务端 vs 创建房间

本项目只提供**独立运行的无头服务端进程**(常驻服务器),完全不是模拟器 GUI 里的"创建房间"(Host Room——那需要用户开着模拟器当主机,人走房灭)。

| 组件 | 性质 | 来源 |
|---|---|---|
| pspnet_adhocctl_server | ✅ 服务端 | aemu 项目提取(PSP 组管理) |
| aemu_postoffice | ✅ 服务端 | aemu_postoffice 项目(数据中继) |
| azahar-room | ✅ 服务端 | azahar 模拟器内部 room-server 提取 |
| eden-room | ✅ 服务端 | eden/mirror 模拟器内部 room-server 提取 |
| 状态页 + 管理面板 | ✅ 服务端 | 本仓库自研 Web 前端 |

两个模拟器仓库中**模拟器本体(GUI/模拟核心)已砍掉**,只保留房间服务器及必要库
(`common/network/web_service/citra_room` / `dedicated_room`),可独立编译运行。

## 公告公示:完全本地化,不依赖任何官方服务器

- azahar-room / eden-room 支持把房间信息上报到 Web API(名称/人数/游戏),供大厅列表展示;
- 上游默认公告服务器(api.azahar-emu.org、api.ynet-fun.xyz 等)已死;本项目把公告地址
  指向**本服务自己的 webui**(`/lobby`),玩家状态页与客户端查询房间全部走本地,不经第三方;
- 官方 JWT/令牌验证体系已按需移除(verify_user_jwt、cpp-jwt 依赖已删),**玩家加入房间无需令牌**;
- 可选:`config/unified-server.conf` 开启 `CVN_PLAY_ENABLED` 把房间**同时公示到 CVN Play 中国大厅**;
- 可选:`LOBBY_RELAY_ENABLED` 让 webui 把收到的公告**双份转发**(本地 + CVN)。

## 快速开始(Linux)

### 方式 A(推荐):AppImage 单文件(自带运行环境,无需安装任何依赖)

```bash
chmod +x fushihuang-server-linux-x86_64.AppImage
./fushihuang-server-linux-x86_64.AppImage start all   # 启动全部服务
./fushihuang-server-linux-x86_64.AppImage status      # 查看状态
./fushihuang-server-linux-x86_64.AppImage stop all    # 停止
```

- ARM 设备(树莓派/ARM 云服务器/ARM 手机)下载 `fushihuang-server-linux-arm64.AppImage`(经 ARM 实机验证);
- 系统无 FUSE 时用 `--appimage-extract-and-run` 参数运行;
- 首次运行后会在**运行目录自动生成 `custom/` 文件夹**,放入 `index.html` / `style.css`
  即可替换/定制玩家状态页。

### 方式 B:传统 tar.gz 包

```bash
tar -xzf fushihuang-server-linux-x86_64.tar.gz
cd fushihuang-server
./scripts/unified-server start all
```

### 方式 C:本机源码构建

```bash
sudo apt install gcc make libsqlite3-dev nodejs cmake ninja-build build-essential libssl-dev
make build       # PSP + azahar-room + eden-room
make start
```

## 玩家连接方法

| 平台 | 客户端 | 地址 | 端口 | 协议 |
|---|---|---|---|---|
| PSP | aemu 插件 / PPSSPP | 服务器IP | 27312 / 27313 | TCP |
| 3DS | Azahar 模拟器 → 多人游戏 | 服务器IP | 24872 | **UDP**(ENet) |
| Switch | Eden 模拟器 → 多人游戏 | 服务器IP | 24873 | **UDP**(ENet) |

⚠️ 房间服务器(24872/24873)是 **UDP** 协议(ENet),防火墙/安全组必须**同时放行对应端口的 TCP 与 UDP**;
PSP 两个端口为 TCP。官网卷帘勿漏。

## 管理面板与状态页

- 玩家状态页:http://IP:8080/ — 聚合显示五个服务的在线状态、PSP 在线会话、
  3DS/Switch 公开房间(名称/人数/游戏);
- 管理面板:http://IP:8080/admin — 登录后启停/重启任意服务、查看各服务日志、
  在线编辑配置(自动备份),管理密码在 `config/unified-server.conf`(默认 `change-me`)。

## 配置

`config/unified-server.conf` 集中所有参数:端口、房间名/密码/人数、推荐游戏、
公告开关(CVN Play 公示)、管理密码等;postoffice 中继参数见 `config/postoffice.json`。

## 已知事项

- azahar/eden 房间服务器基于 ENet/UDP,docker 与防火墙同时放行 TCP+UDP;
- eden 默认以**私有房间**运行(入内直连,无需公告令牌);公告公示需要动态构建模式(见 CI);
- AppImage 内含 node 运行时与全部二进制,离线可用;
- 未做开机自启(systemd);可自行 `systemctl` 包一层 `scripts/unified-server start all`。

## 来源与许可

| 目录 | 来源 | 提取内容 |
|---|---|---|
| src/psp/adhocctl | Kethen/aemu | pspnet_adhocctl_server |
| src/psp/postoffice | Kethen/aemu_postoffice | 中继服务器(TS) |
| src/azahar-room | azahar-emu/azahar | azahar-room 及依赖库 |
| src/eden-room | MEKCCK/mirror (Eden) | eden-room 及依赖库 |
| src/webui | 本仓库 | 大一统前端 + Lobby API |

各组件保持上游许可(见 LICENSE / NOTICE.md)。