"use strict";
/**
 * McpServerManager - Singleton wrapper for McpHub
 * Manages MCP server lifecycle and configuration persistence
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
exports.McpServerManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const McpHub_1 = require("./McpHub");
const MCP_CONFIG_FILE = ".vertex/mcp_settings.json";
class McpServerManager {
    constructor(context) {
        this._enabled = true;
        this.extensionContext = context;
        this.mcpHub = new McpHub_1.McpHub();
        this.workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        // Listen for hub events
        this.mcpHub.on("servers-updated", (servers) => {
            // Notify webview of server updates
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance(context) {
        if (!McpServerManager.instance) {
            McpServerManager.instance = new McpServerManager(context);
        }
        return McpServerManager.instance;
    }
    /**
     * Get the McpHub instance
     */
    getHub() {
        return this.mcpHub;
    }
    /**
     * Get all servers
     */
    getServers() {
        return this.mcpHub.getServers();
    }
    /**
     * Enable or disable MCP
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        if (!enabled) {
            this.mcpHub.disconnectAll();
        }
    }
    /**
     * Check if MCP is enabled
     */
    isEnabled() {
        return this._enabled;
    }
    /**
     * Initialize MCP servers from config file
     */
    async initialize() {
        if (!this.workspaceDir) {
            console.log("[McpServerManager] No workspace directory, skipping initialization");
            return;
        }
        // Load config from workspace
        const configs = await this.loadConfig();
        // Connect to each configured server
        for (const config of configs) {
            if (!config.disabled) {
                await this.mcpHub.connectServer(config);
            }
        }
        // Watch for config changes
        this.setupConfigWatcher();
    }
    /**
     * Load MCP server configurations from file
     */
    async loadConfig() {
        if (!this.workspaceDir) {
            return [];
        }
        const configPath = path.join(this.workspaceDir, MCP_CONFIG_FILE);
        try {
            const content = await fs.readFile(configPath, "utf-8");
            const parsed = JSON.parse(content);
            // Support both array format and object format { mcpServers: [...] }
            if (Array.isArray(parsed)) {
                return parsed;
            }
            else if (parsed.mcpServers) {
                return Object.entries(parsed.mcpServers).map(([name, config]) => ({
                    name,
                    ...config,
                }));
            }
            return [];
        }
        catch (error) {
            if (error.code !== "ENOENT") {
                console.error("[McpServerManager] Failed to load config:", error);
            }
            return [];
        }
    }
    /**
     * Save MCP server configurations to file
     */
    async saveConfig(configs) {
        if (!this.workspaceDir) {
            throw new Error("No workspace directory");
        }
        const configPath = path.join(this.workspaceDir, MCP_CONFIG_FILE);
        const configDir = path.dirname(configPath);
        // Ensure directory exists
        await fs.mkdir(configDir, { recursive: true });
        // Convert to object format for better readability
        const mcpServers = {};
        for (const config of configs) {
            const { name, ...rest } = config;
            mcpServers[name] = rest;
        }
        const content = JSON.stringify({ mcpServers }, null, 2);
        await fs.writeFile(configPath, content, "utf-8");
    }
    /**
     * Add a new MCP server
     */
    async addServer(config) {
        const configs = await this.loadConfig();
        // Check if server already exists
        const existing = configs.findIndex((c) => c.name === config.name);
        if (existing >= 0) {
            configs[existing] = config;
        }
        else {
            configs.push(config);
        }
        await this.saveConfig(configs);
        // Connect if not disabled
        if (!config.disabled) {
            await this.mcpHub.connectServer(config);
        }
    }
    /**
     * Remove an MCP server
     */
    async removeServer(name) {
        await this.mcpHub.disconnectServer(name);
        const configs = await this.loadConfig();
        const filtered = configs.filter((c) => c.name !== name);
        await this.saveConfig(filtered);
    }
    /**
     * Update an MCP server configuration
     */
    async updateServer(name, config) {
        const configs = await this.loadConfig();
        const index = configs.findIndex((c) => c.name === name);
        if (index < 0) {
            throw new Error(`Server ${name} not found`);
        }
        configs[index] = { ...configs[index], ...config };
        await this.saveConfig(configs);
        // Restart the server
        await this.mcpHub.restartServer(name);
    }
    /**
     * Restart a specific server
     */
    async restartServer(name) {
        await this.mcpHub.restartServer(name);
    }
    /**
     * Restart all servers
     */
    async restartAll() {
        await this.mcpHub.disconnectAll();
        const configs = await this.loadConfig();
        for (const config of configs) {
            if (!config.disabled) {
                await this.mcpHub.connectServer(config);
            }
        }
    }
    /**
     * Setup file watcher for config changes
     */
    setupConfigWatcher() {
        if (!this.workspaceDir)
            return;
        const pattern = new vscode.RelativePattern(this.workspaceDir, MCP_CONFIG_FILE);
        this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.configWatcher.onDidChange(async () => {
            console.log("[McpServerManager] Config file changed, reloading...");
            await this.restartAll();
        });
        this.configWatcher.onDidCreate(async () => {
            console.log("[McpServerManager] Config file created, loading...");
            await this.restartAll();
        });
        this.configWatcher.onDidDelete(async () => {
            console.log("[McpServerManager] Config file deleted, disconnecting all...");
            await this.mcpHub.disconnectAll();
        });
    }
    /**
     * Cleanup resources
     */
    async dispose() {
        this.configWatcher?.dispose();
        await this.mcpHub.disconnectAll();
    }
}
exports.McpServerManager = McpServerManager;
//# sourceMappingURL=McpServerManager.js.map