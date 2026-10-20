"""Reproducible accuracy report. Replays data/bench_set.csv (synthetic) through the REAL pipeline:
parse_csv.parse / chatparse.parse -> service.process (memory seeding) -> rules.decide_ex,
on a throwaway in-memory sqlite. Nothing touches the user's database."""
import csv
import io
import os
import sqlite3
from datetime import date, timedelta

import db

SET_PATH = os.path.join(db.DATA_DIR, "bench_set.csv")
INCOME_CENTS = 900000       # same default profile income as db.connect()
MANUAL_TAPS = 4             # open app, pick category, type amount, save
TAPS = {"silent": 0, "digest": 1, "ask": 2}
_cache = {}


def _mem():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(db.SCHEMA)
    return c


def _load():
    with open(SET_PATH, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _stmt_tx(r):
    import parse_csv
    head = "交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态,交易单号\n"
    buf = io.StringIO()
    csv.writer(buf).writerow(["2026-01-01 12:00:00", r["type"], r["merchant"], r["note"],
                              "收入" if r["direction"] == "in" else "支出", r["amount"], "支付成功", ""])
    rows, _ = parse_csv.parse(head + buf.getvalue())
    return rows[0] if rows else None


def _run():
    import chatparse
    import rules
    import service
    recs = _load()
    c = _mem()
    c.execute("INSERT INTO profile(id,payday_day,income_cents,fixed_json,currency) VALUES(1,5,?,'[]','CNY')", (INCOME_CENTS,))
    start = date(2026, 1, 1)
    seen, out = set(), []
    for i, r in enumerate(recs):
        d = (start + timedelta(days=i)).isoformat()
        label = r["text"] if r["kind"] == "chat" else (r["merchant"] + (" · " + r["note"] if r["note"] else ""))
        exp_cents = int(round(float(r["amount"]) * 100))
        if r["kind"] == "chat":
            t = chatparse.parse(r["text"])
            source = "chat"
        else:
            t = _stmt_tx(r)
            source = "csv"
        item = {"n": i + 1, "kind": r["kind"], "label": label, "expected_category": r["expected_category"],
                "expected_mode": r["expected_mode"], "amount": float(r["amount"])}
        if not t:
            item.update(parsed=False, category=None, mode=None, unseen=False, first=False, amount_ok=False,
                        merchant_ok=False, category_ok=False, mode_ok=False, taps=MANUAL_TAPS, silent_wrong=False)
            out.append(item)
            continue
        t["date"] = d
        known = bool(t.get("known"))
        is_merchant_out = r["expected_counterparty"] == "merchant" and r["direction"] == "out"
        key = t["merchant_key"]
        unseen = is_merchant_out and not known
        first = key not in seen
        seen.add(key)
        mode, tid = service.process(c, t, source, INCOME_CENTS)
        row = dict(c.execute("SELECT * FROM transactions WHERE id=?", (tid,)).fetchone())
        cat = row["category"]
        # simulated user: answers a digest/ask with the TRUE category (this is the "learning" step)
        if mode != "silent":
            c.execute("UPDATE transactions SET category=?, status='confirmed' WHERE id=?", (r["expected_category"], tid))
            if t["counterparty_type"] == "merchant" and t["direction"] == "out":
                rules.learn(c, key, r["expected_category"])
        em = r["expected_merchant"]
        item.update(
            parsed=True, category=cat, mode=mode, unseen=unseen, first=first,
            amount_ok=(t["amount_cents"] == exp_cents),
            merchant_ok=(not em) or (em.lower() in (t["merchant"] or "").lower()),
            category_ok=(cat == r["expected_category"]), mode_ok=(mode == r["expected_mode"]),
            taps=TAPS[mode], silent_wrong=(mode == "silent" and cat != r["expected_category"]),
            counterparty_ok=(t["counterparty_type"] == r["expected_counterparty"]),
        )
        out.append(item)
    return out


def _pct(a, b):
    return round(100.0 * a / b, 1) if b else None


def compute():
    out = _run()
    n = len(out)
    chat = [x for x in out if x["kind"] == "chat"]
    unseen = [x for x in out if x["unseen"]]
    unseen_first = [x for x in unseen if x["first"]]
    known = [x for x in out if not x["unseen"]]
    silent = [x for x in out if x["mode"] == "silent"]
    ask_n = sum(1 for x in out if x["mode"] == "ask")
    digest_n = sum(1 for x in out if x["mode"] == "digest")
    taps = sum(x["taps"] for x in out)
    ext_ok = sum(1 for x in chat if x["amount_ok"] and x["merchant_ok"])
    wrong = [x for x in out if not x["category_ok"]]
    m = {
        "extraction_acc": _pct(ext_ok, len(chat)),
        "category_acc": _pct(sum(x["category_ok"] for x in out), n),
        "category_acc_known": _pct(sum(x["category_ok"] for x in known), len(known)),
        "category_acc_unseen_first": _pct(sum(x["category_ok"] for x in unseen_first), len(unseen_first)),
        "category_acc_unseen_all": _pct(sum(x["category_ok"] for x in unseen), len(unseen)),
        "silent_pct": _pct(len(silent), n),
        "question_pct": _pct(ask_n + digest_n, n),
        "digest_pct": _pct(digest_n, n),
        "ask_pct": _pct(ask_n, n),
        "wrong_silent_pct": _pct(sum(x["silent_wrong"] for x in out), n),
        "wrong_silent_of_silent_pct": _pct(sum(x["silent_wrong"] for x in silent), len(silent)),
        "mode_agreement_pct": _pct(sum(x["mode_ok"] for x in out), n),
        "avg_taps": round(taps / n, 2) if n else None,
        "manual_taps": MANUAL_TAPS,
        "taps_saved_pct": _pct(MANUAL_TAPS * n - taps, MANUAL_TAPS * n),
    }
    counts = {"n": n, "chat": len(chat), "statement": n - len(chat), "known": len(known), "unseen": len(unseen),
              "unseen_first": len(unseen_first), "silent": len(silent), "digest": digest_n, "ask": ask_n,
              "wrong_silent": sum(x["silent_wrong"] for x in out)}
    return {
        "synthetic": True, "n": n, "metrics": m, "counts": counts,
        "misclassified": [{"n": x["n"], "item": x["label"], "expected": x["expected_category"], "got": x["category"],
                           "mode": x["mode"], "unseen": x["unseen"]} for x in wrong],
        "chat_failures": [{"n": x["n"], "item": x["label"]} for x in chat if not (x["amount_ok"] and x["merchant_ok"])],
        "method": {
            "en": [
                f"{n} synthetic records modelled on WeChat/Alipay statements and chat phrases (data/bench_set.csv). No real data.",
                "Every record goes through the real code: statement rows via the CSV parser, chat phrases via the chat extractor, then the same merchant-memory seeding and silent/digest/ask rules the app uses, on a temporary in-memory database.",
                "Records are replayed in order. When a record is shown for confirmation, a simulated user answers with the true category, so later records of the same merchant can be recorded silently.",
                "Unseen merchant = not in the built-in dictionary. First sighting = before any feedback, the hardest case.",
                f"Taps: manual entry = {MANUAL_TAPS} (open app, pick category, type amount, save). Ours = 0 when silent, 1 for a digest confirm, 2 for a question.",
                "Wrong-silent = recorded silently with a wrong category (the user never sees it). Extraction = amount and merchant both correct on chat phrases.",
            ],
            "zh": [
                f"{n} 条合成记录，仿照微信/支付宝账单和聊天记账说法（data/bench_set.csv），不含任何真实数据。",
                "每条都走应用的真实代码：账单行经 CSV 解析器，聊天短语经聊天提取器，再走同样的商户记忆初始化与静默/摘要/询问规则，使用临时内存数据库。",
                "记录按顺序回放。需要确认时由模拟用户给出正确类别，因此同一商户之后的记录可以静默入账。",
                "未见商户 = 不在内置词典中；首次出现 = 尚无任何反馈，是最难的情形。",
                f"点击次数：手动记账 = {MANUAL_TAPS} 次（打开应用、选类别、输入金额、保存）；本应用 = 静默 0 次，摘要确认 1 次，询问 2 次。",
                "误静默 = 以错误类别静默入账（用户看不到）。提取准确率 = 聊天短语中金额和商户都正确的比例。",
            ],
        },
    }


def result():
    if "r" not in _cache:
        _cache["r"] = compute()
    return _cache["r"]


def register(GET, POST):
    GET["/api/benchmark"] = lambda c, query: result()
