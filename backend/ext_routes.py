"""Extension API routes. Each module below may expose register(GET, POST) and add
   GET["/api/x"] = fn(c, query_dict) / POST["/api/x"] = fn(c, body_dict) -> JSON-serializable dict."""
GET, POST = {}, {}
for _name in ("bench", "trust", "insights", "news", "lessons", "learn"):
    try:
        __import__(_name).register(GET, POST)
    except ImportError:
        pass
