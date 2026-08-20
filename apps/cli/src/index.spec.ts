import { rooCliExitCodes } from "@roo-code/types"
import { describe, expect, it } from "vitest"

import { CliCommandError } from "./feature.js"
import { parseArguments } from "./index.js"

describe("CLI argument contract", () => {
  it("accepts --yolo only for task execution", () => {
    expect(parseArguments(["run", "检查项目", "--yolo"])).toMatchObject({
      command: "run",
      prompt: "检查项目",
      yolo: true,
    })

    expect(() => parseArguments(["doctor", "--yolo"])).toThrow(CliCommandError)
    expect(() => parseArguments(["auth", "--yolo"])).toThrow(CliCommandError)
  })

  it("forwards an explicit mode slug only to task execution", () => {
    expect(parseArguments(["run", "检查项目", "--mode", "architect"])).toMatchObject({
      command: "run",
      prompt: "检查项目",
      mode: "architect",
    })
    expect(() => parseArguments(["doctor", "--mode", "architect"])).toThrow("--mode 不适用于 doctor")
  })

  it("maps invalid arguments to the documented error code and exit code", () => {
    try {
      parseArguments(["run", "检查项目", "--output", "yaml"])
      throw new Error("expected parseArguments to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(CliCommandError)
      expect(error).toMatchObject({
        code: "INVALID_ARGUMENT",
        exitCode: rooCliExitCodes.CONFIGURATION_ERROR,
      })
    }
  })

  it("preserves placeholder command names for controlled unavailable backends", () => {
    expect(parseArguments(["mcp", "list"])).toMatchObject({
      command: "mcp",
      prompt: "list",
      yolo: false,
    })
  })
})
