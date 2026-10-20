"use strict";
/* demo-ready: Chinese merchant names (sets mname). Hook into app.js only through the EXT registry. */
(function () {
  const PAIRS = [
    ["Luckin Coffee", "瑞幸咖啡"], ["Meituan", "美团"], ["Ele.me", "饿了么"], ["DiDi", "滴滴出行"], ["Hema", "盒马鲜生"],
    ["Taobao", "淘宝"], ["Tmall", "天猫"], ["JD.com", "京东"], ["Pinduoduo", "拼多多"], ["HeyTea", "喜茶"],
    ["McDonald's", "麦当劳"], ["KFC", "肯德基"], ["Starbucks", "星巴克"], ["FamilyMart", "全家"], ["Lawson", "罗森"],
    ["7-Eleven", "7-Eleven"], ["Dingdong", "叮咚买菜"], ["Hello Bike", "哈啰"], ["Metro", "地铁"], ["Rent", "房租"],
    ["China Mobile", "中国移动"], ["iQIYI", "爱奇艺"], ["NetEase Music", "网易云音乐"], ["Spotify", "Spotify"],
    ["Uniqlo", "优衣库"], ["Pharmacy", "药房"], ["Gym", "健身"], ["Cinema", "电影"], ["Steam", "Steam"],
    ["Salary", "工资"], ["Trip.com", "携程旅行"], ["Alipay", "支付宝"], ["WeChat Pay", "微信支付"],
  ];
  /* extra Chinese spellings -> English (en mode only) */
  const ZH_EN = [
    ["瑞幸咖啡", "Luckin Coffee"], ["瑞幸", "Luckin Coffee"], ["美团外卖", "Meituan"], ["美团", "Meituan"], ["滴滴出行", "DiDi"], ["滴滴", "DiDi"],
    ["淘宝", "Taobao"], ["盒马鲜生", "Hema"], ["盒马", "Hema"], ["喜茶", "HeyTea"], ["麦当劳", "McDonald's"], ["肯德基", "KFC"],
    ["全家便利店", "FamilyMart"], ["全家", "FamilyMart"], ["携程旅行", "Trip.com"], ["携程", "Trip.com"], ["链家租房", "Rent"], ["链家", "Rent"],
    ["房租", "Rent"], ["中国移动", "China Mobile"], ["爱奇艺", "iQIYI"], ["网易云音乐", "NetEase Music"], ["网易云", "NetEase Music"],
    ["拼多多", "Pinduoduo"], ["饿了么", "Ele.me"], ["健身", "Gym"], ["电影", "Cinema"], ["星巴克", "Starbucks"], ["京东", "JD.com"],
    ["天猫", "Tmall"], ["罗森", "Lawson"], ["叮咚买菜", "Dingdong"], ["哈啰", "Hello Bike"], ["地铁", "Metro"], ["优衣库", "Uniqlo"],
    ["药房", "Pharmacy"], ["工资", "Salary"], ["支付宝", "Alipay"], ["微信支付", "WeChat Pay"],
  ];
  const key = (s) => String(s).trim().toLowerCase();
  const TO_ZH = new Map(PAIRS.map(([e, z]) => [key(e), z]));
  const TO_EN = new Map(ZH_EN.map(([z, e]) => [key(z), e]));
  const cache = { en: new Map(), zh: new Map() };
  mname = (m) => {
    if (m == null || m === "") return m;
    const L = lang === "zh" ? "zh" : "en", c = cache[L];
    let r = c.get(m);
    if (r === undefined) {
      const k = key(m);
      r = (L === "zh" ? TO_ZH.get(k) : TO_EN.get(k)) || m;
      c.set(m, r);
    }
    return r;
  };
})();
