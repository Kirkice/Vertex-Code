/**
 * SlashCommandsService - Manages custom slash commands
 * Ported from Zoo-Code with VertexAI naming
 */

export interface SlashCommand {
	name: string
	description: string
	content: string
	isCustom: boolean
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
	{
		name: "init",
		description: "Initialize a new project or workspace",
		content: "Please initialize this project. Analyze the codebase structure and provide a summary.",
		isCustom: false,
	},
	{
		name: "help",
		description: "Show available commands and features",
		content: "Show me the available commands and features.",
		isCustom: false,
	},
	{
		name: "test",
		description: "Run tests for the project",
		content: "Run the tests for this project and report the results.",
		isCustom: false,
	},
	{
		name: "review",
		description: "Review the current code changes",
		content: "Review the current code changes and provide feedback.",
		isCustom: false,
	},
	{
		name: "fix",
		description: "Fix issues in the code",
		content: "Identify and fix any issues in the current code.",
		isCustom: false,
	},
	{
		name: "refactor",
		description: "Refactor the code for better quality",
		content: "Refactor this code to improve its quality, readability, and maintainability.",
		isCustom: false,
	},
]

export class SlashCommandsService {
	private commands: SlashCommand[]

	constructor(customCommands?: SlashCommand[]) {
		this.commands = [...DEFAULT_SLASH_COMMANDS, ...(customCommands || [])]
	}

	getAllCommands(): SlashCommand[] {
		return [...this.commands]
	}

	getCustomCommands(): SlashCommand[] {
		return this.commands.filter((cmd) => cmd.isCustom)
	}

	getDefaultCommands(): SlashCommand[] {
		return this.commands.filter((cmd) => !cmd.isCustom)
	}

	getCommand(name: string): SlashCommand | undefined {
		const normalizedName = name.startsWith("/") ? name.slice(1) : name
		return this.commands.find((cmd) => cmd.name.toLowerCase() === normalizedName.toLowerCase())
	}

	addCommand(command: Omit<SlashCommand, "isCustom">): void {
		// Check if command already exists
		const existing = this.commands.findIndex(
			(cmd) => cmd.name.toLowerCase() === command.name.toLowerCase(),
		)

		if (existing >= 0) {
			this.commands[existing] = { ...command, isCustom: true }
		} else {
			this.commands.push({ ...command, isCustom: true })
		}
	}

	removeCommand(name: string): boolean {
		const normalizedName = name.startsWith("/") ? name.slice(1) : name
		const index = this.commands.findIndex(
			(cmd) => cmd.name.toLowerCase() === normalizedName.toLowerCase() && cmd.isCustom,
		)

		if (index >= 0) {
			this.commands.splice(index, 1)
			return true
		}
		return false
	}

	updateCommand(name: string, updates: Partial<Omit<SlashCommand, "name" | "isCustom">>): boolean {
		const normalizedName = name.startsWith("/") ? name.slice(1) : name
		const index = this.commands.findIndex(
			(cmd) => cmd.name.toLowerCase() === normalizedName.toLowerCase() && cmd.isCustom,
		)

		if (index >= 0) {
			this.commands[index] = { ...this.commands[index], ...updates }
			return true
		}
		return false
	}

	// Parse a message for slash commands
	parseMessage(message: string): { command?: SlashCommand; args: string } {
		const trimmed = message.trim()

		if (!trimmed.startsWith("/")) {
			return { args: message }
		}

		const parts = trimmed.split(/\s+/)
		const commandName = parts[0].slice(1)
		const command = this.getCommand(commandName)

		if (command) {
			return {
				command,
				args: parts.slice(1).join(" "),
			}
		}

		return { args: message }
	}

	// Serialize commands for storage
	toJSON(): SlashCommand[] {
		return this.getCustomCommands()
	}

	// Load commands from storage
	static fromJSON(data: SlashCommand[]): SlashCommandsService {
		return new SlashCommandsService(data)
	}
}