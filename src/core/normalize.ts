import { analyzeMdx } from "./analyze.js";
import type { LocalFrontmatter, RankWorkerArticleInput } from "./schemas.js";
import type { BlogArticle, BlogImage } from "./types.js";

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueImages(values: readonly BlogImage[]): readonly BlogImage[] {
  const byUrl = new Map<string, BlogImage>();
  for (const image of values) byUrl.set(image.url, image);
  return [...byUrl.values()];
}

export function normalizeRankWorkerArticle(input: RankWorkerArticleInput): BlogArticle {
  const analysis = analyzeMdx(input.markdownBody);
  const description = input.description ?? input.excerpt ?? input.title;
  const excerpt = input.excerpt ?? input.description ?? input.title;
  return {
    id: input.id,
    title: input.title,
    slug: input.slug,
    date: input.date,
    description,
    excerpt,
    keywords: uniqueStrings(input.keywords),
    tags: uniqueStrings(input.tags),
    cover: input.cover,
    images: uniqueImages([...input.images, ...analysis.images]),
    mdx: input.markdownBody,
    generatedAt: input.generatedAt,
    updatedAt: input.updatedAt,
    headings: analysis.headings,
    readingTime: analysis.readingTime,
    wordCount: analysis.wordCount,
  };
}

export function normalizeLocalArticle(
  frontmatter: LocalFrontmatter,
  mdx: string,
  id = frontmatter.slug,
): BlogArticle {
  const analysis = analyzeMdx(mdx);
  const cover = frontmatter.cover
    ? {
        url: frontmatter.cover,
        title: frontmatter.coverAlt ?? frontmatter.title,
        caption: null,
      }
    : null;

  return {
    id,
    title: frontmatter.title,
    slug: frontmatter.slug,
    date: frontmatter.date,
    description: frontmatter.description,
    excerpt: frontmatter.excerpt,
    keywords: uniqueStrings(frontmatter.keywords),
    tags: uniqueStrings(frontmatter.tags),
    cover,
    images: uniqueImages(analysis.images),
    mdx,
    generatedAt: null,
    updatedAt: null,
    headings: analysis.headings,
    readingTime: analysis.readingTime,
    wordCount: analysis.wordCount,
  };
}
