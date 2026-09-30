(function exposeCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.whoisitCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  "use strict";

  const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;

  function normalizeUsername(value) {
    const normalized = String(value || "").trim().replace(/^@/, "").toLowerCase();
    return USERNAME_PATTERN.test(normalized) && !normalized.startsWith(".") && !normalized.endsWith(".") && !normalized.includes("..") ? normalized : "";
  }

  function uniqueUsernames(values) {
    const seen = new Set();
    const users = [];
    for (const value of values || []) {
      const username = normalizeUsername(value);
      if (username && !seen.has(username)) {
        seen.add(username);
        users.push(username);
      }
    }
    return users;
  }

  function compareRelationships(followersInput, followingInput) {
    const followers = uniqueUsernames(followersInput);
    const following = uniqueUsernames(followingInput);
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

  function usernameFromHref(value) {
    try {
      const url = new URL(String(value));
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return "";
      return normalizeUsername(url.pathname.split("/").filter(Boolean)[0]);
    } catch {
      return "";
    }
  }

  function collectEntryUsernames(value, output) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(item => collectEntryUsernames(item, output));
      return;
    }
    if (typeof value !== "object") return;

    if (Array.isArray(value.string_list_data)) {
      for (const item of value.string_list_data) {
        const candidate = normalizeUsername(item?.value) || usernameFromHref(item?.href);
        if (candidate) output.push(candidate);
      }
    }

    const title = normalizeUsername(value.title);
    if (title && (value.string_list_data || value.media_list_data)) output.push(title);
  }

  function relationshipType(fileName, document) {
    const normalizedName = String(fileName || "").toLowerCase().replace(/\\/g, "/");
    if (document && typeof document === "object" && !Array.isArray(document)) {
      if (Array.isArray(document.relationships_following)) return "following";
      if (Array.isArray(document.relationships_followers)) return "followers";
    }
    const baseName = normalizedName.split("/").pop() || "";
    if (/^followers(?:_\d+)?\.json$/.test(baseName)) return "followers";
    if (/^following(?:_\d+)?\.json$/.test(baseName)) return "following";
    return null;
  }

  function parseRelationshipDocument(fileName, document) {
    const type = relationshipType(fileName, document);
    if (!type) {
      throw new Error(`${fileName || "File"} is not a supported followers/following JSON file.`);
    }

    let records = document;
    if (!Array.isArray(document) && document && typeof document === "object") {
      records = type === "following"
        ? document.relationships_following
        : document.relationships_followers;
    }
    if (!Array.isArray(records)) {
      throw new Error(`${fileName || "File"} has an unsupported Instagram export structure.`);
    }

    const users = [];
    collectEntryUsernames(records, users);
    return { type, users: uniqueUsernames(users) };
  }

  function parseExportDocuments(files) {
    const followers = [];
    const following = [];
    const acceptedFiles = [];

    for (const file of files || []) {
      let document;
      try {
        document = typeof file.data === "string" ? JSON.parse(file.data) : file.data;
      } catch {
        throw new Error(`${file.name || "A selected file"} is not valid JSON.`);
      }
      const parsed = parseRelationshipDocument(file.name, document);
      acceptedFiles.push(file.name);
      if (parsed.type === "followers") followers.push(...parsed.users);
      else following.push(...parsed.users);
    }

    if (!acceptedFiles.length) throw new Error("Select at least one Instagram relationship JSON file.");
    if (!followers.length) throw new Error("No follower usernames were found. Add followers_1.json (and any additional follower files). ");
    if (!following.length) throw new Error("No following usernames were found. Add following.json or following_1.json.");

    return { ...compareRelationships(followers, following), acceptedFiles };
  }

  function csvEscape(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  function createCsv(result) {
    const rows = [["username", "relationship"]];
    for (const username of result.notFollowingBack || []) rows.push([username, "does_not_follow_you_back"]);
    for (const username of result.notFollowedBack || []) rows.push([username, "you_do_not_follow_back"]);
    for (const username of result.mutuals || []) rows.push([username, "mutual"]);
    return `\uFEFF${rows.map(row => row.map(csvEscape).join(",")).join("\r\n")}`;
  }

  function resultSummary(result) {
    const followers = result.followers?.length || 0;
    const following = result.following?.length || 0;
    const mutuals = result.mutuals?.length || 0;
    return {
      followers,
      following,
      mutuals,
      notFollowingBack: result.notFollowingBack?.length || 0,
      notFollowedBack: result.notFollowedBack?.length || 0,
      followRatio: following ? followers / following : null,
      mutualRate: following ? mutuals / following : null
    };
  }

  function captureSummary(captureQuality) {
    if (!captureQuality) return { available: false, reliable: true, relationships: [] };
    const relationships = ["followers", "following"].map(type => {
      const value = captureQuality[type] || {};
      const reportedKnown = value.reportedKnown !== undefined
        ? Boolean(value.reportedKnown)
        : value.reported !== null && value.reported !== undefined && value.reported !== "";
      const reported = reportedKnown ? Math.max(0, Number(value.reported) || 0) : null;
      const retrieved = Math.max(0, Number(value.retrieved) || 0);
      return {
        type,
        reported,
        reportedKnown,
        retrieved,
        missing: reportedKnown ? Math.max(0, reported - retrieved) : null,
        coverage: reportedKnown ? (reported ? Math.min(1, retrieved / reported) : (retrieved === 0 ? 1 : 0)) : null,
        passes: Math.max(0, Number(value.passes) || 0),
        verified: Boolean(value.verified),
        converged: Boolean(value.converged),
        reliable: Boolean(value.reliable)
      };
    });
    return {
      available: true,
      reliable: Boolean(captureQuality.reliable) && relationships.every(item => item.reliable),
      relationships
    };
  }

  return {
    USERNAME_PATTERN,
    normalizeUsername,
    uniqueUsernames,
    compareRelationships,
    parseRelationshipDocument,
    parseExportDocuments,
    createCsv,
    resultSummary,
    captureSummary
  };
});
