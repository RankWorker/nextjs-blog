import { createBlogApp, type RankWorkerBlog } from "./app-base.js";
import type { DefineBlogConfig } from "./core/types.js";

export type { RankWorkerBlog } from "./app-base.js";

/** Creates an uncached blog facade for Next.js `output: "export"` builds. */
export function defineStaticBlog(input: DefineBlogConfig): RankWorkerBlog {
  return createBlogApp(input);
}
