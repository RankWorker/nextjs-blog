import { RankWorkerBlogError } from "./errors.js";

export type ResolvedBlogPaths = {
  basePath: string;
  sitemapPath: string;
  imageSitemapPath: string;
  webhookPath: string;
};

function trimBoundaryCharacter(value: string, character: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === character) start += 1;
  while (end > start && value[end - 1] === character) end -= 1;

  return value.slice(start, end);
}

function normalizePath(value: string, label: string): string {
  const path = `/${trimBoundaryCharacter(value.trim(), "/")}`;

  if (path === "/" || path.includes("?") || path.includes("#")) {
    throw new RankWorkerBlogError(`${label} must be a non-root URL pathname.`, {
      code: "INVALID_PATH",
    });
  }

  return path;
}

export function resolveBlogPaths(
  input: {
    basePath?: string;
    sitemapPath?: string;
    imageSitemapPath?: string;
    webhookPath?: string;
  } = {},
): ResolvedBlogPaths {
  return {
    basePath: normalizePath(input.basePath ?? "/blog", "basePath"),
    sitemapPath: normalizePath(input.sitemapPath ?? "/blog-sitemap.xml", "sitemapPath"),
    imageSitemapPath: normalizePath(
      input.imageSitemapPath ?? "/blog-image-sitemap.xml",
      "imageSitemapPath",
    ),
    webhookPath: normalizePath(
      input.webhookPath ?? "/api/rankworker/webhook",
      "webhookPath",
    ),
  };
}

export function slugifyTag(tag: string): string {
  const slug = tag
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-");

  return trimBoundaryCharacter(slug, "-");
}

export function articlePath(basePath: string, slug: string): string {
  return `${basePath}/${encodeURIComponent(slug)}`;
}

export function indexPagePath(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}/page/${page}`;
}

export function tagPagePath(basePath: string, tag: string, page = 1): string {
  return tagSlugPagePath(basePath, slugifyTag(tag), page);
}

export function tagSlugPagePath(basePath: string, tagSlug: string, page = 1): string {
  const root = `${basePath}/tag/${tagSlug}`;
  return page === 1 ? root : `${root}/page/${page}`;
}

export function absoluteUrl(siteUrl: string, pathOrUrl: string): string {
  if (URL.canParse(pathOrUrl)) return new URL(pathOrUrl).toString();
  return new URL(
    pathOrUrl.replace(/^\/+/, ""),
    ensureTrailingSlash(siteUrl),
  ).toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
