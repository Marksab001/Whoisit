const ALLOWED_DASHBOARD_ORIGINS = new Set([
  "https://cybroatrix.com",
  "https://www.cybroatrix.com",
  "http://localhost",
  "http://127.0.0.1"
]);
const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;
const JOB_PREFIX = "job:";
const JOB_TTL_MS = 60 * 60 * 1000;

function normalizeUsername(value) {
  const username = String(value || "").trim().replace(/^@/, "").toLowerCase();
  return USERNAME_PATTERN.test(username) && !username.startsWith(".") && !username.endsWith(".") && !username.includes("..") ? username : "";
}

function senderOrigin(sender) {
  try { return new URL(sender.url || sender.tab?.url || "").origin; }
  catch { return ""; }
}

function isAllowedDashboardOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return true;
    return ALLOWED_DASHBOARD_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function isAllowedDashboardSender(sender) {
  if (sender.id !== chrome.runtime.id) return false;
  const url = sender.url || sender.tab?.url || "";
  if (url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return true;
  return isAllowedDashboardOrigin(senderOrigin(sender));
}

function isInstagramSender(sender) {
  try { return sender.id === chrome.runtime.id && new URL(sender.tab?.url || sender.url).hostname === "www.instagram.com"; }
  catch { return false; }
}

async function getInstagramTab() {
  const tabs = await chrome.tabs.query({ url: ["https://www.instagram.com/*"] });
  return tabs.find(tab => tab.id != null && !String(tab.url || "").includes("/accounts/login")) || tabs.find(tab => tab.id != null);
}

async function sendToInstagram(message) {
  const tab = await getInstagramTab();
  if (!tab?.id) throw new Error("Open Instagram in a tab and sign in first.");
  try { return await chrome.tabs.sendMessage(tab.id, message); }
  catch { throw new Error("Could not contact the Instagram tab. Refresh instagram.com and try again."); }
}

async function setJob(job) {
  const next = { ...job, updatedAt: Date.now() };
  await chrome.storage.session.set({ [`${JOB_PREFIX}${job.id}`]: next });
  return next;
}

async function getJob(jobId) {
  const key = `${JOB_PREFIX}${jobId}`;
  const stored = await chrome.storage.session.get(key);
  return stored[key] || null;
}

async function patchJob(jobId, changes) {
  const current = await getJob(jobId);
  if (!current) return null;
  return setJob({ ...current, ...changes, id: jobId });
}

async function cleanupJobs() {
  const all = await chrome.storage.session.get(null);
  const oldKeys = Object.entries(all)
    .filter(([key, value]) => key.startsWith(JOB_PREFIX) && Date.now() - Number(value?.updatedAt || 0) > JOB_TTL_MS)
    .map(([key]) => key);
  if (oldKeys.length) await chrome.storage.session.remove(oldKeys);
}

async function checkConnection() {
  try {
    const response = await sendToInstagram({ type: "GET_SESSION_INFO" });
    return response?.connected ? response : { connected: false };
  } catch {
    return { connected: false };
  }
}

async function checkFollowRequirement() {
  const response = await sendToInstagram({ type: "CHECK_FOLLOW_REQUIREMENT" });
  if (!response?.ok) throw new Error(response?.error || "Could not verify the follow requirement.");
  return response;
}

async function startAnalysis(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new Error("Enter a valid Instagram username.");

  const jobId = crypto.randomUUID();
  const job = await setJob({
    id: jobId,
    username: normalized,
    status: "running",
    createdAt: Date.now(),
    progress: { percent: 3, phase: "connect", message: "Starting Instagram analysis…", processed: 0 }
  });

  try {
    const response = await sendToInstagram({ type: "START_ANALYSIS", jobId, username: normalized });
    if (!response?.ok) throw new Error(response?.error || "Instagram rejected the analysis request.");
  } catch (error) {
    await patchJob(jobId, { status: "error", error: error.message });
    throw error;
  }
  return job;
}

async function stopAnalysis(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error("Analysis job was not found.");
  if (job.status !== "running") return job;
  try { await sendToInstagram({ type: "STOP_ANALYSIS", jobId }); }
  finally {
    return patchJob(jobId, {
      status: "stopped",
      error: "Analysis stopped by the user.",
      progress: { ...job.progress, message: "Analysis stopped" }
    });
  }
}

async function handleInstagramUpdate(message, sender) {
  if (!isInstagramSender(sender) || !message.jobId) return { ok: false, error: "Untrusted Instagram update." };
  const current = await getJob(message.jobId);
  if (!current || current.status !== "running") return { ok: false, error: "Job is no longer active." };

  if (message.type === "JOB_PROGRESS") {
    await patchJob(message.jobId, { progress: message.progress });
  } else if (message.type === "JOB_COMPLETE") {
    try {
      await patchJob(message.jobId, {
        status: "complete",
        result: message.result,
        progress: { ...message.progress, percent: 100, phase: "compare" }
      });
    } catch {
      await patchJob(message.jobId, {
        status: "error",
        error: "The result is too large for temporary extension storage. Use official Data export mode for this account."
      });
    }
  } else if (message.type === "JOB_ERROR") {
    await patchJob(message.jobId, { status: "error", error: message.error || "Instagram analysis failed." });
  }
  return { ok: true };
}

chrome.runtime.onInstalled.addListener(() => { cleanupJobs(); });
chrome.runtime.onStartup.addListener(() => { cleanupJobs(); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (["JOB_PROGRESS", "JOB_COMPLETE", "JOB_ERROR"].includes(message?.type)) {
      sendResponse(await handleInstagramUpdate(message, sender));
      return;
    }
    if (!isAllowedDashboardSender(sender)) {
      sendResponse({ ok: false, error: "This page is not allowed to access whoisit." });
      return;
    }
    if (message?.bridgeOrigin && !isAllowedDashboardOrigin(message.bridgeOrigin)) {
      sendResponse({ ok: false, error: "Dashboard origin is not allowed." });
      return;
    }

    if (message?.type === "CHECK_CONNECTION") {
      sendResponse({ ok: true, ...(await checkConnection()) });
    } else if (message?.type === "CHECK_FOLLOW_REQUIREMENT") {
      sendResponse({ ok: true, ...(await checkFollowRequirement()) });
    } else if (message?.type === "START_ANALYSIS") {
      const job = await startAnalysis(message.username);
      sendResponse({ ok: true, jobId: job.id });
    } else if (message?.type === "GET_JOB") {
      const job = await getJob(String(message.jobId || ""));
      sendResponse(job ? { ok: true, job } : { ok: false, error: "Analysis job was not found." });
    } else if (message?.type === "STOP_ANALYSIS") {
      sendResponse({ ok: true, job: await stopAnalysis(String(message.jobId || "")) });
    } else {
      sendResponse({ ok: false, error: "Unknown extension request." });
    }
  })().catch(error => sendResponse({ ok: false, error: error.message || "Extension request failed." }));
  return true;
});
