import type {
	MarketplaceReleaseItem,
	MarketplaceReleaseManifest,
	MarketplaceToolContract,
} from "@roo-code/types"
import { parseMcpToolName, toolNamesMatch } from "../../../utils/mcp-name"

export interface SkillToolSchema {
	name: string
	requiredArguments?: ReadonlySet<string>
	optionalArguments?: ReadonlySet<string>
	platforms?: readonly string[]
	deprecatedAliases?: readonly string[]
}

export interface SkillMcpServerContract {
	name: string
	aliases?: readonly string[]
	tools: ReadonlyMap<string, SkillToolSchema>
	platforms?: readonly string[]
}

export interface SkillProviderContract {
	id: string
	serverNames: readonly string[]
	tools: ReadonlyMap<string, SkillToolSchema>
	providedCapabilities?: readonly string[]
	platforms?: readonly string[]
}

export interface SkillCapabilityContract {
	getAvailability(capability: string): "available" | "degraded" | "unavailable" | "unknown"
}

export interface SkillToolContractContext {
	mcpServers?: ReadonlyMap<string, SkillMcpServerContract>
	providers?: ReadonlyMap<string, SkillProviderContract>
	capabilities?: SkillCapabilityContract
	platform?: string
}

export interface SkillToolContractValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

/**
 * Validates explicit Skill tool contracts against the MCP/provider inventory.
 * Raw MCP names and model-rewritten dynamic names are normalized to one form.
 */
export function validateSkillToolContracts(
	manifest: MarketplaceReleaseManifest,
	context: SkillToolContractContext,
): SkillToolContractValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	for (const item of manifest.items) {
		if (item.type === "skill") {
			validateSkillItem(item as SkillReleaseItem, context, errors, warnings)
		}
	}

	return { valid: errors.length === 0, errors, warnings }
}

export function validateSkillToolContract(
	item: MarketplaceReleaseItem,
	context: SkillToolContractContext,
): SkillToolContractValidationResult {
	const errors: string[] = []
	const warnings: string[] = []
	if (item.type !== "skill") {
		errors.push(`${item.type}:${item.id}: tool contracts can only be declared by Skills`)
	} else {
		validateSkillItem(item as SkillReleaseItem, context, errors, warnings)
	}
	return { valid: errors.length === 0, errors, warnings }
}

type SkillReleaseItem = MarketplaceReleaseItem & { type: "skill" }

function validateSkillItem(
	item: SkillReleaseItem,
	context: SkillToolContractContext,
	errors: string[],
	warnings: string[],
): void {
	const label = `skill:${item.id}`
	for (const capability of item.requiredCapabilities) {
		const availability = context.capabilities?.getAvailability(capability)
		if (availability === "unavailable") {
			errors.push(`${label}: required capability '${capability}' is unavailable`)
		} else if (availability === "unknown") {
			warnings.push(`${label}: required capability '${capability}' has no registered provider`)
		}
	}

	for (const contract of item.requiredTools ?? []) {
		validateToolContract(label, contract, context, errors, warnings)
	}
}

function validateToolContract(
	label: string,
	contract: MarketplaceToolContract,
	context: SkillToolContractContext,
	errors: string[],
	warnings: string[],
): void {
	const resolved = resolveTool(contract, context)
	if (!resolved) {
		errors.push(`${label}: tool '${contract.tool}'${contract.server ? ` on server '${contract.server}'` : ""} is not registered`)
		return
	}

	const { schema, serverName } = resolved
	if (context.platform && !supportsPlatform(context.platform, contract.platforms, schema.platforms)) {
		errors.push(`${label}: tool '${contract.tool}' is not supported on platform '${context.platform}'`)
	}
	if (contract.platforms && schema.platforms && !contract.platforms.some((platform) => schema.platforms?.includes(platform))) {
		errors.push(`${label}: declared platform constraints for '${contract.tool}' do not match its tool contract`)
	}

	for (const argument of contract.requiredArguments ?? []) {
		if (!schema.requiredArguments?.has(argument) && !schema.optionalArguments?.has(argument)) {
			errors.push(`${label}: required argument '${argument}' is not accepted by '${contract.tool}'`)
		}
	}
	for (const argument of contract.optionalArguments ?? []) {
		if (!schema.optionalArguments?.has(argument) && !schema.requiredArguments?.has(argument)) {
			errors.push(`${label}: optional argument '${argument}' is not accepted by '${contract.tool}'`)
		}
	}
	for (const alias of contract.deprecatedAliases ?? []) {
		if (!schema.deprecatedAliases?.some((candidate) => toolNamesMatch(candidate, alias))) {
			warnings.push(`${label}: deprecated alias '${alias}' is not declared by '${contract.tool}'`)
		}
	}
	if (serverName && context.mcpServers && !context.mcpServers.has(serverName)) {
		warnings.push(`${label}: resolved provider server '${serverName}' is not a direct MCP registry key`)
	}
}

function resolveTool(
	contract: MarketplaceToolContract,
	context: SkillToolContractContext,
): { schema: SkillToolSchema; serverName?: string } | undefined {
	const parsed = parseMcpToolName(contract.tool)
	const requestedServer = contract.server ?? parsed?.serverName
	const requestedTool = parsed?.toolName ?? contract.tool

	if (requestedServer) {
		for (const [key, server] of context.mcpServers ?? []) {
			if (matchesServer(requestedServer, key, server)) {
				const schema = findTool(server.tools, requestedTool)
				if (schema) return { schema, serverName: key }
			}
		}
		for (const provider of context.providers?.values() ?? []) {
			if (provider.serverNames.some((name) => toolNamesMatch(requestedServer, name))) {
				const schema = findTool(provider.tools, requestedTool)
				if (schema) return { schema, serverName: requestedServer }
			}
		}
		return undefined
	}

	const matches: Array<{ schema: SkillToolSchema; serverName?: string }> = []
	for (const [key, server] of context.mcpServers ?? []) {
		const schema = findTool(server.tools, requestedTool)
		if (schema) matches.push({ schema, serverName: key })
	}
	for (const provider of context.providers?.values() ?? []) {
		const schema = findTool(provider.tools, requestedTool)
		if (schema) matches.push({ schema, serverName: provider.serverNames[0] })
	}
	return matches.length === 1 ? matches[0] : undefined
}

function findTool(tools: ReadonlyMap<string, SkillToolSchema>, requested: string): SkillToolSchema | undefined {
	for (const [name, schema] of tools) {
		if (toolNamesMatch(name, requested) || schema.deprecatedAliases?.some((alias) => toolNamesMatch(alias, requested))) {
			return schema
		}
	}
	return undefined
}

function matchesServer(requested: string, key: string, server: SkillMcpServerContract): boolean {
	return toolNamesMatch(requested, key) || toolNamesMatch(requested, server.name) || (server.aliases ?? []).some((alias) => toolNamesMatch(requested, alias))
}

function supportsPlatform(platform: string, declared?: readonly string[], supported?: readonly string[]): boolean {
	return !declared?.length && !supported?.length || Boolean(declared?.includes(platform) || supported?.includes(platform))
}

/** Inventory for the RenderDoc provider shipped by the extension. */
export function createRenderDocToolContract(): SkillProviderContract {
	const eventId = new Set(["eventId"])
	const noArguments = new Set<string>()
	const tools = new Map<string, SkillToolSchema>([
		["renderdoc_openCapture", { name: "renderdoc_openCapture" }],
		["renderdoc_getCaptureInfo", { name: "renderdoc_getCaptureInfo" }],
		["renderdoc_getFrameSummary", { name: "renderdoc_getFrameSummary" }],
		["renderdoc_getPassGraph", { name: "renderdoc_getPassGraph" }],
		["renderdoc_getActionTimings", { name: "renderdoc_getActionTimings", optionalArguments: new Set(["eventIds", "limit"]) }],
		["renderdoc_getSelectionContext", { name: "renderdoc_getSelectionContext" }],
		["renderdoc_getEventDetails", { name: "renderdoc_getEventDetails", requiredArguments: eventId }],
		["renderdoc_getPipelineState", { name: "renderdoc_getPipelineState", requiredArguments: eventId }],
		["renderdoc_getShaderInfo", { name: "renderdoc_getShaderInfo", requiredArguments: eventId, optionalArguments: new Set(["stage", "includeSource", "includeConstantBuffers"]) }],
		["renderdoc_getShaderSource", { name: "renderdoc_getShaderSource", requiredArguments: eventId, optionalArguments: new Set(["stage"]) }],
		["renderdoc_getMeshData", { name: "renderdoc_getMeshData", requiredArguments: eventId, optionalArguments: new Set(["stage", "maxVertices", "instance"]) }],
		["renderdoc_findProjectImplementation", { name: "renderdoc_findProjectImplementation", optionalArguments: new Set(["eventId", "shaderName", "passName", "additionalTerms", "limit"]) }],
		["renderdoc_getDrawCalls", { name: "renderdoc_getDrawCalls", optionalArguments: new Set(["filter", "markerFilter", "excludeMarkers", "onlyDrawCalls", "eventIdMin", "eventIdMax"]) }],
		["renderdoc_analyzeHotEvent", { name: "renderdoc_analyzeHotEvent", requiredArguments: eventId, optionalArguments: new Set(["includeShaderInfo", "includeMeshData"]) }],
		["renderdoc_diffPipelineState", { name: "renderdoc_diffPipelineState", requiredArguments: new Set(["eventIdA", "eventIdB"]) }],
	])
	void noArguments
	return {
		id: "renderdoc-vscode-mcp",
		serverNames: ["renderdoc-for-vscode", "renderdoc", "renderdoc-mcp"],
		tools,
		providedCapabilities: ["runtime.capture", "runtime.selection", "runtime.shader", "runtime.resource", "runtime.buffer", "runtime.timing", "project.mapping", "runtime.replay"],
	}
}
