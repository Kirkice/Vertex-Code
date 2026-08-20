import { describe, expect, it } from "vitest"

import { createRenderer } from "./renderer.js"

function createWritableStream() {
  let content = ""

  return {
    stream: {
      write(chunk: string) {
        content += chunk
        return true
      },
    } as unknown as NodeJS.WritableStream,
    getContent() {
      return content
    },
  }
}

describe("CLI renderer", () => {
  it("writes exactly one JSON object per stream-json event", () => {
    const output = createWritableStream()
    const renderer = createRenderer("stream-json", output.stream)

    renderer.emit({ type: "assistant", subtype: "delta", content: "第一条" })
    renderer.emit({ type: "result", success: true, done: true, sessionId: "00000000-0000-4000-8000-000000000010" })

    expect(output.getContent().trim().split("\n").map((line) => JSON.parse(line))).toEqual([
      { type: "assistant", subtype: "delta", content: "第一条" },
      { type: "result", success: true, done: true, sessionId: "00000000-0000-4000-8000-000000000010" },
    ])
  })

  it("writes only the final result in json mode", () => {
    const output = createWritableStream()
    const renderer = createRenderer("json", output.stream)

    renderer.emit({ type: "assistant", subtype: "delta", content: "不应输出" })
    renderer.finish({ type: "result", success: true, content: "完成", events: [] })

    expect(JSON.parse(output.getContent())).toMatchObject({ type: "result", success: true, content: "完成" })
  })
})
