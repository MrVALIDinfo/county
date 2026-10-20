"use strict";
/* scripted voice demo + demo controls. Hook into app.js only through the EXT registry. */
(function () {
  const DEMO_I18N = {
    en: {
      row: "Demo voice", rowAria: "Demo voice scripts",
      scripts: ["transfer to Li Wei 500", "Luckin 18", "How can I reach my goal faster?"],
      panel: "Demo tools", panelSub: "For recording and demos.",
      reset: "Reset demo data", receipt: "Try sample receipt", clear: "Clear chat", toggle: "中文",
      toggleAria: "Switch language to Chinese",
      resetDone: "Demo data reset.", resetErr: "Reset failed.", clearDone: "Chat cleared.",
      shop: "Hema", items: [["Fresh milk 1L", "12.90"], ["Whole-wheat bread", "9.90"], ["Strawberries", "15.20"], ["Eggs x10", "8.00"]],
      total: "Total", thanks: "Thank you",
    },
    zh: {
      row: "演示语音", rowAria: "演示语音脚本",
      scripts: ["转给 浩然 500", "瑞幸 18", "怎样更快达成目标？"],
      panel: "演示工具", panelSub: "用于录制与演示。",
      reset: "重置演示数据", receipt: "试试示例小票", clear: "清空对话", toggle: "English",
      toggleAria: "切换为英文",
      resetDone: "演示数据已重置。", resetErr: "重置失败。", clearDone: "对话已清空。",
      shop: "盒马鲜生", items: [["鲜牛奶 1L", "12.90"], ["全麦吐司", "9.90"], ["草莓", "15.20"], ["鸡蛋 10枚", "8.00"]],
      total: "合计", thanks: "谢谢惠顾",
    },
  };
  const demoT = () => DEMO_I18N[lang === "zh" ? "zh" : "en"];
  let busy = false;

  /* ---------- styles ---------- */
  const st = document.createElement("style");
  st.textContent = `
  #vd-row{display:flex;align-items:center;gap:8px;overflow-x:auto;scrollbar-width:none}
  #vd-row::-webkit-scrollbar{display:none}
  #vd-row .vd-lab{flex:none;font-size:12px;color:var(--muted)}
  #vd-row button{flex:none;min-height:44px;padding:0 12px;border-radius:999px;cursor:pointer;background:var(--glass2,transparent);border:1px dashed var(--gborder,var(--line));color:var(--ink);font:inherit;font-size:14px}
  #vd-row button:disabled{opacity:.5;cursor:default}
  #mic.vd-pulse{animation:vdpulse 1s ease-in-out infinite}
  @keyframes vdpulse{0%,100%{box-shadow:0 0 0 0 var(--accent,#2dd4a8)}50%{box-shadow:0 0 0 8px transparent}}
  @media (prefers-reduced-motion:reduce){#mic.vd-pulse{animation:none}}
  .vd-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .vd-btns .btn{min-height:44px}`;
  document.head.appendChild(st);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- scripted voice ---------- */
  async function playScript(text) {
    if (busy) return;
    const input = $("#chatin"), mic = $("#mic");
    if (!input || !mic) return;
    busy = true;
    const row = $("#vd-row");
    if (row) row.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    try {
      if (typeof listening !== "undefined" && listening && rec) { try { rec.stop(); } catch (e) { /* ignore */ } }
      mic.classList.add("live", "vd-pulse");
      input.value = "";
      await sleep(350);
      for (let i = 1; i <= text.length; i++) {
        input.value = text.slice(0, i);
        await sleep(45);
      }
      await sleep(300);
      mic.classList.remove("live", "vd-pulse");
      input.value = "";
      await sendChat(text);
    } finally {
      mic.classList.remove("live", "vd-pulse");
      busy = false;
      const r2 = $("#vd-row");
      if (r2) r2.querySelectorAll("button").forEach((b) => { b.disabled = false; });
    }
  }

  function injectRow() {
    const foot = document.querySelector("#chat .sheet-foot");
    if (!foot) return;
    const d = demoT();
    let row = $("#vd-row");
    if (!row) {
      row = document.createElement("div");
      row.id = "vd-row";
      const form = $("#chatform");
      foot.insertBefore(row, form || null);
    }
    row.setAttribute("aria-label", d.rowAria);
    row.innerHTML = `<span class="vd-lab">${esc(d.row)}</span>` +
      d.scripts.map((s, i) => `<button type="button" data-vd="say" data-i="${i}" aria-label="${esc(d.row)}: ${esc(s)}">${ic("mic")} ${esc(s)}</button>`).join("");
    row.querySelectorAll("svg").forEach((s) => { s.style.cssText = "width:16px;height:16px;vertical-align:-3px"; });
  }
  EXT.chatOpen.push(injectRow);

  /* ---------- receipt ---------- */
  function drawReceipt() {
    const d = demoT(), W = 600, H = 820;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const F = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",Arial,sans-serif';
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#111111"; g.textBaseline = "alphabetic";
    g.font = "bold 44px " + F; g.textAlign = "center"; g.fillText(d.shop, W / 2, 90);
    g.font = "22px " + F; g.fillStyle = "#555555";
    g.fillText("Shenzhen Nanshan  |  No. 20481", W / 2, 130);
    const dt0 = new Date(), pad = (n) => String(n).padStart(2, "0");
    g.fillText(`${dt0.getFullYear()}-${pad(dt0.getMonth() + 1)}-${pad(dt0.getDate())}  ${pad(dt0.getHours())}:${pad(dt0.getMinutes())}`, W / 2, 162);
    const rule = (y) => { g.strokeStyle = "#999999"; g.setLineDash([8, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(40, y); g.lineTo(W - 40, y); g.stroke(); g.setLineDash([]); };
    rule(195);
    g.fillStyle = "#111111"; g.font = "28px " + F;
    let y = 250;
    d.items.forEach(([n, p]) => {
      g.textAlign = "left"; g.fillText(n, 40, y);
      g.textAlign = "right"; g.fillText("¥" + p, W - 40, y);
      y += 60;
    });
    rule(y - 20);
    y += 30;
    g.font = "bold 40px " + F;
    g.textAlign = "left"; g.fillText(d.total, 40, y);
    g.textAlign = "right"; g.fillText("¥46.00", W - 40, y);
    y += 70;
    g.font = "22px " + F; g.fillStyle = "#555555"; g.textAlign = "center";
    g.fillText("WeChat Pay  ¥46.00", W / 2, y);
    y += 50;
    g.fillText(d.thanks, W / 2, y);
    return cv;
  }
  async function sampleReceipt() {
    const cv = drawReceipt();
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.9));
    if (!blob) throw new Error("canvas");
    const file = new File([blob], "receipt-demo.jpg", { type: "image/jpeg" });
    if (parse().name !== "import") {
      location.hash = "#/import";
      await sleep(350);
    }
    await handlePhoto(file);
  }

  /* ---------- settings panel ---------- */
  EXT.settings.push(() => {
    const d = demoT();
    return `<section class="panel" id="vd-panel" aria-label="${esc(d.panel)}"><h2>${esc(d.panel)}<span class="beta">Demo</span></h2><p class="muted">${esc(d.panelSub)}</p>
      <div class="vd-btns">
        <button type="button" class="btn ghost" data-vd="reset">${esc(d.reset)}</button>
        <button type="button" class="btn ghost" data-vd="receipt">${esc(d.receipt)}</button>
        <button type="button" class="btn ghost" data-vd="clear">${esc(d.clear)}</button>
        <button type="button" class="btn ghost" data-vd="lang" aria-label="${esc(d.toggleAria)}">${esc(d.toggle)}</button>
      </div></section>`;
  });

  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("[data-vd]");
    if (!b) return;
    const d = demoT(), a = b.dataset.vd;
    if (a === "say") { playScript(d.scripts[+b.dataset.i] || ""); return; }
    if (a === "lang") { lang = lang === "zh" ? "en" : "zh"; store.set("lang", lang); render(); return; }
    if (a === "clear") { chatLog.length = 0; chatPaint(); showToast(`<b>${esc(d.clearDone)}</b>`); return; }
    if (a === "reset") {
      b.disabled = true;
      try {
        await api("/demo", {});
        try { await api("/lessons/reset", {}); } catch (e) { /* optional */ }
        chatLog.length = 0; chatPaint();
        await refresh(); render();
        showToast(`<b>${esc(d.resetDone)}</b>`);
      } catch (err) { showToast(`<b>${esc(d.resetErr)}</b>`); }
      b.disabled = false;
      return;
    }
    if (a === "receipt") {
      b.disabled = true;
      try { await sampleReceipt(); } catch (err) { console.error("demo receipt", err); showToast(`<b>${esc(t().scanErr)}</b>`); }
      b.disabled = false;
    }
  });
})();
