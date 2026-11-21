// 文章裡的小計算機。頁面放 <div data-widget="名稱" data-price="100"></div>。
// _build.mjs 會在建置時先把表單和預設結果寫進 HTML（版面不會在載入後被撐開）；
// 瀏覽器載入 fees.js 與這支檔案後，只負責接上輸入事件、重算。
// 所有數字都從 Fees 算，跟工具頁、文章裡的表格用同一套公式。
(function (global) {
  "use strict";
  const inNode = typeof module === "object" && module.exports;
  const F = inNode ? require("./fees.js") : global.Fees;
  const money = (x) => (x < 0 ? "-" : "") + "$" + Math.abs(x).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const num = (input) => { const v = parseFloat(input.value); return isFinite(v) ? v : 0; };
  const catOptions = () => F.SHOPEE.cats.map((c, i) => `<option value="${c.rate}"${i ? "" : " selected"}>${c.label}</option>`).join("");
  const planSeg = (name) => `<div class="w-seg"><label><input type="radio" name="${name}" value="1" checked><span>方案一 6%</span></label><label><input type="radio" name="${name}" value="2"><span>方案二 每單 60</span></label></div>`;
  const $ = (root, sel) => root.querySelector(sel);
  const planOf = (root, id) => ($(root, `input[name=${id}plan]:checked`).value === "2" ? 2 : 1);
  const defaultRate = () => F.SHOPEE.cats[0].rate;

  // form：表單 HTML；init：預設值；read：從畫面讀值；out：結果 HTML
  const defs = {
    // 售價 → 蝦皮收多少、到手多少
    "shopee-fee": {
      form: (id, d) => `<div class="w-grid">
<div><label for="${id}p">售價（元）</label><input id="${id}p" type="number" inputmode="decimal" min="0" value="${d.price || 100}"></div>
<div><label for="${id}c">分類</label><select id="${id}c">${catOptions()}</select></div>
<div class="w-full">${planSeg(id + "plan")}</div>
<label class="w-chk w-full"><input id="${id}i" type="checkbox" checked>有開發票（每張 2.5 元）</label>
</div>`,
      init: (d) => ({ price: +(d.price || 100), rate: defaultRate(), plan: 1, inv: true }),
      read: (root, id) => ({ price: num($(root, `#${id}p`)), rate: parseFloat($(root, `#${id}c`).value), plan: planOf(root, id), inv: $(root, `#${id}i`).checked }),
      out: (v) => {
        const f = F.shopee(v.price, { rate: v.rate, plan: v.plan, inv: v.inv });
        return `<table><tr><td>成交手續費</td><td>${money(f.comm)}</td></tr><tr><td>金流與系統處理費</td><td>${money(f.pay)}</td></tr>
<tr><td>免運方案${v.plan === 1 ? "一" : "二"}</td><td>${money(f.prog)}</td></tr><tr><td>發票</td><td>${money(f.inv)}</td></tr>
<tr class="w-sum"><td>蝦皮收走</td><td>${money(f.total)}（${v.price ? pct(f.total / v.price) : "-"}）</td></tr>
<tr class="w-sum"><td>到手</td><td>${money(v.price - f.total)}</td></tr></table>`;
      },
    },
    // 成本 → 方案一、方案二的保本售價
    "breakeven": {
      form: (id, d) => `<div class="w-grid">
<div><label for="${id}k">每件成本（進貨 + 包材 + 運費 + 廣告）</label><input id="${id}k" type="number" inputmode="decimal" min="0" value="${d.cost || 100}"></div>
<div><label for="${id}c">分類</label><select id="${id}c">${catOptions()}</select></div>
<label class="w-chk w-full"><input id="${id}i" type="checkbox" checked>有開發票（每張 2.5 元）</label>
</div>`,
      init: (d) => ({ cost: +(d.cost || 100), rate: defaultRate(), inv: true }),
      read: (root, id) => ({ cost: num($(root, `#${id}k`)), rate: parseFloat($(root, `#${id}c`).value), inv: $(root, `#${id}i`).checked }),
      out: (v) => {
        const o = { rate: v.rate, inv: v.inv };
        const p1 = F.shopeeMinPrice({ ...o, plan: 1 }, v.cost), p2 = F.shopeeMinPrice({ ...o, plan: 2 }, v.cost);
        return `<table><tr><td>方案一保本售價</td><td>${p1 ? money(p1) : "無法達成"}</td></tr>
<tr><td>方案二保本售價</td><td>${p2 ? money(p2) : "無法達成"}</td></tr>
<tr class="w-sum"><td>差多少</td><td>${p1 && p2 ? money(Math.abs(p2 - p1)) : "-"}</td></tr></table>`;
      },
    },
    // 售價、成本 → 保本 ROAS
    "roas": {
      form: (id, d) => `<div class="w-grid">
<div><label for="${id}p">售價（元）</label><input id="${id}p" type="number" inputmode="decimal" min="0" value="${d.price || 390}"></div>
<div><label for="${id}k">每件成本（不含廣告）</label><input id="${id}k" type="number" inputmode="decimal" min="0" value="${d.cost || 175}"></div>
<div class="w-full">${planSeg(id + "plan")}</div>
</div>`,
      init: (d) => ({ price: +(d.price || 390), cost: +(d.cost || 175), plan: 1 }),
      read: (root, id) => ({ price: num($(root, `#${id}p`)), cost: num($(root, `#${id}k`)), plan: planOf(root, id) }),
      out: (v) => {
        const pre = v.price - F.shopee(v.price, { rate: 0.06, plan: v.plan, inv: true }).total - v.cost;
        return pre > 0
          ? `<table><tr><td>廣告前每件淨利</td><td>${money(pre)}</td></tr><tr class="w-sum"><td>保本 ROAS</td><td>${(v.price / pre).toFixed(2)}</td></tr></table><p class="w-note">ROAS 低於這個數字，每張廣告訂單都在虧。</p>`
          : `<p class="w-note">還沒打廣告就已經在虧：先調整售價或成本。</p>`;
      },
    },
  };

  /** 建置時用：表單 + 預設結果的 HTML。d 是 data-* 屬性（price、cost）。 */
  function render(name, d, id) {
    const w = defs[name];
    if (!w) throw new Error(`不認得的計算機 ${name}`);
    return w.form(id, d) + `\n<div class="w-out">${w.out(w.init(d))}</div>`;
  }

  if (inNode) { module.exports = { render, names: Object.keys(defs) }; return; }

  let uid = 0;
  document.querySelectorAll("[data-widget]").forEach((root) => {
    const w = defs[root.dataset.widget];
    if (!w) { root.textContent = "（計算機載入失敗，請改用上方的完整工具）"; return; }
    let id = root.dataset.wid;
    if (!id) { // 沒有預先寫進 HTML 的（例如手動貼的頁面），就在這裡長出來
      id = "w" + ++uid;
      root.classList.add("w-box");
      root.insertAdjacentHTML("beforeend", render(root.dataset.widget, root.dataset, id));
    }
    const out = $(root, ".w-out");
    const calc = () => { out.innerHTML = w.out(w.read(root, id)); };
    root.addEventListener("input", calc);
    calc(); // 瀏覽器「上一頁」會還原輸入值，載入時重算一次
  });
})(this);
