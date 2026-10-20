"""WeChat Pay / generic CSV statement -> normalized rows (docs/SPEC.md §2)."""
import csv
import io
import re
from decimal import Decimal, InvalidOperation

import rules

HEADERS = {
    "time": ("交易时间", "date", "time"),
    "type": ("交易类型", "type"),
    "party": ("交易对方", "merchant", "counterparty"),
    "item": ("商品", "item", "note", "description"),
    "io": ("收/支", "direction", "io"),
    "amount": ("金额", "amount"),
    "status": ("当前状态", "status"),
    "id": ("交易单号", "id"),
}
MAX_CENTS = 10 ** 12
OUT = ("支出", "out", "expense")
IN = ("收入", "in", "income")


def _col(header, name):
    for i, h in enumerate(header):
        h = h.strip().lower()
        if any(h.startswith(a) for a in HEADERS[name]):
            return i
    return None


def _cents(s):
    s = re.sub(r"[¥￥,\s]", "", s or "")
    try:
        v = int((Decimal(s) * 100).to_integral_value())
    except (InvalidOperation, ValueError, ArithmeticError):
        return None
    return v if abs(v) <= MAX_CENTS else None


def parse(text):
    """-> (rows, skipped). Each row: date, amount_cents, merchant, merchant_key, category, direction,
    counterparty_type, confidence, known, ext_id, raw."""
    text = text.lstrip("﻿")
    reader = list(csv.reader(io.StringIO(text)))
    hi = next((i for i, r in enumerate(reader) if r and (r[0].strip().startswith("交易时间") or r[0].strip().lower() in ("date", "time"))), None)
    if hi is None:
        return [], 0
    header = reader[hi]
    idx = {k: _col(header, k) for k in HEADERS}
    if idx["time"] is None or idx["amount"] is None:
        return [], 0
    rows, skipped = [], 0
    for r in reader[hi + 1:]:
        if not r or len(r) <= max(i for i in idx.values() if i is not None):
            if r:
                skipped += 1
            continue
        get = lambda k: r[idx[k]].strip() if idx[k] is not None else ""
        d = re.match(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", get("time"))
        cents = _cents(get("amount"))
        io_ = get("io").lower()
        direction = "out" if io_ in OUT else ("in" if io_ in IN else None)
        st, ty = get("status"), get("type")
        if (not d or cents is None or cents <= 0 or direction is None or "失败" in st
                or "退款" in st or "退款" in ty):
            skipped += 1
            continue
        party, item, typ = get("party"), get("item"), get("type")
        key_text = party if party and party != "/" else item
        iso = f"{int(d.group(1)):04d}-{int(d.group(2)):02d}-{int(d.group(3)):02d}"
        if any(w in typ.lower() for w in rules.SELF_TYPES):
            cp, cat, disp, conf, known = "self", "transfers", key_text or typ, 1.0, False
            direction = "transfer"
        else:
            cat, disp, conf, known = rules.classify(key_text, item)
            cp = "merchant"
            if cat == "income":
                direction = "in"
            elif any(w in typ.lower() for w in rules.PERSON_TYPES):
                cp, cat, disp, conf, known = "person", "transfers", key_text, 0.9, False
        rows.append({
            "date": iso, "amount_cents": cents, "merchant": disp, "merchant_key": rules.norm_key(disp),
            "category": cat, "direction": direction, "counterparty_type": cp, "confidence": conf,
            "known": known, "ext_id": get("id") or None, "raw": ",".join(r)[:300],
        })
    return rows, skipped
