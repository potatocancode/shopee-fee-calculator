// 所有平台費率與公式的唯一來源。
// 網頁用 <script src="lib/fees.js"> 載入（全域 Fees），測試用 require() 載入。
// 費率監測排程比對的也是這裡的數字：改費率只改這個檔案。
(function (root) {
  "use strict";
  // 蝦皮四捨五入：每一項分別四捨五入到整數（+1e-9 避免 0.5 的浮點誤差）
  const R = x => Math.round(x + 1e-9);

  // 蝦皮一般賣家 2026 新制
  const SHOPEE = {
    pay: 0.025,   // 金流與系統處理費（含運費計算）
    p1: 0.06,     // 免運及進階賣家專案 方案一
    p2: 60,       // 方案二 每單固定
    low: 99,      // 方案二：訂單金額 ≤ 99 元改收 6%
    cap: 35000,   // 成交手續費計算上限
    promo: 0.02,  // 促銷檔期加收
    inv: 2.5,     // 代收轉付發票 每張
    cats: [       // 成交手續費率（依分類）
      {rate: 0.06, label: "一般／多數分類 6%"},
      {rate: 0.06, label: "女生衣著 6%"},
      {rate: 0.06, label: "美妝保養 6%"},
      {rate: 0.055, label: "美食伴手禮 5.5%"},
      {rate: 0.055, label: "寵物食品／保健 5.5%"},
      {rate: 0.06, label: "寵物用品 6%"},
      {rate: 0.05, label: "筆記型電腦 5%"},
      {rate: 0.075, label: "手機周邊配件 7.5%"},
    ],
  };

  // 露天：交易服務費 3%（以 2 萬元為計算上限、最高 400、最低 1，不含運費）＋ 金流服務費（含運費、最低 1）
  const RUTEN = {
    trade: 0.03, tradeBase: 20000, tradeCap: 400, min: 1,
    pays: [
      {rate: 0.015, label: "一般付款、信用卡一次付清 1.5%"},
      {rate: 0.03, label: "信用卡 12 期分期 3%"},
    ],
  };

  // momo 摩天商城：分類成交手續費（非活動／活動）
  const MOMO = {
    cats: [
      {base: 0.055, event: 0.065, label: "服裝內著 5.5%／6.5%"},
      {base: 0.075, event: 0.085, label: "鞋包、飾品、寵物、寢具、餐廚 7.5%／8.5%"},
      {base: 0.06, event: 0.065, label: "文具樂器、圖書影音 6%／6.5%"},
      {base: 0.04, event: 0.045, label: "零食、飲料、米麵 4%／4.5%"},
      {base: 0.05, event: 0.055, label: "沖調、烘焙、甜點、生鮮 5%／5.5%"},
      {base: 0.08, event: 0.09, label: "手機週邊配件 8%／9%"},
      {base: 0.12, event: 0.135, label: "彩妝保養、個人清潔 12%／13.5%"},
      {base: 0.12, event: 0.13, label: "維他命、機能保健 12%／13%"},
      {base: 0.04, event: 0.045, label: "手機、平板 4%／4.5%"},
    ],
  };

  // 蝦皮每件費用。
  // o.rate 分類費率；o.promo 促銷檔期；o.coin 參加蝦幣回饋（免促銷加收）；o.plan 1|2；
  // o.ship 買家付的運費（預設 0）；o.qty 平均每單件數（預設 1）；o.inv 是否開發票
  function shopee(price, o) {
    const qty = o.qty || 1, ship = o.ship || 0;
    const rate = o.rate + (o.promo && !o.coin ? SHOPEE.promo : 0);
    const comm = R(Math.min(price, SHOPEE.cap) * rate);
    const pay = R((price + ship) * SHOPEE.pay);
    const prog = o.plan === 1 || price * qty <= SHOPEE.low ? R(price * SHOPEE.p1) : SHOPEE.p2 / qty;
    const inv = o.inv ? SHOPEE.inv / qty : 0;
    return {comm, pay, prog, inv, total: comm + pay + prog + inv};
  }

  // 露天每件費用。o.isNew 新賣家 90 天免交易服務費；o.payRate 金流費率
  function ruten(price, ship, o) {
    const trade = o.isNew || price <= 0 ? 0
      : Math.min(RUTEN.tradeCap, Math.max(RUTEN.min, R(Math.min(price, RUTEN.tradeBase) * RUTEN.trade)));
    const pay = price + ship > 0 ? Math.max(RUTEN.min, R((price + ship) * o.payRate)) : 0;
    return {trade, pay, total: trade + pay};
  }

  // momo 每件費用。o.cat 分類（MOMO.cats 其中之一或 {base,event}）；o.event 活動期間；o.otherPct 合約其他費用 %
  function momo(price, o) {
    const comm = R(price * (o.event ? o.cat.event : o.cat.base));
    const other = R(price * (o.otherPct || 0) / 100);
    return {comm, other, total: comm + other};
  }

  // 蝦皮最低售價：每件淨利 ≥ amt + pct × 售價 的最低整數售價，找不到回傳 null。
  // 方案二在 99/100 元有跳階（6% → 60 元），淨利不是單調遞增，所以逐一往上找。
  function shopeeMinPrice(o, cost, amt = 0, pct = 0, max = 100000) {
    for (let p = 1; p <= max; p++) {
      if (p - shopee(p, o).total - cost >= amt + pct * p - 1e-9) return p;
    }
    return null;
  }

  const api = {R, SHOPEE, RUTEN, MOMO, shopee, ruten, momo, shopeeMinPrice};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Fees = api;
})(this);
