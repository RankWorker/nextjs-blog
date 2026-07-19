import { describe, expect, it } from "vitest";

import { createBlogDefinition } from "../src/core/blog.js";
import {
  articleJsonLd,
  articleMetadata,
  createImageSitemapXml,
  createSitemapXml,
  indexMetadata,
  safeJsonLd,
} from "../src/core/seo.js";
import { DEFAULT_LABELS, defaultBlogComponents } from "../src/ui/default-components.js";
import { article } from "./fixtures.js";

function setup() {
  const articles = [
    article({
      images: [
        {
          url: "https://cdn.rankworker.com/inline.jpg",
          title: "Inline & image",
          caption: "A <caption>",
        },
      ],
    }),
  ];
  const source = {
    kind: "test" as const,
    async listArticles() {
      return articles;
    },
    async getArticle() {
      return articles[0] ?? null;
    },
  };
  return createBlogDefinition(
    {
      source,
      site: {
        url: "https://example.com",
        name: "Example",
        author: { name: "Jane Example", url: "https://example.com/about" },
        publisher: { name: "Example Inc.", logo: "https://example.com/logo.png" },
      },
      pagination: { pageSize: 1 },
    },
    { labels: DEFAULT_LABELS, components: defaultBlogComponents },
  );
}

describe("SEO outputs", () => {
  it("creates canonical index and article metadata", async () => {
    const blog = setup();
    const view = await blog.getIndexView();
    expect(indexMetadata(blog, view!).alternates).toEqual({
      canonical: "https://example.com/blog",
    });
    const metadata = articleMetadata(blog, article());
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: "https://example.com/blog/a-useful-article",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.authors).toEqual([
      { name: "Jane Example", url: "https://example.com/about" },
    ]);
  });

  it("emits safe BlogPosting JSON-LD", () => {
    const blog = setup();
    const data = articleJsonLd(blog, article({ title: "Less < more" }));
    expect(data).toMatchObject({
      "@type": "BlogPosting",
      publisher: { name: "Example Inc." },
      author: { name: "Jane Example" },
    });
    expect(safeJsonLd(data)).not.toContain("<");
    expect(safeJsonLd(data)).toContain("\\u003c");
    const withoutPublisher = {
      ...blog,
      site: { url: blog.site.url, name: blog.site.name },
    };
    expect(
      articleJsonLd(withoutPublisher, article({ cover: null, images: [] })),
    ).not.toHaveProperty("publisher");
  });

  it("generates listing, article, and image sitemap XML with escaping", async () => {
    const blog = setup();
    const sitemap = await createSitemapXml(blog);
    expect(sitemap).toContain("https://example.com/blog");
    expect(sitemap).toContain("https://example.com/blog/tag/engineering");
    expect(sitemap).toContain("<lastmod>2026-01-02T00:00:00.000Z</lastmod>");
    const imageSitemap = await createImageSitemapXml(blog);
    expect(imageSitemap).toContain("xmlns:image=");
    expect(imageSitemap).toContain("Inline &amp; image");
    expect(imageSitemap).toContain("A &lt;caption&gt;");
  });
});
