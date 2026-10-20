"use strict";
/* privacy, consent, bank-connect simulation (sets consentOk, EXT.bankConsent). Hook into app.js only through the EXT registry. */
const TRUST_I18N = {
  en: {
    cTitle: "Before you start", cAria: "Consent dialog",
    cB1: "Financial data is sensitive under China's PIPL.",
    cB2: "Used only for budgeting, with your consent.",
    cB3: "Demo build: synthetic data. Export, delete or withdraw anytime.",
    cB4: "We never ask for passwords.",
    cCheck: "I understand and agree", cAgree: "Agree", cNot: "Not now", cNeed: "Tick to continue", cFail: "Could not save. Try again.",
    pTitle: "Privacy & data", pLink: "Privacy & data", pLinkSub: "Your data, rights, consent",
    strip: "Your data stays private", learn: "Learn more",
    h1: "What we collect", l1: ["Only what you import or type.", "Profile: income, payday, goals."],
    h2: "Where it lives", l2: ["Your device and local database.", "Never sold or shared."],
    h3: "What we never do", l3: ["Ask for passwords.", "Scrape Alipay or WeChat.", "Give investment advice.", "Let AI make up numbers. Code does the math."],
    h4: "Your rights", l4: ["Export your data (JSON).", "Delete everything.", "Withdraw consent anytime.", "Undo auto-categorization."],
    h5: "How automatic decisions work", l5: ["Silent: known merchants recorded quietly.", "Digest: grouped for a quick look.", "Ask: unclear items wait for you.", "Every decision is explainable and reversible."],
    h6: "Compliance notes", l6: ["PIPL: financial data needs separate consent.", "Data minimisation: only what budgeting needs.", "Educational only, not investment advice.", "Demo uses synthetic data."],
    h7: "How your data flows", fYou: "You", fImp: "Import / Chat", fDb: "Local database", fCalc: "Calculations (code)", fLlm: "AI explains only",
    flowAria: "Data flow: you, import or chat, local database, calculations by code, AI that only explains",
    given: (d) => "Consent given on " + d, none: "No consent given yet",
    exp: "Export my data", del: "Delete my data", expBusy: "Preparing...", expDone: "Exported county-export.json", expFail: "Export failed. Try again.",
    wd: "Withdraw consent", wdDone: "Withdrawn. We will ask again before import.", wdConfirm: "Withdraw consent?",
    bTitle: (n) => "Connect " + n, bAria: (n) => "Connect " + n + " dialog", sim: "Simulated. No real connection.",
    bRead: "What is read", bReadV: "Transactions only. Read-only.",
    bPeriod: "Period", bDays: (n) => "Last " + n + " days", bWhere: "Where it stays", bWhereV: "Your device only. Never shared.",
    bRev: "Revoke anytime.", bPw: "We never see your password.", bAgree: "Request", bCancel: "Cancel",
    pending: "Pending", pendingAria: (n) => n + ": pending, tap to revoke", toastP: (n) => n + " requested (simulated).",
    rTitle: (n) => n + " is pending", rBody: "Simulated request.", rRevoke: "Revoke", rKeep: "Keep",
    toastR: (n) => n + " request revoked."
  },
  zh: {
    cTitle: "开始之前", cAria: "授权同意对话框",
    cB1: "按 PIPL，金融数据属敏感个人信息。",
    cB2: "仅用于预算，经你同意。",
    cB3: "演示版：合成数据。可随时导出、删除或撤回。",
    cB4: "我们绝不索取密码。",
    cCheck: "我已了解并同意", cAgree: "同意", cNot: "暂不", cNeed: "请勾选后继续", cFail: "保存失败，请重试。",
    pTitle: "隐私与数据", pLink: "隐私与数据", pLinkSub: "数据、权利、授权",
    strip: "你的数据保持私密", learn: "了解更多",
    h1: "我们收集什么", l1: ["仅限你导入或输入的内容。", "档案：收入、发薪日、目标。"],
    h2: "数据存放在哪", l2: ["你的设备和本地数据库。", "不出售，不共享。"],
    h3: "我们绝不做", l3: ["索取密码。", "抓取支付宝或微信。", "提供投资建议。", "让 AI 编造数字，金额由代码计算。"],
    h4: "你的权利", l4: ["导出数据（JSON）。", "删除所有数据。", "随时撤回同意。", "撤销自动分类。"],
    h5: "自动决策如何运作", l5: ["静默：已知商户直接记账。", "摘要：汇总供你快速查看。", "询问：不明确的记录等你确认。", "每个决定可解释、可撤销。"],
    h6: "合规说明", l6: ["PIPL：金融数据需单独同意。", "数据最小化：只留预算所需。", "仅供学习，不构成投资建议。", "演示使用合成数据。"],
    h7: "数据如何流转", fYou: "你", fImp: "导入 / 聊天", fDb: "本地数据库", fCalc: "计算（代码）", fLlm: "AI 仅负责解释",
    flowAria: "数据流：你、导入或聊天、本地数据库、代码计算、仅负责解释的 AI",
    given: (d) => "已于 " + d + " 同意", none: "尚未授权",
    exp: "导出我的数据", del: "删除我的数据", expBusy: "正在准备...", expDone: "已导出 county-export.json", expFail: "导出失败，请重试。",
    wd: "撤回同意", wdDone: "已撤回，导入前会再次询问。", wdConfirm: "撤回同意？",
    bTitle: (n) => "连接 " + n, bAria: (n) => "连接 " + n + " 对话框", sim: "模拟，不会真实连接。",
    bRead: "读取内容", bReadV: "仅交易记录，只读。",
    bPeriod: "时间范围", bDays: (n) => "最近 " + n + " 天", bWhere: "数据留在哪", bWhereV: "仅在你的设备，不共享。",
    bRev: "可随时撤销。", bPw: "我们看不到你的密码。", bAgree: "申请", bCancel: "取消",
    pending: "待处理", pendingAria: (n) => n + "：待处理，点按可撤销", toastP: (n) => "已申请 " + n + "（模拟）。",
    rTitle: (n) => n + " 待处理", rBody: "模拟申请。", rRevoke: "撤销", rKeep: "保留",
    toastR: (n) => n + " 的申请已撤销。"
  }
};
const rt = () => TRUST_I18N[lang] || TRUST_I18N.en;

(function () {
  const CONSENT_KEY = "consent_v1";
  const css = document.createElement("style");
  css.textContent = `
.tr-strip{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 14px;margin-bottom:12px;border-radius:var(--r-pill);background:var(--glass);border:1px solid var(--gborder);color:var(--ink);font:inherit;font-size:14px;cursor:pointer;text-align:left}
.tr-strip svg{width:20px;height:20px;flex:none;stroke:var(--accent-text);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tr-strip u{margin-left:auto;text-decoration:none;font-weight:700;color:var(--accent-text);white-space:nowrap}
.tr-ov{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,16,32,.55)}
.tr-card{width:100%;max-width:480px;max-height:92dvh;overflow:auto;background:var(--bg0,var(--glass2));color:var(--ink);border:1px solid var(--gborder);border-radius:var(--r-panel) var(--r-panel) 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:var(--shadow);display:grid;gap:12px}
.tr-card h2{margin:0;font-size:20px}
.tr-card ul,.tr-list{margin:0;padding-left:20px;display:grid;gap:6px}
.tr-badge{display:inline-flex;align-items:center;justify-self:start;padding:5px 12px;border-radius:var(--r-pill);font-size:13px;font-weight:700;color:var(--warn-text);background:var(--glass2);border:1px dashed var(--warn-text)}
.tr-check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;font-weight:700}
.tr-check input{width:22px;height:22px;flex:none;accent-color:var(--accent)}
.tr-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tr-seg{display:flex;gap:8px;flex-wrap:wrap}
.tr-seg button{min-height:44px;padding:0 16px;border-radius:var(--r-pill);border:1px solid var(--gborder);background:var(--glass);color:var(--ink);font:inherit;font-weight:700;cursor:pointer}
.tr-seg button[aria-checked="true"]{background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent);border-color:transparent}
.tr-lbl{font-weight:700;margin:0 0 2px}
.tr-flow{width:100%;height:auto;max-width:360px;display:block;margin:0 auto}
.tr-flow rect{fill:var(--glass2);stroke:var(--gborder);stroke-width:1.5}
.tr-flow rect.hi{stroke:var(--accent);stroke-width:2}
.tr-flow text{fill:var(--ink);font-size:14px;font-weight:700;text-anchor:middle;dominant-baseline:middle}
.tr-flow path{stroke:var(--accent);stroke-width:2;fill:none}
.tr-flow polygon{fill:var(--accent)}
.tr-acts{display:grid;gap:10px;margin-top:12px}
.tr-sec h2{margin:0 0 8px;font-size:17px}
.btn.tr-pending{opacity:.6;border-style:dashed}
`;
  document.head.appendChild(css);

  if (!ICONS.shield) ICONS.shield = '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>';

  /* ---- generic modal sheet: init(card, close); resolves with the value passed to close(), null on Escape/backdrop ---- */
  function openModal(aria, html, init) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const ov = document.createElement("div");
      ov.className = "tr-ov";
      ov.innerHTML = `<div class="tr-card" role="dialog" aria-modal="true" aria-label="${esc(aria)}" tabindex="-1">${html}</div>`;
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
      try { init(card, close); } catch (e) { console.error("trust modal", e); }
      const f = focusables();
      (f[0] || card).focus();
    });
  }

  /* ---- 1. consent gate ---- */
  const hasConsent = () => !!store.get(CONSENT_KEY, "");
  let pendingConsent = null;
  consentOk = function () {
    if (hasConsent()) return Promise.resolve(true);
    if (pendingConsent) return pendingConsent;
    const x = rt();
    const html = `<h2>${esc(x.cTitle)}</h2>
      <ul><li>${esc(x.cB1)}</li><li>${esc(x.cB2)}</li><li>${esc(x.cB3)}</li><li>${esc(x.cB4)}</li></ul>
      <label class="tr-check"><input type="checkbox" id="tr-cb"><span>${esc(x.cCheck)}</span></label>
      <p class="note" id="tr-need" style="margin:0">${esc(x.cNeed)}</p>
      <div class="tr-actions"><button type="button" class="btn ghost" id="tr-no">${esc(x.cNot)}</button><button type="button" class="btn" id="tr-yes" disabled>${esc(x.cAgree)}</button></div>`;
    pendingConsent = openModal(x.cAria, html, (root, close) => {
      const cb = root.querySelector("#tr-cb"), yes = root.querySelector("#tr-yes"), need = root.querySelector("#tr-need");
      cb.addEventListener("change", () => { yes.disabled = !cb.checked; need.hidden = cb.checked; });
      root.querySelector("#tr-no").addEventListener("click", () => close(false));
      yes.addEventListener("click", async () => {
        if (!cb.checked || yes.disabled) return;
        yes.disabled = true;
        try { await api("/consent", { version: "v1", agree: true }); close(true); }
        catch (e) {
          if (e && e.status === 404) { close(true); return; }   // older backend without /api/consent
          if (e && e.silent) { close(false); return; }
          need.hidden = false; need.textContent = x.cFail; yes.disabled = false;
        }
      });
    }).then((v) => {
      pendingConsent = null;
      if (v === true) { store.set(CONSENT_KEY, new Date().toISOString()); if (parse().name === "privacy") render(); return true; }
      return false;
    });
    return pendingConsent;
  };

  /* ---- 2. privacy route ---- */
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(locale(), { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return iso; } };
  const list = (a) => `<ul class="tr-list">${a.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
  function flowSvg(x) {
    const nodes = [x.fYou, x.fImp, x.fDb, x.fCalc, x.fLlm];
    let s = `<svg class="tr-flow" viewBox="0 0 320 340" role="img" aria-label="${esc(x.flowAria)}">`;
    nodes.forEach((n, i) => {
      const y = 4 + i * 68;
      s += `<rect class="${i === 2 ? "hi" : ""}" x="50" y="${y}" width="220" height="40" rx="20"/><text x="160" y="${y + 21}">${esc(n)}</text>`;
      if (i < nodes.length - 1) s += `<path d="M160 ${y + 42} V${y + 60}"/><polygon points="154,${y + 58} 166,${y + 58} 160,${y + 66}"/>`;
    });
    return s + "</svg>";
  }
  const sec = (h, body) => `<section class="panel tr-sec"><h2>${esc(h)}</h2>${body}</section>`;
  function privacyPage() {
    const x = rt(), c = store.get(CONSENT_KEY, "");
    return `<div class="stack">
      <section class="panel tr-sec"><div class="sec-head"><span class="tile-ico" style="--c:var(--accent)">${ic("shield")}</span><div><h2 style="margin:0">${esc(x.pTitle)}</h2>
        <p class="muted" style="margin:0">${esc(c ? x.given(fmtDate(c)) : x.none)}</p></div></div>
        <div class="tr-acts"><button type="button" class="btn" id="tr-export">${esc(x.exp)}</button>
        <button type="button" class="btn danger" data-a="delall">${esc(x.del)}</button>
        <button type="button" class="btn ghost" id="tr-withdraw"${c ? "" : " disabled"}>${esc(x.wd)}</button></div>
        <p id="pmsg" class="note" style="margin-top:8px" role="status"></p></section>
      ${EXT.routes.audit ? linkCard("audit", "shield", "--accent2", esc(typeof au === "function" ? au().logTitle : "Access log"), esc(typeof au === "function" ? au().logSub : "")) : ""}
      ${sec(x.h1, list(x.l1))}${sec(x.h2, list(x.l2))}${sec(x.h3, list(x.l3))}${sec(x.h4, list(x.l4))}<details class="more"><summary>${esc(t().moreQ)}</summary><div class="stack">${sec(x.h5, list(x.l5))}${sec(x.h6, list(x.l6))}${sec(x.h7, flowSvg(x))}</div></details></div>`;
  }
  EXT.routes.privacy = { title: () => rt().pTitle, page: () => privacyPage(), parent: "#/settings" };
  EXT.settings.push(() => `<div class="stack" style="margin-top:12px">${linkCard("privacy", "shield", "--accent", esc(rt().pLink), esc(rt().pLinkSub))}</div>`);
  EXT.importTop.push(() => `<button type="button" class="tr-strip" data-go="privacy" aria-label="${esc(rt().strip + ". " + rt().learn)}">${ic("shield")}<span>${esc(rt().strip)}</span><u>${esc(rt().learn)}</u></button>`);

  /* ---- 3. export ---- */
  async function doExport(btn, msgEl) {
    const x = rt();
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = x.expBusy;
    try {
      const data = await api("/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "county-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (msgEl) msgEl.textContent = x.expDone;
    } catch (e) {
      if (msgEl) msgEl.textContent = x.expFail;
    }
    btn.disabled = false;
    btn.textContent = old;
  }

  /* ---- 4. bank-connect simulation ---- */
  const bkey = (n) => "bank_" + n;
  function applyBankLabels() {
    document.querySelectorAll('[data-a="waitlist"][data-name]').forEach((b) => {
      const n = b.dataset.name;
      if (b.dataset.orig === undefined) b.dataset.orig = b.textContent;
      if (store.get(bkey(n), "") === "pending") {
        b.textContent = rt().pending;
        b.classList.add("tr-pending");
        b.setAttribute("aria-label", rt().pendingAria(n));
      } else {
        b.textContent = b.dataset.orig;
        b.classList.remove("tr-pending");
        b.removeAttribute("aria-label");
      }
    });
  }
  EXT.bankConsent = async function (name, btn) {
    const x = rt();
    if (store.get(bkey(name), "") === "pending") {
      const html = `<h2>${esc(x.rTitle(name))}</h2><span class="tr-badge">${esc(x.sim)}</span><p style="margin:0">${esc(x.rBody)}</p>
        <div class="tr-actions"><button type="button" class="btn ghost" id="tr-keep">${esc(x.rKeep)}</button><button type="button" class="btn danger" id="tr-rev">${esc(x.rRevoke)}</button></div>`;
      const v = await openModal(x.bAria(name), html, (root, close) => {
        root.querySelector("#tr-keep").addEventListener("click", () => close(false));
        root.querySelector("#tr-rev").addEventListener("click", () => close(true));
      });
      if (v === true) { store.del(bkey(name)); store.del(bkey(name) + "_days"); applyBankLabels(); showToast(esc(x.toastR(name))); }
      return;
    }
    let days = 90;
    const opts = [30, 90, 180].map((n) => `<button type="button" role="radio" data-d="${n}" aria-checked="${n === days}">${esc(x.bDays(n))}</button>`).join("");
    const html = `<h2>${esc(x.bTitle(name))}</h2><span class="tr-badge">${esc(x.sim)}</span>
      <div><p class="tr-lbl">${esc(x.bRead)}</p><p class="muted" style="margin:0">${esc(x.bReadV)}</p></div>
      <div><p class="tr-lbl" id="tr-pl">${esc(x.bPeriod)}</p><div class="tr-seg" role="radiogroup" aria-labelledby="tr-pl">${opts}</div></div>
      <div><p class="tr-lbl">${esc(x.bWhere)}</p><p class="muted" style="margin:0">${esc(x.bWhereV)}</p></div>
      <ul><li>${esc(x.bRev)}</li><li>${esc(x.bPw)}</li></ul>
      <div class="tr-actions"><button type="button" class="btn ghost" id="tr-bc">${esc(x.bCancel)}</button><button type="button" class="btn" id="tr-ba">${esc(x.bAgree)}</button></div>`;
    const ok = await openModal(x.bAria(name), html, (root, close) => {
      root.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => {
        days = Number(b.dataset.d);
        root.querySelectorAll("[data-d]").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
      }));
      root.querySelector("#tr-bc").addEventListener("click", () => close(false));
      root.querySelector("#tr-ba").addEventListener("click", () => close(true));
    });
    if (ok === true) { store.set(bkey(name), "pending"); store.set(bkey(name) + "_days", String(days)); applyBankLabels(); showToast(esc(x.toastP(name))); }
  };

  /* ---- wire events after every render ---- */
  EXT.after.push((r) => {
    applyBankLabels();
    if (r.name !== "privacy") return;
    const x = rt(), ex = document.getElementById("tr-export"), wd = document.getElementById("tr-withdraw"), msg = document.getElementById("pmsg");
    if (ex) ex.onclick = () => doExport(ex, msg);
    if (wd) wd.onclick = async () => {
      if (!confirm(x.wdConfirm)) return;
      try { await api("/consent/withdraw", {}); }
      catch (e) { if (!e || e.status !== 404) { if (msg && !(e && e.silent)) msg.textContent = t().err; return; } }
      store.del(CONSENT_KEY);
      render();
      const m = document.getElementById("pmsg");
      if (m) m.textContent = x.wdDone;
    };
  });
})();
