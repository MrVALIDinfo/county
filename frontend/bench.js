"use strict";
/* accuracy benchmark card. Hook into app.js only through the EXT registry. */
const BENCH_I18N = {
  en: {
    title: "Accuracy report", details: "Details", loading: "Running…", err: "Could not load.", retry: "Retry",
    synth: "Synthetic set", nrec: (n) => `${n} labeled records`,
    cat: "Category accuracy", unseenFirst: "Unseen merchants, first time", silent: "Recorded silently", taps: "Avg taps per record",
    tapsSub: (m) => `manual: ${m}`,
    cardNote: "Synthetic test set, not real users.",
    tblTitle: "All metrics", mTitle: "Method", lTitle: "Limits", mlTitle: "Method and limits", wTitle: "Misclassified items",
    ext: "Chat extraction", catKnown: "Category, known merchants", catUnseenAll: "Category, unseen (after learning)",
    question: "Needed a question", wrongSilent: "Silent but wrong", mode: "Matches expected mode",
    taps2: "Taps saved",
    none: "No misclassified items.", exp: "expected", got: "got", unseenTag: "unseen", knownTag: "known",
    limits: [
      "Small synthetic set styled like WeChat/Alipay. Not real-world accuracy.",
      "Weak spot: unseen merchants. First sighting goes to Other and we ask.",
      "After one answer the app remembers. The simulated user always answers correctly.",
      "Silent-but-wrong: ambiguous merchants, e.g. a delivery app used for movie tickets.",
    ],
    honest: "Computed live from data/bench_set.csv. Nothing hand-edited.",
    aria: "Open the accuracy report details",
  },
  zh: {
    title: "准确率报告", details: "详情", loading: "运行中…", err: "加载失败。", retry: "重试",
    synth: "合成数据集", nrec: (n) => `${n} 条已标注记录`,
    cat: "类别准确率", unseenFirst: "未见商户（首次）", silent: "静默入账", taps: "每条平均点击",
    tapsSub: (m) => `手动：${m}`,
    cardNote: "合成测试集，并非真实用户数据。",
    tblTitle: "全部指标", mTitle: "方法", lTitle: "局限", mlTitle: "方法与局限", wTitle: "分类错误的条目",
    ext: "聊天提取", catKnown: "类别：已知商户", catUnseenAll: "类别：未见商户（学习后）",
    question: "需要询问", wrongSilent: "静默但错误", mode: "与预期模式一致",
    taps2: "节省的点击",
    none: "没有分类错误的条目。", exp: "预期", got: "实际", unseenTag: "未见", knownTag: "已知",
    limits: [
      "小型合成数据集，仿微信/支付宝账单。不代表真实准确率。",
      "弱点：未见商户。首次出现归为“其他”并询问。",
      "回答一次后应用会记住。模拟用户总是答对。",
      "静默但错误：有歧义的商户，如用外卖平台买电影票。",
    ],
    honest: "由 data/bench_set.csv 实时计算，无手工修改。",
    aria: "打开准确率报告详情",
  },
};
const bt = () => BENCH_I18N[lang] || BENCH_I18N.en;

const BENCH = { data: null, err: false, loading: false };

(function () {
  const st = document.createElement("style");
  st.textContent = `
.bn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.bn-stat{background:var(--glass2);border:1px solid var(--gborder);border-radius:16px;padding:10px 12px;min-width:0}
.bn-stat b{display:block;font-size:22px;line-height:1.2;color:var(--ink)}
.bn-stat span{display:block;font-size:12px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere}
.bn-tbl{width:100%;border-collapse:collapse;font-size:14px}
.bn-tbl td{padding:9px 0;border-bottom:1px solid var(--line);vertical-align:top}
.bn-tbl td:last-child{text-align:right;font-weight:700;color:var(--ink);white-space:nowrap;padding-left:12px}
.bn-tbl tr:last-child td{border-bottom:0}
.bn-list{margin:8px 0 0;padding-left:18px;color:var(--ink);font-size:14px;line-height:1.5}
.bn-list li{margin-bottom:6px}
.bn-mis{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}
.bn-mis:last-child{border-bottom:0}
.bn-mis small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.bn-tag{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted);white-space:nowrap;align-self:flex-start}
.bn-err{color:var(--bad-text)}
.bn-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
`;
  document.head.appendChild(st);
})();

const bnPct = (v) => (v == null ? "–" : (Math.round(v * 10) / 10) + "%");
const bnNum = (v) => (v == null ? "–" : String(v));

function bnStat(v, label, sub) {
  return `<div class="bn-stat"><b>${esc(v)}</b><span>${esc(label)}${sub ? "<br>" + esc(sub) : ""}</span></div>`;
}

function bnHeadline(d) {
  const m = d.metrics, T = bt();
  return `<div class="bn-grid">${bnStat(bnPct(m.category_acc), T.cat)}${bnStat(bnPct(m.category_acc_unseen_first), T.unseenFirst)}${bnStat(bnPct(m.silent_pct), T.silent)}${bnStat(bnNum(m.avg_taps), T.taps, T.tapsSub(m.manual_taps))}</div>`;
}

function bnCardBody() {
  const T = bt();
  if (BENCH.err) return `<p class="note bn-err" role="alert">${esc(T.err)}</p><button class="btn ghost" data-bench-retry="1" style="min-height:44px">${esc(T.retry)}</button>`;
  if (!BENCH.data) return `<p class="note" role="status">${esc(T.loading)}</p>`;
  return `${bnHeadline(BENCH.data)}<p class="note">${esc(T.cardNote)} ${esc(T.nrec(BENCH.data.n))}.</p>`;
}

function bnCard() {
  const T = bt();
  return `<section class="panel" id="bench-card"><div class="bn-head"><h2>${esc(T.title)}</h2><span class="chip" style="min-height:0">${esc(T.synth)}</span></div>
<div id="bench-card-body">${bnCardBody()}</div>
<button class="btn ghost" data-go="benchmark" aria-label="${esc(T.aria)}" style="min-height:44px;margin-top:8px">${esc(T.details)}</button></section>`;
}

function bnPageBody() {
  const T = bt();
  if (BENCH.err) return `<section class="panel"><p class="note bn-err" role="alert">${esc(T.err)}</p><button class="btn" data-bench-retry="1" style="min-height:44px">${esc(T.retry)}</button></section>`;
  if (!BENCH.data) return `<section class="panel"><p class="note" role="status">${esc(T.loading)}</p></section>`;
  const d = BENCH.data, m = d.metrics, c = d.counts;
  const rows = [
    [T.ext, bnPct(m.extraction_acc)], [T.cat, bnPct(m.category_acc)], [T.catKnown, bnPct(m.category_acc_known)],
    [T.unseenFirst, bnPct(m.category_acc_unseen_first)], [T.catUnseenAll, bnPct(m.category_acc_unseen_all)],
    [T.silent, bnPct(m.silent_pct)], [T.question, bnPct(m.question_pct)], [T.wrongSilent, bnPct(m.wrong_silent_pct)],
    [T.mode, bnPct(m.mode_agreement_pct)], [T.taps, `${bnNum(m.avg_taps)} / ${bnNum(m.manual_taps)}`], [T.taps2, bnPct(m.taps_saved_pct)],
  ];
  const method = (d.method && (d.method[lang] || d.method.en)) || [];
  const mis = (d.misclassified || []).map((x) => `<div class="bn-mis"><div><b>${esc(x.item)}</b><small>${esc(T.exp)}: ${esc(x.expected)} · ${esc(T.got)}: ${esc(x.got)}</small></div><span class="bn-tag">${esc(x.unseen ? T.unseenTag : T.knownTag)}</span></div>`).join("");
  return `<section class="panel"><div class="bn-head"><h2>${esc(T.title)}</h2><span class="chip" style="min-height:0">${esc(T.synth)}</span></div>
<p class="note">${esc(T.nrec(d.n))} · ${esc(String(c.known))} ${esc(T.knownTag)} / ${esc(String(c.unseen))} ${esc(T.unseenTag)}</p>${bnHeadline(d)}</section>
<section class="panel"><h2>${esc(T.tblTitle)}</h2><table class="bn-tbl"><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table></section>
<section class="panel"><details class="more"><summary>${esc(T.mlTitle)}</summary><b>${esc(T.mTitle)}</b><ul class="bn-list">${method.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><b>${esc(T.lTitle)}</b><ul class="bn-list">${T.limits.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><p class="note">${esc(T.honest)}</p></details></section>
<section class="panel"><h2>${esc(T.wTitle)} (${(d.misclassified || []).length})</h2>${mis || `<p class="note">${esc(T.none)}</p>`}</section>`;
}

function bnPaint() {
  const a = document.getElementById("bench-card-body");
  if (a) a.innerHTML = bnCardBody();
  const b = document.getElementById("bench-page");
  if (b) b.innerHTML = bnPageBody();
}

async function bnLoad(force) {
  if (BENCH.loading || (BENCH.data && !force)) return;
  BENCH.loading = true; BENCH.err = false;
  if (force) bnPaint();
  try {
    BENCH.data = await api("/benchmark");
  } catch (e) {
    BENCH.err = true;
  }
  BENCH.loading = false;
  bnPaint();
}

EXT.settings.push(() => bnCard());
EXT.routes.benchmark = {
  title: () => bt().title,
  parent: "#/settings",
  page: () => `<div id="bench-page">${bnPageBody()}</div>`,
};
EXT.after.push((r) => {
  if (r.name === "settings" || r.name === "benchmark") bnLoad(false);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-bench-retry]");
  if (b) bnLoad(true);
});
