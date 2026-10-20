"use strict";
/* Invest v2 (tabs: Learn / News / Research). Registers EXT.routes.invest.
   Backend: GET /api/lessons, POST /api/lessons/update|reset, GET /api/news?cat=, POST /api/news/refresh, GET /api/research.
   Falls back to the static INVEST content (pageInvest) when /api/lessons is unreachable. */

const INV2_I18N = {
  en: {
    tabsLbl: "Invest sections", tPath: "Path", tLearn: "Library", tNews: "News", tResearch: "Research", edu: "Educational only",
    packV: (v, d) => `Pack v${v}${d ? " · " + d : ""}`, pack: "Content pack", check: "Check updates", checking: "Checking…",
    updAvail: "Update available", upToDate: "Up to date.", simNote: "Simulated update.", updFail: "Update check failed.",
    added: "Added", updated: "Updated", changelog: (v) => `What's new in v${v}`, reset: "Reset demo pack",
    tod: "Term of the day", offline: "Offline. Built-in lessons shown.", newTag: "NEW", updTag: "UPDATED",
    beginner: "Beginner", intermediate: "Deeper", further: "Further reading", linksNote: "Opens the publisher's site.",
    err: "Could not load. Check your connection.", retry: "Retry",
    cats: { all: "All", markets: "Markets", economy: "Economy", china: "China", personal: "Personal" }, catsLbl: "News categories",
    liveFrom: (n) => `Live from ${n}`, updatedAgo: (r) => `updated ${r}`, sampleNote: "Sample feed. Live sources unreachable.",
    refresh: "Refresh news", refreshing: "Refreshing…", sample: "Sample", read: "Read", readLbl: (s) => `Read: ${s} (opens the publisher's site)`,
    why: "Why it matters", noNews: "No headlines in this category right now.", newsDisc: "Third-party headlines. Not investment advice.",
    hl: "Headline language", unknownSrc: "Source",
    whyMap: {
      rates: "Rates change what savings and loans cost.",
      inflation: "Rising prices shrink what your money buys.",
      stocks: "Market moves can affect investments and savings plans.",
      yuan: "Currency moves change travel and import costs.",
      savings: "Savings product changes affect your interest.",
      oil: "Oil prices feed into fuel and everyday costs.",
      general: "Background on how the economy works."
    },
    types: { guide: "Guide", report: "Report", data: "Data", course: "Course" }, global: "Global", china: "China", open: "Opens the publisher's site",
    emptyRes: "No reading items yet.", level: "Level", min: (n) => `${n} min`, locale: "Offline"
  },
  zh: {
    tabsLbl: "投资板块", tPath: "路径", tLearn: "资料库", tNews: "资讯", tResearch: "阅读", edu: "仅供学习",
    packV: (v, d) => `内容包 v${v}${d ? " · " + d : ""}`, pack: "内容包", check: "检查更新", checking: "检查中…",
    updAvail: "有可用更新", upToDate: "已是最新。", simNote: "模拟更新。", updFail: "检查更新失败。",
    added: "新增", updated: "更新", changelog: (v) => `v${v} 更新内容`, reset: "重置演示内容包",
    tod: "今日术语", offline: "离线，显示内置课程。", newTag: "新", updTag: "已更新",
    beginner: "入门", intermediate: "进阶", further: "延伸阅读", linksNote: "将打开发布方网站。",
    err: "加载失败，请检查网络。", retry: "重试",
    cats: { all: "全部", markets: "市场", economy: "经济", china: "中国", personal: "个人理财" }, catsLbl: "资讯分类",
    liveFrom: (n) => `实时来源：${n}`, updatedAgo: (r) => `${r}更新`, sampleNote: "示例资讯，暂无法连接实时来源。",
    refresh: "刷新资讯", refreshing: "刷新中…", sample: "示例", read: "阅读", readLbl: (s) => `阅读：${s}（打开发布方网站）`,
    why: "为何重要", noNews: "该分类暂无资讯。", newsDisc: "第三方资讯，不构成投资建议。",
    hl: "标题语言", unknownSrc: "来源",
    whyMap: {
      rates: "利率变化影响存贷成本。",
      inflation: "物价上涨，钱会变得不经花。",
      stocks: "股市波动影响投资和储蓄计划。",
      yuan: "汇率变化影响出行和进口成本。",
      savings: "储蓄产品变化影响利息。",
      oil: "油价影响燃油和日常开销。",
      general: "经济运行的背景知识。"
    },
    types: { guide: "指南", report: "报告", data: "数据", course: "课程" }, global: "全球", china: "中国", open: "打开发布方网站",
    emptyRes: "暂无阅读内容。", level: "难度", min: (n) => `${n} 分钟`, locale: "离线"
  }
};
const iv = () => INV2_I18N[lang] || INV2_I18N.en;

/* ---- icons ---- */
if (typeof ICONS === "object") {
  ICONS.ext = ICONS.ext || '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>';
  ICONS.refresh = ICONS.refresh || '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M16 16h5v5"/>';
  ICONS.globe = ICONS.globe || '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>';
  ICONS.pin = ICONS.pin || '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>';
  ICONS.book = ICONS.book || '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V22h16"/>';
}
const ivIc = (n) => (typeof ICONS === "object" && ICONS[n] ? ic(n) : "");

/* ---- styles ---- */
(function () {
  try {
    const st = document.createElement("style");
    st.textContent = `
#iv-seg button{min-height:44px}
#iv-body{display:grid;gap:14px}
.iv-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
.iv-chips::-webkit-scrollbar{display:none}
.iv-chips button{flex:none;min-height:44px;padding:0 16px;border-radius:var(--r-pill);border:1px solid var(--gborder);background:var(--glass);color:var(--ink);font-weight:600;cursor:pointer;scroll-snap-align:start}
.iv-chips button[aria-pressed=true]{background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent);border-color:transparent}
.iv-svg svg,.iv-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.iv-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.iv-meta .chip,.iv-meta .pill{font-size:12px;padding:2px 10px}
.iv-meta svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.iv-new{background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent);border-color:transparent}
.iv-card h3{font-size:16px;line-height:1.35;margin:6px 0 8px}
.iv-src{font-size:12px;font-weight:700;padding:3px 10px;border-radius:var(--r-pill);background:var(--glass2);border:1px solid var(--gborder);color:var(--accent-text)}
.iv-why{font-size:13px;color:var(--muted);margin:0 0 10px}
.iv-why b{color:var(--ink)}
.iv-skel{height:76px;border-radius:var(--r-panel);background:linear-gradient(90deg,var(--glass) 25%,var(--glass2) 50%,var(--glass) 75%);background-size:200% 100%;animation:iv-sh 1.2s linear infinite;border:1px solid var(--gborder)}
@keyframes iv-sh{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.iv-skel{animation:none}}
.iv-dot{width:8px;height:8px;border-radius:50%;background:var(--accent2);display:inline-block}
.iv-risk summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700;list-style:none}
.iv-risk summary::-webkit-details-marker{display:none}
.iv-risk[open] summary{margin-bottom:6px}
.iv-cl{border-left:4px solid var(--accent)}
.iv-cl p{margin:4px 0;font-size:14px}
.iv-term b{font-size:18px;display:block;margin:2px 0 4px}
.iv-a{text-decoration:none;color:inherit}
.iv-err{text-align:center}
`;
    document.head.appendChild(st);
  } catch (e) { console.error(e); }
})();

/* ---- state ---- */
const IV_TABS = ["path", "learn", "news", "research"], IV_CATS = ["all", "markets", "economy", "china", "personal"], IV_TTL = 5 * 60 * 1000, IV_RETRY = 30 * 1000;
const ivSS = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
};
let IV_TAB = ivSS.get("iv2.tab", "path");
if (!IV_TABS.includes(IV_TAB)) IV_TAB = "path";
let IV_CAT = ivSS.get("iv2.cat", "all");
if (!IV_CATS.includes(IV_CAT)) IV_CAT = "all";
const IVLS = { data: null, err: 0, busy: null };           // lessons
const IVNC = {}, IVNCERR = {}, IVNBUSY = {};                    // news cache by category: {at,data}
const IVRS = { data: null, err: 0, busy: null };           // research
let IV_UPD = null;          // last update result: {updated:false} | {updated:true, cl} | {error:true}
let IV_UPD_BUSY = false, IV_NEWS_REFRESH = false;

const ivFailed = (ts) => !!ts && Date.now() - ts < IV_RETRY;
const ivSafeUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u) : "");
const ivOnHome = () => { const r = parse(); return r.name === "invest" && !r.a; };
const ivOnTopic = () => { const r = parse(); return r.name === "invest" && !!r.a; };

/* ---- loaders ---- */
function ivLoadLessons(force) {
  if (IVLS.busy) return IVLS.busy;
  if (IVLS.data && !force) return Promise.resolve(IVLS.data);
  IVLS.busy = api("/lessons").then((d) => {
    if (!d || !Array.isArray(d.topics)) throw new Error("bad lessons");
    IVLS.data = d; IVLS.err = 0; return d;
  }).catch((e) => { console.error(e); IVLS.err = Date.now(); return null; }).then((v) => { IVLS.busy = null; return v; });
  return IVLS.busy;
}
function ivLoadNews(cat, force) {
  if (IVNBUSY[cat]) return IVNBUSY[cat];
  const e = IVNC[cat];
  if (e && !force && Date.now() - e.at < IV_TTL) return Promise.resolve(e.data);
  IVNBUSY[cat] = api("/news?cat=" + encodeURIComponent(cat)).then((d) => {
    if (!d || !Array.isArray(d.items)) throw new Error("bad news");
    IVNC[cat] = { at: Date.now(), data: d }; delete IVNCERR[cat]; return d;
  }).catch((er) => { console.error(er); if (!IVNC[cat]) IVNCERR[cat] = Date.now(); return null; }).then((v) => { delete IVNBUSY[cat]; return v; });
  return IVNBUSY[cat];
}
function ivLoadResearch() {
  if (IVRS.busy) return IVRS.busy;
  if (IVRS.data) return Promise.resolve(IVRS.data);
  IVRS.busy = api("/research").then((d) => {
    if (!d || !Array.isArray(d.items)) throw new Error("bad research");
    IVRS.data = d; IVRS.err = 0; return d;
  }).catch((e) => { console.error(e); IVRS.err = Date.now(); return null; }).then((v) => { IVRS.busy = null; return v; });
  return IVRS.busy;
}

/* ---- small helpers ---- */
function ivRel(iso) {
  try {
    if (!iso) return "";
    const t0 = Date.parse(iso);
    if (isNaN(t0)) return "";
    const s = Math.round((t0 - Date.now()) / 1000), f = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" }), a = Math.abs(s);
    if (a < 45) return f.format(0, "second");
    if (a < 3600) return f.format(Math.round(s / 60), "minute");
    if (a < 86400) return f.format(Math.round(s / 3600), "hour");
    if (a < 86400 * 30) return f.format(Math.round(s / 86400), "day");
    return f.format(Math.round(s / (86400 * 30)), "month");
  } catch (e) { return ""; }
}
function ivDate(iso) {
  try {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(locale(), { year: "numeric", month: "short", day: "numeric" });
  } catch (e) { return ""; }
}
const ivSkel = (n) => Array.from({ length: n || 3 }, () => '<div class="iv-skel" aria-hidden="true"></div>').join("") + `<p class="muted" role="status" style="text-align:center">${esc(t().loading || "")}</p>`;
const ivErr = (act) => `<section class="panel iv-err stack" role="alert"><p>${esc(iv().err)}</p><div><button type="button" class="btn" data-iv="${act}">${esc(iv().retry)}</button></div></section>`;
const ivTagChip = (tag) => (tag === "new" ? `<span class="pill iv-new">${esc(iv().newTag)}</span>` : tag === "updated" ? `<span class="pill iv-new">${esc(iv().updTag)}</span>` : "");
const ivLevel = (lv) => (lv === "beginner" ? iv().beginner : iv().intermediate);
const ivTone = (i) => (i % 2 ? "--accent2" : "--accent");
const ivTx = (tp) => (tp && (tp[lang] || tp.en)) || null;

/* ---- Learn tab ---- */
function ivTile(tp, i) {
  const c = ivTx(tp);
  if (!c) return "";
  const I = iv();
  return `<button type="button" class="topic" data-go="invest/${esc(tp.id)}" aria-label="${esc(c.t)}">
    <span class="tile-ico iv-svg" style="--c:${col(ivTone(i))}">${ivIc(ICONS[tp.icon] ? tp.icon : "info")}</span>
    <span class="grow"><b>${esc(c.t)}</b><br><span class="sub">${esc(c.s)}</span>
      <span class="iv-meta"><span class="chip plain">${esc(ivLevel(tp.level))}</span><span class="tag">${esc(I.min(tp.minutes))}</span>${ivTagChip(tp.tag)}</span></span></button>`;
}
function ivRiskMap() {
  const tx = t(), lv = (n) => ["--accent", "--accent", "--warn", "--warn", "--bad"][n - 1];
  return `<details class="panel iv-risk"><summary>${esc(tx.riskMap)}</summary><p class="muted" style="margin-bottom:6px">${tx.riskMapSub}</p>${INVEST.assets.map((a) => `<div class="risk"><div><b>${tx.assets[a.id][0]}</b><div class="tag">${tx.assets[a.id][1]}</div></div>
    <div><div class="meter5">${[1, 2, 3, 4, 5].map((i) => `<i style="${i <= a.level ? "background:" + col(lv(a.level)) : ""}"></i>`).join("")}</div><div class="tag" style="text-align:right">${tx.lvl[a.level - 1]}</div></div></div>`).join("")}</details>`;
}
function ivChangelog(cl, L) {
  if (!cl) return "";
  const I = iv(), names = {};
  ((L && L.topics) || []).forEach((tp) => { const c = ivTx(tp); if (c) names[tp.id] = c.t; });
  const list = (ids) => (Array.isArray(ids) ? ids : []).map((id) => esc(names[id] || id)).join(", ");
  const note = lang === "zh" ? cl.note_zh || cl.note_en : cl.note_en || cl.note_zh;
  return `<section class="panel iv-cl" role="status"><h2>${esc(I.changelog(cl.v))}</h2>
    ${cl.added && cl.added.length ? `<p><b>${esc(I.added)}:</b> ${list(cl.added)}</p>` : ""}
    ${cl.updated && cl.updated.length ? `<p><b>${esc(I.updated)}:</b> ${list(cl.updated)}</p>` : ""}
    ${note ? `<p class="muted">${esc(note)}</p>` : ""}</section>`;
}
function ivPackCard() {
  const L = IVLS.data, I = iv();
  let res = "";
  if (IV_UPD) {
    if (IV_UPD.error) res = `<p class="note" role="alert">${esc(I.updFail)}</p>`;
    else if (IV_UPD.updated) res = "";
    else res = `<p class="note" role="status"><b>${esc(I.upToDate)}</b></p>`;
  }
  return `<section class="panel stack"><div class="row"><div><h2 style="margin:0">${esc(I.pack)}</h2><span class="muted">${esc(I.packV(L.version, ivDate(L.updated_at)))}</span></div>
    ${L.has_update ? `<span class="chip plain"><span class="iv-dot" aria-hidden="true"></span>${esc(I.updAvail)}</span>` : ""}</div>
    <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button type="button" class="btn iv-btn" data-iv="update"${IV_UPD_BUSY ? " disabled" : ""}>${ivIc("refresh")}${esc(IV_UPD_BUSY ? I.checking : I.check)}</button>
    <button type="button" class="btn ghost sm" data-iv="reset"${IV_UPD_BUSY ? " disabled" : ""}>${esc(I.reset)}</button></div>
    ${res}<p class="note">${esc(I.simNote)}</p></section>${IV_UPD && IV_UPD.updated ? ivChangelog(IV_UPD.cl, L) : ""}`;
}
function ivTermCard() {
  const L = IVLS.data, td = L && L.term_of_day, c = td && (td[lang] || td.en);
  if (!c || !c.term) return "";
  return `<section class="panel iv-term"><span class="muted">${esc(iv().tod)}</span><b>${esc(c.term)}</b><p>${esc(c.def)}</p></section>`;
}
function ivOfflineLearn() {
  const tx = t(), C = INVEST[lang];
  return `<p class="note" role="status">${esc(iv().offline)} <button type="button" class="btn ghost sm" data-iv="reload-lessons">${esc(iv().retry)}</button></p>
  <div class="sec-title">${tx.topics}</div>
  ${INVEST.topics.map((m) => `<button type="button" class="topic" data-go="invest/${m.id}"><span class="tile-ico" style="--c:${col(m.color)}">${ic(m.icon)}</span><span class="grow"><b>${C[m.id].t}</b><br><span class="sub">${C[m.id].s}</span></span><span class="tag">${tx.minRead(m.min)}</span></button>`).join("")}
  ${ivRiskMap()}`;
}
function ivLearnBody() {
  const tx = t();
  if (!IVLS.data) return ivFailed(IVLS.err) ? ivOfflineLearn() : ivSkel(3);
  return ivPackCard() + ivTermCard() + `<div class="sec-title">${tx.topics}</div>` + IVLS.data.topics.map(ivTile).join("") + ivRiskMap();
}

/* ---- News tab ---- */
function ivNewsCard(it) {
  const I = iv(), url = it.sample ? "" : ivSafeUrl(it.url), cjk = /[㐀-鿿]/.test(String(it.title || ""));
  const why = I.whyMap[it.why] || I.whyMap.general, when = ivRel(it.published);
  return `<article class="panel iv-card"><div class="row"><span class="iv-src">${esc(it.source || I.unknownSrc)}</span>${when ? `<span class="tag">${esc(when)}</span>` : ""}</div>
    <h3>${esc(it.title)}</h3><p class="iv-why"><b>${esc(I.why)}:</b> ${esc(why)}</p>
    <div class="row"><span class="iv-meta" style="margin:0"><span class="chip plain" aria-label="${esc(I.hl)}">${cjk ? "中文" : "EN"}</span>${it.sample ? `<span class="pill">${esc(I.sample)}</span>` : ""}</span>
    ${url ? `<a class="btn ghost sm iv-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(I.readLbl(it.source || it.title))}">${esc(I.read)}${ivIc("ext")}</a>` : ""}</div></article>`;
}
function ivNewsBody() {
  const I = iv(), c = IV_CAT, e = IVNC[c];
  const chips = `<div class="iv-chips" role="group" aria-label="${esc(I.catsLbl)}">${IV_CATS.map((k) => `<button type="button" data-iv="cat" data-v="${k}" aria-pressed="${k === c}">${esc(I.cats[k])}</button>`).join("")}</div>`;
  if (!e) return chips + (ivFailed(IVNCERR[c]) ? ivErr("reload-news") : ivSkel(3));
  const d = e.data, items = Array.isArray(d.items) ? d.items : [], live = !!d.live;
  let status;
  if (live) {
    const ok = (Array.isArray(d.sources) ? d.sources : []).filter((s) => s && s.ok).map((s) => s.name), names = ok.slice(0, 3).join(", ") + (ok.length > 3 ? "…" : "");
    const rel = ivRel(d.fetched_at);
    status = esc(I.liveFrom(names || I.unknownSrc)) + (rel ? " · " + esc(I.updatedAgo(rel)) : "");
  } else status = esc(I.sampleNote);
  return chips + `<div class="row"><p class="${live ? "muted" : "note"}" role="status" style="${live ? "" : "color:var(--warn-text)"}">${status}</p>
    <button type="button" class="btn ghost sm iv-btn" data-iv="news-refresh" aria-label="${esc(I.refresh)}"${IV_NEWS_REFRESH ? " disabled" : ""}>${ivIc("refresh")}${esc(IV_NEWS_REFRESH ? I.refreshing : I.refresh)}</button></div>
    ${items.length ? items.map(ivNewsCard).join("") : `<section class="panel empty"><p>${esc(I.noNews)}</p></section>`}
    <p class="disclaimer">${esc(I.newsDisc)}</p>`;
}

/* ---- Research tab ---- */
function ivResCard(it) {
  const I = iv(), url = ivSafeUrl(it.url), title = lang === "zh" ? it.title_zh || it.title_en : it.title_en || it.title_zh, desc = lang === "zh" ? it.desc_zh || it.desc_en : it.desc_en || it.desc_zh;
  const china = it.region === "china";
  return `<article class="panel iv-card"><div class="row"><span class="iv-src">${esc(it.publisher || I.unknownSrc)}</span>${it.new ? `<span class="pill iv-new">${esc(I.newTag)}</span>` : ""}</div>
    <h3>${esc(title)}</h3><p class="iv-why clamp2">${esc(desc)}</p>
    <div class="row"><span class="iv-meta" style="margin:0"><span class="chip plain">${esc(I.types[it.type] || it.type || "")}</span><span class="chip plain">${ivIc(china ? "pin" : "globe")}${esc(china ? I.china : I.global)}</span></span>
    ${url ? `<a class="btn ghost sm iv-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(title + " — " + I.open)}">${esc(I.read)}${ivIc("ext")}</a>` : ""}</div></article>`;
}
function ivResearchBody() {
  const I = iv();
  if (!IVRS.data) return ivFailed(IVRS.err) ? ivErr("reload-research") : ivSkel(3);
  const items = IVRS.data.items, groups = [["beginner", I.beginner, items.filter((x) => x.level === "beginner")], ["deeper", I.intermediate, items.filter((x) => x.level !== "beginner")]];
  const out = groups.filter((g) => g[2].length).map((g) => `<div class="sec-title">${esc(g[1])}</div>${g[2].map(ivResCard).join("")}`).join("");
  return (out || `<section class="panel empty"><p>${esc(I.emptyRes)}</p></section>`) + `<p class="note" style="text-align:center">${esc(I.linksNote)}</p><p class="disclaimer">${esc(t().notAdvice)}</p>`;
}

/* ---- home page shell / painting ---- */
function ivBody() {
  try {
    if (IV_TAB === "path" && typeof lnPathBody === "function") return lnPathBody();
    if (IV_TAB === "news") return ivNewsBody();
    if (IV_TAB === "research") return ivResearchBody();
    return ivLearnBody() + `<p class="disclaimer">${esc(t().notAdvice)}</p>`;
  } catch (e) { console.error(e); return ivErr("reload-" + (IV_TAB === "learn" ? "lessons" : IV_TAB)); }
}
function ivPaint() {
  if (!ivOnHome()) return;
  const el = $("#iv-body");
  if (!el) return;
  const ch = el.querySelector(".iv-chips"), x = ch ? ch.scrollLeft : 0;
  el.innerHTML = ivBody();
  const ch2 = el.querySelector(".iv-chips");
  if (ch2 && x) ch2.scrollLeft = x;
}
function ivSegHtml() {
  const I = iv(), items = [["path", I.tPath], ["learn", I.tLearn], ["news", I.tNews], ["research", I.tResearch]], idx = Math.max(0, items.findIndex((x) => x[0] === IV_TAB));
  return `<div class="seg ios" id="iv-seg" role="group" aria-label="${esc(I.tabsLbl)}" style="--n:4;--i:${idx}"><i class="thumb"></i>${items.map(([v, l]) => `<button type="button" data-iv="tab" data-v="${v}" aria-pressed="${IV_TAB === v}">${esc(l)}</button>`).join("")}</div>`;
}
function ivHome(Sx) {
  const tx = t(), I = iv(), free = Sx && Sx.free_cents > 0;
  return `<section class="panel"><h2>${esc(tx.invest)}<span class="beta">Beta</span></h2><p style="margin-top:8px"><b>${free ? tx.free(yuan(Sx.free_cents)) : tx.noFree}</b></p><div class="iv-meta"><span class="chip plain">${esc(I.edu)}</span></div><details class="more"><summary>${esc(tx.whyQ)}</summary><p>${tx.investIntro}</p></details></section>
    ${ivSegHtml()}<div id="iv-body">${ivBody()}</div>`;
}
function ivEnsure() {
  if (!ivOnHome()) return;
  const done = () => ivPaint();
  if (IV_TAB === "path") { if (typeof lnEnsure === "function") lnEnsure(); }
  else if (IV_TAB === "learn") { if (!IVLS.data && !ivFailed(IVLS.err)) ivLoadLessons().then(done); }
  else if (IV_TAB === "news") {
    const e = IVNC[IV_CAT];
    if ((!e && !ivFailed(IVNCERR[IV_CAT])) || (e && Date.now() - e.at >= IV_TTL)) ivLoadNews(IV_CAT).then(done);
  } else if (IV_TAB === "research") { if (!IVRS.data && !ivFailed(IVRS.err)) ivLoadResearch().then(done); }
}

/* ---- topic detail ---- */
function ivFurther(tp) {
  const src = (Array.isArray(tp.sources) ? tp.sources : []).filter((s) => ivSafeUrl(s && s.url));
  if (!src.length) return "";
  const I = iv();
  return `<section class="panel"><h2>${esc(I.further)}</h2>${src.map((s) => {
    const ttl = lang === "zh" ? s.title_zh || s.title_en : s.title_en || s.title_zh;
    return `<a class="row-link iv-a iv-svg" href="${esc(ivSafeUrl(s.url))}" target="_blank" rel="noopener noreferrer" aria-label="${esc((s.publisher || "") + ": " + ttl + " — " + I.open)}"><span class="grow"><b>${esc(s.publisher || "")}</b><span class="muted">${esc(ttl)}</span></span>${ivIc("ext")}</a>`;
  }).join("")}<p class="note" style="margin-top:8px">${esc(I.linksNote)}</p></section>`;
}
function ivTopic(Sx, id) {
  const tx = t(), L = IVLS.data;
  if (!L) return ivFailed(IVLS.err) ? pageInvest(Sx, id) : `<div id="iv-body">${ivSkel(3)}</div>`;
  const idx = L.topics.findIndex((x) => x.id === id), tp = L.topics[idx], c = ivTx(tp);
  if (!tp || !c) return pageInvest(Sx, id);
  const nxt = L.topics[(idx + 1) % L.topics.length], prv = L.topics[(idx + L.topics.length - 1) % L.topics.length], nc = ivTx(nxt), pc = ivTx(prv);
  const tone = col(ivTone(idx));
  let extra = "";
  if (id === "cushion" && Sx) {
    const base = (Sx.fixed_total_cents || 0) + (Sx.avg_flex_cents || 0) * 30;
    extra = `<section class="panel"><h2>${tx.yourNumbers}</h2><p>${tx.cushionNums(yuan(base * 3), yuan(base * 6))}</p></section>`;
  }
  if (id === "compound") {
    extra = `<section class="panel stack"><label>${tx.calcMonthly}<input id="cm" type="number" min="0" value="500" inputmode="numeric"></label>
      <label>${tx.calcYears}: <b id="cyv">10</b><input id="cy" type="range" min="1" max="30" value="10"></label><div id="cres" class="stack"></div><p class="note">${tx.calcNote}</p></section>`;
  }
  const paras = Array.isArray(c.p) ? c.p : [];
  return `<section class="panel lesson"><div class="row" style="justify-content:flex-start;margin-bottom:12px"><span class="tile-ico iv-svg" style="--c:${tone}">${ivIc(ICONS[tp.icon] ? tp.icon : "info")}</span>
    <div><h2 style="margin:0;font-size:20px">${esc(c.t)}</h2><span class="iv-meta"><span class="chip plain">${esc(ivLevel(tp.level))}</span><span class="tag">${esc(iv().min(tp.minutes))}</span>${ivTagChip(tp.tag)}</span></div></div>
    ${paras.map((p) => `<p>${esc(p)}</p>`).join("")}<div class="key" style="border-left-color:${tone}"><span class="muted">${tx.takeaway}</span><br>${esc(c.k)}</div></section>${extra}${ivFurther(tp)}
    <div class="grid2"><button type="button" class="link nav2" data-rep="invest/${esc(prv.id)}"><span class="muted">← ${tx.prev}</span><b>${esc(pc ? pc.t : prv.id)}</b></button><button type="button" class="link nav2" data-rep="invest/${esc(nxt.id)}"><span class="muted">${tx.next} →</span><b>${esc(nc ? nc.t : nxt.id)}</b></button></div>
    <p class="disclaimer">${tx.notAdvice}</p>`;
}

/* ---- actions ---- */
async function ivAct(a, v) {
  const I = iv();
  if (a === "tab") {
    if (!IV_TABS.includes(v) || v === IV_TAB) return;
    IV_TAB = v; ivSS.set("iv2.tab", v);
    const seg = $("#iv-seg");
    if (seg) { seg.style.setProperty("--i", IV_TABS.indexOf(v)); seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v)); }
    ivPaint(); ivEnsure();
  } else if (a === "cat") {
    if (!IV_CATS.includes(v)) return;
    IV_CAT = v; ivSS.set("iv2.cat", v); ivPaint(); ivEnsure();
  } else if (a === "reload-lessons") { IVLS.err = 0; ivPaint(); ivEnsure(); }
  else if (a === "reload-news") { delete IVNCERR[IV_CAT]; ivPaint(); ivEnsure(); }
  else if (a === "reload-research") { IVRS.err = 0; ivPaint(); ivEnsure(); }
  else if (a === "news-refresh") {
    if (IV_NEWS_REFRESH) return;
    IV_NEWS_REFRESH = true; ivPaint();
    try {
      await api("/news/refresh", {});
      Object.keys(IVNC).forEach((k) => delete IVNC[k]);
      await ivLoadNews(IV_CAT, true);
    } catch (e) { console.error(e); }
    IV_NEWS_REFRESH = false; ivPaint();
    if (!IVNC[IV_CAT]) ivEnsure();
  } else if (a === "update") {
    if (IV_UPD_BUSY) return;
    IV_UPD_BUSY = true; IV_UPD = null; ivPaint();
    try {
      const r = await api("/lessons/update", {});
      if (r && r.updated) { await ivLoadLessons(true); IV_UPD = { updated: true, cl: r.changelog || null }; }
      else { await ivLoadLessons(true); IV_UPD = { updated: false }; }
    } catch (e) { console.error(e); IV_UPD = { error: true }; }
    IV_UPD_BUSY = false; ivPaint();
  } else if (a === "reset") {
    if (IV_UPD_BUSY) return;
    IV_UPD_BUSY = true; ivPaint();
    try { await api("/lessons/reset", {}); await ivLoadLessons(true); IV_UPD = null; } catch (e) { console.error(e); IV_UPD = { error: true }; }
    IV_UPD_BUSY = false; ivPaint();
  }
  void I;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-iv]");
  if (!b) return;
  ivAct(b.dataset.iv, b.dataset.v).catch((er) => console.error(er));
});

/* ---- route registration ---- */
EXT.routes.invest = {
  title: () => t().invest,
  page: (Sx, r) => {
    try { return r && r.a ? (r.a === "playbook" && typeof lnPlaybookPage === "function" ? lnPlaybookPage(Sx, r) : ivTopic(Sx, r.a)) : ivHome(Sx); }
    catch (e) { console.error(e); try { return pageInvest(Sx, r && r.a); } catch (e2) { return ""; } }
  }
};
EXT.after.push((r) => {
  try {
    if (!r || r.name !== "invest") return;
    if (r.a) {
      if (r.a === "playbook") return;
      if (!IVLS.data && !ivFailed(IVLS.err)) ivLoadLessons().then(() => { if (ivOnTopic()) render(); });
      if (r.a === "compound" && typeof wireCompound === "function") wireCompound();
    } else ivEnsure();
  } catch (e) { console.error(e); }
});
