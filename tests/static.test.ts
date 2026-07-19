import { describe, expect, it } from "vitest";

import { generateStaticBlogFiles } from "../src/static.js";
import { article } from "./fixtures.js";

describe("static blog files", () => {
  it("generates sitemap and robots outputs without Next runtime APIs", async () => {
    const source = {
      kind: "local-mdx" as const,
      async listArticles() {
        return [
          article({
            cover: {
              url: "https://cdn.rankworker.com/cover.jpg",
              title: "Cover",
              caption: null,
            },
          }),
        ];
      },
      async getArticle() {
        return null;
      },
    };

    const files = await generateStaticBlogFiles({
      source,
      site: {
        url: "https://rankworker.github.io/rankworker-nextjs-blog",
        name: "Demo",
      },
    });

    expect(files.sitemapXml).toContain(
      "https://rankworker.github.io/rankworker-nextjs-blog/blog/a-useful-article",
    );
    expect(files.imageSitemapXml).toContain("https://cdn.rankworker.com/cover.jpg");
    expect(files.robotsTxt).toContain(
      "Sitemap: https://rankworker.github.io/rankworker-nextjs-blog/blog-sitemap.xml",
    );
  });
});
