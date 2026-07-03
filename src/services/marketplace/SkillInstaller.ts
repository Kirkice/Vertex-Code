/**
 * Skill Installer
 *
 * Handles installation and removal of marketplace Skill items.
 * Skills are downloaded from GitHub repositories and placed into
 * the local .roo/skills/ or .roo/skills-{mode}/ directory.
 *
 * @module marketplace/SkillInstaller
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import type { MarketplaceItem, SkillFile } from "@roo-code/types"
import { getGlobalRooDirectory } from "../../services/roo-config"

/**
 * Result from installing a skill.
 */
export interface SkillInstallResult {
	/** Absolute path to the installed skill directory */
	dirPath: string
	/** Number of files downloaded */
	filesDownloaded: number
}

/**
 * Installer for marketplace Skill items.
 *
 * Downloads skill files from GitHub raw URLs and writes them
 * to the appropriate local skills directory.
 */
export class SkillInstaller {
	/**
	 * Install a skill from the marketplace.
	 *
	 * @param item - The marketplace skill item to install
	 * @param target - Whether to install to project or global directory
	 * @returns Installation result with directory path
	 */
	async installSkill(item: MarketplaceItem, target: "project" | "global"): Promise<SkillInstallResult> {
		if (item.type !== "skill") {
			throw new Error(`Expected skill item, got ${item.type}`)
		}

		// Determine the base skills directory
		const skillsDir = await this.getSkillsDirectory(target, item.modeSlugs?.[0])
		const skillDir = path.join(skillsDir, item.id)

		// Create the skill directory
		await fs.mkdir(skillDir, { recursive: true })

		// Download and write each file
		let filesDownloaded = 0
		for (const file of item.files) {
			const rawUrl = this.buildRawUrl(item.source, item.branch ?? "main", item.sourcePath ?? "", file)
			const content = await this.downloadFile(rawUrl)

			const filePath = path.join(skillDir, file.path)
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, content, "utf-8")
			filesDownloaded++
		}

		return { dirPath: skillDir, filesDownloaded }
	}

	/**
	 * Remove an installed skill.
	 *
	 * @param item - The marketplace skill item to remove
	 * @param target - Whether to remove from project or global directory
	 */
	async removeSkill(item: MarketplaceItem, target: "project" | "global"): Promise<void> {
		if (item.type !== "skill") {
			throw new Error(`Expected skill item, got ${item.type}`)
		}

		const skillsDir = await this.getSkillsDirectory(target, item.modeSlugs?.[0])
		const skillDir = path.join(skillsDir, item.id)

		try {
			await fs.rm(skillDir, { recursive: true, force: true })
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				throw error
			}
			// Directory doesn't exist, nothing to remove
		}
	}

	/**
	 * Check if a skill is installed.
	 *
	 * @param item - The marketplace skill item to check
	 * @param target - Whether to check project or global directory
	 * @returns True if the skill directory exists and contains SKILL.md
	 */
	async isInstalled(item: MarketplaceItem, target: "project" | "global"): Promise<boolean> {
		if (item.type !== "skill") {
			return false
		}

		const skillsDir = await this.getSkillsDirectory(target, item.modeSlugs?.[0])
		const skillMdPath = path.join(skillsDir, item.id, "SKILL.md")

		try {
			await fs.access(skillMdPath)
			return true
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
	 * @param sourcePath - Path within the repo to the skill directory
	 * @param file - The skill file descriptor
	 * @returns The raw download URL
	 */
	private buildRawUrl(source: string, branch: string, sourcePath: string, file: SkillFile): string {
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
			throw new Error(`Failed to download skill file: ${url} (HTTP ${response.status})`)
		}
		return response.text()
	}

	/**
	 * Get the target skills directory for installation.
	 *
	 * @param target - Project or global
	 * @param modeSlug - Optional mode slug for mode-specific skills directory
	 * @returns Absolute path to the skills directory
	 */
	private async getSkillsDirectory(target: "project" | "global", modeSlug?: string): Promise<string> {
		if (target === "project") {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				throw new Error("No workspace folder found. Please open a project first.")
			}
			const baseDir = path.join(workspaceFolder.uri.fsPath, ".roo")
			return modeSlug ? path.join(baseDir, `skills-${modeSlug}`) : path.join(baseDir, "skills")
		} else {
			const globalRooDir = getGlobalRooDirectory()
			return modeSlug ? path.join(globalRooDir, `skills-${modeSlug}`) : path.join(globalRooDir, "skills")
		}
	}
}
