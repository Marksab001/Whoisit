const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

test("page worker unions reordered pagination passes before completing", async () => {
  const source = readFileSync(resolve(__dirname, "../extension/page-worker.js"), "utf8");
  const listeners = [];
  const posts = [];
  const passNumber = { followers: 0, following: 0 };

  function response(body) {
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  }

  function textResponse(body) {
    return { ok: true, status: 200, text: async () => body };
  }

  async function fakeFetch(input) {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/web/search/topsearch/") {
      return response({ users: [{ user: { username: "cybroatrix", pk: "99" } }] });
    }
    if (url.pathname === "/api/v1/friendships/show/99/") return response({ following: true });
    if (url.pathname === "/api/v1/users/7/info/") {
      return response({ data: { user: { username: "owner" } } });
    }
    if (url.pathname === "/owner/") return textResponse('<script>{"follower_count":4,"following_count":5}</script>');

    const type = url.pathname.includes("/followers/") ? "followers" : "following";
    const cursor = url.searchParams.get("max_id");
    if (!cursor) passNumber[type] += 1;

    if (type === "followers") {
      if (passNumber.followers === 1 && !cursor) return response({ users: [{ username: "alice" }, { username: "bob" }], next_max_id: "f1" });
      if (passNumber.followers === 1) return response({ users: [{ username: "bob" }, { username: "carol" }] });
      if (!cursor) return response({ users: [{ username: "alice" }, { username: "carol" }], next_max_id: "f2" });
      return response({ users: [{ username: "bob" }, { username: "dave" }] });
    }

    if (!cursor) return response({ users: [{ username: "x" }, { username: "y" }], next_max_id: "g1" });
    return response({ users: [{ username: "z" }] });
  }

  class FakeXmlHttpRequest {
    open() {}
    setRequestHeader() {}
    send() {}
  }

  let timerId = 0;
  const sandbox = {
    URL,
    Headers,
    Request,
    AbortController,
    DOMException,
    XMLHttpRequest: FakeXmlHttpRequest,
    document: { cookie: "ds_user_id=7; csrftoken=test-token" },
    location: { origin: "https://www.instagram.com", pathname: "/owner/", href: "https://www.instagram.com/owner/" },
    fetch: fakeFetch,
    whoisitConfig: { requiredFollowUsername: "cybroatrix" },
    addEventListener(type, callback) { if (type === "message") listeners.push(callback); },
    postMessage(message) { posts.push(message); },
    setTimeout(callback, milliseconds) {
      const id = ++timerId;
      if (milliseconds < 30_000) queueMicrotask(callback);
      return id;
    },
    clearTimeout() {}
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: "page-worker.js" });
  const pageWindow = vm.runInContext("window", context);

  const completion = new Promise((resolveCompletion, reject) => {
    let settled = false;
    const deadline = setTimeout(() => {
      settled = true;
      reject(new Error(`Worker did not complete: ${JSON.stringify(posts)}`));
    }, 2_000);
    const poll = () => {
      if (settled) return;
      const message = posts.find(item => item.type === "EVENT" && item.eventType === "JOB_COMPLETE");
      const failure = posts.find(item => item.type === "EVENT" && item.eventType === "JOB_ERROR");
      if (message) {
        settled = true;
        clearTimeout(deadline);
        resolveCompletion(message.payload);
      } else if (failure) {
        settled = true;
        clearTimeout(deadline);
        reject(new Error(`Worker failed: ${failure.payload.error}`));
      } else {
        setImmediate(poll);
      }
    };
    poll();
  });

  listeners[0]({
    source: pageWindow,
    origin: sandbox.location.origin,
    data: {
      channel: "WHOISIT_IG_PAGE_V2",
      source: "extension-bridge",
      type: "START_ANALYSIS",
      requestId: "request-1",
      payload: { jobId: "job-1", username: "owner" }
    }
  });

  const payload = await completion;
  assert.deepEqual([...payload.result.followers], ["alice", "bob", "carol", "dave"]);
  assert.deepEqual([...payload.result.following], ["x", "y", "z"]);
  assert.equal(payload.result.captureQuality.reliable, false);
  assert.equal(payload.result.captureQuality.followers.passes, 2);
  assert.equal(payload.result.captureQuality.followers.passDetails[1].added, 1);
  assert.equal(payload.result.captureQuality.following.passes, 2);
  assert.equal(payload.result.captureQuality.following.converged, true);
  assert.equal(payload.result.captureQuality.following.reliable, false);
  assert.equal(payload.result.notFollowingBack.length, 3);
  assert.equal(payload.progress.message, "Analysis complete · partial results available");
});

test("page worker declares and enforces the required follow gate", () => {
  const source = readFileSync(resolve(__dirname, "../extension/page-worker.js"), "utf8");
  assert.match(source, /REQUIRED_FOLLOW_USERNAME/);
  assert.match(source, /friendships\/show/);
  assert.match(source, /if \(!requirement\.allowed\) throw new Error/);
  assert.match(source, /FOLLOW_REQUIREMENT/);
});
