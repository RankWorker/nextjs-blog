import { slugifyTag } from "./paths.js";

const FAQ_HEADING_ID = "frequently-asked-questions";

export type FAQAnchorIds = {
  headingId: string;
  questionIds: readonly string[];
};

function faqQuestionId(question: string, index: number): string {
  return slugifyTag(question) || `question-${index + 1}`;
}

export function allocateFaqAnchorIds(
  existingIds: Iterable<string>,
  questions: readonly string[],
): FAQAnchorIds {
  const usedIds = new Set(existingIds);
  const uniqueId = (base: string): string => {
    let candidate = base;
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
  };
  return {
    headingId: uniqueId(FAQ_HEADING_ID),
    questionIds: questions.map((question, index) =>
      uniqueId(faqQuestionId(question, index)),
    ),
  };
}

export function extractFaqQuestions(source: string): readonly string[] {
  const questions: string[] = [];
  const faqMatcher = /<FAQ\b[^>]*\bitems=\{([\s\S]*?)\}\s*\/?>(?:<\/FAQ>)?/g;
  const questionMatcher =
    /(?:["']question["']|\bquestion)\s*:\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

  for (const match of source.matchAll(faqMatcher)) {
    const items = match[1];
    if (!items) continue;
    for (const question of items.matchAll(questionMatcher)) {
      const text = question[2]?.replace(/\\([\\"'`])/g, "$1").trim();
      if (text) questions.push(text);
    }
  }
  return questions;
}
