"use strict";
/**
 * Tool Executor - Routes tool calls to actual implementations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolDefinitions = getToolDefinitions;
exports.executeToolCall = executeToolCall;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Get OpenAI-compatible tool definitions for a list of tool names
 */
function getToolDefinitions(toolNames) {
    const allDefs = {
        read_file: {
            name: "read_file",
            description: "Read the contents of a file. Returns the file content as text.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "The file path to read (relative to workspace root)" },
                },
                required: ["path"],
            },
        },
        list_files: {
            name: "list_files",
            description: "List files and directories in a given path.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Directory path to list" },
                    recursive: { type: "boolean", description: "Whether to list recursively" },
                },
                required: ["path"],
            },
        },
        write_to_file: {
            name: "write_to_file",
            description: "Write content to a file. Creates the file if it doesn't exist.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "The file path to write to" },
                    content: { type: "string", description: "The content to write" },
                },
                required: ["path", "content"],
            },
        },
        replace_in_file: {
            name: "replace_in_file",
            description: "Replace content in a file using SEARCH/REPLACE blocks.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "The file path" },
                    diff: { type: "string", description: "SEARCH/REPLACE diff blocks" },
                },
                required: ["path", "diff"],
            },
        },
        execute_command: {
            name: "execute_command",
            description: "Execute a shell command in the workspace directory.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "The command to execute" },
                },
                required: ["command"],
            },
        },
        search_files: {
            name: "search_files",
            description: "Search for a pattern in files across the workspace.",
            parameters: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "Search pattern (regex)" },
                    path: { type: "string", description: "Directory to search in" },
                },
                required: ["pattern"],
            },
        },
        browse_url: {
            name: "browse_url",
            description: "Open a URL in the browser and take a screenshot.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The URL to browse" },
                },
                required: ["url"],
            },
        },
        ask_followup_question: {
            name: "ask_followup_question",
            description: "Ask the user a question to gather more information.",
            parameters: {
                type: "object",
                properties: {
                    question: { type: "string", description: "The question to ask" },
                },
                required: ["question"],
            },
        },
        attempt_completion: {
            name: "attempt_completion",
            description: "Signal that the task is complete and present the result.",
            parameters: {
                type: "object",
                properties: {
                    result: { type: "string", description: "The completion result" },
                },
                required: ["result"],
            },
        },
    };
    return toolNames.filter((name) => allDefs[name]).map((name) => allDefs[name]);
}
/**
 * Execute a tool call and return the result
 */
async function executeToolCall(toolName, args, provider) {
    const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    try {
        switch (toolName) {
            case "read_file": {
                if (!workspaceDir)
                    return { success: false, output: "", error: "No workspace" };
                const filePath = path.resolve(workspaceDir, args.path);
                const fileIgnore = provider.getFileIgnoreService();
                if (fileIgnore && fileIgnore.checkPath(filePath).ignored) {
                    return { success: false, output: "", error: `File is ignored: ${args.path}` };
                }
                const content = await fs.readFile(filePath, "utf-8");
                return { success: true, output: content };
            }
            case "list_files": {
                if (!workspaceDir)
                    return { success: false, output: "", error: "No workspace" };
                const dirPath = path.resolve(workspaceDir, args.path || ".");
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                const lines = entries.map((e) => {
                    const suffix = e.isDirectory() ? "/" : "";
                    return `${e.name}${suffix}`;
                });
                return { success: true, output: lines.join("\n") };
            }
            case "write_to_file": {
                if (!workspaceDir)
                    return { success: false, output: "", error: "No workspace" };
                const filePath = path.resolve(workspaceDir, args.path);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, args.content, "utf-8");
                // Save checkpoint after file write
                await provider.saveCheckpoint(`write_file: ${args.path}`);
                return { success: true, output: `Successfully wrote to ${args.path}` };
            }
            case "replace_in_file": {
                if (!workspaceDir)
                    return { success: false, output: "", error: "No workspace" };
                const filePath = path.resolve(workspaceDir, args.path);
                let content = await fs.readFile(filePath, "utf-8");
                // Parse SEARCH/REPLACE blocks
                const blocks = parseSearchReplaceBlocks(args.diff);
                if (blocks.length === 0) {
                    return { success: false, output: "", error: "No valid SEARCH/REPLACE blocks found" };
                }
                for (const block of blocks) {
                    const idx = content.indexOf(block.search);
                    if (idx === -1) {
                        return { success: false, output: "", error: `SEARCH content not found in file` };
                    }
                    content = content.slice(0, idx) + block.replace + content.slice(idx + block.search.length);
                }
                await fs.writeFile(filePath, content, "utf-8");
                await provider.saveCheckpoint(`replace_in_file: ${args.path}`);
                return { success: true, output: `Successfully applied ${blocks.length} change(s) to ${args.path}` };
            }
            case "execute_command": {
                const cwd = workspaceDir || process.cwd();
                const { stdout, stderr } = await execAsync(args.command, {
                    cwd,
                    timeout: 30000,
                    maxBuffer: 1024 * 1024,
                });
                const output = [stdout, stderr].filter(Boolean).join("\n");
                return { success: true, output: output || "Command executed (no output)" };
            }
            case "search_files": {
                if (!workspaceDir)
                    return { success: false, output: "", error: "No workspace" };
                const searchPath = path.resolve(workspaceDir, args.path || ".");
                const results = await searchInDirectory(searchPath, args.pattern, provider);
                return { success: true, output: results || "No matches found" };
            }
            case "browse_url": {
                const browser = provider.getBrowserService();
                if (!browser)
                    return { success: false, output: "", error: "Browser service not available" };
                await browser.launch();
                const navResult = await browser.navigate({ url: args.url });
                if (!navResult.success)
                    return { success: false, output: "", error: navResult.error };
                const contentResult = await browser.getContent();
                if (contentResult.success && contentResult.data) {
                    return { success: true, output: contentResult.data.text || "Page loaded" };
                }
                return { success: true, output: "Page loaded" };
            }
            case "ask_followup_question": {
                // Post question to webview - will be handled by user input
                provider.postMessage({ type: "followupQuestion", question: args.question });
                return { success: true, output: "Question asked to user" };
            }
            case "attempt_completion": {
                return { success: true, output: args.result, _completed: true };
            }
            default:
                return { success: false, output: "", error: `Unknown tool: ${toolName}` };
        }
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return { success: false, output: "", error: errMsg };
    }
}
/**
 * Parse SEARCH/REPLACE blocks from diff text
 */
function parseSearchReplaceBlocks(diff) {
    const blocks = [];
    const lines = diff.split("\n");
    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim().startsWith("-------") && lines[i].includes("SEARCH")) {
            const searchLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith("=======")) {
                searchLines.push(lines[i]);
                i++;
            }
            i++; // skip =======
            const replaceLines = [];
            while (i < lines.length && !lines[i].trim().startsWith("+++++++") && !lines[i].includes("REPLACE")) {
                replaceLines.push(lines[i]);
                i++;
            }
            i++; // skip +++++++ REPLACE
            if (searchLines.length > 0) {
                blocks.push({
                    search: searchLines.join("\n"),
                    replace: replaceLines.join("\n"),
                });
            }
        }
        else {
            i++;
        }
    }
    return blocks;
}
/**
 * Simple file search in directory
 */
async function searchInDirectory(dirPath, pattern, provider) {
    const results = [];
    const regex = new RegExp(pattern, "gi");
    const fileIgnore = provider.getFileIgnoreService();
    async function searchDir(currentPath) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist")
                        continue;
                    if (fileIgnore && fileIgnore.checkPath(fullPath, true).ignored)
                        continue;
                    await searchDir(fullPath);
                }
                else {
                    if (fileIgnore && fileIgnore.checkPath(fullPath).ignored)
                        continue;
                    try {
                        const content = await fs.readFile(fullPath, "utf-8");
                        const lines = content.split("\n");
                        for (let i = 0; i < lines.length; i++) {
                            if (regex.test(lines[i])) {
                                const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                                const relPath = workspaceDir ? path.relative(workspaceDir, fullPath) : fullPath;
                                results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                                if (results.length >= 50)
                                    return;
                            }
                        }
                    }
                    catch {
                        // Skip binary files
                    }
                }
            }
        }
        catch {
            // Skip inaccessible directories
        }
    }
    await searchDir(dirPath);
    return results.join("\n");
}
//# sourceMappingURL=tool-executor.js.map