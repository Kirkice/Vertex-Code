import { access, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { SkillsHost } from "@vertex/agent-runtime"
import type { SkillMetadata } from "@roo-code/types"

/**
 * 从项目和用户目录发现 agentskills.io 风格的 SKILL.md。
 * 项目级技能优先于全局技能，同名项目技能会覆盖全局版本。
 */
export class NodeSkillsHost implements SkillsHost {
  async discover(cwd: string): Promise<readonly SkillMetadata[]> {
    const roots = [
      { root: join(cwd, ".roo", "skills"), source: "project" as const },
      { root: join(cwd, ".agents", "skills"), source: "project" as const },
      { root: join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".roo", "skills"), source: "global" as const },
    ]
    const skills = new Map<string, SkillMetadata>()
    for (const item of roots) {
      for (const skill of await readSkillDirectory(item.root, item.source)) skills.set(skill.name, skill)
    }
    return [...skills.values()]
  }

  read(skill: SkillMetadata): Promise<string> {
    return readFile(skill.path, "utf8")
  }
}

async function readSkillDirectory(root: string, source: SkillMetadata["source"]): Promise<SkillMetadata[]> {
  try {
    await access(root)
    const entries = await readdir(root, { withFileTypes: true })
    const result: SkillMetadata[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const path = join(root, entry.name, "SKILL.md")
      try {
        const content = await readFile(path, "utf8")
        result.push({ name: entry.name, description: readDescription(content), path, source })
      } catch {
        // 缺少 SKILL.md 的目录不是有效技能，继续扫描其他目录。
      }
    }
    return result
  } catch {
    return []
  }
}

function readDescription(content: string): string {
  const description = content.match(/^description:\s*(.+)$/im)?.[1]?.trim()
  return description ?? "本地 Vertex 技能。"
}
