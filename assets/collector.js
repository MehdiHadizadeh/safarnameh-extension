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
