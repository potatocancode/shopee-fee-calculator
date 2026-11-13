// 文章裡的小計算機。頁面放 <div data-widget="名稱" data-price="100"></div>，載入 fees.js 與這支檔案就會自己長出來。
// 所有數字都從 Fees 算，跟工具頁、文章裡的表格用同一套公式。
(function () {
  "use strict";
  const F = window.Fees;
  const money = (x) => (x < 0 ? "-" : "") + "$" + Math.abs(x).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const num = (input) => { const v = parseFloat(input.value); return isFinite(v) ? v : 0; };

  const catOptions = () => F.SHOPEE.cats.map((c, i) => `<option value="${c.rate}"${i ? "" : " selected"}>${c.label}</option>`).join("");
  const planSeg = (name) => `<div class="w-seg"><label><input type="radio" name="${name}" value="1" checked><span>方案一 6%</span></label><label><input type="radio" name="${name}" value="2"><span>方案二 每單 60</span></label></div>`;

  let uid = 0;
  const widgets = {
    // 售價 → 蝦皮收多少、到手多少
    "shopee-fee"(root) {
      const id = "w" + ++uid;
      root.append(el(`<div class="w-grid">
        <div><label for="${id}p">售價（元）</label><input id="${id}p" type="number" inputmode="decimal" min="0" value="${root.dataset.price || 100}"></div>
        <div><label for="${id}c">分類</label><select id="${id}c">${catOptions()}</select></div>
        <div class="w-full">${planSeg(id + "plan")}</div>
        <label class="w-chk w-full"><input id="${id}i" type="checkbox" checked>有開發票（每張 2.5 元）</label>
      </div>`));
      const out = el(`<div class="w-out"></div>`);
      root.append(out);
      const calc = () => {
        const price = num(root.querySelector(`#${id}p`));
        const plan = root.querySelector(`input[name=${id}plan]:checked`).value === "2" ? 2 : 1;
        const f = F.shopee(price, { rate: parseFloat(root.querySelector(`#${id}c`).value), plan, inv: root.querySelector(`#${id}i`).checked });
        out.innerHTML = `<table><tr><td>成交手續費</td><td>${money(f.comm)}</td></tr><tr><td>金流與系統處理費</td><td>${money(f.pay)}</td></tr>
          <tr><td>免運方案${plan === 1 ? "一" : "二"}</td><td>${money(f.prog)}</td></tr><tr><td>發票</td><td>${money(f.inv)}</td></tr>
          <tr class="w-sum"><td>蝦皮收走</td><td>${money(f.total)}（${price ? pct(f.total / price) : "-"}）</td></tr>
          <tr class="w-sum"><td>到手</td><td>${money(price - f.total)}</td></tr></table>`;
      };
      root.addEventListener("input", calc);
      calc();
    },
    // 成本 → 方案一、方案二的保本售價
    "breakeven"(root) {
      const id = "w" + ++uid;
      root.append(el(`<div class="w-grid">
        <div><label for="${id}k">每件成本（進貨 + 包材 + 運費 + 廣告）</label><input id="${id}k" type="number" inputmode="decimal" min="0" value="${root.dataset.cost || 100}"></div>
        <div><label for="${id}c">分類</label><select id="${id}c">${catOptions()}</select></div>
        <label class="w-chk w-full"><input id="${id}i" type="checkbox" checked>有開發票（每張 2.5 元）</label>
      </div>`));
      const out = el(`<div class="w-out"></div>`);
      root.append(out);
      const calc = () => {
        const cost = num(root.querySelector(`#${id}k`));
        const o = { rate: parseFloat(root.querySelector(`#${id}c`).value), inv: root.querySelector(`#${id}i`).checked };
        const p1 = F.shopeeMinPrice({ ...o, plan: 1 }, cost), p2 = F.shopeeMinPrice({ ...o, plan: 2 }, cost);
        out.innerHTML = `<table><tr><td>方案一保本售價</td><td>${p1 ? money(p1) : "無法達成"}</td></tr>
          <tr><td>方案二保本售價</td><td>${p2 ? money(p2) : "無法達成"}</td></tr>
          <tr class="w-sum"><td>差多少</td><td>${p1 && p2 ? money(Math.abs(p2 - p1)) : "-"}</td></tr></table>`;
      };
      root.addEventListener("input", calc);
      calc();
    },
    // 售價、成本 → 保本 ROAS
    "roas"(root) {
      const id = "w" + ++uid;
      root.append(el(`<div class="w-grid">
        <div><label for="${id}p">售價（元）</label><input id="${id}p" type="number" inputmode="decimal" min="0" value="${root.dataset.price || 390}"></div>
        <div><label for="${id}k">每件成本（不含廣告）</label><input id="${id}k" type="number" inputmode="decimal" min="0" value="${root.dataset.cost || 175}"></div>
        <div class="w-full">${planSeg(id + "plan")}</div>
      </div>`));
      const out = el(`<div class="w-out"></div>`);
      root.append(out);
      const calc = () => {
        const price = num(root.querySelector(`#${id}p`)), cost = num(root.querySelector(`#${id}k`));
        const plan = root.querySelector(`input[name=${id}plan]:checked`).value === "2" ? 2 : 1;
        const pre = price - F.shopee(price, { rate: 0.06, plan, inv: true }).total - cost;
        out.innerHTML = pre > 0
          ? `<table><tr><td>廣告前每件淨利</td><td>${money(pre)}</td></tr><tr class="w-sum"><td>保本 ROAS</td><td>${(price / pre).toFixed(2)}</td></tr></table><p class="w-note">ROAS 低於這個數字，每張廣告訂單都在虧。</p>`
          : `<p class="w-note">還沒打廣告就已經在虧：先調整售價或成本。</p>`;
      };
      root.addEventListener("input", calc);
      calc();
    },
  };

  document.querySelectorAll("[data-widget]").forEach((root) => {
    const make = widgets[root.dataset.widget];
    if (!make) { root.textContent = "（計算機載入失敗，請改用上方的完整工具）"; return; }
    root.classList.add("w-box");
    make(root);
  });
})();
