import { createHmac, timingSafeEqual } from "node:crypto";

import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import type { ResolvedBlogDefinition } from "./core/blog.js";
import { articlePath, absoluteUrl } from "./core/paths.js";
import { webhookArticleSchema } from "./core/schemas.js";
import type { WebhookInvalidationAdapter } from "./core/types.js";
import { RANKWORKER_COLLECTION_TAG } from "./sources/rankworker.js";

const TIMESTAMP_HEADER = "x-rankworker-webhook-timestamp";
const SIGNATURE_HEADER = "x-rankworker-webhook-signature";
const DEFAULT_TOLERANCE_SECONDS = 300;
const MAX_BODY_BYTES = 2_000_000;

export type VerifyWebhookOptions = {
  secret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
  toleranceSeconds?: number;
  now?: Date;
};

/** Verifies the timestamped HMAC over the exact webhook request body. */
export function verifyRankWorkerWebhook(options: VerifyWebhookOptions): boolean {
  const timestampSeconds = Number(options.timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isFinite(tolerance) || tolerance < 0) return false;
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) return false;

  const expected = createHmac("sha256", options.secret)
    .update(`${options.timestamp}.${options.rawBody}`, "utf8")
    .digest("hex");
  const received = options.signature
    .replace(/^sha256=/i, "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export async function handleRankWorkerWebhook(
  blog: ResolvedBlogDefinition,
  request: Request,
  adapter: WebhookInvalidationAdapter,
): Promise<Response> {
  if (!blog.webhook) return json({ error: "Webhook integration is disabled." }, 404);

  const contentLength = parseContentLength(request.headers.get("content-length"));
  if (contentLength === "invalid") {
    return json({ error: "Invalid Content-Length header." }, 400);
  }
  if (contentLength !== undefined && contentLength > MAX_BODY_BYTES)
    return json({ error: "Payload is too large." }, 413);

  const rawBody = await readLimitedBody(request, MAX_BODY_BYTES);
  if (rawBody === null) {
    return json({ error: "Payload is too large." }, 413);
  }

  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  const secret = resolveSecret(blog.webhook.secret);
  if (
    !timestamp ||
    !signature ||
    !secret ||
    !verifyRankWorkerWebhook({
      secret,
      timestamp,
      signature,
      rawBody,
      ...(blog.webhook.toleranceSeconds === undefined
        ? {}
        : { toleranceSeconds: blog.webhook.toleranceSeconds }),
    })
  ) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }
  const parsed = webhookArticleSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "Invalid article payload." }, 400);

  const article = parsed.data;
  const currentPath = articlePath(blog.paths.basePath, article.slug);
  await Promise.all([
    adapter.expireCollection(),
    adapter.invalidateArticlePath(currentPath),
    adapter.invalidateListingPaths([
      blog.paths.basePath,
      blog.paths.sitemapPath,
      blog.paths.imageSitemapPath,
    ]),
  ]);

  const warm = blog.webhook.warm ?? "article-and-index";
  if (warm !== "none") {
    adapter.schedule(async () => {
      const fetchImplementation = blog.webhook?.fetch ?? globalThis.fetch;
      const paths =
        warm === "article" ? [currentPath] : [currentPath, blog.paths.basePath];
      await Promise.allSettled(
        paths.map((path) =>
          fetchImplementation(absoluteUrl(blog.site.url, path), {
            headers: { "User-Agent": "RankWorker-Webhook-Warmer/1.0" },
          }),
        ),
      );
    });
  }

  return json({ ok: true, articleId: article.id, slug: article.slug });
}

/** Creates the production Next.js route handler with tag and path invalidation. */
export function createNextWebhookHandler(blog: ResolvedBlogDefinition) {
  const adapter: WebhookInvalidationAdapter = {
    expireCollection() {
      revalidateTag(RANKWORKER_COLLECTION_TAG, { expire: 0 });
    },
    invalidateArticlePath(path) {
      revalidatePath(path);
    },
    invalidateListingPaths(paths) {
      for (const path of paths) revalidatePath(path);
    },
    schedule(task) {
      after(task);
    },
  };
  return (request: Request) => handleRankWorkerWebhook(blog, request, adapter);
}

function resolveSecret(value: string | (() => string | undefined)): string | undefined {
  const secret = typeof value === "function" ? value() : value;
  return secret?.trim() || undefined;
}

function parseContentLength(value: string | null): number | "invalid" | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) return "invalid";
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : "invalid";
}

async function readLimitedBody(
  request: Request,
  limit: number,
): Promise<string | null> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
