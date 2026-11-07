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
