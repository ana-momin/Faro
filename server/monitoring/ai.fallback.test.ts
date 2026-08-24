import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("../_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { modelTimeoutMs, suggestCriteria } from "./ai";

describe("suggestCriteria unavailable-model fallback", () => {
  it("uses a short default wait before preserving search progress with the deterministic fallback", () => {
    const previous = process.env.SIGNALFORGE_LLM_TIMEOUT_MS;
    delete process.env.SIGNALFORGE_LLM_TIMEOUT_MS;

    try {
      expect(modelTimeoutMs()).toBe(4_500);
    } finally {
      if (previous === undefined) delete process.env.SIGNALFORGE_LLM_TIMEOUT_MS;
      else process.env.SIGNALFORGE_LLM_TIMEOUT_MS = previous;
    }
  });

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

  it("returns a deterministic suggestion when the built-in model stalls", async () => {
    const previous = process.env.SIGNALFORGE_LLM_TIMEOUT_MS;
    process.env.SIGNALFORGE_LLM_TIMEOUT_MS = "250";
    mocks.invokeLLM.mockImplementationOnce(() => new Promise(() => undefined));

    try {
      const result = await suggestCriteria("People seeking help implementing AI workflow automation");
      expect(result.fallback).toBe(true);
      expect(result.model).toBe("deterministic fallback");
    } finally {
      if (previous === undefined) delete process.env.SIGNALFORGE_LLM_TIMEOUT_MS;
      else process.env.SIGNALFORGE_LLM_TIMEOUT_MS = previous;
    }
  });
});
