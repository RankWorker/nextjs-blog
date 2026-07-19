// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAQ } from "../src/ui/faq.js";

const items = [
  { question: "What is RankWorker?", answer: "A content platform." },
  { question: "Can I use local MDX?", answer: "Yes." },
] as const;

describe("FAQ interactions", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/blog/article");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens, switches, and closes answers", () => {
    render(<FAQ items={items} />);

    const firstToggle = screen.getByRole("button", {
      name: "What is RankWorker?",
    });
    fireEvent.click(firstToggle);

    expect(firstToggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen
        .getByText("A content platform.")
        .closest(".rw-blog__faq-answer")
        ?.getAttribute("aria-hidden"),
    ).toBe("false");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Can I use local MDX?",
      }),
    );

    expect(firstToggle.getAttribute("aria-expanded")).toBe("false");
    const secondToggle = screen.getByRole("button", {
      name: "Can I use local MDX?",
    });
    expect(secondToggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(secondToggle);
    expect(secondToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles the whole question row and synchronizes its URL anchor", () => {
    render(<FAQ items={items} />);
    const question = screen.getByRole("button", { name: "What is RankWorker?" });

    fireEvent.click(question);

    expect(
      screen
        .getByRole("button", { name: "What is RankWorker?" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(window.location.hash).toBe("#what-is-rankworker");

    fireEvent.click(question);
    expect(
      screen
        .getByRole("button", { name: "What is RankWorker?" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(window.location.hash).toBe("");
  });

  it("opens a question from its prefix-free URL anchor", () => {
    render(<FAQ items={items} />);

    window.history.replaceState(null, "", "/blog/article#can-i-use-local-mdx");
    fireEvent(window, new HashChangeEvent("hashchange"));

    expect(
      screen
        .getByRole("button", { name: "Can I use local MDX?" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
});
