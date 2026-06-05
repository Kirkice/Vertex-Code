/**
 * McpServerManager - Singleton wrapper for McpHub
 * Manages MCP server lifecycle and configuration persistence
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

import { McpHub } from "./McpHub"
import type { McpServerConfig, McpServer } from "./types"

const MCP_CONFIG_FILE = ".vertex/mcp_settings.json"

export class McpServerManager {
	private static instance: McpServerManager
	private mcpHub: McpHub
	private extensionContext: vscode.ExtensionContext
	private workspaceDir: string | undefined
	private _enabled: boolean = true
	private configWatcher?: vscode.FileSystemWatcher

	private constructor(context: vscode.ExtensionContext) {
		this.extensionContext = context
		this.mcpHub = new McpHub()
		this.workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

		// Listen for hub events
		this.mcpHub.on("servers-updated", (servers) => {
			// Notify webview of server updates
		})
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(context: vscode.ExtensionContext): McpServerManager {
		if (!McpServerManager.instance) {
			McpServerManager.instance = new McpServerManager(context)
		}
		return McpServerManager.instance
	}

	/**
	 * Get the McpHub instance
	 */
	getHub(): McpHub {
		return this.mcpHub
	}

	/**
	 * Get all servers
	 */
	getServers(): McpServer[] {
		return this.mcpHub.getServers()
	}

	/**
	 * Enable or disable MCP
	 */
	setEnabled(enabled: boolean): void {
		this._enabled = enabled

		if (!enabled) {
			this.mcpHub.disconnectAll()
		}
	}

	/**
	 * Check if MCP is enabled
	 */
	isEnabled(): boolean {
		return this._enabled
	}

	/**
	 * Initialize MCP servers from config file
	 */
	async initialize(): Promise<void> {
		if (!this.workspaceDir) {
			console.log("[McpServerManager] No workspace directory, skipping initialization")
			return
		}

		// Load config from workspace
		const configs = await this.loadConfig()

		// Connect to each configured server
		for (const config of configs) {
			if (!config.disabled) {
				await this.mcpHub.connectServer(config)
			}
		}

		// Watch for config changes
		this.setupConfigWatcher()
	}

	/**
	 * Load MCP server configurations from file
	 */
	async loadConfig(): Promise<McpServerConfig[]> {
		if (!this.workspaceDir) {
			return []
		}

		const configPath = path.join(this.workspaceDir, MCP_CONFIG_FILE)

		try {
			const content = await fs.readFile(configPath, "utf-8")
			const parsed = JSON.parse(content)

			// Support both array format and object format { mcpServers: [...] }
			if (Array.isArray(parsed)) {
				return parsed
			} else if (parsed.mcpServers) {
				return Object.entries(parsed.mcpServers).map(([name, config]: [string, any]) => ({
					name,
					...config,
				}))
			}

			return []
		} catch (error) {
			if ((error as any).code !== "ENOENT") {
				console.error("[McpServerManager] Failed to load config:", error)
			}
			return []
		}
	}

	/**
	 * Save MCP server configurations to file
	 */
	async saveConfig(configs: McpServerConfig[]): Promise<void> {
		if (!this.workspaceDir) {
			throw new Error("No workspace directory")
		}

		const configPath = path.join(this.workspaceDir, MCP_CONFIG_FILE)
		const configDir = path.dirname(configPath)

		// Ensure directory exists
		await fs.mkdir(configDir, { recursive: true })

		// Convert to object format for better readability
		const mcpServers: Record<string, any> = {}

		for (const config of configs) {
			const { name, ...rest } = config
			mcpServers[name] = rest
		}

		const content = JSON.stringify({ mcpServers }, null, 2)
		await fs.writeFile(configPath, content, "utf-8")
	}

	/**
	 * Add a new MCP server
	 */
	async addServer(config: McpServerConfig): Promise<void> {
		const configs = await this.loadConfig()

		// Check if server already exists
		const existing = configs.findIndex((c) => c.name === config.name)

		if (existing >= 0) {
			configs[existing] = config
		} else {
			configs.push(config)
		}

		await this.saveConfig(configs)

		// Connect if not disabled
		if (!config.disabled) {
			await this.mcpHub.connectServer(config)
		}
	}

	/**
	 * Remove an MCP server
	 */
	async removeServer(name: string): Promise<void> {
		await this.mcpHub.disconnectServer(name)

		const configs = await this.loadConfig()
		const filtered = configs.filter((c) => c.name !== name)
		await this.saveConfig(filtered)
	}

	/**
	 * Update an MCP server configuration
	 */
	async updateServer(name: string, config: Partial<McpServerConfig>): Promise<void> {
		const configs = await this.loadConfig()
		const index = configs.findIndex((c) => c.name === name)

		if (index < 0) {
			throw new Error(`Server ${name} not found`)
		}

		configs[index] = { ...configs[index], ...config }
		await this.saveConfig(configs)

		// Restart the server
		await this.mcpHub.restartServer(name)
	}

	/**
	 * Restart a specific server
	 */
	async restartServer(name: string): Promise<void> {
		await this.mcpHub.restartServer(name)
	}

	/**
	 * Restart all servers
	 */
	async restartAll(): Promise<void> {
		await this.mcpHub.disconnectAll()

		const configs = await this.loadConfig()

		for (const config of configs) {
			if (!config.disabled) {
				await this.mcpHub.connectServer(config)
			}
		}
	}

	/**
	 * Setup file watcher for config changes
	 */
	private setupConfigWatcher(): void {
		if (!this.workspaceDir) return

		const pattern = new vscode.RelativePattern(this.workspaceDir, MCP_CONFIG_FILE)
		this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern)

		this.configWatcher.onDidChange(async () => {
			console.log("[McpServerManager] Config file changed, reloading...")
			await this.restartAll()
		})

		this.configWatcher.onDidCreate(async () => {
			console.log("[McpServerManager] Config file created, loading...")
			await this.restartAll()
		})

		this.configWatcher.onDidDelete(async () => {
			console.log("[McpServerManager] Config file deleted, disconnecting all...")
			await this.mcpHub.disconnectAll()
		})
	}

	/**
	 * Cleanup resources
	 */
	async dispose(): Promise<void> {
		this.configWatcher?.dispose()
		await this.mcpHub.disconnectAll()
	}
}