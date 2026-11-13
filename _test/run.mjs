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
t("首頁預設：方案一，有淨利、有保本價", () => {
  const x = page("");
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

console.log(`\n全部 ${n} 項通過`);
