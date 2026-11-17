// 把 _src 的原始檔套上共用頁首、頁尾、樣式與費率選項，輸出成正式頁面。設計規則見 DESIGN.md。
// 用法：node _build.mjs        （不需要安裝任何套件）
//       node _build.mjs --check（只檢查，不寫檔；輸出和現有檔案不同就失敗）
//
//   _src/pages/<path>/index.html ──┐
//   _src/learn/<slug>.html ────────┤（文章：開頭一段 <!--meta {...} --> + 內文）
//   _src/layout/*.css ─────────────┼─► 取代 <!--@...--> 與 {{...}} ─► 檢查 ─► <path>/index.html
//   lib/fees.js（費率選項）────────┘                                    └─► sitemap.xml、robots.txt、CNAME
//
// 開頭是底線的檔案和資料夾，GitHub Pages（Jekyll）不會發布。
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const Fees = createRequire(import.meta.url)("./lib/fees.js");

// 換網址時只改這一行
export const SITE = "https://sellerpotato.com/";
const BRAND = "Potato 賣家工具箱";
const LINE = "https://line.me/R/ti/p/@127ulmyu";
const SHEET = "https://portaly.cc/potatocancode/product/I25q5eP4I8526I5GPiPa";
const SOCIAL = [
  ["Threads", "https://www.threads.com/@potato.sellertools"],
  ["Instagram", "https://www.instagram.com/potato.sellertools/"],
  ["Facebook", "https://www.facebook.com/profile.php?id=61596286809788"],
  ["YouTube", "https://www.youtube.com/channel/UC6uLUp_2xdJTXaXAtpPehzA"],
];

/** 計算工具：編號固定，選單、首頁目錄、頁尾、麵包屑都從這裡產生。 */
export const TOOLS = [
  {no: "01", path: "fee/", name: "手續費計算機", q: "這件商品，蝦皮會收我多少？"},
  {no: "02", path: "pricing/", name: "定價與折扣", q: "要賣多少才賺得到我想要的？最多打幾折？"},
  {no: "03", path: "ads-roas/", name: "廣告 ROAS", q: "廣告打到多少開始虧？每次點擊最多出多少？"},
  {no: "04", path: "compare/", name: "平台比較", q: "蝦皮、露天、momo，同一件商品哪裡賺最多？"},
  {no: "05", path: "import-cost/", name: "1688 進貨成本", q: "進一件貨，到我手上實際多少錢？"},
  {no: "06", path: "returns/", name: "退貨成本", q: "退貨率多少，這個月就白做？"},
  {no: "07", path: "monthly-goal/", name: "月目標", q: "想月賺 3 萬，每天要賣幾單？"},
];
/** 所有由 _src/pages 產生的頁面。 */
export const PAGES = [
  {path: "", section: "home"},
  ...TOOLS.map(t => ({path: t.path, section: "tools", tool: t})),
  {path: "learn/", section: "learn"},
];
/** 文章分類，列表頁照這個順序。 */
export const CATEGORIES = ["手續費與方案", "定價與利潤", "廣告", "進貨與經營", "平台比較"];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rootOf = path => path ? "../".repeat(path.split("/").filter(Boolean).length) : "";
const layout = name => readFileSync(join(ROOT, "_src/layout", name), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
const read = p => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const fmtDate = d => d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${y} 年 ${+m} 月 ${+dd} 日`);
const catId = c => "c" + (CATEGORIES.indexOf(c) + 1);

// ---------- 文章 ----------
export function loadArticles() {
  const dir = join(ROOT, "_src/learn");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".html")).map(f => {
    const src = read(join(dir, f));
    const m = src.match(/^<!--meta\s*([\s\S]*?)-->\n?/);
    if (!m) throw new Error(`_src/learn/${f}: 開頭要有 <!--meta {...} -->`);
    let meta;
    try { meta = JSON.parse(m[1]); } catch (e) { throw new Error(`_src/learn/${f}: meta 不是合法 JSON：${e.message}`); }
    for (const k of ["title", "h1", "description", "category", "date", "summary"]) {
      if (!meta[k]) throw new Error(`_src/learn/${f}: meta 缺少 ${k}`);
    }
    if (!CATEGORIES.includes(meta.category)) throw new Error(`_src/learn/${f}: 不認得的分類 ${meta.category}`);
    const slug = f.replace(/\.html$/, "");
    const body = src.slice(m[0].length);
    const text = body.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    return {...meta, slug, path: `learn/${slug}/`, section: "learn", body, minutes: Math.max(2, Math.ceil(text.length / 450))};
  }).sort((a, b) => (b.weight || 0) - (a.weight || 0) || (b.updated || b.date).localeCompare(a.updated || a.date) || a.slug.localeCompare(b.slug));
}

function story(a, root, feat = false) {
  return `<a class="story${feat ? " feat" : ""}" href="${root}${a.path}"><span class="c">${esc(a.category)}</span><h3>${esc(a.h1)}</h3>` +
    (feat && a.fig ? `<span class="fig">${esc(a.fig)}</span>` : "") +
    `<p>${esc(a.description)}</p><div class="m"><span>${fmtDate(a.updated || a.date)}</span><span>閱讀 ${a.minutes} 分鐘</span></div></a>`;
}

function renderArticle(a, all) {
  const root = rootOf(a.path);
  const url = SITE + a.path;
  for (const s of a.related || []) if (!all.some(x => x.slug === s)) throw new Error(`${a.path}: 相關文章 ${s} 不存在`);
  const related = (a.related || []).map(s => all.find(x => x.slug === s));
  const more = [...related, ...all.filter(x => x !== a && x.category === a.category && !related.includes(x))].slice(0, 4);
  const faq = a.faq || [];
  // 內文的 h2 加上錨點，產生右側「本文重點」
  let n = 0;
  const toc = [];
  const body = a.body.trim().replace(/<h2>(.*?)<\/h2>/g, (_, t) => { const id = "s" + ++n; toc.push([id, t.replace(/<[^>]+>/g, "")]); return `<h2 id="${id}">${t}</h2>`; });
  if (faq.length) toc.push(["faq", "常見問題"]);
  const ld = [
    {"@context": "https://schema.org", "@type": "Article", headline: a.h1, description: a.description, datePublished: a.date,
      dateModified: a.updated || a.date, image: url + "og.png", author: {"@type": "Organization", name: BRAND, url: SITE},
      publisher: {"@type": "Organization", name: BRAND, logo: {"@type": "ImageObject", url: SITE + "assets/potato-96.png"}}, mainEntityOfPage: url},
    {"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      {"@type": "ListItem", position: 1, name: "賣家算數", item: SITE + "learn/"},
      {"@type": "ListItem", position: 2, name: a.category, item: SITE + "learn/#" + catId(a.category)},
      {"@type": "ListItem", position: 3, name: a.h1, item: url}]},
    ...(faq.length ? [{"@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, ans]) => ({"@type": "Question", name: q, acceptedAnswer: {"@type": "Answer", text: ans}}))}] : []),
  ];
  const usesWidget = /data-widget=/.test(body);
  const checked = a.checked || a.updated || a.date;
  const html = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.title)}</title>
<meta name="description" content="${esc(a.description)}">
<link rel="canonical" href="{{site}}${a.path}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(a.h1)}">
<meta property="og:description" content="${esc(a.description)}">
<meta property="og:url" content="{{site}}${a.path}">
<meta property="og:image" content="{{site}}${a.path}og.png">
<meta property="article:published_time" content="${a.date}">
<meta name="twitter:card" content="summary_large_image">
<!--@css:article-->
${ld.map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n")}
</head>
<body>
<!--@nav-->
<main class="wrap">
<div class="art">
<article>
<div class="crumb"><a href="{{root}}learn/">賣家算數</a> › <a href="{{root}}learn/#${catId(a.category)}">${esc(a.category)}</a></div>
<h1>${esc(a.h1)}</h1>
<div class="byline"><img src="{{root}}assets/potato-96.png" alt="" width="34" height="34"><b>Potato</b><span>${a.updated ? "更新於 " + fmtDate(a.updated) : fmtDate(a.date)}</span><span>閱讀 ${a.minutes} 分鐘</span><span class="verified" title="這篇的數字在 ${checked} 用本站計算機的公式重算過">數字已驗算</span></div>
<aside class="answer"><b class="k">先講答案</b>${a.summary}</aside>
<div class="prose">
${body}
${faq.length ? `<h2 id="faq">常見問題</h2>\n${faq.map(([q, ans]) => `<h3>${esc(q)}</h3>\n<p>${esc(ans)}</p>`).join("\n")}` : ""}
${a.fixes && a.fixes.length ? `<section class="fix"><h2>更正紀錄</h2>\n${a.fixes.map(([d, t]) => `<p><time datetime="${d}">${d}</time>${t}</p>`).join("\n")}</section>` : ""}
</div>
<div class="author"><img src="{{root}}assets/potato-96.png" alt="Potato" width="52" height="52"><p><b>Potato</b>｜${BRAND}。把蝦皮賣家的數字算清楚：每件賺多少、該選哪個方案、廣告打到多少會虧。這篇的數字都用本站計算機的公式算過，費率以蝦皮賣家中心公告為準；算錯的地方會留在更正紀錄裡。</p></div>
</article>
<aside class="rail">
<h4>本文重點</h4>
<nav>${toc.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join("")}</nav>
${a.tool ? `<div class="mini"><b>${esc(a.tool.label)}</b><a class="more" href="{{root}}${a.tool.href}">打開工具</a></div>` : ""}
</aside>
</div>
${more.length ? `<section class="next"><div class="sec-h"><h2>接著看</h2><a class="more" href="{{root}}learn/">全部文章</a></div>\n<div class="stories">\n${more.map(x => story(x, root)).join("\n")}\n</div></section>` : ""}
${a.tool ? `<section class="cta"><h2>自己的商品，直接算</h2><p>${esc(a.tool.why || "換成你的售價和成本，馬上算出結果。免費，不用註冊。")}</p><a href="{{root}}${a.tool.href}">${esc(a.tool.label)}</a></section>` : ""}
</main>
<!--@footer-->
${usesWidget ? `<script src="{{root}}lib/fees.js"></script>\n<script src="{{root}}lib/widgets.js"></script>` : ""}
</body>
</html>
`;
  return render(a, html, all);
}

// ---------- 頁首、頁尾 ----------
function header(page, all) {
  const root = rootOf(page.path);
  const cur = p => p === page.path ? ` aria-current="page"` : "";
  const toolLinks = TOOLS.map(t => `<a href="${root}${t.path}"${cur(t.path)}><span class="i">${t.no}</span><b>${esc(t.name)}</b><span>${esc(t.q)}</span></a>`).join("\n");
  const cats = CATEGORIES.filter(c => all.some(a => a.category === c));
  const catLinks = cats.map(c => {
    const n = all.filter(a => a.category === c).length;
    return `<a href="${root}learn/#${catId(c)}"><span class="i">${String(n).padStart(2, "0")}</span><b>${esc(c)}</b><span>${n} 篇</span></a>`;
  }).join("\n");
  const on = s => page.section === s ? ` class="on"` : "";
  return `<header class="site-head"><div class="wrap">
<a class="brand" href="${root || "./"}"${cur("")}><img src="${root}assets/potato-96.png" alt="" width="36" height="36"><span><b>${BRAND}</b></span></a>
<nav class="mainnav" aria-label="主選單">
<details class="dd"><summary${on("learn")}>賣家算數</summary><div class="dd-panel"><div class="wrap">
${catLinks}
<a class="all" href="${root}learn/"${cur("learn/")}>全部文章</a>
</div></div></details>
<details class="dd"><summary${on("tools")}>計算工具</summary><div class="dd-panel"><div class="wrap">
${toolLinks}
</div></div></details>
<a href="${SHEET}" rel="noopener">利潤健檢表</a>
</nav>
<a class="line-btn" href="${LINE}" rel="noopener">加 LINE 收費率通知</a>
<details class="mnav"><summary>選單</summary><div class="mnav-panel"><div class="wrap">
<h4>賣家算數</h4>
<a href="${root}learn/">全部文章</a>
${cats.map(c => `<a href="${root}learn/#${catId(c)}">${esc(c)}</a>`).join("\n")}
<h4>計算工具</h4>
${TOOLS.map(t => `<a href="${root}${t.path}"${cur(t.path)}><span class="i">${t.no}</span>${esc(t.name)}</a>`).join("\n")}
<h4>更多</h4>
<a href="${SHEET}" rel="noopener">蝦皮賣場利潤健檢表（Excel）</a>
<a class="line-btn" href="${LINE}" rel="noopener">加 LINE 收費率通知</a>
</div></div></details>
</div></header>
<script>
// 下拉選單：點外面或按 Esc 收起，一次只開一個
document.addEventListener("click",e=>{document.querySelectorAll("details.dd[open],details.mnav[open]").forEach(d=>{if(!d.contains(e.target))d.open=false})});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll("details.dd[open],details.mnav[open]").forEach(d=>d.open=false)});
document.querySelectorAll("details.dd").forEach(d=>d.addEventListener("toggle",()=>{if(d.open)document.querySelectorAll("details.dd[open]").forEach(o=>{if(o!==d)o.open=false})}));
</script>`;
}

function footer(page, all, who) {
  const root = rootOf(page.path);
  const cats = CATEGORIES.filter(c => all.some(a => a.category === c));
  return `<footer class="foot"><div class="wrap">
<div class="foot-line"><p>蝦皮費率一改，我會在 LINE 上跟你說，順便算好你每件少賺多少。一個月頂多幾則。</p><a href="${LINE}" rel="noopener">加 LINE 好友</a></div>
<div class="foot-cols">
<div><a class="brand" href="${root || "./"}"><img src="${root}assets/potato-96.png" alt="" width="36" height="36"><span><b>${BRAND}</b></span></a><p>把蝦皮賣家的數字算清楚。每個數字都用公開的費率逐項算過，費率一改就更新，算錯的地方會留下更正紀錄。</p></div>
<div><h4>計算工具</h4>${TOOLS.map(t => `<a href="${root}${t.path}">${esc(t.name)}</a>`).join("")}</div>
<div><h4>賣家算數</h4><a href="${root}learn/">全部文章</a>${cats.map(c => `<a href="${root}learn/#${catId(c)}">${esc(c)}</a>`).join("")}</div>
<div><h4>追蹤 Potato</h4>${SOCIAL.map(([n, u]) => `<a href="${u}" rel="noopener">${n}</a>`).join("")}<a href="${LINE}" rel="noopener">LINE 官方帳號</a><a href="${SHEET}" rel="noopener">利潤健檢表</a></div>
</div>
<p class="fine">本站與${who}無任何關係。試算結果僅供參考，費率以各平台公告為準。</p>
</div></footer>`;
}

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">`;

const options = {
  "shopee-cats": () => Fees.SHOPEE.cats.map((c, i) =>
    `<option value="${c.rate}"${i ? "" : " selected"}>${esc(c.label)}</option>`),
  "ruten-pays": () => Fees.RUTEN.pays.map((c, i) =>
    `<option value="${c.rate}"${i ? "" : " selected"}>${esc(c.label)}</option>`),
  "momo-cats": () => Fees.MOMO.cats.map((c, i) =>
    `<option value="${c.base},${c.event}"${i ? "" : " selected"}>${esc(c.label)}</option>`),
};

export function render(page, src, all = []) {
  const root = rootOf(page.path);
  let out = src
    .replace(/<!--@nav-->/g, () => header(page, all))
    .replace(/<!--@css(?::([\w,]+))?-->/g, (_, extra) => FONTS + "\n<style>\n" + layout("base.css") +
      (extra || "").split(",").filter(Boolean).map(x => "\n" + layout(x + ".css")).join("") + "\n</style>")
    .replace(/<!--@footer(?::([^>]*?))?-->/g, (_, who) => footer(page, all, who ? esc(who) : "蝦皮（Shopee）"))
    .replace(/<!--@toolhead-->/g, () => {
      const t = page.tool;
      if (!t) throw new Error(`${page.path}: <!--@toolhead--> 只能用在工具頁`);
      return `<div class="crumb"><a href="${root}#tools">計算工具</a> › <span class="num">${t.no}</span></div>`;
    })
    .replace(/<!--@opts:([\w-]+)-->/g, (m, k) => {
      if (!options[k]) throw new Error(`${page.path || "/"}: 不認得的選項清單 ${k}`);
      return options[k]().join("\n");
    })
    .replace(/<!--@articles-->/g, () => {
      const cats = CATEGORIES.filter(c => all.some(a => a.category === c));
      const nav = `<nav class="cat-nav" aria-label="文章分類">\n${cats.map(c => `<a href="#${catId(c)}">${esc(c)}</a>`).join("\n")}\n</nav>`;
      return nav + "\n" + cats.map(c => `<section class="cat-sec" id="${catId(c)}"><div class="sec-h"><h2>${esc(c)}</h2></div>\n<div class="stories">\n${all.filter(a => a.category === c).map(a => story(a, root)).join("\n")}\n</div></section>`).join("\n");
    })
    // <!--@stories:5:略過的slug-->：首頁的文章清單，第一篇放大，頭條那篇不重複
    .replace(/<!--@stories:(\d+)(?::([\w-]+))?-->/g, (_, n, skip) => all.filter(a => a.slug !== skip).slice(0, +n).map((a, i) => story(a, root, i === 0)).join("\n"))
    .replace(/<!--@tools-->/g, () => TOOLS.map(t => `<a class="tool" href="${root}${t.path}"><span class="i">${t.no}</span><b>${esc(t.name)}</b><span class="q">${esc(t.q)}</span></a>`).join("\n"))
    .replace(/\{\{site\}\}/g, SITE)
    .replace(/\{\{root\}\}/g, root);
  check(page, out, all);
  return out;
}

// 任何一項不通過就丟錯，整個 build 停下來，不會寫出壞頁面
export function check(page, html, all = []) {
  const where = page.path || "/";
  const need = [
    [/<title>[^<]+<\/title>/, "<title>"],
    [/<link rel="canonical" href="https:\/\/[^"]+">/, "canonical"],
    [/<header class="site-head">[\s\S]*<\/header>/, "頁首"],
    [/<footer class="foot">[\s\S]*<\/footer>/, "頁尾"],
    [/fonts\.googleapis\.com\/css2/, "字型"],
  ];
  for (const [re, name] of need) if (!re.test(html)) throw new Error(`${where}: 缺少 ${name}`);
  const left = html.match(/<!--@[^>]*-->|\{\{\w+\}\}/);
  if (left) throw new Error(`${where}: 沒有被取代的標記 ${left[0]}`);
  // 站內相對連結必須指向存在的頁面或檔案
  const dir = join(ROOT, page.path);
  const pages = [...PAGES, ...all];
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#?]*)/g)) {
    if (!href || /^(https?:|mailto:|data:|\/\/)/.test(href)) continue;
    const target = resolve(dir, href);
    const file = href.endsWith("/") || href.endsWith("..") ? join(target, "index.html") : target;
    const isPage = pages.some(p => resolve(ROOT, p.path) === resolve(target));
    if (!isPage && !existsSync(file)) throw new Error(`${where}: 連結 ${href} 找不到檔案`);
  }
}

function sitemap(entries, changed) {
  const old = existsSync(join(ROOT, "sitemap.xml")) ? readFileSync(join(ROOT, "sitemap.xml"), "utf8") : "";
  const today = new Date().toISOString().slice(0, 10);
  const urls = entries.map(p => {
    const loc = SITE + p.path;
    const prev = old.match(new RegExp(`<loc>${loc.replace(/[.?*+^$()[\]\\|{}]/g, "\\$&")}</loc><lastmod>([\\d-]+)</lastmod>`));
    const lastmod = changed.has(p.path) || !prev ? today : prev[1];
    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function build({write = true} = {}) {
  const changed = new Set();
  const articles = loadArticles();
  const outputs = [
    ...PAGES.map(page => [page, () => render(page, read(join(ROOT, "_src/pages", page.path, "index.html")), articles)]),
    ...articles.map(a => [a, () => renderArticle(a, articles)]),
  ];
  for (const [page, make] of outputs) {
    const out = make();
    const dest = join(ROOT, page.path, "index.html");
    if (!existsSync(dest) || readFileSync(dest, "utf8") !== out) {
      changed.add(page.path);
      if (write) { mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, out); }
    }
  }
  // 跟網址有關的檔案都從 SITE 產生，換網址只改 SITE
  const extra = {
    "sitemap.xml": sitemap([...PAGES, ...articles], changed),
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
  return {changed: [...changed].map(p => p || "/"), extra: extraChanged, articles};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checkOnly = process.argv.includes("--check");
  const r = build({write: !checkOnly});
  const all = [...r.changed, ...r.extra];
  if (checkOnly && all.length) {
    console.error("輸出和現有檔案不同，請先執行 node _build.mjs：", all.join(", "));
    process.exit(1);
  }
  console.log(all.length ? "已更新：" + all.join(", ") : "沒有檔案需要更新", `（${r.articles.length} 篇文章）`);
}
