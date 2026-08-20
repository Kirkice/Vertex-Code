import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { DEFAULT_MODES, customModesSettingsSchema, type ModeConfig } from "@roo-code/types"
import { parse } from "yaml"

import type { AgentMode } from "@vertex/agent-runtime"

const toolNamesByGroup: Readonly<Record<string, readonly string[]>> = {
  read: ["read_file", "list_directory", "search_files", "git_status", "git_diff", "read_skill"],
  edit: ["write_file", "edit_file", "search_replace", "apply_patch"],
  command: ["execute_shell", "git_checkpoint", "git_restore", "git_worktree"],
  mcp: ["use_mcp_tool"],
  modes: [],
}

/**
 * 从工作区 .roomodes 加载并校验自定义模式。项目模式与内置模式同名时优先，
 * 使 CLI 与扩展的覆盖语义保持一致，同时不引入 VS Code 宿主依赖。
 */
export async function loadWorkspaceModes(cwd: string): Promise<readonly ModeConfig[]> {
  let content: string
  try {
    content = await readFile(join(cwd, ".roomodes"), "utf8")
  } catch (error) {
    if (isMissingFile(error)) return DEFAULT_MODES
    throw error
  }

  const parsed = customModesSettingsSchema.parse(parse(content))
  const bySlug = new Map(DEFAULT_MODES.map((mode) => [mode.slug, mode]))
  for (const mode of parsed.customModes) bySlug.set(mode.slug, mode)
  return [...bySlug.values()]
}

/** 将共享 ModeConfig 编译为 runtime 可执行的工具 allowlist。 */
export function toAgentMode(mode: ModeConfig, additionalInstructions?: string): AgentMode {
  const allowedTools = new Set<string>()
  for (const entry of mode.groups) {
    const group = Array.isArray(entry) ? entry[0] : entry
    for (const tool of toolNamesByGroup[group] ?? []) allowedTools.add(tool)
  }
  const instructions = [mode.customInstructions, additionalInstructions].filter(Boolean).join("\n\n") || undefined
  return {
    slug: mode.slug,
    name: mode.name,
    roleDefinition: mode.roleDefinition,
    customInstructions: instructions,
    allowedTools: [...allowedTools],
  }
}

export async function resolveWorkspaceMode(
  cwd: string,
  slug: string | undefined,
  additionalInstructions?: string,
): Promise<AgentMode> {
  const modes = await loadWorkspaceModes(cwd)
  const selected = modes.find((mode) => mode.slug === (slug ?? "code"))
  if (!selected) throw new Error(`未找到模式：${slug}`)
  return toAgentMode(selected, additionalInstructions)
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
