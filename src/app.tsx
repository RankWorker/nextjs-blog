import { createBlogApp, type RankWorkerBlog } from "./app-base.js";
import type { DefineBlogConfig } from "./core/types.js";

export type { RankWorkerBlog } from "./app-base.js";

/**
 * Creates the App Router blog facade.
 *
 * RankWorker API responses are cached by the source's tagged Next.js fetches.
 * Keeping that caching in the source avoids changing the host application's
 * rendering or Cache Components configuration.
 */
export function defineBlog(input: DefineBlogConfig): RankWorkerBlog {
  return createBlogApp(input);
}
