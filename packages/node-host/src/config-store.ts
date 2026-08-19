import type { KeyValueStore } from "@vertex/agent-runtime"

import { JsonFileStore } from "./json-store.js"
import { resolveVertexPaths } from "./paths.js"

/** CLI 级别的非敏感配置。密钥等机密值不允许写入此对象。 */
export interface VertexConfig extends Record<string, unknown> {
  currentProfile?: string
  customInstructions?: string
  commandExecutionTimeout?: number
  mcpEnabled?: boolean
  /** 用户显式授予的危险操作 allowlist；仅保存操作名，不保存模型输入。 */
  alwaysAllowOperations?: string[]
}

/**
 * 基于 JSON 文件的全局配置存储。
 *
 * 通过泛型 KeyValueStore 暴露能力，调用方不需要知道配置文件位于何处，
 * 也不会与 Node 的 fs API 形成耦合。
 */
export class ConfigStore implements KeyValueStore<VertexConfig> {
  private readonly file: JsonFileStore<VertexConfig>

  constructor(filePath = resolveVertexPaths().config) {
    this.file = new JsonFileStore(filePath, {})
  }

  get(): Promise<Readonly<VertexConfig>> {
    return this.file.read()
  }

  async set(patch: Partial<VertexConfig>): Promise<Readonly<VertexConfig>> {
    const next = { ...(await this.file.read()), ...patch }
    await this.file.write(next)
    return next
  }

  async replace(value: VertexConfig): Promise<Readonly<VertexConfig>> {
    await this.file.write(value)
    return value
  }
}
