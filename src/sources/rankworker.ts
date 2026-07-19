import { RankWorkerBlogError, toErrorMessage } from "../core/errors.js";
import { normalizeRankWorkerArticle } from "../core/normalize.js";
import { rankWorkerArticleSchema, rankWorkerPageSchema } from "../core/schemas.js";
import type { BlogArticle, BlogSource } from "../core/types.js";
import { validateArticleCollection } from "../core/validate.js";

const DEFAULT_API_URL = "https://api.rankworker.com/api/v1";
const DEFAULT_PAGE_SIZE = 9;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PAGES = 10_000;

type NextFetchOptions = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export type RankWorkerSourceOptions = {
  apiKey: string | (() => string | undefined);
  baseUrl?: string;
  pageSize?: number;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
};

export const RANKWORKER_COLLECTION_TAG = "rankworker:articles";

/** Creates a Direct API source. Secrets are resolved lazily and never included in client code. */
export function createRankWorkerSource(options: RankWorkerSourceOptions): BlogSource {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_API_URL);
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 60) {
    throw new RankWorkerBlogError("RankWorker pageSize must be between 1 and 60.", {
      code: "INVALID_PAGE_SIZE",
    });
  }

  async function request(pathname: string, init: NextFetchOptions): Promise<unknown> {
    const apiKey = resolveSecret(options.apiKey, "RANKWORKER_DIRECT_API_KEY");
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${apiKey}`);
    let response: Response;
    try {
      response = await fetchImplementation(`${baseUrl}${pathname}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new RankWorkerBlogError(
        `RankWorker request failed: ${toErrorMessage(error)}`,
        { code: "DIRECT_API_NETWORK_ERROR", cause: error },
      );
    }

    if (!response.ok) {
      throw new RankWorkerBlogError(
        `RankWorker request failed with HTTP ${response.status}.`,
        { code: `DIRECT_API_HTTP_${response.status}` },
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new RankWorkerBlogError("RankWorker returned invalid JSON.", {
        code: "DIRECT_API_INVALID_JSON",
        cause: error,
      });
    }
  }

  async function listArticles(): Promise<readonly BlogArticle[]> {
    const articles: BlogArticle[] = [];
    let page = 0;

    while (page < MAX_PAGES) {
      const json = await request(`/articles?page=${page}&size=${pageSize}`, {
        cache: "force-cache",
        next: { revalidate: false, tags: [RANKWORKER_COLLECTION_TAG] },
      });
      const parsed = rankWorkerPageSchema.safeParse(json);
      if (!parsed.success) {
        throw new RankWorkerBlogError("RankWorker returned an invalid article page.", {
          code: "DIRECT_API_INVALID_PAGE",
          cause: parsed.error,
        });
      }

      articles.push(...parsed.data.content.map(normalizeRankWorkerArticle));
      if (!parsed.data.page.hasNext) {
        return validateArticleCollection(articles).toSorted(compareByDateDescending);
      }
      if (parsed.data.page.number !== page) {
        throw new RankWorkerBlogError("RankWorker pagination did not advance.", {
          code: "DIRECT_API_INVALID_PAGINATION",
        });
      }
      page += 1;
    }

    throw new RankWorkerBlogError("RankWorker pagination exceeded its safety limit.", {
      code: "DIRECT_API_PAGE_LIMIT",
    });
  }

  async function getArticle(slug: string): Promise<BlogArticle | null> {
    let json: unknown;
    try {
      json = await request(`/articles/${encodeURIComponent(slug)}`, {
        // The collection tag is invalidated for every RankWorker webhook, so it
        // also safely clears an article whose slug changed after publication.
        cache: "force-cache",
        next: { revalidate: false, tags: [RANKWORKER_COLLECTION_TAG] },
      });
    } catch (error) {
      if (
        error instanceof RankWorkerBlogError &&
        error.code === "DIRECT_API_HTTP_404"
      ) {
        return null;
      }
      throw error;
    }

    const parsed = rankWorkerArticleSchema.safeParse(json);
    if (!parsed.success) {
      throw new RankWorkerBlogError("RankWorker returned an invalid article.", {
        code: "DIRECT_API_INVALID_ARTICLE",
        cause: parsed.error,
      });
    }
    return normalizeRankWorkerArticle(parsed.data);
  }

  return { kind: "rankworker", listArticles, getArticle };
}

function resolveSecret(
  value: string | (() => string | undefined),
  environmentName: string,
): string {
  const secret = typeof value === "function" ? value() : value;
  if (!secret?.trim()) {
    throw new RankWorkerBlogError(`Missing ${environmentName}.`, {
      code: "MISSING_DIRECT_API_KEY",
    });
  }
  return secret.trim();
}

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]");
    if (
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("RankWorker baseUrl must use HTTPS.");
    }
    return url.toString().replace(/\/$/, "");
  } catch (error) {
    throw new RankWorkerBlogError("RankWorker baseUrl is invalid.", {
      code: "INVALID_DIRECT_API_URL",
      cause: error,
    });
  }
}

function compareByDateDescending(first: BlogArticle, second: BlogArticle): number {
  return second.date.getTime() - first.date.getTime();
}
