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

  /* The rides live only in this tab's memory, so offer the raw file here. Same shape the console
     collector saves, so it can be dropped on the site later. Built on click, nothing kept. */
  function addJsonButton(data) {
    var bar = document.querySelector(".toolbar"); if (!bar) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost"; b.id = "json-btn"; b.textContent = "دانلود فایل JSON";
    b.addEventListener("click", function () {
      var n = (data.rides || []).length;
      var url = URL.createObjectURL(new Blob([JSON.stringify({ rides: data.rides, lifetime: data.lifetime, partial: !!data.partial })], { type: "application/json" }));
      var a = document.createElement("a");
      a.href = url; a.download = "snapp-rides-" + n + ".json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
    });
    var pdf = document.getElementById("pdf-btn");
    bar.insertBefore(b, pdf ? pdf.nextSibling : bar.firstChild);
  }

  chrome.runtime.sendMessage({ type: "report-ready" }, function (res) {
    var data = res && res.data;
    if (!data) { msg.hidden = false; msg.textContent = "اطلاعاتی نیست. روی آیکن افزونه بزن و دوباره گزارش بساز. (گزارش عمداً ذخیره نمی‌شود.)"; return; }
    addJsonButton(data);
    try {
      window.SnappReport.renderData(data, false);
      msg.hidden = !data.partial;
      if (data.partial) msg.textContent = "تاریخچه کامل گرفته نشد (شاید اسنپ محدود کرد یا قطع شد)، پس ممکن است اعداد ناقص باشند. دوباره امتحان کن.";
    } catch (e) {
      msg.hidden = false; msg.textContent = e.message || "تحلیل ممکن نشد.";
    }
  });
})();
