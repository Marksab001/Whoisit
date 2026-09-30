import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { compareRelationships } = require(resolve(root, "website/core.js"));

function sample(size) {
  return {
    followers: Array.from({ length: size }, (_, index) => `user_${index}`),
    following: Array.from({ length: size }, (_, index) => `user_${index + Math.floor(size / 2)}`)
  };
}

function run(size, iterations) {
  const input = sample(size);
  const times = [];
  let result;
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    result = compareRelationships(input.followers, input.following);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    size,
    iterations,
    medianMs: Number(times[Math.floor(times.length / 2)].toFixed(2)),
    minMs: Number(times[0].toFixed(2)),
    maxMs: Number(times.at(-1).toFixed(2)),
    output: {
      notFollowingBack: result.notFollowingBack.length,
      notFollowedBack: result.notFollowedBack.length,
      mutuals: result.mutuals.length
    }
  };
}

const report = {
  runtime: process.version,
  platform: `${process.platform}/${process.arch}`,
  algorithm: "normalized Set comparison (expected O(n + m))",
  cases: [run(1_000, 15), run(10_000, 10), run(100_000, 5)]
};

console.log(JSON.stringify(report, null, 2));

