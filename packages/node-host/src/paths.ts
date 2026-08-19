import { homedir, platform } from "node:os"
import { join } from "node:path"

/**
 * Vertex 在磁盘上的目录布局。
 *
 * 目录解析集中在这一处，避免各个 Host 模块分别读取 APPDATA、HOME，
 * 从而保证 Windows、macOS 和 Linux 的行为一致，也便于测试时注入环境变量。
 */
export interface VertexPaths {
  root: string
  config: string
  profiles: string
  secrets: string
  sessions: string
  mcp: string
  skills: string
  cache: string
}

export interface PathEnvironment {
  APPDATA?: string
  XDG_CONFIG_HOME?: string
  HOME?: string
  USERPROFILE?: string
}

/** 根据当前平台和环境变量计算 Vertex 的持久化目录。 */
export function resolveVertexPaths(
  environment: PathEnvironment = {
    APPDATA: process.env.APPDATA,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  },
  currentPlatform: NodeJS.Platform = platform(),
): VertexPaths {
  const home = environment.HOME ?? environment.USERPROFILE ?? homedir()
  const base = currentPlatform === "win32"
    ? environment.APPDATA ?? join(home, "AppData", "Roaming")
    : environment.XDG_CONFIG_HOME ?? join(home, ".config")
  const root = join(base, "vertex")

  return {
    root,
    config: join(root, "config.json"),
    profiles: join(root, "profiles.json"),
    secrets: join(root, "secrets.json"),
    sessions: join(root, "sessions"),
    mcp: join(root, "mcp.json"),
    skills: join(root, "skills"),
    cache: join(root, "cache"),
  }
}
