import { normalizeSiteUrl, positiveInteger } from "./core/blog.js";
import { absoluteUrl, resolveBlogPaths } from "./core/paths.js";
import { createImageSitemapXml, createSitemapXml } from "./core/seo.js";
import type { DefineBlogConfig } from "./core/types.js";
import { validateArticleCollection } from "./core/validate.js";

export {
  createLocalMdxSource,
  type LocalMdxSourceOptions,
} from "./sources/local-mdx.js";

export type StaticBlogConfig = Pick<
  DefineBlogConfig,
  "pagination" | "paths" | "site" | "source"
>;

export type StaticBlogFiles = {
  sitemapXml: string;
  imageSitemapXml: string;
  robotsTxt: string;
};

/**
 * Generates discovery files for a static blog without importing Next.js
 * rendering or caching APIs.
 */
export async function generateStaticBlogFiles(
  input: StaticBlogConfig,
): Promise<StaticBlogFiles> {
  const paths = resolveBlogPaths(input.paths);
  const site = { ...input.site, url: normalizeSiteUrl(input.site.url) };
  const pageSize = positiveInteger(input.pagination?.pageSize ?? 9, "pageSize");
  const definition = {
    site,
    paths,
    pageSize,
    async getArticles() {
      return validateArticleCollection(await input.source.listArticles()).toSorted(
        (first, second) => second.date.getTime() - first.date.getTime(),
      );
    },
  };
  const [sitemapXml, imageSitemapXml] = await Promise.all([
    createSitemapXml(definition),
    createImageSitemapXml(definition),
  ]);

  return {
    sitemapXml,
    imageSitemapXml,
    robotsTxt: [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${absoluteUrl(site.url, paths.sitemapPath)}`,
      `Sitemap: ${absoluteUrl(site.url, paths.imageSitemapPath)}`,
      "",
    ].join("\n"),
  };
}
