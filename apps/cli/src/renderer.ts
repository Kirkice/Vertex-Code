import type { CliFinalOutput, CliOutputFormat, CliStreamEvent } from "./protocol.js"

export interface CliRenderer {
  emit(event: CliStreamEvent): void
  finish(output: CliFinalOutput): void
}

export function createRenderer(format: CliOutputFormat, stdout: NodeJS.WritableStream): CliRenderer {
  if (format === "stream-json") {
    return {
      emit(event) {
        stdout.write(`${JSON.stringify(event)}\n`)
      },
      finish() {},
    }
  }

  if (format === "json") {
    return {
      emit() {},
      finish(output) {
        stdout.write(`${JSON.stringify(output)}\n`)
      },
    }
  }

  return {
    emit(event) {
      if (event.content) {
        stdout.write(`${event.content}\n`)
      }
    },
    finish(output) {
      if (!output.success) {
        stdout.write("任务未成功完成。\n")
      }
    },
  }
}
