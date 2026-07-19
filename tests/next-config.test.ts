import { describe, expect, it } from "vitest";

import { withRankWorkerBlog } from "../src/next-config.js";

describe("Next config helper", () => {
  it("does not enable Cache Components and adds default image hosts exactly once", () => {
    const config = withRankWorkerBlog({
      images: { remotePatterns: [new URL("https://assets.example.com/**")] },
    });
    expect(config).not.toHaveProperty("cacheComponents");
    expect(config.images?.remotePatterns).toHaveLength(3);
    expect(config.images?.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hostname: "cdn.rankworker.com" }),
        expect.objectContaining({ hostname: "picsum.photos" }),
      ]),
    );
    expect(withRankWorkerBlog(config).images?.remotePatterns).toHaveLength(3);
  });

  it("preserves explicit Cache Components configuration", () => {
    expect(withRankWorkerBlog({ cacheComponents: false }).cacheComponents).toBe(false);
    expect(withRankWorkerBlog({ cacheComponents: true }).cacheComponents).toBe(true);
  });
});
