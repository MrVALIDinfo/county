"""Money logic: forecast, rules, parse_csv, chatparse, service, advisor, bench. Today is fixed per test."""
import json
import math
import unittest
from datetime import date, timedelta

from tests.helpers import DBCase, add_tx

import advisor
import bench
import chatparse
import forecast
import parse_csv
import rules
import service

TODAY = date(2026, 10, 20)


def setup_profile(c, payday=10, income=1000000, fixed=None):
    c.execute("UPDATE profile SET payday_day=?, income_cents=?, fixed_json=? WHERE id=1",
              (payday, income, json.dumps(fixed or [])))
    c.commit()


def add_goal(c, name, target, saved, deadline):
    c.execute("INSERT INTO goals(name,target_cents,deadline,saved_cents) VALUES(?,?,?,?)", (name, target, deadline, saved))
    c.commit()


class TestCycle(unittest.TestCase):
    def test_payday_31_in_short_month(self):
        # Feb has 28 days in 2026: payday 31 -> 28th
        self.assertEqual(forecast.cycle(date(2026, 2, 15), 31), (date(2026, 1, 31), date(2026, 2, 28)))
        self.assertEqual(forecast.cycle(date(2026, 2, 28), 31), (date(2026, 2, 28), date(2026, 3, 31)))
        self.assertEqual(forecast.cycle(date(2026, 3, 1), 31), (date(2026, 2, 28), date(2026, 3, 31)))
        # 30-day month
        self.assertEqual(forecast.cycle(date(2026, 4, 30), 31), (date(2026, 4, 30), date(2026, 5, 31)))

    def test_leap_year(self):
        self.assertEqual(forecast.cycle(date(2028, 2, 10), 31), (date(2028, 1, 31), date(2028, 2, 29)))

    def test_payday_today_starts_new_cycle(self):
        s, n = forecast.cycle(date(2026, 10, 10), 10)
        self.assertEqual((s, n), (date(2026, 10, 10), date(2026, 11, 10)))

    def test_day_before_payday(self):
        s, n = forecast.cycle(date(2026, 10, 9), 10)
        self.assertEqual((s, n), (date(2026, 9, 10), date(2026, 10, 10)))
        self.assertEqual((n - date(2026, 10, 9)).days, 1)

    def test_year_boundary(self):
        self.assertEqual(forecast.cycle(date(2026, 12, 20), 10), (date(2026, 12, 10), date(2027, 1, 10)))
        self.assertEqual(forecast.cycle(date(2027, 1, 5), 10), (date(2026, 12, 10), date(2027, 1, 10)))

    def test_add_months_clamps(self):
        self.assertEqual(forecast.add_months(date(2026, 1, 31), 1), date(2026, 2, 28))
        self.assertEqual(forecast.add_months(date(2026, 11, 30), 3), date(2027, 2, 28))


class TestDashboardDemo(DBCase):
    def setUp(self):
        super().setUp()
        service.load_demo(self.c, TODAY)
        self.d = forecast.dashboard(self.c, TODAY)

    def test_cycle_and_counts(self):
        d = self.d
        self.assertEqual(d["cycle"], {"start": "2026-10-10", "next_payday": "2026-11-10", "days": 31, "days_left": 21})
        self.assertEqual(d["tx_count"], 371)
        self.assertTrue(d["has_data"])

    def test_integers_and_allowance(self):
        d = self.d
        for k in ("income_cents", "spent_cents", "balance_cents", "free_cents", "allowance_cents",
                  "avg_flex_cents", "goal_reserve_cents", "upcoming_fixed_cents"):
            self.assertIsInstance(d[k], int, k)
        self.assertEqual(d["allowance_cents"], max(0, d["free_cents"] // d["cycle"]["days_left"]))

    def test_free_money_formula(self):
        d = self.d
        self.assertEqual(d["balance_cents"], d["income_cents"] - d["spent_cents"])
        self.assertEqual(d["free_cents"], d["balance_cents"] - d["upcoming_fixed_cents"] - d["goal_reserve_cents"])
        self.assertEqual(d["income_cents"], 1500000)       # detected salary, not the profile fallback
        self.assertEqual(d["upcoming_fixed_cents"], 320000)  # rent on Nov 1 falls before payday

    def test_goal_reserve_is_sum_of_monthly_needed(self):
        d = self.d
        self.assertEqual(d["goal_reserve_cents"], sum(g["monthly_needed_cents"] for g in d["goals"]))
        for g in d["goals"]:
            self.assertEqual(g["monthly_needed_cents"], math.ceil(g["remaining_cents"] / g["months_left"]))

    def test_status_rule(self):
        d = self.d
        want = "over" if d["free_cents"] < 0 else ("tight" if d["avg_flex_cents"] > d["allowance_cents"] else "ok")
        self.assertEqual(d["status"], want)
        self.assertEqual(d["status"], "tight")  # demo is calibrated tight before the Japan deposit

    def test_japan_deposit_flips_tight_to_ok(self):
        japan = next(g for g in self.d["goals"] if g["name"] == "Japan trip")
        service.deposit_goal(self.c, japan["id"], 100000)
        self.assertEqual(forecast.dashboard(self.c, TODAY)["status"], "ok")

    def test_strip_covers_cycle(self):
        strip = self.d["strip"]
        self.assertEqual(len(strip), 31)
        self.assertEqual([s["state"] for s in strip].count("today"), 1)
        self.assertTrue(all(s["state"] == "future" for s in strip if s["date"] > "2026-10-20"))

    def test_deterministic(self):
        again = forecast.dashboard(self.c, TODAY)
        self.assertEqual(json.dumps(again, sort_keys=True), json.dumps(self.d, sort_keys=True))


class TestDashboardCrafted(DBCase):
    def setUp(self):
        super().setUp()
        setup_profile(self.c)  # payday 10, income 10 000 yuan, no fixed

    def dash(self):
        return forecast.dashboard(self.c, TODAY)

    def test_no_goals(self):
        add_tx(self.c, "2026-10-15", 100000, cat="shopping")
        d = self.dash()
        self.assertEqual(d["goals"], [])
        self.assertEqual(d["goal_reserve_cents"], 0)
        self.assertEqual(d["free_cents"], 1000000 - 100000)
        self.assertEqual(d["allowance_cents"], 900000 // 21)
        self.assertEqual(d["status"], "ok")
        self.assertTrue(all(a["days_faster"] is None for a in d["advice"]))

    def test_empty_db(self):
        d = self.dash()
        self.assertFalse(d["has_data"])
        self.assertEqual(d["spent_cents"], 0)
        self.assertEqual(d["income_cents"], 1000000)

    def test_income_detection_only_category_income(self):
        add_tx(self.c, "2026-10-10", 1500000, "Salary", cat="income", direction="in")
        d = self.dash()
        self.assertEqual(d["income_cents"], 1500000)
        # refunds / friend transfers / pre-cycle salary must not count
        add_tx(self.c, "2026-10-12", 12900, "Taobao", cat="shopping", direction="in")
        add_tx(self.c, "2026-10-13", 8800, "Wang", cat="transfers", direction="in", cp="person")
        add_tx(self.c, "2026-09-10", 700000, "Salary", cat="income", direction="in")
        self.assertEqual(self.dash()["income_cents"], 1500000)

    def test_income_falls_back_to_profile_when_none_detected(self):
        add_tx(self.c, "2026-10-12", 12900, "Taobao", cat="shopping", direction="in")
        self.assertEqual(self.dash()["income_cents"], 1000000)

    def test_pending_ask_excluded_digest_included(self):
        add_tx(self.c, "2026-10-15", 5000, "A", status="pending", mode="ask")
        add_tx(self.c, "2026-10-15", 7000, "B", status="pending", mode="digest")
        self.assertEqual(self.dash()["spent_cents"], 7000)

    def test_status_ok_tight_over(self):
        add_tx(self.c, "2026-10-15", 100000)
        self.assertEqual(self.dash()["status"], "ok")
        for i in range(14):  # 50 000 per day inside the 14-day window
            add_tx(self.c, (TODAY - timedelta(days=i)).isoformat(), 50000, f"S{i}")
        d = self.dash()
        self.assertGreater(d["avg_flex_cents"], d["allowance_cents"])
        self.assertEqual(d["status"], "tight")
        add_tx(self.c, "2026-10-16", 500000, "Big")
        d = self.dash()
        self.assertLess(d["free_cents"], 0)
        self.assertEqual((d["status"], d["allowance_cents"]), ("over", 0))

    def test_fixed_costs_only_before_payday_and_flex_excludes_housing(self):
        setup_profile(self.c, fixed=[{"name": "rent", "amount_cents": 320000, "day": 1},
                                     {"name": "gym", "amount_cents": 30000, "day": 21},
                                     {"name": "late", "amount_cents": 99999, "day": 10}])
        # window is today+1 .. payday-1: Oct 21 .. Nov 9 -> rent (Nov 1) + gym (Oct 21); day 10 is payday itself
        self.assertEqual(self.dash()["upcoming_fixed_cents"], 350000)
        add_tx(self.c, "2026-10-15", 320000, "Rent", cat="housing")
        self.assertEqual(self.dash()["avg_flex_cents"], 0)

    def test_goal_reserve_and_eta(self):
        add_goal(self.c, "Trip", 600000, 0, "2026-12-19")  # 60 days -> 2 months -> 300 000 / month
        add_tx(self.c, "2026-10-15", 100000)
        d = self.dash()
        g = d["goals"][0]
        self.assertEqual((g["monthly_needed_cents"], d["goal_reserve_cents"]), (300000, 300000))
        self.assertEqual(d["free_cents"], 900000 - 300000)
        avg = 100000 // 14
        proj = 1000000 - avg * 30
        self.assertEqual(d["projected_saving_cents"], proj)
        self.assertEqual(g["status"], "ahead")  # pace >= 110 % of needed
        self.assertEqual(g["projected_date"], (TODAY + timedelta(days=int(600000 / proj * 30))).isoformat())

    def test_goal_behind_has_no_eta(self):
        add_goal(self.c, "Trip", 600000, 0, "2026-12-19")
        for i in range(14):
            add_tx(self.c, (TODAY - timedelta(days=i)).isoformat(), 50000, f"S{i}")
        g = self.dash()["goals"][0]
        self.assertEqual(g["status"], "behind")
        self.assertIsNone(g["projected_date"])

    def test_completed_goal_is_ahead(self):
        add_goal(self.c, "Done", 500000, 500000, "2026-12-19")
        add_goal(self.c, "Over", 500000, 900000, "2026-12-19")
        d = self.dash()
        for g in d["goals"]:
            self.assertEqual((g["status"], g["remaining_cents"], g["monthly_needed_cents"]), ("ahead", 0, 0))
            self.assertEqual(g["projected_date"], "2026-10-20")
            self.assertEqual(g["progress"], 1.0)
        self.assertEqual(d["goal_reserve_cents"], 0)

    def test_goal_past_deadline_and_bad_deadline(self):
        add_goal(self.c, "Late", 100000, 0, "2026-09-01")
        add_goal(self.c, "Bad", 100000, 0, "not-a-date")
        d = self.dash()
        late, bad = d["goals"][0], d["goals"][1]  # ordered by deadline (ISO string sort)
        self.assertEqual((late["name"], late["months_left"], late["monthly_needed_cents"]), ("Late", 1, 100000))
        self.assertEqual((bad["name"], bad["months_left"], bad["monthly_needed_cents"]), ("Bad", 7, 100000 // 7 + 1))


class TestAdvisor(DBCase):
    def setUp(self):
        super().setUp()
        service.load_demo(self.c, TODAY)
        self.d = forecast.dashboard(self.c, TODAY)

    def test_budget_plan_matches_forecast(self):
        p = advisor.budget_plan(self.d)
        self.assertEqual(p["allowance_cents"], self.d["allowance_cents"])
        self.assertEqual(p["status"], self.d["status"])
        self.assertEqual(p["days_left"], 21)
        self.assertEqual(p["top_category"], self.d["advice"][0]["category"])

    def test_save_plan_numbers(self):
        p = advisor.save_plan(self.d, TODAY)
        self.assertEqual(len(p["steps"]), 3)
        for s, a in zip(p["steps"], self.d["advice"]):
            self.assertEqual(s["category"], a["category"])
            self.assertEqual(s["monthly_cents"], int(a["saving_cents"] / 21 * 30))
        self.assertEqual(p["total_monthly_cents"], sum(s["monthly_cents"] for s in p["steps"]))
        self.assertEqual(p["goal"]["name"], "MacBook Air")  # first active goal

    def test_goal_plan_consistent_with_dashboard(self):
        g = next(x for x in self.d["goals"] if x["name"] == "Japan trip")
        p = advisor.goal_plan(self.d, g["id"], TODAY)
        self.assertEqual(p["intent"], "goal")
        self.assertEqual(p["eta_now"], g["projected_date"])
        self.assertEqual(p["extra_monthly_cents"], sum(s["monthly_cents"] for s in p["steps"]))
        self.assertLessEqual(p["eta_new"], p["eta_now"])
        self.assertEqual(p["days_faster"], (date.fromisoformat(p["eta_now"]) - date.fromisoformat(p["eta_new"])).days)
        self.assertEqual(p["on_time"], p["eta_new"] <= g["deadline"])

    def test_goal_plan_done_and_none(self):
        self.c.execute("DELETE FROM goals")
        self.c.commit()
        d = forecast.dashboard(self.c, TODAY)
        self.assertEqual(advisor.goal_plan(d, 1, TODAY), {"intent": "no_goal"})
        add_goal(self.c, "Done", 100, 100, "2027-01-01")
        d = forecast.dashboard(self.c, TODAY)
        self.assertEqual(advisor.goal_plan(d, None, TODAY)["intent"], "goal_done")

    def test_classify(self):
        self.assertEqual(advisor.classify("how to save money", self.d), ("save", None))
        self.assertEqual(advisor.classify("japan trip faster?", self.d)[0], "goal")
        self.assertEqual(advisor.classify("hello", self.d), ("budget", None))


class TestRules(DBCase):
    def dx(self, income=1000000, **kw):
        tx = dict(amount_cents=3000, direction="out", counterparty_type="merchant", confidence=0.9,
                  category="food_drink", merchant_key="newplace")
        tx.update(kw)
        return rules.decide_ex(self.c, tx, income)

    def test_person(self):
        self.assertEqual(self.dx(counterparty_type="person", category="transfers"), ("ask", "person"))

    def test_unclear(self):
        self.assertEqual(self.dx(confidence=0.4), ("ask", "unclear"))
        self.assertEqual(self.dx(confidence=0.5)[1], "new")  # boundary: 0.5 is not unclear

    def test_large_vs_income(self):
        self.assertEqual(self.dx(amount_cents=200001), ("ask", "large"))
        self.assertEqual(self.dx(amount_cents=200000)[0], "digest")

    def test_large_uses_category_median_when_history(self):
        for i in range(5):
            add_tx(self.c, f"2026-10-0{i+1}", 100000, f"M{i}", cat="shopping")
        # median 100000 -> limit max(300000, 200000) = 300000
        self.assertEqual(self.dx(category="shopping", amount_cents=250000)[0], "digest")
        self.assertEqual(self.dx(category="shopping", amount_cents=300001), ("ask", "large"))

    def test_housing_never_large(self):
        self.assertEqual(self.dx(category="housing", amount_cents=320000, merchant_key="rent")[0], "digest")

    def test_income_zero_disables_large(self):
        self.assertEqual(self.dx(income=0, amount_cents=99999999), ("digest", "new"))

    def test_new_and_unsure(self):
        self.assertEqual(self.dx(), ("digest", "new"))
        rules.learn(self.c, "newplace", "food_drink", weight=1)
        self.assertEqual(self.dx(), ("digest", "unsure"))

    def test_silent_after_learning(self):
        rules.learn(self.c, "newplace", "food_drink")  # one explicit confirmation = weight 2
        self.assertEqual(self.dx(), ("silent", None))
        self.assertEqual(self.dx(confidence=0.8), ("digest", "unsure"))  # below SILENT_MIN_CONF

    def test_unusual_amount_for_known_merchant(self):
        rules.learn(self.c, "newplace", "food_drink")
        for i in range(3):
            add_tx(self.c, f"2026-10-0{i+1}", 1000, "NewPlace", status="confirmed")
        self.assertEqual(self.dx(amount_cents=1100), ("silent", None))
        self.assertEqual(self.dx(amount_cents=5000), ("digest", "unusual"))

    def test_income_rows(self):
        self.assertEqual(self.dx(direction="in", category="income", amount_cents=1500000), ("silent", None))
        self.assertEqual(self.dx(direction="in", counterparty_type="person", amount_cents=200000), ("ask", "income_big"))
        self.assertEqual(self.dx(direction="in", counterparty_type="person", amount_cents=199999), ("silent", None))
        self.assertEqual(self.dx(income=0, direction="in", counterparty_type="person", amount_cents=999999), ("silent", None))

    def test_learn_weight(self):
        def n():
            return self.c.execute("SELECT n_confirmed FROM merchant_memory WHERE merchant_key='k'").fetchone()[0]
        rules.learn(self.c, "k", "shopping")
        self.assertEqual(n(), rules.CONFIRM_WEIGHT)
        rules.learn(self.c, "k", "groceries")
        self.assertEqual(n(), 2 * rules.CONFIRM_WEIGHT)
        self.assertEqual(self.c.execute("SELECT category FROM merchant_memory WHERE merchant_key='k'").fetchone()[0], "groceries")
        rules.learn(self.c, "k", "groceries", weight=1)
        self.assertEqual(n(), 2 * rules.CONFIRM_WEIGHT + 1)

    def test_classify_and_keys(self):
        self.assertEqual(rules.classify("瑞幸咖啡")[0:2], ("food_drink", "Luckin Coffee"))
        self.assertEqual(rules.classify("zzz")[3], False)
        self.assertEqual(rules.norm_key("7-Eleven #12"), "7eleven12")
        self.assertNotEqual(rules.norm_key("Магнит"), rules.norm_key("Пятёрочка"))


HEAD = "微信支付账单明细\n交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号\n"


def row(date_="2026-10-01 09:00:00", typ="商户消费", party="瑞幸咖啡", item="咖啡", io="支出", amt="¥18.00",
        st="支付成功", oid="42001"):
    return f"{date_},{typ},{party},{item},{io},{amt},零钱,{st},{oid}\n"


class TestParseCsv(DBCase):
    def test_sample_and_skips(self):
        text = (HEAD + row() + row(typ="商户消费", st="已全额退款", oid="2") + row(typ="退款", oid="3")
                + row(st="支付失败", oid="4") + row(amt="¥99999999999999.00", oid="5")
                + row(amt="NaN", oid="6") + row(amt="Infinity", oid="7") + row(amt="¥0.00", oid="8")
                + row(amt="-5", oid="9") + row(date_="garbage", oid="10") + row(io="/", oid="11")
                + row(amt='"¥1,234.56"', party="淘宝", item="日用品", oid="12"))
        rows, skipped = parse_csv.parse(text)
        self.assertEqual(len(rows), 2)
        self.assertEqual(skipped, 10)
        self.assertEqual([r["amount_cents"] for r in rows], [1800, 123456])
        self.assertEqual(rows[0]["merchant"], "Luckin Coffee")
        self.assertEqual(rows[0]["ext_id"], "42001")
        self.assertTrue(all(isinstance(r["amount_cents"], int) for r in rows))

    def test_gbk_decoded_by_caller(self):
        text = HEAD + row(amt="￥18.00")
        gbk = text.encode("gbk")
        self.assertEqual(parse_csv.parse(gbk.decode("utf-8", errors="replace")), ([], 0))
        rows, sk = parse_csv.parse(gbk.decode("gbk"))
        self.assertEqual((len(rows), sk), (1, 0))

    def test_person_self_income_rows(self):
        text = (HEAD + row(typ="转账", party="浩然", item="转账", oid="a") + row(typ="零钱提现", party="/", item="提现", oid="b")
                + row(typ="转账", party="公司 工资", item="工资", io="收入", amt="¥15000.00", oid="c"))
        r = {x["ext_id"]: x for x in parse_csv.parse(text)[0]}
        self.assertEqual((r["a"]["counterparty_type"], r["a"]["category"]), ("person", "transfers"))
        self.assertEqual((r["b"]["counterparty_type"], r["b"]["direction"]), ("self", "transfer"))
        self.assertEqual((r["c"]["category"], r["c"]["direction"]), ("income", "in"))

    def test_no_header_or_empty(self):
        self.assertEqual(parse_csv.parse(""), ([], 0))
        self.assertEqual(parse_csv.parse("a,b,c\n1,2,3\n"), ([], 0))

    def test_bom_and_short_rows(self):
        rows, sk = parse_csv.parse("﻿" + HEAD + "2026-10-01,x\n" + row())
        self.assertEqual((len(rows), sk), (1, 1))

    def test_dedupe_by_ext_id(self):
        text = HEAD + row(oid="X1") + row(oid="X2", amt="¥20.00")
        r1 = service.import_text(self.c, text)
        r2 = service.import_text(self.c, text)
        self.assertEqual((r1["imported"], r1["duplicates"]), (2, 0))
        self.assertEqual((r2["imported"], r2["duplicates"]), (0, 2))
        self.assertEqual(self.c.execute("SELECT COUNT(*) FROM transactions").fetchone()[0], 2)

    def test_dedupe_without_ext_id(self):
        text = HEAD + row(oid="") + row(oid="", amt="¥20.00")
        service.import_text(self.c, text)
        r2 = service.import_text(self.c, text)
        self.assertEqual((r2["imported"], r2["duplicates"]), (0, 2))

    def test_chat_vs_csv_same_tx_deduped(self):
        service.import_text(self.c, HEAD + row(oid="X1"))
        t = chatparse.parse("luckin 18")
        t["date"] = "2026-10-01"
        self.assertEqual(service.process(self.c, t, "chat", 1000000)[0], "dup")

    def test_import_report_shape(self):
        rep = service.import_text(self.c, HEAD + row() + row(st="支付失败", oid="2"))
        self.assertEqual((rep["read"], rep["imported"], rep["skipped"]), (2, 1, 1))
        self.assertEqual(rep["silent"] + rep["digest"] + rep["ask"], rep["imported"])


class TestResolve(DBCase):
    def test_purchase_keeps_category(self):
        add_tx(self.c, "2026-10-15", 5000, "Cafe", cat="food_drink", status="pending", mode="ask", cp="person")
        tid = self.c.execute("SELECT id FROM transactions").fetchone()[0]
        service.resolve(self.c, tid, "purchase")
        r = self.c.execute("SELECT category,status FROM transactions WHERE id=?", (tid,)).fetchone()
        self.assertEqual((r[0], r[1]), ("food_drink", "confirmed"))

    def test_purchase_of_transfer_becomes_shopping(self):
        add_tx(self.c, "2026-10-15", 5000, "Tony", cat="transfers", status="pending", mode="ask", cp="person")
        tid = self.c.execute("SELECT id FROM transactions").fetchone()[0]
        service.resolve(self.c, tid, "purchase")
        self.assertEqual(self.c.execute("SELECT category FROM transactions").fetchone()[0], "shopping")

    def test_income_and_self_purposes(self):
        add_tx(self.c, "2026-10-15", 5000, "Tony", cat="transfers", status="pending", mode="ask", cp="person")
        tid = self.c.execute("SELECT id FROM transactions").fetchone()[0]
        service.resolve(self.c, tid, "income")
        r = self.c.execute("SELECT category,direction FROM transactions").fetchone()
        self.assertEqual((r[0], r[1]), ("income", "in"))
        self.assertEqual(service.resolve(self.c, 9999, "gift"), {"updated": 0})

    def test_confirm_learns_and_rejects_bad_category(self):
        add_tx(self.c, "2026-10-15", 5000, "Cafe", cat="other", status="pending", mode="digest")
        tid = self.c.execute("SELECT id FROM transactions").fetchone()[0]
        with self.assertRaises(ValueError):
            service.confirm(self.c, tid, "nonsense")
        service.confirm(self.c, tid, "food_drink")
        n = self.c.execute("SELECT n_confirmed FROM merchant_memory WHERE merchant_key='cafe'").fetchone()[0]
        self.assertEqual(n, 2)


class TestChatParse(unittest.TestCase):
    def test_thousands_rent(self):
        t = chatparse.parse("1,000 rent")
        self.assertEqual((t["amount_cents"], t["category"], t["merchant"]), (100000, "housing", "Rent"))

    def test_seven_eleven(self):
        t = chatparse.parse("7-eleven 20")
        self.assertEqual((t["amount_cents"], t["category"], t["merchant"]), (2000, "groceries", "7-Eleven"))

    def test_unknown_merchant_potato(self):
        t = chatparse.parse("potato 5")
        self.assertEqual((t["amount_cents"], t["merchant"], t["category"], t["known"]), (500, "potato", "other", False))
        self.assertLess(t["confidence"], 0.85)

    def test_transfer_to_person(self):
        t = chatparse.parse("transfer to Tony 100")
        self.assertEqual((t["amount_cents"], t["counterparty_type"], t["category"], t["merchant"]),
                         (10000, "person", "transfers", "Tony"))

    def test_income(self):
        t = chatparse.parse("salary 15000")
        self.assertEqual((t["direction"], t["category"], t["amount_cents"]), ("in", "income", 1500000))

    def test_cyrillic_keys_distinct(self):
        a, b = chatparse.parse("Магнит 100"), chatparse.parse("Пятёрочка 50")
        self.assertTrue(a["merchant_key"] and b["merchant_key"])
        self.assertNotEqual(a["merchant_key"], b["merchant_key"])
        self.assertEqual(chatparse.parse("кофе 150")["category"], "food_drink")

    def test_decimal_comma_and_currency(self):
        self.assertEqual(chatparse.parse("coffee 12,5")["amount_cents"], 1250)
        self.assertEqual(chatparse.parse("¥18 luckin")["amount_cents"], 1800)

    def test_rejected(self):
        for s in ("", "hello", "99999999999 coffee", "9" * 400 + " coffee", "0 coffee", "coffee 1e999"):
            self.assertIsNone(chatparse.parse(s), s)

    def test_max_amount_boundary(self):
        self.assertEqual(chatparse.parse("coffee 10000000000")["amount_cents"], 10 ** 12)

    def test_cents_are_ints(self):
        self.assertIsInstance(chatparse.parse("coffee 0.07")["amount_cents"], int)
        self.assertEqual(chatparse.parse("coffee 0.07")["amount_cents"], 7)


class TestBench(unittest.TestCase):
    def test_shape(self):
        r = bench.compute()
        self.assertIs(r["synthetic"], True)
        self.assertEqual(r["n"], 60)
        self.assertEqual(r["counts"]["n"], 60)
        self.assertEqual(r["counts"]["chat"] + r["counts"]["statement"], 60)
        self.assertEqual(r["counts"]["silent"] + r["counts"]["digest"] + r["counts"]["ask"], 60)
        for k in ("extraction_acc", "category_acc", "silent_pct", "question_pct", "wrong_silent_pct", "avg_taps",
                  "taps_saved_pct"):
            self.assertIn(k, r["metrics"])
        for k, v in r["metrics"].items():
            if k.endswith("_pct") or "acc" in k:
                self.assertTrue(v is None or 0 <= v <= 100, k)
        self.assertIn("en", r["method"])
        self.assertIn("zh", r["method"])

    def test_deterministic(self):
        a, b = bench.compute(), bench.compute()
        self.assertEqual(json.dumps(a, sort_keys=True), json.dumps(b, sort_keys=True))


if __name__ == "__main__":
    unittest.main()
