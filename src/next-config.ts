import type { NextConfig } from "next";

const RANKWORKER_CDN_PATTERN = {
  protocol: "https" as const,
  hostname: "cdn.rankworker.com",
  pathname: "/**",
};

const PICSUM_PATTERN = {
  protocol: "https" as const,
  hostname: "picsum.photos",
  pathname: "/**",
};

const DEFAULT_REMOTE_PATTERNS = [RANKWORKER_CDN_PATTERN, PICSUM_PATTERN];

/** Adds the image settings required by RankWorker blog routes. */
export function withRankWorkerBlog(config: NextConfig = {}): NextConfig {
  const remotePatterns = config.images?.remotePatterns ?? [];
  const missingPatterns = DEFAULT_REMOTE_PATTERNS.filter(({ hostname }) =>
    remotePatterns.every((pattern) => pattern.hostname !== hostname),
  );

  return {
    ...config,
    images: {
      ...config.images,
      remotePatterns: [...remotePatterns, ...missingPatterns],
    },
  };
}
