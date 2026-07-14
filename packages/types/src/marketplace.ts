import { z } from "zod"

/**
 * Schema for MCP parameter definitions
 */
export const mcpParameterSchema = z.object({
	name: z.string().min(1),
	key: z.string().min(1),
	placeholder: z.string().optional(),
	optional: z.boolean().optional().default(false),
})

export type McpParameter = z.infer<typeof mcpParameterSchema>

/**
 * Schema for MCP installation method with name
 */
export const mcpInstallationMethodSchema = z.object({
	name: z.string().min(1),
	content: z.string().min(1),
	parameters: z.array(mcpParameterSchema).optional(),
	prerequisites: z.array(z.string()).optional(),
})

export type McpInstallationMethod = z.infer<typeof mcpInstallationMethodSchema>

/**
 * Component type validation
 */
export const marketplaceItemTypeSchema = z.enum(["mode", "mcp", "skill", "knowledge"] as const)

export type MarketplaceItemType = z.infer<typeof marketplaceItemTypeSchema>

/**
 * Base schema for common marketplace item fields
 */
const baseMarketplaceItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	author: z.string().optional(),
	authorUrl: z.string().url("Author URL must be a valid URL").optional(),
	tags: z.array(z.string()).optional(),
	prerequisites: z.array(z.string()).optional(),
})

/**
 * Type-specific schemas for YAML parsing (without type field, added programmatically)
 */
export const modeMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	content: z.string().min(1), // YAML content for modes
})

export type ModeMarketplaceItem = z.infer<typeof modeMarketplaceItemSchema>

/**
 * Schema for a single file within a skill package
 */
export const skillFileSchema = z.object({
	path: z.string().min(1), // Relative path within the skill directory, e.g. "SKILL.md", "references/guide.md"
	url: z.string().url().optional(), // Optional direct download URL, overrides source-derived URL
})

export type SkillFile = z.infer<typeof skillFileSchema>

export const skillMarketplaceGroupSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	order: z.number().int().optional(),
})

export type SkillMarketplaceGroup = z.infer<typeof skillMarketplaceGroupSchema>

/**
 * Schema for a single file within an MCP package.
 * Reuses the same structure as skill files.
 */
export const mcpFileSchema = skillFileSchema

export type McpFile = z.infer<typeof mcpFileSchema>

export const mcpMarketplaceGroupSchema = skillMarketplaceGroupSchema

export type McpMarketplaceGroup = z.infer<typeof mcpMarketplaceGroupSchema>

/**
 * MCP marketplace item schema.
 * Supports two modes:
 * 1. Configuration mode: Provide url + content (JSON config for npx/docker)
 * 2. File download mode: Provide source + files (download binary files from GitHub)
 */
export const mcpMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	// Configuration mode fields (optional when using file download mode)
	url: z.string().url().optional(),
	content: z.union([z.string().min(1), z.array(mcpInstallationMethodSchema)]).optional(),
	parameters: z.array(mcpParameterSchema).optional(),
	// File download mode fields (for binary MCP servers like .NET applications)
	source: z.string().url().optional(), // GitHub repository URL, e.g. "https://github.com/user/repo"
	sourcePath: z.string().optional().default(""), // Path within the repo to the MCP directory
	branch: z.string().optional().default("main"), // Git branch name
	files: z.array(mcpFileSchema).optional(), // List of files to download
	executable: z.string().optional(), // Relative path to the executable file within the downloaded files
	modeSlugs: z.array(z.string()).optional(), // Applicable mode slugs (e.g. ["graphics", "code"])
	group: mcpMarketplaceGroupSchema.optional(), // Optional visual grouping for marketplace display/bulk install
})

export type McpMarketplaceItem = z.infer<typeof mcpMarketplaceItemSchema>

/**
 * Skill marketplace item schema
 * Skills are hosted on GitHub and downloaded at install time.
 */
export const skillMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	source: z.string().url(), // GitHub repository URL, e.g. "https://github.com/user/repo"
	sourcePath: z.string().optional().default(""), // Path within the repo to the skill directory
	branch: z.string().optional().default("main"), // Git branch name
	files: z.array(skillFileSchema).min(1), // List of files to download
	modeSlugs: z.array(z.string()).optional(), // Applicable mode slugs (e.g. ["graphics", "code"])
	group: skillMarketplaceGroupSchema.optional(), // Optional visual grouping for marketplace display/bulk install
})

export type SkillMarketplaceItem = z.infer<typeof skillMarketplaceItemSchema>

/**
 * Schema for a single file within a knowledge package.
 * Reuses the same structure as skill files.
 */
export const knowledgeFileSchema = skillFileSchema

export type KnowledgeFile = z.infer<typeof knowledgeFileSchema>

export const knowledgeMarketplaceGroupSchema = skillMarketplaceGroupSchema

export type KnowledgeMarketplaceGroup = z.infer<typeof knowledgeMarketplaceGroupSchema>

/**
 * Knowledge marketplace item schema.
 * Knowledge documents are hosted on GitHub and downloaded at install time,
 * placed into the local .roo/knowledge/ directory.
 */
export const knowledgeMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	source: z.string().url(), // GitHub repository URL, e.g. "https://github.com/user/repo"
	sourcePath: z.string().optional().default(""), // Path within the repo to the knowledge directory
	branch: z.string().optional().default("main"), // Git branch name
	files: z.array(knowledgeFileSchema).min(1), // List of files to download
	modeSlugs: z.array(z.string()).optional(), // Applicable mode slugs (e.g. ["graphics", "code"])
	group: knowledgeMarketplaceGroupSchema.optional(), // Optional visual grouping for marketplace display/bulk install
})

export type KnowledgeMarketplaceItem = z.infer<typeof knowledgeMarketplaceItemSchema>

/**
 * Unified marketplace item schema using discriminated union
 */
export const marketplaceItemSchema = z.discriminatedUnion("type", [
	// Mode marketplace item
	modeMarketplaceItemSchema.extend({
		type: z.literal("mode"),
	}),
	// MCP marketplace item
	mcpMarketplaceItemSchema.extend({
		type: z.literal("mcp"),
	}),
	// Skill marketplace item
	skillMarketplaceItemSchema.extend({
		type: z.literal("skill"),
	}),
	// Knowledge marketplace item
	knowledgeMarketplaceItemSchema.extend({
		type: z.literal("knowledge"),
	}),
])

export type MarketplaceItem = z.infer<typeof marketplaceItemSchema>

/**
 * Installation options for marketplace items
 */
export const installMarketplaceItemOptionsSchema = z.object({
	target: z.enum(["global", "project"]).optional().default("project"),
	parameters: z.record(z.string(), z.any()).optional(),
})

export type InstallMarketplaceItemOptions = z.infer<typeof installMarketplaceItemOptionsSchema>

export interface MarketplaceInstalledMetadata {
	project: Record<string, { type: string }>
	global: Record<string, { type: string }>
}
