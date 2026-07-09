/**
 * Knowledge Installer
 *
 * Handles installation and removal of marketplace Knowledge items.
 * Knowledge documents are downloaded from GitHub repositories and placed into
 * the local .roo/knowledge/ directory.
 *
 * @module marketplace/KnowledgeInstaller
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import type { MarketplaceItem, KnowledgeFile } from "@roo-code/types"
import { getGlobalRooDirectory } from "../../services/roo-config"

/**
 * Result from installing a knowledge document.
 */
export interface KnowledgeInstallResult {
	/** Absolute path to the installed knowledge directory */
	dirPath: string
	/** Number of files downloaded */
	filesDownloaded: number
}

/**
 * Installer for marketplace Knowledge items.
 *
 * Downloads knowledge files from GitHub raw URLs and writes them
 * to the appropriate local knowledge directory.
 */
export class KnowledgeInstaller {
	/**
	 * Install a knowledge document from the marketplace.
	 *
	 * @param item - The marketplace knowledge item to install
	 * @param target - Whether to install to project or global directory
	 * @returns Installation result with directory path
	 */
	async installKnowledge(
		item: MarketplaceItem,
		target: "project" | "global",
	): Promise<KnowledgeInstallResult> {
		if (item.type !== "knowledge") {
			throw new Error(`Expected knowledge item, got ${item.type}`)
		}

		// Determine the base knowledge directory
		const knowledgeDir = await this.getKnowledgeDirectory(target)
		const itemDir = path.join(knowledgeDir, item.id)

		// Create the knowledge directory
		await fs.mkdir(itemDir, { recursive: true })

		// Download and write each file
		let filesDownloaded = 0
		for (const file of item.files) {
			const rawUrl = this.buildRawUrl(item.source, item.branch ?? "main", item.sourcePath ?? "", file)
			const content = await this.downloadFile(rawUrl)

			const filePath = path.join(itemDir, file.path)
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, content, "utf-8")
			filesDownloaded++
		}

		return { dirPath: itemDir, filesDownloaded }
	}

	/**
	 * Remove an installed knowledge document.
	 *
	 * @param item - The marketplace knowledge item to remove
	 * @param target - Whether to remove from project or global directory
	 */
	async removeKnowledge(item: MarketplaceItem, target: "project" | "global"): Promise<void> {
		if (item.type !== "knowledge") {
			throw new Error(`Expected knowledge item, got ${item.type}`)
		}

		const knowledgeDir = await this.getKnowledgeDirectory(target)
		const itemDir = path.join(knowledgeDir, item.id)

		try {
			await fs.rm(itemDir, { recursive: true, force: true })
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				throw error
			}
			// Directory doesn't exist, nothing to remove
		}
	}

	/**
	 * Check if a knowledge document is installed.
	 *
	 * @param item - The marketplace knowledge item to check
	 * @param target - Whether to check project or global directory
	 * @returns True if the knowledge directory exists and contains at least one file
	 */
	async isInstalled(item: MarketplaceItem, target: "project" | "global"): Promise<boolean> {
		if (item.type !== "knowledge") {
			return false
		}

		const knowledgeDir = await this.getKnowledgeDirectory(target)
		const itemDir = path.join(knowledgeDir, item.id)

		try {
			const entries = await fs.readdir(itemDir)
			return entries.length > 0
		} catch {
			return false
		}
	}

	/**
	 * Build a GitHub raw content URL from the item's source configuration.
	 *
	 * Converts: https://github.com/user/repo + branch + sourcePath + filePath
	 * Into:     https://raw.githubusercontent.com/user/repo/branch/sourcePath/filePath
	 *
	 * @param source - GitHub repository URL
	 * @param branch - Git branch name
	 * @param sourcePath - Path within the repo to the knowledge directory
	 * @param file - The knowledge file descriptor
	 * @returns The raw download URL
	 */
	private buildRawUrl(source: string, branch: string, sourcePath: string, file: KnowledgeFile): string {
		// If a direct URL is provided, use it
		if (file.url) {
			return file.url
		}

		// Convert GitHub URL to raw content URL
		// https://github.com/user/repo → https://raw.githubusercontent.com/user/repo
		const repoPath = source.replace(/^https?:\/\/github\.com\//, "")
		const prefix = sourcePath ? `${sourcePath}/` : ""
		return `https://raw.githubusercontent.com/${repoPath}/${branch}/${prefix}${file.path}`
	}

	/**
	 * Download a file from a URL.
	 *
	 * @param url - The URL to download from
	 * @returns The file content as a string
	 */
	private async downloadFile(url: string): Promise<string> {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download knowledge file: ${url} (HTTP ${response.status})`)
		}
		return response.text()
	}

	/**
	 * Get the target knowledge directory for installation.
	 *
	 * @param target - Project or global
	 * @returns Absolute path to the knowledge directory
	 */
	private async getKnowledgeDirectory(target: "project" | "global"): Promise<string> {
		if (target === "project") {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				throw new Error("No workspace folder found. Please open a project first.")
			}
			return path.join(workspaceFolder.uri.fsPath, ".roo", "knowledge")
		} else {
			const globalRooDir = getGlobalRooDirectory()
			return path.join(globalRooDir, "knowledge")
		}
	}
}
