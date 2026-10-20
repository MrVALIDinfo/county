"use strict";
/* weekly summary, streaks/badges, what-if, monthly report. Hook into app.js only through the EXT registry. */
(function () {
  const INS_I18N = {
    en: {
      week: "This week", weekSub: "Last 7 days", vs: (v) => `vs ${v} before`, noPrev: "No prior week",
      bestDay: "Best day", topCat: "Top category", share: (p) => `${p}% of the week`, weekEmpty: "No spending logged this week.",
      lower: (p) => `Down ${p}% vs last week`, higher: (p) => `Up ${p}% vs last week`,
      tipKeep: (v) => `${v} less than last week. Keep going.`,
      tipCut: (c, v) => `Cut ${c} 20% to save about ${v} a month.`,
      tipWatch: (c) => `${c} is your top item this week.`,
      tipNone: "Log a few more days for a tip.",
      loading: "Loading…", err: "Could not load.", retry: "Retry",
      streakT: "Streak and badges", streakNow: "Current streak", streakBest: "Best streak", dayN: (n) => `${n} day${n === 1 ? "" : "s"}`,
      streakSub: (v) => `Days under ${v} a day`, streakStart: (v) => `Stay under ${v} today to start.`, streakNoData: "Import records to start.",
      locked: "Locked", unlocked: "Unlocked",
      b: {
        week: ["First week on pace", "7 days under target."],
        streak3: ["3-day streak", "3 days under target."],
        goal: ["Goal reached", "Fully fund any goal."],
        quiet: ["Quiet logger", "50 records logged silently."],
        smart: ["Smart cut", "Top category under 35%."],
      },
      wiT: "What if you save more?", wiSub: "See the new finish date.", wiLabel: "Extra per week", wiAria: "Extra savings per week",
      wiFinish: "Projected finish", wiNow: "At the current pace", wiNoPace: "No finish date at this pace.", wiNoPaceNew: "Add extra to see a date.",
      wiSooner: (n) => `${n} day${n === 1 ? "" : "s"} sooner`, wiSame: "Same date as now", wiOnTime: "On time", wiRisk: "At risk", wiDeadline: (d) => `Deadline ${d}`,
      wiPerWeek: (v) => `+${v} / week`,
      repT: "Monthly report", repSub: "Income and spending by month", repPrev: "Previous month", repNext: "Next month",
      income: "Income", spent: "Spent", net: "Net", cats: "Spending by category", merch: "Top merchants", times: (n) => `${n} time${n === 1 ? "" : "s"}`,
      cmp: "Compared with last month", cmpSpent: "Spending", cmpIncome: "Income", cmpNone: "No data last month.",
      repEmpty: "No records in this month.", repEmptySub: "Try another month or import.",
      cat: null,
    },
    zh: {
      week: "本周", weekSub: "最近 7 天", vs: (v) => `上周 ${v}`, noPrev: "上周无数据",
      bestDay: "最省的一天", topCat: "最大支出类别", share: (p) => `占本周 ${p}%`, weekEmpty: "本周没有支出记录。",
      lower: (p) => `比上周少 ${p}%`, higher: (p) => `比上周多 ${p}%`,
      tipKeep: (v) => `比上周少花 ${v}，继续保持。`,
      tipCut: (c, v) => `${c}减 20%，每月约省 ${v}。`,
      tipWatch: (c) => `本周${c}支出最多。`,
      tipNone: "多记几天，就有建议。",
      loading: "加载中…", err: "加载失败。", retry: "重试",
      streakT: "连续达标与徽章", streakNow: "当前连续", streakBest: "最长连续", dayN: (n) => `${n} 天`,
      streakSub: (v) => `每天低于 ${v} 的天数`, streakStart: (v) => `今天控制在 ${v} 以内即可开始。`, streakNoData: "导入记录后开始计算。",
      locked: "未解锁", unlocked: "已解锁",
      b: {
        week: ["首周达标", "连续 7 天达标。"],
        streak3: ["连续 3 天", "连续 3 天达标。"],
        goal: ["达成目标", "完整存满任意一个目标。"],
        quiet: ["静默记账", "50 条记录自动记录。"],
        smart: ["聪明省钱", "最大类别低于 35%。"],
      },
      wiT: "如果多存一点？", wiSub: "看看新的完成日期。", wiLabel: "每周额外存入", wiAria: "每周额外储蓄金额",
      wiFinish: "预计完成", wiNow: "按目前节奏", wiNoPace: "按此节奏无法估算。", wiNoPaceNew: "增加金额后可估算。",
      wiSooner: (n) => `提前 ${n} 天`, wiSame: "与现在日期相同", wiOnTime: "可按时完成", wiRisk: "有风险", wiDeadline: (d) => `截止 ${d}`,
      wiPerWeek: (v) => `每周 +${v}`,
      repT: "月度报告", repSub: "按月看收入与支出", repPrev: "上个月", repNext: "下个月",
      income: "收入", spent: "支出", net: "结余", cats: "按类别支出", merch: "常去商户 Top 5", times: (n) => `${n} 次`,
      cmp: "与上月对比", cmpSpent: "支出", cmpIncome: "收入", cmpNone: "上月无数据。",
      repEmpty: "这个月没有记录。", repEmptySub: "换个月份或导入账单。",
      cat: null,
    },
  };
  const it = () => INS_I18N[lang] || INS_I18N.en;
  const catName = (c) => { try { return t().cat[c] || c; } catch (e) { return c; } };
  const minus = (n) => (n < 0 ? "−" : n > 0 ? "+" : "") + Math.abs(n) + "%";

  ICONS.insFlame = '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 2 1 3 2.5 2.5z"/>';
  ICONS.insMedal = '<circle cx="12" cy="15" r="6"/><path d="m8.2 10.2-2.7-7h5l1.5 4M15.8 10.2l2.7-7h-5l-1.5 4"/>';
  ICONS.insLock = '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
  ICONS.insSlider = '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>';

  const css = document.createElement("style");
  css.textContent = `
.ins-head{display:flex;align-items:center;gap:12px}.ins-head .ins-ht{flex:1;min-width:0}.ins-head h2{margin:0}
.ins-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
.ins-amt{font-size:30px;font-weight:800;letter-spacing:-.5px;line-height:1.1}
.ins-delta{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:var(--r-pill);font-size:13px;font-weight:700;border:1px solid var(--gborder);background:var(--glass2)}
.ins-delta.down{color:var(--accent-text);background:color-mix(in srgb,var(--accent) 18%,transparent);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.ins-delta.up{color:var(--warn-text);background:color-mix(in srgb,var(--sun,#f5a623) 18%,transparent);border-color:color-mix(in srgb,var(--sun,#f5a623) 50%,transparent)}
.ins-delta svg{width:14px;height:14px;stroke-width:2.6}
.ins-sub{margin:4px 0 0;font-size:13px}
.ins-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.ins-two>div{display:grid;gap:2px;padding:10px 12px;border-radius:14px;background:var(--glass2);border:1px solid var(--gborder);min-width:0}
.ins-two b{display:flex;align-items:center;gap:6px;font-size:15px;min-width:0}.ins-two b svg{width:18px;height:18px;flex:none;color:var(--accent-text)}
.ins-two span{font-size:12.5px}
.ins-tip{display:flex;gap:8px;align-items:flex-start;margin:12px 0 0;font-size:14px;line-height:1.4}.ins-tip svg{width:18px;height:18px;flex:none;margin-top:1px;color:var(--accent-text)}
.ins-state{margin:0}.ins-state .btn{margin-top:10px}
.ins-streak{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 0}
.ins-streak>div{padding:10px 12px;border-radius:14px;background:var(--glass2);border:1px solid var(--gborder);display:grid;gap:2px}
.ins-streak b{font-size:24px;line-height:1.1;display:flex;align-items:center;gap:6px}.ins-streak b svg{width:22px;height:22px;color:var(--accent-text)}
.ins-badges{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:14px}
.ins-badge{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font-size:11px;line-height:1.2;font-weight:700;min-height:44px;min-width:0;overflow-wrap:anywhere}
.ins-badge .bi{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent)}
.ins-badge .bi svg{width:22px;height:22px}
.ins-badge.off{opacity:.55;filter:grayscale(1)}.ins-badge.off .bi{background:var(--glass2);color:var(--muted);border:1px dashed var(--line)}
.ins-badge small{font-weight:600;color:var(--muted);font-size:10.5px}
.ins-wi-val{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px}.ins-wi-val b{font-size:20px}
.ins-range{width:100%;height:44px;margin:2px 0 0;accent-color:var(--accent);cursor:pointer}
.ins-range:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:8px}
.ins-wi-scale{display:flex;justify-content:space-between;font-size:12px}
.ins-wi-out{display:grid;gap:8px;margin-top:10px;padding:12px;border-radius:14px;background:var(--glass2);border:1px solid var(--gborder)}
.ins-wi-out .big{font-size:20px;font-weight:800}
.ins-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ins-mo{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ins-mo b{font-size:17px;text-align:center;flex:1}
.ins-mo button{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--gborder);background:var(--glass);color:var(--ink);cursor:pointer}
.ins-mo button:disabled{opacity:.35;cursor:default}.ins-mo button svg{width:20px;height:20px}
.ins-fin{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.ins-fin>div{display:grid;gap:2px;padding:10px;border-radius:14px;background:var(--glass2);border:1px solid var(--gborder);min-width:0}
.ins-fin b{font-size:15px;overflow-wrap:anywhere}.ins-fin span{font-size:12px}
.ins-row{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;padding:8px 0}
.ins-row .tile-ico{width:36px;height:36px}
.ins-row .nm{display:flex;justify-content:space-between;gap:8px;font-size:14px}.ins-row .nm b{font-weight:700}
.ins-bar{height:8px;border-radius:99px;background:var(--glass2);border:1px solid var(--gborder);overflow:hidden;margin-top:6px}
.ins-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.ins-cmp{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0}
.ins-skel{height:14px;border-radius:8px;background:var(--glass2);margin:8px 0}
`;
  document.head.appendChild(css);

  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const wkday = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(locale(), { weekday: "long" });
  const rangeLbl = (a, b) => dshort(a) + " – " + dshort(b);
  const hereName = () => { try { return parse().name; } catch (e) { return ""; } };
  const repaint = (names) => { try { if (names.includes(hereName())) { const ae = document.activeElement; if (ae && (ae.id === "ins-wi")) return; render(); } } catch (e) { console.error(e); } };
  const stateBox = (loading, retryKey) => loading
    ? `<section class="panel" aria-busy="true"><div class="ins-skel" style="width:40%"></div><div class="ins-skel" style="width:70%"></div><p class="muted ins-state">${esc(it().loading)}</p></section>`
    : `<section class="panel"><p class="ins-state">${esc(it().err)}</p><button class="btn ghost sm ins-state" data-ins="${retryKey}">${esc(it().retry)}</button></section>`;

  /* ---------- /api/insights cache ---------- */
  const INS = { data: null, at: 0, err: false, busy: false, wi: {} };
  async function insLoad(force) {
    if (INS.busy) return;
    if (!force && INS.err) return;
    if (!force && INS.data && Date.now() - INS.at < 15000) return;
    INS.busy = true;
    try {
      const d = await api("/insights");
      const changed = JSON.stringify(d) !== JSON.stringify(INS.data);
      const wasErr = INS.err;
      INS.data = d; INS.err = false; INS.at = Date.now();
      if (changed || wasErr || force) repaint(["home", "profile", "goal"]);
    } catch (e) {
      INS.err = true; INS.at = Date.now();
      if (!INS.data) repaint(["home", "profile", "goal"]);
    } finally { INS.busy = false; }
  }
  const insReady = () => { insLoad(false); return INS.data; };

  /* ---------- 1. weekly summary on Home ---------- */
  EXT.homeTop.push(function () {
    const x = it(), d = insReady();
    if (!d) return stateBox(!INS.err, "ins");
    const w = d.week;
    const head = `<div class="ins-head"><span class="tile-ico" style="--c:var(--accent)">${ic("chart")}</span><div class="ins-ht"><h2>${esc(x.week)}</h2><span class="muted">${esc(rangeLbl(w.from, w.to))}</span></div>
      <button class="ask-ai" data-a="askai" data-k="save" aria-label="${esc(t().askAI)}">${ic("sparkles")}${esc(t().askAI)}</button></div>`;
    if (!w.this_cents && !w.prev_cents) return `<section class="panel ins-week" aria-label="${esc(x.week)}">${head}<p class="muted ins-sub" style="margin-top:12px">${esc(x.weekEmpty)}</p></section>`;
    let chip = "";
    if (w.delta_pct !== null && w.delta_pct !== undefined) {
      const dn = w.delta_pct <= 0, p = Math.abs(w.delta_pct);
      chip = `<span class="ins-delta ${dn ? "down" : "up"}" aria-label="${esc(dn ? x.lower(p) : x.higher(p))}">${minus(w.delta_pct)}</span>`;
    }
    const tc = w.top_category, tp = w.tip || { code: "none" };
    const tip = tp.code === "keep" ? x.tipKeep(yuan(tp.saved_cents)) : tp.code === "cut_top" ? x.tipCut(catName(tp.category), yuan(tp.monthly_cents))
      : tp.code === "watch_top" ? x.tipWatch(catName(tp.category)) : x.tipNone;
    return `<section class="panel ins-week" aria-label="${esc(x.week)}">${head}
      <div class="ins-main"><b class="ins-amt">${yuan(w.this_cents)}</b>${chip}</div>
      <p class="muted ins-sub">${esc(x.weekSub)} · ${esc(w.prev_cents ? x.vs(yuan(w.prev_cents)) : x.noPrev)}</p>
      <div class="ins-two"><div><span class="muted">${esc(x.bestDay)}</span><b>${esc(wkday(w.best_day.date))}</b><span class="muted">${yuan(w.best_day.spent_cents)}</span></div>
      <div><span class="muted">${esc(x.topCat)}</span>${tc ? `<b>${catIcon(tc.category)}<span style="font-size:15px">${esc(catName(tc.category))}</span></b><span class="muted">${yuan(tc.total_cents)} · ${esc(x.share(Math.round(tc.share * 100)))}</span>` : `<b>–</b>`}</div></div>
      <p class="ins-tip">${ic("sparkles")}<span>${esc(tip)}</span></p></section>`;
  });

  /* ---------- 2. streak and badges on Profile ---------- */
  const BADGE_ICON = { week: "check", streak3: "insFlame", goal: "goals", quiet: "shield", smart: "sparkles" };
  EXT.profile.push(function () {
    const x = it(), d = insReady();
    if (!d) return stateBox(!INS.err, "ins");
    const s = d.streak, tgt = yuan(d.day_target_cents || 0);
    let note = x.streakSub(tgt);
    if (!s.days_tracked) note = x.streakNoData; else if (!s.current) note = x.streakStart(tgt);
    const badges = d.badges.map((b) => {
      const nm = (x.b[b.id] || [b.id, ""])[0], how = (x.b[b.id] || ["", ""])[1], on = !!b.unlocked;
      const lab = on ? `${x.unlocked}: ${nm}` : `${x.locked}: ${nm}. ${how}`;
      const prog = !on && b.id !== "goal" && b.progress !== null && b.progress !== undefined ? `<small>${b.progress}/${b.goal}${b.id === "smart" ? "%" : ""}</small>` : "";
      return `<div class="ins-badge ${on ? "" : "off"}" role="img" aria-label="${esc(lab)}" title="${esc(on ? nm : how)}"><span class="bi">${ic(on ? BADGE_ICON[b.id] || "check" : "insLock")}</span><span>${esc(nm)}</span>${prog}</div>`;
    }).join("");
    return `<section class="panel" aria-label="${esc(x.streakT)}"><div class="ins-head"><span class="tile-ico" style="--c:var(--accent)">${ic("insFlame")}</span><div class="ins-ht"><h2>${esc(x.streakT)}</h2></div></div>
      <div class="ins-streak"><div><span class="muted">${esc(x.streakNow)}</span><b>${ic("insFlame")}${esc(x.dayN(s.current))}</b></div><div><span class="muted">${esc(x.streakBest)}</span><b>${esc(x.dayN(s.best))}</b></div></div>
      <p class="muted ins-sub">${esc(note)}</p><div class="ins-badges">${badges}</div></section>`;
  });

  /* ---------- 3. what-if on goal detail ---------- */
  function whatIf(g, wk) {
    const x = it(), pace = (INS.data && INS.data.goals_pace && INS.data.goals_pace[String(g.id)]) || 0;
    const today = (S && S.today) || new Date().toISOString().slice(0, 10), rem = g.remaining_cents;
    const extraM = wk * 100 * 4.3, np = pace + extraM;
    const dNow = pace > 0 ? Math.floor(rem / pace * 30) : null, dNew = np > 0 ? Math.floor(rem / np * 30) : null;
    const fin = dNew === null ? null : addDays(today, dNew);
    let sooner = "", chip = "", line = "";
    if (fin === null) { line = `<span class="muted">${esc(x.wiNoPace)}</span>`; }
    else {
      line = `<span class="muted">${esc(x.wiFinish)}</span><span class="big">${esc(dfull(fin))}</span>`;
      if (dNow !== null) sooner = dNow - dNew > 0 ? x.wiSooner(dNow - dNew) : x.wiSame;
      else sooner = x.wiNoPace;
      const ok = fin <= g.deadline;
      chip = `<span class="ins-delta ${ok ? "down" : "up"}">${esc(ok ? x.wiOnTime : x.wiRisk)}</span>`;
    }
    const base = dNow !== null ? `${x.wiNow}: ${dfull(addDays(today, dNow))}` : (wk === 0 ? x.wiNoPaceNew : "");
    return `${line}<div class="ins-chips">${chip}${sooner && fin ? `<span class="chip plain">${esc(sooner)}</span>` : ""}<span class="muted" style="font-size:13px">${esc(x.wiDeadline(dfull(g.deadline)))}</span></div>${base ? `<span class="muted" style="font-size:13px">${esc(base)}</span>` : ""}`;
  }
  EXT.goal.push(function (d, g) {
    if (!g || isDone(g)) return "";
    const x = it(), data = insReady();
    if (!data) return stateBox(!INS.err, "ins");
    const wk = INS.wi[g.id] || 0;
    return `<section class="panel" aria-label="${esc(x.wiT)}"><div class="ins-head"><span class="tile-ico" style="--c:var(--accent2)">${ic("insSlider")}</span><div class="ins-ht"><h2>${esc(x.wiT)}</h2><span class="muted">${esc(x.wiSub)}</span></div></div>
      <div class="ins-wi-val"><span class="muted">${esc(x.wiLabel)}</span><b id="ins-wi-val">${esc(yuan(wk * 100))}</b></div>
      <input id="ins-wi" class="ins-range" type="range" min="0" max="500" step="50" value="${wk}" data-id="${esc(g.id)}" aria-label="${esc(x.wiAria)}" aria-valuetext="${esc(x.wiPerWeek(yuan(wk * 100)))}">
      <div class="ins-wi-scale muted"><span>¥0</span><span>¥500</span></div>
      <div class="ins-wi-out" id="ins-wi-out" aria-live="polite">${whatIf(g, wk)}</div></section>`;
  });

  /* ---------- 4. monthly report ---------- */
  const REP = { y: 0, m: 0, cache: {}, busy: {} };
  const rkey = (y, m) => y + "-" + String(m).padStart(2, "0");
  const curYM = () => { const s = (S && S.today) || new Date().toISOString().slice(0, 10); return [+s.slice(0, 4), +s.slice(5, 7)]; };
  async function repLoad(y, m, force) {
    const k = rkey(y, m);
    if (REP.busy[k]) return;
    if (!force && REP.cache[k] && REP.cache[k].data && Date.now() - REP.cache[k].at < 15000) return;
    if (!force && REP.cache[k] && REP.cache[k].err) return;
    REP.busy[k] = true;
    try {
      const data = await api(`/report?year=${y}&month=${m}`);
      const changed = JSON.stringify(data) !== JSON.stringify(REP.cache[k] && REP.cache[k].data);
      REP.cache[k] = { data, at: Date.now() };
      if (changed || force) repaint(["report"]);
    } catch (e) {
      const had = REP.cache[k] && REP.cache[k].data;
      REP.cache[k] = { err: true, at: Date.now(), data: had || null };
      if (!had) repaint(["report"]);
    } finally { REP.busy[k] = false; }
  }
  const deltaChip = (p) => p === null || p === undefined ? "" : `<span class="ins-delta ${p <= 0 ? "down" : "up"}">${minus(p)}</span>`;
  function reportPage() {
    const x = it();
    if (!REP.y) { const c = curYM(); REP.y = c[0]; REP.m = c[1]; }
    const k = rkey(REP.y, REP.m), e = REP.cache[k];
    repLoad(REP.y, REP.m, false);
    const [cy, cm] = curYM(), data = e && e.data;
    const label = new Date(REP.y, REP.m - 1, 1).toLocaleDateString(locale(), { year: "numeric", month: "long" });
    const atMin = data && data.min_month && k <= data.min_month, atMax = rkey(REP.y, REP.m) >= rkey(cy, cm);
    const sw = `<section class="panel"><div class="ins-mo"><button data-ins="prev" aria-label="${esc(x.repPrev)}" ${atMin ? "disabled" : ""}>${ic("back")}</button><b aria-live="polite">${esc(label)}</b><button data-ins="next" aria-label="${esc(x.repNext)}" ${atMax ? "disabled" : ""}>${ic("go")}</button></div></section>`;
    if (!data) return sw + (e && e.err ? stateBox(false, "rep") : stateBox(true, "rep"));
    if (data.empty) return sw + `<section class="panel empty"><p><b>${esc(x.repEmpty)}</b></p><p class="muted">${esc(x.repEmptySub)}</p></section>`;
    const net = data.net_cents, max = Math.max(1, ...data.categories.map((c) => c.total_cents));
    const cats = data.categories.map((c) => `<div class="ins-row"><span class="tile-ico" style="--c:${col(CAT_COLOR[c.category] || "--accent")}">${catIcon(c.category)}</span>
      <div><div class="nm"><b>${esc(catName(c.category))}</b><span>${yuan(c.total_cents)}</span></div><div class="ins-bar" role="img" aria-label="${esc(catName(c.category) + " " + Math.round(c.share * 100) + "%")}"><i style="width:${Math.max(2, Math.round(c.total_cents / max * 100))}%"></i></div></div>
      <span class="muted" style="font-size:13px">${Math.round(c.share * 100)}%</span></div>`).join("");
    const mer = data.merchants.map((m) => `<div class="ins-cmp"><span><b>${esc(typeof mname === "function" ? mname(m.merchant) : m.merchant)}</b><br><span class="muted" style="font-size:13px">${esc(x.times(m.n))}</span></span><b>${yuan(m.total_cents)}</b></div>`).join("");
    const pv = data.prev, cmp = pv && !pv.empty
      ? `<div class="ins-cmp"><span>${esc(x.cmpSpent)}<br><span class="muted" style="font-size:13px">${yuan(pv.spent_cents)} → ${yuan(data.spent_cents)}</span></span>${deltaChip(data.spent_delta_pct)}</div>
         <div class="ins-cmp"><span>${esc(x.cmpIncome)}<br><span class="muted" style="font-size:13px">${yuan(pv.income_cents)} → ${yuan(data.income_cents)}</span></span>${data.income_delta_pct === null || data.income_delta_pct === undefined ? "" : `<span class="ins-delta ${data.income_delta_pct >= 0 ? "down" : "up"}">${minus(data.income_delta_pct)}</span>`}</div>`
      : `<p class="muted ins-state">${esc(x.cmpNone)}</p>`;
    return sw + `<section class="panel"><div class="ins-fin"><div><span class="muted">${esc(x.income)}</span><b>${yuan(data.income_cents)}</b></div><div><span class="muted">${esc(x.spent)}</span><b>${yuan(data.spent_cents)}</b></div>
      <div><span class="muted">${esc(x.net)}</span><b style="${net < 0 ? "color:var(--bad-text)" : ""}">${yuan(net)}</b></div></div></section>
      <section class="panel"><h2>${esc(x.cats)}</h2>${cats}</section>
      <section class="panel"><h2>${esc(x.merch)}</h2>${mer}</section>
      <section class="panel"><h2>${esc(x.cmp)}</h2>${cmp}</section>`;
  }
  EXT.routes.report = { title: () => it().repT, page: () => { try { return reportPage(); } catch (e) { console.error(e); return stateBox(false, "rep"); } }, parent: "#/history" };
  EXT.history.push(() => linkCard("report", "chart", "--accent", esc(it().repT), esc(it().repSub)));

  /* ---------- wiring ---------- */
  EXT.after.push(function (r) {
    try {
      if (r.name === "goal" && r.a && r.a !== "new" && r.b !== "edit") {
        const el = document.getElementById("ins-wi");
        if (!el) return;
        const g = S && S.goals && S.goals.find((q) => String(q.id) === String(r.a));
        if (!g) return;
        el.addEventListener("input", () => {
          const wk = Math.max(0, Math.min(500, Math.round((+el.value || 0) / 50) * 50));
          INS.wi[g.id] = wk;
          const v = document.getElementById("ins-wi-val"), o = document.getElementById("ins-wi-out");
          if (v) v.textContent = yuan(wk * 100);
          el.setAttribute("aria-valuetext", it().wiPerWeek(yuan(wk * 100)));
          if (o) o.innerHTML = whatIf(g, wk);
        });
      }
    } catch (e) { console.error(e); }
  });
  document.addEventListener("click", (ev) => {
    try {
      const b = ev.target.closest && ev.target.closest("[data-ins]");
      if (!b || b.disabled) return;
      const a = b.dataset.ins;
      if (a === "ins") { INS.err = false; insLoad(true); repaint(["home", "profile", "goal"]); }
      else if (a === "rep") { const k = rkey(REP.y, REP.m); if (REP.cache[k]) delete REP.cache[k]; repLoad(REP.y, REP.m, true); repaint(["report"]); }
      else if (a === "prev" || a === "next") {
        const n = REP.y * 12 + REP.m - 1 + (a === "prev" ? -1 : 1);
        REP.y = Math.floor(n / 12); REP.m = (n % 12) + 1;
        repaint(["report"]);
      }
    } catch (e) { console.error(e); }
  });
})();
