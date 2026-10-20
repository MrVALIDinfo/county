"use strict";
/* Auth UI: sign-in / setup gate, step-up modal, account settings, access log.
   The session is an HttpOnly cookie managed by the server: nothing secret is ever stored in the browser. */
const AUTH_I18N = {
  en: {
    setupTitle: "Create your account", setupSub: "Pick a username and password.",
    explain: "Passwords are stored as salted hashes only.",
    signinTitle: "Sign in", signinSub: "Welcome back.",
    username: "Username", password: "Password", confirmPw: "Confirm password",
    create: "Create account", signin: "Sign in", show: "Show password", hide: "Hide password",
    wrong: "Wrong username or password", expired: "Session expired. Sign in again.",
    fillBoth: "Enter your username and password.", weak: "Choose a stronger password.", mismatch: "Passwords do not match.",
    reqLen: "At least 8 characters", reqUniq: "Not just one repeated character", reqUser: "Different from your username", reqMatch: "Both passwords match",
    locked: (n) => `Too many attempts. Try again in ${n}.`, neterr: "Server unreachable. Try again.",
    stepTitle: "Confirm your password", stepBody: "Confirm your password (valid 5 min).",
    confirm: "Confirm", cancel: "Cancel", wrongPw: "Wrong password",
    account: "Account", signedAs: "Signed in as", owner: "Owner", viewer: "Guest", signout: "Sign out",
    changePw: "Change password", oldPw: "Current password", newPw: "New password", updatePw: "Update password", pwChanged: "Password updated.", wrongOld: "Current password is incorrect.",
    guestTitle: "Guest access (read-only)", guestSub: "Guests can view, not change.", createGuest: "Create guest", guestCreated: "Guest created.",
    exists: "That username is already taken.", noGuests: "No guests yet.", delGuest: "Delete guest", delGuestConfirm: (u) => `Delete guest “${u}”?`, delShort: "Delete",
    logTitle: "Access log", logSub: "Who opened your data, and when", logIntro: "Hash-chained, so edits are detectable.",
    intact: "Log integrity verified", tamper: "Tampering detected", loading: "Loading…", noEntries: "No entries yet.",
    roBanner: "Read-only guest access", readOnly: "Read-only access", langBtn: "中文",
  },
  zh: {
    setupTitle: "创建账户", setupSub: "设置用户名和密码。",
    explain: "密码仅以加盐哈希保存。",
    signinTitle: "登录", signinSub: "欢迎回来。",
    username: "用户名", password: "密码", confirmPw: "确认密码",
    create: "创建账户", signin: "登录", show: "显示密码", hide: "隐藏密码",
    wrong: "用户名或密码错误", expired: "登录已过期，请重新登录",
    fillBoth: "请输入用户名和密码。", weak: "请设置更强的密码。", mismatch: "两次输入的密码不一致。",
    reqLen: "至少 8 个字符", reqUniq: "不能全是同一个字符", reqUser: "不能与用户名相同", reqMatch: "两次密码一致",
    locked: (n) => `尝试次数过多，请在 ${n} 后重试。`, neterr: "无法连接服务器，请重试。",
    stepTitle: "确认密码", stepBody: "请确认密码（5 分钟内有效）。",
    confirm: "确认", cancel: "取消", wrongPw: "密码错误",
    account: "账户", signedAs: "当前登录", owner: "所有者", viewer: "访客", signout: "退出登录",
    changePw: "修改密码", oldPw: "当前密码", newPw: "新密码", updatePw: "更新密码", pwChanged: "密码已更新。", wrongOld: "当前密码不正确。",
    guestTitle: "访客权限（只读）", guestSub: "访客只能查看，不能修改。", createGuest: "创建访客", guestCreated: "访客已创建。",
    exists: "该用户名已被占用。", noGuests: "还没有访客。", delGuest: "删除访客", delGuestConfirm: (u) => `确定删除访客“${u}”？`, delShort: "删除",
    logTitle: "访问日志", logSub: "谁在何时访问了你的数据", logIntro: "日志经哈希串联，改动可被发现。",
    intact: "日志完整性已验证", tamper: "检测到篡改", loading: "加载中…", noEntries: "暂无记录。",
    roBanner: "只读访客权限", readOnly: "只读权限", langBtn: "English",
  },
};
const au = () => AUTH_I18N[lang] || AUTH_I18N.en;

(function () {
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const CONSENT_KEY = "consent_v1";

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
.au-gate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;overflow:auto;padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));background-color:var(--bg0);background-image:var(--aurora),var(--base);background-attachment:fixed;background-repeat:no-repeat;color:var(--ink)}
.au-card{width:100%;max-width:420px;display:grid;gap:14px}
.au-card h1{font-size:24px;font-weight:800;letter-spacing:-.01em;margin:0}
.au-card form,.au-sheet form{display:grid;gap:12px}
.au-brand{display:flex;align-items:center;gap:12px}.au-name{font-size:30px;font-weight:800;letter-spacing:-.02em;text-align:center;margin-bottom:6px;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.au-pw{position:relative;display:block}
.au-pw input{padding-right:48px}
.au-eye{position:absolute;right:0;top:0;width:44px;height:44px;border:0;background:transparent;color:var(--muted);cursor:pointer;display:grid;place-items:center;border-radius:var(--r-pill)}
.au-eye svg{width:20px;height:20px}
.au-err{color:var(--bad-text);font-weight:600;font-size:14px;margin:0}
.au-info{color:var(--warn-text);font-weight:600;font-size:14px;margin:0}
.au-msg{margin:0;font-size:14px;font-weight:600}
.au-msg.ok{color:var(--accent-text)}
.au-msg.bad{color:var(--bad-text)}
.au-req{list-style:none;padding:0;margin:0;display:grid;gap:4px;font-size:13px;color:var(--muted)}
.au-req li::before{content:"\\25CB\\00a0\\00a0"}
.au-req li.ok{color:var(--accent-text)}
.au-req li.ok::before{content:"\\2713\\00a0\\00a0"}
.au-lang{display:flex;justify-content:center}
.au-lang button{min-height:44px;padding:0 16px;border:0;background:transparent;color:var(--muted);font-weight:600;cursor:pointer;border-radius:var(--r-pill);text-decoration:underline}
.au-ov{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,16,32,.55)}
.au-sheet{width:100%;max-width:480px;max-height:92dvh;overflow:auto;background:var(--bg0,var(--glass2));color:var(--ink);border:1px solid var(--gborder);border-radius:var(--r-panel) var(--r-panel) 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:var(--shadow);display:grid;gap:12px}
.au-sheet h2{margin:0;font-size:20px}
.au-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.au-user{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
.au-user:first-child{border-top:0}
.au-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
.au-row:first-child{border-top:0}
.au-row .au-main{min-width:0;display:grid;gap:2px}
.au-row .au-main b{word-break:break-word;font-size:14px}
.au-st{font-variant-numeric:tabular-nums;font-weight:700;font-size:13px;white-space:nowrap;color:var(--accent-text)}
.au-st.bad{color:var(--bad-text)}
.au-integrity{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r-pill);font-size:14px;font-weight:700;background:var(--glass2);border:1px solid var(--gborder)}
.au-integrity svg{width:16px;height:16px;stroke-width:3}
.au-integrity.ok{background:color-mix(in srgb,var(--accent) 22%,transparent);border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--ink)}
.au-integrity.bad{color:var(--bad-text);border-color:var(--bad-text)}
#au-banner{position:fixed;top:calc(60px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:5;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--warn-text);background:var(--glass2);border-bottom:1px solid var(--gborder);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
body.role-viewer{padding-top:calc(94px + env(safe-area-inset-top))}
.role-viewer #fab-chat,.role-viewer #fab-scan,.role-viewer #chat,.role-viewer .fab-add,.role-viewer .ask-ai,.role-viewer [data-a="confirm"],.role-viewer [data-a="resolve"],.role-viewer [data-a="chatresolve"],.role-viewer [data-a="dep"],.role-viewer [data-a="delgoal"],.role-viewer [data-a="demo"],.role-viewer [data-a="delall"],.role-viewer [data-go="goal/new"],.role-viewer [data-go$="/edit"],.role-viewer #depform,.role-viewer #goalform,.role-viewer .row-link,.role-viewer #vd-panel,.role-viewer [data-vd],.role-viewer .gm-dot:last-child,.role-viewer #tr-export{display:none!important}
.role-viewer #profform{opacity:.55;pointer-events:none}
`;
  document.head.appendChild(css);

  const EXTRA_ICONS = {
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  };
  Object.keys(EXTRA_ICONS).forEach((k) => { if (!ICONS[k]) ICONS[k] = EXTRA_ICONS[k]; });
  if (!ICONS.shield) ICONS.shield = '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>';

  /* ---------- state + helpers ---------- */
  window.AUTH = { username: "", role: null, stepup_until: null, idle_timeout_s: 0 };

  const fmtSecs = (n) => { n = Math.max(0, Math.ceil(+n || 0)); return n >= 60 ? Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0") : n + "s"; };
  const fmtTime = (ts, full) => {
    try {
      const d = typeof ts === "number" ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(ts);
      if (isNaN(d.getTime())) return String(ts == null ? "" : ts);
      return full
        ? d.toLocaleString(locale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : d.toLocaleDateString(locale(), { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return String(ts == null ? "" : ts); }
  };
  const policy = (u, p) => ({
    len: p.length >= 8,
    uniq: p.length > 0 && new Set(p).size > 1,
    user: p.length > 0 && p.toLowerCase() !== String(u || "").trim().toLowerCase(),
  });
  const policyOk = (r) => r.len && r.uniq && r.user;
  const say = (el, text, ok) => { if (!el) return; el.textContent = text || ""; el.className = "au-msg " + (ok ? "ok" : "bad"); el.hidden = !text; };
  const toast = (msg) => { try { showToast(`<b>${esc(msg)}</b>`); } catch (e) { /* ignore */ } };
  const eyeBtn = () => `<button type="button" class="au-eye" aria-label="${esc(au().show)}" aria-pressed="false">${ic("eye")}</button>`;

  const BEHIND = ["#app", "#nav", ".top", "#fab-chat", "#fab-scan", "#scan-toast", "#chat", "#au-banner"];
  const setBehind = (on) => BEHIND.forEach((q) => { const el = document.querySelector(q); if (el) el.inert = on; });

  function paintBanner() {
    let b = document.getElementById("au-banner");
    if (!b) { b = document.createElement("div"); b.id = "au-banner"; b.setAttribute("role", "status"); document.body.appendChild(b); }
    const v = window.AUTH.role === "viewer";
    b.hidden = !v;
    b.textContent = v ? au().roBanner : "";
  }

  function applyStatus(s) {
    const authed = !!(s && s.authenticated);
    window.AUTH = { username: authed ? (s.username || "") : "", role: authed ? (s.role || "owner") : null, stepup_until: (s && s.stepup_until) || null, idle_timeout_s: (s && s.idle_timeout_s) || 0 };
    document.body.classList.toggle("role-viewer", window.AUTH.role === "viewer");
    /* server is the source of truth for consent; localStorage is only a cache */
    if (authed && s.consent !== undefined) {
      if (s.consent && (s.consent.at || s.consent.version)) store.set(CONSENT_KEY, s.consent.at || new Date().toISOString());
      else store.del(CONSENT_KEY);
    }
    paintBanner();
  }

  async function fetchStatus() {
    try { return await api("/auth/status", undefined, true); }
    catch (e) { if (e && e.status === 404) return null; throw e; }   // null: backend without auth, behave as open
  }

  /* ---------- generic modal (step-up) ---------- */
  function modal(aria, html, init) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const ov = document.createElement("div");
      ov.className = "au-ov";
      ov.innerHTML = `<div class="au-sheet" role="dialog" aria-modal="true" aria-label="${esc(aria)}" tabindex="-1">${html}</div>`;
      const card = ov.firstChild;
      let done = false;
      const close = (v) => {
        if (done) return;
        done = true;
        ov.removeEventListener("keydown", onKey, true);
        ov.remove();
        try { if (prev && prev.focus) prev.focus(); } catch (e) { /* ignore */ }
        resolve(v === undefined ? null : v);
      };
      const focusables = () => Array.from(card.querySelectorAll("button, input")).filter((el) => !el.disabled && el.offsetParent !== null);
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(null); return; }
        if (e.key !== "Tab") return;
        const f = focusables();
        if (!f.length) { e.preventDefault(); card.focus(); return; }
        const first = f[0], last = f[f.length - 1], a = document.activeElement;
        if (e.shiftKey && (a === first || a === card)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
        else if (!card.contains(a)) { e.preventDefault(); first.focus(); }
      }
      ov.addEventListener("keydown", onKey, true);
      ov.addEventListener("click", (e) => { if (e.target === ov) close(null); });
      document.body.appendChild(ov);
      try { init(card, close); } catch (e) { console.error("auth modal", e); }
      const f = focusables();
      (f[0] || card).focus();
    });
  }

  /* ---------- step-up ---------- */
  let stepP = null;
  function stepup() {
    if (stepP) return stepP;
    const x = au();
    const html = `<h2>${esc(x.stepTitle)}</h2><p class="muted" style="margin:0">${esc(x.stepBody)}</p>
      <form id="au-stepform" novalidate><label>${esc(x.password)}<span class="au-pw"><input id="au-stepin" type="password" name="password" autocomplete="current-password" required>${eyeBtn()}</span></label>
      <p class="au-err" id="au-steperr" role="alert" hidden></p>
      <div class="au-actions"><button type="button" class="btn ghost" id="au-stepno">${esc(x.cancel)}</button><button class="btn" id="au-stepyes">${esc(x.confirm)}</button></div></form>`;
    stepP = modal(x.stepTitle, html, (root, close) => {
      const form = root.querySelector("#au-stepform"), inp = root.querySelector("#au-stepin"), err = root.querySelector("#au-steperr"), yes = root.querySelector("#au-stepyes");
      root.querySelector("#au-stepno").addEventListener("click", () => close(false));
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); e.stopPropagation();
        const pw = inp.value, y = au();
        if (!pw) { inp.focus(); return; }
        yes.disabled = true; err.hidden = true;
        try {
          const r = await api("/auth/stepup", { password: pw }, true);
          if (r && r.stepup_until) window.AUTH.stepup_until = r.stepup_until;
          close(true);
        } catch (er) {
          const b = (er && er.body) || {};
          if (b.error === "unauthenticated") { close(false); reauth(y.expired); return; }
          yes.disabled = false; err.hidden = false;
          err.textContent = b.error === "locked" ? y.locked(fmtSecs(b.retry_after)) : (b.error === "invalid" || (er && er.status === 401)) ? y.wrongPw : y.neterr;
          inp.value = ""; inp.focus();
        }
      });
    }).then((v) => { stepP = null; return v === true; });
    return stepP;
  }

  /* ---------- sign-in / setup gate ---------- */
  let gateP = null;
  function showGate(mode, reason) {
    if (gateP) return gateP;
    gateP = new Promise((resolve) => buildGate(mode, reason, resolve)).then(() => { gateP = null; });
    return gateP;
  }

  function buildGate(mode, reason, done) {
    const ov = document.createElement("div");
    ov.className = "au-gate"; ov.id = "au-gate";
    document.body.appendChild(ov);
    setBehind(true);
    let curMode = mode, curReason = reason || "", uname = "", lockUntil = 0, lockTm = null;

    function paint() {
      clearInterval(lockTm);
      const x = au(), setup = curMode === "setup";
      ov.innerHTML = `<div class="au-card panel" role="dialog" aria-modal="true" aria-labelledby="au-h">
        <div class="au-name" aria-hidden="true">County</div>
        <div class="au-brand"><span class="tile-ico" style="--c:var(--accent)">${ic(setup ? "shield" : "lock")}</span><h1 id="au-h">${esc(setup ? x.setupTitle : x.signinTitle)}</h1></div>
        <p class="muted" style="margin:0">${esc(setup ? x.setupSub : x.signinSub)}</p>
        ${curReason ? `<p class="au-info" role="status">${esc(curReason)}</p>` : ""}
        <form id="au-form" novalidate>
          <label>${esc(x.username)}<input name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="40" required value="${esc(uname)}"></label>
          <label>${esc(x.password)}<span class="au-pw"><input name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" required>${eyeBtn()}</span></label>
          ${setup ? `<label>${esc(x.confirmPw)}<span class="au-pw"><input name="confirm" type="password" autocomplete="new-password" required>${eyeBtn()}</span></label>
          <ul class="au-req" aria-live="polite"><li data-req="len">${esc(x.reqLen)}</li><li data-req="uniq">${esc(x.reqUniq)}</li><li data-req="user">${esc(x.reqUser)}</li><li data-req="match">${esc(x.reqMatch)}</li></ul>` : ""}
          <p class="au-err" id="au-err" role="alert" hidden></p>
          <button class="btn" id="au-submit">${esc(setup ? x.create : x.signin)}</button>
        </form>
        ${setup ? `<p class="note" style="margin:0">${esc(x.explain)}</p>` : ""}
        <div class="au-lang"><button type="button" data-lang="${lang === "zh" ? "en" : "zh"}" lang="${lang === "zh" ? "en" : "zh-CN"}">${esc(x.langBtn)}</button></div>
      </div>`;
      const form = ov.querySelector("#au-form"), err = ov.querySelector("#au-err"), btn = ov.querySelector("#au-submit");
      const uIn = form.elements.username, pIn = form.elements.password, cIn = form.elements.confirm || null;
      const setErr = (m) => { err.textContent = m || ""; err.hidden = !m; };
      const upd = () => {
        if (!setup) return;
        const r = policy(uIn.value, pIn.value);
        ["len", "uniq", "user"].forEach((k) => ov.querySelector('[data-req="' + k + '"]').classList.toggle("ok", r[k]));
        ov.querySelector('[data-req="match"]').classList.toggle("ok", !!cIn.value && cIn.value === pIn.value);
      };
      form.addEventListener("input", upd);
      ov.querySelector("[data-lang]").addEventListener("click", (e) => {
        uname = uIn.value;
        lang = e.currentTarget.dataset.lang; store.set("lang", lang);
        document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
        paintBanner(); paint();
      });
      const startLock = (secs) => {
        clearInterval(lockTm);
        lockUntil = Date.now() + secs * 1000; btn.disabled = true;
        const tick = () => {
          const n = Math.ceil((lockUntil - Date.now()) / 1000);
          if (n <= 0) { clearInterval(lockTm); lockUntil = 0; btn.disabled = false; setErr(""); return; }
          setErr(au().locked(fmtSecs(n)));
        };
        tick(); lockTm = setInterval(tick, 1000);
      };
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (btn.disabled) return;
        const y = au(), u = uIn.value.trim(), p = pIn.value;
        setErr("");
        if (!u || !p) { setErr(y.fillBoth); (u ? pIn : uIn).focus(); return; }
        if (setup) {
          if (!policyOk(policy(u, p))) { setErr(y.weak); pIn.focus(); return; }
          if (p !== cIn.value) { setErr(y.mismatch); cIn.focus(); return; }
        }
        btn.disabled = true;
        try {
          let s = await api(setup ? "/auth/setup" : "/auth/login", { username: u, password: p }, true);
          if (!s || s.authenticated === undefined) s = await fetchStatus();
          if (!s || !s.authenticated) throw new Error("not authenticated");
          applyStatus(s);
          clearInterval(lockTm);
          ov.remove(); setBehind(false);
          done();
        } catch (er) {
          btn.disabled = false;
          const b = (er && er.body) || {};
          if (b.error === "locked") startLock(+b.retry_after || 30);
          else if (b.error === "weak_password") setErr(b.hint ? String(b.hint) : y.weak);
          else if (er && er.status === 409 && setup) { uname = u; curMode = "signin"; curReason = ""; paint(); return; }   // already configured elsewhere
          else if (er && er.status === 401) setErr(y.wrong);
          else setErr(y.neterr);
          pIn.value = ""; if (cIn) cIn.value = "";
          upd(); pIn.focus();
        }
      });
      upd();
      if (lockUntil > Date.now()) startLock((lockUntil - Date.now()) / 1000);
      (uIn.value ? pIn : uIn).focus();
    }
    ov.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = Array.from(ov.querySelectorAll("button, input")).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    });
    paint();
  }

  /* boot gate: resolves once the user is signed in (or the backend has no auth) */
  authHooks.gate = async function () {
    const s = await fetchStatus();
    if (!s) return;
    applyStatus(s);
    if (s.authenticated) return;
    await showGate(s.configured === false ? "setup" : "signin", "");
  };

  /* session lost mid-use (expiry, idle timeout, sign-out): show the gate over the app, return to the same route afterwards */
  let reauthP = null;
  function reauth(reason) {
    if (gateP) return gateP;
    if (reauthP) return reauthP;
    reauthP = (async () => {
      try {
        try { if (!$("#chat").hidden) closeChat(); } catch (e) { /* ignore */ }
        $("#app").innerHTML = "";
        S = null;
        const s = await fetchStatus();
        if (s) {
          applyStatus(s);
          if (!s.authenticated) await showGate(s.configured === false ? "setup" : "signin", reason || "");
        }
        await refresh();
        render();
      } catch (e) {
        console.error(e);
        $("#app").innerHTML = `<section class="panel empty"><p>${esc(t().err)}</p><button class="btn" data-a="retry">${esc(t().retry)}</button></section>`;
      } finally { reauthP = null; }
    })();
    return reauthP;
  }

  async function signOut() {
    try { await api("/auth/logout", {}, true); } catch (e) { /* the gate shows either way */ }
    applyStatus({ authenticated: false });
    reauth("");
  }

  /* error handling for every api() call */
  authHooks.handle = async function (err) {
    const code = err.body && err.body.error, x = au();
    if (err.status === 401 && code === "unauthenticated") { err.silent = true; reauth(x.expired); return false; }
    if (err.status === 403 && code === "stepup_required") { const ok = await stepup(); if (!ok) err.silent = true; return ok; }
    if (err.status === 403 && code === "forbidden") { toast(x.readOnly); err.silent = true; return false; }
    if (err.status === 428 && code === "consent_required") {
      store.del(CONSENT_KEY);
      let ok = false;
      try { ok = await consentOk(); } catch (e) { ok = false; }
      if (!ok) err.silent = true;
      return ok;
    }
    if (err.status === 429 && code === "locked") { toast(x.locked(fmtSecs(err.body.retry_after))); err.silent = true; return false; }
    return false;
  };

  /* ---------- Settings > Account ---------- */
  EXT.settings.push(() => {
    const x = au(), A = window.AUTH;
    if (!A || !A.role) return "";
    const owner = A.role === "owner";
    let h = `<section class="panel" id="au-acct"><div class="sec-head"><span class="tile-ico" style="--c:var(--accent2)">${ic("profile")}</span><div><h2>${esc(x.account)}</h2>
      <p class="muted">${esc(x.signedAs)} <b>${esc(A.username)}</b> <span class="pill ${owner ? "good" : ""}">${esc(owner ? x.owner : x.viewer)}</span></p></div></div>
      <button type="button" class="btn ghost" style="margin-top:12px" data-au="signout">${ic("logout")}${esc(x.signout)}</button></section>`;
    if (!owner) return h;
    h += `<section class="panel"><h2>${esc(x.changePw)}</h2><form id="au-pwform" novalidate>
        <input class="vh" type="text" name="username" autocomplete="username" value="${esc(A.username)}" tabindex="-1" aria-hidden="true" readonly>
        <label>${esc(x.oldPw)}<span class="au-pw"><input name="old" type="password" autocomplete="current-password" required>${eyeBtn()}</span></label>
        <label>${esc(x.newPw)}<span class="au-pw"><input name="new" type="password" autocomplete="new-password" required>${eyeBtn()}</span></label>
        <p class="au-msg" id="au-pwmsg" role="status" hidden></p><button class="btn">${esc(x.updatePw)}</button></form></section>
      <section class="panel"><h2>${esc(x.guestTitle)}</h2><p class="muted" style="margin:0 0 10px">${esc(x.guestSub)}</p>
        <div id="au-guests" class="stack" aria-live="polite"><p class="muted">${esc(x.loading)}</p></div>
        <form id="au-guestform" novalidate style="margin-top:12px">
          <label>${esc(x.username)}<input name="username" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="40" required></label>
          <label>${esc(x.password)}<span class="au-pw"><input name="password" type="password" autocomplete="new-password" required>${eyeBtn()}</span></label>
          <p class="au-msg" id="au-guestmsg" role="status" hidden></p><button class="btn">${esc(x.createGuest)}</button></form></section>
      <div class="stack">${linkCard("audit", "history", "--accent2", esc(x.logTitle), esc(x.logSub))}</div>`;
    return h;
  });

  async function loadGuests() {
    const box = document.getElementById("au-guests");
    if (!box) return;
    const x = au();
    try {
      const r = await api("/auth/users");
      const b = document.getElementById("au-guests");
      if (!b) return;
      const list = ((r && r.users) || []).filter((u) => u.role === "viewer");
      b.innerHTML = list.length
        ? list.map((u) => `<div class="au-user"><div class="grow"><b>${esc(u.username)}</b><div class="tag">${esc(fmtTime(u.created_at, false))}</div></div><button type="button" class="btn danger sm" data-au="delguest" data-u="${esc(u.username)}" aria-label="${esc(x.delGuest + ": " + u.username)}">${ic("trash")}${esc(x.delShort)}</button></div>`).join("")
        : `<p class="muted">${esc(x.noGuests)}</p>`;
    } catch (er) {
      const b = document.getElementById("au-guests");
      if (!b || (er && er.silent)) return;
      b.innerHTML = `<p class="muted">${esc(t().err)}</p><button type="button" class="btn ghost sm" data-au="guestretry">${esc(t().retry)}</button>`;
    }
  }

  /* ---------- access log ---------- */
  let auditSeq = 0;
  async function loadAudit() {
    const box = document.getElementById("au-log");
    if (!box) return;
    const seq = ++auditSeq, x = au();
    box.innerHTML = `<p class="muted" role="status">${esc(x.loading)}</p>`;
    try {
      const r = await api("/audit?limit=50");
      const b = document.getElementById("au-log");
      if (seq !== auditSeq || !b) return;
      const chip = r.chain_ok === true ? `<span class="au-integrity ok" role="status">${ic("check")}${esc(x.intact)}</span>`
        : r.chain_ok === false ? `<span class="au-integrity bad" role="status">${ic("alert")}${esc(x.tamper)}</span>` : "";
      const rows = (r.entries || []).map((e) => {
        const code = Number(e.status), bad = code >= 400;
        const who = (e.user == null || e.user === "" ? "—" : String(e.user)) + (e.role ? " · " + e.role : "");
        return `<div class="au-row"><div class="au-main"><b>${esc(e.action)}</b><span class="tag">${esc(fmtTime(e.ts, true))} · ${esc(who)}${e.ip ? " · " + esc(e.ip) : ""}</span></div><span class="au-st ${bad ? "bad" : ""}">${esc(e.status)}</span></div>`;
      }).join("");
      b.innerHTML = `<section class="panel"><div class="sec-head"><span class="tile-ico" style="--c:var(--accent2)">${ic("shield")}</span><div><h2>${esc(x.logTitle)}</h2><p class="muted">${esc(x.logIntro)}</p></div></div>
        <div style="margin-top:12px">${chip}</div></section>
        ${rows ? `<section class="panel" style="padding:4px 16px">${rows}</section>` : `<section class="panel empty"><p class="muted">${esc(x.noEntries)}</p></section>`}`;
    } catch (er) {
      const b = document.getElementById("au-log");
      if (seq !== auditSeq || !b) return;
      b.innerHTML = `<section class="panel empty"><p>${esc(t().err)}</p><button type="button" class="btn" data-au="auditretry">${esc(t().retry)}</button></section>`;
    }
  }
  EXT.routes.audit = { title: () => au().logTitle, page: () => `<div id="au-log" class="stack"><p class="muted">${esc(au().loading)}</p></div>`, parent: "#/settings" };

  /* ---------- after every render ---------- */
  EXT.after.push((r) => {
    paintBanner();
    if (window.AUTH.role === "viewer") ["#profform", "#depform", "#goalform"].forEach((q) => $$(q + " input, " + q + " button").forEach((el) => { el.disabled = true; }));
    if (r.name === "settings" && window.AUTH.role === "owner") loadGuests();
    if (r.name === "audit") loadAudit();
  });

  /* ---------- events ---------- */
  document.addEventListener("click", async (e) => {
    const eye = e.target.closest(".au-eye");
    if (eye) {
      const inp = eye.parentElement.querySelector("input");
      if (inp) {
        const show = inp.type === "password";
        inp.type = show ? "text" : "password";
        eye.setAttribute("aria-pressed", String(show));
        eye.setAttribute("aria-label", show ? au().hide : au().show);
        eye.innerHTML = ic(show ? "eyeoff" : "eye");
      }
      return;
    }
    const b = e.target.closest("[data-au]");
    if (!b) return;
    const a = b.dataset.au, x = au();
    if (a === "signout") { b.disabled = true; await signOut(); }
    else if (a === "auditretry") loadAudit();
    else if (a === "guestretry") loadGuests();
    else if (a === "delguest") {
      const u = b.dataset.u;
      if (!confirm(x.delGuestConfirm(u))) return;
      b.disabled = true;
      try { await api("/auth/users/delete", { username: u }); }
      catch (er) { if (!(er && er.silent)) alert(t().err); }
      loadGuests();
    }
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (!f || (f.id !== "au-pwform" && f.id !== "au-guestform")) return;
    e.preventDefault();
    const x = au(), btn = f.querySelector("button.btn:not(.au-eye)");
    const fail = (msgEl, er) => {
      if (er && er.silent) return;
      const b = (er && er.body) || {};
      if (b.error === "weak_password") say(msgEl, b.hint ? String(b.hint) : x.weak, false);
      else if (b.error === "locked") say(msgEl, x.locked(fmtSecs(b.retry_after)), false);
      else if (er && er.status === 409) say(msgEl, x.exists, false);
      else if (f.id === "au-pwform" && (b.error === "invalid" || (er && er.status === 401))) say(msgEl, x.wrongOld, false);
      else say(msgEl, x.neterr, false);
    };
    if (f.id === "au-pwform") {
      const msg = document.getElementById("au-pwmsg"), old = f.elements.old.value, nw = f.elements.new.value;
      say(msg, "", false);
      if (!old || !nw) { say(msg, x.fillBoth, false); return; }
      if (!policyOk(policy(window.AUTH.username, nw))) { say(msg, x.weak, false); return; }
      if (btn) btn.disabled = true;
      try { await api("/auth/password", { old, new: nw }); f.reset(); say(msg, x.pwChanged, true); }
      catch (er) { fail(msg, er); }
      if (btn) btn.disabled = false;
    } else {
      const msg = document.getElementById("au-guestmsg"), u = f.elements.username.value.trim(), p = f.elements.password.value;
      say(msg, "", false);
      if (!u || !p) { say(msg, x.fillBoth, false); return; }
      if (!policyOk(policy(u, p))) { say(msg, x.weak, false); return; }
      if (btn) btn.disabled = true;
      try { await api("/auth/viewer", { username: u, password: p }); f.reset(); say(msg, x.guestCreated, true); loadGuests(); }
      catch (er) { fail(msg, er); }
      if (btn) btn.disabled = false;
    }
  });

  paintBanner();
})();
