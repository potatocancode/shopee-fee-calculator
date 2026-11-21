// 永久測試：node _test/run.mjs
// 1) fees.js 固定案例（數字都出現在貼文或文章裡，改壞了文章就錯了）
// 2) build 輸出和原始檔一致、每頁通過檢查
// 3) 每個頁面用預設輸入跑一次，關鍵數字正確
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "../_build.mjs";
import {load} from "./dom.mjs";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const Fees = createRequire(import.meta.url)("../lib/fees.js");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓", name); };

const base = {rate: 0.06, inv: true};
t("蝦皮 100 元：方案一費用 17.5、方案二 71.5", () => {
  assert.equal(Fees.shopee(100, {...base, plan: 1}).total, 17.5);
  assert.equal(Fees.shopee(100, {...base, plan: 2}).total, 71.5);
});
t("蝦皮 99 元方案二改收 6%：16.5", () => assert.equal(Fees.shopee(99, {...base, plan: 2}).total, 16.5));
t("蝦皮 1000 元方案一和方案二的免運費一樣（60）", () => {
  assert.equal(Fees.shopee(1000, {...base, plan: 1}).prog, 60);
  assert.equal(Fees.shopee(1000, {...base, plan: 2}).prog, 60);
});
t("成交手續費以 35,000 為上限", () => assert.equal(Fees.shopee(40000, {...base, plan: 1}).comm, 2100));
t("促銷 +2%，參加蝦幣回饋就免", () => {
  assert.equal(Fees.shopee(100, {...base, plan: 1, promo: true}).comm, 8);
  assert.equal(Fees.shopee(100, {...base, plan: 1, promo: true, coin: true}).comm, 6);
});
t("金流費含買家運費", () => assert.equal(Fees.shopee(390, {...base, plan: 1, ship: 60}).pay, 11));
t("每單 2 件：方案二 60 元與發票攤到每件", () => {
  const f = Fees.shopee(100, {...base, plan: 2, qty: 2});
  assert.equal(f.prog, 30); assert.equal(f.inv, 1.25);
});
// 2026/12/11 新制：案例照抄蝦皮官方說明（seller.shopee.tw/edu/article/28804、18733）
const S2 = {s: Fees.SHOPEE_1211};
t("12/11 新制：官方範例 成交手續費 400×5%=20、40,000 以 35,000 計=1,750、130+500 → 31.5 → 32", () => {
  assert.equal(Fees.shopee(400, {...S2, rate: 0.05, plan: 1}).comm, 20);
  assert.equal(Fees.shopee(40000, {...S2, rate: 0.05, plan: 1}).comm, 1750);
  assert.equal(Fees.R(630 * 0.05), 32);
});
t("12/11 新制：官方範例 促銷檔期 5%+4%，400 → 36；參加（長期）蝦幣回饋免收 → 20", () => {
  assert.equal(Fees.shopee(400, {...S2, rate: 0.05, plan: 1, promo: true}).comm, 36);
  assert.equal(Fees.shopee(400, {...S2, rate: 0.05, plan: 1, promo: true, coin: true}).comm, 20);
});
t("12/11 新制：官方範例 金流費 (400+60)×2.5%=11.5 → 12", () => {
  assert.equal(Fees.shopee(400, {...S2, rate: 0.05, plan: 1, ship: 60}).pay, 12);
});
t("12/11 新制：官方範例 方案一 1,000×6.5%=65、方案二每單 65、99 元以下 6.5%", () => {
  assert.equal(Fees.shopee(1000, {...S2, rate: 0.08, plan: 1}).prog, 65);
  assert.equal(Fees.shopee(1000, {...S2, rate: 0.08, plan: 2}).prog, 65);
  assert.equal(Fees.shopee(99, {...S2, rate: 0.08, plan: 2}).prog, 6);
});
t("12/11 新制：分類表和現行一一對應，名稱相同、費率依官方附件", () => {
  const a = Fees.SHOPEE.cats, b = Fees.SHOPEE_1211.cats;
  assert.equal(a.length, b.length);
  a.forEach((c, i) => assert.equal(c.label.replace(/ [\d.]+%$/, ""), b[i].label.replace(/ [\d.]+%$/, "")));
  assert.deepEqual(b.map(c => c.rate), [0.08, 0.071, 0.08, 0.061, 0.075, 0.08, 0.056, 0.095]);
  // 現行費率維持原本的數字（文章都用這些算的）
  assert.deepEqual(a.map(c => c.rate), [0.06, 0.06, 0.06, 0.055, 0.055, 0.06, 0.05, 0.075]);
});
t("12/11 新制：390 元、多數分類、方案一、有發票 → 現行 58.5、新制 68.5", () => {
  assert.equal(Fees.shopee(390, {rate: 0.06, plan: 1, inv: true}).total, 58.5);
  assert.equal(Fees.shopee(390, {...S2, rate: 0.08, plan: 1, inv: true}).total, 68.5);
});

t("露天：3% 交易費上限 400、最低 1；新賣家免交易費", () => {
  assert.equal(Fees.ruten(390, 60, {payRate: 0.015}).total, 19);
  assert.equal(Fees.ruten(30000, 0, {payRate: 0.015}).trade, 400);
  assert.equal(Fees.ruten(10, 0, {payRate: 0.015}).trade, 1);
  assert.equal(Fees.ruten(10, 0, {payRate: 0.015}).pay, 1);
  assert.equal(Fees.ruten(390, 60, {payRate: 0.015, isNew: true}).trade, 0);
});
t("momo 服裝 390 元：非活動 21、活動 25", () => {
  assert.equal(Fees.momo(390, {cat: Fees.MOMO.cats[0]}).total, 21);
  assert.equal(Fees.momo(390, {cat: Fees.MOMO.cats[0], event: true}).total, 25);
});

t("build 輸出和現有頁面一致（忘了跑 node _build.mjs 會失敗）", () => {
  const r = build({write: false});
  assert.deepEqual(r.changed, []); assert.deepEqual(r.extra, []);
});

const page = p => { const x = load(join(ROOT, p, "index.html")); x.calc(); return x; };
t("手續費頁預設：方案一，有淨利、有保本價", () => {
  const x = page("fee/");
  assert.match(x.el("kFee").textContent, /^\$\d/);
  assert.match(x.el("fBE").textContent, /^\$\d/);
});
t("定價頁：成本 195 → 保本 232、目標 20% 售價 302", () => {
  const x = page("pricing/");
  x.set("cost", 195); x.set("pack", 0); x.set("sship", 0); x.set("ads", 0); x.set("goal", 20); x.calc();
  assert.equal(x.el("kBe").textContent, "$232");
  assert.equal(x.el("kPrice").textContent, "$302");
});
t("比較頁預設（390 + 運費 60）：蝦皮 59.5、露天 19、momo 21", () => {
  const html = page("compare/").el("tb").innerHTML;
  const sum = html.match(/平台費用合計<\/td>(.*?)<\/tr>/)[1];
  assert.deepEqual([...sum.matchAll(/>\$([\d.]+)</g)].map(m => m[1]), ["59.5", "19", "21"]);
});
t("ROAS 頁預設有保本 ROAS", () => assert.match(page("ads-roas/").el("kBe").textContent, /^\d+\.\d\d$/));

t("最低售價：成本 64.51、方案一 → 80（79 會虧 0.01）", () => {
  assert.equal(Fees.shopeeMinPrice({rate: 0.06, plan: 1, inv: true}, 64.51), 80);
});
t("1688 進貨頁預設：每件 64.5、1.15 倍、帶成本 65 去定價頁", () => {
  const x = page("import-cost/");
  assert.equal(x.el("kUnit").textContent, "$64.5");
  assert.equal(x.el("kMul").textContent, "1.15 倍");
  assert.equal(x.el("toPricing").href, "../pricing/?cost=65");
});
t("1688 進貨頁：損耗 100% 不會除以 0", () => {
  const x = page("import-cost/"); x.set("loss", 100); x.calc();
  assert.doesNotMatch(x.el("kUnit").textContent, /Infinity|NaN/);
});
t("1688 進貨頁：沒包稅時加上稅費", () => {
  const x = page("import-cost/"); x.check("taxin", false); x.set("tax", 5); x.calc();
  assert.equal(x.el("tTax").textContent, "$309"); // (5692.5 + 480) × 5% = 308.6
});
t("退貨頁預設：每月吃掉 4,035、上限 58.2%、多賣 26 單", () => {
  const x = page("returns/");
  assert.equal(x.el("kLoss").textContent, "$4,035");
  assert.equal(x.el("kMax").textContent, "58.2%");
  assert.equal(x.el("tMore").textContent, "26 單");
});
t("退貨頁：99 元賺 10 元、退貨運費 60 → 上限 14.3%", () => {
  // 99 元方案一費用 = 6 + 2 + 6 + 2.5 = 16.5，成本 72.5 讓淨利剛好 10
  const x = page("returns/"); x.set("price", 99); x.set("cost", 72.5); x.set("resell", 100); x.calc();
  assert.equal(x.el("tNet").textContent, "$10");
  assert.equal(x.el("kMax").textContent, "14.3%");
});
t("月目標頁預設：241 單、每天 8 單、營業額 93,990、方案二 330 單", () => {
  const x = page("monthly-goal/");
  assert.equal(x.el("kOrders").textContent, "241 單");
  assert.equal(x.el("kDay").textContent, "8.0 單");
  assert.equal(x.el("tRev").textContent, "$93,990");
  assert.equal(x.el("tOther").textContent, "方案二 330 單");
});
t("月目標頁：每單虧錢時不顯示單數", () => {
  const x = page("monthly-goal/"); x.set("cost", 400); x.calc();
  assert.equal(x.el("kOrders").textContent, "-");
});
t("定價頁讀網址的 ?cost=", () => {
  const x = load(join(ROOT, "pricing/index.html"), {search: "?cost=65"}); x.calc();
  assert.equal(x.el("cost").value, "65");
});

// ---- 文章裡寫死的數字（改了公式或費率，這裡會失敗，提醒你去改文章）----
const o = (plan, x = {}) => ({rate: 0.06, plan, inv: true, ...x});
const fee = (p, plan, x) => Fees.shopee(p, o(plan, x)).total;
t("文章：方案一二比較表（100/300/500/1000/1500/3000）", () => {
  const rows = [[100, 17.5, 71.5], [300, 46.5, 88.5], [500, 75.5, 105.5], [1000, 147.5, 147.5], [1500, 220.5, 190.5], [3000, 437.5, 317.5]];
  for (const [p, a, b] of rows) { assert.equal(fee(p, 1), a, `${p} 方案一`); assert.equal(fee(p, 2), b, `${p} 方案二`); }
});
t("文章：150 元進貨 80，方案一賺 45.5、方案二虧 5.5", () => {
  assert.equal(150 - fee(150, 1) - 80, 45.5);
  assert.equal(150 - fee(150, 2) - 80, -5.5);
});
t("文章：保本價 100→120/178、195→232/282、20% 目標 302", () => {
  assert.equal(Fees.shopeeMinPrice(o(1), 100), 120);
  assert.equal(Fees.shopeeMinPrice(o(2), 100), 178);
  assert.equal(Fees.shopeeMinPrice(o(1), 195), 232);
  assert.equal(Fees.shopeeMinPrice(o(2), 195), 282);
  assert.equal(Fees.shopeeMinPrice(o(1), 195, 0, 0.2), 302);
  assert.equal(Fees.shopeeMinPrice(o(1), 64.51), 80);
});
t("文章：成本 × 1.5 → 293 元淨利 52.5（17.9%）", () => {
  const net = 293 - fee(293, 1) - 195;
  assert.equal(net, 52.5);
  assert.equal((net / 293 * 100).toFixed(1), "17.9");
});
t("文章：ROAS 390/175 → 淨利 156.5、保本 2.49；9 折 351 → 2.87", () => {
  const pre = 390 - fee(390, 1) - 175;
  assert.equal(pre, 156.5);
  assert.equal((390 / pre).toFixed(2), "2.49");
  assert.equal(pre - 390 / 4, 59);
  assert.equal(pre - 390 / 2, -38.5);
  const pre9 = 351 - fee(351, 1) - 175;
  assert.equal(pre9, 122.5);
  assert.equal((351 / pre9).toFixed(2), "2.87");
});
t("文章：金流費 390+60 → 11；促銷 390 → 66.5", () => {
  assert.equal(Fees.shopee(390, o(1, {ship: 60})).pay, 11);
  assert.equal(fee(390, 1, {promo: true}), 66.5);
});
t("手續費頁：12/11 起同一件 390 元，費用 58.5 → 68.5、每件多 10 元；換手機周邊 64.5 → 74.5", () => {
  const x = page("fee/");
  assert.match(x.el("next").innerHTML, /\$58\.5 → \$68\.5/);
  assert.match(x.el("next").innerHTML, /多被收 <b>\$10<\/b>/);
  x.set("cat", 0.075); x.calc();
  assert.match(x.el("next").innerHTML, /\$64\.5 → \$74\.5（成交手續費 9\.5%/);
});
t("12/11 文章：內文數字和 fees.js 一致，文章裡的計算機用新費率", () => {
  const N = {s: Fees.SHOPEE_1211, inv: true}, O = {inv: true};
  const html = readFileSync(join(ROOT, "learn/shopee-fee-1211/index.html"), "utf8");
  assert.equal(Fees.shopee(390, {...N, rate: 0.08, plan: 1, promo: true}).total, 84.5);
  assert.equal(Fees.shopee(390, {...N, rate: 0.08, plan: 1, promo: true, coin: true}).total, 68.5);
  assert.equal(Fees.shopee(390, {...N, rate: 0.08, plan: 1}).prog, 25);
  const be = (o, c) => Fees.shopeeMinPrice(o, c);
  assert.deepEqual([be({...O, rate: 0.06, plan: 1}, 100), be({...N, rate: 0.08, plan: 1}, 100), be({...O, rate: 0.06, plan: 2}, 100), be({...N, rate: 0.08, plan: 2}, 100), be({...N, rate: 0.08, plan: 1}, 195)], [120, 124, 178, 188, 238]);
  // 分類表「390 元訂單多收」那一欄
  const more = Fees.SHOPEE.cats.map((c, i) => Fees.shopee(390, {...N, rate: Fees.SHOPEE_1211.cats[i].rate, plan: 1}).total - Fees.shopee(390, {...O, rate: c.rate, plan: 1}).total);
  assert.deepEqual(more, [10, 7, 10, 5, 10, 10, 4, 10]);
  assert.match(html, /data-rates="1211"[^>]*>[\s\S]*?\$68\.5（17\.6%）/);
  assert.match(html, /方案一 6\.5%/);
});
t("手續費頁和定價頁的保本價一致（成本 195 → 232，20% → 302）", () => {
  const x = page("fee/");
  x.set("cost", 195); x.set("pack", 0); x.set("sship", 0); x.set("ads", 0); x.set("ship", 0); x.set("target", 20); x.calc();
  assert.equal(x.el("fBE").textContent, "$232");
  assert.equal(x.el("fTP").textContent, "$302");
});
t("文章頁：每篇都有麵包屑、先講答案、作者框、canonical", () => {
  for (const a of build({write: false}).articles) {
    const html = readFileSync(join(ROOT, a.path, "index.html"), "utf8");
    for (const s of ['class="crumb"', 'class="answer"', 'class="author"', `href="https://sellerpotato.com/${a.path}"`, '"@type":"Article"']) {
      assert.ok(html.includes(s), `${a.path} 缺 ${s}`);
    }
    assert.doesNotMatch(html, /——/, `${a.path} 有破折號`);
  }
});

t("量測 track.js：開頁送 pv、計算機只記第一次、LINE／健檢表點擊記位置", () => {
  const sent = [], handlers = {};
  const node = (sel) => ({matches: s => s.split(",").includes(sel), closest: s => s.split(",").some(x => x === sel || x === "main") ? {getAttribute: () => null} : null});
  const link = (href, inFooter) => ({href, closest: s => s === "a[href]" ? link(href, inFooter) : s === "footer" && inFooter ? {} : null});
  const ctx = {
    document: {currentScript: {getAttribute: () => "https://m.example/e"}, referrer: "https://www.google.com/search",
      addEventListener: (k, f) => (handlers[k] ||= []).push(f)},
    location: {pathname: "/fee/", hostname: "sellerpotato.com"},
    navigator: {webdriver: false, sendBeacon: (u, b) => sent.push(JSON.parse(b))},
    matchMedia: () => ({matches: true}), URL, JSON,
  };
  ctx.window = ctx;
  runInNewContext(readFileSync(join(ROOT, "lib/track.js"), "utf8"), ctx);
  const fire = (k, target) => handlers[k].forEach(f => f({target}));
  fire("input", node("input")); fire("input", node("input")); fire("change", node("select"));
  fire("click", link("https://line.me/R/ti/p/@127ulmyu", true));
  fire("click", link("https://portaly.cc/potatocancode/product/x", false));
  fire("click", link("https://sellerpotato.com/learn/", false));
  assert.deepEqual(sent.map(s => [s.e, s.d]), [["pv", ""], ["calc", "fee"], ["line", "foot"], ["sheet", "body"]]);
  assert.equal(sent[0].r, "www.google.com"); assert.equal(sent[0].m, 1);
});

console.log(`\n全部 ${n} 項通過`);
