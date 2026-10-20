"""Rule-based chat extractor (no API key needed). Same JSON shape as docs/SPEC.md §4.
If ANTHROPIC_API_KEY is set, ai.extract() can replace this; rules remain the fallback."""
import re

import rules

MAX_AMOUNT = 10 ** 10  # yuan; keeps cents under 1e12
_NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?"
_CUR = r"(?:元|块|yuan|rmb|cny|¥|руб|р)"
AMOUNT = re.compile(r"([¥￥])?\s*(?<![0-9A-Za-z.,])(" + _NUM + r")\s*(" + _CUR + r")?(?![0-9.]|[A-Za-z]|-[A-Za-z])", re.I)
TRANSFER_CJK = ("转给", "转账", "红包", "给")
TRANSFER_ASCII = ("transfer", "sent", "send", "red packet", "перевел", "перевёл", "другу", "friend")
INCOME_WORDS = ("工资", "salary", "зарплата", "income", "收到", "received", "получил")
_T_ASCII = re.compile(r"\b(?:" + "|".join(TRANSFER_ASCII) + r")\b", re.I)
_T_STRIP = re.compile("|".join(TRANSFER_CJK) + r"|\b(?:to|" + "|".join(TRANSFER_ASCII) + r")\b", re.I)


def _pick(text):
    ms = list(AMOUNT.finditer(text))
    if not ms:
        return None
    return next((m for m in ms if m.group(1) or m.group(3)), ms[-1])


def parse(text):
    text = (text or "").strip()
    m = _pick(text)
    if not m:
        return None
    n = m.group(2)
    n = n.replace(",", "") if re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?", n) else n.replace(",", ".")
    try:
        amount = float(n)
    except (ValueError, ArithmeticError):
        return None
    if not (0 < amount <= MAX_AMOUNT):
        return None
    rest = (text[:m.start()] + " " + text[m.end():]).strip(" ,.;:-")
    low = text.lower()
    is_in = any(w in low for w in INCOME_WORDS)
    is_transfer = (any(w in low for w in TRANSFER_CJK) or _T_ASCII.search(low) is not None) and not is_in
    cat, disp, conf, known = rules.classify(rest, "")
    if is_in:
        cat, disp, conf, known = "income", rest or "Income", 0.9, False
    if is_transfer and not known:
        name = re.sub(r"\s+", " ", _T_STRIP.sub(" ", rest)).strip(" ,.;:-") or "Friend"
        return _tx(amount, name, "transfers", "out", "person", 0.9, False)
    if not rest:
        disp, conf = "Expense", 0.5
    elif not known:
        conf = 0.6
    return _tx(amount, disp, cat, "in" if is_in else "out", "merchant", conf, known)


def _tx(amount, name, cat, direction, cp, conf, known):
    return {
        "amount_cents": int(round(amount * 100)), "merchant": name, "merchant_key": rules.norm_key(name),
        "category": cat, "direction": direction, "counterparty_type": cp, "confidence": conf, "known": known,
    }
