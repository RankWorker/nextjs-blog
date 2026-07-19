import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createLocalMdxSource } from "../src/sources/local-mdx.js";
import {
  createRankWorkerSource,
  RANKWORKER_COLLECTION_TAG,
} from "../src/sources/rankworker.js";

function apiArticle(id: number, slug: string) {
  return {
    id,
    title: `Article ${id}`,
    slug,
    date: "2026-01-01",
    description: "Description",
    excerpt: "Excerpt",
    markdownBody: "Body",
    tags: [],
    keywords: [],
    images: [],
  };
}

describe("local MDX source", () => {
  it("loads, validates, sorts, and memoizes RankWorker-exported files", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-local-"));
    await mkdir(path.join(cwd, "content", "blog"), { recursive: true });
    const frontmatter = (slug: string, date: string) =>
      `---\ntitle: ${slug}\ndescription: Description\nexcerpt: Excerpt\nslug: ${slug}\ndate: ${date}\nkeywords: []\ntags:\n  - SEO\n---\n## Body`;
    await writeFile(
      path.join(cwd, "content", "blog", "older.mdx"),
      frontmatter("older", "2025-01-01"),
    );
    await writeFile(
      path.join(cwd, "content", "blog", "newer.mdx"),
      frontmatter("newer", "2026-01-01"),
    );
    const source = createLocalMdxSource({ cwd, directory: "content/blog" });
    expect((await source.listArticles()).map(({ slug }) => slug)).toEqual([
      "newer",
      "older",
    ]);
    await writeFile(
      path.join(cwd, "content", "blog", "later.mdx"),
      frontmatter("later", "2027-01-01"),
    );
    expect((await source.listArticles()).map(({ slug }) => slug)).toEqual([
      "newer",
      "older",
    ]);
    expect((await source.getArticle("older"))?.id).toBe("older");
    expect(await source.getArticle("missing")).toBeNull();
  });

  it("rejects directories outside the project and invalid files", async () => {
    expect(() =>
      createLocalMdxSource({ cwd: "/tmp/project", directory: "../elsewhere" }),
    ).toThrow("inside the project");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "rankworker-invalid-"));
    await mkdir(path.join(cwd, "content"));
    await writeFile(path.join(cwd, "content", "bad.mdx"), "No frontmatter");
    await expect(
      createLocalMdxSource({ cwd, directory: "content" }).listArticles(),
    ).rejects.toThrow("Could not load");
  });
});

describe("RankWorker Direct API source", () => {
  it("caches a default-fetch article indefinitely with the collection tag", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json(apiArticle(7, "cached")),
    );
    vi.stubGlobal("fetch", fetch);
    try {
      const source = createRankWorkerSource({ apiKey: () => "secret" });
      expect((await source.getArticle("cached"))?.id).toBe("7");
      expect(fetch.mock.calls[0]?.[1]).toMatchObject({
        cache: "force-cache",
        next: { revalidate: false, tags: [RANKWORKER_COLLECTION_TAG] },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("caches list and article requests indefinitely with the collection tag", async () => {
    const fetch = vi.fn(
      async (url: string, _init?: RequestInit & { next?: { tags?: string[] } }) => {
        if (url.includes("/articles/one")) return Response.json(apiArticle(1, "one"));
        const page = new URL(url).searchParams.get("page");
        return Response.json({
          content: [apiArticle(page === "0" ? 1 : 2, page === "0" ? "one" : "two")],
          page: {
            number: Number(page),
            size: 1,
            totalElements: 2,
            totalPages: 2,
            first: page === "0",
            last: page === "1",
            hasNext: page === "0",
            hasPrevious: page === "1",
          },
        });
      },
    );
    const source = createRankWorkerSource({
      apiKey: "secret",
      pageSize: 1,
      fetch: fetch as typeof globalThis.fetch,
    });
    expect((await source.listArticles()).map(({ slug }) => slug)).toEqual([
      "one",
      "two",
    ]);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      cache: "force-cache",
      next: { revalidate: false, tags: [RANKWORKER_COLLECTION_TAG] },
    });
    expect((await source.getArticle("one"))?.id).toBe("1");
    expect(fetch.mock.calls.at(-1)?.[1]).toMatchObject({
      cache: "force-cache",
      next: { revalidate: false, tags: [RANKWORKER_COLLECTION_TAG] },
    });
  });

  it("maps 404 to null and reports API failures safely", async () => {
    const notFound = createRankWorkerSource({
      apiKey: "secret",
      fetch: async () => new Response("", { status: 404 }),
    });
    await expect(notFound.getArticle("gone")).resolves.toBeNull();
    const broken = createRankWorkerSource({
      apiKey: "secret",
      fetch: async () => new Response("oops", { status: 500 }),
    });
    await expect(broken.listArticles()).rejects.toThrow("HTTP 500");
    const invalid = createRankWorkerSource({
      apiKey: "secret",
      fetch: async () => Response.json({ nope: true }),
    });
    await expect(invalid.listArticles()).rejects.toThrow("invalid article page");
    expect(() => createRankWorkerSource({ apiKey: "x", pageSize: 0 })).toThrow(
      "between 1 and 60",
    );
    expect(() =>
      createRankWorkerSource({ apiKey: "x", baseUrl: "http://api.example.com" }),
    ).toThrow("baseUrl is invalid");
    expect(() =>
      createRankWorkerSource({ apiKey: "x", baseUrl: "file://localhost/tmp" }),
    ).toThrow("baseUrl is invalid");
    expect(() =>
      createRankWorkerSource({
        apiKey: "x",
        baseUrl: "https://api.example.com?forward=elsewhere",
      }),
    ).toThrow("baseUrl is invalid");
    await expect(
      createRankWorkerSource({ apiKey: "", fetch: vi.fn() }).listArticles(),
    ).rejects.toThrow("Missing RANKWORKER_DIRECT_API_KEY");
    await expect(
      createRankWorkerSource({
        apiKey: "x",
        fetch: async () => {
          throw new Error("socket closed");
        },
      }).listArticles(),
    ).rejects.toThrow("socket closed");
    await expect(
      createRankWorkerSource({
        apiKey: "x",
        fetch: async () => new Response("not-json"),
      }).listArticles(),
    ).rejects.toThrow("invalid JSON");
    const stalled = createRankWorkerSource({
      apiKey: "x",
      fetch: async () =>
        Response.json({
          content: [],
          page: {
            number: 2,
            size: 1,
            totalElements: 2,
            totalPages: 2,
            first: false,
            last: false,
            hasNext: true,
            hasPrevious: true,
          },
        }),
    });
    await expect(stalled.listArticles()).rejects.toThrow("did not advance");
  });

  it("reports failures from the cached default-fetch article loader", async () => {
    const cases = [
      {
        response: new Response("", { status: 404 }),
        expectation: (source: ReturnType<typeof createRankWorkerSource>) =>
          expect(source.getArticle("gone")).resolves.toBeNull(),
      },
      {
        response: new Response("oops", { status: 500 }),
        expectation: (source: ReturnType<typeof createRankWorkerSource>) =>
          expect(source.getArticle("broken")).rejects.toThrow("HTTP 500"),
      },
      {
        response: new Response("not-json"),
        expectation: (source: ReturnType<typeof createRankWorkerSource>) =>
          expect(source.getArticle("invalid-json")).rejects.toThrow("invalid JSON"),
      },
      {
        response: Response.json({ nope: true }),
        expectation: (source: ReturnType<typeof createRankWorkerSource>) =>
          expect(source.getArticle("invalid-article")).rejects.toThrow(
            "invalid article",
          ),
      },
    ];

    for (const { response, expectation } of cases) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response),
      );
      await expectation(createRankWorkerSource({ apiKey: "secret" }));
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket closed");
      }),
    );
    await expect(
      createRankWorkerSource({ apiKey: "secret" }).getArticle("network"),
    ).rejects.toThrow("socket closed");
    vi.unstubAllGlobals();
  });
});
