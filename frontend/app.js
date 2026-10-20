"use strict";
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
/* --lan mode: the server prints http://IP:8000/?t=TOKEN. Keep the token for this tab only and strip it from the URL. */
const TOKEN = (() => {
  try {
    const u = new URL(location.href), q = u.searchParams.get("t");
    if (q) { sessionStorage.setItem("tok", q); u.searchParams.delete("t"); history.replaceState(null, "", u.pathname + u.search + u.hash); }
    return sessionStorage.getItem("tok") || "";
  } catch { return ""; }
})();

/* ================= i18n ================= */
const CATS = ["food_drink", "groceries", "transport", "housing", "subscriptions", "shopping", "health", "entertainment", "transfers", "income", "other"];
const CAT_COLOR = { food_drink: "--accent", groceries: "--accent", transport: "--accent", housing: "--slate", subscriptions: "--accent", shopping: "--accent", health: "--accent", entertainment: "--accent", transfers: "--slate", income: "--accent", other: "--slate" };
const TXT = {
  en: {
    home: "Home", history: "History", imp: "Import", goals: "Goals", profile: "Profile", review: "Needs a look", top: "Leaderboard", invest: "Invest", goal: "Goal", newGoal: "New goal", editGoal: "Edit goal",
    canSpend: "You can spend today", perDay: "/ day", daysLeft: (n) => `${n} days to payday`, dayOf: (a, b) => `Day ${a} of ${b}`,
    ok: "On pace", tight: "Spending a bit fast", over: "Over budget",
    legend: ["Under target", "Over target", "Today"],
    confirmT: (n) => `${n} to check`, confirmSub: "Your answers are remembered.", which: "Which category?", whatWas: "What was it?",
    unsure: (n) => `${n} unsure`, questions: (n) => `${n} questions`, nothingConfirm: "All clear.", openList: "Review",
    whyQ: "Why?", moreQ: "Details", confirmHow: "A new shop, a big amount, or money sent to a person. Your answer is remembered.",
    reasons: { new: "New shop.", unsure: "Category unclear.", unusual: "Unusual amount.", large: "Big for your income.", person: "Money to a person.", unclear: "Hard to read.", income_big: "Big amount from a person." },
    qCat: "Which category?", qAsk: "What was it for?", qIn: "What is it?", ignore: "Not spending",
    pHint: { purchase: "Bought something", gift: "Gift or red packet", loan: "Lent, expect it back", split: "Paid a group bill", self: "Not spending", income: "Salary or refund", repay: "Friend paid me back" },
    uploadT: "Upload statement", uploadSub: "WeChat Pay or bank CSV, or a photo.",
    profileT: "Profile", nickname: "Nickname", email: "Email", phone: "Phone number", profileNote: "Stored on this device only.", setupProfile: "Set up your profile", setupSub: "Tap the gear to add your details.",
    noGoal: "No goal yet", addGoal: "Add goal", goalOf: (a, b) => `${a} of ${b}`,
    scanT: "Scan receipt", scanSub: "Reads amount, shop and date.", takePhoto: "Take photo", fromGallery: "From gallery", analyzing: "Analyzing…",
    scanDone: (a, m) => `${a} · ${m}. Needs a look.`, scanDemo: "Demo result. No AI key set.", scanErr: "Could not read it. Try a clearer photo.",
    fileT: "Statement file", fileSub: "WeChat Pay or bank CSV.", rawGallery: "JPG, PNG", connectT: "Connect a bank", connectSub: "Needs bank partners.", notify: "Notify me", notified: "Noted. We will tell you.", bankCard: "Bank card",
    changePhoto: "Change photo", removePhoto: "Remove photo", prev: "Previous topic", fCat: "Category", tapHint: "Tap a row for details.",
    lvHigh: "High", lvMid: "Medium", lvLow: "Low",
    why: (cat, p, total) => `${cat}: ${p}% of flexible spending (${total}).`, pace: (proj, save) => `About ${proj} more by payday. Cut 20%, keep ${save}.`, tryT: "Try:",
    tips: { food_drink: "Bring lunch 2 to 3 days a week.", groceries: "Shop from a weekly list.", transport: "Take metro or bus for short trips.", shopping: "Wait 48 hours on non-essentials.", subscriptions: "Cancel what you did not use.", health: "Compare cheaper equivalents first.", entertainment: "One paid activity a week, not three.", other: "Check Other. It may hide a bigger category." },
    keepLabel: "Cut 20%, keep", rowSave: (v) => `+${v}`, settings: "Settings", settingsSub: "Salary, language, theme", statSaved: "Saved in goals", statRecords: "Records", investCardSub: "Short lessons, risk map", doneT: "Goal reached", doneChip: "Completed", doneSub: (n, v) => `You saved ${v} for “${n}”.`, newGoalBtn: "New goal", aiDone: (n) => `“${n}” is done. Next goal?`,
    whatSpent: "Spent on", biggestL: (m, v, d) => `Biggest: ${m} ${v} · ${d}`, seeAllN: (c) => `All ${c} records`, daysLeftShort: (n) => `${n} days left`, ofTarget: (v) => `of ${v}`,
    askAI: "Ask AI", askGoalT: "Get there faster", askGoalSub: "A short plan from your spending.",
    qGoal: (n) => `Reach “${n}” faster?`, qSave: "Where can I save?", qBudget: "My budget today?",
    aiNoGoal: "Set a goal first.", aiGoalT: (n) => `Plan for “${n}”`, aiCut: (c) => `Cut ${c} by 20%`, aiWeekly: (v) => `Put aside ${v} every week`,
    aiFriends: (n, v) => `Invite ${n} friends (${v} each)`, perMo: " / mo",
    aiEta: (d, n) => `Done by ${d}${n > 0 ? ` · ${n} days sooner` : ""}`, aiEtaNone: "Needs more time. Try a later deadline.",
    aiOn: " On track.", aiOff: " Still tight. Move the deadline?",
    aiSaveT: "Quick wins", aiTotal: (v) => `About ${v} / mo`, aiGoalEffect: (n, d) => (d > 0 ? `“${n}” ${d} days sooner.` : `Helps “${n}”.`),
    aiBudgetT: "Today", aiBudget: (a, s) => `About ${a} a day. ${s}.`, aiBudgetTip: (c) => `Trim ${c} first.`,
    aiDemo: "Demo", openGoal: "Open goal", seeSave: "Where to save", askGoal: "Goal plan", addGoalShort: "Add goal",
    inviteT: "Save together", inviteSub: "Reach it sooner with friends.", inviteBtn: "Invite friends", linkCopied: "Invite link copied", inviteText: (n) => `Join my goal “${n}” and let's save together!`,
    demoFriends: "Demo friends", joined: "Joined", fWith: (v) => `Friends add ~${v} / mo`, perMonth: "per month",
    adviceT: "Where to save", adviceSub: "Cut the biggest slices 20% to reach goals sooner.",
    shareOf: "of your flexible spending", cut: (v) => `Cut 20% · save ${v}`, sooner: (n) => `goal ${n} day${n === 1 ? "" : "s"} sooner`,
    allHistory: "All transactions", allHistorySub: "Filter by date and category",
    flt: { year: "Year", month: "Month", day: "Day", allY: "Year", allM: "Month", allD: "Day", cat: "All categories", all: "All", spent: "Spent", earned: "Income", search: "Search merchant" },
    totals: (o, i, n) => `Spent ${o} · Income ${i} · ${n} records`, noTx: "No matching records.", loading: "Loading…",
    addGoalBtn: "New goal", saved: "Saved", remaining: "Left to save", monthly: "Needed per month", deadline: "Deadline", projected: "Projected finish", noProj: "Off pace",
    cdMonths: "months", cdWeeks: "weeks", cdDays: "days", overdue: "Deadline passed", milestones: "Milestones",
    st: { ahead: "Ahead of plan", on_track: "On track", behind: "Behind plan" }, deposit: "Add to savings", depositBtn: "Add", amount: "Amount (¥)",
    edit: "Edit", del: "Delete goal", delGoalConfirm: "Delete this goal?", save: "Save", goalName: "Goal name", target: "Target (¥)", savedSoFar: "Saved so far (¥)", deadlineL: "Deadline", notFound: "Not found.",
    goalsEmpty: "No goals yet. Tap +.", reserve: (v) => `Goals reserve ${v} / mo`,
    investIntro: "Explanations only. Nothing here tells you to buy a product.", free: (v) => `Free this cycle: ${v}`, noFree: "Nothing free yet. Keep to your daily limit.",
    topics: "Topics", minRead: (n) => `${n} min`, riskMap: "Risk map", riskMapSub: "General ideas, not advice.",
    lvl: ["Very low", "Low", "Medium", "High", "Very high"],
    assets: { deposit: ["Savings & money-market", "Under 1 year"], bonds: ["High-grade bonds", "1 to 3 years"], index: ["Broad index funds", "5+ years"], stocks: ["Single stocks", "5+ years, volatile"], crypto: ["Crypto & speculation", "Only spare money"] },
    takeaway: "Key idea", yourNumbers: "Your numbers", cushionNums: (a, b) => `3 to 6 months: ${a} to ${b}.`, next: "Next topic",
    notAdvice: "Educational only. Not investment advice.", calcMonthly: "Per month (¥)", calcYears: "Years", calcIn: (v) => `You put in ${v}`, calcNote: "Example rates, not a forecast.",
    rankOf: (n, m) => `of ${m}`, saidRate: (p) => `${p}% of income saved`, toPass: (nm, p) => `${p}% more to pass ${nm}`, leading: "You lead.", topT: "Savings leaderboard", topSub: "Ranked by % of income saved. Friends are demo.", you: "You",
    name: "Your name", namePh: "Name", income: "Monthly income (¥)", payday: "Payday (day of month)", salary: "Salary and payday", lang: "Language", theme: "Theme", themeA: "Auto", themeL: "Light", themeD: "Dark",
    privacy: "Your data", delAll: "Delete my data", delConfirm: "Delete all your data?", deleted: "Deleted.", saved_ok: "Saved.",
    autoImp: "Bank auto-import", autoImpSub: "Needs bank partners.",
    importT: "Import statement", importSub: "WeChat Pay CSV.", pick: "CSV file", loadDemo: "Load demo data",
    report: (r) => `${r.imported} imported · ${r.duplicates} duplicates · ${r.digest + r.ask} to check`,
    emptyTitle: "Start with a statement", emptySub: "Try it with sample data.",
    asst: "County", asstSub: "Log a spend or ask", hello: "Tell me what you spent. Try: Luckin 18.", placeholder: "Luckin 18, lunch 35…", send: "Send",
    recorded: (a, m) => `Recorded ${a} · ${m}`, digest: (a, m) => `Recorded ${a} · ${m}. Please confirm.`,
    askT: (a, m) => `${a} to ${m}. What was this?`, unknown: "No amount found. Try: Luckin 18.", dup: "Already recorded.", gotIt: "Got it.",
    listening: "Listening…", noVoice: "Voice is not supported here. Try Chrome or Safari.", micDenied: "Mic blocked. Allow it in browser settings.",
    p: { purchase: "Purchase", gift: "Gift", loan: "Loan to friend", split: "Split bill", self: "My own account", income: "Income", repay: "Repayment" },
    confirm: "Confirm", err: "Something went wrong. Try again.",
    back: "Back", close: "Close", voice: "Voice input", msgL: "Message", chips: ["Luckin 18", "lunch 35", "transfer Li 500", "Reach my goal faster?"], needsCheck: "Needs check", delShort: "Delete", retry: "Retry", noted: "Noted",
    importEmpty: "No records found. Use a WeChat Pay or bank CSV.", scanRate: "Wait a few seconds, then retry.",
    cat: { food_drink: "Food & drink", groceries: "Groceries", transport: "Transport", housing: "Housing", subscriptions: "Subscriptions", shopping: "Shopping", health: "Health", entertainment: "Entertainment", transfers: "Transfers", income: "Income", other: "Other" },
  },
  zh: {
    home: "首页", history: "记录", imp: "导入", goals: "目标", profile: "我的", review: "待确认", top: "排行榜", invest: "投资", goal: "目标", newGoal: "新目标", editGoal: "编辑目标",
    canSpend: "今天还能花", perDay: "/ 天", daysLeft: (n) => `距发薪日 ${n} 天`, dayOf: (a, b) => `第 ${a} 天 / 共 ${b} 天`,
    ok: "节奏不错", tight: "花得有点快", over: "已超支",
    legend: ["未超标", "超标", "今天"],
    confirmT: (n) => `${n} 笔待确认`, confirmSub: "你的选择会被记住。", which: "属于哪一类？", whatWas: "这是什么？",
    unsure: (n) => `${n} 笔不确定`, questions: (n) => `${n} 个问题`, nothingConfirm: "全部已确认。", openList: "去确认",
    whyQ: "为什么？", moreQ: "详情", confirmHow: "新商家、大额，或转给个人。你的选择会被记住。",
    reasons: { new: "新商家。", unsure: "类别不确定。", unusual: "金额异常。", large: "相对收入偏大。", person: "转给个人。", unclear: "记录不清晰。", income_big: "个人转入大额。" },
    qCat: "属于哪类？", qAsk: "用来做什么？", qIn: "这是什么？", ignore: "不算支出",
    pHint: { purchase: "买了东西", gift: "礼物或红包", loan: "借出，会还", split: "垫付聚餐/团购", self: "不算支出", income: "工资或退款", repay: "朋友还钱" },
    uploadT: "上传账单", uploadSub: "微信支付或银行 CSV，或照片。",
    profileT: "个人资料", nickname: "昵称", email: "邮箱", phone: "手机号", profileNote: "仅保存在本设备。", setupProfile: "完善个人资料", setupSub: "点右上角齿轮添加资料。",
    noGoal: "还没有目标", addGoal: "添加目标", goalOf: (a, b) => `${a} / ${b}`,
    scanT: "扫描账单", scanSub: "识别金额、商家和日期。", takePhoto: "拍照", fromGallery: "从相册选", analyzing: "识别中…",
    scanDone: (a, m) => `${a} · ${m}，待确认。`, scanDemo: "演示结果，未设置 AI 密钥。", scanErr: "识别失败，请换张更清晰的。",
    fileT: "账单文件", fileSub: "微信支付或银行 CSV。", rawGallery: "JPG、PNG", connectT: "连接银行", connectSub: "需银行合作。", notify: "通知我", notified: "已记录，上线通知你。", bankCard: "银行卡",
    changePhoto: "更换头像", removePhoto: "删除头像", prev: "上一个主题", fCat: "类别", tapHint: "点开每行看详情。",
    lvHigh: "偏高", lvMid: "中等", lvLow: "较低",
    why: (cat, p, total) => `${cat}占灵活支出 ${p}%（${total}）。`, pace: (proj, save) => `到发薪日约再花 ${proj}。减 20% 留 ${save}。`, tryT: "试试：",
    tips: { food_drink: "每周自带午饭 2 到 3 天。", groceries: "按周清单购物。", transport: "短途坐地铁或公交。", shopping: "非必需品等 48 小时。", subscriptions: "取消没用的订阅。", health: "先比较更便宜的同类。", entertainment: "每周只选一项付费活动。", other: "看看“其他”，可能藏着大类。" },
    keepLabel: "各减 20%，可留", rowSave: (v) => `+${v}`, settings: "设置", settingsSub: "工资、语言、主题", statSaved: "目标已存", statRecords: "记录数", investCardSub: "小课程与风险地图", doneT: "目标达成", doneChip: "已完成", doneSub: (n, v) => `你已为“${n}”存够 ${v}。`, newGoalBtn: "新目标", aiDone: (n) => `“${n}”已完成。下一个目标？`,
    whatSpent: "花在哪", biggestL: (m, v, d) => `最大一笔：${m} ${v} · ${d}`, seeAllN: (c) => `全部${c}记录`, daysLeftShort: (n) => `还剩 ${n} 天`, ofTarget: (v) => `目标 ${v}`,
    askAI: "问 AI", askGoalT: "更快达成目标", askGoalSub: "根据你的支出生成简短计划。",
    qGoal: (n) => `怎样更快达成“${n}”？`, qSave: "哪里能省钱？", qBudget: "今天预算如何？",
    aiNoGoal: "先设一个目标。", aiGoalT: (n) => `“${n}”的计划`, aiCut: (c) => `${c}少花 20%`, aiWeekly: (v) => `每周存下 ${v}`,
    aiFriends: (n, v) => `邀请 ${n} 位朋友（每人 ${v}）`, perMo: " / 月",
    aiEta: (d, n) => `完成时间：${d}${n > 0 ? ` · 提前 ${n} 天` : ""}`, aiEtaNone: "时间仍不够，可延后截止日期。",
    aiOn: "能按时完成。", aiOff: "仍偏紧，可延后截止日期。",
    aiSaveT: "快速省钱", aiTotal: (v) => `每月约 ${v}`, aiGoalEffect: (n, d) => (d > 0 ? `“${n}”提前 ${d} 天。` : `对“${n}”有帮助。`),
    aiBudgetT: "今天", aiBudget: (a, s) => `今天约可花 ${a}。${s}。`, aiBudgetTip: (c) => `先从${c}省起。`,
    aiDemo: "演示", openGoal: "打开目标", seeSave: "可以省在哪", askGoal: "目标计划", addGoalShort: "添加目标",
    inviteT: "一起存", inviteSub: "和朋友一起更快达成。", inviteBtn: "邀请朋友", linkCopied: "邀请链接已复制", inviteText: (n) => `加入我的目标“${n}”，我们一起存钱吧！`,
    demoFriends: "示例好友", joined: "已加入", fWith: (v) => `朋友每月约存 ${v}`, perMonth: "每月",
    adviceT: "可以省在哪", adviceSub: "最大几项各减 20%，目标更快达成。",
    shareOf: "占灵活支出", cut: (v) => `减少 20% · 省 ${v}`, sooner: (n) => `目标提前 ${n} 天`,
    allHistory: "全部记录", allHistorySub: "按日期和类别筛选",
    flt: { year: "年", month: "月", day: "日", allY: "年", allM: "月", allD: "日", cat: "全部类别", all: "全部", spent: "支出", earned: "收入", search: "搜索商家" },
    totals: (o, i, n) => `支出 ${o} · 收入 ${i} · ${n} 条`, noTx: "没有匹配的记录。", loading: "加载中…",
    addGoalBtn: "新目标", saved: "已存", remaining: "还差", monthly: "每月需存", deadline: "截止日期", projected: "预计完成", noProj: "进度偏慢",
    cdMonths: "个月", cdWeeks: "周", cdDays: "天", overdue: "已过截止日期", milestones: "里程碑",
    st: { ahead: "领先计划", on_track: "按计划进行", behind: "落后于计划" }, deposit: "存入目标", depositBtn: "存入", amount: "金额（¥）",
    edit: "编辑", del: "删除目标", delGoalConfirm: "确定删除这个目标？", save: "保存", goalName: "目标名称", target: "目标金额（¥）", savedSoFar: "已存（¥）", deadlineL: "截止日期", notFound: "未找到。",
    goalsEmpty: "还没有目标，点 + 添加。", reserve: (v) => `目标每月预留 ${v}`,
    investIntro: "仅为讲解，不推荐购买任何产品。", free: (v) => `本周期可支配：${v}`, noFree: "暂无结余，先守住每日额度。",
    topics: "主题", minRead: (n) => `${n} 分钟`, riskMap: "风险地图", riskMapSub: "一般性介绍，不构成建议。",
    lvl: ["很低", "低", "中", "高", "很高"],
    assets: { deposit: ["储蓄与货币基金", "1 年以内"], bonds: ["高评级债券", "1 到 3 年"], index: ["宽基指数基金", "5 年以上"], stocks: ["个股", "5 年以上，波动大"], crypto: ["加密货币与投机", "只用闲钱"] },
    takeaway: "要点", yourNumbers: "你的数据", cushionNums: (a, b) => `3 到 6 个月：${a} 到 ${b}。`, next: "下一个主题",
    notAdvice: "仅供学习，不构成投资建议。", calcMonthly: "每月存入（¥）", calcYears: "年数", calcIn: (v) => `你投入 ${v}`, calcNote: "示例利率，非预测。",
    rankOf: (n, m) => `/ ${m}`, saidRate: (p) => `储蓄了收入的 ${p}%`, toPass: (nm, p) => `再多存 ${p}% 就能超过 ${nm}`, leading: "你领先。", topT: "储蓄排行榜", topSub: "按储蓄占收入比例排名。好友为示例。", you: "你",
    name: "你的名字", namePh: "名字", income: "月收入（¥）", payday: "发薪日（每月几号）", salary: "工资与发薪日", lang: "语言", theme: "主题", themeA: "自动", themeL: "浅色", themeD: "深色",
    privacy: "你的数据", delAll: "删除我的数据", delConfirm: "确定删除所有数据？", deleted: "已删除。", saved_ok: "已保存。",
    autoImp: "银行自动导入", autoImpSub: "需银行合作。",
    importT: "导入账单", importSub: "微信支付 CSV。", pick: "CSV 文件", loadDemo: "加载示例数据",
    report: (r) => `导入 ${r.imported} · 重复 ${r.duplicates} · 待确认 ${r.digest + r.ask}`,
    emptyTitle: "先导入账单", emptySub: "用示例数据体验。",
    asst: "County 助手", asstSub: "记一笔或提问", hello: "告诉我你花了什么，如：瑞幸 18。", placeholder: "瑞幸 18、午饭 35…", send: "发送",
    recorded: (a, m) => `已记录 ${a} · ${m}`, digest: (a, m) => `已记录 ${a} · ${m}，请确认。`,
    askT: (a, m) => `转给 ${m} ${a}，这笔钱是做什么的？`, unknown: "没找到金额，试试：瑞幸 18。", dup: "已记录过。", gotIt: "好的。",
    listening: "正在听…", noVoice: "不支持语音，请用 Chrome 或 Safari。", micDenied: "麦克风被拒绝，请在浏览器设置中允许。",
    p: { purchase: "买东西", gift: "礼物/红包", loan: "借给朋友", split: "AA 分摊", self: "我自己的账户", income: "收入", repay: "还款" },
    confirm: "确认", err: "出错了，请重试。",
    back: "返回", close: "关闭", voice: "语音输入", msgL: "消息", chips: ["瑞幸 18", "午饭 35", "转给 浩然 500", "怎样更快达成目标？"], needsCheck: "待确认", delShort: "删除", retry: "重试", noted: "已记录",
    importEmpty: "没读到记录，请用微信支付或银行 CSV。", scanRate: "请稍等几秒再试。",
    cat: { food_drink: "餐饮", groceries: "买菜日用", transport: "交通", housing: "住房", subscriptions: "订阅", shopping: "购物", health: "健康", entertainment: "娱乐", transfers: "转账", income: "收入", other: "其他" },
  },
};
let lang = store.get("lang", (navigator.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en");
const t = () => TXT[lang];
const locale = () => (lang === "zh" ? "zh-CN" : "en-US");

/* ================= helpers ================= */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yuan = (c) => (c < 0 ? "−" : "") + "¥" + Math.round(Math.abs(c) / 100).toLocaleString("en-US");
const yuan2 = (c) => "¥" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const dshort = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(locale(), { month: "short", day: "numeric" });
const dfull = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(locale(), { year: "numeric", month: "short", day: "numeric" });
const col = (v) => `var(${v})`;
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  history: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  imp: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  goals: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  top: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M18 2H6v7a6 6 0 0 0 12 0z"/>',
  invest: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.8l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.8v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6"/>',
  bank: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M12 3 2 8h20z"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 5-4-7-4 7-6-5z"/><path d="M5 20h14"/>',
  c_food_drink: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  c_groceries: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  c_transport: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  c_housing: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  c_subscriptions: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  c_shopping: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  c_health: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  c_entertainment: '<rect x="2" y="2" width="20" height="20" rx="2.2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  c_transfers: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  c_income: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  c_other: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  back: '<path d="m15 18-6-6 6-6"/>', go: '<path d="m9 18 6-6-6-6"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  trenddown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
};
const catIcon = (cat) => ic("c_" + (ICONS["c_" + cat] ? cat : "other"));
/* ---- extension registry: feature files (insights.js, trust.js, bench.js, ...) register here ---- */
const EXT = { routes: {}, homeTop: [], homeBottom: [], profile: [], settings: [], goal: [], history: [], importTop: [], importBottom: [], after: [], chatOpen: [], bankConsent: null };
const ext = (k, ...a) => (EXT[k] || []).map((f) => { try { return f(...a) || ""; } catch (e) { console.error("ext:" + k, e); return ""; } }).join("");
let mname = (m) => m;                    // merchant display name; merchants_zh.js overrides it
let consentOk = async () => true;        // trust.js overrides: consent gate before any data import
const isDone = (g) => g.remaining_cents <= 0;
let gmIndex = 0;
function wireCarousel() {
  const tr = $("#gm-track");
  if (!tr) return;
  const slides = [...tr.children], dots = [...document.querySelectorAll(".gm-dot")];
  const step = () => (slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : tr.clientWidth) || 1;
  gmIndex = Math.min(gmIndex, slides.length - 1);
  tr.style.scrollBehavior = "auto"; tr.scrollLeft = gmIndex * step(); tr.style.scrollBehavior = "";
  const upd = () => { gmIndex = Math.max(0, Math.min(slides.length - 1, Math.round(tr.scrollLeft / step()))); dots.forEach((d, k) => d.setAttribute("aria-current", k === gmIndex)); };
  tr.addEventListener("scroll", upd, { passive: true }); upd();
  dots.forEach((dt) => dt.addEventListener("click", () => tr.scrollTo({ left: +dt.dataset.i * step(), behavior: "smooth" })));
  let down = false, moved = false, sx = 0, sl = 0;
  tr.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = tr.scrollLeft; });
  tr.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 5) { moved = true; tr.classList.add("dragging"); tr.setPointerCapture(e.pointerId); }
    if (moved) tr.scrollLeft = sl - dx;
  });
  const end = () => { if (!down) return; down = false; tr.classList.remove("dragging"); if (moved) tr.scrollTo({ left: Math.round(tr.scrollLeft / step()) * step(), behavior: "smooth" }); };
  tr.addEventListener("pointerup", end); tr.addEventListener("pointercancel", end);
  tr.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
const ic = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

/* auth.js assigns these: handle(err, path) -> Promise<boolean> (true = retry the request once); gate() -> Promise that resolves once signed in */
const authHooks = { handle: null, gate: null };
async function api(path, body, noHooks) {
  const h = {};
  if (TOKEN) h["X-Token"] = TOKEN;
  let opt = { headers: h, credentials: "same-origin" };
  if (body !== undefined) { h["Content-Type"] = "application/json"; opt = { method: "POST", headers: h, body: JSON.stringify(body), credentials: "same-origin" }; }
  const r = await fetch("/api" + path, opt);
  if (!r.ok) {
    let eb = null;
    try { eb = await r.json(); } catch { /* not JSON */ }
    const err = new Error(path + " " + r.status);
    err.status = r.status; err.body = eb;
    if (!noHooks && authHooks.handle) {
      let again = false;
      try { again = await authHooks.handle(err, path); } catch { again = false; }
      if (again) return api(path, body, true);
    }
    throw err;
  }
  return r.json();
}
let S = null;
const refresh = async () => { S = await api("/state"); };
/* refresh state and repaint the current page unless a sheet is covering a page that does not show the data */
async function refreshView() { await refresh(); if ($("#chat").hidden || ["home", "history", "review", "goals"].includes(parse().name)) render(); }

/* ================= routing ================= */
const ROOTS = ["home", "history", "import", "goals", "profile"];
function parse() {
  const p = (location.hash.replace(/^#\/?/, "") || "home").split("/");
  return { name: p[0], a: p[1], b: p[2] };
}
function parentHash(r) {
  if (r.name === "goal") return r.b === "edit" ? `#/goal/${r.a}` : "#/goals";
  if (r.name === "invest" && r.a) return "#/invest";
  if (r.name === "settings") return "#/profile";
  const er = EXT.routes[r.name];
  if (er && er.parent) return typeof er.parent === "function" ? er.parent(r) : er.parent;
  return "#/home";
}
const curHash = () => location.hash || "#/home";
const navStack = [curHash()];   // visited hashes; the last one is the current screen
let navFlag = "";               // set before a programmatic change: "replace" | "sync"
const go = (h) => { if (curHash() === h) render(); else location.hash = h; };
const goReplace = (h) => { if (curHash() === h) { render(); return; } navFlag = "replace"; location.replace(h); };
function goBack() {
  let i = navStack.length - 1;
  while (i >= 0 && navStack[i] === curHash()) i--;
  const target = i >= 0 ? navStack[i] : parentHash(parse());
  if (i >= 0) navStack.length = i + 1; else { navStack.length = 0; navStack.push(target); }
  if (curHash() === target) { render(); return; }
  navFlag = "sync"; location.replace(target);
}
function syncStack() {
  const h = curHash(), f = navFlag; navFlag = "";
  if (f === "sync") return;
  if (f === "replace") { navStack[navStack.length - 1] = h; if (navStack.length > 1 && navStack[navStack.length - 2] === h) navStack.pop(); return; }
  if (navStack[navStack.length - 1] === h) return;
  if (navStack[navStack.length - 2] === h) { navStack.pop(); return; }  // browser back
  navStack.push(h); if (navStack.length > 50) navStack.shift();
}

/* ================= shared components ================= */
function calendar(d) {
  const first = new Date(d.cycle.start + "T00:00:00");
  const pad = (first.getDay() + 6) % 7;
  const cells = Array(pad).fill('<i class="pad"></i>').concat(d.strip.map((s) =>
    `<i class="${s.state}" title="${esc(dshort(s.date) + " · " + yuan(s.spent_cents))}"></i>`));
  const L = t().legend, cnt = (k) => d.strip.filter((x) => x.state === k).length;
  const label = `${t().daysLeft(d.cycle.days_left)}. ${L[0]}: ${cnt("ok")}, ${L[1]}: ${cnt("over")}, ${L[2]}`;
  return `<div class="cal" role="img" aria-label="${esc(label)}">${cells.join("")}</div>`;
}
function ring(p, big, label) {
  const r = 38, c = 2 * Math.PI * r, cls = big ? "ring ring-lg" : "ring";
  return `<svg class="${cls}" viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="${r}" class="trk"/><circle cx="45" cy="45" r="${r}" stroke="var(--accent2)" stroke-linecap="round" stroke-dasharray="${c * Math.min(1, p)} ${c}" transform="rotate(-90 45 45)"/>${label ? `<text x="45" y="52">${label}</text>` : ""}</svg>`;
}
function txRow(x) {
  const inc = x.direction === "in", c = col(CAT_COLOR[x.category] || "--slate");
  return `<div class="tx"><div class="l"><span class="ctile" style="--c:${c}">${catIcon(x.category)}</span><div><div>${esc(mname(x.merchant))}</div><div class="tag">${dshort(x.date)} · ${esc(t().cat[x.category] || x.category)}${x.status === "pending" ? " · " + esc(t().needsCheck) : ""}</div></div></div><div class="amt ${inc ? "in" : ""}">${inc ? "+" : "−"}${yuan2(x.amount_cents)}</div></div>`;
}
const linkCard = (hash, icon, color, title, sub) => `<button class="link" data-go="${hash}"><span class="lead"><span class="tile-ico" style="--c:${col(color)}">${ic(icon)}</span><span><b>${title}</b><br><span class="muted">${sub}</span></span></span>${ic("go")}</button>`;

/* ================= pages ================= */
function pageHome(d) {
  const tx = t();
  if (!d.has_data) return `<section class="panel empty"><h2>${tx.emptyTitle}</h2><p class="muted">${tx.emptySub}</p><button class="btn" data-a="demo">${tx.loadDemo}</button></section>`;
  const n = d.pending.digest + d.pending.ask, g = d.goals.find((x) => !isDone(x)) || d.goals[0];
  const slide = (x) => `<button class="goal-mini" data-go="goal/${x.id}"><span class="gm-head">${ring(x.progress, false, Math.round(x.progress * 100) + "%")}<span class="gm-go">${ic("go")}</span></span>
        <span class="t"><b>${esc(x.name)}</b><span class="gm-amt">${yuan(x.saved_cents)} <small>${tx.ofTarget(yuan(x.target_cents))}</small></span></span>
        <span class="gm-pill">${isDone(x) ? tx.doneChip : x.days_to_deadline >= 0 ? tx.daysLeftShort(x.days_to_deadline) : tx.overdue}</span></button>`;
  const addSlide = `<button class="goal-mini add" data-go="goal/new"><span class="tile-ico" style="--c:var(--accent)">${ic("plus")}</span><span class="t"><b>${tx.addGoal}</b><span class="muted">${tx.noGoal}</span></span></button>`;
  const ordered = d.goals.slice().sort((p, q) => Number(isDone(p)) - Number(isDone(q)));
  const goalBlock = ordered.length
    ? `<div class="gm-wrap"><div class="gm-track multi" id="gm-track" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${tx.goals}">${ordered.map(slide).join("")}${addSlide}</div>
        <div class="gm-dots">${ordered.map((x, i) => `<button type="button" class="gm-dot" data-i="${i}" aria-label="${esc(x.name)}"></button>`).join("")}<button type="button" class="gm-dot" data-i="${ordered.length}" aria-label="${tx.addGoal}"></button></div></div>`
    : addSlide;
  const dateLabel = new Date(d.today + "T00:00:00").toLocaleDateString(locale(), { weekday: "short", month: "short", day: "numeric" });
  const keep = d.advice.reduce((q, a) => q + a.saving_cents, 0), days = d.advice.reduce((q, a) => q + (a.days_faster || 0), 0);
  const adv = d.advice.length ? `<section class="panel"><div class="sec-top"><span class="tile-ico" style="--c:var(--accent)">${ic("sparkles")}</span><h2>${tx.adviceT}</h2><button class="ask-ai" data-a="askai" data-k="save">${ic("sparkles")}${tx.askAI}</button></div><details class="more"><summary>${tx.whyQ}</summary><p>${tx.adviceSub} ${tx.tapHint}</p></details>
    <div class="keep"><span class="muted">${tx.keepLabel}</span><b>${yuan(keep)}</b>${days && d.goals.length ? `<span><span class="pill good">${tx.sooner(days)}</span></span>` : ""}</div>
    ${d.advice.map((a) => {
      const p = Math.round(a.share * 100), lv = p >= 35 ? "high" : p >= 20 ? "mid" : "low", name = tx.cat[a.category] || a.category;
      const lvName = lv === "high" ? tx.lvHigh : lv === "mid" ? tx.lvMid : tx.lvLow;
      return `<details class="sv ${lv}"><summary><span class="ctile">${catIcon(a.category)}</span><div><div class="row" style="justify-content:flex-start;gap:0"><b>${esc(name)}</b><span class="lvl ${lv}">${lvName}</span></div><div class="bar"><i style="width:${p}%"></i></div></div><span class="gain">+${yuan(a.saving_cents)}</span><span class="chev">${ic("go")}</span></summary>
        <div class="sv-body"><p>${tx.why(esc(name), p, yuan(a.total_cents))}</p><p>${tx.pace(yuan(a.saving_cents * 5), yuan(a.saving_cents))}</p><div class="tip"><b>${tx.tryT}</b> ${tx.tips[a.category] || tx.tips.other}</div>
          <div class="spent"><div class="flabel">${tx.whatSpent}</div>${(a.merchants || []).map((m) => `<div class="mrow"><span class="nm">${esc(mname(m.merchant))} <span class="tag">×${m.n}</span></span><span class="amt">${yuan(m.total_cents)}</span><div class="bar"><i style="width:${Math.max(6, Math.round((m.total_cents / a.total_cents) * 100))}%"></i></div></div>`).join("")}
            ${a.biggest ? `<p class="note">${esc(tx.biggestL(mname(a.biggest.merchant), yuan(a.biggest.amount_cents), dshort(a.biggest.date)))}</p>` : ""}
            <button class="btn ghost sm" data-a="seecat" data-v="${a.category}">${tx.seeAllN(esc(tx.cat[a.category] || a.category))}</button></div></div></details>`;
    }).join("")}</section>` : "";
  return `
  <section class="hero">
    <div><div class="row"><p class="muted">${tx.canSpend}</p><span class="datepill">${dateLabel}</span></div>
      <div class="big"><span class="num">${yuan(d.allowance_cents)}</span><span class="per">${tx.perDay}</span></div></div>
    <div class="row"><span class="chip ${d.status}">${tx[d.status]}</span><span class="muted">${tx.dayOf(d.cycle.days - d.cycle.days_left + 1, d.cycle.days)}</span></div>
    <div class="duo"><div class="cal-wrap">${calendar(d)}<b>${tx.daysLeft(d.cycle.days_left)}</b><div class="cal-legend" aria-hidden="true"><span><i class="ok"></i>${tx.legend[0]}</span><span><i class="over"></i>${tx.legend[1]}</span><span><i class="today"></i>${tx.legend[2]}</span></div></div>${goalBlock}</div>
  </section>
  ${ext("homeTop", d)}
  ${adv}
  ${linkCard("invest", "invest", "--accent", tx.invest, tx.investCardSub)}
  ${linkCard("history", "history", "--accent", tx.allHistory, tx.allHistorySub)}${ext("homeBottom", d)}`;
}

const picks = {};
function catChips(action, cur, id) {
  const tx = t();
  return `<div class="chips-row" data-row="${id}">${CATS.map((c) => `<button type="button" class="fchip" data-a="${action}" data-id="${id}" data-v="${c}" aria-pressed="${cur === c}">${catIcon(c)}${tx.cat[c]}</button>`).join("")}</div>`;
}
function reviewCard(x) {
  const tx = t(), reason = x.reason || (x.mode === "ask" ? "person" : "new");
  const head = `<div class="row"><div class="pcard"><span class="ctile" style="--c:${col(CAT_COLOR[x.category] || "--slate")}">${catIcon(x.category)}</span><div class="who"><b style="font-size:16px">${esc(mname(x.merchant))}</b><div class="tag">${dshort(x.date)}</div></div></div><span class="amt">${yuan2(x.amount_cents)}</span></div>`;
  const why = `<div class="why">${ic("info")}<span>${tx.reasons[reason] || tx.reasons.new}</span></div>`;
  let body;
  if (x.mode === "ask") {
    const keys = x.direction === "in" ? ["income", "repay"] : ["purchase", "gift", "loan", "split", "self"];
    body = `<div class="q">${x.direction === "in" ? tx.qIn : tx.qAsk}</div><div class="plist">${keys.map((k) => `<button class="popt" data-a="resolve" data-id="${x.id}" data-v="${k}"><b>${tx.p[k]}</b><span class="muted">${tx.pHint[k]}</span></button>`).join("")}</div>`;
  } else {
    body = `<div class="q">${tx.qCat}</div>${catChips("pick", picks[x.id] || x.category, x.id)}<div class="grid2"><button class="btn" data-a="confirm" data-id="${x.id}">${tx.confirm}</button><button class="btn ghost" data-a="resolve" data-id="${x.id}" data-v="self">${tx.ignore}</button></div>`;
  }
  return `<section class="panel rv">${head}${why}${body}</section>`;
}
function pageReview(d) {
  const tx = t();
  if (!d.pending_list.length) return `<section class="panel empty"><p>${tx.nothingConfirm}</p></section>`;
  return `<details class="more"><summary>${tx.whyQ}</summary><p>${tx.confirmHow}</p></details>${d.pending_list.map(reviewCard).join("")}`;
}

/* ---- history with filters ---- */
const H = { year: "", month: "", day: "", category: "", direction: "", q: "" };
let histYears = [];
const WH = 40;
function segCtl(action, items, cur, labelId) {
  const idx = Math.max(0, items.findIndex(([v]) => String(v) === String(cur)));
  return `<div class="seg ios" role="group"${labelId ? ` aria-labelledby="${labelId}"` : ""} style="--n:${items.length};--i:${idx}"><i class="thumb"></i>${items.map(([v, l]) => `<button type="button" data-a="${action}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join("")}</div>`;
}
function wheelItems(id) {
  const tx = t(), f = tx.flt, all = [["", f.all]];
  if (id === "year") return all.concat(histYears.map((y) => [y, y]));
  if (id === "month") return all.concat([...Array(12).keys()].map((i) => [i + 1, new Date(2000, i, 1).toLocaleDateString(locale(), { month: "short" })]));
  if (id === "day") { const dim = H.year && H.month ? new Date(+H.year, +H.month, 0).getDate() : 31; return all.concat([...Array(dim).keys()].map((i) => [i + 1, i + 1])); }
  return all.concat(CATS.map((c) => [c, tx.cat[c]]));
}
function wheelCol(id) {
  const cur = { year: H.year, month: H.month, day: H.day, cat: H.category }[id], items = wheelItems(id);
  const sel = Math.max(0, items.findIndex(([v]) => String(v) === String(cur))), off = (id === "month" && !H.year) || (id === "day" && !H.month);
  const wl = { year: t().flt.year, month: t().flt.month, day: t().flt.day, cat: t().fCat }[id];
  return `<div class="wheel ${off ? "off" : ""}" data-w="${id}" data-sel="${sel}" tabindex="${off ? -1 : 0}" role="listbox" aria-label="${esc(wl)}"${off ? ' aria-disabled="true"' : ""}>${items.map(([v, l], i) => `<div class="wheel-item" role="option" data-i="${i}" data-v="${esc(v)}" aria-selected="${i === sel}">${esc(l)}</div>`).join("")}</div>`;
}
function histFilters() {
  const tx = t(), f = tx.flt;
  return `<section class="panel filters">
    <div class="search">${ic("search")}<input id="f-q" type="search" placeholder="${f.search}" value="${esc(H.q)}"></div>
    ${segCtl("fdir", [["", f.all], ["out", f.spent], ["in", f.earned]], H.direction)}
    <div class="wheel-labels"><span>${f.year}</span><span>${f.month}</span><span>${f.day}</span><span>${tx.fCat}</span></div>
    <div class="wheels">${["year", "month", "day", "cat"].map(wheelCol).join("")}</div>
  </section><div id="hist-list"></div>`;
}
function wireOne(w) {
  w.scrollTop = (+w.dataset.sel) * WH;
  let tm;
  w.addEventListener("scroll", () => { clearTimeout(tm); tm = setTimeout(() => onWheel(w), 120); });
  w.addEventListener("click", (e) => { const it = e.target.closest(".wheel-item"); if (it) w.scrollTo({ top: +it.dataset.i * WH, behavior: "smooth" }); });
  w.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) || w.classList.contains("off")) return;
    e.preventDefault();
    const last = w.children.length - 1, cur = Math.round(w.scrollTop / WH);
    const n = e.key === "Home" ? 0 : e.key === "End" ? last : cur + (e.key === "ArrowDown" ? 1 : -1);
    w.scrollTo({ top: Math.max(0, Math.min(last, n)) * WH, behavior: "smooth" });
  });
}
function refillWheel(id) {
  const old = document.querySelector(`.wheel[data-w="${id}"]`);
  if (!old) return;
  const tmp = document.createElement("div"); tmp.innerHTML = wheelCol(id);
  const nw = tmp.firstElementChild; old.replaceWith(nw); wireOne(nw);
}
async function onWheel(w) {
  const id = w.dataset.w, i = Math.max(0, Math.min(w.children.length - 1, Math.round(w.scrollTop / WH)));
  if (String(i) === w.dataset.sel) return;
  w.dataset.sel = i;
  [...w.children].forEach((c, k) => c.setAttribute("aria-selected", k === i));
  const v = w.children[i].dataset.v;
  if (id === "year") { H.year = v; H.month = ""; H.day = ""; refillWheel("month"); refillWheel("day"); }
  else if (id === "month") { H.month = v; H.day = ""; refillWheel("day"); }
  else if (id === "day") H.day = v;
  else H.category = v;
  await loadHistory(false);
}
function pageHistory() { return `${ext("history")}<div id="hist-root"><p class="muted">${t().loading}</p></div>`; }
let histSeq = 0;
async function loadHistory(first) {
  const seq = ++histSeq, tx = t();
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(H).filter(([, v]) => v)));
  let r;
  try { r = await api("/transactions?" + qs); } catch {
    if (seq !== histSeq) return;
    const box = $("#hist-list") || $("#hist-root");
    if (box) box.innerHTML = `<section class="panel empty"><p>${tx.err}</p><button class="btn" data-a="histretry">${tx.retry}</button></section>`;
    return;
  }
  if (seq !== histSeq || !$("#hist-root")) return;
  if (first || !histYears.length) histYears = r.years;
  if (first || !$("#hist-list")) { $("#hist-root").innerHTML = histFilters(); document.querySelectorAll(".wheel").forEach(wireOne); }
  const el = $("#hist-list");
  if (!el) return;
  if (!r.items.length) { el.innerHTML = `<section class="panel empty"><p>${tx.noTx}</p></section>`; return; }
  const groups = {};
  r.items.forEach((x) => (groups[x.date] ||= []).push(x));
  el.innerHTML = `<p class="note" style="margin:0 2px 4px">${tx.totals(yuan(r.total_out), yuan(r.total_in), r.items.length)}</p>` + Object.keys(groups).map((dt) => {
    const spent = groups[dt].filter((x) => x.direction === "out" && x.category !== "transfers").reduce((s, x) => s + x.amount_cents, 0);
    return `<div class="day-h"><span>${new Date(dt + "T00:00:00").toLocaleDateString(locale(), { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span><span>${spent ? "−" + yuan(spent) : ""}</span></div><section class="panel" style="padding:4px 16px">${groups[dt].map(txRow).join("")}</section>`;
  }).join("");
}

/* ---- goals ---- */
function pageGoals(d) {
  const tx = t();
  const card = (g) => {
    const body = `<div class="row"><b style="font-size:18px">${esc(g.name)}</b>${isDone(g) ? `<span class="chip done">${ic("check")}${tx.doneChip}</span>` : `<span class="chip ${g.status}">${tx.st[g.status]}</span>`}</div>
    <div class="row"><span class="amt">${tx.goalOf(yuan(g.saved_cents), yuan(g.target_cents))}</span><span class="muted">${isDone(g) ? "" : g.days_to_deadline >= 0 ? g.days_to_deadline + " " + tx.cdDays : tx.overdue}</span></div>
    <div class="meter"><i style="width:${Math.round(g.progress * 100)}%"></i></div>`;
    if (!isDone(g)) return `<button class="gcard" data-go="goal/${g.id}">${body}</button>`;
    return `<div class="gcard done"><button class="gmain" data-go="goal/${g.id}">${body}</button>
      <div class="gactions"><button class="btn ghost sm" data-go="goal/${g.id}/edit">${ic("edit")}${tx.edit}</button><button class="btn danger sm" data-a="delgoal" data-id="${g.id}">${ic("trash")}${tx.delShort}</button></div></div>`;
  };
  const list = d.goals.length ? d.goals.map(card).join("") : `<section class="panel empty"><p class="muted">${tx.goalsEmpty}</p></section>`;
  return `${list}${d.goal_reserve_cents ? `<p class="note">${tx.reserve(yuan(d.goal_reserve_cents))}</p>` : ""}<button class="fab-add" data-go="goal/new" aria-label="${tx.addGoalBtn}">${ic("plus")}</button>`;
}
const FRIENDS_DEMO = [{ name: "佳怡", cents: 20000 }, { name: "思远", cents: 20000 }];
function friendsPanel(g) {
  const tx = t(), total = FRIENDS_DEMO.reduce((q, f) => q + f.cents, 0);
  return `<section class="panel"><div class="sec-head"><span class="tile-ico" style="--c:var(--accent)">${ic("users")}</span><div><h2>${tx.inviteT}</h2><p class="muted">${tx.inviteSub}</p></div></div>
    <div style="margin-top:8px">${FRIENDS_DEMO.map((f) => `<div class="friend"><span class="avatar neutral">${f.name[0]}</span><div class="grow"><b>${f.name}</b><span class="muted">${tx.joined} · ${yuan(f.cents)} ${tx.perMonth}</span></div></div>`).join("")}</div>
    <p class="note" style="margin:6px 0 12px">${tx.fWith(yuan(total))} · ${tx.demoFriends}</p>
    <button class="btn block" style="width:100%" data-a="invite" data-id="${g.id}">${ic("share")}${tx.inviteBtn}</button></section>`;
}
function pageGoal(d, id) {
  const tx = t(), g = d.goals.find((x) => String(x.id) === String(id));
  if (!g) return `<section class="panel empty"><p>${tx.notFound}</p></section>`;
  if (isDone(g)) {
    const sparks = ["--accent", "--accent2", "--warn", "--accent", "--accent2", "--warn", "--accent", "--accent2"].map((cv, i) => `<i class="spark" style="background:var(${cv});left:${12 + i * 11}%;top:-8px;--dx:${(i % 2 ? 1 : -1) * (10 + i * 6)}px;animation-delay:${(i * 0.08).toFixed(2)}s"></i>`).join("");
    return `<section class="panel success"><div class="confetti">${sparks}</div><span class="success-badge">${ic("check")}</span>
        <h2>${tx.doneT}</h2><p>${esc(tx.doneSub(g.name, yuan(g.saved_cents)))}</p><span class="chip done">${ic("check")}${tx.doneChip} · ${tx.goalOf(yuan(g.saved_cents), yuan(g.target_cents))}</span></section>
      <button class="btn block" style="width:100%" data-go="goal/new">${ic("plus")}${tx.newGoalBtn}</button>
      <div class="grid2"><button class="btn ghost" data-go="goal/${g.id}/edit">${ic("edit")}${tx.edit}</button><button class="btn danger" data-a="delgoal" data-id="${g.id}">${ic("trash")}${tx.delShort}</button></div>`;
  }
  const days = Math.max(0, g.days_to_deadline), pct = Math.round(g.progress * 100);
  const mile = [25, 50, 75, 100].map((m) => `<span class="${pct >= m ? "done" : ""}">${m}%</span>`).join("");
  return `<section class="panel stack" style="justify-items:center;text-align:center">${ring(g.progress, true, pct + "%")}
      <h2 style="font-size:22px;margin:0">${esc(g.name)}</h2><div class="amt" style="font-size:18px">${tx.goalOf(yuan(g.saved_cents), yuan(g.target_cents))}</div><span class="chip ${g.status}">${tx.st[g.status]}</span></section>
  <section class="panel ai-card"><h2>${tx.askGoalT}</h2><p class="muted" style="margin-bottom:12px">${tx.askGoalSub}</p><button class="ask-ai big" data-a="askai" data-k="goal" data-id="${g.id}">${ic("sparkles")}${tx.askAI}</button></section>
  <section class="panel"><div class="countdown"><div><b>${Math.round(days / 30.4)}</b><span class="muted">${tx.cdMonths}</span></div><div><b>${Math.floor(days / 7)}</b><span class="muted">${tx.cdWeeks}</span></div><div><b>${days}</b><span class="muted">${tx.cdDays}</span></div></div>
    ${g.days_to_deadline < 0 ? `<p class="note" style="margin-top:8px">${tx.overdue}</p>` : ""}</section>
  <section class="panel"><div class="stat"><div><span class="muted">${tx.remaining}</span><b>${yuan(g.remaining_cents)}</b></div><div><span class="muted">${tx.monthly}</span><b>${yuan(g.monthly_needed_cents)}</b></div>
    <div><span class="muted">${tx.deadline}</span><b style="font-size:16px">${dfull(g.deadline)}</b></div><div><span class="muted">${tx.projected}</span><b style="font-size:16px">${g.projected_date ? dfull(g.projected_date) : tx.noProj}</b></div></div>
    <h2 style="margin-top:14px">${tx.milestones}</h2><div class="meter"><i style="width:${pct}%"></i></div><div class="miles">${mile}</div></section>
  ${friendsPanel(g)}
  ${ext("goal", d, g)}
  <section class="panel"><h2>${tx.deposit}</h2><form id="depform" data-id="${g.id}"><div class="opts">${[100, 500, 1000].map((v) => `<button type="button" class="btn ghost sm" data-a="dep" data-id="${g.id}" data-v="${v}">+¥${v}</button>`).join("")}</div>
    <div class="grid2"><input name="amount" type="number" min="1" inputmode="numeric" placeholder="${tx.amount}" required><button class="btn">${tx.depositBtn}</button></div></form></section>
  <div class="grid2"><button class="btn ghost" data-go="goal/${g.id}/edit">${ic("edit")}${tx.edit}</button><button class="btn danger" data-a="delgoal" data-id="${g.id}">${ic("trash")}${tx.delShort}</button></div>`;
}
function pageGoalForm(d, id) {
  const tx = t(), g = id ? d.goals.find((x) => String(x.id) === String(id)) : null;
  if (id && !g) return `<section class="panel empty"><p>${tx.notFound}</p></section>`;
  const dl = g ? g.deadline : new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  return `<section class="panel"><form id="goalform" data-id="${g ? g.id : ""}"><label>${tx.goalName}<input name="name" value="${esc(g ? g.name : "")}" required maxlength="60"></label>
    <div class="grid2"><label>${tx.target}<input name="target" type="number" min="1" inputmode="numeric" value="${g ? Math.round(g.target_cents / 100) : ""}" required></label>
    <label>${tx.savedSoFar}<input name="saved" type="number" min="0" inputmode="numeric" value="${g ? Math.round(g.saved_cents / 100) : 0}" required></label></div>
    <label>${tx.deadlineL}<input name="deadline" type="date" value="${dl}" required></label><button class="btn">${tx.save}</button></form></section>`;
}

/* ---- invest ---- */
function pageInvest(d, topic) {
  const tx = t(), C = INVEST[lang];
  if (topic) {
    const meta = INVEST.topics.find((x) => x.id === topic), c = C[topic];
    if (!meta || !c) return `<section class="panel empty"><p>${tx.notFound}</p></section>`;
    const idx = INVEST.topics.indexOf(meta), nxt = INVEST.topics[(idx + 1) % INVEST.topics.length], prv = INVEST.topics[(idx + INVEST.topics.length - 1) % INVEST.topics.length];
    let extra = "";
    if (topic === "cushion") {
      const base = d.fixed_total_cents + d.avg_flex_cents * 30;
      extra = `<section class="panel"><h2>${tx.yourNumbers}</h2><p>${tx.cushionNums(yuan(base * 3), yuan(base * 6))}</p></section>`;
    }
    if (topic === "compound") {
      extra = `<section class="panel stack"><label>${tx.calcMonthly}<input id="cm" type="number" min="0" value="500" inputmode="numeric"></label>
        <label>${tx.calcYears}: <b id="cyv">10</b><input id="cy" type="range" min="1" max="30" value="10"></label><div id="cres" class="stack"></div><p class="note">${tx.calcNote}</p></section>`;
    }
    return `<section class="panel lesson"><div class="row" style="justify-content:flex-start;margin-bottom:12px"><span class="tile-ico" style="--c:${col(meta.color)}">${ic(meta.icon)}</span><div><h2 style="margin:0;font-size:20px">${c.t}</h2><span class="muted">${tx.minRead(meta.min)}</span></div></div>
      ${c.p.map((p) => `<p>${p}</p>`).join("")}<div class="key" style="border-left-color:${col(meta.color)}"><span class="muted">${tx.takeaway}</span><br>${c.k}</div></section>${extra}
      <div class="grid2"><button class="link nav2" data-rep="invest/${prv.id}"><span class="muted">← ${tx.prev}</span><b>${C[prv.id].t}</b></button><button class="link nav2" data-rep="invest/${nxt.id}"><span class="muted">${tx.next} →</span><b>${C[nxt.id].t}</b></button></div><p class="disclaimer">${tx.notAdvice}</p>`;
  }
  const lv = (n) => ["--accent", "--accent", "--warn", "--warn", "--bad"][n - 1];
  return `<section class="panel"><h2>${tx.invest}<span class="beta">Beta</span></h2>
    <p style="margin-top:8px"><b>${d.free_cents > 0 ? tx.free(yuan(d.free_cents)) : tx.noFree}</b></p><details class="more"><summary>${tx.whyQ}</summary><p>${tx.investIntro}</p></details></section>
  <div class="sec-title">${tx.topics}</div>
  ${INVEST.topics.map((m) => `<button class="topic" data-go="invest/${m.id}"><span class="tile-ico" style="--c:${col(m.color)}">${ic(m.icon)}</span><span class="grow"><b>${C[m.id].t}</b><br><span class="sub">${C[m.id].s}</span></span><span class="tag">${tx.minRead(m.min)}</span></button>`).join("")}
  <div class="sec-title">${tx.riskMap}</div>
  <section class="panel"><p class="muted" style="margin-bottom:6px">${tx.riskMapSub}</p>${INVEST.assets.map((a) => `<div class="risk"><div><b>${tx.assets[a.id][0]}</b><div class="tag">${tx.assets[a.id][1]}</div></div>
    <div><div class="meter5">${[1, 2, 3, 4, 5].map((i) => `<i style="${i <= a.level ? "background:" + col(lv(a.level)) : ""}"></i>`).join("")}</div><div class="tag" style="text-align:right">${tx.lvl[a.level - 1]}</div></div></div>`).join("")}</section>
  <p class="disclaimer">${tx.notAdvice}</p>`;
}
function wireCompound() {
  const m = $("#cm"), y = $("#cy");
  if (!m || !y) return;
  const calc = () => {
    const P = Math.max(0, +m.value || 0), yrs = +y.value, n = yrs * 12;
    $("#cyv").textContent = yrs;
    const rows = [0, 3, 6].map((r) => { const i = r / 1200; return [r, i ? P * ((1 + i) ** n - 1) / i : P * n]; });
    const max = Math.max(...rows.map((r) => r[1]), 1);
    $("#cres").innerHTML = `<p class="muted">${t().calcIn("¥" + Math.round(P * n).toLocaleString("en-US"))}</p>` + rows.map(([r, v]) =>
      `<div class="calc-row"><span>${r}%</span><div class="meter"><i style="width:${Math.round((v / max) * 100)}%;background:var(${r ? (r === 3 ? "--accent2" : "--accent") : "--slate"})"></i></div><b>¥${Math.round(v).toLocaleString("en-US")}</b></div>`).join("");
  };
  m.oninput = y.oninput = calc; calc();
}

/* ---- top / profile / import ---- */
const AV = ["--accent", "--accent2"];
const avColor = (n) => AV[[...n].reduce((q, ch) => q + ch.charCodeAt(0), 0) % AV.length];
const nick = () => store.get("nickname", store.get("name", ""));
function lbName(x) { return x.me ? (nick() || t().you) : x.name; }
const avatarURL = () => { const u = store.get("avatar", ""); return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(u) ? u : ""; };
function lbAvatar(x) {
  const nm = lbName(x);
  if (!x.me) return `<span class="avatar neutral">${esc(nm.slice(0, 1).toUpperCase())}</span>`;
  const u = avatarURL();
  return u ? `<span class="avatar img" style="background-image:url('${u}')"></span>` : `<span class="avatar" style="--c:var(--accent);color:var(--on-accent)">${esc(nm.slice(0, 1).toUpperCase())}</span>`;
}
function pageTop(d) {
  const tx = t(), lb = d.leaderboard, mi = lb.findIndex((x) => x.me), me = lb[mi], above = mi > 0 ? lb[mi - 1] : null, max = Math.max(...lb.map((x) => x.rate), 0.01);
  const pod = (x, cls) => x ? `<div class="pod ${cls} ${x.me ? "me" : ""}">${cls === "r1" ? ic("crown").replace("<svg ", '<svg class="crown" ') : ""}<span class="medal">${lbAvatar(x)}</span><span class="nm">${esc(lbName(x))}</span><span class="pc">${Math.round(x.rate * 100)}%</span></div>` : "<div></div>";
  return `<section class="lb-hero"><span class="muted">${tx.top}<span class="beta">Beta</span></span><b>#${mi + 1} ${tx.rankOf(mi + 1, lb.length)}</b><span>${tx.saidRate(Math.round(me.rate * 100))}</span>
      <span class="muted">${above ? tx.toPass(lbName(above), Math.max(1, Math.round((above.rate - me.rate) * 100))) : tx.leading}</span></section>
    <div class="podium">${pod(lb[1], "r2")}${pod(lb[0], "r1")}${pod(lb[2], "r3")}</div>
    <div class="lb-list">${lb.slice(3).map((x, i) => `<div class="rank ${x.me ? "me" : ""}"><span class="n">${i + 4}</span>${lbAvatar(x)}<div class="info"><b>${esc(lbName(x))}</b><div class="bar" style="--c:var(${x.me ? "--accent" : avColor(x.name)})"><i style="width:${Math.round((x.rate / max) * 100)}%"></i></div></div><span class="amt">${Math.round(x.rate * 100)}%</span></div>`).join("")}</div>
    <p class="note">${tx.topSub}</p>`;
}
function pageProfile(d) {
  const tx = t(), name = nick(), email = store.get("email", ""), phone = store.get("phone", ""), saved = d.goals.reduce((q, g) => q + g.saved_cents, 0), u = avatarURL();
  const av = u ? `<span class="avatar big img" style="background-image:url('${u}')"></span>` : `<span class="avatar big">${esc((name || "?").slice(0, 1).toUpperCase())}</span>`;
  const who = name || email || phone
    ? `<b>${esc(name || tx.you)}</b>${email ? `<span class="muted">${esc(email)}</span><br>` : ""}${phone ? `<span class="muted">${esc(phone)}</span>` : ""}`
    : `<b>${tx.setupProfile}</b><span class="muted">${tx.setupSub}</span>`;
  return `<section class="panel"><div class="pcard"><label class="avatar-up" aria-label="${tx.changePhoto}">${av}<span class="cam">${ic("camera")}</span><input id="avatarin" class="vh" type="file" accept="image/*"></label><div class="who">${who}</div></div>
      ${u ? `<button class="btn ghost sm" style="margin-top:12px" data-a="rmavatar">${tx.removePhoto}</button>` : ""}</section>
  <div class="statgrid"><div><span class="muted">${tx.income}</span><b>${yuan(d.profile.income_cents)}</b></div><div><span class="muted">${tx.payday}</span><b>${d.profile.payday_day}</b></div>
    <div><span class="muted">${tx.statSaved}</span><b>${yuan(saved)}</b></div><div><span class="muted">${tx.statRecords}</span><b>${d.tx_count}</b></div></div>${ext("profile", d)}`;
}
function pageSettings(d) {
  const tx = t(), mode = store.get("theme", "light");
  const seg = segCtl;
  const pform = `<section class="panel"><h2>${tx.profileT}</h2><form id="pinfo"><label>${tx.nickname}<input name="nickname" value="${esc(nick())}" maxlength="30" autocomplete="nickname"></label>
    <label>${tx.email}<input name="email" type="email" value="${esc(store.get("email", ""))}" autocomplete="email" placeholder="name@example.com"></label>
    <label>${tx.phone}<input name="phone" type="tel" inputmode="tel" value="${esc(store.get("phone", ""))}" autocomplete="tel" placeholder="+86 138 0000 0000"></label>
    <button class="btn">${tx.save}</button><p id="pmsg2" class="note">${tx.profileNote}</p></form></section>`;
  return `${pform}<section class="panel"><h2>${tx.salary}</h2><form id="profform"><div class="grid2"><label>${tx.income}<input name="income" type="number" min="0" inputmode="numeric" value="${Math.round(d.profile.income_cents / 100)}"></label>
    <label>${tx.payday}<input name="payday" type="number" min="1" max="31" inputmode="numeric" value="${d.profile.payday_day}"></label></div><button class="btn">${tx.save}</button></form></section>
  <section class="panel stack"><div class="field"><span id="lbl-lang">${tx.lang}</span>${seg("setlang", [["zh", "中文"], ["en", "English"]], lang, "lbl-lang")}</div>
    <div class="field"><span id="lbl-theme">${tx.theme}</span>${seg("settheme", [["light", tx.themeL], ["dark", tx.themeD]], mode, "lbl-theme")}</div></section>
  <section class="panel"><h2>${tx.autoImp}<span class="beta">Beta</span></h2><p class="muted">${tx.autoImpSub}</p></section>
  <section class="panel"><h2>${tx.privacy}</h2><button class="btn danger" data-a="delall">${tx.delAll}</button><p id="pmsg" class="note" style="margin-top:8px"></p></section>${ext("settings", d)}`;
}
function pageImport() {
  const tx = t();
  const svc = (icon, name) => `<div class="svc"><span class="tile-ico" style="--c:var(--accent)">${ic(icon)}</span><div class="grow"><b>${name}</b><div class="muted">Beta</div></div><button class="btn ghost sm" data-a="waitlist" data-name="${esc(name)}">${tx.notify}</button></div>`;
  return `${ext("importTop")}<section class="panel"><div class="sec-head"><span class="tile-ico" style="--c:var(--accent)">${ic("file")}</span><div><h2>${tx.uploadT}</h2><p class="muted">${tx.uploadSub}</p></div></div>
      <label class="row-link">${ic("file")}<span class="grow"><b>${tx.pick}</b><span class="muted">CSV</span></span>${ic("go")}<input id="file" class="vh" type="file" accept=".csv,text/csv"></label>
      <label class="row-link">${ic("image")}<span class="grow"><b>${tx.fromGallery}</b><span class="muted">${tx.rawGallery}</span></span>${ic("go")}<input id="photo2" class="vh" type="file" accept="image/*"></label>
      <button class="btn ghost sm" style="margin-top:12px" data-a="demo">${tx.loadDemo}</button><p id="report" class="note" style="margin-top:10px"></p></section>
    <section class="panel"><h2>${tx.connectT}<span class="beta">Beta</span></h2><p class="muted">${tx.connectSub}</p>
      ${svc("plug", "Alipay")}${svc("plug", "WeChat Pay")}${svc("bank", tx.bankCard)}</section>${ext("importBottom")}<div style="height:76px"></div>`;
}

/* ================= render ================= */
const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
function applyTheme() {
  const m = store.get("theme", "light");
  if (m === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
  const c = m === "dark" ? "#04060B" : "#E8F1F6";
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute("content", c));
}
let lastRoute = null;
function render() {
  if (!S) return;
  const tx = t(), r = parse(), root = ROOTS.includes(r.name), key = curHash(), changed = key !== lastRoute, hadRoute = lastRoute !== null, y = window.scrollY;
  lastRoute = key;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  const titles = { home: tx.home, history: tx.history, import: tx.imp, goals: tx.goals, profile: tx.profile, review: tx.review, top: tx.top, invest: tx.invest,
    settings: tx.settings, goal: r.a === "new" ? tx.newGoal : r.b === "edit" ? tx.editGoal : tx.goal };
  $("#title").textContent = titles[r.name] || (EXT.routes[r.name] && EXT.routes[r.name].title()) || tx.home;
  const back = $("#back");
  back.hidden = root; back.innerHTML = ic("back"); back.setAttribute("aria-label", tx.back);
  const n = S.pending.digest + S.pending.ask;
  $("#tools").innerHTML = r.name === "profile" ? `<button class="icon-btn" data-go="settings" aria-label="${tx.settings}">${ic("settings")}</button>` : r.name === "home" ? `<button class="icon-btn ${n ? "alert" : ""}" data-go="review" aria-label="${tx.review}">${ic("check")}${n ? `<span class="badge">${n}</span>` : ""}</button><button class="icon-btn" data-go="top" aria-label="${tx.top}">${ic("top")}</button><button class="icon-btn" data-go="invest" aria-label="${tx.invest}">${ic("invest")}</button>` : "";
  $("#nav").innerHTML = [["home", "home", tx.home], ["history", "history", tx.history], ["import", "imp", tx.imp], ["goals", "goals", tx.goals], ["profile", "profile", tx.profile]]
    .map(([k, i, l]) => `<a href="#/${k}" ${k === r.name || (k === "goals" && r.name === "goal") || (k === "profile" && r.name === "settings") ? 'aria-current="page"' : ""}>${ic(i)}<span>${l}</span></a>`).join("");
  let html;
  if (EXT.routes[r.name]) html = EXT.routes[r.name].page(S, r);
  else switch (r.name) {
    case "review": html = pageReview(S); break;
    case "history": html = pageHistory(); break;
    case "import": html = pageImport(); break;
    case "goals": html = pageGoals(S); break;
    case "goal": html = r.a === "new" ? pageGoalForm(S, null) : r.b === "edit" ? pageGoalForm(S, r.a) : pageGoal(S, r.a); break;
    case "invest": html = pageInvest(S, r.a); break;
    case "top": html = pageTop(S); break;
    case "profile": html = pageProfile(S); break;
    case "settings": html = pageSettings(S); break;
    default: html = pageHome(S);
  }
  $("#app").innerHTML = html;
  $("#fab-scan").hidden = r.name !== "import";
  if (r.name !== "import") $("#scan-toast").hidden = true;
  if (r.name === "home") wireCarousel();
  if (r.name === "history") loadHistory(true).catch(() => {});
  if (r.name === "invest" && r.a === "compound") wireCompound();
  EXT.after.forEach((f) => { try { f(r); } catch (e) { console.error(e); } });
  window.scrollTo(0, changed ? 0 : y);
  chatStatic();
  if (changed && hadRoute) { const h = $("#title"); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

/* ================= chat sheet ================= */
const chatLog = [];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
function chatStatic() {
  const tx = t();
  $("#fab-scan").innerHTML = ic("scan"); $("#fab-scan").setAttribute("aria-label", tx.scanT);
  $("#fab-chat").innerHTML = ic("chat"); $("#fab-chat").setAttribute("aria-label", tx.asst);
  $("#chat-avatar").innerHTML = ic("sparkles"); $("#chat-title").textContent = tx.asst; $("#chat-sub").textContent = tx.asstSub;
  $("#chat-close").innerHTML = ic("x"); $("#mic").innerHTML = ic("mic"); $("#sendbtn").innerHTML = ic("send");
  $("#chat-close").setAttribute("aria-label", tx.close); $("#mic").setAttribute("aria-label", tx.voice); $("#sendbtn").setAttribute("aria-label", tx.send);
  $("#chatin").setAttribute("aria-label", tx.msgL); $("#chat").setAttribute("aria-label", tx.asst);
  if (!listening) $("#chatin").placeholder = tx.placeholder;
  $("#chips").innerHTML = tx.chips.map((s) => `<button type="button" data-a="chip" data-v="${esc(s)}">${esc(s)}</button>`).join("");
}
function chatPaint() {
  const msgs = chatLog.length ? chatLog : [{ who: "bot", html: esc(t().hello) }];
  $("#chatlist").innerHTML = msgs.map((m) => `<div class="msg ${m.who}">${m.html}</div>`).join("");
  $("#chatlist").scrollTop = $("#chatlist").scrollHeight;
}
const BEHIND_SHEET = ["#app", "#nav", ".top", "#fab-chat", "#fab-scan", "#scan-toast"];
const setInert = (on) => BEHIND_SHEET.forEach((q) => { const el = $(q); if (el) el.inert = on; });
function openChat() { $("#chat").hidden = false; document.body.classList.add("locked"); setInert(true); chatPaint(); EXT.chatOpen.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); $("#chatin").focus(); }
function closeChat() { if (listening && rec) rec.stop(); $("#chat").hidden = true; document.body.classList.remove("locked"); setInert(false); $("#fab-chat").focus(); }
function addMsg(who, html) {
  chatLog.push({ who, html });
  const el = $("#chatlist");
  if (!chatLog.length || chatLog.length === 1) chatPaint(); else el.insertAdjacentHTML("beforeend", `<div class="msg ${who}">${html}</div>`);
  el.scrollTop = el.scrollHeight;
}
function renderPlan(p) {
  const tx = t();
  if (p.intent === "no_goal") return `${esc(tx.aiNoGoal)}<div class="opts" style="margin-top:8px"><button class="btn sm" data-a="aiact" data-v="newgoal">${tx.addGoalShort}</button></div>`;
  const row = (icon, text, gain) => `<div class="pstep"><span class="ctile" style="--c:var(--accent)">${icon}</span><span class="grow">${text}</span>${gain ? `<span class="gain">${gain}</span>` : ""}</div>`;
  const mo = (c) => "+" + yuan(c) + tx.perMo, catName = (c) => tx.cat[c] || c;
  const actions = (list) => `<div class="opts">${list.map(([v, l]) => `<button class="btn ghost sm" data-a="aiact" data-v="${v}">${l}</button>`).join("")}</div>`;
  if (p.intent === "goal_done") return `${esc(tx.aiDone(p.goal.name))}<div class="opts" style="margin-top:8px"><button class="btn sm" data-a="aiact" data-v="newgoal">${tx.newGoalBtn}</button><button class="btn ghost sm" data-a="aiact" data-v="goal:${p.goal.id}">${tx.openGoal}</button></div>`;
  if (p.intent === "goal") {
    const steps = p.steps.slice(0, 3).map((s) => s.type === "cut" ? row(catIcon(s.category), esc(tx.aiCut(catName(s.category))), mo(s.monthly_cents))
      : s.type === "weekly" ? row(ic("coins"), esc(tx.aiWeekly(yuan(s.weekly_cents))), mo(s.monthly_cents))
      : row(ic("users"), esc(tx.aiFriends(s.n, yuan(s.each_cents))), mo(s.monthly_cents))).join("");
    const eta = p.eta_new ? `<b>${esc(tx.aiEta(dfull(p.eta_new), p.days_faster || 0))}</b>${esc(p.on_time ? tx.aiOn : tx.aiOff)}` : `<b>${esc(tx.aiEtaNone)}</b>`;
    return `<div class="plan"><b class="ptitle">${esc(tx.aiGoalT(p.goal.name))}<span class="beta">${tx.aiDemo}</span></b>${steps}<div class="pres">${eta}</div>${actions([["invite:" + p.goal.id, tx.inviteBtn], ["goal:" + p.goal.id, tx.openGoal]])}</div>`;
  }
  if (p.intent === "save") {
    const steps = p.steps.slice(0, 3).map((s) => row(catIcon(s.category), esc(tx.aiCut(catName(s.category))), mo(s.monthly_cents))).join("");
    const eff = p.goal ? `<span>${esc(tx.aiGoalEffect(p.goal.name, p.goal.days_faster || 0))}</span>` : "";
    return `<div class="plan"><b class="ptitle">${tx.aiSaveT}<span class="beta">${tx.aiDemo}</span></b>${steps}<div class="pres"><b>${esc(tx.aiTotal(yuan(p.total_monthly_cents)))}</b>${eff}</div>${actions(p.goal ? [["askgoal:" + p.goal.id, tx.askGoal]] : [["newgoal", tx.addGoalShort]])}</div>`;
  }
  const tip = p.top_category ? `<span>${esc(tx.aiBudgetTip(catName(p.top_category)))}</span>` : "";
  return `<div class="plan"><b class="ptitle">${tx.aiBudgetT}<span class="beta">${tx.aiDemo}</span></b><div class="pres"><b>${esc(tx.aiBudget(yuan(p.allowance_cents), tx[p.status] || ""))}</b>${tip}</div>${actions([["save", tx.seeSave]])}</div>`;
}
async function replyAI(payload) {
  const tx = t(), typing = document.createElement("div");
  typing.className = "msg bot typing"; typing.textContent = "…"; $("#chatlist").append(typing); $("#chatlist").scrollTop = $("#chatlist").scrollHeight;
  let p;
  try { p = await api("/ask", payload); } catch { typing.remove(); addMsg("bot", esc(tx.err)); return; }
  await new Promise((r) => setTimeout(r, 450));
  typing.remove(); addMsg("bot", renderPlan(p));
}
async function askAI(kind, id) {
  const tx = t(), g = (S.goals || []).find((x) => String(x.id) === String(id)) || (S.goals || [])[0];
  openChat();
  if (!chatLog.length) chatLog.push({ who: "bot", html: esc(tx.hello) });
  addMsg("me", esc(kind === "goal" && g ? tx.qGoal(g.name) : kind === "save" ? tx.qSave : tx.qBudget));
  await replyAI({ kind, id });
}
async function invite(id) {
  const tx = t(), g = S.goals.find((x) => String(x.id) === String(id));
  if (!g) return;
  const url = `${location.origin}/?join=g${g.id}`, text = tx.inviteText(g.name);
  if (navigator.share) { try { await navigator.share({ title: tx.asst, text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); } catch { /* clipboard may be blocked */ }
  if (!$("#chat").hidden) addMsg("bot", `${esc(tx.linkCopied)}<br><span class="note">${esc(url)}</span>`);
  else showToast(`<div class="stack"><b>${tx.linkCopied}</b><span class="muted">${esc(url)}</span></div>`);
}
async function sendChat(text) {
  text = (text || "").trim();
  if (!text) return;
  const tx = t();
  if (!chatLog.length) chatLog.push({ who: "bot", html: esc(tx.hello) });
  addMsg("me", esc(text));
  const typing = document.createElement("div"); typing.className = "msg bot typing"; typing.textContent = "…"; $("#chatlist").append(typing);
  let r;
  try { r = await api("/chat", { text }); } catch { typing.remove(); addMsg("bot", esc(tx.err)); return; }
  typing.remove();
  if (r.kind === "unknown") { await replyAI({ kind: "text", text }); return; }
  let html;
  if (r.kind === "silent") html = `<span class="coin"></span>${esc(tx.recorded(yuan2(r.tx.amount_cents), mname(r.tx.merchant)))}`;
  else if (r.kind === "digest") html = esc(tx.digest(yuan2(r.tx.amount_cents), mname(r.tx.merchant)));
  else if (r.kind === "ask") {
    const keys = r.tx.direction === "in" ? ["income", "repay"] : ["purchase", "gift", "loan", "split", "self"];
    html = `${esc(tx.askT(yuan2(r.tx.amount_cents), mname(r.tx.merchant)))}<div class="opts" style="margin-top:8px">${keys.map((k) => `<button class="btn ghost sm" data-a="chatresolve" data-id="${r.tx.id}" data-v="${k}">${tx.p[k]}</button>`).join("")}</div>`;
  } else html = esc(r.kind === "dup" ? tx.dup : tx.unknown);
  addMsg("bot", html);
  try { await refreshView(); } catch { /* keep old state */ }
}
function micUi() { const m = $("#mic"); m.classList.toggle("live", listening); m.setAttribute("aria-pressed", listening); }
function toggleVoice() {
  const tx = t();
  if (!SR) { addMsg("bot", esc(tx.noVoice)); return; }
  if (listening) { rec.stop(); return; }
  rec = new SR(); rec.lang = lang === "zh" ? "zh-CN" : "en-US"; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const txt = Array.from(e.results).map((r) => r[0].transcript).join("");
    $("#chatin").value = txt;
    if (e.results[e.results.length - 1].isFinal) { $("#chatin").value = ""; sendChat(txt); }
  };
  rec.onend = () => { listening = false; micUi(); $("#chatin").placeholder = t().placeholder; };
  rec.onerror = (e) => { listening = false; micUi(); if (e.error === "not-allowed" || e.error === "service-not-allowed") addMsg("bot", esc(tx.micDenied)); };
  try { rec.start(); listening = true; micUi(); $("#chatin").placeholder = tx.listening; } catch { listening = false; micUi(); }
}

/* ================= images ================= */
function resizeImage(file, max, square, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      let sx = 0, sy = 0, sw = img.width, sh = img.height, w, h;
      if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; w = h = max; }
      else { const k = Math.min(1, max / Math.max(sw, sh)); w = Math.round(sw * k); h = Math.round(sh * k); }
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(u); res(cv.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("image")); };
    img.src = u;
  });
}
let toastTm;
function showToast(html, sticky) {
  const el = $("#scan-toast");
  el.innerHTML = html + `<button class="icon-btn toast-x" data-a="toastx" aria-label="${t().close}">${ic("x")}</button>`;
  el.hidden = false; clearTimeout(toastTm);
  if (!sticky) toastTm = setTimeout(() => { el.hidden = true; }, 15000);
}
async function handlePhoto(file) {
  const tx = t();
  if (!file) return;
  if (!(await consentOk())) return;
  const url = URL.createObjectURL(file), img = `<img src="${url}" alt="">`;
  showToast(`<div class="scan">${img}<div><b>${tx.analyzing}</b></div></div>`, true);
  try {
    const dataUrl = await resizeImage(file, 1280, false, 0.8);
    const r = await api("/scan", { image: dataUrl.split(",")[1], media_type: "image/jpeg" });
    await refreshView();
    if (parse().name !== "import") return;
    if (r.kind === "error") showToast(`<div class="scan">${img}<div><b>${r.reason === "rate" ? tx.scanRate : tx.scanErr}</b></div></div>`);
    else if (r.kind === "dup") showToast(`<div class="scan">${img}<div><b>${tx.dup}</b></div></div>`);
    else showToast(`<div class="scan">${img}<div class="stack"><b>${esc(mname(r.tx.merchant))} · ${yuan2(r.tx.amount_cents)}</b><span class="muted">${esc(tx.cat[r.tx.category] || r.tx.category)}</span>
      <span>${esc(r.kind === "silent" ? tx.recorded(yuan2(r.tx.amount_cents), mname(r.tx.merchant)) : tx.scanDone(yuan2(r.tx.amount_cents), mname(r.tx.merchant)))}</span>${r.demo ? `<span class="note">${tx.scanDemo}</span>` : ""}${r.kind === "silent" ? "" : `<button class="btn sm" data-go="review">${tx.openList}</button>`}</div></div>`);
  } catch { if (parse().name === "import") showToast(`<div class="scan">${img}<div><b>${tx.scanErr}</b></div></div>`); }
}

/* ================= events ================= */
document.addEventListener("click", async (e) => {
  if (e.target.closest("#fab-scan")) { if (await consentOk()) $("#photo").click(); return; }
  const g = e.target.closest("[data-go]");
  if (g) { $("#scan-toast").hidden = true; go("#/" + g.dataset.go); return; }
  const rp = e.target.closest("[data-rep]");
  if (rp) { goReplace("#/" + rp.dataset.rep); return; }
  if (e.target.closest("#fab-chat")) { openChat(); return; }
  if (e.target.closest("#chat-close")) { closeChat(); return; }
  if (e.target.closest("#back")) { goBack(); return; }
  if (e.target.closest("#mic")) { toggleVoice(); return; }
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const a = b.dataset.a, tx = t();
  try {
    if (a === "demo") { if (!(await consentOk())) return; b.disabled = true; const rep = await api("/demo", {}); if (rep && rep.persona && !nick()) store.set("nickname", rep.persona.nickname); await refresh(); if (parse().name === "import") { render(); $("#report").textContent = tx.report(rep); } else go("#/home"); }
    else if (a === "pick") { const id = b.dataset.id; picks[id] = b.dataset.v; b.parentElement.querySelectorAll(".fchip").forEach((x) => x.setAttribute("aria-pressed", x === b)); }
    else if (a === "confirm") { const id = +b.dataset.id, x = S.pending_list.find((p) => p.id === id); await api("/confirm", { id, category: picks[id] || (x && x.category) || "other" }); delete picks[id]; await refresh(); render(); }
    else if (a === "seecat") { H.category = b.dataset.v; H.year = ""; H.month = ""; H.day = ""; H.direction = "out"; H.q = ""; go("#/history"); }
    else if (a === "askai") { await askAI(b.dataset.k, b.dataset.id); }
    else if (a === "invite") { await invite(b.dataset.id); }
    else if (a === "aiact") {
      const [act, aid] = b.dataset.v.split(":");
      if (act === "invite") await invite(aid);
      else if (act === "goal") { closeChat(); go("#/goal/" + aid); }
      else if (act === "newgoal") { closeChat(); go("#/goal/new"); }
      else if (act === "save") { closeChat(); go("#/home"); }
      else if (act === "askgoal") await askAI("goal", aid);
    }
    else if (a === "toastx") { $("#scan-toast").hidden = true; }
    else if (a === "waitlist" && EXT.bankConsent) { await EXT.bankConsent(b.dataset.name, b); }
    else if (a === "waitlist") { b.disabled = true; b.textContent = tx.noted; }
    else if (a === "retry") boot();
    else if (a === "histretry") await loadHistory(!$("#hist-list"));
    else if (a === "rmavatar") { store.set("avatar", ""); render(); }
    else if (a === "resolve") { await api("/resolve", { id: +b.dataset.id, purpose: b.dataset.v }); await refresh(); render(); }
    else if (a === "chatresolve") {
      await api("/resolve", { id: +b.dataset.id, purpose: b.dataset.v });
      b.parentElement.querySelectorAll("button").forEach((x) => (x.disabled = true));
      addMsg("bot", esc(tx.gotIt)); await refreshView();
    }
    else if (a === "chip") await sendChat(b.dataset.v);
    else if (a === "dep") { await api("/goal/deposit", { id: +b.dataset.id, amount_cents: +b.dataset.v * 100 }); await refresh(); render(); }
    else if (a === "delgoal") { if (confirm(tx.delGoalConfirm)) { await api("/goal/delete", { id: +b.dataset.id }); await refresh(); goReplace("#/goals"); } }
    else if (a === "fdir") { H.direction = b.dataset.v; const sg = b.parentElement; [...sg.querySelectorAll("button")].forEach((x, k) => { x.setAttribute("aria-pressed", x === b); if (x === b) sg.style.setProperty("--i", k); }); await loadHistory(false); }
    else if (a === "setlang") { lang = b.dataset.v; store.set("lang", lang); render(); }
    else if (a === "settheme") { store.set("theme", b.dataset.v); applyTheme(); render(); }
    else if (a === "delall") { if (confirm(tx.delConfirm)) { await api("/delete-all", {}); ["nickname", "name", "email", "phone", "avatar", "consent_v1"].forEach((k) => store.del(k)); chatLog.length = 0; await refresh(); render(); const m = $("#pmsg"); if (m) m.textContent = tx.deleted; } }
  } catch (er) { if (!(er && er.silent)) alert(tx.err); b.disabled = false; }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, tx = t();
  try {
    if (f.id === "chatform") { const i = $("#chatin"); const v = i.value; i.value = ""; await sendChat(v); i.focus(); }
    else if (f.id === "goalform") {
      const v = Object.fromEntries(new FormData(f));
      const r = await api("/goal", { id: f.dataset.id ? +f.dataset.id : undefined, name: v.name, target_cents: Math.round(+v.target * 100), saved_cents: Math.round(+v.saved * 100), deadline: v.deadline });
      await refresh(); goReplace("#/goal/" + r.id);
    } else if (f.id === "depform") {
      const v = Object.fromEntries(new FormData(f));
      await api("/goal/deposit", { id: +f.dataset.id, amount_cents: Math.round(+v.amount * 100) }); await refresh(); render();
    } else if (f.id === "profform") {
      const v = Object.fromEntries(new FormData(f));
      await api("/profile", { income_cents: Math.round(+v.income * 100), payday_day: +v.payday }); await refresh(); render();
    } else if (f.id === "pinfo") {
      const v = Object.fromEntries(new FormData(f));
      store.set("nickname", String(v.nickname || "").trim()); store.set("email", String(v.email || "").trim()); store.set("phone", String(v.phone || "").trim());
      render(); const m = $("#pmsg2"); if (m) m.textContent = t().saved_ok;
    }
  } catch (er) { if (!(er && er.silent)) alert(tx.err); }
});

document.addEventListener("change", (e) => {
  const id = e.target.id;
  if (id === "file" && e.target.files[0]) {
    const f = e.target.files[0]; e.target.value = "";
    consentOk().then((ok) => (ok ? f.arrayBuffer() : Promise.reject(new Error("consent")))).then(async (buf) => {
      let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { text = new TextDecoder("gbk").decode(buf); }
      const rep = await api("/import", { csv: text }); await refresh();
      const el = $("#report"); if (el) el.textContent = rep.read ? t().report(rep) : t().importEmpty;
    }).catch((e) => { if (!e || (e.message !== "consent" && !e.silent)) alert(t().err); });
  } else if ((id === "photo" || id === "photo2") && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ""; handlePhoto(f); }
  else if (id === "avatarin" && e.target.files[0]) { resizeImage(e.target.files[0], 256, true).then((u) => { store.set("avatar", u); render(); }).catch(() => alert(t().err)); }
});
let qTimer;
document.addEventListener("input", (e) => { if (e.target.id === "f-q") { clearTimeout(qTimer); qTimer = setTimeout(() => { H.q = e.target.value; loadHistory(false); }, 250); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#chat").hidden) closeChat(); });
window.addEventListener("hashchange", async () => {
  syncStack();
  try { await refresh(); } catch { /* keep old state */ } render(); });

applyTheme();
chatStatic();
function boot() {
  Promise.resolve(authHooks.gate ? authHooks.gate() : null).then(refresh).then(render).catch(() => { $("#app").innerHTML = `<section class="panel empty"><p>${esc(t().err)}</p><button class="btn" data-a="retry">${esc(t().retry)}</button></section>`; });
}
if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
