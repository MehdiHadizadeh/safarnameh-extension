/* Hands the collected rides to the report tab, then forgets them.
   MV3 service workers are evicted when idle, so a global would lose the data.
   chrome.storage.session is memory-only (never written to disk), cleared on browser
   close, and removed as soon as the report tab reads it. */
const KEY = "pending-report";
const mine = (sender) => sender && sender.id === chrome.runtime.id;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!mine(sender) || !msg) return false;
  if (msg.type === "open-report") {
    chrome.storage.session.set({ [KEY]: msg.data })
      .then(() => chrome.tabs.create({ url: chrome.runtime.getURL("report.html") }))
      .then(() => reply({ ok: true }), () => reply({ ok: false }));
    return true;
  }
  if (msg.type === "report-ready") {
    chrome.storage.session.get(KEY)
      .then((o) => chrome.storage.session.remove(KEY).then(() => reply({ data: o[KEY] || null })))
      .catch(() => reply({ data: null }));
    return true;
  }
  return false;
});
