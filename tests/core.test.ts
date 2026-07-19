import { describe, expect, it } from "vitest";

import { analyzeMdx } from "../src/core/analyze.js";
import { collectTagDefinitions, createBlogDefinition } from "../src/core/blog.js";
import { RankWorkerBlogError, toErrorMessage } from "../src/core/errors.js";
import {
  normalizeLocalArticle,
  normalizeRankWorkerArticle,
} from "../src/core/normalize.js";
import { paginate, paginationItems } from "../src/core/pagination.js";
import {
  absoluteUrl,
  articlePath,
  indexPagePath,
  resolveBlogPaths,
  slugifyTag,
  tagPagePath,
} from "../src/core/paths.js";
import {
  localFrontmatterSchema,
  rankWorkerArticleSchema,
} from "../src/core/schemas.js";
import { validateArticleCollection } from "../src/core/validate.js";
import { DEFAULT_LABELS, defaultBlogComponents } from "../src/ui/default-components.js";
import { article } from "./fixtures.js";

describe("content primitives", () => {
  it("analyzes trusted MDX headings, duplicate slugs, images, and reading time", () => {
    const result = analyzeMdx(
      '## Hello world\n\n## Hello world\n\n![Diagram](https://cdn.rankworker.com/a.png "Caption")\n\n<Component />',
    );
    expect(result.headings).toEqual([
      { id: "hello-world", text: "Hello world", level: 2 },
      { id: "hello-world-1", text: "Hello world", level: 2 },
    ]);
    expect(result.images[0]).toEqual({
      url: "https://cdn.rankworker.com/a.png",
      title: "Diagram",
      caption: "Caption",
    });
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("adds built-in FAQ anchors to article headings", () => {
    const result = analyzeMdx(
      `<FAQ items={[
        { question: "What is RankWorker?", answer: "A platform." },
        { "question": "Can I use local MDX?", "answer": "Yes." }
      ]} />`,
    );
    expect(result.headings).toEqual([
      {
        id: "frequently-asked-questions",
        text: "Frequently Asked Questions",
        level: 2,
      },
      {
        id: "what-is-rankworker",
        text: "What is RankWorker?",
        level: 3,
      },
      {
        id: "can-i-use-local-mdx",
        text: "Can I use local MDX?",
        level: 3,
      },
    ]);
  });

  it("adds numeric suffixes to colliding article and FAQ anchors", () => {
    expect(
      analyzeMdx(
        `## Frequently Asked Questions\n\n<FAQ items={[{ question: "Why?", answer: "Because." }]} />`,
      ).headings,
    ).toEqual([
      {
        id: "frequently-asked-questions",
        text: "Frequently Asked Questions",
        level: 2,
      },
      {
        id: "frequently-asked-questions-1",
        text: "Frequently Asked Questions",
        level: 2,
      },
      { id: "why", text: "Why?", level: 3 },
    ]);
    expect(
      analyzeMdx(
        `<FAQ items={[{ question: "Why?", answer: "One." }, { question: "Why?", answer: "Two." }]} />`,
      ).headings.map(({ id }) => id),
    ).toEqual(["frequently-asked-questions", "why", "why-1"]);
  });

  it("normalizes API and local articles", () => {
    const api = rankWorkerArticleSchema.parse({
      id: 42,
      title: "Title",
      slug: "title",
      date: "2026-01-01",
      markdownBody: "Hello",
      tags: ["SEO", "SEO"],
      description: null,
      excerpt: "Excerpt",
    });
    const normalized = normalizeRankWorkerArticle(api);
    expect(normalized).toMatchObject({
      id: "42",
      description: "Excerpt",
      tags: ["SEO"],
    });

    const frontmatter = localFrontmatterSchema.parse({
      title: "Local",
      slug: "local",
      date: "2026-01-01",
      description: "Description",
      excerpt: "Excerpt",
      cover: "/cover.jpg",
      coverAlt: "Alternative",
      tags: [],
      keywords: [],
    });
    expect(normalizeLocalArticle(frontmatter, "Body").cover).toEqual({
      url: "/cover.jpg",
      title: "Alternative",
      caption: null,
    });
    expect(
      normalizeLocalArticle(
        { ...frontmatter, cover: undefined, coverAlt: undefined },
        "Body",
      ).cover,
    ).toBeNull();

    const minimal = rankWorkerArticleSchema.parse({
      id: "m",
      title: "Fallback",
      slug: "fallback",
      date: "2026-01-01",
      markdownBody: "Body",
    });
    expect(normalizeRankWorkerArticle(minimal)).toMatchObject({
      description: "Fallback",
      excerpt: "Fallback",
    });
  });

  it("rejects invalid slugs", () => {
    expect(() =>
      localFrontmatterSchema.parse({
        title: "X",
        slug: "Not Valid",
        date: "2026-01-01",
        description: "D",
        excerpt: "E",
      }),
    ).toThrow();
  });
});

describe("paths and pagination", () => {
  it("normalizes configurable paths and creates encoded URLs", () => {
    expect(resolveBlogPaths({ basePath: "journal/" }).basePath).toBe("/journal");
    expect(articlePath("/blog", "hello world")).toBe("/blog/hello%20world");
    expect(indexPagePath("/blog", 1)).toBe("/blog");
    expect(indexPagePath("/blog", 2)).toBe("/blog/page/2");
    expect(tagPagePath("/blog", "Web Design", 2)).toBe("/blog/tag/web-design/page/2");
    expect(slugifyTag("Health & Wellness")).toBe("health-wellness");
    expect(slugifyTag("C++")).toBe("c");
    expect(absoluteUrl("https://example.com", "/blog")).toBe(
      "https://example.com/blog",
    );
    expect(
      absoluteUrl(
        "https://rankworker.github.io/rankworker-nextjs-blog",
        "/blog/getting-started",
      ),
    ).toBe("https://rankworker.github.io/rankworker-nextjs-blog/blog/getting-started");
    expect(
      absoluteUrl("https://example.com/base", "https://cdn.example.com/image.jpg"),
    ).toBe("https://cdn.example.com/image.jpg");
    expect(() => resolveBlogPaths({ basePath: "/" })).toThrowError(RankWorkerBlogError);
  });

  it("paginates empty and populated collections", () => {
    expect(paginate([], 1, 10)).toMatchObject({ totalPages: 1, items: [] });
    expect(paginate([1, 2, 3], 2, 2)).toMatchObject({
      items: [3],
      hasPrevious: true,
      hasNext: false,
    });
    expect(paginate([1], 0, 2)).toBeNull();
    expect(paginate([1], 2, 2)).toBeNull();
    expect(paginationItems(5, 10, 3)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(paginationItems(1, 1, 5)).toEqual([1]);
  });
});

describe("blog definition", () => {
  const articles = [
    article(),
    article({
      id: "article-2",
      slug: "second",
      title: "Second",
      tags: ["Design"],
      date: new Date("2025-01-01"),
    }),
  ];
  const source = {
    kind: "test" as const,
    async listArticles() {
      return articles;
    },
    async getArticle(slug: string) {
      return articles.find((item) => item.slug === slug) ?? null;
    },
  };

  it("builds paginated index and tag views with consumer-safe links", async () => {
    const blog = createBlogDefinition(
      {
        source,
        site: { url: "https://example.com", name: "Example" },
        pagination: { pageSize: 1 },
      },
      { labels: DEFAULT_LABELS, components: defaultBlogComponents },
    );
    const index = await blog.getIndexView(2);
    expect(index?.page.items[0]?.slug).toBe("second");
    expect(index?.hrefForArticle("second")).toBe("/blog/second");
    expect(index?.hrefForPage(2)).toBe("/blog/page/2");
    const tag = await blog.getIndexView(1, "engineering");
    expect(tag).toMatchObject({ selectedTag: "Engineering", totalArticles: 2 });
    expect(tag?.hrefForPage(2)).toBe("/blog/tag/engineering/page/2");
    expect(await blog.getIndexView(1, "missing")).toBeNull();
    expect(await blog.getIndexView(99)).toBeNull();
  });

  it("uses nine articles per page by default", () => {
    const blog = createBlogDefinition(
      { source, site: { url: "https://example.com", name: "Example" } },
      { labels: DEFAULT_LABELS, components: defaultBlogComponents },
    );
    expect(blog.pageSize).toBe(9);
  });

  it("uses suffixed tag slugs consistently in index routes", async () => {
    const collisionArticles = [
      article({ tags: ["C++"] }),
      article({ id: "two", slug: "two", tags: ["C#"] }),
    ];
    const blog = createBlogDefinition(
      {
        source: {
          kind: "test",
          async listArticles() {
            return collisionArticles;
          },
          async getArticle() {
            return null;
          },
        },
        site: { url: "https://example.com", name: "Example" },
      },
      { labels: DEFAULT_LABELS, components: defaultBlogComponents },
    );
    const view = await blog.getIndexView();
    expect(view?.tags).toMatchObject([
      { name: "C#", slug: "c", href: "/blog/tag/c" },
      { name: "C++", slug: "c-2", href: "/blog/tag/c-2" },
    ]);
    expect((await blog.getIndexView(1, "c-2"))?.selectedTag).toBe("C++");
  });

  it("validates configuration and duplicate article identity", () => {
    expect(() =>
      createBlogDefinition(
        { source, site: { url: "http://insecure.test", name: "Bad" } },
        { labels: DEFAULT_LABELS, components: defaultBlogComponents },
      ),
    ).toThrow("site.url");
    expect(() =>
      createBlogDefinition(
        { source, site: { url: "file://localhost/tmp", name: "Bad" } },
        { labels: DEFAULT_LABELS, components: defaultBlogComponents },
      ),
    ).toThrow("site.url");
    expect(
      createBlogDefinition(
        { source, site: { url: "http://127.0.0.1:3000", name: "Local" } },
        { labels: DEFAULT_LABELS, components: defaultBlogComponents },
      ).site.url,
    ).toBe("http://127.0.0.1:3000");
    expect(() =>
      createBlogDefinition(
        {
          source,
          site: { url: "https://example.com", name: "Bad" },
          pagination: { pageSize: 0 },
        },
        { labels: DEFAULT_LABELS, components: defaultBlogComponents },
      ),
    ).toThrow("pageSize");
    expect(() =>
      validateArticleCollection([
        article(),
        article({ slug: "a-useful-article", id: "two" }),
      ]),
    ).toThrow("Duplicate article slug");
    expect(() =>
      validateArticleCollection([article(), article({ slug: "two" })]),
    ).toThrow("Duplicate article id");
    expect(
      collectTagDefinitions([
        article({ tags: ["C++"] }),
        article({ id: "two", slug: "two", tags: ["C#"] }),
      ]),
    ).toEqual([
      { name: "C#", slug: "c", count: 1 },
      { name: "C++", slug: "c-2", count: 1 },
    ]);
    expect(() => validateArticleCollection([article({ tags: ["✨"] })])).toThrow(
      "does not contain any URL-safe",
    );
  });

  it("blocks MDX JavaScript unless the consumer explicitly trusts it", () => {
    const safe = createBlogDefinition(
      { source, site: { url: "https://example.com", name: "Safe" } },
      { labels: DEFAULT_LABELS, components: defaultBlogComponents },
    );
    const trusted = createBlogDefinition(
      {
        source,
        site: { url: "https://example.com", name: "Trusted" },
        dangerouslyAllowMdxJavaScript: true,
      },
      { labels: DEFAULT_LABELS, components: defaultBlogComponents },
    );
    expect(safe.dangerouslyAllowMdxJavaScript).toBe(false);
    expect(trusted.dangerouslyAllowMdxJavaScript).toBe(true);
  });

  it("provides useful error conversion", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
    expect(toErrorMessage(42)).toBe("42");
  });
});
