import { z } from "zod"

import { rooCodeSettingsSchema } from "./global-settings.js"

/**
 * Vertex CLI stdin commands
 */

export const rooCliCommandNames = ["start", "message", "cancel", "ping", "shutdown"] as const

export const rooCliCommandNameSchema = z.enum(rooCliCommandNames)

export type RooCliCommandName = z.infer<typeof rooCliCommandNameSchema>

export const rooCliCommandBaseSchema = z.object({
	command: rooCliCommandNameSchema,
	requestId: z.string().min(1),
})

export type RooCliCommandBase = z.infer<typeof rooCliCommandBaseSchema>

const rooCliSessionIdSchema = z
	.string()
	.trim()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

export const rooCliStartCommandSchema = rooCliCommandBaseSchema.extend({
	command: z.literal("start"),
	prompt: z.string(),
	taskId: rooCliSessionIdSchema.optional(),
	images: z.array(z.string()).optional(),
	configuration: rooCodeSettingsSchema.optional(),
})

export type RooCliStartCommand = z.infer<typeof rooCliStartCommandSchema>

export const rooCliMessageCommandSchema = rooCliCommandBaseSchema.extend({
	command: z.literal("message"),
	prompt: z.string(),
	images: z.array(z.string()).optional(),
})

export type RooCliMessageCommand = z.infer<typeof rooCliMessageCommandSchema>

export const rooCliCancelCommandSchema = rooCliCommandBaseSchema.extend({
	command: z.literal("cancel"),
})

export type RooCliCancelCommand = z.infer<typeof rooCliCancelCommandSchema>

export const rooCliPingCommandSchema = rooCliCommandBaseSchema.extend({
	command: z.literal("ping"),
})

export type RooCliPingCommand = z.infer<typeof rooCliPingCommandSchema>

export const rooCliShutdownCommandSchema = rooCliCommandBaseSchema.extend({
	command: z.literal("shutdown"),
})

export type RooCliShutdownCommand = z.infer<typeof rooCliShutdownCommandSchema>

export const rooCliInputCommandSchema = z.discriminatedUnion("command", [
	rooCliStartCommandSchema,
	rooCliMessageCommandSchema,
	rooCliCancelCommandSchema,
	rooCliPingCommandSchema,
	rooCliShutdownCommandSchema,
])

export type RooCliInputCommand = z.infer<typeof rooCliInputCommandSchema>

/**
 * Vertex CLI stream-json output
 */

export const rooCliProtocol = "vertex-cli/1" as const
export const rooCliSchemaVersion = 1 as const

export const rooCliOutputFormats = ["text", "json", "stream-json"] as const

export const rooCliOutputFormatSchema = z.enum(rooCliOutputFormats)

export type RooCliOutputFormat = z.infer<typeof rooCliOutputFormatSchema>

export const rooCliExitCodes = {
	SUCCESS: 0,
	RUNTIME_ERROR: 1,
	FEATURE_UNAVAILABLE: 2,
	CANCELLED: 3,
	CONFIGURATION_ERROR: 4,
	APPROVAL_DENIED: 5,
} as const

export const rooCliErrorCodes = [
	"FEATURE_UNAVAILABLE",
	"INVALID_ARGUMENT",
	"CONFIGURATION_ERROR",
	"CANCELLED",
	"APPROVAL_DENIED",
	"RUNTIME_ERROR",
] as const

export const rooCliErrorCodeSchema = z.enum(rooCliErrorCodes)

export type RooCliErrorCode = z.infer<typeof rooCliErrorCodeSchema>

export const rooCliApprovalDecisionSchema = z.enum(["approve", "deny", "always_allow"])

export type RooCliApprovalDecision = z.infer<typeof rooCliApprovalDecisionSchema>

export const rooCliApprovalRequestSchema = z.object({
	id: z.string().min(1),
	operation: z.string().min(1),
	description: z.string().min(1),
	cwd: z.string().min(1),
	risk: z.enum(["low", "medium", "high"]),
})

export type RooCliApprovalRequest = z.infer<typeof rooCliApprovalRequestSchema>

export const rooCliFinalSummarySchema = z.object({
	sessionId: z.string().min(1).optional(),
	durationMs: z.number().nonnegative().optional(),
	toolCalls: z.number().int().nonnegative().optional(),
	cancelled: z.boolean().optional(),
})

export type RooCliFinalSummary = z.infer<typeof rooCliFinalSummarySchema>

export const rooCliEventTypes = [
	"system",
	"control",
	"queue",
	"assistant",
	"user",
	"tool_use",
	"tool_result",
	"thinking",
	"error",
	"result",
] as const

export const rooCliEventTypeSchema = z.enum(rooCliEventTypes)

export type RooCliEventType = z.infer<typeof rooCliEventTypeSchema>

export const rooCliControlSubtypes = ["ack", "done", "error"] as const

export const rooCliControlSubtypeSchema = z.enum(rooCliControlSubtypes)

export type RooCliControlSubtype = z.infer<typeof rooCliControlSubtypeSchema>

export const rooCliQueueItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().optional(),
	imageCount: z.number().optional(),
	timestamp: z.number().optional(),
})

export type RooCliQueueItem = z.infer<typeof rooCliQueueItemSchema>

export const rooCliToolUseSchema = z.object({
	name: z.string(),
	input: z.record(z.unknown()).optional(),
})

export type RooCliToolUse = z.infer<typeof rooCliToolUseSchema>

export const rooCliToolResultSchema = z.object({
	name: z.string(),
	output: z.string().optional(),
	error: z.string().optional(),
	exitCode: z.number().optional(),
})

export type RooCliToolResult = z.infer<typeof rooCliToolResultSchema>

export const rooCliCostSchema = z.object({
	totalCost: z.number().optional(),
	inputTokens: z.number().optional(),
	outputTokens: z.number().optional(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
})

export type RooCliCost = z.infer<typeof rooCliCostSchema>

export const rooCliStreamEventSchema = z
	.object({
		type: rooCliEventTypeSchema.optional(),
		subtype: z.string().optional(),
		requestId: z.string().optional(),
		command: rooCliCommandNameSchema.optional(),
		taskId: rooCliSessionIdSchema.optional(),
		sessionId: rooCliSessionIdSchema.optional(),
		/**
		 * Canonical runtime error code. Legacy control events may still use a
		 * command-specific completion code, so strict validation belongs to final
		 * output and error events rather than this forward-compatible envelope.
		 */
		code: z.string().min(1).optional(),
		content: z.string().optional(),
		success: z.boolean().optional(),
		id: z.number().optional(),
		done: z.boolean().optional(),
		queueDepth: z.number().optional(),
		queue: z.array(rooCliQueueItemSchema).optional(),
		schemaVersion: z.number().optional(),
		protocol: z.string().optional(),
		capabilities: z.array(z.string()).optional(),
		tool_use: rooCliToolUseSchema.optional(),
		tool_result: rooCliToolResultSchema.optional(),
		approval: rooCliApprovalRequestSchema.optional(),
		cost: rooCliCostSchema.optional(),
		summary: rooCliFinalSummarySchema.optional(),
	})
	.passthrough()

export type RooCliStreamEvent = z.infer<typeof rooCliStreamEventSchema>

export const rooCliControlEventSchema = rooCliStreamEventSchema.extend({
	type: z.literal("control"),
	subtype: rooCliControlSubtypeSchema,
	requestId: z.string().min(1),
})

export type RooCliControlEvent = z.infer<typeof rooCliControlEventSchema>

export const rooCliFinalOutputSchema = z.object({
	type: z.literal("result"),
	success: z.boolean(),
	content: z.string().optional(),
	code: rooCliErrorCodeSchema.optional(),
	sessionId: rooCliSessionIdSchema.optional(),
	cost: rooCliCostSchema.optional(),
	summary: rooCliFinalSummarySchema.optional(),
	events: z.array(rooCliStreamEventSchema),
})

export type RooCliFinalOutput = z.infer<typeof rooCliFinalOutputSchema>
