import { describe, expect, it } from "vitest"

import { createModelProvider } from "./provider-factory.js"

describe("provider factory", () => {
  const profile = {
    id: "profile-1",
    name: "本地模型",
    provider: "ollama",
    baseUrl: "http://localhost:11434/v1/",
    model: "qwen3",
    secretKey: "profile:local",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  }

  it("creates the shared provider adapter for supported OpenAI-compatible vendors", () => {
    expect(createModelProvider(profile, "unused-local-key")).toBeDefined()
  })

  it("rejects vendor labels without a compatible CLI adapter", () => {
    expect(() => createModelProvider({ ...profile, provider: "anthropic" }, "key")).toThrow("尚未支持 Provider")
  })
})
