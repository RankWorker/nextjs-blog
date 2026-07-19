import { describe, expect, it } from "vitest";

import { withRankWorkerBlog } from "../src/next-config.js";

describe("Next config helper", () => {
  it("does not enable Cache Components and adds the CDN exactly once", () => {
    const config = withRankWorkerBlog({
      images: { remotePatterns: [new URL("https://assets.example.com/**")] },
    });
    expect(config).not.toHaveProperty("cacheComponents");
    expect(config.images?.remotePatterns).toHaveLength(2);
    expect(withRankWorkerBlog(config).images?.remotePatterns).toHaveLength(2);
  });

  it("preserves explicit Cache Components configuration", () => {
    expect(withRankWorkerBlog({ cacheComponents: false }).cacheComponents).toBe(false);
    expect(withRankWorkerBlog({ cacheComponents: true }).cacheComponents).toBe(true);
  });
});
