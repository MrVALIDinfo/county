"""Merchant memory + the three modes: silent / digest / ask."""
import re
import statistics

# --- thresholds (see docs/SPEC.md §3) ---
SILENT_MIN_CONFIRMED = 2
SILENT_MIN_CONF = 0.85
ASK_MAX_CONF = 0.5
OUTLIER_MAD_K = 3
MAD_FLOOR_RATIO = 0.15
LARGE_INCOME_RATIO = 0.2
LARGE_CAT_MULT = 3
CONFIRM_WEIGHT = 2  # an explicit user confirmation counts as 2 (bot stops asking after one answer)

# (keyword lowercase, display name, category). Built-in merchant priors.
BRANDS = [
    ("瑞幸", "Luckin Coffee", "food_drink"), ("luckin", "Luckin Coffee", "food_drink"),
    ("星巴克", "Starbucks", "food_drink"), ("starbucks", "Starbucks", "food_drink"),
    ("美团", "Meituan", "food_drink"), ("meituan", "Meituan", "food_drink"),
    ("饿了么", "Ele.me", "food_drink"), ("喜茶", "HeyTea", "food_drink"),
    ("麦当劳", "McDonald's", "food_drink"), ("肯德基", "KFC", "food_drink"),
    ("盒马", "Hema", "groceries"), ("hema", "Hema", "groceries"),
    ("全家", "FamilyMart", "groceries"), ("7-eleven", "7-Eleven", "groceries"),
    ("罗森", "Lawson", "groceries"), ("叮咚", "Dingdong", "groceries"),
    ("滴滴", "DiDi", "transport"), ("didi", "DiDi", "transport"),
    ("地铁", "Metro", "transport"), ("哈啰", "Hello Bike", "transport"),
    ("链家", "Rent", "housing"), ("房租", "Rent", "housing"), ("rent", "Rent", "housing"),
    ("中国移动", "China Mobile", "subscriptions"), ("爱奇艺", "iQIYI", "subscriptions"),
    ("网易云", "NetEase Music", "subscriptions"), ("spotify", "Spotify", "subscriptions"),
    ("淘宝", "Taobao", "shopping"), ("taobao", "Taobao", "shopping"),
    ("京东", "JD.com", "shopping"), ("拼多多", "Pinduoduo", "shopping"),
    ("优衣库", "Uniqlo", "shopping"), ("天猫", "Tmall", "shopping"),
    ("药房", "Pharmacy", "health"), ("健身", "Gym", "health"),
    ("电影", "Cinema", "entertainment"), ("steam", "Steam", "entertainment"),
    ("工资", "Salary", "income"), ("salary", "Salary", "income"),
]
GENERIC = [
    ("coffee", "food_drink"), ("咖啡", "food_drink"), ("кофе", "food_drink"),
    ("午饭", "food_drink"), ("lunch", "food_drink"), ("обед", "food_drink"),
    ("外卖", "food_drink"), ("餐", "food_drink"),
    ("打车", "transport"), ("taxi", "transport"), ("такси", "transport"),
    ("超市", "groceries"), ("grocer", "groceries"), ("продукты", "groceries"),
]
SELF_TYPES = ("提现", "充值", "信用卡还款", "零钱通", "withdraw", "top-up")
PERSON_TYPES = ("转账", "红包", "transfer", "red packet")
FLEX_EXCLUDED = ("housing", "subscriptions", "income")


def norm_key(s):
    low = (s or "").lower()
    return re.sub(r"[\W_]+", "", low) or low.strip()


def _has(text, kw):
    if not kw.isascii():  # CJK / Cyrillic keywords: plain substring
        return kw in text
    return re.search(r"(?<![a-z0-9])" + re.escape(kw) + r"(?:s|es|y|ies)?(?![a-z0-9])", text) is not None


def classify(name, note=""):
    """-> (category, display, confidence, known_prior)"""
    text = f"{name} {note}".lower()
    for kw, disp, cat in BRANDS:
        if _has(text, kw):
            return cat, disp, 0.92, True
    for kw, cat in GENERIC:
        if _has(text, kw):
            return cat, name or kw, 0.9, True
    return "other", name, 0.6, False


def _hist(c, where, args, days=None):
    rows = c.execute(
        f"SELECT amount_cents FROM transactions WHERE direction='out' AND status IN ('auto','confirmed') AND {where}",
        args,
    ).fetchall()
    return [r[0] for r in rows]


def decide_ex(c, tx, income_cents):
    """-> (mode, reason). mode: silent | digest | ask. reason explains why a record needs a look."""
    amt = tx["amount_cents"]
    if tx["direction"] == "in":
        big = income_cents > 0 and amt >= LARGE_INCOME_RATIO * income_cents and tx["counterparty_type"] == "person"
        return ("ask", "income_big") if big else ("silent", None)
    if tx["counterparty_type"] == "person":
        return "ask", "person"
    if tx["confidence"] < ASK_MAX_CONF:
        return "ask", "unclear"
    if tx["category"] not in ("housing",):
        cat_hist = _hist(c, "category=?", (tx["category"],))
        limit = LARGE_INCOME_RATIO * income_cents
        if len(cat_hist) >= 5:
            limit = max(LARGE_CAT_MULT * statistics.median(cat_hist), limit)
        if income_cents > 0 and amt > limit:
            return "ask", "large"
    mem = c.execute("SELECT * FROM merchant_memory WHERE merchant_key=?", (tx["merchant_key"],)).fetchone()
    if mem and mem["n_confirmed"] >= SILENT_MIN_CONFIRMED and tx["confidence"] >= SILENT_MIN_CONF:
        hist = _hist(c, "merchant_key=?", (tx["merchant_key"],))
        if len(hist) >= 3:
            med = statistics.median(hist)
            mad = statistics.median([abs(x - med) for x in hist])
            tol = OUTLIER_MAD_K * max(mad, MAD_FLOOR_RATIO * med)
            if abs(amt - med) > tol:
                return "digest", "unusual"
        return "silent", None
    return "digest", ("unsure" if mem else "new")


def decide(c, tx, income_cents):
    return decide_ex(c, tx, income_cents)[0]


def learn(c, merchant_key, category, weight=CONFIRM_WEIGHT):
    c.execute(
        "INSERT INTO merchant_memory(merchant_key,category,n_confirmed) VALUES(?,?,?) "
        "ON CONFLICT(merchant_key) DO UPDATE SET category=excluded.category, n_confirmed=n_confirmed+?",
        (merchant_key, category, weight, weight),
    )
