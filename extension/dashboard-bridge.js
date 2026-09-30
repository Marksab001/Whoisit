(() => {
  "use strict";
  if (globalThis.__WHOISIT_DASHBOARD_BRIDGE__) return;
  globalThis.__WHOISIT_DASHBOARD_BRIDGE__ = true;

  const allowedTypes = new Set(["CHECK_CONNECTION", "CHECK_FOLLOW_REQUIREMENT", "START_ANALYSIS", "GET_JOB", "STOP_ANALYSIS"]);

  window.addEventListener("message", event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin) return;
    if (data?.channel !== "WHOISIT_DASHBOARD_REQUEST" || !data.requestId || !allowedTypes.has(data.message?.type)) return;

    chrome.runtime.sendMessage({ ...data.message, bridgeOrigin: location.origin }, response => {
      const safeResponse = chrome.runtime.lastError
        ? { ok: false, error: chrome.runtime.lastError.message }
        : response || { ok: false, error: "Extension did not return a response." };
      window.postMessage({
        channel: "WHOISIT_DASHBOARD_RESPONSE",
        requestId: data.requestId,
        response: safeResponse
      }, location.origin);
    });
  });
})();
