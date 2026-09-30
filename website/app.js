(() => {
  "use strict";

  const core = globalThis.whoisitCore;
  if (!core) throw new Error("whoisit core failed to load.");
  const config = globalThis.whoisitConfig;
  if (!config) throw new Error("whoisit configuration failed to load.");

  const byId = id => document.getElementById(id);
  const elements = {
    liveModeButton: byId("liveModeButton"), fileModeButton: byId("fileModeButton"),
    liveModePanel: byId("liveModePanel"), fileModePanel: byId("fileModePanel"),
    connectionBadge: byId("connectionBadge"), connectionIcon: byId("connectionIcon"),
    connectionTitle: byId("connectionTitle"), connectionText: byId("connectionText"),
    connectButton: byId("connectButton"), liveUsername: byId("liveUsername"), liveStartButton: byId("liveStartButton"),
    followGate: byId("followGate"), followGateIcon: byId("followGateIcon"), followGateTitle: byId("followGateTitle"),
    followGateText: byId("followGateText"), followGateLink: byId("followGateLink"),
    themeToggle: byId("themeToggle"), themeToggleText: byId("themeToggleText"),
    footerGithub: byId("footerGithub"), footerDiscord: byId("footerDiscord"), footerInstagram: byId("footerInstagram"),
    fileUsername: byId("fileUsername"), exportFiles: byId("exportFiles"), dropZone: byId("dropZone"),
    fileSummary: byId("fileSummary"), fileStartButton: byId("fileStartButton"),
    progressPanel: byId("progressPanel"), progressPercent: byId("progressPercent"), progressBar: byId("progressBar"),
    progressStatus: byId("progressStatus"), processedCount: byId("processedCount"), elapsedTime: byId("elapsedTime"),
    stopButton: byId("stopButton"), errorBox: byId("errorBox"), emptyState: byId("emptyState"), resultsPanel: byId("resultsPanel"),
    resultEyebrow: byId("resultEyebrow"), resultUsername: byId("resultUsername"), resultMeta: byId("resultMeta"),
    qualityBanner: byId("qualityBanner"), qualityIcon: byId("qualityIcon"), qualityTitle: byId("qualityTitle"), qualityText: byId("qualityText"),
    followersStat: byId("followersStat"), followersStatNote: byId("followersStatNote"), followingStatNote: byId("followingStatNote"),
    followingStat: byId("followingStat"), notFollowingBackStat: byId("notFollowingBackStat"), mutualStat: byId("mutualStat"),
    notFollowingBackBadge: byId("notFollowingBackBadge"), notFollowedBackBadge: byId("notFollowedBackBadge"),
    mutualBadge: byId("mutualBadge"), resultSearch: byId("resultSearch"), resultSort: byId("resultSort"),
    categoryTitle: byId("categoryTitle"), visibleCount: byId("visibleCount"), resultList: byId("resultList"),
    loadMoreButton: byId("loadMoreButton"), followRatio: byId("followRatio"), mutualRate: byId("mutualRate"),
    analysisTime: byId("analysisTime"), analysisMethod: byId("analysisMethod"),
    exportCsvButton: byId("exportCsvButton"), exportJsonButton: byId("exportJsonButton")
  };

  const state = {
    mode: "live",
    connected: false,
    followRequirementMet: false,
    scanning: false,
    selectedFiles: [],
    currentJobId: null,
    result: null,
    category: "notFollowingBack",
    visibleLimit: 200,
    startedAt: 0,
    elapsedTimer: null
  };

  const categoryLabels = {
    notFollowingBack: "Accounts that don't follow you back",
    notFollowedBack: "Accounts you don't follow back",
    mutuals: "Mutual connections"
  };

  function updateLiveStartState() {
    elements.liveStartButton.disabled = !state.connected || !state.followRequirementMet || state.scanning;
  }

  function setTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    elements.themeToggle.setAttribute("aria-pressed", String(dark));
    elements.themeToggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} theme`);
    elements.themeToggleText.textContent = dark ? "Light" : "Dark";
    localStorage.setItem("whoisit-theme", dark ? "dark" : "light");
  }

  function setFollowGate(status, username = config.requiredFollowUsername, detail = "") {
    const normalized = core.normalizeUsername(username) || config.requiredFollowUsername;
    const met = status === "allowed";
    state.followRequirementMet = met;
    elements.followGate.dataset.state = status;
    elements.followGateIcon.textContent = met ? "✓" : status === "checking" ? "…" : "!";
    elements.followGateTitle.textContent = met ? `Following @${normalized}` : status === "checking" ? "Checking follow requirement…" : `Follow @${normalized} to continue`;
    elements.followGateText.textContent = met
      ? "Requirement verified. Live analysis is unlocked."
      : detail || `Follow @${normalized}, then select Check connection again.`;
    elements.followGateLink.href = config.instagramUrl;
    elements.followGateLink.textContent = `Follow @${normalized} ↗`;
    elements.followGateLink.classList.toggle("is-hidden", met || status === "checking");
    updateLiveStartState();
  }

  function setMode(mode) {
    state.mode = mode;
    const live = mode === "live";
    elements.liveModeButton.classList.toggle("is-active", live);
    elements.fileModeButton.classList.toggle("is-active", !live);
    elements.liveModeButton.setAttribute("aria-selected", String(live));
    elements.fileModeButton.setAttribute("aria-selected", String(!live));
    elements.liveModePanel.classList.toggle("is-hidden", !live);
    elements.fileModePanel.classList.toggle("is-hidden", live);
    hideError();
  }

  function showError(message) {
    elements.errorBox.textContent = String(message || "Something went wrong.");
    elements.errorBox.classList.remove("is-hidden");
  }

  function hideError() {
    elements.errorBox.textContent = "";
    elements.errorBox.classList.add("is-hidden");
  }

  function setConnected(connected, username) {
    state.connected = connected;
    if (!connected) state.followRequirementMet = false;
    elements.connectionBadge.dataset.state = connected ? "online" : "offline";
    elements.connectionBadge.textContent = connected ? "Instagram connected" : "Extension offline";
    elements.connectionIcon.textContent = connected ? "✓" : "!";
    elements.connectionIcon.classList.toggle("is-online", connected);
    elements.connectionTitle.textContent = connected ? "Session verified" : "Connect the extension";
    elements.connectionText.textContent = connected
      ? `Signed in${username ? ` as @${username}` : ""}. Your session stays inside Instagram.`
      : "Open Instagram in another tab, sign in, then check the connection.";
    updateLiveStartState();
    if (username && !elements.liveUsername.value) elements.liveUsername.value = username;
  }

  function sendDirect(message, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(new Error("The extension did not respond in time."));
      }, timeoutMs);
      chrome.runtime.sendMessage(message, response => {
        if (settled) return;
        clearTimeout(timer);
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!response?.ok) reject(new Error(response?.error || "Extension request failed."));
        else resolve(response);
      });
    });
  }

  function sendBridge(message, timeoutMs) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("whoisit extension bridge not found. Install the extension or use Data export mode."));
      }, timeoutMs);
      function onMessage(event) {
        const data = event.data;
        if (event.source !== window || data?.channel !== "WHOISIT_DASHBOARD_RESPONSE" || data.requestId !== requestId) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (!data.response?.ok) reject(new Error(data.response?.error || "Extension request failed."));
        else resolve(data.response);
      }
      window.addEventListener("message", onMessage);
      window.postMessage({ channel: "WHOISIT_DASHBOARD_REQUEST", requestId, message }, location.origin);
    });
  }

  function sendExtension(message, timeoutMs = 10_000) {
    const direct = location.protocol === "chrome-extension:" && globalThis.chrome?.runtime?.sendMessage;
    return direct ? sendDirect(message, timeoutMs) : sendBridge(message, timeoutMs);
  }

  async function checkConnection({ silent = false } = {}) {
    hideError();
    elements.connectButton.disabled = true;
    elements.connectButton.textContent = "Checking…";
    try {
      const response = await sendExtension({ type: "CHECK_CONNECTION" }, silent ? 2_500 : 10_000);
      setConnected(Boolean(response.connected), response.username);
      if (response.connected) {
        setFollowGate("checking");
        const requirement = await sendExtension({ type: "CHECK_FOLLOW_REQUIREMENT" }, silent ? 5_000 : 15_000);
        setFollowGate(requirement.allowed ? "allowed" : "blocked", requirement.requiredUsername, requirement.message);
        if (!requirement.allowed && !silent) showError(requirement.message || `Follow @${requirement.requiredUsername || config.requiredFollowUsername} before starting live analysis.`);
      } else {
        setFollowGate("pending");
        if (!silent) showError("Instagram is not signed in. Open instagram.com, sign in, refresh that tab, and try again.");
      }
    } catch (error) {
      setConnected(false);
      setFollowGate("pending", config.requiredFollowUsername, "Connect Instagram to verify the follow requirement.");
      if (!silent) showError(error.message);
    } finally {
      elements.connectButton.disabled = false;
      elements.connectButton.textContent = "Check connection";
    }
  }

  function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function startClock() {
    state.startedAt = performance.now();
    clearInterval(state.elapsedTimer);
    elements.elapsedTime.textContent = "00:00";
    state.elapsedTimer = setInterval(() => {
      elements.elapsedTime.textContent = formatDuration(performance.now() - state.startedAt);
    }, 500);
  }

  function stopClock() {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
    const elapsedMs = state.startedAt ? performance.now() - state.startedAt : 0;
    elements.elapsedTime.textContent = formatDuration(elapsedMs);
    return elapsedMs;
  }

  function setProgress(progress = {}) {
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    elements.progressPercent.textContent = `${Math.round(percent)}%`;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressBar.parentElement.setAttribute("aria-valuenow", String(Math.round(percent)));
    elements.progressStatus.textContent = progress.message || "Working…";
    elements.processedCount.textContent = Number(progress.processed || 0).toLocaleString();

    const phase = progress.phase || "connect";
    const order = ["connect", "followers", "following", "compare"];
    const activeIndex = order.indexOf(phase);
    order.forEach((name, index) => {
      const item = byId(`step${name[0].toUpperCase()}${name.slice(1)}`);
      item.classList.toggle("is-active", index === activeIndex && percent < 100);
      item.classList.toggle("is-complete", percent >= 100 || (activeIndex >= 0 && index < activeIndex));
    });
  }

  function beginScan() {
    hideError();
    state.scanning = true;
    elements.progressPanel.classList.remove("is-hidden");
    elements.stopButton.classList.toggle("is-hidden", state.mode !== "live");
    elements.liveStartButton.disabled = true;
    elements.fileStartButton.disabled = true;
    setProgress({ percent: 2, message: "Preparing analysis…", phase: "connect", processed: 0 });
    startClock();
  }

  function finishScan() {
    state.scanning = false;
    updateLiveStartState();
    elements.fileStartButton.disabled = state.selectedFiles.length === 0;
    elements.stopButton.classList.add("is-hidden");
  }

  async function runLiveScan() {
    const username = core.normalizeUsername(elements.liveUsername.value);
    if (!username) return showError("Enter a valid Instagram username (letters, numbers, periods, and underscores only). ");
    try {
      const requirement = await sendExtension({ type: "CHECK_FOLLOW_REQUIREMENT" }, 15_000);
      setFollowGate(requirement.allowed ? "allowed" : "blocked", requirement.requiredUsername, requirement.message);
      if (!requirement.allowed) throw new Error(requirement.message || `Follow @${requirement.requiredUsername || config.requiredFollowUsername} before starting live analysis.`);
      beginScan();
      const started = await sendExtension({ type: "START_ANALYSIS", username });
      state.currentJobId = started.jobId;
      while (state.scanning && state.currentJobId) {
        await new Promise(resolve => setTimeout(resolve, 650));
        const response = await sendExtension({ type: "GET_JOB", jobId: state.currentJobId });
        const job = response.job;
        setProgress(job.progress);
        if (job.status === "complete") {
          const elapsedMs = stopClock();
          setProgress({ percent: 100, message: job.progress?.message || "Analysis complete", phase: "compare", processed: job.progress?.processed || 0 });
          showResult(job.result, username, "Live browser scan", elapsedMs);
          state.currentJobId = null;
          break;
        }
        if (job.status === "error" || job.status === "stopped") throw new Error(job.error || "Analysis stopped.");
      }
    } catch (error) {
      if (state.scanning) stopClock();
      showError(error.message);
    } finally {
      finishScan();
    }
  }

  async function stopLiveScan() {
    if (!state.currentJobId) return;
    elements.stopButton.disabled = true;
    try {
      await sendExtension({ type: "STOP_ANALYSIS", jobId: state.currentJobId });
      setProgress({ percent: 0, message: "Stop requested…", phase: "connect", processed: 0 });
    } catch (error) {
      showError(error.message);
    } finally {
      elements.stopButton.disabled = false;
    }
  }

  function describeFiles(files) {
    if (!files.length) return "No files selected";
    const names = files.slice(0, 3).map(file => file.name);
    const remainder = files.length - names.length;
    return `${files.length} file${files.length === 1 ? "" : "s"}: ${names.join(", ")}${remainder ? ` +${remainder} more` : ""}`;
  }

  function selectFiles(fileList) {
    state.selectedFiles = [...fileList].filter(file => file.name.toLowerCase().endsWith(".json"));
    elements.fileSummary.textContent = describeFiles(state.selectedFiles);
    elements.fileStartButton.disabled = state.selectedFiles.length === 0 || state.scanning;
    if (!state.selectedFiles.length && fileList.length) showError("Select JSON files from the Instagram followers_and_following export folder.");
    else hideError();
  }

  async function runFileScan() {
    const username = core.normalizeUsername(elements.fileUsername.value) || "instagram_export";
    if (!state.selectedFiles.length) return showError("Select your followers and following JSON files first.");
    beginScan();
    try {
      setProgress({ percent: 18, message: "Reading selected JSON files…", phase: "followers", processed: 0 });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const documents = await Promise.all(state.selectedFiles.map(async file => ({ name: file.name, data: await file.text() })));
      setProgress({ percent: 70, message: "Comparing followers and following…", phase: "compare", processed: documents.length });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const result = core.parseExportDocuments(documents);
      const elapsedMs = stopClock();
      setProgress({ percent: 100, message: "Local export analysis complete", phase: "compare", processed: result.followers.length + result.following.length });
      showResult(result, username, `Official export · ${result.acceptedFiles.length} files`, elapsedMs);
    } catch (error) {
      stopClock();
      showError(error.message);
    } finally {
      finishScan();
    }
  }

  function showResult(result, username, method, elapsedMs) {
    state.result = { ...result, username, method, analyzedAt: new Date().toISOString() };
    state.category = "notFollowingBack";
    state.visibleLimit = 200;
    elements.emptyState.classList.add("is-hidden");
    elements.resultsPanel.classList.remove("is-hidden");
    elements.resultUsername.textContent = `@${username}`;
    elements.resultMeta.textContent = `${method} · ${new Date().toLocaleString()}`;
    const summary = core.resultSummary(result);
    const quality = core.captureSummary(result.captureQuality);
    const verifiedCapture = quality.reliable;
    elements.resultEyebrow.textContent = verifiedCapture ? "ANALYSIS COMPLETE" : "PARTIAL RESULTS";
    elements.followersStat.textContent = summary.followers.toLocaleString();
    elements.followingStat.textContent = summary.following.toLocaleString();
    elements.notFollowingBackStat.textContent = summary.notFollowingBack.toLocaleString();
    elements.mutualStat.textContent = summary.mutuals.toLocaleString();
    elements.notFollowingBackBadge.textContent = summary.notFollowingBack.toLocaleString();
    elements.notFollowedBackBadge.textContent = summary.notFollowedBack.toLocaleString();
    elements.mutualBadge.textContent = summary.mutuals.toLocaleString();
    elements.followRatio.textContent = summary.followRatio == null ? "—" : `${verifiedCapture ? "" : "≈"}${summary.followRatio.toFixed(2)}×`;
    elements.mutualRate.textContent = summary.mutualRate == null ? "—" : `${verifiedCapture ? "" : "≈"}${(summary.mutualRate * 100).toFixed(1)}%`;
    elements.analysisTime.textContent = formatDuration(elapsedMs);
    elements.analysisMethod.textContent = method;
    elements.exportCsvButton.disabled = !verifiedCapture;
    elements.exportJsonButton.disabled = !verifiedCapture;
    const exportTitle = verifiedCapture ? "" : "Exports are disabled for partial results. Use Data export for an exact comparison.";
    elements.exportCsvButton.title = exportTitle;
    elements.exportJsonButton.title = exportTitle;

    if (quality.available) {
      const followers = quality.relationships.find(item => item.type === "followers");
      const following = quality.relationships.find(item => item.type === "following");
      elements.qualityBanner.classList.remove("is-hidden", "quality-banner--warning", "quality-banner--success");
      elements.qualityBanner.classList.add(verifiedCapture ? "quality-banner--success" : "quality-banner--warning");
      elements.qualityIcon.textContent = verifiedCapture ? "✓" : "!";
      elements.qualityTitle.textContent = verifiedCapture ? "Capture verified" : "Partial results — verification incomplete";
      const allReported = followers.reportedKnown && following.reportedKnown;
      const followerStatus = followers.reportedKnown
        ? `${followers.retrieved.toLocaleString()} of ${followers.reported.toLocaleString()} followers`
        : `${followers.retrieved.toLocaleString()} followers (profile total unavailable)`;
      const followingStatus = following.reportedKnown
        ? `${following.retrieved.toLocaleString()} of ${following.reported.toLocaleString()} following`
        : `${following.retrieved.toLocaleString()} following (profile total unavailable)`;
      elements.qualityText.textContent = verifiedCapture
        ? (allReported
          ? `Matched Instagram's reported totals after ${followers.passes} follower pass${followers.passes === 1 ? "" : "es"} and ${following.passes} following pass${following.passes === 1 ? "" : "es"}.`
          : `Relationship lists stabilized with no new accounts across two complete passes. Reported totals were unavailable for at least one list.`)
        : `Captured ${followerStatus} and ${followingStatus}. Results are shown immediately but may contain false positives because Instagram stopped returning accounts. Use Data export for an exact comparison.`;
      elements.followersStatNote.textContent = followers.reportedKnown
        ? `${followers.retrieved.toLocaleString()} of ${followers.reported.toLocaleString()} reported · ${followers.passes} pass${followers.passes === 1 ? "" : "es"}`
        : `Reported total unavailable · ${followers.passes} passes`;
      elements.followingStatNote.textContent = following.reportedKnown
        ? `${following.retrieved.toLocaleString()} of ${following.reported.toLocaleString()} reported · ${following.passes} pass${following.passes === 1 ? "" : "es"}`
        : `Reported total unavailable · ${following.passes} passes`;
    } else {
      elements.qualityBanner.classList.add("is-hidden");
      elements.followersStatNote.textContent = "Accounts following you";
      elements.followingStatNote.textContent = "Accounts you follow";
    }
    elements.resultSearch.value = "";
    activateCategory("notFollowingBack");
    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function activateCategory(category) {
    state.category = category;
    state.visibleLimit = 200;
    document.querySelectorAll(".result-tab").forEach(button => {
      const active = button.dataset.category === category;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderList();
  }

  function initials(username) {
    return username.replace(/[._]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("") || "@";
  }

  function renderList() {
    if (!state.result) return;
    const quality = core.captureSummary(state.result.captureQuality);
    const query = elements.resultSearch.value.trim().toLowerCase();
    const direction = elements.resultSort.value === "desc" ? -1 : 1;
    const source = state.result[state.category] || [];
    const filtered = source.filter(username => username.includes(query)).sort((a, b) => direction * a.localeCompare(b));
    const visible = filtered.slice(0, state.visibleLimit);
    elements.resultList.replaceChildren();
    elements.categoryTitle.textContent = `${categoryLabels[state.category]}${quality.reliable ? "" : " (partial)"}`;
    elements.visibleCount.textContent = `${filtered.length.toLocaleString()}${quality.reliable ? "" : " partial"} result${filtered.length === 1 ? "" : "s"}`;

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      const strong = document.createElement("strong");
      strong.textContent = query ? "No matching usernames" : "Nothing here — nice!";
      const span = document.createElement("span");
      span.textContent = query ? "Try a different search." : "This category has no accounts.";
      empty.append(strong, span);
      elements.resultList.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      for (const username of visible) {
        const link = document.createElement("a");
        link.className = "user-row";
        link.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const identity = document.createElement("span");
        identity.className = "user-identity";
        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = initials(username);
        const copy = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = `@${username}`;
        const note = document.createElement("small");
        note.textContent = categoryLabels[state.category];
        copy.append(name, note);
        identity.append(avatar, copy);
        const arrow = document.createElement("span");
        arrow.className = "open-arrow";
        arrow.textContent = "↗";
        link.append(identity, arrow);
        fragment.append(link);
      }
      elements.resultList.append(fragment);
    }
    elements.loadMoreButton.classList.toggle("is-hidden", visible.length >= filtered.length);
  }

  function download(content, fileName, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  elements.liveModeButton.addEventListener("click", () => setMode("live"));
  elements.fileModeButton.addEventListener("click", () => setMode("file"));
  elements.connectButton.addEventListener("click", () => checkConnection());
  elements.themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  elements.liveStartButton.addEventListener("click", runLiveScan);
  elements.liveUsername.addEventListener("keydown", event => { if (event.key === "Enter" && !elements.liveStartButton.disabled) runLiveScan(); });
  elements.fileStartButton.addEventListener("click", runFileScan);
  elements.stopButton.addEventListener("click", stopLiveScan);
  elements.exportFiles.addEventListener("change", event => selectFiles(event.target.files));
  elements.dropZone.addEventListener("dragover", event => { event.preventDefault(); elements.dropZone.classList.add("is-dragging"); });
  elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("is-dragging"));
  elements.dropZone.addEventListener("drop", event => { event.preventDefault(); elements.dropZone.classList.remove("is-dragging"); selectFiles(event.dataTransfer.files); });
  document.querySelectorAll(".result-tab").forEach(button => button.addEventListener("click", () => activateCategory(button.dataset.category)));
  elements.resultSearch.addEventListener("input", () => { state.visibleLimit = 200; renderList(); });
  elements.resultSort.addEventListener("change", renderList);
  elements.loadMoreButton.addEventListener("click", () => { state.visibleLimit += 200; renderList(); });
  elements.exportCsvButton.addEventListener("click", () => {
    if (state.result) download(core.createCsv(state.result), `whoisit-${state.result.username}-relationships.csv`, "text/csv;charset=utf-8");
  });
  elements.exportJsonButton.addEventListener("click", () => {
    if (state.result) download(JSON.stringify(state.result, null, 2), `whoisit-${state.result.username}-relationships.json`, "application/json;charset=utf-8");
  });

  elements.footerGithub.href = config.githubUrl;
  elements.footerDiscord.href = config.discordUrl;
  elements.footerInstagram.href = config.instagramUrl;
  const storedTheme = localStorage.getItem("whoisit-theme");
  setTheme(storedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  setMode("live");
  checkConnection({ silent: true });
})();
