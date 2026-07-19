import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { withRankWorkerBlog } = require("@rankworker/nextjs-blog/next-config");

if (typeof withRankWorkerBlog !== "function") {
  throw new TypeError(
    "The CommonJS next-config export must provide withRankWorkerBlog().",
  );
}

const config = withRankWorkerBlog({});
if (config.cacheComponents !== undefined) {
  throw new Error("withRankWorkerBlog() must not enable Cache Components.");
}
if (
  !config.images?.remotePatterns?.some(
    (pattern) => pattern.hostname === "cdn.rankworker.com",
  )
) {
  throw new Error("withRankWorkerBlog() did not add the RankWorker CDN.");
}
