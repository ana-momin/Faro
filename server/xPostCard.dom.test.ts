import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import XPostCard, { isCardSelectionKey } from "../client/src/components/XPostCard";

describe("XPostCard DOM structure", () => {
  it("keeps review buttons outside any outer button element", () => {
    const markup = renderToStaticMarkup(createElement(XPostCard, { post: { id: 1, authorName: "A", authorHandle: "a", body: "I need a provider for workflow automation.", postedAt: new Date(), ruleScore: 88, reviewStatus: "pending" }, onSelect: vi.fn(), onReview: vi.fn() }));
    expect(markup).not.toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*<button/);
    expect(markup).toContain('role="button"');
  });

  it("does not treat keyboard interaction on an inner review control as card selection", () => {
    const card = {} as EventTarget;
    const innerAction = {} as EventTarget;
    expect(isCardSelectionKey({ key: "Enter", target: card, currentTarget: card })).toBe(true);
    expect(isCardSelectionKey({ key: " ", target: innerAction, currentTarget: card })).toBe(false);
  });
});
