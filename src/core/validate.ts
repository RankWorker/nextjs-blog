import { RankWorkerBlogError } from "./errors.js";
import { slugifyTag } from "./paths.js";
import type { BlogArticle } from "./types.js";

export function validateArticleCollection(
  articles: readonly BlogArticle[],
): readonly BlogArticle[] {
  const articleSlugs = new Set<string>();
  const articleIds = new Set<string>();

  for (const article of articles) {
    if (articleSlugs.has(article.slug)) {
      throw new RankWorkerBlogError(`Duplicate article slug: ${article.slug}`, {
        code: "DUPLICATE_ARTICLE_SLUG",
      });
    }
    if (articleIds.has(article.id)) {
      throw new RankWorkerBlogError(`Duplicate article id: ${article.id}`, {
        code: "DUPLICATE_ARTICLE_ID",
      });
    }
    articleSlugs.add(article.slug);
    articleIds.add(article.id);

    for (const tag of article.tags) {
      const tagSlug = slugifyTag(tag);
      if (!tagSlug) {
        throw new RankWorkerBlogError(
          `Tag "${tag}" does not contain any URL-safe letters or numbers.`,
          { code: "INVALID_TAG_SLUG" },
        );
      }
    }
  }

  return articles;
}
