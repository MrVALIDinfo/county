"""trust extension routes: read-only data export (PIPL data-portability)."""
import json
from datetime import datetime, timezone

TX_FIELDS = ("id", "date", "amount_cents", "currency", "merchant", "category", "direction",
             "counterparty_type", "source", "confidence", "status", "mode", "reason")


def export_all(c, q=None):
    p = c.execute("SELECT payday_day,income_cents,fixed_json,currency FROM profile WHERE id=1").fetchone()
    profile = None
    if p:
        try:
            fixed = json.loads(p["fixed_json"] or "[]")
        except ValueError:
            fixed = []
        profile = {"payday_day": p["payday_day"], "income_cents": p["income_cents"],
                   "fixed_expenses": fixed, "currency": p["currency"]}
    goals = [dict(r) for r in c.execute("SELECT id,name,target_cents,deadline,saved_cents FROM goals ORDER BY id")]
    txs = [{k: r[k] for k in TX_FIELDS} for r in
           c.execute("SELECT " + ",".join(TX_FIELDS) + " FROM transactions ORDER BY date,id")]
    mem = [dict(r) for r in c.execute("SELECT merchant_key,category,n_confirmed FROM merchant_memory ORDER BY merchant_key")]
    return {"exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "note": "Amounts are in cents. Synthetic demo data unless you imported your own.",
            "profile": profile, "goals": goals, "transactions": txs, "merchant_memory": mem}


def register(GET, POST):
    GET["/api/export"] = export_all
