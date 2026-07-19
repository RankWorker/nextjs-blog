import type { BlogArticle } from "../src/core/types.js";

export function article(overrides: Partial<BlogArticle> = {}): BlogArticle {
  return {
    id: "article-1",
    title: "A useful article",
    slug: "a-useful-article",
    date: new Date("2026-01-01T00:00:00.000Z"),
    description: "A useful description.",
    excerpt: "A useful excerpt.",
    keywords: ["useful"],
    tags: ["Engineering"],
    cover: {
      url: "https://cdn.rankworker.com/cover.jpg",
      title: "Cover",
      caption: null,
    },
    images: [],
    mdx: "## Introduction\n\nHello world.",
    generatedAt: new Date("2025-12-31T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    headings: [{ id: "introduction", text: "Introduction", level: 2 }],
    readingTime: "1 min read",
    wordCount: 3,
    ...overrides,
  };
}
