import {
  rooCliFinalOutputSchema,
  rooCliOutputFormatSchema,
  rooCliStreamEventSchema,
  type RooCliFinalOutput,
  type RooCliOutputFormat,
  type RooCliStreamEvent,
} from "@roo-code/types"

export type CliOutputFormat = RooCliOutputFormat
export type CliStreamEvent = RooCliStreamEvent
export type CliFinalOutput = RooCliFinalOutput

export function parseOutputFormat(value: string | undefined): CliOutputFormat {
  return rooCliOutputFormatSchema.parse(value ?? "text")
}

export function validateEvent(event: CliStreamEvent): CliStreamEvent {
  return rooCliStreamEventSchema.parse(event)
}

export function validateFinalOutput(output: CliFinalOutput): CliFinalOutput {
  return rooCliFinalOutputSchema.parse(output)
}
