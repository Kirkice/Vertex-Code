/**
 * MCP File Installer
 *
 * Handles installation and removal of marketplace MCP items that use
 * file download mode (binary MCP servers like .NET applications).
 *
 * Unlike configuration-mode MCPs (npx/docker), file-mode MCPs are
 * downloaded from GitHub repositories and placed into the local
 * .roo/mcps/{id}/ directory, with a configuration entry pointing
 * to the local executable.
 *
 * @module marketplace/McpFileInstaller
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import type { MarketplaceItem, McpFile } from "@roo-code/types"
import { getGlobalRooDirectory } from "../../services/roo-config"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { GlobalFileNames } from "../../shared/globalFileNames"
import type { ExtensionContext } from "vscode"

/**
 * Result from installing a file-based MCP server.
 */
export interface McpFileInstallResult {
	/** Absolute path to the installed MCP directory */
	dirPath: string
	/** Absolute path to the mcp.json config file that was updated */
	configFilePath: string
	/** Line number in the config file where the server was added */
	line?: number
	/** Number of files downloaded */
	filesDownloaded: number
}

/**
 * Installer for marketplace MCP items using file download mode.
 *
 * Downloads MCP server files from GitHub raw URLs and writes them
 * to the appropriate local mcps directory, then generates a configuration
 * entry in mcp.json pointing to the local executable.
 */
export class McpFileInstaller {
	private readonly context: ExtensionContext

	constructor(context?: ExtensionContext) {
		this.context = context as ExtensionContext
	}

	/**
	 * Install a file-based MCP server from the marketplace.
	 *
	 * @param item - The marketplace MCP item to install (must have source + files)
	 * @param target - Whether to install to project or global directory
	 * @returns Installation result with directory path and config file info
	 */
	async installMcpWithFiles(
		item: Extract<MarketplaceItem, { type: "mcp" }>,
		target: "project" | "global",
	): Promise<McpFileInstallResult> {
		if (!item.source || !item.files || item.files.length === 0) {
			throw new Error("MCP item missing source or files for file download mode")
		}

		// Get the target MCP directory
		const mcpDir = await this.getMcpDirectory(target, item.id)

		// Create the MCP directory
		await fs.mkdir(mcpDir, { recursive: true })

		// Download and write each file
		let filesDownloaded = 0
		for (const file of item.files) {
			const rawUrl = this.buildRawUrl(item.source, item.branch ?? "main", item.sourcePath ?? "", file)
			const content = await this.downloadFile(rawUrl, file.path)

			const filePath = path.join(mcpDir, file.path)
			await fs.mkdir(path.dirname(filePath), { recursive: true })

			// Write file - use binary mode for executables and DLLs
			if (this.isBinaryFile(file.path)) {
				await fs.writeFile(filePath, content)
			} else {
				await fs.writeFile(filePath, content, "utf-8")
			}
			filesDownloaded++
		}

		// Generate and write MCP configuration
		const configResult = await this.writeMcpConfig(item, mcpDir, target)

		return {
			dirPath: mcpDir,
			configFilePath: configResult.filePath,
			line: configResult.line,
			filesDownloaded,
		}
	}

	/**
	 * Remove an installed file-based MCP server.
	 *
	 * @param item - The marketplace MCP item to remove
	 * @param target - Whether to remove from project or global directory
	 */
	async removeMcpWithFiles(
		item: Extract<MarketplaceItem, { type: "mcp" }>,
		target: "project" | "global",
	): Promise<void> {
		// Remove the MCP directory
		const mcpDir = await this.getMcpDirectory(target, item.id)
		try {
			await fs.rm(mcpDir, { recursive: true, force: true })
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				throw error
			}
			// Directory doesn't exist, nothing to remove
		}

		// Remove the MCP configuration entry
		await this.removeMcpConfig(item.id, target)
	}

	/**
	 * Check if a file-based MCP server is installed.
	 *
	 * @param item - The marketplace MCP item to check
	 * @param target - Whether to check project or global directory
	 * @returns True if the MCP directory exists and contains the executable
	 */
	async isInstalled(
		item: Extract<MarketplaceItem, { type: "mcp" }>,
		target: "project" | "global",
	): Promise<boolean> {
		if (!item.source || !item.files || item.files.length === 0) {
			return false
		}

		const mcpDir = await this.getMcpDirectory(target, item.id)
		const executablePath = path.join(mcpDir, item.executable || "server.exe")

		try {
			await fs.access(executablePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Build a GitHub raw content URL from the item's source configuration.
	 *
	 * For text files:
	 *   Converts: https://github.com/user/repo + branch + sourcePath + filePath
	 *   Into:     https://raw.githubusercontent.com/user/repo/branch/sourcePath/filePath
	 *
	 * For binary files (LFS tracked):
	 *   Converts: https://github.com/user/repo + branch + sourcePath + filePath
	 *   Into:     https://media.githubusercontent.com/media/user/repo/branch/sourcePath/filePath
	 *
	 * @param source - GitHub repository URL
	 * @param branch - Git branch name
	 * @param sourcePath - Path within the repo to the MCP directory
	 * @param file - The MCP file descriptor
	 * @returns The raw download URL
	 */
	private buildRawUrl(source: string, branch: string, sourcePath: string, file: McpFile): string {
		// If a direct URL is provided, use it
		if (file.url) {
			return file.url
		}

		// Convert GitHub URL to raw content URL
		// https://github.com/user/repo → user/repo
		const repoPath = source.replace(/^https?:\/\/github\.com\//, "")
		const prefix = sourcePath ? `${sourcePath}/` : ""

		// Use raw.githubusercontent.com for all files (works for both text and binary)
		return `https://raw.githubusercontent.com/${repoPath}/${branch}/${prefix}${file.path}`
	}

	/**
	 * Download a file from a URL.
	 *
	 * @param url - The URL to download from
	 * @param filePath - The target file path (used to determine binary vs text)
	 * @returns The file content as Buffer for binary files, string for text files
	 */
	private async downloadFile(url: string, filePath: string): Promise<Buffer | string> {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download MCP file: ${url} (HTTP ${response.status})`)
		}

		// For binary files, return a Buffer
		if (this.isBinaryFile(filePath)) {
			const arrayBuffer = await response.arrayBuffer()
			return Buffer.from(arrayBuffer)
		}

		// For text files, return a string
		return response.text()
	}

	/**
	 * Determine if a file should be treated as binary based on its extension.
	 *
	 * @param filePath - The file path to check
	 * @returns True if the file should be treated as binary
	 */
	private isBinaryFile(filePath: string): boolean {
		const binaryExtensions = [
			".exe",
			".dll",
			".pdb",
			".so",
			".dylib",
			".node",
			".bin",
			".dat",
			".zip",
			".tar",
			".gz",
		]
		const ext = path.extname(filePath).toLowerCase()
		return binaryExtensions.includes(ext)
	}

	/**
	 * Get the target MCP directory for installation.
	 *
	 * @param target - Project or global
	 * @param mcpId - The MCP item ID (used as directory name)
	 * @returns Absolute path to the MCP directory
	 */
	private async getMcpDirectory(target: "project" | "global", mcpId: string): Promise<string> {
		if (target === "project") {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				throw new Error("No workspace folder found. Please open a project first.")
			}
			return path.join(workspaceFolder.uri.fsPath, ".roo", "mcps", mcpId)
		} else {
			const globalRooDir = getGlobalRooDirectory()
			return path.join(globalRooDir, "mcps", mcpId)
		}
	}

	/**
	 * Write the MCP configuration to mcp.json.
	 *
	 * @param item - The MCP item being installed
	 * @param installDir - The directory where files were installed
	 * @param target - Project or global
	 * @returns The config file path and line number
	 */
	private async writeMcpConfig(
		item: Extract<MarketplaceItem, { type: "mcp" }>,
		installDir: string,
		target: "project" | "global",
	): Promise<{ filePath: string; line?: number }> {
		const configPath = await this.getMcpConfigPath(target)

		// Read existing config or create new structure
		let configData: any = { mcpServers: {} }
		try {
			const existing = await fs.readFile(configPath, "utf-8")
			configData = JSON.parse(existing) || { mcpServers: {} }
		} catch (error: any) {
			if (error.code === "ENOENT") {
				// File doesn't exist, use default structure
				configData = { mcpServers: {} }
			} else if (error instanceof SyntaxError) {
				throw new Error(
					`Cannot install MCP server: The mcp.json file contains invalid JSON. ` +
						`Please fix the syntax errors before installing new servers.`,
				)
			} else {
				throw error
			}
		}

		// Ensure mcpServers object exists
		if (!configData.mcpServers) {
			configData.mcpServers = {}
		}

		// Generate the server configuration pointing to the local executable
		const executablePath = path.join(installDir, item.executable || "server.exe")
		const serverConfig = {
			command: executablePath,
			args: [],
			env: {},
		}

		// Add or update the server entry
		const serverName = item.id
		configData.mcpServers[serverName] = serverConfig

		// Write the config file
		await fs.mkdir(path.dirname(configPath), { recursive: true })
		const jsonContent = JSON.stringify(configData, null, 2)
		await fs.writeFile(configPath, jsonContent, "utf-8")

		// Find the line number where the server was added
		let line: number | undefined
		const lines = jsonContent.split("\n")
		const serverLineIndex = lines.findIndex((l) => l.includes(`"${serverName}"`))
		if (serverLineIndex >= 0) {
			line = serverLineIndex + 1
		}

		return { filePath: configPath, line }
	}

	/**
	 * Remove the MCP configuration entry from mcp.json.
	 *
	 * @param mcpId - The MCP item ID to remove
	 * @param target - Project or global
	 */
	private async removeMcpConfig(mcpId: string, target: "project" | "global"): Promise<void> {
		const configPath = await this.getMcpConfigPath(target)

		try {
			const existing = await fs.readFile(configPath, "utf-8")
			const configData = JSON.parse(existing)

			if (configData?.mcpServers && configData.mcpServers[mcpId]) {
				delete configData.mcpServers[mcpId]
				await fs.writeFile(configPath, JSON.stringify(configData, null, 2), "utf-8")
			}
		} catch (error) {
			// File doesn't exist or other error, nothing to remove
		}
	}

	/**
	 * Get the path to the mcp.json configuration file.
	 *
	 * @param target - Project or global
	 * @returns Absolute path to mcp.json
	 */
	private async getMcpConfigPath(target: "project" | "global"): Promise<string> {
		if (target === "project") {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				throw new Error("No workspace folder found")
			}
			return path.join(workspaceFolder.uri.fsPath, ".roo", "mcp.json")
		} else {
			// Use the same path resolution as SimpleInstaller / McpHub to ensure
			// the config is written to the extension's actual global storage path
			// (e.g. globalStorage/vertexorganization.vertex/settings/mcp_settings.json)
			// rather than ~/.roo/settings/ which is a different location.
			if (!this.context) {
				throw new Error("Extension context is required for global MCP config path resolution")
			}
			const globalSettingsPath = await ensureSettingsDirectoryExists(this.context)
			return path.join(globalSettingsPath, GlobalFileNames.mcpSettings)
		}
	}
}
