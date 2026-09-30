# Contributing

Use Node.js 20 or later. Create a focused branch, keep unrelated formatting out of the change, and add deterministic tests for behavior changes.

Before opening a pull request, run:

```bash
npm run build
npm test
npm run check
npm run benchmark
```

Do not commit authentication cookies, official Instagram exports, scan results, personal usernames, browser profiles, build caches, or packaged releases. Generated extension dashboard files must match their canonical files in `website/`.
