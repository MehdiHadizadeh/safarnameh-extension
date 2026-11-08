/* The script the visitor pastes into their own browser console on app.snapp.taxi.
   Kept as a string so the page can display and copy it verbatim.
   Retested 2026-11-07: history is capped at ~12 months server-side, the old
   "empty page on a full page" glitch no longer reproduces, and the API signals
   the real end with an empty `required_params` / a page shorter than 15. */
window.SNAPP_COLLECTOR = String.raw`/* گزارش سفرهای اسنپ: جمع‌آوری تاریخچه
   این کد فقط با سرور اسنپ حرف می‌زند و خروجی را روی همین کامپیوتر ذخیره می‌کند. */
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const API = '/api/api-base/v3/passenger/ride/history';
  const PAGE = 15, MAX_PAGE = 60, TRIES = 3, GAP = 700;

  // توکن را از حافظهٔ همین صفحه برمی‌دارد؛ جایی فرستاده نمی‌شود.
  const jwt = /^(Bearer\s+)?eyJ[\w-]+\.[\w-]+\.[\w-]+$/, found = [];
  for (const store of [localStorage, sessionStorage])
    for (let i = 0; i < store.length; i++) {
      const v = store.getItem(store.key(i)); if (!v) continue;
      if (jwt.test(v.trim())) found.push(v.trim());
      else if (v.includes('eyJ')) { try { JSON.parse(v, (k, x) => {
        if (typeof x === 'string' && jwt.test(x.trim())) found.push(x.trim()); return x; }); } catch (e) {} }
    }
  const tk = found.sort((a, b) => b.length - a.length)[0];
  const H = { Accept: 'application/json' };
  if (tk) H.Authorization = tk.startsWith('Bearer') ? tk : 'Bearer ' + tk;
  console.log(tk ? '✓ نشست پیدا شد' : '⚠ توکن پیدا نشد؛ با کوکی امتحان می‌کنم');

  const hit = async page => {
    try {
      const res = await fetch(API + '?page=' + page + '&archive=0',
        { headers: H, credentials: 'include' });
      if (res.status === 401 || res.status === 403) { console.log('⚠ نشست منقضی است؛ دوباره وارد شو'); return { auth: true }; }
      if (res.status === 429) { await sleep(8000); return null; }
      if (!res.ok) return null;
      return (await res.json()).data || {};
    } catch (e) { return null; }
  };

  const all = [], seen = new Set();
  let life = null, partial = false;
  for (let page = 1; page <= MAX_PAGE; page++) {
    let d = null;
    for (let t = 1; t <= TRIES; t++) {
      d = await hit(page);
      if (d && d.auth) return;
      if (d && (d.rides || []).length) break;
      // خالی + required_params خالی یعنی پایان واقعی تاریخچه
      if (d && !d.required_params) break;
      await sleep(GAP);
    }
    if (!d) { console.log('⚠ صفحهٔ ' + page + ': پاسخ نیامد؛ خروجی ناقص است'); partial = true; break; }
    if (!life && d.successful_snapp_rides != null)
      life = { rides: d.successful_snapp_rides, km: d.snapp_mileage, hours: d.snapp_duration };
    const rides = d.rides || [];
    for (const r of rides) {
      if (r.human_readable_id && !seen.has(r.human_readable_id)) {
        seen.add(r.human_readable_id); all.push(r);
      }
    }
    console.log('صفحهٔ ' + page + ': ' + rides.length + ' سفر | مجموع ' + all.length);
    if (rides.length < PAGE) break;
    await sleep(GAP);
  }

  all.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  console.log('%c✓ ' + all.length + ' سفر جمع شد', 'font-size:16px;color:#0a0');

  const blob = new Blob([JSON.stringify({ rides: all, lifetime: life, partial })], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'snapp-rides-' + all.length + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  console.log('فایل ذخیره شد. حالا آن را در سایت رها کن.');
})();`;

/* Phone version of the same collector, built from the console script so there is one source of truth.
   It runs as a bookmarklet on app.snapp.taxi. Differences: it shows progress in a bar at the bottom of
   the page, and hands the rides to the report site with postMessage when the visitor taps the button
   (a tap is needed: browsers block a window opened after a long async wait). The site only accepts
   the message from https://app.snapp.taxi. */
window.SNAPP_MOBILE = function (siteUrl, opts) {
  opts = opts || {};
  var core = window.SNAPP_COLLECTOR
    .replace(/^\/\*[\s\S]*?\*\/\s*/, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/console\.log\(/g, "say(");
  var head = "(async () => {";
  var cut = core.indexOf("  const blob");
  var tail = "\n} catch (e) { alert('خطا در سفرنامه: ' + (e && e.message)); } })();";
  var prelude = String.raw`
  const SITE = ${JSON.stringify(siteUrl)}, ORIGIN = new URL(SITE).origin;
  if (!${opts.skipHostCheck ? "true" : "false"} && location.hostname !== 'app.snapp.taxi') {
    alert('اول app.snapp.taxi/ride-history را باز کن و وارد شو، بعد دوباره امتحان کن.'); return; }
  const bar = document.createElement('div'); bar.setAttribute('dir', 'rtl');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#0b4a57;color:#fff;font:15px/1.7 system-ui,sans-serif;padding:14px 16px;box-shadow:0 -6px 24px rgba(0,0,0,.4)';
  const txt = document.createElement('div'), row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;margin-top:10px;flex-wrap:wrap';
  bar.appendChild(txt); bar.appendChild(row); document.body.appendChild(bar);
  const say = m => { txt.textContent = String(m).replace('%c', ''); };
  const btn = (label, fn, main) => { const b = document.createElement('button'); b.textContent = label;
    b.style.cssText = 'flex:1;min-height:46px;border:0;border-radius:12px;font:700 15px system-ui,sans-serif;background:' + (main ? '#f4a300' : '#fff') + ';color:#241600';
    b.onclick = fn; row.appendChild(b); };
  say('در حال گرفتن سفرها… داده فقط به ' + ORIGIN + ' می‌رود.');
  /* send only the fields the report reads: no photos, receipt links or map links */
  const pl = p => p && { lat: p.lat, lng: p.lng, formatted_address: p.formatted_address };
  const slim = r => ({ human_readable_id: r.human_readable_id, created_at: r.created_at, updated_at: r.updated_at,
    latest_ride_status: r.latest_ride_status, final_price: r.final_price, service_type_name: r.service_type_name,
    vehicle_model: r.vehicle_model, driver_name: r.driver_name, rate: r.rate,
    origin: pl(r.origin), destination: pl(r.destination),
    options: r.options ? { extra_destination: pl(r.options.extra_destination), hurry_flag: r.options.hurry_flag, waiting: r.options.waiting ? { key: 'w' } : undefined } : null,
    rows: (r.rows || []).filter(x => x && String(x.title || '').includes('تخفیف')).map(x => ({ title: x.title, description: x.description })) });
`;
  var finish = String.raw`
  if (!all.length) { say('سفری پیدا نشد. وارد شده‌ای؟'); btn('بستن', () => bar.remove()); return; }
  const payload = { rides: all.map(slim), lifetime: life, partial };
  say('✓ ' + all.length + ' سفر جمع شد. دکمهٔ نمایش گزارش آن‌ها را فقط به ' + ORIGIN + ' می‌فرستد.');
  btn('نمایش گزارش', () => {
    const w = window.open(SITE + '#from-snapp', '_blank');
    if (!w) { say('مرورگر پنجره را باز نکرد. «ذخیرهٔ فایل» را بزن و فایل را در سایت رها کن.'); return; }
    const on = e => {
      if (e.origin === ORIGIN && e.data && e.data.type === 'safarnameh-ready') {
        w.postMessage({ type: 'safarnameh-rides', data: payload }, ORIGIN);
        removeEventListener('message', on); say('فرستاده شد. به تب سفرنامه برو.');
      }
    };
    addEventListener('message', on);
  }, true);
  btn('ذخیرهٔ فایل', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = 'snapp-rides-' + all.length + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 8000);
  });
  btn('بستن', () => bar.remove());
`;
  var body = head + " try {" + prelude + core.slice(core.indexOf(head) + head.length, cut) + finish + tail;
  /* leading indentation only costs bytes in a bookmark */
  return body.replace(/\n[ \t]+/g, "\n");
};
