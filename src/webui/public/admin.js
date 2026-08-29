// 管理面板逻辑
const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("admin_token") || "";

const api = async (url, opts = {}) => {
    const headers = { ...(opts.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) { showLogin(); throw new Error("unauthorized"); }
    return res.json().catch(() => ({}));
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function showLogin() {
    token = ""; localStorage.removeItem("admin_token");
    $("login-form").hidden = false;
    $("admin-main").hidden = true;
}
function showMain() {
    $("login-form").hidden = true;
    $("admin-main").hidden = false;
    refreshServices();
}

// ---- 登录 ----
$("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await api("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: $("login-password").value }),
    });
    if (r.ok) {
        token = r.token; localStorage.setItem("admin_token", r.token);
        $("login-msg").textContent = "";
        showMain();
    } else {
        $("login-msg").className = "err-msg";
        $("login-msg").textContent = "密码错误";
    }
});
$("btn-logout").addEventListener("click", () => showLogin());

// ---- 服务状态 ----
async function refreshServices() {
    const st = await api("/api/admin/status");
    const box = $("services");
    box.innerHTML = Object.entries(st.services).map(([name, s]) => `
      <div class="svc">
        <h3>${esc(s.name)} <span class="${s.online ? "ok-msg" : "err-msg"}">${s.online ? "● 运行中" : "○ 已停止"}</span></h3>
        <div class="thin">端口 ${s.port} · PID ${s.pid || "-"}${s.debugPort ? " · 调试 " + s.debugPort : ""}</div>
        ${s.rooms && s.rooms.length ? `<div class="thin">房间:${s.rooms.map(r => `「${esc(r.name)}」${(r.players||[]).length}/${r.maxPlayers}`).join("、")}</div>` : ""}
        <div class="ops">
          <button onclick="ctrl('${name}','start')">启动</button>
          <button class="sec" onclick="ctrl('${name}','stop')">停止</button>
          <button class="sec" onclick="ctrl('${name}','restart')">重启</button>
        </div>
      </div>`).join("");
}

async function ctrl(service, action) {
    await api("/api/admin/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, action }),
    });
    refreshServices();
}

$("btn-refresh").addEventListener("click", refreshServices);
$("btn-all-start").addEventListener("click", () => ctrl("all", "start"));
$("btn-all-stop").addEventListener("click", () => ctrl("all", "stop"));
$("btn-all-restart").addEventListener("click", () => ctrl("all", "restart"));

// ---- 日志 ----
$("btn-log-refresh").addEventListener("click", async () => {
    const svc = $("log-service").value;
    const res = await fetch(`/api/admin/logs?service=${svc}&lines=200`, {
        headers: { Authorization: "Bearer " + token },
    });
    if (res.status === 401) return showLogin();
    $("log-view").textContent = await res.text();
});
$("log-service").addEventListener("change", () => $("btn-log-refresh").click());

// ---- 配置 ----
$("btn-config-reload").addEventListener("click", async () => {
    const res = await fetch("/api/admin/config", { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401) return showLogin();
    $("config-editor").value = await res.text();
});
$("btn-config-save").addEventListener("click", async () => {
    const r = await api("/api/admin/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: $("config-editor").value }),
    });
    $("config-msg").className = r.ok ? "ok-msg" : "err-msg";
    $("config-msg").textContent = r.ok ? "配置已保存(记得重启服务生效)" : "保存失败";
});

// ---- tabs ----
document.querySelectorAll(".tabs button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => {
        document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        ["services", "logs", "config"].forEach((t) => ($("tab-" + t).hidden = t !== b.dataset.tab));
    });
});

// bootstrap
(async () => {
    if (token) {
        try { await api("/api/admin/status"); showMain(); return; } catch {}
    }
    showLogin();
})();