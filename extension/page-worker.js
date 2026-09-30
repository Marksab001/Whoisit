(() => {
  "use strict";
  if (globalThis.__WHOISIT_INSTAGRAM_PAGE_WORKER__) return;
  globalThis.__WHOISIT_INSTAGRAM_PAGE_WORKER__ = true;

  const CHANNEL = "WHOISIT_IG_PAGE_V2";
  const config = globalThis.whoisitConfig || { requiredFollowUsername: "cybroatrix" };
  const REQUIRED_FOLLOW_USERNAME = String(config.requiredFollowUsername || "cybroatrix").toLowerCase();
  const DEFAULT_APP_ID = "936619743392459";
  const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;
  const CAPTURED_HEADER_NAMES = new Set(["x-ig-app-id", "x-asbd-id", "x-ig-www-claim", "x-csrftoken"]);
  const capturedHeaders = new Map();
  const nativeFetch = window.fetch.bind(window);
  let activeJob = null;

  function normalizeUsername(value) {
    const username = String(value || "").trim().replace(/^@/, "").toLowerCase();
    return USERNAME_PATTERN.test(username) && !username.startsWith(".") && !username.endsWith(".") && !username.includes("..") ? username : "";
  }

  function cookieValue(name) {
    const prefix = `${name}=`;
    const part = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
    if (!part) return "";
    const raw = part.slice(prefix.length);
    try { return decodeURIComponent(raw); } catch { return raw; }
  }

  function captureHeaderInit(headerInit) {
    if (!headerInit) return;
    try {
      const headers = new Headers(headerInit);
      for (const [name, value] of headers.entries()) {
        const lower = name.toLowerCase();
        if (CAPTURED_HEADER_NAMES.has(lower) && value) capturedHeaders.set(lower, value);
      }
    } catch { /* Ignore non-standard request wrappers. */ }
  }

  function installHeaderCapture() {
    window.fetch = new Proxy(window.fetch, {
      apply(target, thisArg, args) {
        const [input, init] = args;
        if (input instanceof Request) captureHeaderInit(input.headers);
        captureHeaderInit(init?.headers);
        return Reflect.apply(target, thisArg, args);
      }
    });

    const requestHeaders = new WeakMap();
    const requestUrls = new WeakMap();
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      requestUrls.set(this, String(url || ""));
      requestHeaders.set(this, []);
      return originalOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      const list = requestHeaders.get(this) || [];
      list.push([name, value]);
      requestHeaders.set(this, list);
      return originalSetHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      const url = requestUrls.get(this) || "";
      if (url.includes("instagram.com") || url.startsWith("/")) captureHeaderInit(requestHeaders.get(this));
      return originalSend.apply(this, args);
    };
  }

  function requestHeaders() {
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "X-IG-App-ID": capturedHeaders.get("x-ig-app-id") || DEFAULT_APP_ID,
      "X-Requested-With": "XMLHttpRequest"
    };
    const csrf = capturedHeaders.get("x-csrftoken") || cookieValue("csrftoken");
    if (csrf) headers["X-CSRFToken"] = csrf;
    const asbd = capturedHeaders.get("x-asbd-id");
    const claim = capturedHeaders.get("x-ig-www-claim");
    if (asbd) headers["X-ASBD-ID"] = asbd;
    if (claim) headers["X-IG-WWW-Claim"] = claim;
    return headers;
  }

  function delay(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Analysis stopped.", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  function apiError(status, body) {
    const message = String(body?.message || body?.error_type || "").toLowerCase();
    if (status === 401 || message.includes("login_required")) return "Instagram session expired. Sign in again and refresh the Instagram tab.";
    if (status === 403 || message.includes("checkpoint")) return "Instagram requires a security check. Complete it in Instagram, then retry.";
    if (status === 404) return "Instagram could not find that account or endpoint.";
    if (status === 429 || message.includes("rate")) return "Instagram is rate limiting this account. Stop scanning and wait before trying again.";
    if (message.includes("spam")) return "Instagram temporarily blocked automated requests. Stop and retry later.";
    return `Instagram request failed (HTTP ${status}).`;
  }

  async function igFetch(path, signal, retries = 2) {
    const url = new URL(path, location.origin);
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const timeoutController = new AbortController();
      const timeout = setTimeout(() => timeoutController.abort(), 30_000);
      const onAbort = () => timeoutController.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await nativeFetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: requestHeaders(),
          signal: timeoutController.signal
        });
        const text = await response.text();
        let body = null;
        try { body = JSON.parse(text); } catch { /* Status handling below gives the useful error. */ }
        if (!response.ok) {
          if (response.status >= 500 && attempt < retries) {
            await delay(1_500 * (attempt + 1), signal);
            continue;
          }
          throw new Error(apiError(response.status, body));
        }
        if (!body) throw new Error("Instagram returned non-JSON data. Refresh the tab and retry.");
        return body;
      } catch (error) {
        if (signal?.aborted) throw new Error("Analysis stopped.");
        if (/session expired|security check|could not find|rate limiting|temporarily blocked/.test(error.message)) throw error;
        if (attempt >= retries) {
          if (error.name === "AbortError") throw new Error("Instagram request timed out. Refresh the tab and retry.");
          throw new Error(error.message || "Instagram network request failed.");
        }
        await delay(1_200 * (attempt + 1), signal);
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
      }
    }
    throw new Error("Instagram request failed.");
  }

  function post(type, payload = {}) {
    window.postMessage({ channel: CHANNEL, source: "page-worker", type, ...payload }, location.origin);
  }

  function respond(requestId, response) {
    post("RESPONSE", { requestId, response });
  }

  function report(eventType, payload) {
    post("EVENT", { eventType, payload });
  }

  async function sessionInfo(signal) {
    const id = cookieValue("ds_user_id");
    if (!id || location.pathname.startsWith("/accounts/login")) {
      return { ok: true, connected: false, username: null, href: location.href };
    }
    try {
      const data = await igFetch(`/api/v1/users/${encodeURIComponent(id)}/info/`, signal, 0);
      const username = normalizeUsername((data?.user || data?.data?.user)?.username);
      return { ok: true, connected: true, username: username || null, href: location.href };
    } catch {
      return { ok: true, connected: true, username: null, href: location.href };
    }
  }

  async function findExactUser(username, signal) {
    const data = await igFetch(`/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(username)}&include_reel=false`, signal, 1);
    return data.users?.find(item => normalizeUsername(item.user?.username) === username)?.user || null;
  }

  async function checkFollowRequirement(signal) {
    const currentId = cookieValue("ds_user_id");
    if (!currentId || location.pathname.startsWith("/accounts/login")) {
      return { ok: true, allowed: false, requiredUsername: REQUIRED_FOLLOW_USERNAME, message: "Sign in to Instagram before checking the follow requirement." };
    }

    const current = await sessionInfo(signal);
    if (normalizeUsername(current.username) === REQUIRED_FOLLOW_USERNAME) {
      return { ok: true, allowed: true, requiredUsername: REQUIRED_FOLLOW_USERNAME, message: "Brand account verified." };
    }

    const target = await findExactUser(REQUIRED_FOLLOW_USERNAME, signal);
    if (!target?.pk) {
      return { ok: true, allowed: false, requiredUsername: REQUIRED_FOLLOW_USERNAME, message: `Could not locate @${REQUIRED_FOLLOW_USERNAME}. Check the configured account name.` };
    }

    const relationship = await igFetch(`/api/v1/friendships/show/${encodeURIComponent(String(target.pk))}/`, signal, 1);
    const following = relationship?.following === true || relationship?.friendship_status?.following === true;
    return {
      ok: true,
      allowed: following,
      requiredUsername: REQUIRED_FOLLOW_USERNAME,
      message: following
        ? `Following @${REQUIRED_FOLLOW_USERNAME} verified.`
        : `Follow @${REQUIRED_FOLLOW_USERNAME} on Instagram, then check the connection again.`
    };
  }

  function optionalCount(value) {
    if (value === null || value === undefined || value === "") return null;
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 ? count : null;
  }

  function countsFromProfileHtml(html) {
    const source = String(html || "").replaceAll('\\"', '"');
    const followerMatch = source.match(/"(?:follower_count|edge_followed_by)"\s*:\s*(?:\{\s*"count"\s*:\s*)?(\d+)/);
    const followingMatch = source.match(/"(?:following_count|edge_follow)"\s*:\s*(?:\{\s*"count"\s*:\s*)?(\d+)/);
    if (followerMatch && followingMatch) {
      return { followers: Number(followerMatch[1]), following: Number(followingMatch[1]) };
    }
    try {
      const documentNode = new DOMParser().parseFromString(source, "text/html");
      const description = documentNode.querySelector('meta[property="og:description"]')?.content || "";
      const metrics = description.match(/([\d,.]+)\s+Followers?[,\s]+([\d,.]+)\s+Following/i);
      if (metrics) {
        return {
          followers: Number(metrics[1].replaceAll(",", "")),
          following: Number(metrics[2].replaceAll(",", ""))
        };
      }
    } catch { /* JSON patterns above remain the primary path. */ }
    return { followers: null, following: null };
  }

  async function profilePageCounts(username, signal) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), 20_000);
    const onAbort = () => timeoutController.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const response = await nativeFetch(new URL(`/${encodeURIComponent(username)}/`, location.origin), {
        credentials: "include",
        cache: "no-store",
        headers: { ...requestHeaders(), "Accept": "text/html,application/xhtml+xml" },
        signal: timeoutController.signal
      });
      if (!response.ok) return { followers: null, following: null };
      return countsFromProfileHtml(await response.text());
    } catch {
      return { followers: null, following: null };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function resolveUser(username, signal) {
    const currentId = cookieValue("ds_user_id");
    if (currentId) {
      try {
        const current = await igFetch(`/api/v1/users/${encodeURIComponent(currentId)}/info/`, signal, 0);
        const currentUser = current?.user || current?.data?.user;
        if (normalizeUsername(currentUser?.username) === username) {
          const apiFollowers = optionalCount(currentUser.follower_count);
          const apiFollowing = optionalCount(currentUser.following_count);
          const pageCounts = apiFollowers === null || apiFollowing === null
            ? await profilePageCounts(username, signal)
            : { followers: null, following: null };
          return {
            id: String(currentId),
            followers: apiFollowers ?? pageCounts.followers,
            following: apiFollowing ?? pageCounts.following
          };
        }
      } catch { /* Exact topsearch fallback below. */ }
    }

    const exact = await findExactUser(username, signal);
    if (!exact?.pk) throw new Error(`Could not find @${username}. Check its spelling and visibility.`);
    let details = exact;
    try {
      const info = await igFetch(`/api/v1/users/${encodeURIComponent(String(exact.pk))}/info/`, signal, 0);
      if (info?.user || info?.data?.user) details = info.user || info.data.user;
    } catch { /* Search data still provides the required ID. */ }
    const apiFollowers = optionalCount(details.follower_count);
    const apiFollowing = optionalCount(details.following_count);
    const pageCounts = apiFollowers === null || apiFollowing === null
      ? await profilePageCounts(username, signal)
      : { followers: null, following: null };
    return {
      id: String(exact.pk),
      followers: apiFollowers ?? pageCounts.followers,
      following: apiFollowing ?? pageCounts.following
    };
  }

  async function loadRelationship(jobId, type, profile, totals, signal) {
    // Instagram can reorder relationship pages while a cursor walk is in progress.
    // A single walk therefore looks successful while silently omitting accounts.
    // Repeating the full walk and taking a union removes those pagination gaps.
    const usersByName = new Map();
    const expected = optionalCount(type === "followers" ? profile.followers : profile.following);
    const expectedKnown = expected !== null;
    const maxPasses = type === "followers" ? 3 : 2;
    const passDetails = [];
    let verified = false;
    let converged = false;

    for (let pass = 1; pass <= maxPasses; pass += 1) {
      const sizeBeforePass = usersByName.size;
      const passUsers = new Set();
      const seenCursors = new Set();
      let cursor = "";
      let cursorLoop = false;
      let pages = 0;

      for (let page = 0; page < 5_000; page += 1) {
        if (signal.aborted) throw new Error("Analysis stopped.");
        let path = `/api/v1/friendships/${encodeURIComponent(profile.id)}/${type}/?count=200`;
        if (cursor) path += `&max_id=${encodeURIComponent(cursor)}`;
        const data = await igFetch(path, signal);
        pages += 1;
        const batch = Array.isArray(data.users) ? data.users : [];
        for (const user of batch) {
          const username = normalizeUsername(user?.username);
          if (!username) continue;
          passUsers.add(username);
          if (!usersByName.has(username)) usersByName.set(username, username);
        }

        const perPassEstimate = Math.max(expectedKnown ? expected : 0, passUsers.size, 1);
        const walkFraction = Math.min(1, passUsers.size / perPassEstimate);
        const passFraction = ((pass - 1) + walkFraction) / maxPasses;
        const base = type === "followers" ? 8 : 52;
        const span = type === "followers" ? 42 : 40;
        report("JOB_PROGRESS", {
          jobId,
          progress: {
            percent: Math.round(base + span * passFraction),
            phase: type,
            message: `Verifying ${type}: pass ${pass} of up to ${maxPasses} · ${usersByName.size.toLocaleString()} unique${expectedKnown ? ` / ${expected.toLocaleString()} reported` : " · total unavailable"}`,
            processed: totals.previous + usersByName.size
          }
        });

        const next = String(data.next_max_id || "");
        if (!next) break;
        if (seenCursors.has(next)) {
          cursorLoop = true;
          break;
        }
        seenCursors.add(next);
        cursor = next;
        await delay(2_000 + Math.floor(Math.random() * 1_200), signal);
      }

      const added = usersByName.size - sizeBeforePass;
      passDetails.push({ pass, pages, seen: passUsers.size, added, cursorLoop });
      verified = expectedKnown && usersByName.size >= expected;
      converged = pass >= 2 && added === 0;
      if (verified || converged) break;
      if (pass < maxPasses) await delay(2_000 + Math.floor(Math.random() * 1_000), signal);
    }

    const usernames = [...usersByName.keys()];
    const coverage = expectedKnown ? (expected > 0 ? Math.min(1, usernames.length / expected) : (usernames.length === 0 ? 1 : 0)) : null;
    const reliable = verified || (!expectedKnown && converged);
    return {
      usernames,
      quality: {
        type,
        reported: expected,
        reportedKnown: expectedKnown,
        retrieved: usernames.length,
        coverage,
        missing: expectedKnown ? Math.max(0, expected - usernames.length) : null,
        passes: passDetails.length,
        maxPasses,
        verified,
        converged,
        reliable,
        passDetails
      }
    };
  }

  function compare(followers, following) {
    const followerSet = new Set(followers);
    const followingSet = new Set(following);
    return {
      followers,
      following,
      notFollowingBack: following.filter(username => !followerSet.has(username)),
      notFollowedBack: followers.filter(username => !followingSet.has(username)),
      mutuals: following.filter(username => followerSet.has(username))
    };
  }

  async function analyze(job) {
    const { jobId, username, controller } = job;
    try {
      report("JOB_PROGRESS", { jobId, progress: { percent: 3, phase: "connect", message: `Verifying follow of @${REQUIRED_FOLLOW_USERNAME}…`, processed: 0 } });
      const requirement = await checkFollowRequirement(controller.signal);
      if (!requirement.allowed) throw new Error(requirement.message);
      report("JOB_PROGRESS", { jobId, progress: { percent: 5, phase: "connect", message: "Resolving Instagram account…", processed: 0 } });
      const profile = await resolveUser(username, controller.signal);
      const followerCapture = await loadRelationship(jobId, "followers", profile, { previous: 0 }, controller.signal);
      const followingCapture = await loadRelationship(jobId, "following", profile, { previous: followerCapture.usernames.length }, controller.signal);
      const followers = followerCapture.usernames;
      const following = followingCapture.usernames;
      report("JOB_PROGRESS", { jobId, progress: { percent: 96, phase: "compare", message: "Verifying capture and comparing lists…", processed: followers.length + following.length } });
      const captureQuality = {
        followers: followerCapture.quality,
        following: followingCapture.quality,
        reliable: followerCapture.quality.reliable && followingCapture.quality.reliable
      };
      const result = { ...compare(followers, following), captureQuality };
      report("JOB_COMPLETE", {
        jobId,
        result,
        progress: {
          percent: 100,
          phase: "compare",
          message: captureQuality.reliable ? "Analysis complete · capture verified" : "Analysis complete · partial results available",
          processed: followers.length + following.length
        }
      });
    } catch (error) {
      report("JOB_ERROR", { jobId, error: error.message || "Instagram analysis failed." });
    } finally {
      if (activeJob?.jobId === jobId) activeJob = null;
    }
  }

  window.addEventListener("message", event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.channel !== CHANNEL || data.source !== "extension-bridge") return;
    if (data.type === "PING") {
      post("READY");
      return;
    }
    if (!data.requestId) return;

    if (data.type === "SESSION_INFO") {
      sessionInfo().then(result => respond(data.requestId, result)).catch(error => respond(data.requestId, { ok: false, error: error.message }));
    } else if (data.type === "FOLLOW_REQUIREMENT") {
      checkFollowRequirement().then(result => respond(data.requestId, result)).catch(error => respond(data.requestId, { ok: false, error: error.message }));
    } else if (data.type === "START_ANALYSIS") {
      const jobId = String(data.payload?.jobId || "");
      const username = normalizeUsername(data.payload?.username);
      if (!jobId || !username) {
        respond(data.requestId, { ok: false, error: "Invalid analysis request." });
      } else if (activeJob) {
        respond(data.requestId, { ok: false, error: "Another Instagram analysis is already running in this tab." });
      } else {
        activeJob = { jobId, username, controller: new AbortController() };
        analyze(activeJob);
        respond(data.requestId, { ok: true });
      }
    } else if (data.type === "STOP_ANALYSIS") {
      if (activeJob?.jobId === data.payload?.jobId) activeJob.controller.abort();
      respond(data.requestId, { ok: true });
    }
  });

  installHeaderCapture();
  post("READY");
})();
