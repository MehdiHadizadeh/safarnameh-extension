/* Popup: asks the Snapp tab to read the user's own ride history, then opens the report.
   Collection runs inside the Snapp page (same requests the app itself makes).
   Stops when a page has fewer than 15 rides or the API's required_params is empty. */
const $ = (id) => document.getElementById(id);
const fa = (n) => Number(n).toLocaleString("fa");
const go = $("go"), statusEl = $("status"), statusText = $("status-text"), work = $("work"),
      countEl = $("count"), fill = $("fill"), msg = $("msg");

function setStatus(state, text) { statusEl.dataset.state = state; statusText.textContent = text; }
function note(text, err) { msg.hidden = !text; msg.textContent = text || ""; msg.classList.toggle("err", !!err); }
const onSnapp = (tab) => tab && /^https:\/\/app\.snapp\.taxi\//.test(tab.url || "");

/* Injected into the Snapp tab. Must be self-contained. */
async function collectHistory() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const API = "/api/api-base/v3/passenger/ride/history";
  const PAGE = 15, MAX_PAGE = 60, TRIES = 3, GAP = 700;

  const jwt = /^(Bearer\s+)?eyJ[\w-]+\.[\w-]+\.[\w-]+$/, found = [];
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const v = store.getItem(store.key(i)); if (!v) continue;
      if (jwt.test(v.trim())) found.push(v.trim());
      else if (v.includes("eyJ")) {
        try { JSON.parse(v, (k, x) => { if (typeof x === "string" && jwt.test(x.trim())) found.push(x.trim()); return x; }); } catch (e) {}
      }
    }
  }
  const tk = found.sort((a, b) => b.length - a.length)[0];
  if (!tk) return { error: "login" };
  const H = { Accept: "application/json", Authorization: tk.startsWith("Bearer") ? tk : "Bearer " + tk };

  const hit = async (page) => {
    try {
      const res = await fetch(API + "?page=" + page + "&archive=0", { headers: H, credentials: "include" });
      if (res.status === 401 || res.status === 403) return { auth: true };
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
      if (d && d.auth) return { error: "login" };
      if (d && (d.rides || []).length) break;
      if (d && !d.required_params) break;
      await sleep(GAP);
    }
    if (!d) { partial = true; break; }
    if (!life && d.successful_snapp_rides != null)
      life = { rides: d.successful_snapp_rides, km: d.snapp_mileage, hours: d.snapp_duration };
    const rides = d.rides || [];
    for (const r of rides) {
      if (r.human_readable_id && !seen.has(r.human_readable_id)) { seen.add(r.human_readable_id); all.push(r); }
    }
    try { chrome.runtime.sendMessage({ type: "progress", page, count: all.length }); } catch (e) {}
    if (rides.length < PAGE) break;
    if (page === MAX_PAGE) partial = true;
    await sleep(GAP);
  }
  all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { rides: all, lifetime: life, partial };
}

chrome.runtime.onMessage.addListener((m) => {
  if (m && m.type === "progress") {
    countEl.textContent = fa(m.count);
    fill.style.width = Math.min(96, 8 + m.page * 6) + "%";
    setStatus("work", "در حال گرفتن تاریخچه…");
  }
});

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (onSnapp(tab)) { setStatus("ready", "در صفحهٔ اسنپ هستی؛ آماده است"); go.textContent = "ساخت گزارش"; }
  else { setStatus("open", "اول باید صفحهٔ اسنپ باز باشد"); go.textContent = "باز کردن تاریخچهٔ اسنپ"; }
}

go.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!onSnapp(tab)) {
    await chrome.tabs.create({ url: "https://app.snapp.taxi/ride-history" });
    window.close();
    return;
  }
  go.disabled = true; note(""); work.hidden = false; countEl.textContent = fa(0); fill.style.width = "6%";
  setStatus("work", "در حال شروع…");
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectHistory });
    const out = res && res.result;
    if (!out || out.error === "login") {
      go.disabled = false; work.hidden = true; setStatus("error", "وارد حساب اسنپ نیستی");
      return note("اول در همان صفحه وارد شو، بعد دوباره امتحان کن.", true);
    }
    if (!out.rides.length) {
      go.disabled = false; work.hidden = true; setStatus("error", "سفری پیدا نشد");
      return note("مطمئن شو تاریخچه‌ات در خود اسنپ پر است.", true);
    }
    fill.style.width = "100%";
    setStatus("ready", out.partial ? "ناقص گرفته شد؛ گزارش باز می‌شود" : "تمام شد؛ گزارش باز می‌شود");
    await chrome.runtime.sendMessage({ type: "open-report", data: out });
    window.close();
  } catch (e) {
    go.disabled = false; work.hidden = true; setStatus("error", "گرفتن تاریخچه نشد");
    note("صفحهٔ اسنپ را تازه کن و دوباره امتحان کن.", true);
  }
});

init();
