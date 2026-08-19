import {
  rooCliErrorCodeSchema,
  rooCliExitCodes,
  type RooCliErrorCode,
} from "@roo-code/types"

export type CliExitCode = (typeof rooCliExitCodes)[keyof typeof rooCliExitCodes]

export class CliCommandError extends Error {
  readonly code: RooCliErrorCode
  readonly exitCode: CliExitCode

  constructor(code: RooCliErrorCode, message: string, exitCode: CliExitCode) {
    super(message)
    this.name = "CliCommandError"
    this.code = rooCliErrorCodeSchema.parse(code)
    this.exitCode = exitCode
  }
}

export class CliFeatureError extends CliCommandError {
  constructor(code: RooCliErrorCode, message: string, exitCode: CliExitCode) {
    super(code, message, exitCode)
    this.name = "CliFeatureError"
  }
}

export function invalidArgument(message: string): never {
  throw new CliCommandError("INVALID_ARGUMENT", message, rooCliExitCodes.CONFIGURATION_ERROR)
}

export function unavailableFeature(command: string): never {
  throw new CliFeatureError(
    "FEATURE_UNAVAILABLE",
    `命令 \`${command}\` 的后端尚未迁移；该 CLI 契约已冻结，后续版本将保持兼容。`,
    rooCliExitCodes.FEATURE_UNAVAILABLE,
  )
}
