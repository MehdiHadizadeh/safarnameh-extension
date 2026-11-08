/* Renders a SnappAnalyze model into the #report markup. */
(function (root) {
  "use strict";
  var A = root.SnappAnalyze;
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  var DAYS = ["شنبه","یک‌شنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنج‌شنبه","جمعه"];
  var SVGNS = "http://www.w3.org/2000/svg";

  var fa = function (n) { return String(n).replace(/[0-9]/g, function (d) { return FA[+d]; }); };
  var grp = function (n) { return Math.round(n).toLocaleString("en-US").replace(/,/g, "٬"); };
  var money = function (n) { return fa(grp(n)); };
  var dec = function (s) { return String(s).replace(".", "٫"); };
  var X = function (v) { return '<bdi dir="ltr">' + fa(dec(v)) + "×</bdi>"; };
  /* every ride-derived string (addresses, vehicle, area names) goes through esc() before innerHTML */
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var ratio = function (a, b) { return b > 0 ? a / b : 0; };
  var cityless = function (t) { return String(t).replace(/^(شهر )?[^،]+، /, ""); };

  var short = function (t) { var w = String(t).trim().split(/\s+/); var o = ""; for (var i = 0; i < w.length && (o + " " + w[i]).length <= 22; i++) o += (o ? " " : "") + w[i]; return esc(o || String(t).slice(0, 22)); };
  var tip;
  function tipOn(e, html) {
    tip.innerHTML = html; tip.classList.add("on");
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX - w/2)) + "px";
    tip.style.top = (e.clientY - h - 14 < 8 ? e.clientY + 18 : e.clientY - h - 14) + "px";
  }
  function tipOff() { tip.classList.remove("on"); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function div(cls, html) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function clear(id) { var n = document.getElementById(id); n.innerHTML = ""; return n; }

  function render(M, isDemo) {
    tip = document.getElementById("tip");
    document.getElementById("report").hidden = false;
    document.getElementById("demo-flag").hidden = !isDemo;

    /* ── masthead ─────────────────────────── */
    var months = M.story.months;
    var iv = M.infl.length > 1 ? ratio(M.infl[M.infl.length-1].v, M.infl[0].v) : 0;
    document.getElementById("r-h1").textContent =
      (M.meta.spanDays >= 730 ? fa(dec((M.meta.spanDays / 365).toFixed(1))) + " سال" : fa(months) + " ماه")
      + "، " + fa(M.meta.records) + " رکورد سفر"
      + (iv > 1.15 ? "، و کرایه‌ای که " + fa(dec(iv.toFixed(1))) + " برابر شد" : "");
    document.getElementById("m-range").textContent = fa(M.meta.firstJ) + " تا " + fa(M.meta.lastJ);
    document.getElementById("m-rec").textContent = fa(M.meta.records);
    document.getElementById("m-ok").textContent = fa(M.meta.ok);
    document.getElementById("m-cx").textContent = fa(M.meta.cancelMe + M.meta.cancelDriver);

    /* ── story reel ───────────────────────── */
    (function () {
      var S = M.story, P = M.places[0], L = M.lifetime, TH = M.thesis;
      var road = Math.round(M.dist.straight * M.dist.factor);
      var peak = S.peakMonth;
      var N = function (n) { return '<span class="num">' + fa(n) + "</span>"; };

      function bars(vals, hi, labels) {
        var mx = Math.max.apply(null, vals.concat([1]));
        return '<div class="viz" aria-hidden="true">' + vals.map(function (v, i) {
          return '<i' + (i === hi ? ' class="hi"' : '') + ' style="height:' + Math.max(6, Math.round(100 * v / mx)) + '%"></i>';
        }).join("") + "</div>" + (labels ? '<div class="vlab" aria-hidden="true"><span>' + labels[0] + "</span><span>" + labels[1] + "</span></div>" : "");
      }
      function chips(list) {
        return '<div class="chips2">' + list.filter(Boolean).map(function (c) {
          return "<span><b>" + c[0] + "</b>" + c[1] + "</span>";
        }).join("") + "</div>";
      }
      var sp = M.spend.slice(-13), spN = sp.map(function (x) { return x.n; }), spT = sp.map(function (x) { return x.total; });
      var spPeak = spT.indexOf(Math.max.apply(null, spT)), spNMax = spN.indexOf(Math.max.apply(null, spN));
      var spLab = [fa(sp[0].m.split("-")[1]) + "/" + fa(sp[0].m.split("-")[0].slice(2)),
                   fa(sp[sp.length - 1].m.split("-")[1]) + "/" + fa(sp[sp.length - 1].m.split("-")[0].slice(2))];
      var hr = M.hour, hrMax = hr.indexOf(Math.max.apply(null, hr));
      var night = hr.slice(0, 5).reduce(function (a, b) { return a + b; }, 0) + hr[23] + hr[22];
      var trip = road >= 900 ? [900, "تهران تا مشهد", 0] : [450, "تهران تا اصفهان", 0];
      var hourTag = S.busiestHour >= 22 || S.busiestHour <= 4 ? "شب‌زنده‌داری" : S.busiestHour <= 9 ? "سحرخیزی" : S.busiestHour <= 16 ? "روزکاری" : "ترافیک عصر";
      var kmRatio = Math.min(1, road / trip[0]);

      var routeArt = '<svg class="art" viewBox="0 0 320 130" aria-hidden="true"><path d="M12 108 C70 108 70 36 130 52 S210 112 250 60 S296 24 308 22" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".55"/><circle cx="12" cy="108" r="8" fill="currentColor" opacity=".5"/><circle cx="308" cy="22" r="11" class="artpin"/></svg>';
      var kmArt = '<div class="ruler" aria-hidden="true"><div class="rtrack"><i style="width:' + Math.round(kmRatio * 100) + '%"></i></div>' +
        '<div class="rl"><span>' + trip[1].split(" تا ")[0] + "</span><span>" + trip[1].split(" تا ")[1] + "</span></div></div>";

      var slides = [
        { t: "ink", k: "سفرنامهٔ تو", art: routeArt, v: fa(months) + "<small>ماه</small>",
          s: (M.meta.firstJ ? fa(M.meta.firstJ) + " تا " + fa(M.meta.lastJ) + ". " : "") + "بیا ببینیم کجاها رفتی و چقدر خرج شد.",
          chips: [[fa(M.meta.records), "درخواست سفر"], [fa(M.meta.activeDays), "روز فعال"]],
          hint: "بکش، یا از دکمه‌های پایین استفاده کن" },
        { t: "green", k: "سفر موفق", v: fa(M.meta.ok) + "<small>سفر</small>", viz: bars(spN, spNMax, spLab),
          s: "ماهی حدود " + fa(dec(S.perMonth)) + " بار سوار شدی.",
          chips: [M.meta.records - M.meta.ok ? [fa(M.meta.records - M.meta.ok), "درخواست بی‌نتیجه"] : null, [fa(M.meta.streak), "روز پشت‌سرهم، رکورد"]] },
        { t: "amber", k: "کرایهٔ پرداختی", v: money(M.money.total) + "<small>تومان</small>", viz: bars(spT, spPeak, spLab),
          s: "ماهی حدود " + money(S.spendPerMonth) + " تومان.",
          chips: [[money(M.money.median), "سفر معمولی"], [money(S.priciest), "گران‌ترین سفر"], M.money.discount ? [money(M.money.discount), "تخفیف گرفتی"] : null] },
        { t: "ink", k: "مسافت تقریبی", v: fa(grp(road)) + "<small>کیلومتر</small>", art: kmArt,
          s: "حدود " + fa(dec((road / trip[0]).toFixed(1))) + " بار " + trip[1] + ".",
          chips: [[fa(Math.round(M.dist.avg * M.dist.factor)), "کیلومتر، سفر معمولی"], [fa(S.farthest), "طولانی‌ترین سفر"], L ? [fa(grp(L.km)), "کل سفرها از روز اول (اسنپ)"] : null] },
        { t: "green", k: "شلوغ‌ترین زمان", v: DAYS[S.busiestDay], viz: bars(hr, hrMax, ["۰", "۲۳"]),
          s: hourTag + ": بیشتر ساعت " + fa(S.busiestHour) + " تا " + fa((S.busiestHour + 1) % 24) + " سفر کردی.",
          chips: [[fa(night), "سفر بین ۲۲ تا ۵ صبح"], [fa(dec(M.time.avgMin)), "دقیقه، میانگین سفر"]] }
      ];
      if (peak) slides.push({ t: "amber", k: "پرخرج‌ترین ماه", v: fa(peak.name), viz: bars(spT, spPeak, spLab),
        s: money(peak.total) + " تومان، در " + fa(peak.n) + " سفر.",
        chips: [[money(Math.round(peak.total / Math.max(1, peak.n))), "میانگین هر سفر آن ماه"]] });
      if (P) {
        var top3 = M.places.slice(0, 4), mx3 = top3[0].n;
        slides.push({ t: "ink", k: "پرتکرارترین مکان", v: short(cityless(P.name).split("،")[0]),
          s: fa(P.n) + " بار مبدأ یا مقصد سفرت بود.",
          viz: '<div class="rk" aria-hidden="true">' + top3.slice(1).map(function (pl, i) {
            return '<div><em>' + fa(i + 2) + "</em><span>" + short(cityless(pl.name).split("،")[0]) + '</span><i style="width:' + Math.round(100 * pl.n / mx3) + '%"></i><b>' + fa(pl.n) + "</b></div>";
          }).join("") + "</div>",
          chips: [[fa(M.meta.clusters), "مکان متفاوت"]] });
      }
      if (TH && TH.mult > 1.1) slides.push({ t: "green", k: "کرایهٔ یک مسیر ثابت", v: X(TH.mult.toFixed(1)),
        viz: bars(TH.years.map(function (y) { return y.med; }), TH.years.length - 1, [TH.years[0].label || "", TH.years[TH.years.length - 1].label || ""]),
        s: "همان مسیر همیشگی‌ات از " + money(TH.years[0].med) + " به " + money(TH.years[TH.years.length - 1].med) + " تومان رسید.",
        chips: [[fa(TH.n), "بار رفتی"], [fa(dec(TH.km)), "کیلومتر"]] });

      var reel = clear("reel");
      slides.forEach(function (c, i) {
        var plain = String(c.v).replace(/<[^>]*>/g, "").length;
        reel.appendChild(div("slide t-" + c.t + (plain > 9 ? " long" : plain > 6 ? " mid" : ""),
          '<div class="top"><span class="sk">' + c.k + '</span><span class="idx">' + fa(i + 1) + " از " + fa(slides.length) + "</span></div>" +
          (c.art || "") + (c.viz || "") +
          '<span class="sv">' + c.v + '</span><span class="ss">' + c.s + "</span>" +
          (c.chips ? chips(c.chips) : "") +
          (c.hint ? '<span class="hint">' + c.hint + "</span>" : "")));
      });

      /* dots + arrows + keyboard */
      var dots = clear("dots"), all = reel.children, cur = 0;
      for (var i = 0; i < all.length; i++) dots.appendChild(document.createElement("i"));
      function mark(n) { cur = n; for (var j = 0; j < dots.children.length; j++) dots.children[j].classList.toggle("on", j === n); }
      function go(n) {
        n = Math.max(0, Math.min(all.length - 1, n));
        all[n].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) mark(Array.prototype.indexOf.call(all, e.target)); });
        }, { root: reel, threshold: 0.6 });
        for (var k = 0; k < all.length; k++) io.observe(all[k]);
      }
      mark(0);
      document.getElementById("rn-next").onclick = function () { go(cur + 1); };
      document.getElementById("rn-prev").onclick = function () { go(cur - 1); };
      reel.onkeydown = function (e) {
        if (e.target !== reel) return;
        if (e.key === "ArrowLeft") { go(cur + 1); e.preventDefault(); }
        if (e.key === "ArrowRight") { go(cur - 1); e.preventDefault(); }
      };
      reel.scrollLeft = 0;

      var lf = document.getElementById("life");
      lf.hidden = !L;
      if (L) lf.innerHTML = "از روز اول حسابت (عدد خود اسنپ، بیشتر از ۱۲ ماه اخیر): <b>" + fa(grp(L.rides)) +
        "</b> سفر موفق · <b>" + fa(grp(L.km)) + "</b> کیلومتر · <b>" + fa(grp(L.hours)) + "</b> ساعت.";
    })();

    /* ── thesis tape ──────────────────────── */
    (function () {
    var TH = M.thesis, yrs = TH && TH.years;
    document.querySelector(".thesis").hidden = !TH;
    if (!TH) return;
    document.getElementById("thesis-h").textContent = "یک مسیر ثابت، " + fa(TH.n) + " بار";
    document.getElementById("route-desc").textContent =
      TH.stops.map(cityless).join(" ↔ ") + " · " + fa(dec(TH.km)) + " کیلومتر · هر دو جهت";
    document.getElementById("route-mult").innerHTML =
      X(TH.mult.toFixed(1)) + "<small>برابر شدن کرایه</small>";
    var tape = clear("tape"), bars = clear("tape-bars");
    tape.style.gridTemplateColumns = bars.style.gridTemplateColumns =
      "repeat(" + yrs.length + ",minmax(0,1fr))";
    var maxFare = Math.max.apply(null, yrs.map(function (y) { return y.med; }));
    yrs.forEach(function (y, i) {
      var last = i === yrs.length - 1;
      tape.appendChild(div("tick" + (last ? " last" : ""),
        '<span class="when">' + fa(y.label || y.y) + " · " + fa(y.n) + ' سفر</span>' +
        '<span class="fare">' + money(y.med) + ' <span class="unit">تومان</span></span>'));
      var b = document.createElement("i");
      b.style.height = (14 + 58 * y.med / maxFare) + "px";
      tape.lastChild.style.setProperty("--h", (14 + 58 * y.med / maxFare) + "px");
      if (last) b.className = "hot";
      bars.appendChild(b);
    });
    var ik = M.infl.length > 1 ? ratio(M.infl[M.infl.length-1].v, M.infl[0].v) : 0;
    document.getElementById("thesis-cap").innerHTML =
      "کرایهٔ معمولی (میانه) در هر سال یا فصل، روی " + fa(TH.n) + " سفر. کرایهٔ این مسیر " +
      fa(dec(TH.mult.toFixed(1))) + " برابر شده" + (ik
        ? "، ولی تومان بر کیلومتر در کل سفرها در همین مدت " + fa(dec(ik.toFixed(1))) + " برابر؛ یعنی گرانی همه‌جا یکسان نبوده."
        : ".");
    })();

    /* ── stats ────────────────────────────── */
    var road = Math.round(M.dist.straight * M.dist.factor);
    var stats = clear("stats");
    [["کل کرایهٔ پرداختی", money(M.money.total) + " ت", "میانگین " + money(M.money.avg) + " تومان در هر سفر"],
     ["سفر موفق", fa(M.meta.ok), "از " + fa(M.meta.records) + " رکورد"],
     ["مسافت تقریبی", fa(grp(road)) + " کیلومتر", fa(grp(M.dist.straight)) + " کیلومتر خط مستقیم × ۱٫۴"],
     ["زمان توی راه", fa(M.time.hours) + " ساعت", "میانگین " + fa(dec(M.time.avgMin)) + " دقیقه"],
     ["تخفیفی که گرفتی", money(M.money.discount) + " ت", "روی کل سفرها"],
     ["روزهایی که سفر کردی", fa(M.meta.activeDays), "از " + fa(M.meta.spanDays) + " روز"]
    ].forEach(function (s) {
      stats.appendChild(div("stat", '<span class="v">' + s[1] + '</span><span class="k">' +
        s[0] + '</span><span class="sub">' + s[2] + "</span>"));
    });

    /* ── inflation line ───────────────────── */
    (function () {
      var s = M.infl, svg = document.getElementById("c-infl");
      svg.innerHTML = "";
      var L = 62, R = 18, T = 18, B = 46, W = 840, H = 300;
      var iw = W - L - R, ih = H - T - B;
      var max = Math.ceil(Math.max.apply(null, s.map(function (d) { return d.v; })) / 5000) * 5000;
      var x = function (i) { return L + (s.length === 1 ? iw/2 : iw * i / (s.length - 1)); };
      var y = function (v) { return T + ih - ih * v / max; };
      for (var g = 0; g <= max; g += Math.max(5000, Math.round(max/6/5000)*5000)) {
        el("line", { x1: L, x2: L+iw, y1: y(g), y2: y(g), "class": g ? "grid" : "base" }, svg);
        el("text", { x: L-10, y: y(g)+4, "class": "axis", "text-anchor": "end" }, svg)
          .textContent = fa(grp(g));
      }
      el("text", { x: L+iw, y: T-4, "class": "axis-fa", "text-anchor": "end" }, svg)
        .textContent = "تومان بر کیلومتر";
      el("path", { d: "M" + x(0) + "," + y(0) + " " + s.map(function (d, i) {
        return "L" + x(i) + "," + y(d.v); }).join(" ") + " L" + x(s.length-1) + "," + y(0) + " Z",
        fill: "var(--s1)", opacity: ".15" }, svg);
      el("path", { d: "M" + s.map(function (d, i) { return x(i) + "," + y(d.v); }).join(" L"),
        fill: "none", stroke: "var(--s1)", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
      s.forEach(function (d, i) {
        el("circle", { cx: x(i), cy: y(d.v), r: 4, fill: "var(--s1)",
          stroke: "var(--card)", "stroke-width": 2 }, svg);
        var step = s.length > 10 ? 2 : 1;
        if (i % step === 0 || i === s.length - 1) {
          el("text", { x: x(i), y: H-B+19, "class": "axis-fa", "text-anchor": "middle" }, svg)
            .textContent = A.SEASON[d.q] + " " + fa(String(d.y).slice(2));
        }
      });
      var last = s[s.length-1];
      el("text", { x: x(s.length-1)-6, y: y(last.v)-14, "class": "axis-fa", "text-anchor": "end",
        fill: "var(--sodium)", "font-weight": "700" }, svg).textContent = money(last.v);
      var ch = el("line", { y1: T, y2: T+ih, "class": "crosshair" }, svg);
      var mk = el("circle", { r: 5.5, "class": "marker" }, svg);
      s.forEach(function (d, i) {
        var hw = iw / s.length;
        var h = el("rect", { x: x(i)-hw/2, y: T, width: hw, height: ih, "class": "hit" }, svg);
        h.addEventListener("mousemove", function (e) {
          ch.setAttribute("x1", x(i)); ch.setAttribute("x2", x(i)); ch.style.opacity = ".7";
          mk.setAttribute("cx", x(i)); mk.setAttribute("cy", y(d.v)); mk.style.opacity = "1";
          tipOn(e, "<b>" + A.SEASON[d.q] + " " + fa(d.y) + "</b><br>" + money(d.v) +
            " تومان بر کیلومتر<br>" + fa(d.n) + " سفر");
        });
        h.addEventListener("mouseleave", function () {
          ch.style.opacity = "0"; mk.style.opacity = "0"; tipOff();
        });
      });
      var base = s[0].v;
      document.getElementById("infl-cap").innerHTML =
        "از " + money(base) + " تومان در " + A.SEASON[s[0].q] + " " + fa(s[0].y) +
        " به <b style='color:var(--sodium)'>" + money(last.v) + "</b> تومان در " +
        A.SEASON[last.q] + " " + fa(last.y) + "؛ " + fa(dec(ratio(last.v, base).toFixed(1))) + " برابر.";
      var tb = document.querySelector("#infl-tbl tbody"); tb.innerHTML = "";
      s.forEach(function (d) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + A.SEASON[d.q] + " " + fa(d.y) + "</td><td>" + money(d.v) +
          "</td><td>" + fa(d.n) + "</td><td>" + X(ratio(d.v, base).toFixed(2)) + "</td>";
        tb.appendChild(tr);
      });
    })();

    /* ── corridors ────────────────────────── */
    (function () {
      var rs = M.corridors.filter(function (r) { return r.n >= 4 && r.solid.length > 1; });
      var box = clear("baskets");
      if (!rs.length) { box.appendChild(div("cap", "مسیری که چند بار و در چند دورهٔ مختلف رفته باشی پیدا نشد، پس مقایسهٔ کرایه‌ای نداریم.")); return; }
      var mx = Math.max.apply(null, rs.reduce(function (a, r) {
        return a.concat(r.solid.map(function (y) { return y.med; })); }, []));
      rs.forEach(function (r) {
        var a = r.solid[0], b = r.solid[r.solid.length-1];
        box.appendChild(div("basket",
          '<div class="b-name">' + r.stops.map(function (t) { return esc(cityless(t)); }).join(" ↔ ") +
            '<em>' + fa(dec(r.km)) + ' کیلومتر</em></div>' +
          '<div class="b-count">' + fa(r.n) + ' سفر</div>' +
          '<div class="b-bars">' +
            '<div class="b-row a"><span class="yr">' + fa(a.label || a.y) + '</span>' +
              '<span class="bar" style="width:' + Math.max(2, 100*a.med/mx) + '%"></span>' +
              '<span class="amt">' + money(a.med) + '</span>' +
              '<span style="color:var(--muted)">(' + fa(a.n) + ' سفر)</span></div>' +
            '<div class="b-row b"><span class="yr">' + fa(b.label || b.y) + '</span>' +
              '<span class="bar" style="width:' + Math.max(2, 100*b.med/mx) + '%"></span>' +
              '<span class="amt">' + money(b.med) + '</span>' +
              '<span style="color:var(--sodium);font-weight:700">' +
                X(ratio(b.med, a.med).toFixed(1)) + '</span></div>' +
          '</div>'));
      });
    })();

    /* ── maps ─────────────────────────────── */
    (function () {
      var box = clear("maps");
      M.areas.forEach(function (area, idx) {
        var narrow = window.innerWidth < 600, W = narrow ? 340 : 640, H = narrow ? 420 : 460, pad = narrow ? 24 : 28, Hm = H - 70; /* bottom strip is reserved for the scale bar */
        var lats = [], lngs = [];
        area.paths.forEach(function (p) { p.forEach(function (q) { lats.push(q[0]); lngs.push(q[1]); }); });
        var qt = function (arr, f) {
          var s2 = arr.slice().sort(function (a, b) { return a - b; });
          return s2[Math.max(0, Math.min(s2.length-1, Math.round((s2.length-1)*f)))];
        };
        var la0 = qt(lats, .02), la1 = qt(lats, .98), ln0 = qt(lngs, .02), ln1 = qt(lngs, .98);
        if (la1 - la0 < 1e-4) { la0 -= 5e-4; la1 += 5e-4; }
        if (ln1 - ln0 < 1e-4) { ln0 -= 5e-4; ln1 += 5e-4; }
        var k = Math.cos((la0+la1)/2 * Math.PI/180);
        var sc = Math.min((W-2*pad)/((ln1-ln0)*k), (Hm-2*pad)/(la1-la0));
        var ox = (W - (ln1-ln0)*k*sc)/2, oy = (Hm - (la1-la0)*sc)/2;
        var X = function (ln) { return ox + (ln-ln0)*k*sc; };
        var Y = function (la) { return Hm - (oy + (la-la0)*sc); };
        var pxKm = sc / 111.2;

        var cell = div("mapcell");
        var mn = area.paths.filter(function (p) { return p.length > 2; }).length;
        cell.appendChild(div("mhead", "<h3>" + esc(area.name) + "</h3><span>" + fa(area.paths.length) + " سفر" +
          (mn ? " · " + fa(mn) + " سفر دومقصده" : "") + "</span>"));
        var body = div("mapbody"); cell.appendChild(body);

        var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "class": "mapsvg",
          "aria-label": "نقشهٔ سفرهای " + area.name + "؛ شمارهٔ مکان‌ها در فهرست کنار نقشه آمده است" });
        el("rect", { x: 0, y: 0, width: W, height: H, "class": "map-bg" }, svg);
        /* faint graticule so distances can be judged by eye */
        var step = pxKm >= 40 ? 1 : pxKm >= 12 ? 2 : pxKm >= 5 ? 5 : 10;
        var sp = step * pxKm, i2;
        for (i2 = 0; ox + i2 * sp <= W; i2++) el("line", { x1: ox + i2 * sp, x2: ox + i2 * sp, y1: 0, y2: Hm, "class": "map-grid" }, svg);
        for (i2 = 1; ox - i2 * sp >= 0; i2++) el("line", { x1: ox - i2 * sp, x2: ox - i2 * sp, y1: 0, y2: Hm, "class": "map-grid" }, svg);
        for (i2 = 0; Hm - oy - i2 * sp >= 0; i2++) el("line", { x1: 0, x2: W, y1: Hm - oy - i2 * sp, y2: Hm - oy - i2 * sp, "class": "map-grid" }, svg);
        for (i2 = 1; Hm - oy + i2 * sp <= Hm; i2++) el("line", { x1: 0, x2: W, y1: Hm - oy + i2 * sp, y2: Hm - oy + i2 * sp, "class": "map-grid" }, svg);

        var cid = "clip-" + idx, cp = el("clipPath", { id: cid }, el("defs", {}, svg));
        el("rect", { x: 0, y: 0, width: W, height: H }, cp);
        var g0 = el("g", { "clip-path": "url(#" + cid + ")" }, svg);
        area.paths.forEach(function (p) {
          el("polyline", {
            points: p.map(function (q) { return X(q[1]) + "," + Y(q[0]); }).join(" "),
            fill: "none", "class": p.length > 2 ? "route multi" : "route",
            "stroke-linecap": "round", "stroke-linejoin": "round" }, g0);
        });
        var inb = M.places.filter(function (pl) {
          return pl.lat >= la0 && pl.lat <= la1 && pl.lng >= ln0 && pl.lng <= ln1; });
        var mxn = Math.max.apply(null, inb.map(function (p) { return p.n; }).concat([1]));
        var named = inb.slice(0, 6);
        var tipFor = function (g, pl) {
          g.addEventListener("mousemove", function (e) { tipOn(e, "<b>" + fa(pl.n) + " بار</b><br>" + esc(pl.name)); });
          g.addEventListener("mouseleave", tipOff);
        };
        /* small places: plain dots */
        inb.forEach(function (pl) {
          if (named.indexOf(pl) >= 0) return;
          var g = el("g", {}, g0);
          el("circle", { cx: X(pl.lng), cy: Y(pl.lat), r: narrow ? 3 : 3.5, "class": "pin-s" }, g);
          tipFor(g, pl);
        });
        /* numbered places: shrink when crowded, then push apart so no badge covers another */
        var rMax = narrow ? 10 : 12, rMin = narrow ? 8 : 9, GAP = 3;
        var nb = named.map(function (pl) {
          var x = X(pl.lng), y = Y(pl.lat);
          return { pl: pl, tx: x, ty: y, x: x, y: y, w: Math.sqrt(pl.n / mxn) };
        });
        var near = Infinity;
        nb.forEach(function (a, i) { nb.forEach(function (b, j) {
          if (j > i) near = Math.min(near, Math.hypot(a.tx - b.tx, a.ty - b.ty)); }); });
        var fit = Math.max(rMin, Math.min(rMax, (near - GAP) / 2));
        nb.forEach(function (n) { n.r = Math.max(rMin, Math.min(rMax, fit)) + (fit >= rMax ? (narrow ? 3 : 6) * n.w : 0); });
        for (var it = 0; it < 120; it++) {
          var moved = false;
          for (var a = 0; a < nb.length; a++) for (var b = a + 1; b < nb.length; b++) {
            var A = nb[a], B = nb[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), need = A.r + B.r + GAP;
            if (d < need) {
              if (d < 0.01) { dx = Math.cos(a * 2.4); dy = Math.sin(a * 2.4); d = 1; }
              var push = (need - d) / 2 + 0.05, ux = dx / d, uy = dy / d;
              A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push; moved = true;
            }
          }
          nb.forEach(function (n) {
            n.x = Math.max(n.r + 2, Math.min(W - n.r - 2, n.x));
            n.y = Math.max(n.r + 2, Math.min(Hm - n.r - 2, n.y));
          });
          if (!moved) break;
        }
        /* leader lines first, so badges sit on top */
        nb.forEach(function (n) {
          if (Math.hypot(n.x - n.tx, n.y - n.ty) > 2) {
            el("line", { x1: n.tx, y1: n.ty, x2: n.x, y2: n.y, "class": "pin-lead" }, g0);
            el("circle", { cx: n.tx, cy: n.ty, r: 2.6, "class": "pin-true" }, g0);
          }
        });
        nb.forEach(function (n, ni) {
          var g = el("g", {}, g0);
          el("circle", { cx: n.x, cy: n.y, r: n.r, "class": "pin" }, g);
          var tx = el("text", { x: n.x, y: n.y + n.r * 0.38, "text-anchor": "middle", "class": "pin-n" }, g);
          tx.style.fontSize = Math.round(n.r * 1.15) + "px";
          tx.textContent = fa(ni + 1);
          tipFor(g, n.pl);
        });
        /* scale bar: a labelled ruler in the corner */
        var sbx = 26, sby = H - 22, sbw = step * pxKm, bw = Math.max(sbw + 24, 150);
        el("line", { x1: 0, x2: W, y1: Hm, y2: Hm, "class": "map-grid" }, svg);
        el("text", { x: sbx, y: sby - 22, "class": "map-sbt", direction: "ltr", "text-anchor": "start" }, svg)
          .textContent = "مقیاس: " + fa(step) + " کیلومتر";
        el("line", { x1: sbx, x2: sbx + sbw, y1: sby, y2: sby, "class": "map-sbl" }, svg);
        el("line", { x1: sbx, x2: sbx, y1: sby - 7, y2: sby + 7, "class": "map-sbl" }, svg);
        el("line", { x1: sbx + sbw, x2: sbx + sbw, y1: sby - 7, y2: sby + 7, "class": "map-sbl" }, svg);
        body.appendChild(svg);

        var leg = div("mleg");
        leg.appendChild(div("mleg-h", "پرتکرارترین مکان‌ها"));
        named.forEach(function (pl, i) {
          leg.appendChild(div("mleg-i", '<b class="mn">' + fa(i + 1) + '</b><span class="mname">' +
            esc(cityless(pl.name).split("،").slice(0, 2).join("، ")) + '</span><span class="mc">' + fa(pl.n) + " بار</span>"));
        });
        leg.appendChild(div("mkey", '<span><i class="k-route"></i> سفر مستقیم</span><span><i class="k-multi"></i> دومقصده</span>' +
          '<span class="mhint">هر خانهٔ شبکه: ' + fa(step) + " کیلومتر</span>"));
        body.appendChild(leg);
        box.appendChild(cell);
      });
    })();

    /* ── places ───────────────────────────── */
    (function () {
      var box = clear("places"), mx = M.places[0].n;
      M.places.forEach(function (p) {
        box.appendChild(div("r",
          '<span class="lab" style="width:auto">' + esc(p.name) + '</span>' +
          '<span class="track"><span class="fill" style="width:' + (100*p.n/mx) + '%"></span></span>' +
          '<span class="n">' + fa(p.n) + (p.variants > 3 ?
            ' <span style="opacity:.7">· ' + fa(p.variants) + ' جور آدرس</span>' : "") + '</span>'));
      });
    })();

    /* ── multi-destination ────────────────── */
    (function () {
      var m = M.multi, sec = document.getElementById("sec-multi");
      if (!m.ok) { sec.hidden = true; return; }
      sec.hidden = false;
      document.getElementById("multi-line").innerHTML =
        "<b>" + fa(m.n) + "</b> سفر با ایستگاه میانی ثبت شده (" + fa(m.ok) +
        " تایش به مقصد رسید). میانگین این سفرها <b>" + fa(dec(m.km)) +
        "</b> کیلومتر است، سفر معمولی <b>" + fa(dec(m.kmSingle)) + "</b>.";
      var st = clear("multi-stats");
      [["مسافت میانگین، دومقصده", fa(dec(m.km)) + " کیلومتر"],
       ["مسافت میانگین، تک‌مقصده", fa(dec(m.kmSingle)) + " کیلومتر"],
       ["کرایهٔ میانگین، دومقصده", money(m.price) + " ت"],
       ["کرایهٔ میانگین، تک‌مقصده", money(m.priceSingle) + " ت"]
      ].forEach(function (s) {
        st.appendChild(div("stat", '<span class="v">' + s[1] + '</span><span class="k">' + s[0] + "</span>"));
      });
      var box = clear("multi-pairs");
      if (!M.multiPairs.length) return;
      var mx = M.multiPairs[0].n;
      M.multiPairs.forEach(function (p) {
        box.appendChild(div("r",
          '<span class="lab" style="width:auto">' + esc(cityless(p.a)) + " ← " + esc(cityless(p.b)) + '</span>' +
          '<span class="track"><span class="fill" style="width:' + (100*p.n/mx) +
            '%;background:var(--sodium-mark)"></span></span>' +
          '<span class="n">' + fa(p.n) + " بار · " + fa(p.origins) + ' مبدأ</span>'));
      });
    })();

    /* ── heatmap ──────────────────────────── */
    (function () {
      var g = clear("heat");
      var mx = Math.max.apply(null, M.mat.map(function (r) {
        return Math.max.apply(null, r); }));
      var steps = ["--q1","--q2","--q3","--q4","--q5","--q6"];
      g.appendChild(document.createElement("div"));
      for (var h = 0; h < 24; h++) g.appendChild(div("cl", h % 3 === 0 ? fa(h) : ""));
      M.mat.forEach(function (row, d) {
        g.appendChild(div("rl", DAYS[d]));
        row.forEach(function (v, hh) {
          var c = div("cell");
          if (v > 0) c.style.background = "var(" + steps[Math.min(5, Math.floor(v/mx*5.999))] + ")";
          c.addEventListener("mousemove", function (e) {
            tipOn(e, "<b>" + DAYS[d] + " ساعت " + fa(hh) + "</b><br>" + fa(v) + " سفر"); });
          c.addEventListener("mouseleave", tipOff);
          g.appendChild(c);
        });
      });
    })();

    bars2("c-hour", M.hour, M.hour.map(function (_, i) { return i % 3 === 0 ? fa(i) : ""; }),
      function (i, v) { return "<b>ساعت " + fa(i) + "</b><br>" + fa(v) + " سفر"; });
    bars2("c-wday", M.weekday, ["ش","ی","د","س","چ","پ","ج"],
      function (i, v) { return "<b>" + DAYS[i] + "</b><br>" + fa(v) + " سفر"; });

    /* ── monthly spend ────────────────────── */
    (function () {
      var s = M.spend, svg = document.getElementById("c-spend");
      svg.innerHTML = "";
      var W = 840, H = 230, L = 62, R = 12, T = 14, B = 40;
      var iw = W - L - R, ih = H - T - B;
      var mx = Math.max.apply(null, s.map(function (d) { return d.total; }));
      var bw = iw / s.length;
      el("line", { x1: L, x2: L+iw, y1: T+ih, y2: T+ih, "class": "base" }, svg);
      [0.5, 1].forEach(function (f) {
        el("line", { x1: L, x2: L+iw, y1: T+ih-ih*f, y2: T+ih-ih*f, "class": "grid" }, svg);
        el("text", { x: L-8, y: T+ih-ih*f+4, "class": "axis-fa", "text-anchor": "end" }, svg)
          .textContent = fa(dec((mx*f/1e6).toFixed(1))) + " م";
      });
      s.forEach(function (d, i) {
        var h = ih * d.total / mx, last = i === s.length-1;
        el("rect", { x: L+i*bw+1, y: T+ih-h, width: Math.max(1, bw-2), height: h,
          fill: last ? "var(--q3)" : "var(--s1)", rx: 2 }, svg);
        if (/-01$/.test(d.m)) {
          el("text", { x: L+i*bw+bw/2, y: H-B+18, "class": "axis", "text-anchor": "middle" }, svg)
            .textContent = fa(d.m.slice(0, 4));
        }
        var hit = el("rect", { x: L+i*bw, y: T, width: bw, height: ih, "class": "hit" }, svg);
        hit.addEventListener("mousemove", function (e) {
          tipOn(e, "<b>" + fa(d.m) + "</b><br>" + money(d.total) + " تومان<br>" + fa(d.n) + " سفر"); });
        hit.addEventListener("mouseleave", tipOff);
      });
    })();

    /* ── fleet ────────────────────────────── */
    (function () {
      var v = M.vehicles, mx = v[0][1], box = clear("veh");
      v.forEach(function (kv) {
        box.appendChild(div("r",
          '<span class="lab">' + (kv[0] === "Bike" ? "موتور (اسنپ بایک)" : esc(kv[0])) + '</span>' +
          '<span class="track"><span class="fill" style="width:' + (100*kv[1]/mx) + '%"></span></span>' +
          '<span class="n">' + fa(kv[1]) + '</span>'));
      });
      document.getElementById("driver-line").innerHTML =
        "توی " + fa(M.meta.ok) + " سفر، <b>" + fa(M.drivers.unique) +
        "</b> راننده با هم فرق داشتند و فقط <b>" + fa(M.drivers.repeat) +
        "</b> نفرشان بیش از یک بار تکرار شدند. " + esc(v[0][0]) + " تنها <b>" +
        fa(Math.round(100*v[0][1]/M.meta.ok)) + "٪</b> سفرها را برده.";
      var rc = clear("rate-chips"), order = ["5","4","3","2","1"];
      var rtot = order.reduce(function (a, k) { return a + (M.ratings[k] || 0); }, 0);
      order.forEach(function (k) {
        var col = k === "5" ? "var(--good)" : k === "1" ? "var(--crit)" : "var(--muted)";
        rc.appendChild(div("chip", '<span class="dot" style="background:' + col + '"></span>' +
          fa(k) + " ستاره <b>" + fa(M.ratings[k] || 0) + "</b>"));
      });
      document.getElementById("rate-note").textContent = rtot
        ? fa(Math.round(100*(M.ratings["5"]||0)/rtot)) + "٪ از امتیازها پنج ستاره بوده."
        : "امتیازی ثبت نشده.";
    })();

    /* ── cancellations ────────────────────── */
    (function () {
      var box = clear("cx"), tot = M.meta.records;
      [["لغو توسط راننده", M.meta.cancelDriver], ["لغو توسط شما", M.meta.cancelMe],
       ["به مقصد رسیده", M.meta.ok]].forEach(function (kv) {
        box.appendChild(div("r", '<span class="lab">' + kv[0] + '</span>' +
          '<span class="track"><span class="fill" style="width:' + (100*kv[1]/tot) + '%"></span></span>' +
          '<span class="n">' + fa(Math.round(100*kv[1]/tot)) + '٪</span>'));
      });
      var ch = clear("cx-hours");
      M.cancelH.slice().sort(function (a, b) { return b.pct - a.pct; }).slice(0, 4)
        .forEach(function (h) {
          ch.appendChild(div("chip", "ساعت " + fa(h.h) + " <b>" + fa(h.pct) +
            '٪</b> <span style="color:var(--muted)">از ' + fa(h.n) + " درخواست</span>"));
        });
    })();

    /* ── facts ────────────────────────────── */
    (function () {
      var road = Math.round(M.dist.straight * M.dist.factor);
      var night = M.hour.slice(0, 6).reduce(function (a, b) { return a + b; }, 0);
      var box = clear("facts");
      [[fa(M.meta.streak) + " روز", "بیشترین روزِ پشت‌سرهم که سفر داشتی"],
       [fa(night), "سفر بین نیمه‌شب و ۶ صبح"],
       [fa(dec((road/40075*100).toFixed(1))) + "٪", "از دور زمین، با مسیر تخمینی"],
       [fa(Math.round(M.time.hours/24)) + " شبانه‌روز", "زمان توی راه و منتظر ماندن"],
       [money(M.money.max) + " ت", "گران‌ترین سفر"],
       [fa(M.meta.clusters) + " مکان", "از " + fa(M.meta.coords) + " مختصات خام که کنار هم جمع شد"],
       [fa(M.multi.n), "سفر با ایستگاه میانی"],
       M.opts.hurry ? [fa(M.opts.hurry), "بار «عجله دارم» را زدی"]
                    : [fa(M.story.cancelPct) + "٪", "از درخواست‌هایت لغو شد"],
       [fa(M.opts.wait), "بار از راننده خواستی بین راه منتظرت بماند"]
      ].forEach(function (f) {
        box.appendChild(div("fact", '<span class="fv">' + f[0] + '</span><span class="fk">' + f[1] + "</span>"));
      });
    })();
  }

  function bars2(id, vals, labels, fmt) {
    var svg = document.getElementById(id);
    svg.innerHTML = "";
    var vb = svg.getAttribute("viewBox").split(" ").map(Number);
    var W = vb[2], H = vb[3], L = 34, R = 8, T = 12, B = 30;
    var iw = W - L - R, ih = H - T - B;
    var mx = Math.max.apply(null, vals) || 1;
    el("line", { x1: L, x2: L+iw, y1: T+ih, y2: T+ih, "class": "base" }, svg);
    var bw = iw / vals.length;
    vals.forEach(function (v, i) {
      var h = ih * v / mx;
      el("rect", { x: L+i*bw+1, y: T+ih-h, width: Math.max(1, bw-2), height: h,
        fill: "var(--s1)", rx: Math.min(3, (bw-2)/2) }, svg);
      if (labels && labels[i]) {
        el("text", { x: L+i*bw+bw/2, y: H-B+16, "class": "axis", "text-anchor": "middle" }, svg)
          .textContent = labels[i];
      }
      var hit = el("rect", { x: L+i*bw, y: T, width: bw, height: ih, "class": "hit" }, svg);
      hit.addEventListener("mousemove", function (e) { tipOn(e, fmt(i, v)); });
      hit.addEventListener("mouseleave", tipOff);
    });
    el("text", { x: L-8, y: T+10, "class": "axis", "text-anchor": "end" }, svg).textContent = fa(mx);
  }

  /* Date range + service: filter the rides in memory and re-analyse. Nothing is stored. */
  var RANGES = [["all", "کل بازه", 0], ["6m", "۶ ماه اخیر", 183], ["3m", "۳ ماه اخیر", 91], ["1m", "ماه اخیر", 30]];
  var MIN_RIDES = 8, MIN_SVC = 5;
  function renderData(data, isDemo) {
    var rides = Array.isArray(data) ? data : (data && data.rides) || null;
    var life = data && !Array.isArray(data) ? data.lifetime : null;
    var box = document.getElementById("range");
    if (!rides || !box) { render(A.analyze(data), isDemo); return; }
    var latest = 0;
    rides.forEach(function (r) { var t = Date.parse(String(r.created_at).replace(" ", "T")); if (t > latest) latest = t; });
    var svcOf = function (r) { return A.serviceGroup(r.service_type_name); };
    function inRange(days) {
      if (!days) return rides;
      var cut = latest - days * 86400000;
      return rides.filter(function (r) { return Date.parse(String(r.created_at).replace(" ", "T")) >= cut; });
    }
    function subset(days, svc) {
      var list = inRange(days);
      return svc === "all" ? list : list.filter(function (r) { return svcOf(r) === svc; });
    }
    /* chips count finished rides, the same number the cards below show (cancelled requests are not trips) */
    var done = function (list) { return list.filter(function (r) { return r.latest_ride_status === 5; }); };
    var curRange = RANGES[0], curSvc = "all";

    function chip(parent, label, count, pressed, onclick) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-pressed", String(pressed));
      b.innerHTML = esc(label) + "<small>" + fa(count) + " سفر</small>";
      b.onclick = onclick; parent.appendChild(b);
    }
    function paint() {
      box.innerHTML = "";
      box.appendChild(div("range-l", "بازهٔ گزارش"));
      RANGES.forEach(function (rg) {
        var n = done(subset(rg[2], curSvc)).length;
        if (rg[0] !== "all" && (n < MIN_RIDES || n === done(subset(0, curSvc)).length)) return;
        chip(box, rg[1], n, rg[0] === curRange[0], function () { apply(rg, curSvc); });
      });
      /* a service filter is only worth showing when two or more real services exist */
      var all = inRange(curRange[2]), count = Object.create(null);
      done(all).forEach(function (r) { var k = svcOf(r); count[k] = (count[k] || 0) + 1; });
      var names = Object.keys(count).filter(function (k) { return count[k] >= MIN_SVC || k === curSvc; })
        .sort(function (a, b) { return count[b] - count[a]; });
      var sf = document.getElementById("svc-filter");
      sf.innerHTML = ""; sf.hidden = names.length < 2;
      if (names.length < 2) return;
      sf.appendChild(div("range-l", "سرویس"));
      chip(sf, "همه", done(all).length, curSvc === "all", function () { apply(curRange, "all"); });
      names.forEach(function (k) {
        chip(sf, k, count[k], curSvc === k, function () { apply(curRange, k); });
      });
    }
    function paintServices() {
      var sec = document.getElementById("sec-services"), list = clear("svcs");
      var st = A.serviceStats({ rides: inRange(curRange[2]) });
      sec.hidden = st.length < 2;
      if (st.length < 2) return;
      st.forEach(function (x) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "svc"; b.setAttribute("aria-pressed", String(curSvc === x.name));
        b.innerHTML =
          '<span class="svc-h"><b>' + esc(x.name) + '</b><span>' + fa(x.n) + ' سفر · ' + fa(x.share) + '٪</span></span>' +
          '<span class="svc-bar"><i style="width:' + Math.max(3, x.share) + '%"></i></span>' +
          '<span class="svc-g">' +
            '<span><small>خرج کل</small><b>' + money(x.total) + ' <em>تومان</em></b></span>' +
            '<span><small>کرایهٔ معمولی</small><b>' + (x.median ? money(x.median) + ' <em>تومان</em>' : "–") + '</b></span>' +
            '<span><small>هر کیلومتر</small><b>' + (x.perKm ? money(x.perKm) + ' <em>تومان</em>' : "–") + '</b></span>' +
            '<span><small>میانگین مسیر</small><b>' + (x.avgKm ? fa(dec(x.avgKm)) + ' <em>کیلومتر</em>' : "–") + '</b></span>' +
          '</span>' +
          (x.parts.length > 1 ? '<span class="svc-p">شامل: ' + x.parts.map(function (p) { return esc(p[0]) + " " + fa(p[1]); }).join("، ") + '</span>' : "");
        b.onclick = function () { apply(curRange, curSvc === x.name ? "all" : x.name); };
        list.appendChild(b);
      });
      document.getElementById("svc-cap").textContent =
        "کرایهٔ معمولی، تومان بر کیلومتر و میانگین مسیر فقط روی سفرهای شهری (زیر ۳۰ کیلومتر) حساب شده تا چند سفر بین‌شهری عددها را بالا نبرد. تومان بر کیلومتر روی خط مستقیم است؛ برای مقایسهٔ این دو خوب است، نه برای قیمت واقعی هر کیلومتر.";
    }
    function apply(rg, svc) {
      var note = document.getElementById("range-note");
      try { render(A.analyze({ rides: subset(rg[2], svc), lifetime: svc === "all" ? life : null }), isDemo); }
      catch (e) { if (note) { note.hidden = false; note.textContent = "برای این انتخاب سفر کافی نیست. بازه یا سرویس بزرگ‌تری انتخاب کن."; }
        return; }
      curRange = rg; curSvc = svc;
      if (note) { note.hidden = svc === "all"; if (svc !== "all") note.textContent = "فقط سفرهای «" + svc + "»"; }
      paint(); paintServices();
    }
    apply(RANGES[0], "all");
  }
  root.SnappReport = { render: render, renderData: renderData, fa: fa, money: money };
})(window);
