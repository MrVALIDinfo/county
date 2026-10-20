"""Updatable lesson packs + research reading list (educational only).

GET  /api/lessons         installed pack, tags, changelog, term of the day
POST /api/lessons/update  advance one pack version (simulated content update)
POST /api/lessons/reset   back to version 1
GET  /api/research        curated public reading list, filtered by installed version
Handlers never raise: every failure degrades to a safe default.
"""
import datetime
import json
import os
import re
import tempfile

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK_DIR = os.path.join(_ROOT, "data", "lessons")
STATE_FILE = os.path.join(_ROOT, "data", "lessons_state.json")


# ---------- state ----------
def _latest():
    best = 1
    try:
        for n in os.listdir(PACK_DIR):
            m = re.fullmatch(r"pack_(\d+)\.json", n)
            if m:
                best = max(best, int(m.group(1)))
    except OSError:
        pass
    return best


def _get_version():
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            v = int(json.load(f)["version"])
        return v if 1 <= v <= _latest() else 1
    except Exception:
        return 1


def _set_version(v):
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(STATE_FILE), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump({"version": v}, f)
        os.replace(tmp, STATE_FILE)
        return True
    except Exception:
        return False


def _load_pack(v):
    try:
        with open(os.path.join(PACK_DIR, "pack_%d.json" % v), encoding="utf-8") as f:
            p = json.load(f)
        if isinstance(p, dict) and isinstance(p.get("topics"), list):
            return p
    except Exception:
        pass
    return None


def _entry(v, p):
    ch = p.get("changelog") or {}
    return {"v": v, "date": p.get("date"), "added": ch.get("added") or [], "updated": ch.get("updated") or [],
            "note_en": ch.get("note_en", ""), "note_zh": ch.get("note_zh", "")}


def _installed():
    """(effective version, pack) falling back to lower versions if a pack is broken."""
    v = _get_version()
    while v >= 1:
        p = _load_pack(v)
        if p:
            return v, p
        v -= 1
    return 0, None


def _term_of_day(pack, d):
    terms = [t for t in (pack or {}).get("terms", []) if isinstance(t, dict)]
    if not terms:
        return None
    try:
        day = datetime.date.fromisoformat(str((d or {}).get("date", ""))[:10])
    except Exception:
        day = datetime.date.today()
    return terms[day.timetuple().tm_yday % len(terms)]


# ---------- handlers ----------
def get_lessons(c, d):
    try:
        latest = _latest()
        v, pack = _installed()
        if not pack:
            return {"version": 1, "latest_version": latest, "has_update": False, "updated_at": None,
                    "topics": [], "changelog": [], "term_of_day": None, "error": "pack_unavailable"}
        ch = pack.get("changelog") or {}
        added, updated = set(ch.get("added") or []), set(ch.get("updated") or [])
        topics = []
        for t in pack["topics"]:
            t = dict(t)
            t["tag"] = "new" if v > 1 and t.get("id") in added else ("updated" if v > 1 and t.get("id") in updated else None)
            topics.append(t)
        log = []
        for n in range(v, 1, -1):
            p = pack if n == v else _load_pack(n)
            if p:
                log.append(_entry(n, p))
        return {"version": v, "latest_version": latest, "has_update": v < latest, "updated_at": pack.get("date"),
                "topics": topics, "changelog": log, "term_of_day": _term_of_day(pack, d)}
    except Exception:
        return {"version": 1, "latest_version": 1, "has_update": False, "updated_at": None,
                "topics": [], "changelog": [], "term_of_day": None, "error": "pack_unavailable"}


def post_update(c, d):
    try:
        cur, latest = _get_version(), _latest()
        if cur >= latest:
            return {"updated": False, "from": cur, "to": cur, "changelog": None}
        nxt = cur + 1
        p = _load_pack(nxt)
        if not p or not _set_version(nxt):
            return {"updated": False, "from": cur, "to": cur, "changelog": None, "error": "update_failed"}
        return {"updated": True, "from": cur, "to": nxt, "changelog": _entry(nxt, p)}
    except Exception:
        return {"updated": False, "from": 1, "to": 1, "changelog": None, "error": "update_failed"}


def post_reset(c, d):
    _set_version(1)
    return {"version": 1}


# ---------- research reading list ----------
# (id, publisher, type, level, region, added_in, title_en, title_zh, desc_en, desc_zh, url)
_R = [
 ("investor_intro", "SEC Investor.gov", "guide", "beginner", "global", 1,
  "Introduction to Investing", "投资入门",
  "Plain-language basics from the US securities regulator's education site.", "美国证券监管机构教育网站的通俗入门内容。",
  "https://www.investor.gov/introduction-investing"),
 ("finra_learn", "FINRA", "guide", "beginner", "global", 1,
  "Learn to Invest", "学习投资",
  "Short explainers on how investing works and how to think about risk.", "简明讲解投资如何运作，以及如何看待风险。",
  "https://www.finra.org/investors/learn-to-invest"),
 ("investor_glossary", "SEC Investor.gov", "guide", "beginner", "global", 1,
  "Investing glossary", "投资术语表",
  "Look up common investing terms in simple words.", "用简单的话查询常见投资术语。",
  "https://www.investor.gov/introduction-investing/investing-basics/glossary"),
 ("pbc", "People's Bank of China", "data", "beginner", "china", 1,
  "PBoC official site", "中国人民银行官网",
  "Official source for policy rates, payment rules and financial-knowledge notices.", "政策利率、支付规则及金融知识公告的官方来源。",
  "https://www.pbc.gov.cn/"),
 ("csrc", "China Securities Regulatory Commission", "guide", "beginner", "china", 1,
  "CSRC official site", "中国证监会官网",
  "Securities regulator: rules, investor-protection notices and risk warnings.", "证券监管机构：规则、投资者保护公告与风险提示。",
  "https://www.csrc.gov.cn/"),
 ("sipf", "China Securities Investor Protection Fund", "guide", "beginner", "china", 1,
  "Investor protection and education", "投资者保护与教育",
  "Education pages for retail investors in China.", "面向中国个人投资者的教育内容。",
  "https://www.sipf.com.cn/"),
 ("findex", "World Bank", "data", "intermediate", "global", 1,
  "Global Findex Database", "全球普惠金融指数数据库",
  "Survey data on how adults around the world save, borrow and pay.", "关于全球成年人如何储蓄、借贷和支付的调查数据。",
  "https://www.worldbank.org/en/publication/globalfindex"),
 ("wb_cpi", "World Bank", "data", "beginner", "global", 2,
  "Inflation, consumer prices (data)", "消费者价格通胀（数据）",
  "Compare yearly price changes across countries over time.", "对比各国历年的物价变化。",
  "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG"),
 ("nbs", "National Bureau of Statistics of China", "data", "intermediate", "china", 2,
  "Official statistics portal", "国家统计局官网",
  "Official CPI and other national economic statistics.", "官方居民消费价格指数（CPI）及其他国民经济统计。",
  "https://www.stats.gov.cn/"),
 ("imf_weo", "IMF", "report", "intermediate", "global", 2,
  "World Economic Outlook", "世界经济展望",
  "The IMF's regular report on the global economy, growth and inflation.", "国际货币基金组织关于全球经济、增长与通胀的定期报告。",
  "https://www.imf.org/en/Publications/WEO"),
 ("vanguard_edu", "Vanguard", "guide", "beginner", "global", 2,
  "Investor education resources", "投资者教育资源",
  "Articles on saving, fees and long-term investing basics.", "关于储蓄、费用和长期投资基础的文章。",
  "https://investor.vanguard.com/investor-resources-education"),
 ("moneyhelper", "MoneyHelper (UK)", "guide", "beginner", "global", 2,
  "Investing basics", "投资基础",
  "Free, impartial UK guidance on saving, investing and goals.", "英国提供的免费、中立的储蓄、投资与目标规划指引。",
  "https://www.moneyhelper.org.uk/en/savings/investing"),
 ("finra_protect", "FINRA", "guide", "beginner", "global", 3,
  "Protect Your Money", "保护你的资金",
  "How to spot and avoid investment fraud and unsolicited offers.", "如何识别并避开投资欺诈和陌生推销。",
  "https://www.finra.org/investors/protect-your-money"),
 ("fca_scam", "UK FCA", "guide", "beginner", "global", 3,
  "Protect yourself from scams", "防范诈骗",
  "Red flags and checks for investment scams from the UK regulator.", "英国监管机构提供的投资骗局红灯与核查方法。",
  "https://www.fca.org.uk/scamsmart"),
 ("iosco", "IOSCO", "guide", "intermediate", "global", 3,
  "Investor protection and education", "投资者保护与教育",
  "International securities regulators' pages on investor protection.", "国际证券监管机构组织关于投资者保护的页面。",
  "https://www.iosco.org/investor_protection/"),
 ("oecd_fe", "OECD", "report", "intermediate", "global", 3,
  "Financial education", "金融教育",
  "OECD work on financial literacy and consumer protection.", "经合组织关于金融素养与消费者保护的研究。",
  "https://www.oecd.org/en/topics/financial-education.html"),
 ("cfa_refresher", "CFA Institute", "course", "intermediate", "global", 3,
  "Refresher readings", "复习读本",
  "Free professional-level readings on investment topics.", "免费的专业级投资主题读本。",
  "https://www.cfainstitute.org/insights/professional-learning/refresher-readings"),
 ("nfra", "NFRA (China)", "guide", "beginner", "china", 3,
  "Banking and insurance regulator", "国家金融监督管理总局",
  "Official consumer-protection notices on banks and insurance in China.", "关于中国银行业与保险业的官方消费者保护公告。",
  "https://www.nfra.gov.cn/"),
]
_KEYS = ("id", "publisher", "type", "level", "region", "added_in", "title_en", "title_zh", "desc_en", "desc_zh", "url")


def get_research(c, d):
    try:
        v = _get_version()
        items = []
        for r in _R:
            it = dict(zip(_KEYS, r))
            if it["added_in"] <= v:
                it["new"] = v > 1 and it["added_in"] == v
                items.append(it)
        return {"items": items, "version": v}
    except Exception:
        return {"items": [], "version": 1}


def register(GET, POST):
    GET["/api/lessons"] = get_lessons
    GET["/api/research"] = get_research
    POST["/api/lessons/update"] = post_update
    POST["/api/lessons/reset"] = post_reset
