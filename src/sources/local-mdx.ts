import { readFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import matter from "gray-matter";

import { RankWorkerBlogError, toErrorMessage } from "../core/errors.js";
import { normalizeLocalArticle } from "../core/normalize.js";
import { localFrontmatterSchema } from "../core/schemas.js";
import type { BlogArticle, BlogSource } from "../core/types.js";
import { validateArticleCollection } from "../core/validate.js";

export type LocalMdxSourceOptions = {
  directory: string;
  cwd?: string;
};

/** Creates a memoized build-time source from RankWorker-exported `.md` and `.mdx` files. */
export function createLocalMdxSource(options: LocalMdxSourceOptions): BlogSource {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const directory = path.resolve(cwd, options.directory);

  if (!isWithinDirectory(cwd, directory)) {
    throw new RankWorkerBlogError("The MDX directory must be inside the project.", {
      code: "CONTENT_DIRECTORY_OUTSIDE_PROJECT",
    });
  }

  let articlePromise: Promise<readonly BlogArticle[]> | undefined;

  async function loadArticles(): Promise<readonly BlogArticle[]> {
    const files = await fg(["**/*.md", "**/*.mdx"], {
      cwd: directory,
      absolute: true,
      onlyFiles: true,
      unique: true,
      ignore: ["**/_*", "**/_*/**"],
    });

    const articles = await Promise.all(
      files.toSorted().map(async (filePath) => {
        try {
          const raw = await readFile(filePath, "utf8");
          const parsed = matter(raw);
          const frontmatter = localFrontmatterSchema.parse(parsed.data);
          return normalizeLocalArticle(frontmatter, parsed.content, frontmatter.slug);
        } catch (error) {
          throw new RankWorkerBlogError(
            `Could not load ${path.relative(cwd, filePath)}: ${toErrorMessage(error)}`,
            { code: "INVALID_LOCAL_ARTICLE", cause: error },
          );
        }
      }),
    );

    return validateArticleCollection(articles).toSorted(compareByDateDescending);
  }

  function articles(): Promise<readonly BlogArticle[]> {
    articlePromise ??= loadArticles();
    return articlePromise;
  }

  return {
    kind: "local-mdx",
    listArticles: articles,
    async getArticle(slug) {
      return (await articles()).find((article) => article.slug === slug) ?? null;
    },
  };
}

function compareByDateDescending(first: BlogArticle, second: BlogArticle): number {
  return second.date.getTime() - first.date.getTime();
}

function isWithinDirectory(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
