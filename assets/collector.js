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

/* Phone version of the collector, written compactly on purpose: it lives inside a bookmark, and Chrome on
   Android stops running bookmarks whose URL gets long (the first, longer builds did nothing). Same logic as the
   console script above (token from page storage, same API, same paging and retry rules), plus:
   - a bar at the bottom of the page for progress and buttons
   - only the fields the report reads are kept (no driver photo, receipt or map links)
   - the rides go to the report site with postMessage, only when the visitor taps the button
     (a tap is needed: browsers block a window opened after a long wait).
   The site accepts the message only from https://app.snapp.taxi. */
window.SNAPP_MOBILE = function (siteUrl, opts) {
  opts = opts || {};
  var code = String.raw`(async () => {
const SITE = ${JSON.stringify(siteUrl)}, O = new URL(SITE).origin, d = document;
if (!${opts.skipHostCheck ? "true" : "false"} && location.hostname != 'app.snapp.taxi') { alert('اول app.snapp.taxi/ride-history را باز کن و وارد شو.'); return; }
const bar = d.createElement('div'), txt = d.createElement('div'), row = d.createElement('div');
bar.dir = 'rtl';
bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#0b4a57;color:#fff;font:15px/1.7 system-ui,sans-serif;padding:14px 16px;box-shadow:0 -6px 24px #0006';
row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
bar.append(txt, row); d.body.append(bar);
const say = m => { txt.textContent = m; };
const btn = (l, f, main) => { const b = d.createElement('button'); b.textContent = l; b.onclick = f;
  b.style.cssText = 'flex:1;min-height:46px;border:0;border-radius:12px;font:700 15px system-ui,sans-serif;color:#241600;background:' + (main ? '#f4a300' : '#fff'); row.append(b); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jwt = /^(Bearer\s+)?eyJ[\w-]+\.[\w-]+\.[\w-]+$/, found = [];
for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) {
  const v = (s.getItem(s.key(i)) || '').trim();
  if (jwt.test(v)) found.push(v);
  else if (v.includes('eyJ')) try { JSON.parse(v, (k, x) => (typeof x == 'string' && jwt.test(x.trim()) && found.push(x.trim()), x)); } catch (e) {}
}
const tk = found.sort((a, b) => b.length - a.length)[0], H = { Accept: 'application/json' };
if (tk) H.Authorization = /^Bearer/.test(tk) ? tk : 'Bearer ' + tk;
const pl = p => p && { lat: p.lat, lng: p.lng, formatted_address: p.formatted_address };
const K = 'human_readable_id created_at updated_at latest_ride_status final_price service_type_name vehicle_model driver_name rate'.split(' ');
const slim = r => { const o = {}; K.forEach(k => o[k] = r[k]); o.origin = pl(r.origin); o.destination = pl(r.destination);
  const x = r.options || {}; o.options = { extra_destination: pl(x.extra_destination), hurry_flag: x.hurry_flag, waiting: x.waiting ? { key: 'w' } : undefined };
  o.rows = (r.rows || []).filter(y => y && String(y.title || '').includes('تخفیف')).map(y => ({ title: y.title, description: y.description })); return o; };
const all = [], seen = new Set(); let life = null, partial = false;
for (let p = 1; p <= 60; p++) {
  let D = null;
  for (let t = 0; t < 3; t++) {
    try {
      const R = await fetch('/api/api-base/v3/passenger/ride/history?page=' + p + '&archive=0', { headers: H, credentials: 'include' });
      if (R.status == 401 || R.status == 403) { say('نشست منقضی است؛ دوباره وارد شو.'); return; }
      if (R.status == 429) { await sleep(8000); D = null; continue; }
      D = R.ok ? (await R.json()).data || {} : null;
    } catch (e) { D = null; }
    if (D && ((D.rides || []).length || !D.required_params)) break;
    await sleep(700);
  }
  if (!D) { partial = true; break; }
  if (!life && D.successful_snapp_rides != null) life = { rides: D.successful_snapp_rides, km: D.snapp_mileage, hours: D.snapp_duration };
  const rs = D.rides || [];
  for (const r of rs) if (r.human_readable_id && !seen.has(r.human_readable_id)) { seen.add(r.human_readable_id); all.push(r); }
  say('در حال گرفتن سفرها… ' + all.length);
  if (rs.length < 15) break;
  await sleep(700);
}
if (!all.length) { say('سفری پیدا نشد.'); btn('بستن', () => bar.remove()); return; }
all.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
const payload = { rides: all.map(slim), lifetime: life, partial };
say('✓ ' + all.length + ' سفر. «نمایش گزارش» آن‌ها را فقط به ' + O + ' می‌فرستد.' + (partial ? ' (ناقص)' : ''));
btn('نمایش گزارش', () => {
  const w = open(SITE + '#from-snapp');
  if (!w) { say('پنجره باز نشد؛ «ذخیرهٔ فایل» را بزن.'); return; }
  const on = e => { if (e.origin == O && e.data && e.data.type == 'safarnameh-ready') {
    w.postMessage({ type: 'safarnameh-rides', data: payload }, O); removeEventListener('message', on); say('فرستاده شد؛ به تب سفرنامه برو.'); } };
  addEventListener('message', on);
}, true);
btn('ذخیرهٔ فایل', () => {
  const u = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' })), a = d.createElement('a');
  a.href = u; a.download = 'snapp-rides-' + all.length + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 8000);
});
btn('بستن', () => bar.remove());
})().catch(e => alert('خطا در سفرنامه: ' + e.message));`;
  /* whitespace only costs bytes in a bookmark: squeeze it outside string literals */
  return code.split(/('(?:\\.|[^'\\\n])*')/).map(function (p, i) {
    return i % 2 ? p : p.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/[ \t]+/g, " ")
      .replace(/ ?([=+\-*<>!&|?:,;(){}\[\]]) ?/g, "$1").replace(/([;{},])\n/g, "$1");
  }).join("");
};
