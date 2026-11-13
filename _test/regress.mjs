// 一次性的重構回歸測試：舊頁面和新頁面吃同樣的隨機輸入，所有顯示結果必須完全一樣。
// 用法：node _test/regress.mjs <舊版資料夾> [次數]
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {load} from "./dom.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const oldDir = process.argv[2];
const N = +(process.argv[3] || 3000);
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];
const numFor = () => pick([0, 1, 50, 99, 100, 101, 150, 199, 390, 999, 1000, 1001, 2500, 20000, 35000, 40000,
  Math.round(rnd() * 3000), Math.round(rnd() * 500), +(rnd() * 100).toFixed(1), -5, ""]);

let fail = 0, total = 0;
for (const page of ["", "pricing/", "ads-roas/", "compare/"]) {
  total += fail; fail = 0;
  const a = load(join(oldDir, page, "index.html"));
  const b = load(join(ROOT, page, "index.html"));
  if (JSON.stringify(a.inputs) !== JSON.stringify(b.inputs)) throw new Error(page + ": 輸入欄位不同");
  // 選單選項：舊版少的選項只用兩邊都有的值
  for (let i = 0; i < N; i++) {
    const sc = [];
    for (const inp of a.inputs) {
      if (inp.type === "select") {
        const common = a.selects[inp.id].filter(v => b.selects[inp.id].includes(v));
        sc.push(["set", inp.id, pick(common)]);
      } else if (inp.type === "checkbox") sc.push(["check", inp.id, rnd() < 0.5]);
      else if (inp.type !== "radio") sc.push(["set", inp.id, numFor()]);
    }
    for (const name of new Set(a.radios.map(r => r.name))) sc.push(["radio", name, pick(a.radios.filter(r => r.name === name)).value]);
    for (const p of [a, b]) { for (const [f, ...args] of sc) p[f](...args); p.calc(); }
    const sa = JSON.stringify(a.snapshot()), sb = JSON.stringify(b.snapshot());
    if (sa !== sb) {
      fail++;
      if (fail <= 3) {
        console.log("不一致 /" + page, JSON.stringify(sc));
        const A = a.snapshot(), B = b.snapshot();
        for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) console.log("  ", k, JSON.stringify(A[k]), "→", JSON.stringify(B[k]));
      }
    }
  }
  console.log("/" + page, fail ? "有不一致" : `${N} 組隨機輸入全部一致`);
}
process.exit(total + fail ? 1 : 0);
