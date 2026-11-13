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
  assert.deepEqual(r.changed, []); assert.equal(r.sitemap, false);
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

console.log(`\n全部 ${n} 項通過`);
