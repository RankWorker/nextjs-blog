import type { Metadata } from "next";

import { collectTagDefinitions, type ResolvedBlogDefinition } from "./blog.js";
import { absoluteUrl, articlePath, indexPagePath, tagSlugPagePath } from "./paths.js";
import type { BlogArticle, BlogIndexView } from "./types.js";

type SitemapBlogDefinition = Pick<
  ResolvedBlogDefinition,
  "getArticles" | "pageSize" | "paths" | "site"
>;

export function indexMetadata(
  blog: ResolvedBlogDefinition,
  view: BlogIndexView,
): Metadata {
  const path = view.hrefForPage(view.page.page);
  const canonical = absoluteUrl(blog.site.url, path);
  const title =
    view.page.page > 1 ? `${view.title} — Page ${view.page.page}` : view.title;
  return {
    title,
    description: view.description,
    alternates: { canonical },
    robots: view.page.page > view.page.totalPages ? { index: false } : undefined,
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description: view.description,
      siteName: blog.site.name,
      locale: blog.site.locale,
    },
    twitter: { card: "summary_large_image", title, description: view.description },
  };
}

export function articleMetadata(
  blog: ResolvedBlogDefinition,
  article: BlogArticle,
): Metadata {
  const canonical = absoluteUrl(
    blog.site.url,
    articlePath(blog.paths.basePath, article.slug),
  );
  const images = article.cover
    ? [{ url: article.cover.url, alt: article.cover.title ?? article.title }]
    : [];
  return {
    title: article.title,
    description: article.description,
    keywords: [...article.keywords],
    authors: blog.site.author
      ? [{ name: blog.site.author.name, url: blog.site.author.url }]
      : undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: article.title,
      description: article.description,
      siteName: blog.site.name,
      publishedTime: article.date.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      tags: [...article.tags],
      authors: blog.site.author ? [blog.site.author.name] : undefined,
      images,
      locale: blog.site.locale,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: images.map((image) => image.url),
    },
  };
}

export function articleJsonLd(blog: ResolvedBlogDefinition, article: BlogArticle) {
  const url = absoluteUrl(
    blog.site.url,
    articlePath(blog.paths.basePath, article.slug),
  );
  const publisher = blog.site.publisher;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: article.date.toISOString(),
    dateModified: (article.updatedAt ?? article.date).toISOString(),
    image: [article.cover, ...article.images]
      .filter(Boolean)
      .map((image) => image?.url),
    keywords: article.keywords.join(", "),
    articleSection: article.tags,
    ...(blog.site.author
      ? {
          author: {
            "@type": "Person",
            name: blog.site.author.name,
            url: blog.site.author.url,
            image: blog.site.author.image,
          },
        }
      : {}),
    ...(publisher
      ? {
          publisher: {
            "@type": publisher.type ?? "Organization",
            name: publisher.name,
            url: publisher.url,
            logo: publisher.logo
              ? { "@type": "ImageObject", url: publisher.logo }
              : undefined,
          },
        }
      : {}),
  };
}

export function collectionJsonLd(blog: ResolvedBlogDefinition, view: BlogIndexView) {
  const url = absoluteUrl(blog.site.url, view.hrefForPage(view.page.page));
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: view.title,
    description: view.description,
    url,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: view.page.totalItems,
      itemListElement: view.page.items.map((article, index) => ({
        "@type": "ListItem",
        position: (view.page.page - 1) * view.page.pageSize + index + 1,
        url: absoluteUrl(blog.site.url, articlePath(blog.paths.basePath, article.slug)),
        name: article.title,
      })),
    },
  };
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export async function createSitemapXml(blog: SitemapBlogDefinition): Promise<string> {
  const articles = await blog.getArticles();
  const tags = collectTagDefinitions(articles);

  const locations: { path: string; lastModified?: Date }[] = [];
  const indexPages = Math.max(1, Math.ceil(articles.length / blog.pageSize));
  for (let page = 1; page <= indexPages; page += 1) {
    locations.push({ path: indexPagePath(blog.paths.basePath, page) });
  }
  for (const tag of tags) {
    for (let page = 1; page <= Math.ceil(tag.count / blog.pageSize); page += 1) {
      locations.push({
        path: tagSlugPagePath(blog.paths.basePath, tag.slug, page),
      });
    }
  }
  for (const article of articles) {
    locations.push({
      path: articlePath(blog.paths.basePath, article.slug),
      lastModified: article.updatedAt ?? article.date,
    });
  }

  return xmlDocument(
    "urlset",
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    locations
      .map(
        ({ path, lastModified }) =>
          `<url><loc>${xmlEscape(absoluteUrl(blog.site.url, path))}</loc>${lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : ""}</url>`,
      )
      .join(""),
  );
}

export async function createImageSitemapXml(
  blog: SitemapBlogDefinition,
): Promise<string> {
  const articles = await blog.getArticles();
  const entries = articles.flatMap((article) => {
    const images = uniqueImages(
      [article.cover, ...article.images].filter((image) => image !== null),
    );
    if (images.length === 0) return [];
    return [
      `<url><loc>${xmlEscape(absoluteUrl(blog.site.url, articlePath(blog.paths.basePath, article.slug)))}</loc>${images
        .map(
          (image) =>
            `<image:image><image:loc>${xmlEscape(image.url)}</image:loc>${image.title ? `<image:title>${xmlEscape(image.title)}</image:title>` : ""}${image.caption ? `<image:caption>${xmlEscape(image.caption)}</image:caption>` : ""}</image:image>`,
        )
        .join("")}</url>`,
    ];
  });
  return xmlDocument(
    "urlset",
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    entries.join(""),
  );
}

function uniqueImages<T extends { url: string }>(images: readonly T[]): readonly T[] {
  return [...new Map(images.map((image) => [image.url, image])).values()];
}

function xmlDocument(root: string, namespaces: string, content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><${root} ${namespaces}>${content}</${root}>`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
