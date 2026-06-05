/**
 * McpServerManager - Singleton wrapper for McpHub
 * Manages MCP server lifecycle and configuration persistence
 */
import * as vscode from "vscode";
import { McpHub } from "./McpHub";
import type { McpServerConfig, McpServer } from "./types";
export declare class McpServerManager {
    private static instance;
    private mcpHub;
    private extensionContext;
    private workspaceDir;
    private _enabled;
    private configWatcher?;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(context: vscode.ExtensionContext): McpServerManager;
    /**
     * Get the McpHub instance
     */
    getHub(): McpHub;
    /**
     * Get all servers
     */
    getServers(): McpServer[];
    /**
     * Enable or disable MCP
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if MCP is enabled
     */
    isEnabled(): boolean;
    /**
     * Initialize MCP servers from config file
     */
    initialize(): Promise<void>;
    /**
     * Load MCP server configurations from file
     */
    loadConfig(): Promise<McpServerConfig[]>;
    /**
     * Save MCP server configurations to file
     */
    saveConfig(configs: McpServerConfig[]): Promise<void>;
    /**
     * Add a new MCP server
     */
    addServer(config: McpServerConfig): Promise<void>;
    /**
     * Remove an MCP server
     */
    removeServer(name: string): Promise<void>;
    /**
     * Update an MCP server configuration
     */
    updateServer(name: string, config: Partial<McpServerConfig>): Promise<void>;
    /**
     * Restart a specific server
     */
    restartServer(name: string): Promise<void>;
    /**
     * Restart all servers
     */
    restartAll(): Promise<void>;
    /**
     * Setup file watcher for config changes
     */
    private setupConfigWatcher;
    /**
     * Cleanup resources
     */
    dispose(): Promise<void>;
}
//# sourceMappingURL=McpServerManager.d.ts.map