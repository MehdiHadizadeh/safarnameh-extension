/* Snapp ride-history analysis engine.
   Pure, dependency-free, browser + node. Input: raw ride objects from
   api-base/v3/passenger/ride/history. Output: a report model.
   Shared by the website and (later) the browser extension. */
(function (root) {
  "use strict";

  /* ── Jalali calendar ─────────────────────────────────────────── */
  var JM = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
            "مهر","آبان","آذر","دی","بهمن","اسفند"];
  var SEASON = { 1: "بهار", 2: "تابستان", 3: "پاییز", 4: "زمستان" };

  function g2j(gy, gm, gd) {
    var gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
    var gy2 = gy - 1600, gm2 = gm - 1, gd2 = gd - 1;
    var n = 365*gy2 + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100)
          + Math.floor((gy2+399)/400) + gdm[gm2] + gd2;
    if (gm2 > 1 && ((gy%4 === 0 && gy%100 !== 0) || gy%400 === 0)) n += 1;
    n -= 79;
    var np = Math.floor(n / 12053); n %= 12053;
    var jy = 979 + 33*np + 4*Math.floor(n/1461); n %= 1461;
    if (n >= 366) { jy += Math.floor((n-1)/365); n = (n-1) % 365; }
    var jm, jd;
    if (n < 186) { jm = 1 + Math.floor(n/31); jd = 1 + (n % 31); }
    else { jm = 7 + Math.floor((n-186)/30); jd = 1 + ((n-186) % 30); }
    return { jy: jy, jm: jm, jd: jd };
  }

  /* ── geo ─────────────────────────────────────────────────────── */
  function km(aLat, aLng, bLat, bLng) {
    var r = Math.PI / 180;
    var h = Math.pow(Math.sin((bLat-aLat)*r/2), 2)
          + Math.cos(aLat*r) * Math.cos(bLat*r) * Math.pow(Math.sin((bLng-aLng)*r/2), 2);
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  /* ── stats ───────────────────────────────────────────────────── */
  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
  }
  function mean(a) {
    if (!a.length) return 0;
    return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function countBy(list, fn) {
    var m = Object.create(null);   /* keys are untrusted strings: no prototype */
    list.forEach(function (x) { var k = fn(x); m[k] = (m[k] || 0) + 1; });
    return m;
  }
  function topPairs(obj, n) {
    return Object.keys(obj)
      .map(function (k) { return [k, obj[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, n === undefined ? Infinity : n);
  }

  /* ── input normalisation ─────────────────────────────────────── */
  /* Accepts: [ride], {rides}, {data:{rides}}, [{data:{rides}}], {summary,rides} */
  function extractRides(input) {
    var out = [], seen = Object.create(null);
    function push(r) {
      if (!r || typeof r !== "object") return;
      var id = r.human_readable_id;
      if (!id || !r.created_at || seen[id]) return;
      seen[id] = 1; out.push(r);
    }
    function walk(node, depth) {
      if (!node || depth > 6) return;
      if (Array.isArray(node)) { node.forEach(function (x) { walk(x, depth+1); }); return; }
      if (typeof node !== "object") return;
      if (node.human_readable_id && node.created_at) { push(node); return; }
      ["rides", "data", "items", "results", "list"].forEach(function (k) {
        if (node[k] !== undefined) walk(node[k], depth+1);
      });
    }
    walk(input, 0);
    return out;
  }

  /* ── ride → row ──────────────────────────────────────────────── */
  var STATUS = { 5: "انجام‌شده", 6: "لغو توسط مسافر", 7: "لغو توسط راننده",
             8: "لغو توسط پشتیبانی" };

  function toRow(r) {
    var o = r.origin || {}, d = r.destination || {}, opt = r.options || {};
    var ex = opt.extra_destination;
    /* Stop order is origin → destination → extra_destination.
       Confirmed against map_url, whose `destinations` list is in visit order. */
    var path = [];
    [o, d, ex].forEach(function (p) {
      if (p && typeof p.lat === "number") {
        path.push({ lat: p.lat, lng: p.lng, addr: p.formatted_address || "" });
      }
    });
    var dist = null;
    if (path.length > 1) {
      dist = 0;
      for (var i = 0; i < path.length - 1; i++) {
        dist += km(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
      }
    }
    var disc = 0;
    (r.rows || []).forEach(function (row) {
      if ((row.title || "").indexOf("تخفیف") >= 0) disc = Math.abs(row.description || 0);
    });
    var t0 = new Date(String(r.created_at).replace(" ", "T"));
    if (isNaN(t0)) return null;                 /* unparseable timestamp: skip the ride */
    var t1 = new Date(String(r.updated_at || r.created_at).replace(" ", "T"));
    if (isNaN(t1)) t1 = t0;
    var j = g2j(t0.getFullYear(), t0.getMonth() + 1, t0.getDate());
    return {
      id: r.human_readable_id,
      at: t0,
      status: r.latest_ride_status,
      ok: r.latest_ride_status === 5,
      statusText: STATUS[r.latest_ride_status] || String(r.latest_ride_status),
      price: (r.final_price || 0) / 10,          // Rial → Toman
      discount: disc / 10,
      km: dist,
      path: path,
      multi: !!ex,
      rate: r.rate || null,
      vehicle: (r.vehicle_model || "").trim(),
      driver: (r.driver_name || "").trim(),
      service: r.service_type_name || "",
      hurry: !!opt.hurry_flag,
      waited: !!opt.waiting,
      jy: j.jy, jm: j.jm,
      minutes: (t1 - t0) / 60000,
      hour: t0.getHours(),
      weekday: (t0.getDay() + 1) % 7           // 0 = Saturday
    };
  }

  /* ── spatial clustering ──────────────────────────────────────
     Snapp jitters coordinates for the same place (947 unique points for
     471 unique address strings in a real 835-ride export), so identity
     has to come from proximity, not from rounding or string equality.
     Leader clustering, seeded by visit frequency, avoids the chaining
     that single-linkage would cause along a boulevard. */
  function clusterStops(rows, radiusM) {
    var R = radiusM || 150;
    var freq = Object.create(null), coords = Object.create(null);
    rows.forEach(function (row) {
      row.path.forEach(function (p) {
        var k = p.lat + "," + p.lng;
        freq[k] = (freq[k] || 0) + 1;
        coords[k] = p;
      });
    });
    var order = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; });
    var leads = [], assign = Object.create(null);
    order.forEach(function (k) {
      var p = coords[k], best = -1, bestD = R;
      for (var i = 0; i < leads.length; i++) {
        var d = km(p.lat, p.lng, leads[i].lat, leads[i].lng) * 1000;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0) { leads.push({ lat: p.lat, lng: p.lng }); assign[k] = leads.length - 1; }
      else assign[k] = best;
    });
    var names = leads.map(function () { return Object.create(null); });
    rows.forEach(function (row) {
      row.path.forEach(function (p) {
        var c = assign[p.lat + "," + p.lng];
        names[c][p.addr] = (names[c][p.addr] || 0) + 1;
      });
    });
    var label = names.map(function (counter) {
      var best = "", n = -1;
      Object.keys(counter).forEach(function (a) { if (counter[a] > n) { n = counter[a]; best = a; } });
      return shortAddr(best);
    });
    return {
      leads: leads,
      label: label,
      variants: names.map(function (c) { return Object.keys(c).length; }),
      of: function (p) { return assign[p.lat + "," + p.lng]; },
      uniqueCoords: order.length,
      count: leads.length
    };
  }

  function shortAddr(t) {
    t = (t || "").replace(/^شهر /, "").trim();
    var parts = t.split("،").map(function (s) { return s.trim(); }).filter(Boolean);
    return parts.length > 2 ? parts[0] + "، " + parts[parts.length - 1] : t;
  }

  /* ── main ────────────────────────────────────────────────────── */
  function analyze(input, opts) {
    opts = opts || {};
    var raw = extractRides(input);
    if (!raw.length) throw new Error("هیچ سفری در این فایل پیدا نشد.");

    var rows = raw.map(toRow).filter(function (r) { return r && r.path.length > 0; });
    rows.sort(function (a, b) { return a.at - b.at; });
    var ok = rows.filter(function (r) { return r.ok; });
    if (!ok.length) throw new Error("سفر موفقی در این فایل نیست.");

    /* 200 m: Snapp's own jitter plus pick-up spots on opposite sides of one street are the same place */
    var C = clusterStops(rows, opts.radiusM || 200);
    var keyOf = function (r) { return r.path.map(C.of).join(">"); };

    /* corridors (direction-insensitive) and directed routes */
    var byCorr = Object.create(null), byRoute = Object.create(null);
    ok.forEach(function (r) {
      if (r.path.length !== r.path.filter(function (p) { return C.of(p) !== undefined; }).length) return;
      var ids = r.path.map(C.of);
      (byRoute[ids.join(">")] = byRoute[ids.join(">")] || []).push(r);
      if (ids.length === 2) {
        var k = ids.slice().sort(function (a, b) { return a - b; }).join("~");
        (byCorr[k] = byCorr[k] || []).push(r);
      }
    });
    /* Snapp now keeps ~12 months of history, so calendar years are too
       coarse: with under two years of data, compare by season instead. */
    var spanDays0 = (rows[rows.length-1].at - rows[0].at) / 86400000;
    var bySeason = spanDays0 < 730;
    function yearly(list) {
      var by = Object.create(null), lab = Object.create(null);
      list.forEach(function (r) {
        var q = Math.floor((r.jm - 1) / 3) + 1;
        var k = bySeason ? r.jy * 10 + q : r.jy;
        lab[k] = bySeason ? SEASON[q] + " " + r.jy : String(r.jy);
        (by[k] = by[k] || []).push(r.price);
      });
      return Object.keys(by).sort().map(function (y) {
        return { y: +y, label: lab[y], med: Math.round(median(by[y])), n: by[y].length };
      });
    }
    function pack(map, sep, limit) {
      return Object.keys(map)
        .sort(function (a, b) { return map[b].length - map[a].length; })
        .slice(0, limit)
        .map(function (k) {
          var list = map[k];
          return {
            n: list.length,
            stops: k.split(sep).map(function (i) { return C.label[+i]; }),
            km: +median(list.map(function (r) { return r.km || 0; })).toFixed(1),
            years: yearly(list),
            /* periods with a single ride say nothing about a fare: keep only n >= 2 for comparisons */
            solid: yearly(list).filter(function (y) { return y.n >= 2; }),
            multi: k.split(sep).length > 2
          };
        });
    }
    var corridors = pack(byCorr, "~", 5);
    var routes = pack(byRoute, ">", 6);

    /* headline: busiest corridor, compared on yearly medians */
    /* Only a route ridden at least 4 times, with 2+ periods of 2+ rides each, can carry a
       fare story. Otherwise there is no headline route (the report hides that block). */
    var th = corridors.concat(routes).filter(function (c) { return c.n >= 4 && c.solid.length >= 2; })
      .sort(function (a, b) { return b.n - a.n; })[0];
    var thesis = th ? {
      stops: th.stops, km: th.km, n: th.n, years: th.solid,
      mult: th.solid[0].med > 0 ? +(th.solid[th.solid.length-1].med / th.solid[0].med).toFixed(1) : 0
    } : null;

    /* price per km, quarterly medians, city rides only */
    var byQ = Object.create(null);
    ok.forEach(function (r) {
      if (!r.km || r.km < 1 || r.km > 30) return;
      var q = r.jy + "-" + (Math.floor((r.jm - 1) / 3) + 1);
      (byQ[q] = byQ[q] || []).push(r.price / r.km);
    });
    var infl = Object.keys(byQ).sort().map(function (k) {
      var p = k.split("-");
      return { y: +p[0], q: +p[1], v: Math.round(median(byQ[k])), n: byQ[k].length };
    });

    /* monthly spend */
    var byM = Object.create(null);
    ok.forEach(function (r) {
      var k = r.jy + "-" + (r.jm < 10 ? "0" : "") + r.jm;
      byM[k] = byM[k] || { total: 0, n: 0 };
      byM[k].total += r.price; byM[k].n++;
    });
    var spend = Object.keys(byM).sort().map(function (k) {
      return { m: k, total: Math.round(byM[k].total), n: byM[k].n };
    });

    /* hour × weekday */
    var mat = [];
    for (var w = 0; w < 7; w++) mat.push(new Array(24).fill(0));
    ok.forEach(function (r) { mat[r.weekday][r.hour]++; });

    /* places */
    var visits = Object.create(null);
    ok.forEach(function (r) { r.path.forEach(function (p) {
      var c = C.of(p); visits[c] = (visits[c] || 0) + 1;
    }); });
    var places = topPairs(visits, 9).map(function (kv) {
      var c = +kv[0];
      return { n: kv[1], name: C.label[c], variants: C.variants[c],
               lat: C.leads[c].lat, lng: C.leads[c].lng };
    });

    /* multi-destination */
    var md = ok.filter(function (r) { return r.path.length === 3; });
    var pairMap = Object.create(null);
    md.forEach(function (r) {
      var k = C.of(r.path[1]) + ">" + C.of(r.path[2]);
      (pairMap[k] = pairMap[k] || []).push(r);
    });
    var multiPairs = Object.keys(pairMap)
      .sort(function (a, b) { return pairMap[b].length - pairMap[a].length; })
      .slice(0, 4).map(function (k) {
        var p = k.split(">"), list = pairMap[k], origins = Object.create(null);
        list.forEach(function (r) { origins[C.of(r.path[0])] = 1; });
        return { n: list.length, a: C.label[+p[0]], b: C.label[+p[1]],
                 origins: Object.keys(origins).length };
      });
    var mKm = md.map(function (r) { return r.km; }).filter(Boolean);
    var sKm = ok.filter(function (r) { return !r.multi && r.km; }).map(function (r) { return r.km; });
    var sPrice = ok.filter(function (r) { return !r.multi; }).map(function (r) { return r.price; });

    /* map paths, framed per city */
    function paths(latMin, latMax, lngMin, lngMax) {
      return ok.filter(function (r) {
        return r.path.length > 1 && r.path.every(function (p) {
          return p.lat > latMin && p.lat < latMax && p.lng > lngMin && p.lng < lngMax;
        });
      }).map(function (r) {
        return r.path.map(function (p) { return [+p.lat.toFixed(5), +p.lng.toFixed(5)]; });
      });
    }
    /* Group stops into metro areas rather than assuming any one city. */
    var areas = buildAreas(ok, paths);

    /* days, streaks */
    /* Day keys from local components: toISOString() would shift the day
       for late-night rides depending on the viewer's own timezone. */
    function dayKey(d) {
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2, "0")
             + "-" + String(d.getDate()).padStart(2, "0");
    }
    var dayKeys = Object.create(null);
    rows.forEach(function (r) { dayKeys[dayKey(r.at)] = 1; });
    var days = Object.keys(dayKeys).sort();
    var streak = 1, cur = 1;
    for (var i = 1; i < days.length; i++) {
      var gap = (new Date(days[i]) - new Date(days[i-1])) / 86400000;
      cur = gap === 1 ? cur + 1 : 1;
      if (cur > streak) streak = cur;
    }
    var span = days.length > 1
      ? Math.round((new Date(days[days.length-1]) - new Date(days[0])) / 86400000) : 1;

    /* cancellations by hour */
    var reqByHour = countBy(rows, function (r) { return r.hour; });
    var cxByHour = countBy(rows.filter(function (r) { return r.status === 7; }),
                           function (r) { return r.hour; });
    var cancelH = [];
    for (var h = 0; h < 24; h++) {
      if ((reqByHour[h] || 0) >= 15) {
        cancelH.push({ h: h, pct: Math.round((cxByHour[h] || 0) / reqByHour[h] * 100),
                       n: reqByHour[h] });
      }
    }

    var elapsed = ok.map(function (r) { return r.minutes; })
                    .filter(function (m) { return m > 0 && m < 180; });
    var okKm = ok.map(function (r) { return r.km; }).filter(Boolean);
    var addrCount = Object.create(null);
    rows.forEach(function (r) { r.path.forEach(function (p) { addrCount[p.addr] = 1; }); });

    return {
      meta: {
        records: rows.length, ok: ok.length,
        cancelMe: rows.filter(function (r) { return r.status === 6; }).length,
        cancelDriver: rows.filter(function (r) { return r.status === 7; }).length,
        first: days[0], last: days[days.length-1],
        firstJ: fmtJ(rows[0]), lastJ: fmtJ(rows[rows.length-1]),
        activeDays: days.length, spanDays: span, streak: streak,
        clusters: C.count, coords: C.uniqueCoords, addresses: Object.keys(addrCount).length
      },
      money: {
        total: Math.round(sum(ok.map(function (r) { return r.price; }))),
        discount: Math.round(sum(rows.map(function (r) { return r.discount; }))),
        avg: Math.round(mean(ok.map(function (r) { return r.price; }))),
        median: Math.round(median(ok.map(function (r) { return r.price; }))),
        max: Math.round(Math.max.apply(null, ok.map(function (r) { return r.price; })))
      },
      dist: { straight: Math.round(sum(okKm)), avg: +mean(okKm).toFixed(2), factor: 1.4 },
      time: { hours: Math.round(sum(elapsed) / 60), avgMin: +mean(elapsed).toFixed(1) },
      multi: {
        n: rows.filter(function (r) { return r.multi; }).length, ok: md.length,
        km: +mean(mKm).toFixed(1), kmSingle: +mean(sKm).toFixed(1),
        price: Math.round(mean(md.map(function (r) { return r.price; }))),
        priceSingle: Math.round(mean(sPrice))
      },
      opts: {
        hurry: rows.filter(function (r) { return r.hurry; }).length,
        wait: rows.filter(function (r) { return r.waited; }).length
      },
      thesis: thesis, corridors: corridors, routes: routes,
      multiPairs: multiPairs, places: places, areas: areas,
      infl: infl, spend: spend, mat: mat,
      weekday: mat.map(sum),
      hour: (function () {
        var a = new Array(24).fill(0);
        for (var w = 0; w < 7; w++) for (var h = 0; h < 24; h++) a[h] += mat[w][h];
        return a;
      })(),
      vehicles: topPairs(countBy(ok, function (r) { return r.vehicle || "نامشخص"; }), 10),
      services: topPairs(countBy(ok, function (r) { return r.service || "نامشخص"; })),
      ratings: countBy(ok.filter(function (r) { return r.rate; }), function (r) { return r.rate; }),
      drivers: {
        unique: Object.keys(countBy(ok, function (r) { return r.driver; })).length,
        repeat: (function () {
          var c = countBy(ok, function (r) { return r.driver; });
          return Object.keys(c).filter(function (k) { return c[k] > 1; }).length;
        })()
      },
      cancelH: cancelH,
      lifetime: lifetimeOf(input),
      story: storyOf(ok, rows, spend, mat)
    };
  }

  /* Lifetime totals Snapp sends alongside every history page. */
  function lifetimeOf(input) {
    var l = input && !Array.isArray(input) && input.lifetime;
    if (!l || !(l.rides > 0)) return null;
    return { rides: l.rides, km: l.km || 0, hours: l.hours || 0 };
  }

  /* Headline facts for the story cards at the top of the report. */
  function storyOf(ok, rows, spend, mat) {
    var best = spend.slice().sort(function (a, b) { return b.total - a.total; })[0];
    var bp = best ? best.m.split("-") : null;
    var wd = mat.map(sum), hr = new Array(24).fill(0);
    mat.forEach(function (row) { row.forEach(function (v, h) { hr[h] += v; }); });
    var argmax = function (a) { return a.indexOf(Math.max.apply(null, a)); };
    var far = ok.filter(function (r) { return r.km; })
                .sort(function (a, b) { return b.km - a.km; })[0];
    var dear = ok.slice().sort(function (a, b) { return b.price - a.price; })[0];
    var months = Math.max(1, Math.round((rows[rows.length-1].at - rows[0].at) / 2592000000));
    return {
      months: months,
      perMonth: +(ok.length / months).toFixed(1),
      spendPerMonth: Math.round(sum(ok.map(function (r) { return r.price; })) / months),
      peakMonth: best ? { name: JM[+bp[1] - 1] + " " + bp[0], total: best.total, n: best.n } : null,
      busiestDay: argmax(wd),
      busiestHour: argmax(hr),
      farthest: far ? Math.round(far.km * 1.4) : 0,
      priciest: dear ? Math.round(dear.price) : 0,
      cancelPct: Math.round(100 * (rows.length - ok.length) / rows.length)
    };
  }

  function fmtJ(row) {
    if (!row) return "";
    return JM[row.jm - 1] + " " + row.jy;
  }

  /* Metro areas: bucket stops on a coarse grid, keep the two densest
     blobs, name each from its most-visited stop. Works for any city. */
  function buildAreas(ok, pathsFn) {
    var cell = Object.create(null);
    ok.forEach(function (r) { r.path.forEach(function (p) {
      var k = Math.round(p.lat * 4) + "," + Math.round(p.lng * 4); // ~25 km cells
      cell[k] = cell[k] || { n: 0, lat: 0, lng: 0, addr: Object.create(null) };
      cell[k].n++; cell[k].lat += p.lat; cell[k].lng += p.lng;
      var city = (p.addr || "").replace(/^شهر /, "").split("،")[0].trim();
      if (city) cell[k].addr[city] = (cell[k].addr[city] || 0) + 1;
    }); });
    /* take the densest cells, but skip ones that sit within ~30 km of a
       cell already chosen: neighbouring cells are the same metro area */
    var picked = [];
    topPairs(cell, 12).forEach(function (kv) {
      if (picked.length >= 2) return;
      var c = cell[kv[0]], lat = c.lat / c.n, lng = c.lng / c.n;
      var near = picked.some(function (q) { return Math.abs(q.lat - lat) < 0.3 && Math.abs(q.lng - lng) < 0.3; });
      if (!near) picked.push({ c: c, lat: lat, lng: lng });
    });
    return picked.map(function (pk) {
      var c = pk.c, name = "", best = -1;
      Object.keys(c.addr).forEach(function (a) { if (c.addr[a] > best) { best = c.addr[a]; name = a; } });
      var pad = 0.28;
      return {
        name: name || "منطقه",
        paths: pathsFn(pk.lat - pad, pk.lat + pad, pk.lng - pad, pk.lng + pad)
      };
    }).filter(function (a) { return a.paths.length > 2; });
  }

  /* Snapp sells many service names (اسنپ, اسنپ بایک, بایک پلاس, بین شهری...). For the reader there
     are two kinds of ride: on a motorbike, or in a car. Intercity and the rest are car rides. */
  var BIKE = "بایک", CAR = "خودرو";
  function serviceGroup(name) {
    return /بایک|موتور|bike/i.test(String(name || "")) ? BIKE : CAR;
  }

  /* Per-group comparison over whatever rides it is given. Fare figures use city rides only
     (under 30 km straight line), so a few intercity trips cannot drag the car median up. */
  function serviceStats(input) {
    var ok = extractRides(input).map(toRow).filter(function (r) { return r && r.ok; });
    var by = Object.create(null);
    ok.forEach(function (r) { var k = serviceGroup(r.service); (by[k] = by[k] || []).push(r); });
    return Object.keys(by).map(function (k) {
      var list = by[k];
      var city = list.filter(function (r) { return !r.km || r.km <= 30; });
      var kms = city.filter(function (r) { return r.km; }).map(function (r) { return r.km; });
      var per = city.filter(function (r) { return r.km >= 1 && r.price > 0; })
                    .map(function (r) { return r.price / r.km; });
      var parts = Object.create(null);
      list.forEach(function (r) { var n = r.service || "نامشخص"; parts[n] = (parts[n] || 0) + 1; });
      return {
        name: k, n: list.length, share: Math.round(100 * list.length / ok.length),
        total: Math.round(sum(list.map(function (r) { return r.price; }))),
        median: city.length ? Math.round(median(city.map(function (r) { return r.price; }))) : null,
        perKm: per.length >= 3 ? Math.round(median(per)) : null,
        avgKm: kms.length ? +mean(kms).toFixed(1) : null,
        far: list.length - city.length,
        parts: topPairs(parts)
      };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  root.SnappAnalyze = {
    analyze: analyze, serviceStats: serviceStats, serviceGroup: serviceGroup, extractRides: extractRides, g2j: g2j,
    JM: JM, SEASON: SEASON, km: km, median: median
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).SnappAnalyze;
}
