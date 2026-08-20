import { describe, expect, it } from "vitest"

import { InMemoryMessageQueue } from "./message-queue.js"

describe("InMemoryMessageQueue", () => {
  it("preserves FIFO order and drains atomically", () => {
    const queue = new InMemoryMessageQueue()
    queue.enqueue({ role: "user", content: "第一条" })
    queue.enqueue({ role: "user", content: "第二条" })

    expect(queue.drain()).toEqual([
      { role: "user", content: "第一条" },
      { role: "user", content: "第二条" },
    ])
    expect(queue.drain()).toEqual([])
  })

  it("copies queued messages so callers cannot mutate queue state", () => {
    const queue = new InMemoryMessageQueue()
    const message = { role: "user" as const, content: "原始内容" }
    queue.enqueue(message)
    message.content = "外部修改"

    expect(queue.drain()).toEqual([{ role: "user", content: "原始内容" }])
  })
})
