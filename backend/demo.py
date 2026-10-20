"""Synthetic WeChat-style statement for the demo persona 林小雨 (26, product designer, Shenzhen).
Generated relative to 'today' so the demo never goes stale. Deterministic for a given date."""
import csv
import io
import random
from datetime import date, timedelta

import forecast

HEADER = ["交易时间", "交易类型", "交易对方", "商品", "收/支", "金额(元)", "支付方式", "当前状态", "交易单号", "商户单号", "备注"]
PAYDAY = 10
SALARY = 15000
DAYS = 90


def generate(today=None, payday_day=PAYDAY):
    today = today or date.today()
    rnd = random.Random(11)
    rows, n = [], 0

    def add(d, typ, party, item, io, amount, hour=None):
        nonlocal n
        n += 1
        h = hour if hour is not None else rnd.randint(7, 21)
        t = f"{d.isoformat()} {h:02d}:{rnd.randint(0, 59):02d}:{rnd.randint(0, 59):02d}"
        rows.append([t, typ, party, item, io, f"¥{amount:.2f}", "零钱", "支付成功", f"4200{n:08d}", f"M{n:06d}", "/"])

    def buy(d, party, item, amount, hour=None):
        add(d, "商户消费", party, item, "支出", amount, hour)

    start = today - timedelta(days=DAYS - 1)
    days = [start + timedelta(days=i) for i in range(DAYS)]  # today-89 .. today-1
    sub_days = [d for d in days if d.day == 12]  # iQIYI price creep: latest charge is higher

    for d in days:
        wd = d.weekday()
        if d.day == payday_day:
            add(d, "转账", "深圳市云帆科技有限公司 工资", "工资", "收入", SALARY, 9)
        if d.day == 1:
            buy(d, "链家租房", "房租", 3200, 8)
        if d.day == 8:
            buy(d, "健身房年卡月费", "健身", 299, 19)
        if d.day == 10:
            buy(d, "中国移动", "话费", 99, 8)
        if d.day == 12:
            buy(d, "爱奇艺会员", "会员", 25 if d == sub_days[-1] else 15, 7)
        if d.day == 15:
            buy(d, "网易云音乐", "会员", 15, 7)
        if d.day == 18:
            buy(d, "Spotify", "会员", 11, 7)
        if wd < 5:
            buy(d, "瑞幸咖啡", "咖啡", rnd.randint(16, 19), 9)
            buy(d, "美团", "午餐外卖", rnd.choice([30, 32, 35, 38, 42]), 12)
            if rnd.random() < 0.40:
                buy(d, "饿了么", "晚餐外卖", rnd.choice([78, 88, 98]), 19)
            if rnd.random() < 0.50:
                buy(d, "滴滴出行", "快车", rnd.choice([18, 22, 26]), 18)
            if rnd.random() < 0.35:
                buy(d, "盒马鲜生", "买菜", rnd.choice([58, 66, 72]), 19)
            if rnd.random() < 0.25:
                buy(d, "拼多多", "日用品", rnd.choice([39, 39, 49]), 21)
            if rnd.random() < 0.30:
                buy(d, "淘宝", "日用品", rnd.choice([159, 188]), 21)
        else:
            buy(d, rnd.choice(["喜茶", "麦当劳", "肯德基"]), "周末", rnd.choice([32, 36, 38]), 14)
            buy(d, "饿了么", "晚餐外卖", rnd.choice([78, 88, 98, 108]), 19)
            if rnd.random() < 0.60:
                buy(d, "淘宝", "日用品", rnd.choice([159, 159, 188, 159]), 21)
            buy(d, "全家便利店", "零食", rnd.randint(18, 24), 16)
            if rnd.random() < 0.35:
                buy(d, "电影票", "电影", rnd.choice([45, 59]), 20)

    cs = forecast.cycle(today, payday_day)[0]
    buy(min(cs - timedelta(days=3), today - timedelta(days=16)), "携程旅行", "大阪机票", 3299, 22)
    add(min(cs - timedelta(days=1), today - timedelta(days=15)), "转账", "浩然", "转账", "支出", 500, 21)
    buy(today - timedelta(days=6), "Tianhe Pet Shop", "宠物用品", 168, 17)
    buy(today - timedelta(days=2), "瑞幸咖啡", "团购", 96, 15)
    add(today - timedelta(days=8), "商户消费", "淘宝", "日用品", "收入", 129, 11)  # refund shown as income; not salary
    add(today - timedelta(days=1), "微信红包", "Wang Fang", "红包", "收入", 88, 20)

    rows.sort(key=lambda r: r[0])
    buf = io.StringIO()
    w = csv.writer(buf)
    for line in ("微信支付账单明细", "微信昵称：[小雨]", f"起始时间：[{start} 00:00:00] 终止时间：[{today} 23:59:59]", "导出类型：[全部]",
                 "----------------------微信支付账单明细列表--------------------"):
        w.writerow([line])
    w.writerow(HEADER)
    w.writerows(rows)
    return buf.getvalue()
