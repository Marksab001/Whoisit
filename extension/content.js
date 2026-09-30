(() => {
  "use strict";
  if (globalThis.__WHOISIT_INSTAGRAM_BRIDGE__) return;
  globalThis.__WHOISIT_INSTAGRAM_BRIDGE__ = true;

  const CHANNEL = "WHOISIT_IG_PAGE_V2";
  const pending = new Map();
  let pageReady = false;

  function post(type, payload = {}) {
    window.postMessage({ channel: CHANNEL, source: "extension-bridge", type, ...payload }, location.origin);
  }

  function waitForPageWorker(timeoutMs = 4_000) {
    if (pageReady) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const ping = setInterval(() => post("PING"), 100);
      const check = setInterval(() => {
        if (pageReady) {
          clearInterval(ping);
          clearInterval(check);
          resolve();
        } else if (Date.now() - started >= timeoutMs) {
          clearInterval(ping);
          clearInterval(check);
          reject(new Error("Instagram page worker did not start. Refresh the Instagram tab after reloading the extension."));
        }
      }, 50);
      post("PING");
    });
  }

  async function pageRequest(type, payload = {}, timeoutMs = 30_000) {
    await waitForPageWorker();
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("Instagram page worker timed out."));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      post(type, { requestId, payload });
    });
  }

  window.addEventListener("message", event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.channel !== CHANNEL || data.source !== "page-worker") return;
    if (data.type === "READY") {
      pageReady = true;
      return;
    }
    if (data.type === "RESPONSE" && data.requestId) {
      const request = pending.get(data.requestId);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(data.requestId);
      if (data.response?.ok === false) request.reject(new Error(data.response.error || "Instagram page request failed."));
      else request.resolve(data.response || { ok: true });
      return;
    }
    if (data.type === "EVENT" && ["JOB_PROGRESS", "JOB_COMPLETE", "JOB_ERROR"].includes(data.eventType)) {
      chrome.runtime.sendMessage({
        type: data.eventType,
        source: "instagram-content",
        ...(data.payload || {})
      }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message?.type === "GET_SESSION_INFO") {
        const response = await pageRequest("SESSION_INFO", {}, 12_000);
        sendResponse(response);
      } else if (message?.type === "CHECK_FOLLOW_REQUIREMENT") {
        const response = await pageRequest("FOLLOW_REQUIREMENT", {}, 18_000);
        sendResponse(response);
      } else if (message?.type === "START_ANALYSIS") {
        const response = await pageRequest("START_ANALYSIS", { jobId: message.jobId, username: message.username }, 12_000);
        sendResponse(response);
      } else if (message?.type === "STOP_ANALYSIS") {
        const response = await pageRequest("STOP_ANALYSIS", { jobId: message.jobId }, 8_000);
        sendResponse(response);
      }
    })().catch(error => sendResponse({ ok: false, error: error.message || "Instagram bridge failed." }));
    return true;
  });

  post("PING");
})();
