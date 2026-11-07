/* Report page of the extension: asks the background worker for the rides once,
   analyses them here, and renders. Nothing is stored. */
(function () {
  var report = document.getElementById("report");
  var tb = document.getElementById("theme-btn"), mq = matchMedia("(prefers-color-scheme: dark)"), forced = null;
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
  paintSwitch();

  var restart = document.getElementById("restart");
  if (restart) restart.hidden = true;
  var msg = document.getElementById("boot-msg");

  chrome.runtime.sendMessage({ type: "report-ready" }, function (res) {
    var data = res && res.data;
    if (!data) { msg.hidden = false; msg.textContent = "داده‌ای نیست. روی آیکن افزونه بزن و دوباره گزارش بساز. (گزارش‌ها عمداً نگه‌داری نمی‌شوند.)"; return; }
    try {
      window.SnappReport.renderData(data, false);
      msg.hidden = !data.partial;
      if (data.partial) msg.textContent = "گرفتن تاریخچه نیمه‌کاره ماند (محدودیت یا قطعی اسنپ)؛ اعداد ممکن است ناقص باشند. دوباره امتحان کن.";
    } catch (e) {
      msg.hidden = false; msg.textContent = e.message || "تحلیل ممکن نشد.";
    }
  });
})();
