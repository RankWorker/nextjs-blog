import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import readingTime from "reading-time";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { allocateFaqAnchorIds, extractFaqQuestions, type FAQAnchorIds } from "./faq.js";
import type { BlogHeading, BlogImage } from "./types.js";

export type ArticleAnalysis = {
  headings: readonly BlogHeading[];
  images: readonly BlogImage[];
  readingTime: string;
  wordCount: number;
  faqAnchorIds: FAQAnchorIds | null;
};

export function analyzeMdx(source: string): ArticleAnalysis {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(source);
  const slugger = new GithubSlugger();
  const headings: BlogHeading[] = [];
  const images: BlogImage[] = [];

  visit(tree, "heading", (node) => {
    if (node.depth < 2 || node.depth > 6) return;
    const text = toString(node).trim();
    if (!text) return;
    headings.push({
      id: slugger.slug(text),
      text,
      level: node.depth as BlogHeading["level"],
    });
  });

  visit(tree, "image", (node) => {
    images.push({
      url: node.url,
      title: node.alt?.trim() || node.title?.trim() || null,
      caption: node.title?.trim() || null,
    });
  });

  const faqQuestions = extractFaqQuestions(source);
  let faqAnchorIds: FAQAnchorIds | null = null;
  if (faqQuestions.length > 0) {
    faqAnchorIds = allocateFaqAnchorIds(
      headings.map((heading) => heading.id),
      faqQuestions,
    );
    headings.push({
      id: faqAnchorIds.headingId,
      text: "Frequently Asked Questions",
      level: 2,
    });
    const questionIds = faqAnchorIds.questionIds;
    headings.push(
      ...faqQuestions.map((question, index) => ({
        id: questionIds[index] ?? `question-${index + 1}`,
        text: question,
        level: 3 as const,
      })),
    );
  }

  const stats = readingTime(source);
  return {
    headings,
    images,
    readingTime: stats.text,
    wordCount: stats.words,
    faqAnchorIds,
  };
}
