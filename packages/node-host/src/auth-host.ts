import type { AuthHost, AuthStatus } from "@vertex/agent-runtime"

import { ConfigStore } from "./config-store.js"
import { FileSecretStore } from "./secret-store.js"
import { ProfileStore } from "./profile-store.js"

/** 将环境变量、Profile 元数据和 Secret 文件统一为 runtime 的认证端口。 */
export class NodeAuthHost implements AuthHost {
  constructor(
    private readonly profiles = new ProfileStore(),
    private readonly secrets = new FileSecretStore(),
    private readonly config = new ConfigStore(),
  ) {}

  async status(profileId?: string): Promise<AuthStatus> {
    const selected = profileId ?? (await this.config.get()).currentProfile
    if (selected) {
      const profile = await this.profiles.get(selected)
      if (profile && await this.secrets.get(profile.secretKey)) return { profileId: selected, configured: true, source: "profile" }
    }
    if (process.env.VERTEX_API_KEY?.trim()) return { configured: true, source: "environment" }
    return { configured: false, source: "none" }
  }

  async setApiKey(profileId: string, apiKey: string): Promise<void> {
    const profile = await this.profiles.get(profileId)
    if (!profile) throw new Error(`找不到 Provider Profile：${profileId}`)
    await this.secrets.set(profile.secretKey, apiKey)
  }

  async clear(profileId: string): Promise<void> {
    const profile = await this.profiles.get(profileId)
    if (profile) await this.secrets.delete(profile.secretKey)
  }
}
