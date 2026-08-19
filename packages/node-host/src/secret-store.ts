import { JsonFileStore } from "./json-store.js"
import { resolveVertexPaths } from "./paths.js"

/**
 * Node 环境下的 SecretStorage 兼容实现。
 *
 * 当前使用用户权限可读的独立 JSON 文件，文件不进入 Profile 和普通配置。
 * 后续可以在不修改调用方的情况下替换为 Windows Credential Manager、
 * macOS Keychain 或 Linux Secret Service 适配器。
 */
export class FileSecretStore {
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
  }

  async delete(key: string): Promise<void> {
    const secrets = await this.file.read()
    if (!(key in secrets)) return
    delete secrets[key]
    await this.file.write(secrets)
  }

  async keys(): Promise<readonly string[]> {
    return Object.keys(await this.file.read())
  }
}
