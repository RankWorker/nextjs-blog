import type { MDXComponents } from "mdx/types";
import type { ComponentType, ReactNode } from "react";

export type BlogImage = {
  url: string;
  title: string | null;
  caption: string | null;
};

export type BlogHeading = {
  id: string;
  text: string;
  level: 2 | 3 | 4 | 5 | 6;
};

export type BlogArticle = {
  id: string;
  title: string;
  slug: string;
  date: Date;
  description: string;
  excerpt: string;
  keywords: readonly string[];
  tags: readonly string[];
  cover: BlogImage | null;
  images: readonly BlogImage[];
  mdx: string;
  generatedAt: Date | null;
  updatedAt: Date | null;
  headings: readonly BlogHeading[];
  readingTime: string;
  wordCount: number;
};

export type BlogArticleSummary = Omit<BlogArticle, "mdx">;

export type BlogPage<T> = {
  items: readonly T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type BlogSource = {
  readonly kind: "local-mdx" | "rankworker" | (string & {});
  listArticles(): Promise<readonly BlogArticle[]>;
  getArticle(slug: string): Promise<BlogArticle | null>;
};

export type BlogSiteConfig = {
  url: string;
  name: string;
  description?: string;
  locale?: string;
  /** The default byline used on every article when article-level authors are not supplied. */
  author?: {
    name: string;
    url?: string;
    image?: string;
  };
  publisher?: {
    name: string;
    type?: "Organization" | "Person";
    url?: string;
    logo?: string;
  };
};

export type BlogPathConfig = {
  basePath?: string;
  sitemapPath?: string;
  imageSitemapPath?: string;
  webhookPath?: string;
};

export type BlogPaginationConfig = {
  pageSize?: number;
  paginationWindow?: number;
};

export type BlogLabels = {
  indexTitle: string;
  indexDescription: string;
  allTopics: string;
  topics: string;
  previous: string;
  next: string;
  readArticle: string;
  noArticles: string;
  tableOfContents: string;
};

export type BlogIndexView = {
  title: string;
  description: string;
  selectedTag: string | null;
  totalArticles: number;
  tags: readonly { name: string; slug: string; count: number; href: string }[];
  page: BlogPage<BlogArticleSummary>;
  labels: BlogLabels;
  allHref: string;
  hrefForArticle: (slug: string) => string;
  hrefForPage: (page: number) => string;
  paginationWindow: number;
  locale: string;
};

export type BlogArticleView = {
  article: BlogArticle;
  author: BlogSiteConfig["author"];
  canonicalUrl: string;
  content: ReactNode;
  indexHref: string;
  labels: BlogLabels;
  locale: string;
  hrefForTag: (tag: string) => string;
};

export type BlogComponentProps = {
  Layout: { children: ReactNode };
  IndexPage: { view: BlogIndexView; components: ResolvedBlogComponents };
  IndexHeader: Pick<BlogIndexView, "title" | "description">;
  TagNavigation: Pick<BlogIndexView, "selectedTag" | "tags"> & {
    allHref: string;
    allCount: number;
    labels: BlogLabels;
  };
  ArticleList: {
    articles: readonly BlogArticleSummary[];
    components: ResolvedBlogComponents;
    hrefForArticle: (slug: string) => string;
    labels: BlogLabels;
    locale: string;
  };
  ArticleCard: {
    article: BlogArticleSummary;
    href: string;
    preloadImage: boolean;
    labels: BlogLabels;
    locale: string;
  };
  Pagination: {
    page: BlogPage<unknown>;
    hrefForPage: (page: number) => string;
    window: number;
    labels: BlogLabels;
  };
  EmptyState: { labels: BlogLabels };
  ArticlePage: { view: BlogArticleView; components: ResolvedBlogComponents };
  ArticleHeader: {
    article: BlogArticle;
    author: BlogSiteConfig["author"];
    labels: BlogLabels;
    indexHref: string;
    locale: string;
    hrefForTag: (tag: string) => string;
  };
  TableOfContents: { headings: readonly BlogHeading[]; labels: BlogLabels };
  ArticleBody: { children: ReactNode };
};

export type BlogComponents = {
  [Key in keyof BlogComponentProps]?: ComponentType<BlogComponentProps[Key]>;
};

export type ResolvedBlogComponents = {
  [Key in keyof BlogComponentProps]: ComponentType<BlogComponentProps[Key]>;
};

export type RankWorkerWebhookConfig = {
  secret: string | (() => string | undefined);
  toleranceSeconds?: number;
  warm?: "none" | "article" | "article-and-index";
  fetch?: typeof globalThis.fetch;
};

export type DefineBlogConfig = {
  source: BlogSource;
  site: BlogSiteConfig;
  paths?: BlogPathConfig;
  pagination?: BlogPaginationConfig;
  labels?: Partial<BlogLabels>;
  components?: BlogComponents;
  /** Component mappings available to article MDX, such as `Callout` or `ProductLink`. */
  mdxComponents?: MDXComponents;
  /**
   * Allows JavaScript expressions in MDX. Only enable this when every content
   * author and content delivery system is trusted to publish server-side code.
   */
  dangerouslyAllowMdxJavaScript?: boolean;
  webhook?: RankWorkerWebhookConfig;
};

export type WebhookInvalidationAdapter = {
  expireCollection(): Promise<void> | void;
  invalidateArticlePath(path: string): Promise<void> | void;
  invalidateListingPaths(paths: readonly string[]): Promise<void> | void;
  schedule(task: () => Promise<void>): void;
};
