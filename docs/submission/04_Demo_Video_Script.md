# Demo Video Script (2:55)

Personal-finance AI copilot, Topic A "Personal Finance Assistant". Persona: 林小雨 (Lin Xiaoyu), synthetic, no real data.
Numbers in the storyboard come from the evidence run `evidence/sandbox/sandbox_run_20261020_021222.log` (see [03_Execution_Evidence.md](03_Execution_Evidence.md)). The demo statement is generated relative to the recording date, so on-screen amounts can differ slightly; read the numbers you actually see, and re-run `python tools/evidence_run.py` the same day for matching logs. Only features that exist in the current build are used.

Format: mobile width 390 px. Record at 1080x1920 (portrait) or 390x844. No microphone needed: use the scripted voice chips for voice entry and record the voiceover separately.

Start the app for recording with `python backend/server.py --demo-account`. The app now requires an account: on the first screen it asks you to **create an account** unless `--demo-account` is used, which creates the owner `demo` (for recording only, never for production). **The demo password must never appear on screen**: set it beforehand with the environment variable `FC_DEMO_PASSWORD` (or note the random one the command prints), keep the terminal out of the recording, type it with the field masked (never press "Show password"), and re-record if it is ever visible.

## Storyboard

| Time | Screen / route | Exact action | Caption EN / ZH | Voiceover EN / ZH |
|---|---|---|---|---|
| 0:00-0:10 | Sign-in screen | Sign in as `demo` with the masked password field (password never visible). Land on the empty Home. | "Your data sits behind a sign-in." / 你的数据在登录之后。 | "First, security: the app needs an account before it shows anything. Sign in, and we are in." / 先说安全：没有账号，应用什么都不显示。登录，进入。 |
| 0:10-0:18 | Title card, then `#/home` | Title card, cut to the empty Home with a "Load demo" prompt. | "Typing every coffee kills budgeting apps." / 每杯咖啡都手动记账，记账 App 就死了。 | "Most budgeting apps die because you log every coffee. Ours asks only when it must." / 大多数记账 App 的死因，是每杯咖啡都要手动记。我们只在必要时才问你。 |
| 0:18-0:30 | `#/home`, step-up dialog | Tap Load demo. The app asks to **confirm your password** (valid 5 minutes); type it masked. Pause on "you can spend today" and the status chip (tight). | "Sensitive action: confirm your password." / 敏感操作：请再次确认密码。 | "Loading data is a sensitive action, so it asks for the password again. Meet Lin Xiaoyu, synthetic: about 238 yuan today, status tight." / 加载数据属于敏感操作，需再次确认密码。认识合成人物林小雨：今天约可花 238 元，状态偏紧。 |
| 0:30-0:42 | `#/import` | Give consent if prompted. Show the import report: 371 read, 367 silent, 2 digest, 2 ask. | "371 records in seconds, 4 need a look." / 几秒导入 371 条，仅 4 条需要确认。 | "A WeChat statement: 371 records, 367 filed silently. Only four need a look." / 微信账单 371 条，367 条静默入账，只有 4 条需要你看一眼。 |
| 0:42-1:00 | Home chat box | Type `Luckin 18`: silent record. Then `转给 浩然 500`: the app asks "what was this for?"; tap Loan. | "Known coffee: silent. Friend transfer: it asks." / 熟悉的咖啡：静默。转账给朋友：会询问。 | "Luckin, 18 yuan: recorded, no questions. A 500-yuan transfer to a friend is different: loan, gift or split? One tap." / 瑞幸 18 元：直接记好。转给朋友 500 元则不同：借款、礼物还是分摊？点一下。 |
| 1:00-1:12 | Needs a look (Home card) | Open the queue, show the four reasons (unusual, new, person, large), resolve all. | "Four items, four reasons, all cleared." / 四条待办，四个原因，全部处理。 | "Each question says why. Answer once and it remembers: next time, silent." / 每个问题都说明原因。回答一次，它就记住，下次静默入账。 |
| 1:12-1:30 | Home, Where to save; Ask AI | Expand "Where to save". Tap "Plan for my goal": Japan trip ETA 2027-01-04 to 2026-11-28. | "Cut 20%: Japan trip 37 days sooner." / 削减 20%，日本之旅提前 37 天。 | "Ask AI turns the biggest slices into a plan: 37 days faster for the Japan trip. Demo AI: real numbers, simple wording." / AI 把最大的几项变成计划：日本之旅提前 37 天。演示版 AI：数字真实，措辞简单。 |
| 1:30-1:48 | `#/goals`, Japan trip | Goal what-if: deposit CNY 1,000. Status 'tight' to 'ok', allowance 237.76 to 253.63. | "+CNY 1,000: tight becomes ok." / 存入 1000 元：偏紧变为正常。 | "Add a thousand yuan and the status flips from tight to ok; the daily allowance rises from 238 to 254." / 再存一千元，状态从"偏紧"变"正常"，每日额度从 238 升到 254 元。 |
| 1:48-1:58 | `#/history` | Weekly insights, monthly report, filter by food & drink. | "Insights and monthly report." / 每周洞察与月度报告。 | "Weekly insights, a monthly report, filters by month and category. Spending is down 15% on last month." / 每周洞察、月度报告、按月份和类别筛选。本月支出比上月低 15%。 |
| 1:58-2:06 | `#/invest` | Learn: Update lessons (v1 to v2), "new" tags; then News. | "Educational only. Lesson update is simulated." / 仅供教育。课程更新为模拟。 | "Invest is education, not advice. A lesson pack goes from version one to two, a simulated update. News is from public feeds." / 投资页面只做教育。课程包 v1 到 v2，为模拟更新。新闻来自公开订阅源。 |
| 2:06-2:13 | `#/settings`, Accuracy report | Highlight silent 75.0%, known merchants 95.1%, unseen 42.1%. | "Synthetic benchmark, honest numbers." / 合成基准，如实披露。 | "On a synthetic set 75 percent is silent; unseen merchants are only 42, so we ask." / 合成数据集上 75% 静默入账；陌生商户仅 42%，所以我们选择询问。 |
| 2:13-2:25 | `#/settings`, Guest access (read-only); second window | Create guest `judge` (confirm the password if the 5 minutes lapsed; the guest password is not shown). In a private window sign in as `judge`: the "Read-only guest access" banner shows the numbers; try to add an entry and it is refused. | "Guest access is read-only." / 访客只读。 | "Share your numbers without risk: a guest can look, but cannot add, change or delete anything." / 安全地分享你的数字：访客只能查看，不能添加、修改或删除。 |
| 2:25-2:35 | `#/settings`, Access log | Open "Access log": sign-in, step-up, guest created, and the guest's denied attempt. Point at the hash-chain note. | "Every access is logged and tamper-evident." / 每次访问都有记录，且防篡改。 | "The access log shows who opened your data and when. Entries are chained with hashes, so any edit can be detected." / 访问日志显示谁在何时打开了你的数据。条目以哈希串联，任何改动都能被发现。 |
| 2:35-2:47 | `#/settings`, Privacy & data | Tap Export (password confirmation again if needed), then Delete all data; show the empty state. | "Export or delete everything." / 一键导出或删除全部数据。 | "Your data, your rights: export it, or delete it all after confirming your password. The account is empty." / 数据由你做主：确认密码后导出，或全部删除，账户即刻清空。 |
| 2:47-2:55 | Closing card | Roadmap (real bank connector, live receipt recognition, LLM phrasing) and compliance note. | "Next: licensed bank links. Not investment advice." / 下一步：持牌银行直连。不构成投资建议。 | "Next: licensed bank connections and live receipt reading, built with PIPL compliance. Ask only when it matters." / 下一步：持牌银行直连与实时票据识别，遵循个人信息保护法。只在重要时才打扰你。 |

Receipt scanning is not shown as a headline feature: without an API key it returns a labelled DEMO result. If you show it, say so on screen and in the voiceover.

## Pre-recording checklist

- [ ] Start with `python backend/server.py --demo-account` (owner `demo`); on the first screen the app asks to create an account unless this flag is used. Use a fresh `data/app.db` so no earlier accounts appear.
- [ ] The demo password and the guest `judge` password never appear on screen: keep the terminal out of frame, keep fields masked, do not press "Show password".
- [ ] Reset the demo (Delete all data, confirm password), then load the demo persona on the day of recording so dates are current.
- [ ] Prepare a second private browser window for the guest beat.
- [ ] Language: record one take in EN and one in ZH; do not switch mid-take.
- [ ] Theme: pick light or dark and keep it constant.
- [ ] Mobile width 390 px (browser device toolbar or a phone).
- [ ] Consent given in Privacy & consent before the import step (the server answers 428 until then).
- [ ] Step-up lasts 5 minutes: confirm the password on camera at the Load demo beat; expect another prompt if a later beat comes more than 5 minutes after it.
- [ ] No real data on screen: no real bank names, notifications, bookmarks or clipboard content.
- [ ] Scan is DEMO unless a key is configured; if shown, label it.
- [ ] Microphone not needed: use the scripted voice chips; record voiceover separately.
- [ ] Check the numbers on screen against the log of the same day (`python tools/evidence_run.py`).
- [ ] Close the dev console, extensions and any other tab.

## Recording note

Record the screen at 1080x1920 (portrait, preferred for the mobile-first story) or at 390x844 and upscale. Keep the browser zoom at 100% so tap targets look natural, hide the cursor trail, and export at 30 fps. Total runtime must stay between 2:45 and 3:00 (this storyboard: 2:55), so trim pauses rather than speeding up the voiceover.
