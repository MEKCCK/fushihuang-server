// 玩家状态页逻辑:拉取 /api/status 并渲染
async function refresh() {
    try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error("api error");
        const st = await res.json();

        document.title = st.server.name;
        const hn = document.getElementById("server-name");
        if (hn) hn.textContent = st.server.name;

        const S = st.services;
        renderCard("psp-adhocctl", S["psp-adhocctl"]);
        renderCard("psp-postoffice", S["psp-postoffice"]);

        const po = document.getElementById("postoffice-extra");
        if (po) {
            const d = S["psp-postoffice"].debug;
            let txt = "";
            if (d && typeof d === "object") {
                const n = d.total_sessions ?? d.sessions ?? d.num_sessions ?? "";
                txt = n !== "" ? "在线会话 " + n : "debug: " + (d.status || "ok");
            } else if (typeof d === "string") txt = d.slice(0, 60);
            po.textContent = txt;
        }

        renderCard("azahar-room", S["azahar-room"]);
        renderCard("eden-room", S["eden-room"]);
        renderRooms("azahar-rooms", st.lobby.azahar);
        renderRooms("eden-rooms", st.lobby.eden);

        setAgg("psp-agg", S["psp-adhocctl"].online && S["psp-postoffice"].online,
            S["psp-adhocctl"].online || S["psp-postoffice"].online);
        setAgg("azahar-agg", S["azahar-room"].online, S["azahar-room"].online);
        setAgg("eden-agg", S["eden-room"].online, S["eden-room"].online);

        const info = document.getElementById("server-info");
        if (info) {
            const azRooms = st.lobby.azahar, edRooms = st.lobby.eden;
            const azTxt = azRooms.map(r => `「${r.name}」 ${r.players ? r.players.length : 0}/${r.maxPlayers} 人`).join("、") || "暂无房间在开";
            const edTxt = edRooms.map(r => `「${r.name}」 ${r.players ? r.players.length : 0}/${r.maxPlayers} 人`).join("、") || "暂无房间在开";
            info.innerHTML =
                `服务器时间:${new Date(st.server.time).toLocaleString()}<br>` +
                `3DS 当前房间:${azTxt}<br>` +
                `Switch 当前房间:${edTxt}<br>` +
                `PSP 组管理:${S["psp-adhocctl"].online ? "在线" : "离线"} · ` +
                `PSP 数据中继:${S["psp-postoffice"].online ? "在线" : "离线"} · ` +
                `3DS 房间服务:${S["azahar-room"].online ? "在线" : "离线"} · ` +
                `Switch 房间服务:${S["eden-room"].online ? "在线" : "离线"}`;
        }
    } catch (e) {
        console.error(e);
    }
}

function renderCard(id, svc) {
    const el = document.getElementById(id);
    if (!el) return;
    const dot = el.querySelector(".dot");
    const state = el.querySelector(".state");
    if (dot) dot.className = "dot " + (svc.online ? "good" : "bad");
    if (state) state.textContent = svc.online ? "在线运行" : "已停止";
    const pidEl = el.querySelector(".meta .pid");
}

function renderRooms(id, rooms) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!rooms || !rooms.length) { el.innerHTML = '<div class="meta">暂无公开房间</div>'; return; }
    el.innerHTML = rooms.map(r => {
        const n = (r.players || []).length;
        const pw = r.hasPassword ? " 🔒" : "";
        return `<div class="room"><span class="rcount">${n}/${r.maxPlayers} 人</span>
          <div class="rname">${esc(r.name)}${pw}</div>
          <div class="rdetail">${esc(r.preferredGameName || "未指定游戏")} · 端口 ${r.port}${r.description ? " · " + esc(r.description) : ""}</div></div>`;
    }).join("");
}

function setAgg(id, ok, any) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "badge " + (ok ? "ok" : any ? "warn" : "err");
    el.textContent = ok ? "全部在线" : any ? "部分在线" : "已停止";
}

const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

refresh();
setInterval(refresh, 8000);