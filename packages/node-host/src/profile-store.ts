import { randomUUID } from "node:crypto"

import type { ProviderProfile } from "@vertex/agent-runtime"

import { JsonFileStore } from "./json-store.js"
import { resolveVertexPaths } from "./paths.js"

/** Profile 文件只保存非敏感元数据；真正的 API Key 存在 SecretStore。 */
export class ProfileStore {
  private readonly file: JsonFileStore<ProviderProfile[]>

  constructor(filePath = resolveVertexPaths().profiles) {
    this.file = new JsonFileStore(filePath, [])
  }

  list(): Promise<readonly ProviderProfile[]> {
    return this.file.read()
  }

  async get(id: string): Promise<ProviderProfile | undefined> {
    return (await this.file.read()).find((profile) => profile.id === id)
  }

  async upsert(input: Omit<ProviderProfile, "id" | "createdAt" | "updatedAt"> & Partial<Pick<ProviderProfile, "id">>): Promise<ProviderProfile> {
    const profiles = await this.file.read()
    const now = new Date().toISOString()
    const existing = input.id ? profiles.find((profile) => profile.id === input.id) : undefined
    const profile: ProviderProfile = {
      ...input,
      id: existing?.id ?? input.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const next = [...profiles.filter((item) => item.id !== profile.id), profile]
    await this.file.write(next)
    return profile
  }

  async remove(id: string): Promise<boolean> {
    const profiles = await this.file.read()
    const next = profiles.filter((profile) => profile.id !== id)
    if (next.length === profiles.length) return false
    await this.file.write(next)
    return true
  }
}
