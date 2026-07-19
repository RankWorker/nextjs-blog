import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentProps, ComponentPropsWithoutRef, ComponentType } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { FAQ } from "@rankworker/nextjs-blog/faq";

import { analyzeMdx } from "../core/analyze.js";
import { DefaultMdxImage } from "./default-components.js";

const InternalMdxLink = Link as ComponentType<
  ComponentPropsWithoutRef<"a"> & { href: string }
>;

export type RenderMdxOptions = {
  source: string;
  components?: MDXComponents;
  /** Only enable for MDX from fully trusted authors and delivery systems. */
  dangerouslyAllowJavaScript?: boolean;
};

export function DefaultMdxLink({
  href = "",
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("#")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  if (href.startsWith("/")) {
    return (
      <InternalMdxLink href={href} {...props}>
        {children}
      </InternalMdxLink>
    );
  }
  return (
    <a {...props} href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}

export function renderMdx({
  source,
  components = {},
  dangerouslyAllowJavaScript = false,
}: RenderMdxOptions) {
  const faqAnchorIds = analyzeMdx(source).faqAnchorIds;
  const DefaultFAQ = (props: ComponentProps<typeof FAQ>) => (
    <FAQ
      {...props}
      {...(faqAnchorIds
        ? {
            headingId: faqAnchorIds.headingId,
            questionIds: faqAnchorIds.questionIds,
          }
        : {})}
    />
  );
  const defaultComponents: MDXComponents = {
    img: DefaultMdxImage,
    FAQ: DefaultFAQ,
    a: DefaultMdxLink,
  };

  return (
    <MDXRemote
      source={source}
      components={{ ...defaultComponents, ...components }}
      options={{
        blockJS: !dangerouslyAllowJavaScript,
        blockDangerousJS: true,
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
        },
      }}
    />
  );
}
