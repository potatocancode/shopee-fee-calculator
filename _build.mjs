// 把 _src/pages 的原始頁面套上共用選單、頁尾、費率選項，輸出成正式頁面。
// 用法：node _build.mjs        （不需要安裝任何套件）
//       node _build.mjs --check（只檢查，不寫檔；輸出和現有檔案不同就失敗）
//
//   _src/pages/<path>/index.html ──┐
//   _src/layout/*.html ────────────┼─► 取代 <!--@...--> 與 {{...}} ─► 檢查 ─► <path>/index.html
//   lib/fees.js（費率選項）────────┘                                    └─► sitemap.xml
//
// 開頭是底線的檔案和資料夾，GitHub Pages（Jekyll）不會發布。
import {readFileSync, writeFileSync, existsSync, mkdirSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const Fees = createRequire(import.meta.url)("./lib/fees.js");

// 換網址時只改這一行
export const SITE = "https://sellerpotato.com/";

// 選單順序就是這個陣列的順序。path 是相對網站根目錄的資料夾（首頁是空字串）。
export const PAGES = [
  {path: "", nav: "手續費計算機"},
  {path: "pricing/", nav: "定價與折扣"},
  {path: "ads-roas/", nav: "廣告 ROAS"},
  {path: "compare/", nav: "平台比較"},
  {path: "import-cost/", nav: "1688 進貨成本"},
  {path: "returns/", nav: "退貨成本"},
  {path: "monthly-goal/", nav: "月目標"},
];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rootOf = path => path ? "../".repeat(path.split("/").filter(Boolean).length) : "";
const layout = name => readFileSync(join(ROOT, "_src/layout", name.includes(".") ? name : name + ".html"), "utf8").replace(/\n$/, "");

function nav(page) {
  const root = rootOf(page.path);
  const links = PAGES.map(p => p === page
    ? `<a href="./" aria-current="page">${esc(p.nav)}</a>`
    : `<a href="${root + p.path || "./"}">${esc(p.nav)}</a>`);
  return `<nav><div class="wrap">\n${links.join("\n")}\n</div></nav>`;
}

const options = {
  "shopee-cats": () => Fees.SHOPEE.cats.map((c, i) =>
    `<option value="${c.rate}"${i ? "" : " selected"}>${esc(c.label)}</option>`),
  "ruten-pays": () => Fees.RUTEN.pays.map((c, i) =>
    `<option value="${c.rate}"${i ? "" : " selected"}>${esc(c.label)}</option>`),
  "momo-cats": () => Fees.MOMO.cats.map((c, i) =>
    `<option value="${c.base},${c.event}"${i ? "" : " selected"}>${esc(c.label)}</option>`),
};

export function render(page, src) {
  const root = rootOf(page.path);
  let out = src
    .replace(/<!--@nav-->/g, () => nav(page))
    .replace(/<!--@css-->/g, () => "<style>\n" + layout("base.css").replace(/\r\n/g, "\n") + "\n</style>")
    .replace(/<!--@footer(?::([^>]*?))?-->/g, (_, who) =>
      layout("footer").replace("{{who}}", who ? esc(who) : "蝦皮（Shopee）"))
    .replace(/<!--@opts:([\w-]+)-->/g, (m, k) => {
      if (!options[k]) throw new Error(`${page.path || "/"}: 不認得的選項清單 ${k}`);
      return options[k]().join("\n");
    })
    .replace(/\{\{site\}\}/g, SITE)
    .replace(/\{\{root\}\}/g, root);
  check(page, out);
  return out;
}

// 任何一項不通過就丟錯，整個 build 停下來，不會寫出壞頁面
export function check(page, html) {
  const where = page.path || "/";
  const need = [
    [/<title>[^<]+<\/title>/, "<title>"],
    [/<link rel="canonical" href="https:\/\/[^"]+">/, "canonical"],
    [/<nav>[\s\S]*aria-current="page"[\s\S]*<\/nav>/, "選單"],
    [/<footer>[\s\S]*<\/footer>/, "頁尾"],
  ];
  for (const [re, name] of need) if (!re.test(html)) throw new Error(`${where}: 缺少 ${name}`);
  const left = html.match(/<!--@[^>]*-->|\{\{\w+\}\}/);
  if (left) throw new Error(`${where}: 沒有被取代的標記 ${left[0]}`);
  // 站內相對連結必須指向存在的頁面或檔案
  const dir = join(ROOT, page.path);
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (/^(https?:|mailto:|data:|\/\/)/.test(href)) continue;
    const target = resolve(dir, href);
    const file = href.endsWith("/") ? join(target, "index.html") : target;
    const isPage = PAGES.some(p => resolve(ROOT, p.path) === resolve(target));
    if (!isPage && !existsSync(file)) throw new Error(`${where}: 連結 ${href} 找不到檔案`);
  }
}

function sitemap(changed) {
  const old = existsSync(join(ROOT, "sitemap.xml")) ? readFileSync(join(ROOT, "sitemap.xml"), "utf8") : "";
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map(p => {
    const loc = SITE + p.path;
    const prev = old.match(new RegExp(`<loc>${loc.replace(/[.?*+^$()[\]\\|{}]/g, "\\$&")}</loc><lastmod>([\\d-]+)</lastmod>`));
    const lastmod = changed.has(p) || !prev ? today : prev[1];
    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function build({write = true} = {}) {
  const changed = new Set();
  for (const page of PAGES) {
    const out = render(page, readFileSync(join(ROOT, "_src/pages", page.path, "index.html"), "utf8").replace(/\r\n/g, "\n"));
    const dest = join(ROOT, page.path, "index.html");
    if (!existsSync(dest) || readFileSync(dest, "utf8") !== out) {
      changed.add(page);
      if (write) { mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, out); }
    }
  }
  // 跟網址有關的檔案都從 SITE 產生，換網址只改 SITE
  const extra = {
    "sitemap.xml": sitemap(changed),
    "robots.txt": `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`,
    "CNAME": new URL(SITE).hostname.endsWith("github.io") ? null : new URL(SITE).hostname + "\n",
  };
  const extraChanged = [];
  for (const [name, body] of Object.entries(extra)) {
    if (body === null) continue;
    const p = join(ROOT, name);
    if (!existsSync(p) || readFileSync(p, "utf8") !== body) {
      extraChanged.push(name);
      if (write) writeFileSync(p, body);
    }
  }
  return {changed: [...changed].map(p => p.path || "/"), extra: extraChanged};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checkOnly = process.argv.includes("--check");
  const r = build({write: !checkOnly});
  const all = [...r.changed, ...r.extra];
  if (checkOnly && all.length) {
    console.error("輸出和現有檔案不同，請先執行 node _build.mjs：", all.join(", "));
    process.exit(1);
  }
  console.log(all.length ? "已更新：" + all.join(", ") : "沒有檔案需要更新");
}
