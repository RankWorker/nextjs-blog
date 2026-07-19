<a id="readme-top"></a>

<div align="center">
  <h3 align="center"><em><strong>@rankworker/nextjs-blog</strong></em></h3>

  <p align="center">
    A complete, customizable, SEO-optimized blog layer for Next.js.
    <br />
    <a href="https://github.com/RankWorker/nextjs-blog#usage"><strong>Explore the usage guide »</strong></a>
    <br /><br />
    <a href="https://github.com/RankWorker/nextjs-blog/issues">Report bug</a>
    ·
    <a href="https://github.com/RankWorker/nextjs-blog/issues">Request feature</a>
  </p>

  <p>
    <a href="https://github.com/RankWorker/nextjs-blog/actions/workflows/quality.yml"><img src="https://github.com/RankWorker/nextjs-blog/actions/workflows/quality.yml/badge.svg" alt="Quality" /></a>
    <a href="https://www.npmjs.com/package/@rankworker/nextjs-blog"><img src="https://img.shields.io/npm/v/%40rankworker%2Fnextjs-blog.svg" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@rankworker/nextjs-blog"><img src="https://img.shields.io/npm/dm/%40rankworker%2Fnextjs-blog.svg" alt="npm downloads" /></a>
    <a href="https://github.com/RankWorker/nextjs-blog/blob/main/LICENSE"><img src="https://img.shields.io/github/license/RankWorker/nextjs-blog.svg" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/coverage-%E2%89%A590%25-brightgreen.svg" alt="Coverage threshold: 90%" />
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About the project</a></li>
    <li>
      <a href="#getting-started">Getting started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#local-mdx">Local MDX</a></li>
        <li><a href="#rankworker-api">RankWorker API</a></li>
        <li><a href="#custom-mdx-components">Custom MDX components</a></li>
        <li><a href="#eject-components">Eject components</a></li>
        <li><a href="#custom-styles">Custom styles</a></li>
      </ul>
    </li>
    <li>
      <a href="#contributing">Contributing</a>
      <ul><li><a href="#top-contributors">Top contributors</a></li></ul>
    </li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About the project

`@rankworker/nextjs-blog` gives a Next.js App Router project a complete blog without copying the same routing, pagination, metadata, and sitemap code into every app.

- Paginated index, article, and tag pages
- MDX rendering with frontmatter and reusable presentation components
- Canonical metadata, Open Graph tags, JSON-LD, and blog/image sitemaps
- All presentation components are customizable and can be overridden
- 2 content stores
  - Local MDX - free, no subscription required
  - Managed RankWorker Headless CMS - paid, subscription required

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

### Prerequisites

- Node.js 20.9+
- Next.js 16+ with the App Router
- React 19.2+

### Installation

Run the initializer in an existing Next.js project. It installs the library if it is not already listed in `package.json`, then generates the route adapters and starter configuration:

```bash
npx @rankworker/nextjs-blog init
```

The initializer configures `/blog` by default. It asks for the content source, site URL, site name, and path, and wraps a conventional existing Next config with `withRankWorkerBlog`. Use `--skip-install` to manage the dependency yourself, or `--yes` with explicit flags for non-interactive setup.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

### Local MDX

With local MDX your content lives in the repository.

```bash
npx @rankworker/nextjs-blog init \
  --source local-mdx \
  --site-url https://example.com \
  --site-name "Example" \
  --base-path /blog \
  --yes
```

The generated `rankworker-blog.ts` uses a local source. Adjust the content directory if needed:

```ts
import { createLocalMdxSource, defineBlog } from "@rankworker/nextjs-blog";

export const blog = defineBlog({
  source: createLocalMdxSource({ directory: "content/blog" }),
  site: {
    url: "https://example.com",
    name: "Example",
    author: {
      name: "Example Editorial Team",
      url: "https://example.com/about",
      image: "/authors/editorial-team.jpg",
    },
  },
  labels: {
    indexTitle: "Insights",
    indexDescription: "Practical guides for growing your website.",
  },
});
```

Articles use RankWorker-exported frontmatter and must remain inside the project directory. JavaScript expressions in MDX are blocked by default.

### RankWorker API

Use RankWorker as a headless CMS when content is managed through a RankWorker subscription.

```bash
npx @rankworker/nextjs-blog init \
  --source rankworker \
  --site-url https://example.com \
  --site-name "Example" \
  --base-path /blog \
  --yes
```

Set server-only secrets in `.env.local`:

```dotenv
RANKWORKER_DIRECT_API_KEY=...
RANKWORKER_WEBHOOK_SECRET=...
```

The generated configuration is equivalent to:

```ts
import { createRankWorkerSource, defineBlog } from "@rankworker/nextjs-blog";

export const blog = defineBlog({
  source: createRankWorkerSource({
    apiKey: () => process.env.RANKWORKER_DIRECT_API_KEY,
  }),
  site: { url: "https://example.com", name: "Example" },
  webhook: {
    secret: () => process.env.RANKWORKER_WEBHOOK_SECRET,
    warm: "article-and-index",
  },
});
```

Configure RankWorker to POST article webhooks to `https://example.com/api/rankworker/webhook`. The handler verifies the HMAC signature and lazily invalidates cached RankWorker article data, listings, tags, and sitemaps. The library uses standard Next.js fetch caching and does not require Cache Components.

### MDX security

MDX can contain JavaScript expressions that execute while the consuming Next.js application renders an article on the server. The library blocks those expressions by default for both local and RankWorker API content.

Only enable JavaScript when every author, CMS account, API response, and content-delivery system in the publishing path is trusted to publish server-side code:

```ts
export const blog = defineBlog({
  // source and site
  dangerouslyAllowMdxJavaScript: true,
});
```

This option retains `next-mdx-remote`'s dangerous-operation checks, but those checks are defense in depth and are not a security sandbox. An author or compromised content system may still be able to consume server resources or invoke configured components in unintended ways. Keep content access restricted, rotate compromised credentials immediately, and apply request and execution limits at the hosting layer.

### Custom MDX components

Pass an `mdxComponents` map to render your own React components from article MDX. The same map works with local MDX and the RankWorker API.

```tsx
import { createRankWorkerSource, defineBlog } from "@rankworker/nextjs-blog";
import type { ReactNode } from "react";

function Callout({ children }: { children: ReactNode }) {
  return <aside className="callout">{children}</aside>;
}

function ProductLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="product-link">
      {children} →
    </a>
  );
}

export const blog = defineBlog({
  source: createRankWorkerSource({
    apiKey: () => process.env.RANKWORKER_DIRECT_API_KEY,
  }),
  site: { url: "https://example.com", name: "Example" },
  mdxComponents: { Callout, ProductLink },
});
```

Then use the components in an article:

```mdx
<Callout>Content in a reusable callout.</Callout>

Read our <ProductLink href="/pricing">pricing guide</ProductLink>.
```

`FAQ` is included by default and emits FAQPage JSON-LD. Its `items` array is a JavaScript expression, so enable `dangerouslyAllowMdxJavaScript` only for a fully trusted content pipeline before using it directly in an article:

```mdx
<FAQ
  items={[
    {
      question: "What is RankWorker?",
      answer: "RankWorker is an SEO content platform.",
    },
  ]}
/>
```

### Eject components

Default components stay in the package, so upgrades do not overwrite copied templates. “Eject” only the component you need by passing an override:

```tsx
import type { BlogComponentProps } from "@rankworker/nextjs-blog";
import Link from "next/link";

function ArticleCard({ article, href }: BlogComponentProps["ArticleCard"]) {
  return (
    <article>
      <h2>
        <Link href={href}>{article.title}</Link>
      </h2>
      <p>{article.excerpt}</p>
    </article>
  );
}

export const blog = defineBlog({
  // source and site
  components: { ArticleCard },
});
```

Available components include `Layout`, `IndexPage`, `ArticleCard`, `Pagination`, `ArticlePage`, `ArticleHeader`, `TableOfContents`, and `ArticleBody`.

### Custom styles

The generated blog layout imports the default stylesheet. Override its tokens anywhere after that import:

```css
.rw-blog {
  --rw-bg: #fff;
  --rw-text: #171717;
  --rw-accent: #1d4ed8;
  --rw-radius: 0.5rem;
}
```

Or omit `@rankworker/nextjs-blog/styles.css` and provide a complete design.

The default Next.js configuration helper allows images from `cdn.rankworker.com`. If local MDX or a custom content source references another remote image host, add that host to `images.remotePatterns` in the consuming application's Next.js configuration.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), keep changes scoped, add tests for behavior changes, and include a Changeset for user-visible changes.

### Top contributors

<a href="https://github.com/RankWorker/nextjs-blog/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rankworker/nextjs-blog" alt="Top contributors" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

## Contact

RankWorker - [RankWorker.com](https://rankworker.com)

## Acknowledgments

This project exists thanks to [RankWorker](https://rankworker.com), which delivers high-quality, SEO-optimized content creation on autopilot.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
