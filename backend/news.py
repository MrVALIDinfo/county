"""News feed: fixed allowlist of public RSS/Atom feeds, fetched server-side, cached 15 min."""
import hashlib
import html
import re
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

UA = "County/1.0 (+demo)"
TTL = 15 * 60
MAX_BYTES = 1024 * 1024
TIMEOUT = 4
TOTAL_MAX = 60
PER_SOURCE = 12

# Verified reachable from the dev machine (Forbes, Yahoo, Investopedia 404; Caixin 403).
FEEDS = [
    ("BBC Business", "http://feeds.bbci.co.uk/news/business/rss.xml"),
    ("CNBC", "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("WSJ Markets", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain"),
    ("Nasdaq", "https://www.nasdaq.com/feed/rssoutbound?category=Markets"),
    ("SCMP", "https://www.scmp.com/rss/92/feed"),
    ("The Guardian", "https://www.theguardian.com/business/rss"),
]

CATS = ("all", "markets", "economy", "china", "personal")

_lock = threading.Lock()
_cache = {"ts": 0.0, "data": None}


class _HttpOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).scheme not in ("http", "https"):
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_HttpOnly)


def _words(*ws):
    return re.compile(r"\b(?:" + "|".join(ws) + r")\b", re.I)


_CHINA = _words("china", "chinese", "yuan", "renminbi", "rmb", "pboc", "shenzhen", "hong kong",
                "shanghai", "beijing", "alibaba", "tencent", "xi jinping", "huawei", "byd",
                "baidu", "xiaomi", "hang seng", "csi 300")
_ECON = _words("inflation", "interest rates?", "rate cuts?", "rate hikes?", "central bank",
               "fed", "federal reserve", "ecb", "bank of england", "boj", "gdp", "jobs",
               "unemployment", "payrolls", "recession", "tariffs?", "oil", "opec", "economy",
               "economic", "cpi", "trade war")
_PERS = _words("savings?", "budget", "retirement", "pensions?", "mortgages?", "credit cards?",
               "debt", "loans?", "tax", "taxes", "401\\(k\\)", "ira", "household", "bills",
               "cost of living", "renters?", "homeowners?")
_W_RATES = _words("interest rates?", "rate cuts?", "rate hikes?", "central bank", "fed",
                  "federal reserve", "ecb", "bank of england", "boj", "mortgages?", "bond yields?",
                  "treasury yields?")
_W_INFL = _words("inflation", "cpi", "prices", "cost of living")
_W_STOCKS = _words("stocks?", "shares", "equities", "nasdaq", "s&p", "dow", "earnings",
                   "wall street", "index", "markets?", "etf", "ipo", "hang seng")
_W_YUAN = _words("yuan", "renminbi", "rmb", "pboc", "china", "chinese")
_W_SAVE = _words("savings?", "budget", "retirement", "pensions?", "credit cards?", "debt",
                 "loans?", "tax", "taxes", "401\\(k\\)", "ira")
_W_OIL = _words("oil", "opec", "crude", "brent", "gasoline", "energy prices")


def classify(text):
    """Return (category, why) from keyword rules. Educational hint only."""
    t = text or ""
    if _CHINA.search(t):
        cat = "china"
    elif _ECON.search(t):
        cat = "economy"
    elif _PERS.search(t):
        cat = "personal"
    else:
        cat = "markets"
    why = "general"
    for key, rx in (("oil", _W_OIL), ("rates", _W_RATES), ("inflation", _W_INFL),
                    ("yuan", _W_YUAN), ("savings", _W_SAVE), ("stocks", _W_STOCKS)):
        if rx.search(t):
            why = key
            break
    return cat, why


_TAG = re.compile(r"<[^>]*>")
_WS = re.compile(r"\s+")


def _clean(s, limit=None):
    s = html.unescape(_TAG.sub(" ", s or ""))
    s = _WS.sub(" ", s).strip()
    if limit and len(s) > limit:
        s = s[: limit - 1].rstrip() + "…"
    return s


def _parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
    except Exception:
        dt = None
    if dt is None:
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _local(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _child_text(el, names):
    for ch in el:
        if _local(ch.tag) in names and (ch.text or "").strip():
            return ch.text
    return ""


def _entry_url(el):
    for ch in el:
        if _local(ch.tag) == "link":
            href = ch.get("href")
            if href and ch.get("rel", "alternate") == "alternate":
                return href.strip()
            if ch.text and ch.text.strip():
                return ch.text.strip()
    return ""


def _parse_feed(raw, name):
    if b"<!doctype" in raw.lower() or b"<!entity" in raw.lower():
        raise ValueError("doctype")
    root = ET.fromstring(raw)
    out = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        title = _clean(_child_text(el, ("title",)), 160)
        url = _entry_url(el)
        if not title or not url.lower().startswith(("http://", "https://")):
            continue
        desc = _clean(_child_text(el, ("description", "summary", "content")), 600)
        pub = _parse_date(_child_text(el, ("pubDate", "published", "updated", "date")))
        cat, why = classify(title + " " + desc)
        out.append({
            "id": hashlib.sha1(url.encode("utf-8")).hexdigest()[:12],
            "source": name, "title": title, "url": url, "published": pub,
            "category": cat, "why": why,
        })
        if len(out) >= PER_SOURCE:
            break
    return out


def _fetch_one(feed):
    name, url = feed
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
        with _opener.open(req, timeout=TIMEOUT) as r:
            raw = r.read(MAX_BYTES)
        return name, _parse_feed(raw, name)
    except Exception:
        return name, None


def _norm_title(t):
    return re.sub(r"[^a-z0-9一-鿿]+", " ", t.lower()).strip()


def _fallback(now):
    samples = [
        ("Sample: How inflation can slowly reduce what your savings can buy", "inflation", "economy"),
        ("Sample: What an interest rate change can mean for loans and savings accounts", "rates", "economy"),
        ("Sample: Why diversification is a common idea in long-term investing", "stocks", "markets"),
        ("Sample: Understanding exchange-rate moves between the yuan and other currencies", "yuan", "china"),
        ("Sample: Simple monthly budget methods people use to track spending", "savings", "personal"),
        ("Sample: Why oil price swings can show up in everyday costs", "oil", "economy"),
        ("Sample: What a stock market index measures and what it leaves out", "stocks", "markets"),
        ("Sample: Building an emergency fund before investing, explained", "savings", "personal"),
        ("Sample: How central banks use interest rates to influence prices", "rates", "economy"),
        ("Sample: Reading company earnings reports: a beginner overview", "stocks", "markets"),
        ("Sample: What mainland China economic data releases usually cover", "yuan", "china"),
        ("Sample: Credit card interest and why paying the full balance matters", "savings", "personal"),
    ]
    items = []
    for i, (title, why, cat) in enumerate(samples):
        ts = now - timedelta(hours=5 + i * 5)  # spread over ~2.5 days
        items.append({
            "id": hashlib.sha1(("sample" + title).encode()).hexdigest()[:12],
            "source": "Sample feed", "title": title, "url": "",
            "published": ts.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "category": cat, "why": why, "sample": True,
        })
    return items


def _build():
    now = datetime.now(timezone.utc)
    results = {}
    ex = ThreadPoolExecutor(max_workers=len(FEEDS))
    futs = [ex.submit(_fetch_one, f) for f in FEEDS]
    deadline = time.monotonic() + 5.5
    for f in futs:
        try:
            name, items = f.result(timeout=max(0.05, deadline - time.monotonic()))
            results[name] = items
        except Exception:
            pass
    ex.shutdown(wait=False, cancel_futures=True)
    sources, pool = [], []
    for name, _u in FEEDS:
        items = results.get(name)
        sources.append({"name": name, "ok": items is not None, "count": len(items or [])})
        pool.extend(items or [])
    if not pool:
        return {"live": False, "fetched_at": now.isoformat().replace("+00:00", "Z"),
                "sources": sources, "items": _fallback(now),
                "error": "News sources are unavailable right now. Showing sample headlines."}
    pool.sort(key=lambda x: x["published"] or "", reverse=True)
    seen, items, per = set(), [], {}
    for it in pool:
        k = _norm_title(it["title"])
        if k in seen or per.get(it["source"], 0) >= PER_SOURCE:
            continue
        seen.add(k)
        per[it["source"]] = per.get(it["source"], 0) + 1
        items.append(it)
    by = {}  # interleave sources so the feed is not dominated by one publisher
    for it in items:
        by.setdefault(it["source"], []).append(it)
    items = []
    while any(by.values()):
        for name in list(by):
            if by[name]:
                items.append(by[name].pop(0))
    items = items[:TOTAL_MAX]
    return {"live": True, "fetched_at": now.isoformat().replace("+00:00", "Z"),
            "sources": sources, "items": items}


def _get(force=False):
    with _lock:
        now = time.time()
        if not force and _cache["data"] is not None and now - _cache["ts"] < TTL:
            return _cache["data"], True
        data = _build()
        _cache["data"], _cache["ts"] = data, now
        return data, False


def _response(force=False, cat="all"):
    data, cached = _get(force)
    cat = cat if cat in CATS else "all"
    items = data["items"] if cat == "all" else [i for i in data["items"] if i["category"] == cat]
    out = {"live": data["live"], "fetched_at": data["fetched_at"], "cached": cached,
           "sources": data["sources"], "items": items}
    if "error" in data:
        out["error"] = data["error"]
    return out


def register(GET, POST):
    def get_news(c, d):
        cat = d.get("cat", "all") if isinstance(d, dict) else "all"
        if isinstance(cat, list):
            cat = cat[0] if cat else "all"
        return _response(False, str(cat).lower())

    def refresh(c, d):
        return _response(True, "all")

    GET["/api/news"] = get_news
    POST["/api/news/refresh"] = refresh
