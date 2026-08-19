import type { McpServer, SkillMetadata } from "@roo-code/types"

/** MCP Host 的最小运行时端口，具体传输协议由 Node Host 实现。 */
export interface McpHost {
  listServers(): Promise<readonly McpServer[]>
  refresh(): Promise<readonly McpServer[]>
  callTool(server: string, tool: string, input: Record<string, unknown>): Promise<string>
  close(): Promise<void>
}

/** Skills 只向 runtime 暴露元数据和正文读取能力。 */
export interface SkillsHost {
  discover(cwd: string): Promise<readonly SkillMetadata[]>
  read(skill: SkillMetadata): Promise<string>
}

export interface AuthStatus {
  profileId?: string
  configured: boolean
  source: "profile" | "environment" | "none"
}

export interface AuthHost {
  status(profileId?: string): Promise<AuthStatus>
  setApiKey(profileId: string, apiKey: string): Promise<void>
  clear(profileId: string): Promise<void>
}
