"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { allocateFaqAnchorIds } from "../core/faq.js";

export type FAQItem = {
  question: string;
  answer: string;
};

export type FAQProps = {
  items: readonly FAQItem[];
  headingId?: string;
  questionIds?: readonly string[];
};

export function resolveOpenQuestion(
  current: string | null,
  toggled: string,
  isOpen: boolean,
): string | null {
  if (isOpen) return toggled;
  return current === toggled ? null : current;
}

function replaceUrlHash(id: string | null): void {
  const url = new URL(window.location.href);
  url.hash = id ?? "";
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

/** An accessible single-open FAQ accordion with FAQPage structured data. */
export function FAQ({ items, headingId, questionIds }: FAQProps) {
  const anchorIds = useMemo(
    () =>
      allocateFaqAnchorIds(
        [],
        items.map((item) => item.question),
      ),
    [items],
  );
  const resolvedHeadingId = headingId ?? anchorIds.headingId;
  const resolvedQuestionIds = questionIds ?? anchorIds.questionIds;
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const questionIdSet = useMemo(
    () => new Set(resolvedQuestionIds),
    [resolvedQuestionIds],
  );
  /* v8 ignore start -- browser-only hash and toggle behavior requires a DOM runtime. */
  const openQuestionFromHash = useCallback(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!questionIdSet.has(id)) {
      setOpenQuestion(null);
      return;
    }
    setOpenQuestion(id);
    requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [questionIdSet]);

  useEffect(() => {
    const timer = window.setTimeout(openQuestionFromHash, 0);
    window.addEventListener("hashchange", openQuestionFromHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", openQuestionFromHash);
    };
  }, [openQuestionFromHash]);
  /* v8 ignore stop */

  if (items.length === 0) return null;

  return (
    <section className="rw-blog__faq" aria-labelledby={resolvedHeadingId}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }).replaceAll("<", "\\u003c"),
        }}
      />
      <h2 id={resolvedHeadingId} className="rw-blog__faq-heading">
        <a href={`#${resolvedHeadingId}`}>Frequently Asked Questions</a>
      </h2>
      {items.map((item, index) => {
        const id = resolvedQuestionIds[index] ?? `question-${index + 1}`;
        const answerId = `${id}-answer`;
        const isOpen = openQuestion === id;
        const toggleQuestion = () => {
          /* v8 ignore start -- browser history and scrolling require a DOM runtime. */
          const nextQuestion = resolveOpenQuestion(openQuestion, id, !isOpen);
          setOpenQuestion(nextQuestion);
          replaceUrlHash(nextQuestion);
          if (nextQuestion) {
            requestAnimationFrame(() => {
              document
                .getElementById(id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
          /* v8 ignore stop */
        };
        return (
          <div className="rw-blog__faq-item" data-open={isOpen} key={id}>
            <h3 className="rw-blog__faq-question" id={id}>
              <button
                type="button"
                aria-controls={answerId}
                aria-expanded={isOpen}
                onClick={toggleQuestion}
              >
                <span>{item.question}</span>
                <span className="rw-blog__faq-icon" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div className="rw-blog__faq-answer" id={answerId} aria-hidden={!isOpen}>
              <div className="rw-blog__faq-answer-inner">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
