# 服始皇 (Fu Shi Huang) — 大一统联机服务端

一个把 **PSP / 3DS / Switch 三大平台联机服务端** 合并成单一部署单元的项目:
用 GitHub Actions 构建,只分发 **Linux** 版本,一条命令启动全部服务。

```
┌────────────────────────────────────────────────────────────┐
│                    大一统联机服务端                           │
│                                                            │
│  PSP 平台                                                    │
│   ├─ pspnet_adhocctl_server  组管理服务   TCP 27312         │
│   └─ aemu_postoffice         数据中继     TCP 27313/27314   │
│  3DS 平台                                                    │
│   └─ azahar-room             联机房间服务 TCP 24872          │
│  Switch 平台                                                  │
│   └─ eden-room               联机房间服务 TCP 24873          │
│                                                            │
│  Web 前端 (WEBUI, TCP 8080)                                   │
│   ├─ /        玩家状态页:聚合显示所有服务器与房间状态          │
│   └─ /admin   管理面板:启停/重启服务、看日志、改配置           │
│   └─ /lobby   房间公告 API(房间服务器每 15 秒上报,完全本地)    │
│                                                            │
│  custom/     玩家状态页自定义(custom/index.html, style.css)  │
└────────────────────────────────────────────────────────────┘
```

## 重要概念:服务端 vs 创建房间

本项目只提供**独立运行的服务端进程**(无头服务器,常驻运行):

| 组件 | 性质 | 说明 |
|---|---|---|
| pspnet_adhocctl_server | ✅ 服务端 | PSP 房间/组管理服务器(来自 aemu 项目) |
| aemu_postoffice | ✅ 服务端 | PSP 数据中继服务器(来自 aemu_postoffice 项目) |
| azahar-room | ✅ 服务端 | 3DS 专用房间服务器(自 azahar 模拟器源码提取) |
| eden-room | ✅ 服务端 | Switch 专用房间服务器(自 eden/mirror 模拟器源码提取) |
| 玩家状态页 / 管理面板 | ✅ 服务端 | 大一统 Web 前端 |

与"创建房间"不同:

- ❌ **创建房间(Host Room)** 是模拟器 GUI 里的功能——需要有人打开模拟器当主机,模拟器一关房间就没了。
- ✅ 本项目的**服务端**是独立进程,7×24 运行,玩家随时连接。

本项目把 azahar / eden(mirror)两个模拟器仓库中**专门的房间服务器目标**
(`citra_room_standalone` / `yuzu_room_standalone`)及其依赖库提取出来,
**模拟器本体(GUI/模拟核心)已全部砍掉**,只保留服务端。

## 公告(公开房间列表)完全本地化,不依赖任何官方服务器

- azahar/eden 房间服务器支持向 Web API"公告"房间(名称/人数/游戏)。
- 上游默认的公告服务器(如 `api.azahar-emu.org`、第三方 `api.ynet-fun.xyz`)**
  已不可用**。本服务端中的房间服务器公告地址被改到**本服务自己的 WebUI**
  (`WEB_API_URL`,默认 `http://127.0.0.1:8080`),玩家状态页与客户端查询房间走
  `/lobby` 接口——**全程内部中转,不经过任何第三方**。
- 官方 JWT 令牌验证体系已按需**移除**:玩家加入房间无需任何令牌(`NullBackend`),
  密钥/公钥相关代码已删除,构建不再依赖 cpp-jwt。

## 快速开始(Linux)

### 方式 A(推荐):AppImage 单文件(自带运行环境,无需安装任何依赖)

```bash
./fushihuang-server-linux-x86_64.AppImage start all   # 启动全部服务
./fushihuang-server-linux-x86_64.AppImage status      # 查看状态
./fushihuang-server-linux-x86_64.AppImage stop all    # 停止
```

- ARM 设备(树莓派/ARM 云服务器)下载 `fushihuang-server-linux-arm64.AppImage`;
- 若系统没有 FUSE,用 `--appimage-extract-and-run` 方式执行:
  `./fushihuang-server-linux-x86_64.AppImage --appimage-extract-and-run start all`;
- 首次运行后会在**运行目录自动生成 `custom/` 文件夹**——往里面放
  `index.html` / `style.css` 即可替换/定制玩家状态页(无需进包内改文件)。

### 方式 B:传统 tar.gz 包

```bash
tar -xzf fushihuang-server-linux-x86_64.tar.gz
cd fushihuang-server
./scripts/unified-server start all
```

### 方式 C:本机源码构建

```bash
make build
make start
```

访问:

- 玩家状态页:http://服务器IP:8080/
- 管理面板:http://服务器IP:8080/admin (默认密码 `change-me`,务必修改)

### 构建依赖(仅源码构建方式需要)

| 组件 | 依赖 |
|---|---|
| PSP (adhocctl) | gcc, make, libsqlite3-dev |
| PSP (postoffice) | node >= 16, npm(仅构建一次,产物为 JS) |
| azahar-room | cmake, ninja, g++, libssl-dev, git(拉取 36 个 externals 子模块) |
| eden-room | cmake, ninja, g++, libssl-dev, libavcodec/libavformat/libavutil/libswscale-dev(动态回退模式) |

## 玩家连接方法

| 平台 | 模拟器/插件 | 服务器地址 | 端口 |
|---|---|---|---|
| PSP | aemu 插件 / PPSSPP 网络对战 | 服务器IP | 27312(组管理)、27313(中继) |
| 3DS | Azahar 模拟器 → 多人游戏 → 加入房间 | 服务器IP | 24872 |
| Switch | Eden 模拟器 → 多人游戏 → 加入房间 | 服务器IP | 24873 |

## 配置

所有配置集中在 `config/unified-server.conf`(管理面板里也能改):

- 端口、房间名、房间密码、最大人数、推荐游戏;
- `AZAHAR_ROOM_TOKEN` / `EDEN_ROOM_TOKEN`:公告开关(默认开启,公告走本地 WebUI);
- 实机部署时把 `WEB_API_URL` 改成 `http://你的公网IP或域名:8080`;
- `ADMIN_PASSWORD`:管理面板密码。

postoffice 中继参数:`config/postoffice.json`。

## 自定义玩家状态页

把 `custom/index.html`(整页替换)或 `custom/style.css`(附加样式)放入 `custom/` 目录
即可,无需重启。页面数据从 `/api/status` 拉取(JSON),可自由排版。

## 管理面板

- 服务状态查看与 启动/停止/重启;
- 各服务实时日志(`tail`);
- 在线编辑配置(自动备份 `unified-server.conf.bak`);
- 管理接口需要登录(`config/unified-server.conf` 中 `ADMIN_PASSWORD`)。

## 项目来源与许可

| 目录 | 来源 | 提取内容 |
|---|---|---|
| src/psp/adhocctl | [Kethen/aemu](https://github.com/Kethen/aemu) | pspnet_adhocctl_server |
| src/psp/postoffice | [Kethen/aemu_postoffice](https://github.com/Kethen/aemu_postoffice) | relay 服务器(TS) |
| src/azahar-room | [azahar](https://github.com/azahar-emu/azahar) | azahar-room 及依赖库 |
| src/eden-room | [eden/mirror](https://github.com/MEKCCK/mirror) | eden-room 及依赖库 |
| src/webui | 本项目 | 大一统前端 + Lobby API |

各组件保持上游许可(见 LICENSE / NOTICE.md)。