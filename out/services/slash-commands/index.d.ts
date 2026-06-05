/**
 * SlashCommandsService - Manages custom slash commands
 * Ported from Zoo-Code with VertexAI naming
 */
export interface SlashCommand {
    name: string;
    description: string;
    content: string;
    isCustom: boolean;
}
export declare const DEFAULT_SLASH_COMMANDS: SlashCommand[];
export declare class SlashCommandsService {
    private commands;
    constructor(customCommands?: SlashCommand[]);
    getAllCommands(): SlashCommand[];
    getCustomCommands(): SlashCommand[];
    getDefaultCommands(): SlashCommand[];
    getCommand(name: string): SlashCommand | undefined;
    addCommand(command: Omit<SlashCommand, "isCustom">): void;
    removeCommand(name: string): boolean;
    updateCommand(name: string, updates: Partial<Omit<SlashCommand, "name" | "isCustom">>): boolean;
    parseMessage(message: string): {
        command?: SlashCommand;
        args: string;
    };
    toJSON(): SlashCommand[];
    static fromJSON(data: SlashCommand[]): SlashCommandsService;
}
//# sourceMappingURL=index.d.ts.map