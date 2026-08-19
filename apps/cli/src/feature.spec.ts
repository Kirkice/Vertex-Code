import { rooCliExitCodes } from "@roo-code/types"
import { describe, expect, it } from "vitest"

import { CliFeatureError, unavailableFeature } from "./feature.js"

describe("controlled unavailable feature backend", () => {
  it.each(["auth", "config", "mcp", "resume"])("returns a stable unavailable error for %s", (command) => {
    try {
      unavailableFeature(command)
      throw new Error("expected unavailableFeature to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(CliFeatureError)
      expect(error).toMatchObject({
        code: "FEATURE_UNAVAILABLE",
        exitCode: rooCliExitCodes.FEATURE_UNAVAILABLE,
      })
    }
  })
})
