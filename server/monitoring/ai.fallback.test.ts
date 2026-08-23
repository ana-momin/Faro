import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("../_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { suggestCriteria } from "./ai";

describe("suggestCriteria unavailable-model fallback", () => {
  it("returns a deterministic suggestion when the built-in model throws", async () => {
    const previous = process.env.SIGNALFORGE_DISABLE_LLM;
    delete process.env.SIGNALFORGE_DISABLE_LLM;
    mocks.invokeLLM.mockRejectedValueOnce(new Error("model unavailable"));

    try {
      const result = await suggestCriteria("People looking for help building custom AI workflows");
      expect(result.fallback).toBe(true);
      expect(result.model).toBe("deterministic fallback");
      expect(result.includeTerms.length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.SIGNALFORGE_DISABLE_LLM;
      else process.env.SIGNALFORGE_DISABLE_LLM = previous;
    }
  });
});
