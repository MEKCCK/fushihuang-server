#!/usr/bin/env node
/**
 * ------------------------------------------------------------------
 *  大一统服务端 Web 前端 (服始皇 WebUI)
 * ------------------------------------------------------------------
 *  单一 node 服务,零 npm 依赖 (node >= 16)。
 *
 *  功能:
 *   - 玩家状态页( / )        :聚合显示全部服务器状态(PSP/3DS/Switch)
 *   - 管理面板( /admin )      :登录后控制服务启停 / 看日志 / 改配置
 *   - Lobby API( /lobby* )    :接收 azahar-room / eden-room 的房间公告,
 *                              玩家状态页与 Azahar/Eden 客户端均可查询
 *   - 兼容端点( /jwt/... )    :占位,验证已砍除
 *
 *  自定义:
 *   - custom/index.html 替换玩家页
 *   - custom/style.css  附加样式
 * ------------------------------------------------------------------
 */
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

// ------------------------------------------------------------- options
const args = process.argv.slice(2);
function arg(name, def) {
    const i = args.indexOf("--" + name);
    return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
}
const ROOT = path.resolve(arg("root", process.env.UNIFIED_ROOT || __dirname + "/../.."));
const PORT = parseInt(arg("port", process.env.WEBUI_PORT || "8080"), 10);

const CONF_FILE = path.join(ROOT, "config", "unified-server.conf");
const PUBLIC_DIR = path.join(__dirname, "public");
const CUSTOM_DIR = path.join(ROOT, "custom");
const DATA_DIR = path.join(ROOT, "data");
const RUN_DIR = path.join(DATA_DIR, "run");
const LOG_DIR = path.join(DATA_DIR, "logs");
const LOBBY_FILE = path.join(DATA_DIR, "lobby.json");
const UNIFIED_CTL = path.join(ROOT, "scripts", "unified-server");

// ------------------------------------------------------------- lobby relay (双公示)
// 把本服务收到的房间公告同时转发到外部大厅(如 CVN Play)
const RELAY_ENABLED = CONFIG.LOBBY_RELAY_ENABLED === "true";
const RELAY_URL = (CONFIG.LOBBY_RELAY_URL || "").replace(/\/+$/, "");
const RELAY_TOKEN = CONFIG.LOBBY_RELAY_TOKEN || "";

function relayPost(urlPath, body) {
    if (!RELAY_ENABLED || !RELAY_URL) return;
    const data = JSON.stringify(body);
    const u = new URL(RELAY_URL + urlPath);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) };
    if (RELAY_TOKEN) headers.Authorization = "Bearer " + RELAY_TOKEN;
    const req = http.request(u, { method: "POST", headers, timeout: 8000 }, (res) => {
        if (res.statusCode && res.statusCode >= 400)
            console.log(`[relay] POST ${urlPath} -> ${res.statusCode}`);
        res.resume();
    });
    req.on("timeout", () => req.destroy());
    req.on("error", (e) => console.log(`[relay] error: ${e.message}`));
    req.end(data);
}

function relayDelete(urlPath) {
    if (!RELAY_ENABLED || !RELAY_URL) return;
    const u = new URL(RELAY_URL + urlPath);
    const headers = {};
    if (RELAY_TOKEN) headers.Authorization = "Bearer " + RELAY_TOKEN;
    const req = http.request(u, { method: "DELETE", headers, timeout: 8000 }, (res) => res.resume());
    req.on("error", () => {});
    req.end();
}

// ------------------------------------------------------------- config
let CONFIG = {};
function parseConf(text) {
    const out = {};
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
}
function loadConfig() {
    try { CONFIG = parseConf(fs.readFileSync(CONF_FILE, "utf8")); }
    catch { CONFIG = {}; }
    return CONFIG;
}
loadConfig();

// ------------------------------------------------------------- helpers
const get = (url, timeout = 4000) =>
    new Promise((resolve) => {
        const req = http.get(url, { timeout }, (res) => {
            let buf = "";
            res.setEncoding("utf8");
            res.on("data", (c) => (buf += c));
            res.on("end", () => resolve({ status: res.statusCode, body: buf }));
        });
        req.on("timeout", () => req.destroy());
        req.on("error", () => resolve(null));
    });

const tcpProbe = (port, host = "127.0.0.1") =>
    new Promise((resolve) => {
        const s = net.connect({ port, host }, () => { s.destroy(); resolve(true); });
        s.on("error", () => resolve(false));
        s.setTimeout(1500, () => { s.destroy(); resolve(false); });
    });

const readFile = (p, def = "") => { try { return fs.readFileSync(p, "utf8"); } catch { return def; } };
const pidRunning = (p) => {
    const pid = parseInt(readFile(p, "").trim(), 10);
    if (!pid) return null;
    try { process.kill(pid, 0); return pid; } catch { return null; }
};

// ------------------------------------------------------------- lobby 房间公告注册表 (azahar/eden 协议兼容)
let LOBBY = new Map(); // id -> room record
const LOBBY_TTL = 120000; // 公告超时(客户端每 15 秒更新一次)

function lobbyLoad() {
    try {
        const j = JSON.parse(fs.readFileSync(LOBBY_FILE, "utf8"));
        if (Array.isArray(j)) j.forEach((r) => LOBBY.set(r.id, r));
    } catch {}
}
lobbyLoad();
function lobbySave() {
    try { fs.writeFileSync(LOBBY_FILE, JSON.stringify([...LOBBY.values()], null, 2)); } catch {}
}
function lobbySweep(now) {
    for (const [id, r] of LOBBY) {
        if (now - (r.updatedAt || 0) > LOBBY_TTL) LOBBY.delete(id);
    }
}
function lobbyToCitra(r) {
    return {
        id: r.id, name: r.name, description: r.description || "",
        owner: r.owner || "", port: r.port || 0,
        preferredGameName: r.preferredGameName || "",
        preferredGameId: r.preferredGameId || 0,
        maxPlayers: r.maxPlayers || 16, netVersion: r.netVersion || 0,
        hasPassword: !!r.hasPassword, players: r.players || [],
    };
}

// ------------------------------------------------------------- 状态采集
async function collectStatus() {
    const now = Date.now();
    lobbySweep(now);

    const cfg = CONFIG;
    const ports = {
        pspAdhocctl: parseInt(cfg.PSP_ADHOCCTL_PORT || "27312", 10),
        pspPostoffice: parseInt(cfg.PSP_POSTOFFICE_PORT || "27313", 10),
        pspPostofficeDebug: parseInt(cfg.PSP_POSTOFFICE_DEBUG_PORT || "27314", 10),
        azaharRoom: parseInt(cfg.AZAHAR_ROOM_PORT || "24872", 10),
        edenRoom: parseInt(cfg.EDEN_ROOM_PORT || "24873", 10),
    };

    const [adhoc, post, azahar, eden] = await Promise.all([
        tcpProbe(ports.pspAdhocctl),
        tcpProbe(ports.pspPostoffice),
        tcpProbe(ports.azaharRoom),
        tcpProbe(ports.edenRoom),
    ]);

    // postoffice 调试数据
    let postofficeDebug = null;
    const pr = await get(`http://127.0.0.1:${ports.pspPostofficeDebug}/data_debug`, 2500);
    if (pr && pr.status === 200) {
        try { postofficeDebug = JSON.parse(pr.body); } catch { postofficeDebug = pr.body.slice(0, 512); }
    }

    // adhocctl status.xml (C 版服务端每 5 秒写一次)
    let adhocctlXml = "";
    const xml = readFile(path.join(DATA_DIR, "status.xml"));
    if (xml.includes("<")) adhocctlXml = xml;

    const roomList = [...LOBBY.values()];
    const azaharRooms = roomList.filter((r) => r.platform === "azahar").map(lobbyToCitra);
    const edenRooms = roomList.filter((r) => r.platform === "eden").map(lobbyToCitra);

    return {
        server: { name: cfg.PSP_SERVER_NAME || "服始皇", time: new Date().toISOString() },
        services: {
            "psp-adhocctl": {
                name: "PSP 组管理服务 (adhocctl)", port: ports.pspAdhocctl,
                online: adhoc, pid: pidRunning(path.join(RUN_DIR, "psp-adhocctl.pid")),
                xml: adhocctlXml,
            },
            "psp-postoffice": {
                name: "PSP 数据中继 (postoffice)", port: ports.pspPostoffice,
                online: post, pid: pidRunning(path.join(RUN_DIR, "psp-postoffice.pid")),
                debugPort: ports.pspPostofficeDebug, debug: postofficeDebug,
            },
            "azahar-room": {
                name: "3DS 联机房间 (azahar-room)", port: ports.azaharRoom,
                online: azahar, pid: pidRunning(path.join(RUN_DIR, "azahar-room.pid")),
                rooms: azaharRooms,
            },
            "eden-room": {
                name: "Switch 联机房间 (eden-room)", port: ports.edenRoom,
                online: eden, pid: pidRunning(path.join(RUN_DIR, "eden-room.pid")),
                rooms: edenRooms,
            },
            webui: {
                name: "大一统状态页/管理面板", port: PORT,
                online: true, pid: process.pid,
            },
        },
        lobby: { azahar: azaharRooms, eden: edenRooms },
    };
}

// ------------------------------------------------------------- admin 会话
const sessions = new Map(); // token -> expiry
const SESSION_TTL = 8 * 3600 * 1000;
function issueToken() {
    const t = crypto.randomBytes(24).toString("hex");
    sessions.set(t, Date.now() + SESSION_TTL);
    return t;
}
function checkAuth(req) {
    if (req.url.startsWith("/admin/login")) return true;
    const h = req.headers.authorization || "";
    const cookie = (req.headers.cookie || "").match(/(?:^|;\s*)token=([^;]+)/);
    const token = h.startsWith("Bearer ") ? h.slice(7) : (cookie ? cookie[1] : "");
    if (!token || !sessions.has(token)) return false;
    if (sessions.get(token) < Date.now()) { sessions.delete(token); return false; }
    return true;
}

// ------------------------------------------------------------- 静态文件
const MIME = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "application/javascript", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif",
    ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
};

function serveStatic(req, res, urlPath) {
    let rel = decodeURIComponent(urlPath.split("?")[0]);
    if (rel === "/") rel = "/index.html";
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("forbidden"); }
    // custom 覆盖:玩家状态页与样式可被 custom/ 目录替换
    let body;
    if (rel === "/index.html") {
        body = readFile(path.join(CUSTOM_DIR, "index.html")) ||
               readFile(path.join(PUBLIC_DIR, "index.html"));
    } else if (rel === "/style.css") {
        body = readFile(path.join(PUBLIC_DIR, "style.css")) +
               readFile(path.join(CUSTOM_DIR, "style.css"));
    } else {
        if (fs.existsSync(file)) body = fs.readFileSync(file);
        else return null;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(body);
    return true;
}

// ------------------------------------------------------------- HTTP 路由
const server = http.createServer(async (req, res) => {
    const url = req.url || "/";
    const pathname = url.split("?")[0];
    const method = (req.method || "GET").toUpperCase();

    // --- Lobby API (azahar/eden 公告协议,兼容 citra /lobby) ---
    if (pathname === "/lobby" && method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            try {
                const r = JSON.parse(body);
                const id = crypto.randomBytes(6).toString("hex");
                r.id = id; r.updatedAt = Date.now();
                r.platform = r.platform || (r.preferredGameId && r.preferredGameId > 0xffff ? "eden" : "azahar");
                LOBBY.set(id, r);
                lobbySave();
                // relay to CVN Play / external lobby (双公示)
                relayPost("/lobby", r);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ...lobbyToCitra(r), verify_UID: "" }));
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ error: "bad json" }));
            }
        });
        return;
    }
    const lobbyMatch = pathname.match(/^\/lobby\/([^/]+)$/);
    if (lobbyMatch && method === "POST") { // 更新房间(每 15 秒)
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            const id = lobbyMatch[1];
            const rec = LOBBY.get(id);
            if (!rec) { res.writeHead(404); return res.end(JSON.stringify({ error: "room not found" })); }
            try {
                const upd = JSON.parse(body);
                rec.players = upd.players || []; rec.updatedAt = Date.now();
                lobbySave();
                relayPost("/lobby/" + id, upd);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(lobbyToCitra(rec)));
            } catch { res.writeHead(400); res.end("bad json"); }
        });
        return;
    }
    if (lobbyMatch && method === "GET") {
        const rec = LOBBY.get(lobbyMatch[1]);
        if (!rec) { res.writeHead(404); return res.end("{}"); }
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(lobbyToCitra(rec)));
    }
    if (pathname === "/lobby" && method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ rooms: [...LOBBY.values()].map(lobbyToCitra) }));
    }
    if (lobbyMatch && method === "DELETE") {
        const rec = LOBBY.get(lobbyMatch[1]);
        LOBBY.delete(lobbyMatch[1]); lobbySave();
        if (rec) relayDelete("/lobby/" + rec.id);
        res.writeHead(200); return res.end("{}");
    }

    // --- 玩家状态 API ---
    if (pathname === "/api/status" && method === "GET") {
        const st = await collectStatus();
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        return res.end(JSON.stringify(st));
    }

    // --- 管理:登录 ---
    if (pathname === "/admin/login" && method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            try {
                const { password } = JSON.parse(body);
                const adminPass = CONFIG.ADMIN_PASSWORD || "change-me";
                if (password === adminPass) {
                    const t = issueToken();
                    res.writeHead(200, { "Content-Type": "application/json",
                        "Set-Cookie": `token=${t}; Path=/; HttpOnly; Max-Age=28800` });
                    res.end(JSON.stringify({ ok: true, token: t }));
                } else {
                    res.writeHead(401); res.end(JSON.stringify({ ok: false, error: "bad password" }));
                }
            } catch { res.writeHead(400); res.end("bad request"); }
        });
        return;
    }

    // --- 管理面板与 API 需要登录 ---
    const adminArea = pathname === "/admin" || pathname.startsWith("/admin/") ||
                      pathname.startsWith("/api/admin/");
    if (adminArea && !checkAuth(req)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "unauthorized" }));
    }

    if (pathname === "/admin" && method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(readFile(path.join(PUBLIC_DIR, "admin.html")));
    }

    if (pathname === "/api/admin/status" && method === "GET") {
        const st = await collectStatus();
        // 附上各服务进程信息
        for (const name of Object.keys(st.services)) {
            const rec = st.services[name];
            rec.logFile = path.join(LOG_DIR, name + ".log");
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(st));
    }

    if (pathname === "/api/admin/action" && method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            try {
                const { service, action } = JSON.parse(body);
                if (!["psp-adhocctl", "psp-postoffice", "azahar-room", "eden-room", "webui", "all"].includes(service) ||
                    !["start", "stop", "restart"].includes(action)) {
                    res.writeHead(400); return res.end(JSON.stringify({ error: "bad params" }));
                }
                execFile(UNIFIED_CTL, [action, service], { env: { ...process.env, UNIFIED_ROOT: ROOT } },
                    (err, stdout, stderr) => {
                        res.writeHead(err ? 500 : 200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ ok: !err, output: (stdout || stderr || "").slice(-4000) }));
                    });
            } catch { res.writeHead(400); res.end("bad request"); }
        });
        return;
    }

    if (pathname === "/api/admin/logs" && method === "GET") {
        const q = new URL(url, "http://x");
        const svc = q.searchParams.get("service") || "webui";
        const lines = parseInt(q.searchParams.get("lines") || "150", 10);
        const log = readFile(path.join(LOG_DIR, svc + ".log"));
        const tail = log.split(/\r?\n/).slice(-lines).join("\n");
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(tail || "(no log)");
    }

    if (pathname === "/api/admin/config" && method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(readFile(CONF_FILE));
    }

    if (pathname === "/api/admin/config" && method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            try {
                const { content } = JSON.parse(body);
                if (!content || content.length > 20000) { res.writeHead(400); return res.end(JSON.stringify({ error: "too long" })); }
                if (fs.existsSync(CONF_FILE))
                    fs.copyFileSync(CONF_FILE, CONF_FILE + ".bak");
                fs.writeFileSync(CONF_FILE, content);
                loadConfig();
                res.writeHead(200); res.end(JSON.stringify({ ok: true }));
            } catch { res.writeHead(400); res.end("bad request"); }
        });
        return;
    }

    // --- 静态文件 ---
    if (method === "GET" && !serveStatic(req, res, pathname)) {
        res.writeHead(404); res.end("not found");
    }
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[webui] unified netplay server webui listening on http://0.0.0.0:${PORT}`);
    console.log(`[webui] player status page : http://0.0.0.0:${PORT}/`);
    console.log(`[webui] admin panel        : http://0.0.0.0:${PORT}/admin`);
});