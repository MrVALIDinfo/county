"use strict";
/* Learning path UI for the Invest section (Path tab, lesson player, playbook page).
   Backend: GET /api/learn, POST /api/learn/complete, POST /api/learn/reset.
   Hooks into invest2.js: lnPathBody(), lnEnsure(), lnPlaybookPage(Sx, r). Educational only. */

const LRN_I18N = {
  en: {
    statsLbl: "Your progress", streak: "Streak", xp: "XP", today: "Today",
    streakN: (n) => `${n} day streak`, goalN: (a, b) => `${a} of ${b} XP today`,
    coach: "Next up", start: "Start", lvlN: (n) => `Level ${n}`, cnt: (a, b) => `${a}/${b}`,
    locked: (n) => `Finish level ${n} to unlock`,
    lockPrev: "Finish the previous lesson first.", lockBook: "Finish all lessons to open.", lockLevel: (n) => `Finish level ${n} first.`,
    playbook: "Playbook", pathLbl: "Learning path",
    nLocked: (t) => `${t}, locked`, nDone: (t, s) => `${t}, done, ${s} of 3 stars`, nNext: (t) => `${t}, start`, nBook: "Playbook, open",
    close: "Close", leaveQ: "Leave lesson?", leaveSub: "Progress will be lost.", stay: "Stay", leave: "Leave",
    next: "Next", cont: "Continue", correct: "Correct", wrong: "Not quite",
    q: (i, n) => `Question ${i} of ${n}`, card: (i, n) => `Step ${i} of ${n}`,
    saving: "Saving…", saveFail: "Could not save.", retry: "Retry",
    lessonDone: "Lesson done", score: (a, b) => `${a} of ${b} correct`, goalHit: "Daily goal reached",
    levelUp: "Level up", unlocked: (t) => `${t} unlocked`, nextLesson: "Next lesson", finish: "Done",
    pbSteps: "Common steps", pbAsk: "Questions to ask", illus: "Illustration only. Not advice.",
    edu: "Educational only. Not investment advice. Ask a licensed professional.", pbNone: "No playbook yet.",
    err: "Could not load. Check your connection.", demo: "Demo tools", reset: "Reset progress", resetDone: "Progress reset.",
    stars: (n) => `${n} of 3 stars`
  },
  zh: {
    statsLbl: "我的进度", streak: "连续", xp: "经验", today: "今日",
    streakN: (n) => `连续 ${n} 天`, goalN: (a, b) => `今日 ${a}/${b} 经验`,
    coach: "下一步", start: "开始", lvlN: (n) => `第 ${n} 关`, cnt: (a, b) => `${a}/${b}`,
    locked: (n) => `完成第 ${n} 关后解锁`,
    lockPrev: "请先完成上一课。", lockBook: "完成全部课程后开启。", lockLevel: (n) => `请先完成第 ${n} 关。`,
    playbook: "策略手册", pathLbl: "学习路径",
    nLocked: (t) => `${t}，未解锁`, nDone: (t, s) => `${t}，已完成，${s} 星`, nNext: (t) => `${t}，开始`, nBook: "策略手册，已开启",
    close: "关闭", leaveQ: "退出课程？", leaveSub: "进度将丢失。", stay: "继续学", leave: "退出",
    next: "下一步", cont: "继续", correct: "回答正确", wrong: "再想想",
    q: (i, n) => `第 ${i}/${n} 题`, card: (i, n) => `第 ${i}/${n} 步`,
    saving: "保存中…", saveFail: "保存失败。", retry: "重试",
    lessonDone: "课程完成", score: (a, b) => `答对 ${a}/${b}`, goalHit: "今日目标达成",
    levelUp: "升级啦", unlocked: (t) => `已解锁：${t}`, nextLesson: "下一课", finish: "完成",
    pbSteps: "常见步骤", pbAsk: "可以问的问题", illus: "仅作示意，不构成建议。",
    edu: "仅供学习，不构成投资建议。请咨询持牌专业人士。", pbNone: "暂无策略手册。",
    err: "加载失败，请检查网络。", demo: "演示工具", reset: "重置进度", resetDone: "进度已重置。",
    stars: (n) => `${n}/3 星`
  }
};
const ln = () => LRN_I18N[lang] || LRN_I18N.en;

/* ---- icons ---- */
if (typeof ICONS === "object") {
  ICONS.flame = ICONS.flame || '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 1.4 1 2.5 2.5 2.5z"/>';
  ICONS.star = ICONS.star || '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z"/>';
  ICONS.lock = ICONS.lock || '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
  ICONS.seed = ICONS.seed || '<path d="M12 3c4 3.5 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6.5 6-10z"/><path d="M12 21v-6"/>';
  ICONS.sprout = ICONS.sprout || '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>';
  ICONS.tree = ICONS.tree || '<path d="M12 22v-6"/><path d="M12 2 5 11h3l-4 6h16l-4-6h3z"/>';
  ICONS.bolt = ICONS.bolt || '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>';
  ICONS.arrow = ICONS.arrow || '<path d="M5 12h14M13 6l6 6-6 6"/>';
  ICONS.check = ICONS.check || '<path d="M20 6 9 17l-5-5"/>';
  ICONS.x = ICONS.x || '<path d="M18 6 6 18M6 6l12 12"/>';
  ICONS.crown = ICONS.crown || '<path d="m2 4 3 12h14l3-12-6 5-4-7-4 7-6-5z"/><path d="M5 20h14"/>';
  ICONS.book = ICONS.book || '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V22h16"/>';
  ICONS.sparkles = ICONS.sparkles || '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>';
}
const lnIc = (n, fb) => {
  const k = typeof ICONS === "object" && ICONS[n] ? n : (typeof ICONS === "object" && ICONS[fb] ? fb : "info");
  return `<svg class="ln-s" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
};

/* ---- styles ---- */
(function () {
  try {
    const st = document.createElement("style");
    st.textContent = `
.ln-s{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ln-fill .ln-s,.ln-fill.ln-s{fill:currentColor}
.ln-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ln-stat{display:grid;justify-items:center;align-content:center;gap:2px;min-height:78px;padding:10px 6px;border-radius:var(--r-panel);background:var(--glass);border:1px solid var(--gborder);box-shadow:var(--shadow);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.ln-stat .v{display:flex;align-items:center;gap:6px;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.ln-stat .v .ln-s{font-size:22px}
.ln-stat .tag{font-size:12px}
.ln-flame{color:var(--slate);display:inline-grid}
.ln-stat.on .ln-flame{color:var(--accent2);animation:ln-flick 1.6s ease-in-out infinite;transform-origin:50% 90%}
.ln-starc{color:var(--accent-text);display:inline-grid}
.ln-rw{position:relative;display:inline-grid;place-items:center;width:28px;height:28px}
.ln-ring{width:28px;height:28px}
.ln-ring .t{fill:none;stroke:var(--line);stroke-width:5}
.ln-ring .v{fill:none;stroke:var(--accent);stroke-width:5;stroke-linecap:round;transition:stroke-dasharray .6s ease}
.ln-rw .ln-s{position:absolute;font-size:14px;color:var(--accent-text);stroke-width:3}
.ln-coach{display:flex;align-items:center;gap:12px}
.ln-coach p{margin:2px 0 0;font-size:14px;line-height:1.4}
.ln-ctile{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:22px;flex:none;color:var(--accent-text);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 26%,var(--glass2)),color-mix(in srgb,var(--accent2) 22%,var(--glass2)))}
.ln-level{display:grid;gap:10px}
.ln-banner{display:flex;align-items:center;gap:12px;padding:14px;border-radius:var(--r-panel);border:1px solid var(--gborder);box-shadow:var(--shadow);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 22%,var(--glass2)),color-mix(in srgb,var(--accent2) 18%,var(--glass2)))}
.ln-banner.is-locked{background:var(--glass)}
.ln-banner h2{margin:0;font-size:17px;line-height:1.25}
.ln-banner p{margin:2px 0 0;font-size:13px}
.ln-bi{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;font-size:26px;flex:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent)}
.is-locked .ln-bi{background:var(--glass2);color:var(--muted)}
.ln-cnt{display:inline-flex;align-items:center;gap:4px;font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:var(--accent-text)}
.is-locked .ln-cnt{color:var(--muted)}
.ln-path{position:relative;width:280px;max-width:100%;margin:0 auto}
.ln-path>svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible}
.ln-path>svg path{fill:none;stroke:var(--line);stroke-width:4;stroke-linecap:round;stroke-dasharray:1 10}
.ln-path>svg path.d{stroke:var(--accent)}
.ln-nw{position:absolute;width:120px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:14px}
.ln-nb{position:relative}
.ln-n{width:64px;height:64px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;font-size:28px;cursor:pointer;position:relative;transition:transform .12s}
.ln-n:active{transform:translateY(3px)}
.ln-n:focus-visible{outline:3px solid var(--focus);outline-offset:4px}
.ln-n.is-locked{background:var(--glass2);color:var(--muted);border:1px solid var(--gborder);box-shadow:inset 0 -4px 0 var(--line)}
.ln-n.is-open,.ln-n.is-next{background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent);box-shadow:0 5px 0 color-mix(in srgb,var(--accent2) 55%,#000)}
.ln-n.is-done{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 72%,var(--bg0)),color-mix(in srgb,var(--accent2) 72%,var(--bg0)));color:var(--on-accent);box-shadow:0 5px 0 color-mix(in srgb,var(--accent2) 40%,var(--bg0))}
.ln-n.is-book{border-radius:22px;background:var(--glass2);color:var(--accent-text);border:2px solid var(--accent2);box-shadow:0 4px 0 color-mix(in srgb,var(--accent2) 40%,transparent)}
.ln-n.is-book.is-locked{border:1px solid var(--gborder);color:var(--muted);box-shadow:inset 0 -4px 0 var(--line)}
.ln-n.is-next::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:3px solid var(--accent);opacity:0;animation:ln-pulse 1.8s ease-out infinite;pointer-events:none}
.ln-bub{position:absolute;left:50%;top:-36px;transform:translateX(-50%);padding:4px 12px;border-radius:var(--r-pill);background:var(--ink);color:var(--bg0);font-size:12px;font-weight:800;white-space:nowrap;pointer-events:none;animation:ln-bob 1.6s ease-in-out infinite}
.ln-bub::after{content:"";position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:var(--ink)}
.ln-nst{position:absolute;left:50%;bottom:-11px;transform:translateX(-50%);display:flex;gap:1px;font-size:13px;padding:2px 6px;border-radius:var(--r-pill);background:var(--bg0);border:1px solid var(--line);pointer-events:none}
.ln-nst .on{color:var(--accent-text)}
.ln-nst .off{color:var(--line)}
.ln-lbl{font-size:12px;font-weight:600;text-align:center;line-height:1.25;max-width:116px;padding:2px 6px;border-radius:10px;background:color-mix(in srgb,var(--bg0) 78%,transparent);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ln-lbl.dim{color:var(--muted)}
.ln-n.pop{animation:ln-pop .5s cubic-bezier(.3,1.5,.5,1)}
.ln-n.shake{animation:ln-shake .4s}
.ln-err{text-align:center}
#ln-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translate(-50%,12px);max-width:min(92%,360px);padding:10px 16px;border-radius:var(--r-pill);background:var(--ink);color:var(--bg0);font-size:14px;font-weight:600;text-align:center;opacity:0;pointer-events:none;z-index:40;transition:opacity .2s,transform .2s}
#ln-toast.on{opacity:1;transform:translate(-50%,0)}
.ln-ov{position:fixed;inset:0;height:100dvh;z-index:30;display:flex;flex-direction:column;max-width:480px;margin:0 auto;background-color:var(--bg0);background-image:var(--aurora),var(--base);background-attachment:fixed;background-repeat:no-repeat;animation:rise .22s ease-out;overflow:hidden}
.ln-top{display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top)) 14px 8px}
.ln-x{width:44px;height:44px;border-radius:50%;border:1px solid var(--gborder);background:var(--glass2);color:var(--ink);display:grid;place-items:center;font-size:20px;cursor:pointer;flex:none}
.ln-x:focus-visible,.ln-opt:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.ln-bar{flex:1;height:12px;border-radius:99px;background:var(--line);overflow:hidden}
.ln-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .35s ease}
.ln-main{flex:1;min-height:0;overflow:auto;padding:12px 20px 20px;display:flex;flex-direction:column}
.ln-card,.ln-q,.ln-res{margin:auto 0}
.ln-card{display:grid;justify-items:center;text-align:center;gap:12px}
.ln-card h2{margin:0;font-size:24px;line-height:1.25}
.ln-card p{margin:0;font-size:17px;line-height:1.5;max-width:34ch}
.ln-card h2:focus,.ln-q h2:focus,.ln-res h2:focus{outline:none}
.ln-big{width:104px;height:104px;border-radius:32px;display:grid;place-items:center;font-size:54px;color:var(--accent-text);border:1px solid var(--gborder);box-shadow:var(--shadow);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 28%,var(--glass2)),color-mix(in srgb,var(--accent2) 24%,var(--glass2)));animation:ln-pop .45s cubic-bezier(.3,1.4,.5,1)}
.ln-q{display:grid;gap:14px}
.ln-q h2{margin:0;font-size:21px;line-height:1.3}
.ln-opts{display:grid;gap:10px}
.ln-opt{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 14px;border-radius:18px;border:2px solid var(--gborder);background:var(--glass2);color:var(--ink);font:inherit;font-weight:600;text-align:left;cursor:pointer;box-shadow:0 3px 0 var(--line)}
.ln-opt .o{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line);font-size:14px;font-weight:800;flex:none}
.ln-opt .o .ln-s{font-size:16px;stroke-width:3}
.ln-opt.ok{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--glass2))}
.ln-opt.ok .o{background:var(--accent);color:var(--on-accent);border-color:transparent}
.ln-opt.bad{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 12%,var(--glass2));animation:ln-shake .4s}
.ln-opt.bad .o{background:var(--bad);color:var(--badge-fg);border-color:transparent}
.ln-opt.dim{opacity:.55}
.ln-foot{padding:12px 20px calc(16px + env(safe-area-inset-bottom));display:grid;gap:10px}
.ln-go{width:100%;min-height:50px;font-size:16px}
.ln-go .ln-s{font-size:18px}
.ln-fb{padding:16px 20px calc(16px + env(safe-area-inset-bottom));display:grid;gap:8px;border-radius:22px 22px 0 0;animation:rise .22s ease-out}
.ln-fb.ok{background:color-mix(in srgb,var(--accent) 20%,var(--bg0))}
.ln-fb.bad{background:color-mix(in srgb,var(--bad) 16%,var(--bg0))}
.ln-fbh{display:flex;align-items:center;gap:8px;font-size:17px}
.ln-fb.ok .ln-fbh{color:var(--accent-text)}
.ln-fb.bad .ln-fbh{color:var(--bad-text)}
.ln-fb p{margin:0;font-size:14px;line-height:1.45}
.ln-res{display:grid;justify-items:center;text-align:center;gap:12px}
.ln-res h2{margin:0;font-size:26px}
.ln-res p{margin:0}
.ln-medal{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;font-size:58px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent);box-shadow:0 10px 30px color-mix(in srgb,var(--accent) 40%,transparent);animation:ln-pop .6s cubic-bezier(.3,1.5,.5,1)}
.ln-medal.chk path{stroke-dasharray:40;stroke-dashoffset:40;animation:ln-draw .6s .3s ease forwards}
.ln-medal.wait{animation:ln-pulse2 1.2s ease-in-out infinite}
.ln-xpg{font-size:40px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--accent-text);line-height:1}
.ln-rs{display:flex;gap:6px;font-size:36px}
.ln-rs span{display:inline-block;animation:ln-pop .5s both}
.ln-rs span:nth-child(2){animation-delay:.15s}
.ln-rs span:nth-child(3){animation-delay:.3s}
.ln-rs .on{color:var(--accent-text)}
.ln-rs .off{color:var(--line)}
.ln-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.ln-chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:99px;background:var(--glass2);border:1px solid var(--gborder);font-weight:700;font-size:14px}
.ln-chip .ln-s{font-size:16px;color:var(--accent-text)}
.ln-lvlup{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--r-panel);text-align:left;border:1px solid var(--gborder);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 24%,var(--glass2)),color-mix(in srgb,var(--accent2) 20%,var(--glass2)))}
.ln-lvlup b{display:block}
.ln-lvlup .ln-bi{width:40px;height:40px;font-size:22px;border-radius:14px}
.ln-conf{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}
.ln-conf i{position:absolute;top:-16px;left:var(--x);width:9px;height:14px;border-radius:2px;background:var(--c);opacity:0;animation:ln-fall var(--d) var(--w) ease-in forwards}
.ln-cf{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.4);padding:20px;z-index:2}
.ln-cfb{width:min(100%,340px);padding:20px;border-radius:var(--r-panel);background:var(--bg0);border:1px solid var(--gborder);box-shadow:var(--shadow);display:grid;gap:10px;text-align:center}
.ln-cfb h2{margin:0;font-size:20px}
.ln-cfb p{margin:0;color:var(--muted)}
.ln-pb-h{display:flex;align-items:center;gap:12px}
.ln-pb-h h2{margin:0;font-size:20px}
.ln-steps{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:14px}
.ln-steps li{display:flex;gap:12px;align-items:flex-start}
.ln-steps b{display:block}
.ln-steps p{margin:2px 0 0;font-size:14px;color:var(--muted)}
.ln-num{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;flex:none;font-weight:800;font-size:14px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on-accent)}
.ln-chk{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:10px}
.ln-chk li{display:flex;gap:10px;align-items:flex-start;font-size:15px}
.ln-chk .ln-s{font-size:20px;color:var(--accent-text);margin-top:1px}
.ln-ib{display:flex;height:22px;border-radius:99px;overflow:hidden;background:var(--line);margin-top:10px}
.ln-ib i{display:block;height:100%;border-right:2px solid var(--bg0)}
.ln-ib i:last-child{border-right:0}
.ln-leg{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px}
.ln-leg li{display:flex;align-items:center;gap:8px;font-size:14px}
.ln-leg i{width:12px;height:12px;border-radius:50%;flex:none}
.ln-leg span{flex:1}
.ln-leg b{font-variant-numeric:tabular-nums}
@keyframes ln-pulse{0%{transform:scale(.92);opacity:.7}100%{transform:scale(1.3);opacity:0}}
@keyframes ln-pulse2{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes ln-bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-4px)}}
@keyframes ln-pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes ln-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes ln-flick{0%,100%{transform:scale(1) rotate(0)}30%{transform:scale(1.08) rotate(-4deg)}60%{transform:scale(.96) rotate(3deg)}}
@keyframes ln-draw{to{stroke-dashoffset:0}}
@keyframes ln-fall{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:1;transform:translateY(105vh) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){
.ln-ov,.ln-ov *,.ln-path *,.ln-stat *,.ln-n,.ln-bar i,#ln-toast{animation:none!important;transition:none!important}
.ln-n.is-next::after,.ln-conf{display:none}
.ln-medal.chk path{stroke-dasharray:none;stroke-dashoffset:0}
}
`;
    document.head.appendChild(st);
  } catch (e) { console.error(e); }
})();

/* ---- state / data ---- */
const LN = { data: null, err: 0, busy: null, justDone: "", shownXp: null };
const LN_RETRY = 30 * 1000;
const lnTx = (o) => (o && (o[lang] || o.en)) || {};
const lnFailed = () => !!LN.err && Date.now() - LN.err < LN_RETRY;
const lnReduced = () => { try { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const lnRepaint = () => { try { if (typeof ivPaint === "function") ivPaint(); } catch (e) { console.error(e); } };

function lnLoad(force) {
  if (LN.busy) return LN.busy;
  if (LN.data && !force) return Promise.resolve(LN.data);
  LN.busy = api("/learn").then((d) => {
    if (!d || !d.course || !Array.isArray(d.course.levels) || !d.progress) throw new Error("bad learn");
    LN.data = d; LN.err = 0; return d;
  }).catch((e) => { console.error(e); LN.err = Date.now(); return LN.data; }).then((v) => { LN.busy = null; return v; });
  return LN.busy;
}
function lnEnsure() {
  if (!LN.data && !lnFailed()) lnLoad().then(() => lnRepaint());
}

/* derived model: per-level lesson states (done | open | locked) */
function lnModel() {
  const d = LN.data, P = d.progress || {}, done = P.completed || {}, unl = Array.isArray(P.unlocked_levels) ? P.unlocked_levels : [];
  const levels = d.course.levels.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  let first = null;
  const Ls = levels.map((lv, li) => {
    const open = li === 0 || unl.includes(lv.id), ls = Array.isArray(lv.lessons) ? lv.lessons : [];
    let cnt = 0;
    const items = ls.map((l, i) => {
      const dn = !!done[l.id];
      if (dn) cnt++;
      const prevDone = i === 0 || !!done[ls[i - 1].id], st = dn ? "done" : (open && prevDone ? "open" : "locked");
      if (st === "open" && !first) first = l.id;
      return { l, st, c: done[l.id] || null };
    });
    return { lv, li, open, items, cnt, total: ls.length, all: ls.length > 0 && cnt === ls.length };
  });
  let next = first;
  if (P.next_lesson) {
    Ls.forEach((e) => e.items.forEach((it) => { if (it.l.id === P.next_lesson && it.st === "open") next = it.l.id; }));
  }
  return { P, L: Ls, next };
}
function lnFind(m, id) {
  for (const e of m.L) for (const it of e.items) if (it.l.id === id) return { l: it.l, st: it.st, lv: e.lv, e };
  return null;
}
function lnStars(c) {
  const tot = c && +c.total;
  if (!tot) return 3;
  const r = Math.max(0, Math.min(1, c.best != null ? +c.best || 0 : (+c.score || 0) / tot));   // best is already a 0-1 ratio
  return r >= 1 ? 3 : r >= 0.67 ? 2 : 1;
}
const lnStarsHtml = (n, cls) => [1, 2, 3].map((k) => `<span class="${k <= n ? "on" : "off"} ln-fill">${lnIc("star")}</span>`).join("").replace(/^/, cls || "");

function lnCount(el, from, to, ms, pre) {
  pre = pre || "";
  if (lnReduced() || from === to) { el.textContent = pre + to; return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + Math.round(from + (to - from) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = pre + to;
  };
  requestAnimationFrame(step);
}

/* ---- toast ---- */
let lnTm = 0;
function lnToast(msg) {
  let el = document.getElementById("ln-toast");
  if (!el) {
    el = document.createElement("div"); el.id = "ln-toast";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = msg; el.classList.add("on");
  clearTimeout(lnTm); lnTm = setTimeout(() => el.classList.remove("on"), 2400);
}

/* ---- Path tab ---- */
function lnRing(p) {
  const r = 15, c = 2 * Math.PI * r;
  return `<svg class="ln-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" class="t"/><circle cx="20" cy="20" r="${r}" class="v" stroke-dasharray="${(c * Math.min(1, p)).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/></svg>`;
}
function lnHeader(P) {
  const L = ln(), goal = Math.max(1, +P.daily_goal || 1), today = +P.today_xp || 0, xp = +P.xp || 0, st = +P.streak || 0, hit = today >= goal;
  const shown = LN.shownXp == null ? xp : LN.shownXp;
  return `<section class="ln-strip" role="group" aria-label="${esc(L.statsLbl)}">
    <div class="ln-stat ${st > 0 ? "on" : ""}" aria-label="${esc(L.streakN(st))}"><span class="v"><span class="ln-flame ln-fill">${lnIc("flame")}</span><b>${st}</b></span><span class="tag">${esc(L.streak)}</span></div>
    <div class="ln-stat" aria-label="${esc(xp + " " + L.xp)}"><span class="v"><span class="ln-starc ln-fill">${lnIc("star")}</span><b id="ln-xp" data-to="${xp}">${shown}</b></span><span class="tag">${esc(L.xp)}</span></div>
    <div class="ln-stat" aria-label="${esc(L.goalN(today, goal))}"><span class="v"><span class="ln-rw">${lnRing(today / goal)}${hit ? lnIc("check") : ""}</span><b>${today}/${goal}</b></span><span class="tag">${esc(L.today)}</span></div></section>`;
}
function lnCoach(m) {
  const c = LN.data.coach, L = ln();
  if (!c) return "";
  const txt = lang === "zh" ? c.zh || c.en : c.en || c.zh;
  if (!txt) return "";
  const f = c.lesson ? lnFind(m, c.lesson) : null, can = !!f && f.st !== "locked";
  return `<section class="panel ln-coach"><span class="ln-ctile">${lnIc("sparkles")}</span><div class="grow"><span class="tag">${esc(L.coach)}</span><p>${esc(txt)}</p></div>${can ? `<button type="button" class="btn sm" data-ln="start" data-v="${esc(c.lesson)}">${esc(L.start)}</button>` : ""}</section>`;
}
function lnLevel(m, e) {
  const L = ln(), c = lnTx(e.lv), W = 280, R = 112, CX = 140, OFF = [0, 50, 76, 50, 0, -50, -76, -50];
  const nodes = e.items.map((it) => ({ k: "l", it })).concat([{ k: "b" }]);
  const n = nodes.length, P = (i) => ({ x: CX + OFF[i % 8], y: i * R + R / 2 });
  let segs = "", html = "";
  for (let i = 0; i < n - 1; i++) {
    const a = P(i), b = P(i + 1), d = nodes[i].k === "l" && nodes[i].it.st === "done";
    segs += `<path class="${d ? "d" : ""}" d="M${a.x} ${a.y} C${a.x} ${a.y + R / 2} ${b.x} ${b.y - R / 2} ${b.x} ${b.y}"/>`;
  }
  nodes.forEach((nd, i) => {
    const p = P(i), left = ((p.x / W) * 100).toFixed(2), top = p.y - 32;
    let cls, icon, attrs, label, aria, extra = "", dim = false;
    if (nd.k === "l") {
      const it = nd.it, lt = lnTx(it.l), title = lt.title || String(it.l.id), isNext = it.st === "open" && it.l.id === m.next;
      label = title;
      if (it.st === "locked") {
        cls = "is-locked"; icon = "lock"; dim = true;
        attrs = `data-ln="locked" data-v="${e.open ? "prev" : "lvl:" + e.li}" aria-disabled="true"`; aria = L.nLocked(title);
      } else if (it.st === "done") {
        const s = lnStars(it.c);
        cls = "is-done"; icon = "check"; attrs = `data-ln="start" data-v="${esc(it.l.id)}"`; aria = L.nDone(title, s);
        extra = `<span class="ln-nst" aria-hidden="true">${lnStarsHtml(s)}</span>`;
      } else {
        cls = isNext ? "is-next" : "is-open"; icon = ICONS[it.l.icon] ? it.l.icon : "book";
        attrs = `data-ln="start" data-v="${esc(it.l.id)}"`; aria = L.nNext(title);
        if (isNext) extra = `<span class="ln-bub" aria-hidden="true">${esc(L.start)}</span>`;
      }
      if (it.l.id === LN.justDone) cls += " pop";
    } else {
      label = L.playbook;
      if (e.all) { cls = "is-book"; icon = "book"; attrs = `data-ln="playbook" data-v="${esc(e.lv.id)}"`; aria = L.nBook; }
      else { cls = "is-book is-locked"; icon = "lock"; dim = true; attrs = `data-ln="locked" data-v="book" aria-disabled="true"`; aria = L.nLocked(L.playbook); }
    }
    html += `<div class="ln-nw" style="left:${left}%;top:${top}px"><div class="ln-nb"><button type="button" class="ln-n ${cls}" ${attrs} aria-label="${esc(aria)}">${lnIc(icon, "book")}</button>${extra}</div><span class="ln-lbl${dim ? " dim" : ""}">${esc(label)}</span></div>`;
  });
  const lockedSub = e.open ? esc(c.subtitle || "") : esc(L.locked(e.li));
  return `<section class="ln-level" aria-label="${esc(c.title || "")}">
    <header class="ln-banner${e.open ? "" : " is-locked"}"><span class="ln-bi">${lnIc(e.lv.icon, "seed")}</span><div class="grow"><span class="tag">${esc(L.lvlN(e.lv.order || e.li + 1))}</span><h2>${esc(c.title || "")}</h2><p class="muted">${lockedSub}</p></div>
    ${e.open ? `<span class="ln-cnt" aria-label="${esc(L.cnt(e.cnt, e.total))}">${esc(L.cnt(e.cnt, e.total))}</span>` : `<span class="ln-cnt">${lnIc("lock")}</span>`}</header>
    <div class="ln-path" role="group" aria-label="${esc(L.pathLbl)}" style="height:${n * R}px"><svg viewBox="0 0 ${W} ${n * R}" preserveAspectRatio="none" aria-hidden="true">${segs}</svg>${html}</div></section>`;
}
function lnErr(act) {
  const L = ln();
  return `<section class="panel ln-err stack" role="alert"><p>${esc(L.err)}</p><div><button type="button" class="btn" data-ln="${act || "retry"}">${esc(L.retry)}</button></div></section>`;
}
const lnSkel = () => (typeof ivSkel === "function" ? ivSkel(3) : "");
function lnFoot() {
  const L = ln();
  return `<details class="more"><summary>${esc(L.demo)}</summary><button type="button" class="btn ghost sm" data-ln="reset">${esc(L.reset)}</button></details><p class="disclaimer">${esc(L.edu)}</p>`;
}
function lnPathBody() {
  try {
    if (!LN.data) return lnFailed() ? lnErr() : lnSkel();
    const m = lnModel();
    requestAnimationFrame(lnAfterPaint);
    return lnHeader(m.P) + lnCoach(m) + m.L.map((e) => lnLevel(m, e)).join("") + lnFoot();
  } catch (e) { console.error(e); return lnErr(); }
}
function lnAfterPaint() {
  try {
    const el = document.getElementById("ln-xp");
    if (el) {
      const to = +el.dataset.to || 0, from = LN.shownXp == null ? to : LN.shownXp;
      LN.shownXp = to;
      if (from !== to) lnCount(el, from, to, 700);
    }
    LN.justDone = "";
  } catch (e) { console.error(e); }
}

/* ---- Lesson player ---- */
let PL = null, lnPrevOverflow = "";

function lnBuildSteps(l) {
  const c = lnTx(l), steps = [];
  (Array.isArray(c.cards) ? c.cards : []).forEach((cd) => steps.push({ k: "card", h: cd && cd.h, p: cd && cd.p }));
  (Array.isArray(l.quiz) ? l.quiz : []).forEach((q) => { if (q && Array.isArray(q.options) && q.options.length) steps.push({ k: "q", q }); });
  return steps;
}
function lnOpen(id) {
  if (!LN.data) return;
  const m = lnModel(), f = lnFind(m, id);
  if (!f || f.st === "locked") return;
  const steps = lnBuildSteps(f.l);
  if (!steps.length) return;
  lnClosePlayer(true);
  PL = {
    id: f.l.id, lv: f.lv, l: f.l, steps, i: 0, correct: 0, sel: null, phase: "play", res: null, confirm: false,
    nq: steps.filter((s) => s.k === "q").length, nc: steps.filter((s) => s.k === "card").length, prev: document.activeElement, tx: 0, ty: 0
  };
  const ov = document.createElement("div");
  ov.id = "ln-player"; ov.className = "ln-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  document.body.appendChild(ov);
  lnPrevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
  ov.addEventListener("click", lnPlClick);
  ov.addEventListener("touchstart", (e) => { const t0 = e.touches && e.touches[0]; if (t0 && PL) { PL.tx = t0.clientX; PL.ty = t0.clientY; } }, { passive: true });
  ov.addEventListener("touchend", (e) => {
    const t0 = e.changedTouches && e.changedTouches[0];
    if (!t0 || !PL || PL.phase !== "play" || PL.confirm) return;
    const dx = t0.clientX - PL.tx, dy = t0.clientY - PL.ty, s = PL.steps[PL.i];
    if (!s || s.k !== "card" || Math.abs(dy) > 40 || Math.abs(dx) < 60) return;
    if (dx < 0) plAdvance(); else if (PL.i > 0) { PL.i--; plRender(); }
  }, { passive: true });
  document.addEventListener("keydown", lnKey);
  plRender();
}
function lnClosePlayer(silent) {
  const ov = document.getElementById("ln-player");
  if (ov) ov.remove();
  document.removeEventListener("keydown", lnKey);
  if (PL) { document.body.style.overflow = lnPrevOverflow; }
  const prev = PL && PL.prev;
  PL = null;
  if (!silent) {
    lnRepaint();
    try { if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
}
function plRequestClose() {
  if (!PL) return;
  if (PL.confirm) { PL.confirm = false; plRender(); return; }
  if (PL.phase === "play" && (PL.i > 0 || PL.sel !== null)) { PL.confirm = true; plRender(); return; }
  lnClosePlayer();
}
function lnKey(e) {
  if (!PL) return;
  if (e.key === "Escape") { e.preventDefault(); plRequestClose(); return; }
  if (e.key !== "Tab") return;
  const ov = document.getElementById("ln-player");
  if (!ov) return;
  const root = ov.querySelector(".ln-cfb") || ov;
  const f = [...root.querySelectorAll("button:not([disabled]),[href],[tabindex='0']")].filter((x) => x.offsetParent !== null || x === document.activeElement);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1], a = document.activeElement;
  if (!root.contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
}
function plAnswer(k) {
  if (!PL || PL.phase !== "play" || PL.sel !== null) return;
  const s = PL.steps[PL.i];
  if (!s || s.k !== "q" || !(k >= 0 && k < s.q.options.length)) return;
  PL.sel = k;
  if (k === s.q.answer) { PL.correct++; try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { /* ignore */ } }
  plRender();
}
function plAdvance() {
  if (!PL || PL.phase !== "play") return;
  const s = PL.steps[PL.i];
  if (s && s.k === "q" && PL.sel === null) return;
  PL.sel = null; PL.i++;
  if (PL.i >= PL.steps.length) { PL.i = PL.steps.length - 1; plFinish(); return; }
  plRender();
}
async function plFinish() {
  const cur = PL;
  if (!cur) return;
  cur.phase = "saving"; plRender();
  try {
    const r = await api("/learn/complete", { lesson_id: cur.id, correct: cur.correct, total: cur.nq });
    if (!r || r.ok === false) throw new Error("complete failed");
    LN.justDone = cur.id;
    await lnLoad(true);
    if (PL !== cur) { lnRepaint(); return; }
    cur.res = r; cur.phase = "result"; plRender();
  } catch (e) {
    console.error(e);
    if (PL === cur) { cur.phase = "fail"; plRender(); }
  }
}
function plLvTitle(id) {
  const lv = LN.data && LN.data.course.levels.find((x) => x.id === id);
  return lv ? { t: lnTx(lv).title || "", icon: lv.icon } : { t: "", icon: "seed" };
}
function plConfetti() {
  const cols = ["var(--accent)", "var(--accent2)", "var(--slate)", "var(--ink)"];
  let h = "";
  for (let i = 0; i < 34; i++) {
    h += `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(1.8 + Math.random() * 1.6).toFixed(2)}s;--w:${(Math.random() * 0.7).toFixed(2)}s;--r:${Math.round(180 + Math.random() * 540)}deg;--c:${cols[i % cols.length]}"></i>`;
  }
  return `<div class="ln-conf" aria-hidden="true">${h}</div>`;
}
function plRender() {
  const ov = document.getElementById("ln-player");
  if (!ov || !PL) return;
  const L = ln(), n = PL.steps.length, lt = lnTx(PL.l);
  let body = "", foot = "", pct = 0, focus = "#ln-h", after = null;
  ov.setAttribute("aria-label", lt.title || "");
  if (PL.phase === "play") {
    const s = PL.steps[PL.i];
    if (s.k === "card") {
      const ci = PL.steps.slice(0, PL.i + 1).filter((x) => x.k === "card").length;
      pct = (PL.i / n) * 100;
      body = `<div class="ln-card"><span class="ln-big">${lnIc(PL.l.icon, "book")}</span><span class="tag">${esc(L.card(ci, PL.nc))}</span><h2 id="ln-h" tabindex="-1">${esc(s.h)}</h2><p>${esc(s.p)}</p></div>`;
      foot = `<div class="ln-foot"><button type="button" class="btn ln-go" data-pl="next">${esc(L.next)}${lnIc("arrow")}</button></div>`;
    } else {
      const q = s.q, qi = PL.steps.slice(0, PL.i + 1).filter((x) => x.k === "q").length, ans = PL.sel !== null, right = ans && PL.sel === q.answer;
      pct = ((PL.i + (ans ? 1 : 0)) / n) * 100;
      const opts = q.options.map((o, k) => {
        let cls = "", mark = String.fromCharCode(65 + (k % 26));
        if (ans) {
          if (k === q.answer) { cls = "ok"; mark = lnIc("check"); }
          else if (k === PL.sel) { cls = "bad"; mark = lnIc("x"); }
          else cls = "dim";
        }
        return `<button type="button" class="ln-opt ${cls}" data-pl="opt" data-v="${k}"${ans ? ' aria-disabled="true"' : ""}><span class="o">${mark}</span><span>${esc(o[lang] || o.en || "")}</span></button>`;
      }).join("");
      body = `<div class="ln-q"><span class="tag">${esc(L.q(qi, PL.nq))}</span><h2 id="ln-h" tabindex="-1">${esc((q.q && (q.q[lang] || q.q.en)) || "")}</h2><div class="ln-opts" role="group" aria-labelledby="ln-h">${opts}</div></div>`;
      if (ans) {
        const why = q.why && (q.why[lang] || q.why.en);
        foot = `<div class="ln-fb ${right ? "ok" : "bad"}" role="status"><div class="ln-fbh">${lnIc(right ? "check" : "x")}<b>${esc(right ? L.correct : L.wrong)}</b></div>${why ? `<p>${esc(why)}</p>` : ""}<button type="button" class="btn ln-go" data-pl="cont">${esc(L.cont)}</button></div>`;
        focus = ".ln-fb .btn";
      }
    }
  } else if (PL.phase === "saving") {
    pct = 100;
    body = `<div class="ln-res"><span class="ln-medal wait">${lnIc("top")}</span><h2 id="ln-h" tabindex="-1">${esc(L.lessonDone)}</h2><p class="muted" role="status">${esc(L.saving)}</p></div>`;
  } else if (PL.phase === "fail") {
    pct = 100;
    body = `<div class="ln-res"><span class="ln-medal">${lnIc("top")}</span><h2 id="ln-h" tabindex="-1">${esc(L.lessonDone)}</h2><p class="muted">${esc(L.score(PL.correct, PL.nq))}</p><p role="alert">${esc(L.saveFail)}</p></div>`;
    foot = `<div class="ln-foot"><button type="button" class="btn ln-go" data-pl="retry">${esc(L.retry)}</button><button type="button" class="btn ghost ln-go" data-pl="finish">${esc(L.close)}</button></div>`;
  } else {
    pct = 100;
    const r = PL.res || {}, gain = +r.xp_gained || 0, up = r.level_up || "", lvi = up ? plLvTitle(up) : null, st = +r.streak || 0, goal = Math.max(1, +(LN.data.progress.daily_goal) || 1), today = +r.today_xp || 0;
    const stars = PL.nq ? (PL.correct >= PL.nq ? 3 : PL.correct / PL.nq >= 0.67 ? 2 : 1) : 3;
    const m = lnModel(), done = !!(LN.data.progress.completed || {})[PL.id], nid = done && m.next && m.next !== PL.id ? m.next : "";
    body = `${up ? plConfetti() : ""}<div class="ln-res"><span class="ln-medal chk">${lnIc(up ? "top" : "check")}</span>
      <h2 id="ln-h" tabindex="-1">${esc(up ? L.levelUp : L.lessonDone)}</h2><p class="muted">${esc(L.score(PL.correct, PL.nq))}</p>
      <div class="ln-xpg" aria-label="${esc("+" + gain + " " + L.xp)}"><span id="ln-gain" data-to="${gain}">+0</span> ${esc(L.xp)}</div>
      <div class="ln-rs" role="img" aria-label="${esc(L.stars(stars))}">${lnStarsHtml(stars)}</div>
      <div class="ln-chips"><span class="ln-chip ln-fill">${lnIc("flame")}${esc(L.streakN(st))}</span><span class="ln-chip">${lnIc("bolt")}${esc(today + "/" + goal)}</span></div>
      ${r.daily_goal_hit ? `<div class="ln-chips"><span class="ln-chip">${lnIc("check")}${esc(L.goalHit)}</span></div>` : ""}
      ${lvi ? `<div class="ln-lvlup"><span class="ln-bi">${lnIc(lvi.icon, "seed")}</span><div><b>${esc(L.levelUp)}</b><span class="muted">${esc(L.unlocked(lvi.t))}</span></div></div>` : ""}</div>`;
    foot = `<div class="ln-foot">${nid ? `<button type="button" class="btn ln-go" data-pl="nextlesson" data-v="${esc(nid)}">${esc(L.nextLesson)}${lnIc("arrow")}</button>` : ""}<button type="button" class="btn ${nid ? "ghost " : ""}ln-go" data-pl="finish">${esc(L.finish)}</button></div>`;
    after = () => { const g = document.getElementById("ln-gain"); if (g) lnCount(g, 0, gain, 900, "+"); };
  }
  const confirm = PL.confirm ? `<div class="ln-cf"><div class="ln-cfb" role="alertdialog" aria-modal="true" aria-labelledby="ln-cfh"><h2 id="ln-cfh">${esc(L.leaveQ)}</h2><p>${esc(L.leaveSub)}</p><button type="button" class="btn ln-go" data-pl="stay">${esc(L.stay)}</button><button type="button" class="btn ghost ln-go" data-pl="leave">${esc(L.leave)}</button></div></div>` : "";
  ov.innerHTML = `<div class="ln-top"><button type="button" class="ln-x" data-pl="close" aria-label="${esc(L.close)}">${lnIc("x")}</button><div class="ln-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct.toFixed(1)}%"></i></div></div><div class="ln-main">${body}</div>${foot}${confirm}`;
  if (after) after();
  try {
    const f = PL.confirm ? ov.querySelector("[data-pl=stay]") : ov.querySelector(focus) || ov.querySelector(".ln-x");
    if (f && f.focus) f.focus({ preventScroll: true });
  } catch (e) { /* ignore */ }
}
function lnPlClick(e) {
  const b = e.target.closest && e.target.closest("[data-pl]");
  if (!b || !PL) return;
  const a = b.dataset.pl;
  if (a === "close") plRequestClose();
  else if (a === "stay") { PL.confirm = false; plRender(); }
  else if (a === "leave" || a === "finish") lnClosePlayer();
  else if (a === "next" || a === "cont") plAdvance();
  else if (a === "opt") plAnswer(+b.dataset.v);
  else if (a === "retry") plFinish();
  else if (a === "nextlesson") {
    const id = b.dataset.v;
    lnClosePlayer(true); lnRepaint(); lnOpen(id);
  }
}
window.addEventListener("hashchange", () => { if (PL) lnClosePlayer(true); });

/* ---- Playbook page (#/invest/playbook/<levelId>) ---- */
function lnIllus(il) {
  const L = ln();
  if (!il || !Array.isArray(il.rows) || !il.rows.length) return "";
  const rows = il.rows.map((r) => ({ name: String((r && r.name) || ""), pct: Math.max(0, +(r && r.pct) || 0) }));
  const sum = rows.reduce((a, r) => a + r.pct, 0);
  if (!sum) return "";
  const PAL = ["var(--accent)", "var(--accent2)", "var(--slate)", "color-mix(in srgb,var(--accent) 45%,var(--bg0))", "color-mix(in srgb,var(--accent2) 45%,var(--bg0))", "color-mix(in srgb,var(--slate) 45%,var(--bg0))"];
  const summary = rows.map((r) => `${r.name} ${Math.round(r.pct)}%`).join(", ");
  return `<section class="panel"><span class="tag">${esc(L.illus)}</span>${il.label ? `<h2 style="margin:4px 0 0">${esc(il.label)}</h2>` : ""}
    <div class="ln-ib" role="img" aria-label="${esc(summary)}">${rows.map((r, k) => `<i style="width:${((r.pct / sum) * 100).toFixed(2)}%;background:${PAL[k % PAL.length]}"></i>`).join("")}</div>
    <ul class="ln-leg">${rows.map((r, k) => `<li><i style="background:${PAL[k % PAL.length]}"></i><span>${esc(r.name)}</span><b>${Math.round(r.pct)}%</b></li>`).join("")}</ul></section>`;
}
function lnPlaybookPage(Sx, r) {
  const L = ln();
  try {
    if (!LN.data) return lnFailed() ? lnErr("retry") : `<div id="iv-body">${lnSkel()}</div>`;
    let id = r && r.b ? r.b : "";
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    const lv = LN.data.course.levels.find((x) => x.id === id), pb = lv && lnTx(lv.playbook);
    if (!lv || !pb || !pb.title) return `<section class="panel empty"><p>${esc(L.pbNone)}</p></section>`;
    const steps = Array.isArray(pb.steps) ? pb.steps : [], chk = Array.isArray(pb.checklist) ? pb.checklist : [];
    return `<section class="panel"><div class="ln-pb-h"><span class="ln-bi">${lnIc(lv.icon, "seed")}</span><div><span class="tag">${esc(L.playbook)}</span><h2>${esc(pb.title)}</h2></div></div>${pb.intro ? `<p style="margin:10px 0 0">${esc(pb.intro)}</p>` : ""}</section>
      ${steps.length ? `<section class="panel"><h2>${esc(L.pbSteps)}</h2><ol class="ln-steps">${steps.map((s, k) => `<li><span class="ln-num">${k + 1}</span><div><b>${esc(s && s.h)}</b>${s && s.p ? `<p>${esc(s.p)}</p>` : ""}</div></li>`).join("")}</ol></section>` : ""}
      ${chk.length ? `<section class="panel"><h2>${esc(L.pbAsk)}</h2><ul class="ln-chk">${chk.map((x) => `<li>${lnIc("check")}<span>${esc(x)}</span></li>`).join("")}</ul></section>` : ""}
      ${lnIllus(pb.illustration)}<p class="disclaimer">${esc(L.edu)}</p>`;
  } catch (e) { console.error(e); return lnErr("retry"); }
}

/* ---- page actions ---- */
async function lnAct(a, v, el) {
  const L = ln();
  if (a === "retry") {
    LN.err = 0; lnRepaint();
    await lnLoad(true);
    lnRepaint();
    const c = parse();
    if (c.name === "invest" && c.a === "playbook") render();
  } else if (a === "start") lnOpen(v);
  else if (a === "locked") {
    if (el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
    const k = String(v || "");
    lnToast(k === "book" ? L.lockBook : k.indexOf("lvl:") === 0 ? L.lockLevel(+k.slice(4) || 1) : L.lockPrev);
  } else if (a === "playbook") go("#/invest/playbook/" + encodeURIComponent(v));
  else if (a === "reset") {
    try {
      await api("/learn/reset", {});
      LN.shownXp = null; LN.justDone = "";
      await lnLoad(true);
      lnRepaint(); lnToast(L.resetDone);
    } catch (e) { console.error(e); lnToast(L.err); }
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-ln]");
  if (!b) return;
  lnAct(b.dataset.ln, b.dataset.v, b).catch((er) => console.error(er));
});
EXT.after.push((r) => {
  try {
    if (!r || r.name !== "invest" || r.a !== "playbook") return;
    if (!LN.data && !lnFailed()) lnLoad().then(() => { const c = parse(); if (c.name === "invest" && c.a === "playbook") render(); });
  } catch (e) { console.error(e); }
});
