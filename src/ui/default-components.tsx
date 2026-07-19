import Image, { type ImageProps } from "next/image";
import Link from "next/link";

import { paginationItems } from "../core/pagination.js";
import type {
  BlogComponentProps,
  BlogComponents,
  ResolvedBlogComponents,
} from "../core/types.js";

function DefaultLayout({ children }: BlogComponentProps["Layout"]) {
  return (
    <main className="rw-blog" data-rw-slot="layout">
      <div className="rw-blog__container">{children}</div>
    </main>
  );
}

function DefaultIndexHeader({ title, description }: BlogComponentProps["IndexHeader"]) {
  return (
    <header className="rw-blog__index-header" data-rw-slot="index-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function DefaultTagNavigation({
  selectedTag,
  tags,
  allHref,
  allCount,
  labels,
}: BlogComponentProps["TagNavigation"]) {
  return (
    <nav className="rw-blog__tags" aria-label={labels.topics} data-rw-slot="tags">
      <span className="rw-blog__tags-label">{labels.topics}</span>
      <Link
        href={allHref}
        className="rw-blog__tag"
        aria-current={selectedTag === null ? "page" : undefined}
      >
        {labels.allTopics} <span>{allCount}</span>
      </Link>
      {tags.map((tag) => (
        <Link
          href={tag.href}
          className="rw-blog__tag"
          aria-current={selectedTag === tag.name ? "page" : undefined}
          key={tag.slug}
        >
          {tag.name} <span>{tag.count}</span>
        </Link>
      ))}
    </nav>
  );
}

function DefaultArticleCard({
  article,
  href,
  preloadImage,
  labels,
  locale,
}: BlogComponentProps["ArticleCard"]) {
  return (
    <article className="rw-blog__card" data-rw-slot="article-card">
      <Link href={href} className="rw-blog__card-link" aria-label={article.title}>
        <div className="rw-blog__card-image">
          {article.cover ? (
            <Image
              src={article.cover.url}
              alt={article.cover.title ?? article.title}
              fill
              preload={preloadImage}
              sizes="(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 33vw"
            />
          ) : (
            <div className="rw-blog__image-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="rw-blog__card-body">
          <div className="rw-blog__meta">
            <time dateTime={article.date.toISOString()}>
              {formatDate(article.date, locale)}
            </time>
            <span aria-hidden="true">·</span>
            <span>{article.readingTime}</span>
          </div>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
          <div className="rw-blog__card-footer">
            <span>{labels.readArticle}</span>
            <span aria-hidden="true">↗</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function DefaultArticleList({
  articles,
  components,
  hrefForArticle,
  labels,
  locale,
}: BlogComponentProps["ArticleList"]) {
  const Card = components.ArticleCard;
  return (
    <div className="rw-blog__grid" data-rw-slot="article-list">
      {articles.map((article, index) => (
        <Card
          key={article.id}
          article={article}
          href={hrefForArticle(article.slug)}
          preloadImage={index === 0}
          labels={labels}
          locale={locale}
        />
      ))}
    </div>
  );
}

function DefaultPagination({
  page,
  hrefForPage,
  window,
  labels,
}: BlogComponentProps["Pagination"]) {
  if (page.totalPages <= 1) return null;

  return (
    <nav
      className="rw-blog__pagination"
      aria-label="Blog pagination"
      data-rw-slot="pagination"
    >
      {page.hasPrevious ? (
        <Link
          href={hrefForPage(page.page - 1)}
          rel="prev"
          className="rw-blog__page rw-blog__page--wide"
        >
          <span aria-hidden="true">←</span> {labels.previous}
        </Link>
      ) : (
        <span className="rw-blog__page rw-blog__page--wide" aria-disabled="true">
          <span aria-hidden="true">←</span> {labels.previous}
        </span>
      )}
      <div className="rw-blog__page-numbers">
        {paginationItems(page.page, page.totalPages, window).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="rw-blog__page rw-blog__page--ellipsis"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={hrefForPage(item)}
              className="rw-blog__page"
              aria-current={item === page.page ? "page" : undefined}
            >
              {item}
            </Link>
          ),
        )}
      </div>
      {page.hasNext ? (
        <Link
          href={hrefForPage(page.page + 1)}
          rel="next"
          className="rw-blog__page rw-blog__page--wide"
        >
          {labels.next} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="rw-blog__page rw-blog__page--wide" aria-disabled="true">
          {labels.next} <span aria-hidden="true">→</span>
        </span>
      )}
    </nav>
  );
}

function DefaultEmptyState({ labels }: BlogComponentProps["EmptyState"]) {
  return (
    <p className="rw-blog__empty" data-rw-slot="empty-state">
      {labels.noArticles}
    </p>
  );
}

function DefaultIndexPage({ view, components }: BlogComponentProps["IndexPage"]) {
  const Header = components.IndexHeader;
  const Tags = components.TagNavigation;
  const List = components.ArticleList;
  const Pagination = components.Pagination;
  const Empty = components.EmptyState;

  return (
    <div className="rw-blog__index" data-rw-slot="index-page">
      <Header title={view.title} description={view.description} />
      <Tags
        selectedTag={view.selectedTag}
        tags={view.tags}
        allHref={view.allHref}
        allCount={view.totalArticles}
        labels={view.labels}
      />
      {view.page.items.length > 0 ? (
        <List
          articles={view.page.items}
          components={components}
          hrefForArticle={view.hrefForArticle}
          labels={view.labels}
          locale={view.locale}
        />
      ) : (
        <Empty labels={view.labels} />
      )}
      <Pagination
        page={view.page}
        hrefForPage={view.hrefForPage}
        window={view.paginationWindow}
        labels={view.labels}
      />
    </div>
  );
}

function DefaultArticleHeader({
  article,
  author,
  labels,
  indexHref,
  locale,
  hrefForTag,
}: BlogComponentProps["ArticleHeader"]) {
  return (
    <header className="rw-blog__article-header" data-rw-slot="article-header">
      <Link href={indexHref} className="rw-blog__back-link">
        ← {labels.indexTitle}
      </Link>
      <div className="rw-blog__meta rw-blog__meta--center">
        {author ? (
          <span className="rw-blog__author">
            {author.image ? (
              <Image
                className="rw-blog__author-avatar"
                src={author.image}
                alt=""
                width={32}
                height={32}
                sizes="32px"
              />
            ) : null}
            <span>{author.name}</span>
          </span>
        ) : null}
        {author ? <span aria-hidden="true">·</span> : null}
        <time dateTime={article.date.toISOString()}>
          {formatDate(article.date, locale)}
        </time>
        <span aria-hidden="true">·</span>
        <span>{article.readingTime}</span>
      </div>
      <h1>{article.title}</h1>
      <p>{article.description}</p>
      {article.tags.length > 0 ? (
        <div className="rw-blog__article-tags">
          {article.tags.map((tag) => (
            <Link href={hrefForTag(tag)} key={tag}>
              {tag}
            </Link>
          ))}
        </div>
      ) : null}
      {article.cover ? (
        <figure className="rw-blog__cover">
          <Image
            src={article.cover.url}
            alt={article.cover.title ?? article.title}
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1152px"
          />
          {article.cover.caption ? (
            <figcaption>{article.cover.caption}</figcaption>
          ) : null}
        </figure>
      ) : null}
    </header>
  );
}

function DefaultTableOfContents({
  headings,
  labels,
}: BlogComponentProps["TableOfContents"]) {
  const visible = headings.filter((heading) => heading.level <= 3);
  if (visible.length === 0) return null;
  return (
    <nav
      className="rw-blog__toc"
      aria-label={labels.tableOfContents}
      data-rw-slot="table-of-contents"
    >
      <p>{labels.tableOfContents}</p>
      <ol>
        {visible.map((heading) => (
          <li key={heading.id} data-level={heading.level}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function DefaultArticleBody({ children }: BlogComponentProps["ArticleBody"]) {
  return (
    <div className="rw-blog__prose" data-rw-slot="article-body">
      {children}
    </div>
  );
}

function DefaultArticlePage({ view, components }: BlogComponentProps["ArticlePage"]) {
  const Header = components.ArticleHeader;
  const Toc = components.TableOfContents;
  const Body = components.ArticleBody;
  return (
    <article className="rw-blog__article" data-rw-slot="article-page">
      <Header
        article={view.article}
        author={view.author}
        labels={view.labels}
        indexHref={view.indexHref}
        locale={view.locale}
        hrefForTag={view.hrefForTag}
      />
      <div className="rw-blog__article-layout">
        <Toc headings={view.article.headings} labels={view.labels} />
        <Body>{view.content}</Body>
      </div>
    </article>
  );
}

export const DEFAULT_LABELS = {
  indexTitle: "Blog",
  indexDescription: "Guides, ideas, and practical perspectives.",
  allTopics: "All",
  topics: "Topics",
  previous: "Previous",
  next: "Next",
  readArticle: "Read article",
  noArticles: "No articles have been published yet.",
  tableOfContents: "In this article",
} as const;

const defaults: ResolvedBlogComponents = {
  Layout: DefaultLayout,
  IndexPage: DefaultIndexPage,
  IndexHeader: DefaultIndexHeader,
  TagNavigation: DefaultTagNavigation,
  ArticleList: DefaultArticleList,
  ArticleCard: DefaultArticleCard,
  Pagination: DefaultPagination,
  EmptyState: DefaultEmptyState,
  ArticlePage: DefaultArticlePage,
  ArticleHeader: DefaultArticleHeader,
  TableOfContents: DefaultTableOfContents,
  ArticleBody: DefaultArticleBody,
};

export function resolveBlogComponents(
  overrides: BlogComponents = {},
): ResolvedBlogComponents {
  return { ...defaults, ...overrides };
}

export const defaultBlogComponents = defaults;

export function DefaultMdxImage({ alt, ...props }: ImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      width={1200}
      height={675}
      sizes="(max-width: 800px) 100vw, 760px"
    />
  );
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale.replaceAll("_", "-"), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
