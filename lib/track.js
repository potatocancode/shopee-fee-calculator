// 量測：開頁、第一次動到計算機、點 LINE、點健檢表。不用 cookie、不存 IP。
// 送到 measure/ 的 Cloudflare Worker；欄位說明見 measure/README.md。由 _build.mjs 加到每一頁。
(function () {
  var s = document.currentScript, EP = s && s.getAttribute("data-endpoint");
  if (!EP || navigator.webdriver) return;
  var mobile = window.matchMedia && matchMedia("(pointer:coarse)").matches ? 1 : 0;
  function send(e, d) {
    try {
      var r = "";
      if (e === "pv" && document.referrer) { var u = new URL(document.referrer); if (u.hostname !== location.hostname) r = u.hostname; }
      var body = JSON.stringify({e: e, p: location.pathname, d: d || "", r: r, m: mobile});
      if (!(navigator.sendBeacon && navigator.sendBeacon(EP, body))) fetch(EP, {method: "POST", body: body, keepalive: true, mode: "no-cors"});
    } catch (_) {}
  }
  function place(el) {
    return el.closest(".mnav") ? "menu" : el.closest("header") ? "head" : el.closest("footer") ? "foot"
      : el.closest(".cta,.sheet,.rail") ? "cta" : "body";
  }
  send("pv");
  var used = false;
  function calc(ev) {
    var t = ev.target;
    if (used || !t.matches || !t.matches("input,select,textarea")) return;
    var w = t.closest("[data-widget]");
    if (!w && !t.closest("main")) return;
    used = true;
    send("calc", w ? w.getAttribute("data-widget") : location.pathname.replace(/\//g, "") || "home");
  }
  document.addEventListener("input", calc, true);
  document.addEventListener("change", calc, true);
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    if (/^https:\/\/(line\.me|lin\.ee)\//.test(a.href)) send("line", place(a));
    else if (/^https:\/\/portaly\.cc\//.test(a.href)) send("sheet", place(a));
  }, true);
})();
