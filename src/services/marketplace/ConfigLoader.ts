import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { z } from "zod"

import {
	type MarketplaceItem,
	type MarketplaceItemType,
	modeMarketplaceItemSchema,
	mcpMarketplaceItemSchema,
} from "@roo-code/types"

const modeMarketplaceResponse = z.object({
	items: z.array(modeMarketplaceItemSchema),
})

const mcpMarketplaceResponse = z.object({
	items: z.array(mcpMarketplaceItemSchema),
})

export class ConfigLoader {
	private readonly marketplacePaths: string[]

	constructor(extensionPath: string) {
		this.marketplacePaths = this.createMarketplacePaths(extensionPath)
	}

	async loadAllItems(): Promise<MarketplaceItem[]> {
		const [modes, mcps] = await Promise.all([this.fetchModes(), this.fetchMcps()])
		return [...modes, ...mcps]
	}

	private async fetchModes(): Promise<MarketplaceItem[]> {
		const data = await this.readMarketplaceFile("modes.yml")

		const yamlData = yaml.parse(data)
		const validated = modeMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mode" as const,
			...item,
		}))

		return items
	}

	private async fetchMcps(): Promise<MarketplaceItem[]> {
		const data = await this.readMarketplaceFile("mcps.yml")

		const yamlData = yaml.parse(data)
		const validated = mcpMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mcp" as const,
			...item,
		}))

		return items
	}

	private async readMarketplaceFile(fileName: string): Promise<string> {
		const attemptedPaths = this.marketplacePaths.map((basePath) => path.join(basePath, fileName))
		let lastError: unknown

		for (const filePath of attemptedPaths) {
			try {
				return await fs.readFile(filePath, "utf-8")
			} catch (error) {
				lastError = error
			}
		}

		const errorMessage = lastError instanceof Error ? lastError.message : String(lastError)
		throw new Error(
			`Failed to read marketplace file '${fileName}'. Tried: ${attemptedPaths.join(", ")}. Last error: ${errorMessage}`,
		)
	}

	async getItem(id: string, type: MarketplaceItemType): Promise<MarketplaceItem | null> {
		const items = await this.loadAllItems()
		return items.find((item) => item.id === id && item.type === type) || null
	}

	private createMarketplacePaths(extensionPath: string): string[] {
		const candidates = [
			path.join(extensionPath, "assets", "marketplace"),
			path.join(extensionPath, "..", "assets", "marketplace"),
			path.join(extensionPath, "dist", "assets", "marketplace"),
			path.join(extensionPath, "..", "dist", "assets", "marketplace"),
		]

		return [...new Set(candidates.map((candidate) => path.normalize(candidate)))]
	}
}
