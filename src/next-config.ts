import type { NextConfig } from "next";

const RANKWORKER_CDN_PATTERN = {
  protocol: "https" as const,
  hostname: "cdn.rankworker.com",
  pathname: "/**",
};

/** Adds the image settings required by RankWorker blog routes. */
export function withRankWorkerBlog(config: NextConfig = {}): NextConfig {
  const remotePatterns = config.images?.remotePatterns ?? [];
  const hasRankWorkerCdn = remotePatterns.some((pattern) => {
    if (pattern instanceof URL)
      return pattern.hostname === RANKWORKER_CDN_PATTERN.hostname;
    return pattern.hostname === RANKWORKER_CDN_PATTERN.hostname;
  });

  return {
    ...config,
    images: {
      ...config.images,
      remotePatterns: hasRankWorkerCdn
        ? remotePatterns
        : [...remotePatterns, RANKWORKER_CDN_PATTERN],
    },
  };
}
