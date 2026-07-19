import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createBlogDefinition } from "../src/core/blog.js";
import type { WebhookInvalidationAdapter } from "../src/core/types.js";
import { DEFAULT_LABELS, defaultBlogComponents } from "../src/ui/default-components.js";
import { handleRankWorkerWebhook, verifyRankWorkerWebhook } from "../src/webhook.js";
import { article } from "./fixtures.js";

const timestamp = "1784131200";
const now = new Date("2026-07-15T16:00:00.000Z");
const secret = "webhook-secret";

function sign(body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function payload() {
  const value = article();
  return {
    id: value.id,
    title: value.title,
    slug: value.slug,
    date: value.date.toISOString(),
    description: value.description,
    excerpt: value.excerpt,
    keywords: value.keywords,
    tags: value.tags,
    cover: value.cover,
    images: value.images,
    markdownBody: value.mdx,
    generatedAt: value.generatedAt?.toISOString(),
    updatedAt: value.updatedAt?.toISOString(),
  };
}

function setup(enabled = true) {
  const source = {
    kind: "rankworker" as const,
    async listArticles() {
      return [article()];
    },
    async getArticle() {
      return article();
    },
  };
  return createBlogDefinition(
    {
      source,
      site: { url: "https://example.com", name: "Example" },
      ...(enabled
        ? {
            webhook: {
              secret,
              warm: "article-and-index" as const,
              fetch: vi.fn(async () => new Response()),
            },
          }
        : {}),
    },
    { labels: DEFAULT_LABELS, components: defaultBlogComponents },
  );
}

function adapter() {
  const scheduled: (() => Promise<void>)[] = [];
  const value: WebhookInvalidationAdapter = {
    expireCollection: vi.fn(),
    invalidateArticlePath: vi.fn(),
    invalidateListingPaths: vi.fn(),
    schedule(task) {
      scheduled.push(task);
    },
  };
  return { value, scheduled };
}

describe("RankWorker webhook", () => {
  it("uses a timestamped constant-time HMAC and rejects replay or malformed signatures", () => {
    const rawBody = JSON.stringify(payload());
    expect(
      verifyRankWorkerWebhook({
        secret,
        timestamp,
        signature: `sha256=${sign(rawBody)}`,
        rawBody,
        now,
      }),
    ).toBe(true);
    expect(
      verifyRankWorkerWebhook({ secret, timestamp, signature: "bad", rawBody, now }),
    ).toBe(false);
    expect(
      verifyRankWorkerWebhook({
        secret,
        timestamp: "1",
        signature: sign(rawBody),
        rawBody,
        now,
      }),
    ).toBe(false);
  });

  it("invalidates collection data and affected paths, then schedules warming", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const rawBody = JSON.stringify(payload());
    const request = new Request("https://example.com/api/rankworker/webhook", {
      method: "POST",
      body: rawBody,
      headers: {
        "X-RankWorker-Webhook-Timestamp": timestamp,
        "X-RankWorker-Webhook-Signature": sign(rawBody),
      },
    });
    const mocks = adapter();
    const blog = setup();
    const response = await handleRankWorkerWebhook(blog, request, mocks.value);
    expect(response.status).toBe(200);
    expect(mocks.value.expireCollection).toHaveBeenCalledOnce();
    expect(mocks.value.invalidateArticlePath).toHaveBeenCalledWith(
      "/blog/a-useful-article",
    );
    expect(mocks.value.invalidateListingPaths).toHaveBeenCalledWith([
      "/blog",
      "/blog-sitemap.xml",
      "/blog-image-sitemap.xml",
    ]);
    await mocks.scheduled[0]?.();
    expect(blog.webhook?.fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("returns precise errors without performing invalidation", async () => {
    const mocks = adapter();
    expect(
      (
        await handleRankWorkerWebhook(
          setup(false),
          new Request("https://x", { method: "POST" }),
          mocks.value,
        )
      ).status,
    ).toBe(404);
    const badSignature = new Request("https://x", { method: "POST", body: "{}" });
    expect(
      (await handleRankWorkerWebhook(setup(), badSignature, mocks.value)).status,
    ).toBe(401);

    vi.useFakeTimers();
    vi.setSystemTime(now);
    const invalidJson = "{";
    const request = new Request("https://x", {
      method: "POST",
      body: invalidJson,
      headers: {
        "X-RankWorker-Webhook-Timestamp": timestamp,
        "X-RankWorker-Webhook-Signature": sign(invalidJson),
      },
    });
    expect((await handleRankWorkerWebhook(setup(), request, mocks.value)).status).toBe(
      400,
    );
    const invalidPayload = "{}";
    const invalidArticle = new Request("https://x", {
      method: "POST",
      body: invalidPayload,
      headers: {
        "X-RankWorker-Webhook-Timestamp": timestamp,
        "X-RankWorker-Webhook-Signature": sign(invalidPayload),
      },
    });
    expect(
      (await handleRankWorkerWebhook(setup(), invalidArticle, mocks.value)).status,
    ).toBe(400);
    const tooLarge = new Request("https://x", {
      method: "POST",
      body: "x",
      headers: { "content-length": "2000001" },
    });
    expect((await handleRankWorkerWebhook(setup(), tooLarge, mocks.value)).status).toBe(
      413,
    );
    const malformedLength = new Request("https://x", {
      method: "POST",
      body: "x",
      headers: { "content-length": "not-a-number" },
    });
    expect(
      (await handleRankWorkerWebhook(setup(), malformedLength, mocks.value)).status,
    ).toBe(400);
    const oversizedStream = new Request("https://x", {
      method: "POST",
      body: new Uint8Array(2_000_001),
    });
    expect(
      (await handleRankWorkerWebhook(setup(), oversizedStream, mocks.value)).status,
    ).toBe(413);
    vi.useRealTimers();
  });
});
