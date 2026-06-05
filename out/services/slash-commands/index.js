"use strict";
/**
 * SlashCommandsService - Manages custom slash commands
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandsService = exports.DEFAULT_SLASH_COMMANDS = void 0;
exports.DEFAULT_SLASH_COMMANDS = [
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
];
class SlashCommandsService {
    constructor(customCommands) {
        this.commands = [...exports.DEFAULT_SLASH_COMMANDS, ...(customCommands || [])];
    }
    getAllCommands() {
        return [...this.commands];
    }
    getCustomCommands() {
        return this.commands.filter((cmd) => cmd.isCustom);
    }
    getDefaultCommands() {
        return this.commands.filter((cmd) => !cmd.isCustom);
    }
    getCommand(name) {
        const normalizedName = name.startsWith("/") ? name.slice(1) : name;
        return this.commands.find((cmd) => cmd.name.toLowerCase() === normalizedName.toLowerCase());
    }
    addCommand(command) {
        // Check if command already exists
        const existing = this.commands.findIndex((cmd) => cmd.name.toLowerCase() === command.name.toLowerCase());
        if (existing >= 0) {
            this.commands[existing] = { ...command, isCustom: true };
        }
        else {
            this.commands.push({ ...command, isCustom: true });
        }
    }
    removeCommand(name) {
        const normalizedName = name.startsWith("/") ? name.slice(1) : name;
        const index = this.commands.findIndex((cmd) => cmd.name.toLowerCase() === normalizedName.toLowerCase() && cmd.isCustom);
        if (index >= 0) {
            this.commands.splice(index, 1);
            return true;
        }
        return false;
    }
    updateCommand(name, updates) {
        const normalizedName = name.startsWith("/") ? name.slice(1) : name;
        const index = this.commands.findIndex((cmd) => cmd.name.toLowerCase() === normalizedName.toLowerCase() && cmd.isCustom);
        if (index >= 0) {
            this.commands[index] = { ...this.commands[index], ...updates };
            return true;
        }
        return false;
    }
    // Parse a message for slash commands
    parseMessage(message) {
        const trimmed = message.trim();
        if (!trimmed.startsWith("/")) {
            return { args: message };
        }
        const parts = trimmed.split(/\s+/);
        const commandName = parts[0].slice(1);
        const command = this.getCommand(commandName);
        if (command) {
            return {
                command,
                args: parts.slice(1).join(" "),
            };
        }
        return { args: message };
    }
    // Serialize commands for storage
    toJSON() {
        return this.getCustomCommands();
    }
    // Load commands from storage
    static fromJSON(data) {
        return new SlashCommandsService(data);
    }
}
exports.SlashCommandsService = SlashCommandsService;
//# sourceMappingURL=index.js.map