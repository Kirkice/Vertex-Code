import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"

import type { WorkspaceSearchHost, WorkspaceSearchOptions, WorkspaceSearchResult } from "@vertex/agent-runtime"

import { NodeWorkspaceHost } from "./workspace-host.js"

/**
 * 纯 Node 文件搜索实现。
 *
 * 这是 ripgrep 不可用时的稳定回退路径：递归遍历普通文件、读取文本并返回行号。
 * 搜索会尊重 `.rooignore` 的基础规则，后续可替换为 ripgrep 加速而不改变端口。
 */
export class NodeFileSearchHost implements WorkspaceSearchHost {
  constructor(private readonly workspace: NodeWorkspaceHost) {}

  async search(query: string, options: WorkspaceSearchOptions = {}): Promise<readonly WorkspaceSearchResult[]> {
    const rules = await this.workspace.loadRules()
    const results: WorkspaceSearchResult[] = []
    const maxResults = options.maxResults ?? 100
    const excluded = new Set([".git", "node_modules", ...rules.ignored, ...(options.exclude ?? [])])
    const includes = options.include ?? []

    await this.walk(".", query, excluded, includes, results, maxResults)
    return results
  }

  private async walk(
    current: string,
    query: string,
    excluded: Set<string>,
    includes: readonly string[],
    results: WorkspaceSearchResult[],
    maxResults: number,
  ): Promise<void> {
    if (results.length >= maxResults) return
    const absolute = this.workspace.root() === current ? current : join(this.workspace.root(), current)
    const entries = await readdir(absolute, { withFileTypes: true })

    for (const entry of entries) {
      if (results.length >= maxResults) return
      const relativePath = normalize(relative(this.workspace.root(), join(absolute, entry.name)))
      if (excluded.has(entry.name) || excluded.has(relativePath)) continue
      if (entry.isDirectory()) {
        await this.walk(relativePath, query, excluded, includes, results, maxResults)
        continue
      }
      if (includes.length > 0 && !includes.some((pattern) => matchesSimplePattern(relativePath, pattern))) continue
      await this.searchFile(relativePath, query, results, maxResults)
    }
  }

  private async searchFile(path: string, query: string, results: WorkspaceSearchResult[], maxResults: number): Promise<void> {
    let content: string
    try {
      content = await readFile(join(this.workspace.root(), path), "utf8")
    } catch {
      return
    }
    const lines = content.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (results.length < maxResults) {
        const column = line.indexOf(query)
        if (column >= 0) results.push({ path, line: index + 1, column: column + 1, preview: line.trim() })
      }
    })
  }
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/")
}

function matchesSimplePattern(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")
  return new RegExp(`^${escaped}$`).test(path)
}
