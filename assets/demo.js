/* Synthetic sample data, so a visitor can see the report before running
   anything. Entirely invented: a fictional city on an arbitrary grid, invented
   places, invented driver names. The report is stamped "نمونه" when it is used.
   Profile: an office commuter who also bikes to the gym. Not anyone's real history. */
(function (root) {
  "use strict";

  var seed = 424242;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function jitter(v, m) { return v + (rnd() - 0.5) * m; }

  var HOME = { lat: 36.3080, lng: 59.5610, addr: "شهر نمونه، محلهٔ بهار، خیابان یاس ۱۲" };
  var WORK = { lat: 36.3342, lng: 59.5987, addr: "شهر نمونه، بلوار آرمان، برج کوشا" };
  var SPOTS = [
    { lat: 36.3190, lng: 59.5420, addr: "شهر نمونه، میدان فجر، باشگاه ورزشی ققنوس", w: 14 },
    { lat: 36.3010, lng: 59.5890, addr: "شهر نمونه، خیابان سرو، مرکز خرید ستاره", w: 8 },
    { lat: 36.3455, lng: 59.5560, addr: "شهر نمونه، بلوار گل‌سرخ، کتاب‌فروشی پاپیروس", w: 6 },
    { lat: 36.2890, lng: 59.5330, addr: "شهر نمونه، خیابان نسترن، خانهٔ پدربزرگ", w: 9 },
    { lat: 36.3268, lng: 59.6190, addr: "شهر نمونه، خیابان آبی، سینما رویا", w: 5 },
    { lat: 36.3120, lng: 59.6050, addr: "شهر نمونه، پارک کوهسار، ورودی شمالی", w: 5 }
  ];
  var FAR = { lat: 36.0020, lng: 59.9100, addr: "شهر دور، ورودی شهر، پایانهٔ مسافربری" };
  var CARS = ["پژو ۲۰۶","تیبا","دنا","ساینا","پژو پارس","کوییک","سمند"];
  var FIRST = ["احسان","بهزاد","کیوان","سینا","فرزاد","نیما","مجتبی","آرش","هادی","پویا"];
  var LAST = ["صالحی","مرادی","فرهادی","طاهری","جعفری","اکبری","رحیمی","سلیمانی","نجفی","کیانی"];

  function weighted() {
    var tot = SPOTS.reduce(function (a, s) { return a + s.w; }, 0), r = rnd() * tot;
    for (var i = 0; i < SPOTS.length; i++) { r -= SPOTS[i].w; if (r <= 0) return SPOTS[i]; }
    return SPOTS[0];
  }
  function place(p) {
    return { lat: +jitter(p.lat, 0.0006).toFixed(7), lng: +jitter(p.lng, 0.0006).toFixed(7),
             formatted_address: p.addr };
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(d) {
    return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + " " +
           pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function build() {
    var rides = [], start = new Date(2025, 10, 9), end = new Date(2026, 10, 4);
    var day = new Date(start), n = 0;
    while (day < end) {
      day = new Date(day.getTime() + 86400000);
      var dow = day.getDay();                               // 0 = Sunday
      var weekday = dow !== 5 && dow !== 4;                 // Thu/Fri off
      var plan = [];
      if (weekday && rnd() < 0.21) plan.push({ o: HOME, d: WORK, h: pick([7, 8, 8, 9]) });
      if (weekday && rnd() < 0.19) plan.push({ o: WORK, d: HOME, h: pick([16, 17, 17, 18]) });
      if (!weekday && rnd() < 0.32) {
        var s = weighted(); plan.push({ o: HOME, d: s, h: pick([11, 15, 19, 20]) });
        if (rnd() < 0.7) plan.push({ o: s, d: HOME, h: pick([21, 22, 23]) });
      }
      if (rnd() < 0.015) plan.push({ o: HOME, d: FAR, h: 9 });
      plan.forEach(function (t) {
        var months = (day - start) / 86400000 / 30.4;
        var infl = Math.pow(1.031, months);                  // about x1.45 over the year
        var far = t.d === FAR;
        var multi = !far && rnd() < 0.05;
        var at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, Math.floor(rnd()*60), Math.floor(rnd()*60));
        var dLat = t.d.lat - t.o.lat, dLng = (t.d.lng - t.o.lng) * 0.8;
        var km = Math.sqrt(dLat*dLat + dLng*dLng) * 111;
        var bike = !far && !multi && rnd() < 0.12;
        var fare = ((bike ? 22000 : 41000) + km * (bike ? 5200 : 9200)) * infl * (0.92 + rnd()*0.2);
        if (multi) fare *= 1.7;
        fare = Math.round(fare / 1000) * 1000;
        var roll = rnd();
        var status = roll < 0.06 ? 7 : roll < 0.13 ? 6 : 5;
        var opts = null;
        if (multi) opts = { extra_destination: place(weighted()) };
        else if (rnd() < 0.06) opts = { waiting: { key: "0m-5m", price: 1, text: "۰ تا ۵ دقیقه" } };
        n++;
        rides.push({
          human_readable_id: "DEMO-" + n,
          created_at: stamp(at),
          updated_at: stamp(new Date(at.getTime() + (9 + rnd()*22) * 60000)),
          latest_ride_status: status,
          final_price: Math.round(fare * 10),
          origin: place(t.o), destination: place(t.d),
          options: opts,
          service_type_name: far ? "بین شهری" : (bike ? "اسنپ بایک" : "اسنپ"),
          vehicle_model: bike ? "موتور" : pick(CARS),
          driver_name: pick(FIRST) + " " + pick(LAST),
          rate: status === 5 ? (rnd() < 0.9 ? 5 : Math.ceil(rnd()*4)) : undefined,
          rows: [{ title: "مبلغ پرداختی", description: Math.round(fare*10), type: "price" }]
        });
      });
    }
    return { rides: rides, lifetime: { rides: 486, km: 3720, hours: 148 } };
  }

  var cached = null;
  root.SnappDemo = { data: function () { return cached || (cached = build()); } };
})(window);
