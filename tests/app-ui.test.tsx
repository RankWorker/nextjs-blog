import { createHmac } from "node:crypto";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, revalidateTag, scheduled } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  scheduled: [] as (() => Promise<void>)[],
}));

vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => scheduled.push(task),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    preload: _preload,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    preload?: boolean;
  }) => <img {...props} data-preload={_preload ? "true" : undefined} />,
}));
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: ({
    source,
    options,
  }: {
    source: string;
    options?: { blockJS?: boolean; blockDangerousJS?: boolean };
  }) => (
    <div
      data-mdx
      data-block-js={String(options?.blockJS)}
      data-block-dangerous-js={String(options?.blockDangerousJS)}
    >
      {source}
    </div>
  ),
}));

import { defineBlog } from "../src/app.js";
import type { BlogArticle } from "../src/core/types.js";
import { defineStaticBlog } from "../src/static-app.js";
import { createNextWebhookHandler } from "../src/webhook.js";
import {
  DEFAULT_LABELS,
  DefaultMdxImage,
  defaultBlogComponents,
  resolveBlogComponents,
} from "../src/ui/default-components.js";
import { DefaultMdxLink, renderMdx } from "../src/ui/mdx.js";
import { FAQ, resolveOpenQuestion } from "../src/ui/faq.js";
import { article } from "./fixtures.js";

describe("App Router integration and default presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduled.length = 0;
  });

  function setup(
    overrides: Partial<BlogArticle>[] = [],
    author?: { name: string; url?: string; image?: string },
  ) {
    const articles =
      overrides.length > 0
        ? overrides.map((value, index) =>
            article({ id: String(index + 1), slug: `article-${index + 1}`, ...value }),
          )
        : [article()];
    const source = {
      kind: "rankworker" as const,
      async listArticles() {
        return articles;
      },
      async getArticle(slug: string) {
        return articles.find((item) => item.slug === slug) ?? null;
      },
    };
    return defineBlog({
      source,
      site: {
        url: "https://example.com",
        name: "Example",
        description: "Site",
        ...(author ? { author } : {}),
      },
      pagination: { pageSize: 2, paginationWindow: 3 },
      webhook: { secret: "secret", warm: "none" },
    });
  }

  it("renders polished index states and all composable slots", async () => {
    const blog = setup([
      { title: "First", tags: ["Engineering"] },
      { title: "Second", tags: ["Design"], cover: null },
      { title: "Third", tags: ["Design"], cover: null },
    ]);
    const markup = renderToStaticMarkup(await blog.renderIndex());
    expect(markup).toContain("rw-blog__grid");
    expect(markup).toContain("/blog/article-1");
    expect(markup).toContain("Blog pagination");
    expect(markup).toContain("/blog/page/2");
    const secondPage = renderToStaticMarkup(await blog.renderIndex({ page: 2 }));
    expect(secondPage).toContain("Third");
    const tag = renderToStaticMarkup(await blog.renderIndex({ tag: "design" }));
    expect(tag).toContain('aria-current="page"');
  });

  it("preloads only the first index-card image", async () => {
    const cover = article().cover;
    const blog = setup([
      { title: "First", cover },
      { title: "Second", cover },
    ]);
    const markup = renderToStaticMarkup(await blog.renderIndex());
    expect(markup.match(/data-preload="true"/g)).toHaveLength(1);
  });

  it("renders fully static exports without App Router cache APIs", async () => {
    const source = {
      kind: "local-mdx" as const,
      async listArticles() {
        return [article()];
      },
      async getArticle(slug: string) {
        return slug === "a-useful-article" ? article() : null;
      },
    };
    const blog = defineStaticBlog({
      source,
      site: { url: "https://example.com", name: "Static example" },
    });

    await blog.renderIndex();
    await blog.renderArticle("a-useful-article");
  });

  it("renders article MDX, table of contents, cover, metadata, and JSON-LD", async () => {
    const headings = [
      { id: "one", text: "One", level: 2 as const },
      { id: "two", text: "Two", level: 2 as const },
      { id: "three", text: "Three", level: 3 as const },
    ];
    const blog = setup([{ headings }]);
    const markup = renderToStaticMarkup(await blog.renderArticle("article-1"));
    expect(markup).toContain("application/ld+json");
    expect(markup).toContain("In this article");
    expect(markup).toContain("data-mdx");
    expect(await blog.generateArticleMetadata("article-1")).toMatchObject({
      title: "A useful article",
    });
    expect(await blog.generateArticleMetadata("missing")).toMatchObject({
      robots: { index: false },
    });
    await expect(blog.renderArticle("missing")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a configured author avatar before the byline name", async () => {
    const blog = setup([], {
      name: "Jane Example",
      image: "/authors/jane.jpg",
    });
    const markup = renderToStaticMarkup(await blog.renderArticle("a-useful-article"));
    expect(markup).toContain("rw-blog__author-avatar");
    expect(markup).toContain("/authors/jane.jpg");
    expect(markup).toMatch(/rw-blog__author-avatar[^>]*\/><span>Jane Example<\/span>/);
  });

  it("generates every static route shape and XML response", async () => {
    const blog = setup([
      { tags: ["Engineering"] },
      { tags: ["Engineering"] },
      { tags: ["Engineering"] },
    ]);
    expect(await blog.generateArticleStaticParams()).toHaveLength(3);
    expect(await blog.generateIndexStaticParams()).toEqual([{ page: "2" }]);
    expect(await blog.generateTagStaticParams()).toEqual([{ tag: "engineering" }]);
    expect(await blog.generateTagPageStaticParams()).toEqual([
      { tag: "engineering", page: "2" },
    ]);
    expect((await blog.sitemapResponse()).headers.get("content-type")).toContain(
      "application/xml",
    );
    expect(await (await blog.imageSitemapResponse()).text()).toContain("image:image");
    expect(await blog.generateIndexMetadata({ page: 99 })).toMatchObject({
      robots: { index: false },
    });
    await expect(blog.renderIndex({ page: 99 })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("allows component and MDX overrides without copying templates", () => {
    const CustomEmpty = () => <p>Nothing custom</p>;
    expect(resolveBlogComponents({ EmptyState: CustomEmpty }).EmptyState).toBe(
      CustomEmpty,
    );
    expect(resolveBlogComponents().Layout).toBe(defaultBlogComponents.Layout);
    expect(DEFAULT_LABELS.allTopics).toBe("All");
    expect(
      renderToStaticMarkup(<DefaultMdxImage src="/image.jpg" alt="Alternative" />),
    ).toContain("Alternative");
    const mdx = renderMdx({
      source: "Hello",
      components: { strong: ({ children }) => <b>{children}</b> },
    });
    expect(renderToStaticMarkup(mdx)).toContain('data-block-js="true"');
    expect(
      renderToStaticMarkup(
        renderMdx({ source: "{trusted}", dangerouslyAllowJavaScript: true }),
      ),
    ).toContain('data-block-js="false"');
    expect(renderToStaticMarkup(mdx)).toContain('data-block-dangerous-js="true"');
    const faq = renderToStaticMarkup(
      <FAQ
        items={[{ question: "What is RankWorker?", answer: "A content platform." }]}
      />,
    );
    expect(faq).toContain("FAQPage");
    expect(faq).toContain("Frequently Asked Questions");
    expect(faq).toContain('href="#frequently-asked-questions"');
    expect(faq).toContain('id="what-is-rankworker"');
    expect(faq).toContain('aria-expanded="false"');
    expect(faq).toContain("rw-blog__faq-answer");
    expect(faq).toContain("What is RankWorker?");
    expect(renderToStaticMarkup(<FAQ items={[]} />)).toBe("");
    const duplicateFaq = renderToStaticMarkup(
      <FAQ
        items={[
          { question: "Why?", answer: "First." },
          { question: "Why?", answer: "Second." },
        ]}
      />,
    );
    expect(duplicateFaq).toContain('id="why"');
    expect(duplicateFaq).toContain('id="why-1"');
  });

  it("keeps heading anchors in the current tab", () => {
    const heading = renderToStaticMarkup(
      <DefaultMdxLink href="#introduction">Introduction</DefaultMdxLink>,
    );
    expect(heading).toBe('<a href="#introduction">Introduction</a>');

    const external = renderToStaticMarkup(
      <DefaultMdxLink href="https://example.com">External</DefaultMdxLink>,
    );
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');

    const internal = renderToStaticMarkup(
      <DefaultMdxLink href="/pricing" className="product-link" title="Pricing">
        Pricing
      </DefaultMdxLink>,
    );
    expect(internal).toContain('class="product-link"');
    expect(internal).toContain('title="Pricing"');

    const hardenedExternal = renderToStaticMarkup(
      <DefaultMdxLink href="https://example.com" rel="opener" target="_self">
        External
      </DefaultMdxLink>,
    );
    expect(hardenedExternal).toContain('target="_blank"');
    expect(hardenedExternal).toContain('rel="noopener noreferrer"');
  });

  it("keeps the newly opened FAQ item open when the previous item closes", () => {
    expect(resolveOpenQuestion("first", "second", true)).toBe("second");
    expect(resolveOpenQuestion("second", "first", false)).toBe("second");
    expect(resolveOpenQuestion("second", "second", false)).toBeNull();
  });

  it("connects the default Next invalidation adapter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T16:00:00Z"));
    const blog = setup();
    const value = article();
    const raw = JSON.stringify({
      id: value.id,
      title: value.title,
      slug: value.slug,
      date: value.date.toISOString(),
      description: value.description,
      excerpt: value.excerpt,
      markdownBody: value.mdx,
    });
    const timestamp = "1784131200";
    const signature = createHmac("sha256", "secret")
      .update(`${timestamp}.${raw}`)
      .digest("hex");
    const response = await createNextWebhookHandler(blog)(
      new Request("https://example.com", {
        method: "POST",
        body: raw,
        headers: {
          "X-RankWorker-Webhook-Timestamp": timestamp,
          "X-RankWorker-Webhook-Signature": signature,
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("rankworker:articles", {
      expire: 0,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/blog/a-useful-article");
    vi.useRealTimers();
  });
});
