import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactElement } from "react";

import {
  articleCanonicalUrl,
  collectTagDefinitions,
  createBlogDefinition,
  type ResolvedBlogDefinition,
} from "./core/blog.js";
import { slugifyTag, tagSlugPagePath } from "./core/paths.js";
import {
  articleJsonLd,
  articleMetadata,
  collectionJsonLd,
  createImageSitemapXml,
  createSitemapXml,
  indexMetadata,
  safeJsonLd,
} from "./core/seo.js";
import type { BlogArticle, DefineBlogConfig } from "./core/types.js";
import { DEFAULT_LABELS, resolveBlogComponents } from "./ui/default-components.js";
import { renderMdx } from "./ui/mdx.js";

export type RankWorkerBlog = ResolvedBlogDefinition & {
  renderIndex(input?: { page?: number; tag?: string }): Promise<ReactElement>;
  renderArticle(slug: string): Promise<ReactElement>;
  generateIndexMetadata(input?: { page?: number; tag?: string }): Promise<Metadata>;
  generateArticleMetadata(slug: string): Promise<Metadata>;
  generateArticleStaticParams(): Promise<{ slug: string }[]>;
  generateIndexStaticParams(): Promise<{ page: string }[]>;
  generateTagStaticParams(): Promise<{ tag: string }[]>;
  generateTagPageStaticParams(): Promise<{ tag: string; page: string }[]>;
  sitemapResponse(): Promise<Response>;
  imageSitemapResponse(): Promise<Response>;
};

export function createBlogApp(input: DefineBlogConfig): RankWorkerBlog {
  const labels = { ...DEFAULT_LABELS, ...input.labels };
  const components = resolveBlogComponents(input.components);
  const definition = createBlogDefinition(input, { labels, components });
  const getUncachedArticles = definition.getArticles.bind(definition);
  const getUncachedArticle = definition.getArticle.bind(definition);
  async function getIndex(input: { page?: number; tag?: string } = {}) {
    const allArticles = await getUncachedArticles();
    return definition.getIndexView(input.page, input.tag, allArticles);
  }

  async function renderIndex(input: { page?: number; tag?: string } = {}) {
    const view = await getIndex(input);
    if (!view) notFound();
    const Layout = components.Layout;
    const Index = components.IndexPage;
    return (
      <Layout>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(collectionJsonLd(definition, view)),
          }}
        />
        <Index view={view} components={components} />
      </Layout>
    );
  }

  async function renderArticle(slug: string) {
    const article = await getUncachedArticle(slug);
    if (!article) notFound();
    const tagSlugs = new Map(
      collectTagDefinitions(await getUncachedArticles()).map((tag) => [
        tag.name,
        tag.slug,
      ]),
    );
    const Layout = components.Layout;
    const Article = components.ArticlePage;
    const content = renderMdx({
      source: article.mdx,
      components: definition.mdxComponents,
      dangerouslyAllowJavaScript: definition.dangerouslyAllowMdxJavaScript,
    });
    const view = {
      article,
      author: definition.site.author,
      content,
      canonicalUrl: articleCanonicalUrl(definition, article.slug),
      indexHref: definition.paths.basePath,
      labels,
      locale: definition.site.locale ?? "en",
      hrefForTag: (tag: string) =>
        tagSlugPagePath(
          definition.paths.basePath,
          tagSlugs.get(tag) ?? slugifyTag(tag),
        ),
    };
    return (
      <Layout>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(articleJsonLd(definition, article)),
          }}
        />
        <Article view={view} components={components} />
      </Layout>
    );
  }

  async function generateIndexMetadata(input: { page?: number; tag?: string } = {}) {
    const view = await getIndex(input);
    if (!view) return { robots: { index: false, follow: false } };
    return indexMetadata(definition, view);
  }

  async function generateArticleMetadata(slug: string) {
    const article = await getUncachedArticle(slug);
    return article
      ? articleMetadata(definition, article)
      : { robots: { index: false, follow: false } };
  }

  async function articles(): Promise<readonly BlogArticle[]> {
    return getUncachedArticles();
  }

  return Object.assign(definition, {
    getArticles: articles,
    getArticle: getUncachedArticle,
    renderIndex,
    renderArticle,
    generateIndexMetadata,
    generateArticleMetadata,
    async generateArticleStaticParams() {
      return (await articles()).map(({ slug }) => ({ slug }));
    },
    async generateIndexStaticParams() {
      const total = Math.ceil((await articles()).length / definition.pageSize);
      return Array.from({ length: Math.max(0, total - 1) }, (_, index) => ({
        page: String(index + 2),
      }));
    },
    async generateTagStaticParams() {
      return collectTagDefinitions(await articles()).map(({ slug: tag }) => ({
        tag,
      }));
    },
    async generateTagPageStaticParams() {
      const all = await articles();
      return collectTagDefinitions(all).flatMap(({ slug: tag, count }) => {
        return Array.from(
          { length: Math.max(0, Math.ceil(count / definition.pageSize) - 1) },
          (_, index) => ({ tag, page: String(index + 2) }),
        );
      });
    },
    async sitemapResponse() {
      return xmlResponse(
        await createSitemapXml({ ...definition, getArticles: articles }),
      );
    },
    async imageSitemapResponse() {
      return xmlResponse(
        await createImageSitemapXml({ ...definition, getArticles: articles }),
      );
    },
  });
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
