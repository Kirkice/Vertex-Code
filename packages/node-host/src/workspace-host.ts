import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"

import type { WorkspaceEntry, WorkspaceHost, WorkspaceRules } from "@vertex/agent-runtime"

/**
 * Node 文件系统工作区适配器。
 *
 * 对 runtime 暴露统一的相对路径协议，并在入口处阻止绝对路径和目录穿越。
 * `.rooignore` 目前按逐行规则读取，复杂 glob 匹配会在搜索能力迁移阶段复用此规则源。
 */
export class NodeWorkspaceHost implements WorkspaceHost {
  constructor(private readonly workspaceRoot: string) {}

  root(): string {
    return resolve(this.workspaceRoot)
  }

  async readText(path: string): Promise<string> {
    return readFile(this.path(path), "utf8")
  }

  async writeText(path: string, content: string): Promise<void> {
    const target = this.path(path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, "utf8")
  }

  async list(path = "."): Promise<readonly WorkspaceEntry[]> {
    const directory = this.path(path)
    const entries = await readdir(directory, { withFileTypes: true })
    return entries.map((entry) => ({
      path: toPortablePath(relative(this.root(), resolve(directory, entry.name))),
      kind: entry.isDirectory() ? "directory" : "file",
    }))
  }

  async loadRules(): Promise<WorkspaceRules> {
    const files: string[] = []
    const ignored: string[] = []
    const ruleFiles = [".rooignore", "AGENTS.md", "CLAUDE.md"]

    for (const file of ruleFiles) {
      try {
        const content = await this.readText(file)
        files.push(file)
        if (file === ".rooignore") {
          ignored.push(...parseRuleLines(content))
        }
      } catch (error) {
        if (!isFileNotFound(error)) throw error
      }
    }

    const content = (await Promise.all(files.filter((file) => file !== ".rooignore").map((file) => this.readText(file)))).join("\n\n")
    return { files, ignored, content }
  }

  private path(requested: string): string {
    if (isAbsolute(requested)) throw new Error("工作区路径必须是相对路径。")
    const root = this.root()
    const target = resolve(root, requested)
    if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
      throw new Error("工作区路径不能离开工作区。")
    }
    return target
  }
}

function parseRuleLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
}

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/")
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
