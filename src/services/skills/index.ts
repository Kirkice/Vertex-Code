/**
 * SkillsService - Manages skills/capabilities configuration
 * Ported from Zoo-Code with VertexAI naming
 */

export interface Skill {
	name: string
	description: string
	enabled: boolean
	isCustom: boolean
}

export const DEFAULT_SKILLS: Skill[] = [
	{ name: "read_file", description: "Read file contents", enabled: true, isCustom: false },
	{ name: "write_file", description: "Write file contents", enabled: true, isCustom: false },
	{ name: "list_files", description: "List files in directory", enabled: true, isCustom: false },
	{ name: "search_files", description: "Search for patterns in files", enabled: true, isCustom: false },
	{ name: "execute_command", description: "Execute terminal commands", enabled: true, isCustom: false },
	{ name: "browser_action", description: "Browser automation", enabled: true, isCustom: false },
	{ name: "mcp_tool", description: "Use MCP tools", enabled: true, isCustom: false },
]

export class SkillsService {
	private skills: Skill[]

	constructor(customSkills?: Skill[]) {
		this.skills = [...DEFAULT_SKILLS, ...(customSkills || [])]
	}

	getAllSkills(): Skill[] {
		return [...this.skills]
	}

	getEnabledSkills(): Skill[] {
		return this.skills.filter((skill) => skill.enabled)
	}

	getCustomSkills(): Skill[] {
		return this.skills.filter((skill) => skill.isCustom)
	}

	getSkill(name: string): Skill | undefined {
		return this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
	}

	isSkillEnabled(name: string): boolean {
		const skill = this.getSkill(name)
		return skill?.enabled ?? false
	}

	toggleSkill(name: string): boolean {
		const skill = this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
		if (skill) {
			skill.enabled = !skill.enabled
			return skill.enabled
		}
		return false
	}

	enableSkill(name: string): void {
		const skill = this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
		if (skill) {
			skill.enabled = true
		}
	}

	disableSkill(name: string): void {
		const skill = this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
		if (skill) {
			skill.enabled = false
		}
	}

	addSkill(skill: Omit<Skill, "isCustom">): void {
		const existing = this.skills.findIndex(
			(s) => s.name.toLowerCase() === skill.name.toLowerCase(),
		)

		if (existing >= 0) {
			this.skills[existing] = { ...skill, isCustom: true }
		} else {
			this.skills.push({ ...skill, isCustom: true })
		}
	}

	removeSkill(name: string): boolean {
		const index = this.skills.findIndex(
			(s) => s.name.toLowerCase() === name.toLowerCase() && s.isCustom,
		)

		if (index >= 0) {
			this.skills.splice(index, 1)
			return true
		}
		return false
	}

	toJSON(): Skill[] {
		return this.getCustomSkills()
	}

	static fromJSON(data: Skill[]): SkillsService {
		return new SkillsService(data)
	}
}