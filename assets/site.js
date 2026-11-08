(function () {
  /* set when the extension zip is published, e.g. the GitHub Releases URL */
  var RELEASE_URL = "https://github.com/MehdiHadizadeh/safarnameh-extension/releases/latest";
  var dl = document.getElementById("ext-dl");
  if (RELEASE_URL) { dl.href = RELEASE_URL; dl.hidden = false; }

  /* theme: starts from the system setting; the switch only shows light/dark. Held in memory, never stored. */
  var tb = document.getElementById("theme-btn"), mq = window.matchMedia("(prefers-color-scheme: dark)"), forced = null;
  function paintSwitch() {
    var dark = forced ? forced === "dark" : mq.matches;
    tb.setAttribute("aria-checked", String(dark));
    tb.setAttribute("aria-label", dark ? "حالت تیره (برای روشن شدن بزن)" : "حالت روشن (برای تیره شدن بزن)");
    tb.classList.toggle("is-dark", dark);
  }
  tb.addEventListener("click", function () {
    var dark = forced ? forced === "dark" : mq.matches;
    forced = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", forced);
    paintSwitch();
  });
  if (mq.addEventListener) mq.addEventListener("change", function () { if (!forced) paintSwitch(); });
  paintSwitch();

  var code = document.getElementById("code");
  code.textContent = window.SNAPP_COLLECTOR;

  var copyBtn = document.getElementById("copy-btn");
  copyBtn.addEventListener("click", function () {
    function done() {
      copyBtn.textContent = "کپی شد ✓"; copyBtn.classList.add("done");
      setTimeout(function () {
        copyBtn.textContent = "کپی کد"; copyBtn.classList.remove("done");
      }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(window.SNAPP_COLLECTOR).then(done, fallback);
    } else fallback();
    function fallback() {
      document.querySelector("details.code").open = true;
      var r = document.createRange(); r.selectNodeContents(code);
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      try { document.execCommand("copy"); done(); } catch (e) {}
    }
  });

  /* phone bookmarklet: the page on app.snapp.taxi hands over the rides with postMessage. Only that origin is trusted. */
  var SNAPP_ORIGIN = "https://app.snapp.taxi", recv = document.getElementById("recv");
  /* The phone code carries the address of the site it was copied from and sends the rides there. So it is only
     offered on the official site (or a local dev server), never on a mirror or a copy. A fork changes OFFICIAL. */
  var OFFICIAL = "https://mehdihadizadeh.github.io";
  var isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  /* testing from a phone on the same Wi-Fi needs the PC's address: allowed only with ?dev in the URL, on private addresses */
  var isLan = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname) && /[?&]dev(&|$)/.test(location.search);
  var isLocal = isLoopback || isLan;
  var trusted = location.origin === OFFICIAL || isLocal;
  var siteUrl = function () { return location.origin + location.pathname.replace(/[^\/]*$/, ""); };
  var bmBtn = document.getElementById("bm-copy"), bmText = document.getElementById("bm-text");
  if (location.protocol === "file:") document.getElementById("phone").hidden = true;
  if (!trusted) {
    bmBtn.disabled = true;
    var warn = document.getElementById("bm-warn");
    warn.hidden = false;
  }
  bmBtn.addEventListener("click", function () {
    if (!trusted) return;
    /* only %, # and line breaks must be escaped; the rest stays readable and short (Persian text would triple in size) */
    var code = "javascript:" + window.SNAPP_MOBILE(siteUrl()).replace(/[%#\r\n]/g, function (c) { return "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"); });
    function done() { bmBtn.textContent = "کپی شد ✓"; bmBtn.classList.add("done");
      setTimeout(function () { bmBtn.textContent = "کپی کد گوشی"; bmBtn.classList.remove("done"); }, 2000); }
    function manual() { bmText.value = code; bmText.hidden = false; bmText.focus(); bmText.select();
      try { if (document.execCommand("copy")) done(); } catch (e) {} }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, manual);
    else manual();
  });
  window.addEventListener("message", function (e) {
    /* two checks: sent by app.snapp.taxi (its origin, which a page cannot fake), and shaped like ride history */
    if (e.origin !== SNAPP_ORIGIN) return;
    if (!e.data || e.data.type !== "safarnameh-rides") return;
    var d = e.data.data;
    if (!d || !Array.isArray(d.rides) || d.rides.length > 20000) return;
    recv.hidden = true; show(d, false);
    /* done with the other tab: cut the link so nothing here can steer it */
    try { window.opener = null; } catch (err2) {}
  });
  if (location.hash === "#from-snapp") {
    recv.hidden = false;
    var hasOpener = false;
    try { if (window.opener) { hasOpener = true; window.opener.postMessage({ type: "safarnameh-ready" }, SNAPP_ORIGIN); } } catch (e) {}
    /* if nothing arrives, say why and what to do instead of waiting forever */
    setTimeout(function () {
      if (recv.hidden) return;
      recv.textContent = hasOpener
        ? "چیزی نرسید. به تب اسنپ برگرد، «ذخیرهٔ فایل» را بزن و فایل را همین‌جا رها کن."
        : "این صفحه از تب اسنپ باز نشده یا مرورگر ارتباطش را بریده. به تب اسنپ برگرد، «ذخیرهٔ فایل» را بزن و فایل را همین‌جا رها کن.";
    }, 6000);
  }

  var err = document.getElementById("err");
  function fail(msg) { err.textContent = msg; err.hidden = false; }

  function show(data, isDemo) {
    err.hidden = true;
    try { window.SnappReport.renderData(data, isDemo); }
    catch (e) { return fail(e.message || "تحلیل این فایل ممکن نشد."); }
    document.getElementById("landing").hidden = true;
    scrollTo({ top: 0, behavior: "auto" });
  }

  function handle(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onerror = function () { fail("فایل خوانده نشد."); };
    fr.onload = function () {
      var data;
      try { data = JSON.parse(String(fr.result).replace(/^﻿/, "")); }
      catch (e) { return fail("این فایل JSON معتبر نیست."); }
      show(data, false);
    };
    fr.readAsText(file);
  }

  var drop = document.getElementById("drop"), input = document.getElementById("file");
  document.getElementById("pick").addEventListener("click", function () { input.click(); });
  drop.addEventListener("click", function (e) { if (e.target === drop) input.click(); });
  input.addEventListener("change", function () { handle(input.files[0]); });
  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) {
    handle(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  document.getElementById("try-demo").addEventListener("click", function () {
    show(window.SnappDemo.data(), true);
  });
  document.getElementById("restart").addEventListener("click", function () {
    document.getElementById("report").hidden = true;
    document.getElementById("landing").hidden = false;
    scrollTo({ top: 0, behavior: "auto" });
  });
})();
