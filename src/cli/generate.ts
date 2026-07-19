import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import packageMetadata from "../../package.json" with { type: "json" };

import { resolveBlogPaths } from "../core/paths.js";

export type InitOptions = {
  cwd: string;
  appDirectory: string;
  source: "rankworker" | "local-mdx";
  basePath: string;
  siteUrl: string;
  siteName: string;
  contentDirectory?: string;
  force?: boolean;
};

export type GeneratedProject = {
  files: readonly string[];
  skipped: readonly string[];
  nextConfigCreated: boolean;
  nextConfigUpdated: boolean;
  nextConfigNeedsManualWrap: boolean;
};

export async function generateProject(options: InitOptions): Promise<GeneratedProject> {
  const paths = resolveBlogPaths({ basePath: options.basePath });
  const appRoot = path.resolve(options.cwd, options.appDirectory);
  const configPath = path.resolve(options.cwd, "rankworker-blog.ts");
  const files = new Map<string, string>();
  const blogRoot = path.join(appRoot, ...segments(paths.basePath));

  files.set(configPath, configTemplate(options, paths.basePath));
  files.set(path.join(blogRoot, "layout.tsx"), layoutTemplate());
  files.set(
    path.join(blogRoot, "page.tsx"),
    indexTemplate(relativeImport(blogRoot, configPath)),
  );
  files.set(
    path.join(blogRoot, "page", "[page]", "page.tsx"),
    pagedIndexTemplate(
      relativeImport(path.join(blogRoot, "page", "[page]"), configPath),
    ),
  );
  files.set(
    path.join(blogRoot, "tag", "[tag]", "page.tsx"),
    tagTemplate(relativeImport(path.join(blogRoot, "tag", "[tag]"), configPath)),
  );
  files.set(
    path.join(blogRoot, "tag", "[tag]", "page", "[page]", "page.tsx"),
    pagedTagTemplate(
      relativeImport(path.join(blogRoot, "tag", "[tag]", "page", "[page]"), configPath),
    ),
  );
  files.set(
    path.join(blogRoot, "[slug]", "page.tsx"),
    articleTemplate(relativeImport(path.join(blogRoot, "[slug]"), configPath)),
  );
  files.set(
    path.join(appRoot, ...segments(paths.sitemapPath), "route.ts"),
    sitemapTemplate(
      relativeImport(path.join(appRoot, ...segments(paths.sitemapPath)), configPath),
      false,
    ),
  );
  files.set(
    path.join(appRoot, ...segments(paths.imageSitemapPath), "route.ts"),
    sitemapTemplate(
      relativeImport(
        path.join(appRoot, ...segments(paths.imageSitemapPath)),
        configPath,
      ),
      true,
    ),
  );
  if (options.source === "rankworker") {
    files.set(
      path.join(appRoot, ...segments(paths.webhookPath), "route.ts"),
      webhookTemplate(
        relativeImport(path.join(appRoot, ...segments(paths.webhookPath)), configPath),
      ),
    );
  }

  const written: string[] = [];
  const skipped: string[] = [];
  for (const [filePath, content] of files) {
    if (!options.force && (await exists(filePath))) {
      skipped.push(path.relative(options.cwd, filePath));
      continue;
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    written.push(path.relative(options.cwd, filePath));
  }

  let nextConfigCreated = false;
  let nextConfigUpdated = false;
  let nextConfigNeedsManualWrap = false;
  const existingNextConfig = await findNextConfig(options.cwd);
  if (!existingNextConfig) {
    const nextConfigPath = path.join(options.cwd, "next.config.mjs");
    await writeFile(nextConfigPath, nextConfigTemplate(), "utf8");
    written.push("next.config.mjs");
    nextConfigCreated = true;
  } else {
    const nextConfigPath = path.join(options.cwd, existingNextConfig);
    const result = await wrapNextConfig(nextConfigPath);
    nextConfigUpdated = result.updated;
    nextConfigNeedsManualWrap = !result.updated && !result.alreadyWrapped;
    if (result.updated) written.push(existingNextConfig);
  }

  const managedFiles = [...files.keys()];
  if (nextConfigCreated) managedFiles.push(path.join(options.cwd, "next.config.mjs"));
  const manifest = {
    schemaVersion: 1,
    packageVersion: packageMetadata.version,
    source: options.source,
    basePath: paths.basePath,
    files: Object.fromEntries(
      await Promise.all(
        managedFiles.map(
          async (filePath) =>
            [
              path.relative(options.cwd, filePath),
              createHash("sha256")
                .update(await readFile(filePath))
                .digest("hex"),
            ] as const,
        ),
      ),
    ),
  };
  await writeFile(
    path.join(options.cwd, ".rankworker-blog.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    files: written,
    skipped,
    nextConfigCreated,
    nextConfigUpdated,
    nextConfigNeedsManualWrap,
  };
}

export async function detectAppDirectory(cwd: string): Promise<string> {
  if (await exists(path.join(cwd, "src", "app"))) return "src/app";
  if (await exists(path.join(cwd, "app"))) return "app";
  return "src/app";
}

function configTemplate(options: InitOptions, basePath: string): string {
  const source =
    options.source === "rankworker"
      ? `createRankWorkerSource({\n    apiKey: () => process.env.RANKWORKER_DIRECT_API_KEY,\n  })`
      : `createLocalMdxSource({ directory: ${JSON.stringify(options.contentDirectory ?? "content/blog")} })`;
  const webhook =
    options.source === "rankworker"
      ? `,\n  webhook: {\n    secret: () => process.env.RANKWORKER_WEBHOOK_SECRET,\n    warm: "article-and-index",\n  }`
      : "";
  return `import { ${options.source === "rankworker" ? "createRankWorkerSource" : "createLocalMdxSource"}, defineBlog } from "@rankworker/nextjs-blog";\n\nexport const blog = defineBlog({\n  source: ${source},\n  site: {\n    url: ${JSON.stringify(options.siteUrl)},\n    name: ${JSON.stringify(options.siteName)},\n  },\n  paths: { basePath: ${JSON.stringify(basePath)} }${webhook},\n});\n`;
}

function layoutTemplate(): string {
  return `import "@rankworker/nextjs-blog/styles.css";\n\nexport default function BlogLayout({ children }: Readonly<{ children: React.ReactNode }>) {\n  return children;\n}\n`;
}

function indexTemplate(importPath: string): string {
  return `import { blog } from ${JSON.stringify(importPath)};\n\nexport const generateMetadata = () => blog.generateIndexMetadata();\nexport default function BlogPage() { return blog.renderIndex(); }\n`;
}

function pagedIndexTemplate(importPath: string): string {
  return `import { blog } from ${JSON.stringify(importPath)};\n\ntype Props = { params: Promise<{ page: string }> };\nconst pageNumber = (value: string) => Number.parseInt(value, 10);\nexport const generateStaticParams = () => blog.generateIndexStaticParams();\nexport async function generateMetadata({ params }: Props) { return blog.generateIndexMetadata({ page: pageNumber((await params).page) }); }\nexport async function BlogPage({ params }: Props) { return blog.renderIndex({ page: pageNumber((await params).page) }); }\nexport default BlogPage;\n`;
}

function tagTemplate(importPath: string): string {
  return `import { blog } from ${JSON.stringify(importPath)};\n\ntype Props = { params: Promise<{ tag: string }> };\nexport const generateStaticParams = () => blog.generateTagStaticParams();\nexport async function generateMetadata({ params }: Props) { return blog.generateIndexMetadata({ tag: (await params).tag }); }\nexport async function TagPage({ params }: Props) { return blog.renderIndex({ tag: (await params).tag }); }\nexport default TagPage;\n`;
}

function pagedTagTemplate(importPath: string): string {
  return `import { blog } from ${JSON.stringify(importPath)};\n\ntype Props = { params: Promise<{ tag: string; page: string }> };\nexport const generateStaticParams = () => blog.generateTagPageStaticParams();\nexport async function generateMetadata({ params }: Props) { const value = await params; return blog.generateIndexMetadata({ tag: value.tag, page: Number.parseInt(value.page, 10) }); }\nexport async function TagPage({ params }: Props) { const value = await params; return blog.renderIndex({ tag: value.tag, page: Number.parseInt(value.page, 10) }); }\nexport default TagPage;\n`;
}

function articleTemplate(importPath: string): string {
  return `import { blog } from ${JSON.stringify(importPath)};\n\ntype Props = { params: Promise<{ slug: string }> };\nexport const generateStaticParams = () => blog.generateArticleStaticParams();\nexport async function generateMetadata({ params }: Props) { return blog.generateArticleMetadata((await params).slug); }\nexport async function ArticlePage({ params }: Props) { return blog.renderArticle((await params).slug); }\nexport default ArticlePage;\n`;
}

function sitemapTemplate(importPath: string, images: boolean): string {
  return `import { blog } from ${JSON.stringify(importPath)};\n\nexport const GET = () => blog.${images ? "imageSitemapResponse" : "sitemapResponse"}();\n`;
}

function webhookTemplate(importPath: string): string {
  return `import { createNextWebhookHandler } from "@rankworker/nextjs-blog";\nimport { blog } from ${JSON.stringify(importPath)};\n\nexport const POST = createNextWebhookHandler(blog);\n`;
}

function nextConfigTemplate(): string {
  return `import { withRankWorkerBlog } from "@rankworker/nextjs-blog/next-config";\n\nexport default withRankWorkerBlog({});\n`;
}

async function wrapNextConfig(
  configPath: string,
): Promise<{ updated: boolean; alreadyWrapped: boolean }> {
  const source = await readFile(configPath, "utf8");
  if (source.includes("withRankWorkerBlog(")) {
    return { updated: false, alreadyWrapped: true };
  }

  const helper = "withRankWorkerBlog";
  const packagePath = "@rankworker/nextjs-blog/next-config";
  const isCommonJs = configPath.endsWith(".cjs");
  if (isCommonJs) {
    const match = /module\.exports\s*=\s*([\s\S]+);\s*$/.exec(source);
    if (!match?.[1]) return { updated: false, alreadyWrapped: false };
    const expression = match[1];
    await writeFile(
      configPath,
      `const { ${helper} } = require(${JSON.stringify(packagePath)});\n\nmodule.exports = ${helper}(${expression});\n`,
      "utf8",
    );
    return { updated: true, alreadyWrapped: false };
  }

  const identifierExport = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;\s*$/.exec(source);
  if (identifierExport?.[1]) {
    const content = source.replace(
      /export\s+default\s+([A-Za-z_$][\w$]*)\s*;\s*$/,
      `export default ${helper}($1);\n`,
    );
    await writeFile(
      configPath,
      `import { ${helper} } from ${JSON.stringify(packagePath)};\n${content}`,
      "utf8",
    );
    return { updated: true, alreadyWrapped: false };
  }

  const objectExport = /export\s+default\s+(\{[\s\S]*\})\s*;$/.exec(source);
  if (!objectExport?.[1]) return { updated: false, alreadyWrapped: false };
  const content = source.replace(
    /export\s+default\s+(\{[\s\S]*\})\s*;\s*$/,
    `export default ${helper}($1);\n`,
  );
  await writeFile(
    configPath,
    `import { ${helper} } from ${JSON.stringify(packagePath)};\n${content}`,
    "utf8",
  );
  return { updated: true, alreadyWrapped: false };
}

function relativeImport(fromDirectory: string, target: string): string {
  const relative = path
    .relative(fromDirectory, target)
    .replaceAll(path.sep, "/")
    .replace(/\.ts$/, "");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findNextConfig(cwd: string): Promise<string | undefined> {
  for (const name of [
    "next.config.ts",
    "next.config.mjs",
    "next.config.js",
    "next.config.cjs",
  ]) {
    if (await exists(path.join(cwd, name))) return name;
  }
  return undefined;
}
