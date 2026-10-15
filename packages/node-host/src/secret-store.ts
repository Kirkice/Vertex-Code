import { chmod } from "node:fs/promises"

import type { SecretStore } from "@vertex/agent-runtime"

import { JsonFileStore } from "./json-store.js"
import { resolveVertexPaths } from "./paths.js"

/**
 * Node 环境下的 SecretStorage 兼容实现。
 *
 * 当前使用用户权限可读的独立 JSON 文件，文件不进入 Profile 和普通配置。
 * 后续可以在不修改调用方的情况下替换为 Windows Credential Manager、
 * macOS Keychain 或 Linux Secret Service 适配器。
 */
export class FileSecretStore implements SecretStore {
  private readonly file: JsonFileStore<Record<string, string>>

  constructor(filePath = resolveVertexPaths().secrets) {
    this.file = new JsonFileStore(filePath, {})
  }

  async get(key: string): Promise<string | undefined> {
    return (await this.file.read())[key]
  }

  async set(key: string, value: string): Promise<void> {
    const secrets = await this.file.read()
    await this.file.write({ ...secrets, [key]: value })
    await this.restrictPermissions()
  }

  async delete(key: string): Promise<void> {
    const secrets = await this.file.read()
    if (!(key in secrets)) return
    delete secrets[key]
    await this.file.write(secrets)
    await this.restrictPermissions()
  }

  async keys(): Promise<readonly string[]> {
    return Object.keys(await this.file.read())
  }

  /**
   * JSON 文件只是跨平台兜底实现，至少应限制为当前用户可读写。
   * Windows 对 chmod 的语义较弱，但调用安全且不会影响其他平台。
   */
  private async restrictPermissions(): Promise<void> {
    try {
      await chmod(this.filePath(), 0o600)
    } catch {
      // 某些虚拟文件系统不支持权限位；不能因此阻断已经成功的写入。
    }
  }

  private filePath(): string {
    return this.file.path()
  }
}
