import { RankWorkerBlogError } from "./errors.js";
import { paginate } from "./pagination.js";
import {
  absoluteUrl,
  articlePath,
  indexPagePath,
  resolveBlogPaths,
  slugifyTag,
  tagSlugPagePath,
  type ResolvedBlogPaths,
} from "./paths.js";
import type {
  BlogArticle,
  BlogArticleSummary,
  BlogIndexView,
  BlogLabels,
  DefineBlogConfig,
  ResolvedBlogComponents,
} from "./types.js";
import { validateArticleCollection } from "./validate.js";

export type ResolvedBlogDefinition = {
  source: DefineBlogConfig["source"];
  site: DefineBlogConfig["site"] & { url: string };
  paths: ResolvedBlogPaths;
  pageSize: number;
  paginationWindow: number;
  labels: BlogLabels;
  components: ResolvedBlogComponents;
  mdxComponents: NonNullable<DefineBlogConfig["mdxComponents"]>;
  dangerouslyAllowMdxJavaScript: boolean;
  webhook: DefineBlogConfig["webhook"];
  getIndexView(
    page?: number,
    tagSlug?: string,
    articles?: readonly BlogArticle[],
  ): Promise<BlogIndexView | null>;
  getArticle(slug: string): Promise<BlogArticle | null>;
  getArticles(): Promise<readonly BlogArticle[]>;
};

type DefinitionDependencies = {
  components: ResolvedBlogComponents;
  labels: BlogLabels;
};

export function createBlogDefinition(
  input: DefineBlogConfig,
  dependencies: DefinitionDependencies,
): ResolvedBlogDefinition {
  const paths = resolveBlogPaths(input.paths);
  const siteUrl = normalizeSiteUrl(input.site.url);
  const pageSize = positiveInteger(input.pagination?.pageSize ?? 9, "pageSize");
  const paginationWindow = positiveInteger(
    input.pagination?.paginationWindow ?? 5,
    "paginationWindow",
  );

  async function getArticles(): Promise<readonly BlogArticle[]> {
    return validateArticleCollection(await input.source.listArticles()).toSorted(
      (first, second) => second.date.getTime() - first.date.getTime(),
    );
  }

  async function getIndexView(
    page = 1,
    requestedTagSlug?: string,
    prefetchedArticles?: readonly BlogArticle[],
  ): Promise<BlogIndexView | null> {
    if (!Number.isSafeInteger(page) || page < 1) return null;

    const articles = prefetchedArticles ?? (await getArticles());
    const tags = collectTagDefinitions(articles);
    const selected = requestedTagSlug
      ? tags.find((tag) => tag.slug === requestedTagSlug)
      : undefined;
    if (requestedTagSlug && !selected) return null;

    const filtered = selected
      ? articles.filter((article) => article.tags.includes(selected.name))
      : articles;
    const result = paginate(filtered.map(toSummary), page, pageSize);
    if (!result) return null;

    return {
      title: selected
        ? `${selected.name} — ${dependencies.labels.indexTitle}`
        : dependencies.labels.indexTitle,
      description: selected
        ? `Articles about ${selected.name}.`
        : dependencies.labels.indexDescription,
      selectedTag: selected?.name ?? null,
      totalArticles: articles.length,
      tags: tags.map((tag) => ({
        ...tag,
        href: tagSlugPagePath(paths.basePath, tag.slug),
      })),
      page: result,
      labels: dependencies.labels,
      allHref: paths.basePath,
      hrefForArticle: (slug) => articlePath(paths.basePath, slug),
      hrefForPage: selected
        ? (targetPage) => tagSlugPagePath(paths.basePath, selected.slug, targetPage)
        : (targetPage) => indexPagePath(paths.basePath, targetPage),
      paginationWindow,
      locale: input.site.locale ?? "en",
    };
  }

  return {
    source: input.source,
    site: { ...input.site, url: siteUrl },
    paths,
    pageSize,
    paginationWindow,
    labels: dependencies.labels,
    components: dependencies.components,
    mdxComponents: input.mdxComponents ?? {},
    dangerouslyAllowMdxJavaScript: input.dangerouslyAllowMdxJavaScript ?? false,
    webhook: input.webhook,
    getIndexView,
    getArticle: (slug) => input.source.getArticle(slug),
    getArticles,
  };
}

export function collectTagDefinitions(articles: readonly BlogArticle[]) {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const name of article.tags) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  const usedSlugs = new Set<string>();
  return [...counts]
    .toSorted(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0))
    .map(([name, count]) => {
      const baseSlug = slugifyTag(name) || "tag";
      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);
      return { name, slug, count };
    });
}

function toSummary(article: BlogArticle): BlogArticleSummary {
  const { mdx: _mdx, ...summary } = article;
  void _mdx;
  return summary;
}

export function normalizeSiteUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!isAllowedWebUrl(url) || url.username || url.password) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new RankWorkerBlogError("site.url must be an absolute HTTPS URL.", {
      code: "INVALID_SITE_URL",
    });
  }
}

function isAllowedWebUrl(url: URL): boolean {
  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]")
  );
}

export function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RankWorkerBlogError(`${name} must be a positive integer.`, {
      code: "INVALID_PAGINATION_CONFIG",
    });
  }
  return value;
}

export function articleCanonicalUrl(
  definition: Pick<ResolvedBlogDefinition, "site" | "paths">,
  slug: string,
): string {
  return absoluteUrl(definition.site.url, articlePath(definition.paths.basePath, slug));
}
