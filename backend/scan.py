"""Receipt / screenshot recognition.
With ANTHROPIC_API_KEY set, the image goes to Claude vision and comes back as strict JSON.
Without a key we return a clearly flagged DEMO result so the whole flow can be shown offline."""
import json
import os
import re
import urllib.request
from datetime import date
from decimal import Decimal, InvalidOperation

CATEGORIES = ("food_drink", "groceries", "transport", "housing", "subscriptions", "shopping",
              "health", "entertainment", "transfers", "income", "other")
MAX_CENTS = 10 ** 12
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5")
PROMPT = (
    "You read a shop receipt, payment screenshot or order page. Reply with ONLY compact JSON: "
    '{"amount":"12.50","currency":"CNY","date":"YYYY-MM-DD or empty string","merchant":"shop name",'
    '"category":"one of ' + ",".join(CATEGORIES) + '","direction":"out or in","confidence":0.0}. '
    'If nothing is readable reply {"error":"unreadable"}.'
)


def _normalize(raw, demo=False):
    if not isinstance(raw, dict) or raw.get("error"):
        return {"error": "unreadable"}
    try:
        cents = int((Decimal(str(raw.get("amount", "")).replace(",", "").replace("¥", "").strip()) * 100).to_integral_value())
    except (InvalidOperation, ValueError, ArithmeticError):
        return {"error": "unreadable"}
    if cents <= 0 or cents > MAX_CENTS:
        return {"error": "unreadable"}
    d = str(raw.get("date") or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
        d = date.today().isoformat()
    cat = raw.get("category") if raw.get("category") in CATEGORIES else "other"
    try:
        conf = max(0.0, min(1.0, float(raw.get("confidence", 0.6))))
    except (TypeError, ValueError):
        conf = 0.6
    return {"amount_cents": cents, "date": d, "merchant": str(raw.get("merchant") or "Receipt")[:60], "category": cat,
            "direction": "in" if raw.get("direction") == "in" else "out", "confidence": min(conf, 0.8), "demo": demo}


def analyze(image_b64, media_type="image/jpeg"):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _normalize({"amount": "46.00", "merchant": "Hema", "category": "groceries", "confidence": 0.7}, demo=True)
    body = {
        "model": MODEL, "max_tokens": 300,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
            {"type": "text", "text": PROMPT}]}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=json.dumps(body).encode(),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            resp = json.load(r)
        text = "".join(b.get("text", "") for b in resp.get("content", []))
        m = re.search(r"\{.*\}", text, re.S)
        return _normalize(json.loads(m.group(0)) if m else {})
    except Exception:
        return {"error": "ai_failed"}
