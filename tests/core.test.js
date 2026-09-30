const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../website/core.js");

function entry(username) {
  return { string_list_data: [{ href: `https://www.instagram.com/${username}/`, value: username, timestamp: 0 }] };
}

test("normalizes valid usernames and rejects invalid values", () => {
  assert.equal(core.normalizeUsername(" @Alice.Name "), "alice.name");
  assert.equal(core.normalizeUsername("bad name"), "");
  assert.equal(core.normalizeUsername("bad..name"), "");
  assert.equal(core.normalizeUsername(".badname"), "");
  assert.equal(core.normalizeUsername("x".repeat(31)), "");
});

test("compares relationships with stable de-duplication", () => {
  const result = core.compareRelationships(
    ["Alice", "bob", "ALICE", "carol"],
    ["bob", "dave", "DAVE", "erin"]
  );
  assert.deepEqual(result.followers, ["alice", "bob", "carol"]);
  assert.deepEqual(result.following, ["bob", "dave", "erin"]);
  assert.deepEqual(result.notFollowingBack, ["dave", "erin"]);
  assert.deepEqual(result.notFollowedBack, ["alice", "carol"]);
  assert.deepEqual(result.mutuals, ["bob"]);
});

test("parses current Instagram following and paginated followers exports", () => {
  const result = core.parseExportDocuments([
    { name: "followers_1.json", data: [entry("alice"), entry("bob")] },
    { name: "followers_2.json", data: [entry("carol"), entry("alice")] },
    { name: "following.json", data: { relationships_following: [entry("bob"), entry("dave")] } }
  ]);
  assert.deepEqual(result.followers, ["alice", "bob", "carol"]);
  assert.deepEqual(result.following, ["bob", "dave"]);
  assert.deepEqual(result.notFollowingBack, ["dave"]);
  assert.deepEqual(result.notFollowedBack, ["alice", "carol"]);
});

test("parses usernames from Instagram links when value is absent", () => {
  const parsed = core.parseRelationshipDocument("followers_1.json", [
    { string_list_data: [{ href: "https://www.instagram.com/Link.User/" }] }
  ]);
  assert.deepEqual(parsed.users, ["link.user"]);
});

test("rejects unrelated and incomplete exports with useful errors", () => {
  assert.throws(() => core.parseRelationshipDocument("likes.json", []), /not a supported/);
  assert.throws(() => core.parseExportDocuments([
    { name: "followers_1.json", data: [entry("alice")] }
  ]), /following usernames/);
});

test("CSV includes every relationship category and UTF-8 BOM", () => {
  const result = core.compareRelationships(["alice", "bob"], ["bob", "carol"]);
  const csv = core.createCsv(result);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /"carol","does_not_follow_you_back"/);
  assert.match(csv, /"alice","you_do_not_follow_back"/);
  assert.match(csv, /"bob","mutual"/);
});

test("summarizes live capture quality and fails closed on missing accounts", () => {
  const summary = core.captureSummary({
    reliable: false,
    followers: { reported: 453, retrieved: 381, passes: 5, verified: false, converged: true, reliable: false },
    following: { reported: 465, retrieved: 465, passes: 2, verified: true, converged: false, reliable: true }
  });
  assert.equal(summary.available, true);
  assert.equal(summary.reliable, false);
  assert.deepEqual(summary.relationships[0], {
    type: "followers",
    reported: 453,
    reportedKnown: true,
    retrieved: 381,
    missing: 72,
    coverage: 381 / 453,
    passes: 5,
    verified: false,
    converged: true,
    reliable: false
  });
  assert.equal(core.captureSummary(null).reliable, true);
});

test("preserves unavailable Instagram totals instead of converting them to zero", () => {
  const summary = core.captureSummary({
    reliable: true,
    followers: { reported: null, reportedKnown: false, retrieved: 450, passes: 6, verified: false, converged: true, reliable: true },
    following: { reported: null, reportedKnown: false, retrieved: 463, passes: 5, verified: false, converged: true, reliable: true }
  });
  assert.equal(summary.reliable, true);
  assert.equal(summary.relationships[0].reported, null);
  assert.equal(summary.relationships[0].reportedKnown, false);
  assert.equal(summary.relationships[0].coverage, null);
  assert.equal(summary.relationships[0].missing, null);
});

test("100k-by-100k comparison remains exact", () => {
  const followers = Array.from({ length: 100_000 }, (_, index) => `u${index}`);
  const following = Array.from({ length: 100_000 }, (_, index) => `u${index + 50_000}`);
  const result = core.compareRelationships(followers, following);
  assert.equal(result.notFollowingBack.length, 50_000);
  assert.equal(result.notFollowedBack.length, 50_000);
  assert.equal(result.mutuals.length, 50_000);
});
