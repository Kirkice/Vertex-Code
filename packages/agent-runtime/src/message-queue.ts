import type { AgentMessage, MessageQueue } from "./contracts.js"

/** FIFO 消息队列；同一 session 内只在模型轮次边界 drain，保证上下文顺序稳定。 */
export class InMemoryMessageQueue implements MessageQueue {
  private readonly messages: AgentMessage[] = []

  enqueue(message: AgentMessage): void {
    this.messages.push({ ...message })
  }

  drain(): readonly AgentMessage[] {
    return this.messages.splice(0).map((message) => ({ ...message }))
  }
}
