// 在 Node 裡執行網頁的計算程式：用最小的假 DOM，不需要瀏覽器或任何套件。
// load(htmlPath) 回傳 {set(id, value), check(id, bool), radio(name, value), calc(), snapshot(), ids, selects}
import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import vm from "node:vm";

function makeEl(id, tag, attrs) {
  const classes = new Set();
  return {
    id, tag, attrs,
    value: attrs.value ?? "",
    checked: /\bchecked\b/.test(attrs.raw || ""),
    textContent: "", innerHTML: "", hidden: /\bhidden\b/.test(attrs.raw || ""),
    get className() { return [...classes].join(" "); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
    classList: {
      toggle(c, on) { (on === undefined ? !classes.has(c) : on) ? classes.add(c) : classes.delete(c); },
      add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); },
    },
    listeners: [],
    addEventListener(type, fn) { this.listeners.push(fn); },
    insertAdjacentHTML(_, html) { this.innerHTML += html; },
  };
}

const attr = (raw, name) => (raw.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];

export function load(htmlPath, {search} = {}) {
  const html = readFileSync(htmlPath, "utf8");
  const byId = {}, radios = [], inputs = [], selects = {};
  for (const m of html.matchAll(/<(input|select|textarea|button)\b([^>]*)>/g)) {
    const [, tag, raw] = m;
    const id = attr(raw, "id");
    const el = makeEl(id, tag, {raw, value: attr(raw, "value"), type: attr(raw, "type"), name: attr(raw, "name")});
    if (tag === "select") {
      const body = html.slice(m.index).match(/<select[^>]*>([\s\S]*?)<\/select>/)[1];
      const opts = [...body.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(o => ({value: o[1], selected: /selected/.test(o[2])}));
      el.value = (opts.find(o => o.selected) || opts[0]).value;
      selects[id] = opts.map(o => o.value);
    }
    if (el.attrs.type === "radio") radios.push(el);
    if (tag !== "button") inputs.push(el);
    if (id) byId[id] = el;
  }
  for (const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    if (!byId[m[2]]) byId[m[2]] = makeEl(m[2], m[1], {raw: m[0]});
  }
  const document = {
    getElementById: id => byId[id] || null,
    querySelector(sel) {
      const r = sel.match(/^input\[name=(\w+)\]:checked$/);
      if (r) return radios.find(x => x.attrs.name === r[1] && x.checked) || null;
      throw new Error("假 DOM 不支援 querySelector: " + sel);
    },
    querySelectorAll(sel) {
      if (sel === "input,select") return inputs;
      // 頁首下拉選單的腳本（details）：測試裡沒有選單，回傳空的
      if (/details/.test(sel)) return [];
      throw new Error("假 DOM 不支援 querySelectorAll: " + sel);
    },
    addEventListener() {},
    // 頁首換字型的小腳本只用到這兩個
    documentElement: {classList: {add() {}, contains: () => false}},
  };
  // search 有給才放 location，模擬從別的工具帶參數過來
  const ctx = vm.createContext({document, console, Math, isFinite, parseFloat, Number, String, Set, URLSearchParams,
    addEventListener() {}, requestAnimationFrame() {},
    ...(search === undefined ? {} : {location: {search}})});
  const dir = dirname(htmlPath);
  // 依照頁面順序執行外部與內嵌 script（跳過 JSON-LD）
  for (const m of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    const code = m[1] ? readFileSync(resolve(dir, m[1]), "utf8") : m[2];
    vm.runInContext(code, ctx, {filename: m[1] || htmlPath});
  }
  const calc = () => vm.runInContext("calc()", ctx);
  return {
    ids: Object.keys(byId), selects, radios: radios.map(r => ({name: r.attrs.name, value: r.attrs.value})),
    inputs: inputs.filter(i => i.id).map(i => ({id: i.id, type: i.attrs.type || i.tag})),
    set(id, v) { byId[id].value = String(v); },
    check(id, on) { byId[id].checked = on; },
    radio(name, value) { radios.filter(r => r.attrs.name === name).forEach(r => { r.checked = r.attrs.value === value; }); },
    calc,
    el: id => byId[id],
    snapshot() {
      const s = {};
      for (const [id, el] of Object.entries(byId)) {
        if (el.textContent || el.innerHTML || el.hidden || el.className) s[id] = [el.textContent, el.innerHTML, el.hidden, el.className];
      }
      return s;
    },
  };
}
