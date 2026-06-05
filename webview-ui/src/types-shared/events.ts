import { z } from "zod"

import { clineMessageSchema, queuedMessageSchema, tokenUsageSchema } from "./message.js"
import { modelInfoSchema } from "./model.js"
import { toolNamesSchema, toolUsageSchema } from "./tool.js"

/**
 * VertexEventName
 */

export enum VertexEventName {
	// Task Provider Lifecycle
	TaskCreated = "taskCreated",

	// Task Lifecycle
	TaskStarted = "taskStarted",
	TaskCompleted = "taskCompleted",
	TaskAborted = "taskAborted",
	TaskFocused = "taskFocused",
	TaskUnfocused = "taskUnfocused",
	TaskActive = "taskActive",
	TaskInteractive = "taskInteractive",
	TaskResumable = "taskResumable",
	TaskIdle = "taskIdle",

	// Subtask Lifecycle
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskSpawned = "taskSpawned",
	TaskDelegated = "taskDelegated",
	TaskDelegationCompleted = "taskDelegationCompleted",
	TaskDelegationResumed = "taskDelegationResumed",

	// Task Execution
	Message = "message",
	TaskModeSwitched = "taskModeSwitched",
	TaskAskResponded = "taskAskResponded",
	TaskUserMessage = "taskUserMessage",
	QueuedMessagesUpdated = "queuedMessagesUpdated",

	// Task Analytics
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
	TaskToolFailed = "taskToolFailed",

	// Configuration Changes
	ModeChanged = "modeChanged",
	ProviderProfileChanged = "providerProfileChanged",

	// Query Responses
	CommandsResponse = "commandsResponse",
	ModesResponse = "modesResponse",
	ModelsResponse = "modelsResponse",
}

/**
 * VertexEvents
 */

export const vertexEventsSchema = z.object({
	[VertexEventName.TaskCreated]: z.tuple([z.string()]),

	[VertexEventName.TaskStarted]: z.tuple([z.string()]),
	[VertexEventName.TaskCompleted]: z.tuple([
		z.string(),
		tokenUsageSchema,
		toolUsageSchema,
		z.object({
			isSubtask: z.boolean(),
		}),
	]),
	[VertexEventName.TaskAborted]: z.tuple([z.string()]),
	[VertexEventName.TaskFocused]: z.tuple([z.string()]),
	[VertexEventName.TaskUnfocused]: z.tuple([z.string()]),
	[VertexEventName.TaskActive]: z.tuple([z.string()]),
	[VertexEventName.TaskInteractive]: z.tuple([z.string()]),
	[VertexEventName.TaskResumable]: z.tuple([z.string()]),
	[VertexEventName.TaskIdle]: z.tuple([z.string()]),

	[VertexEventName.TaskPaused]: z.tuple([z.string()]),
	[VertexEventName.TaskUnpaused]: z.tuple([z.string()]),
	[VertexEventName.TaskSpawned]: z.tuple([z.string(), z.string()]),
	[VertexEventName.TaskDelegated]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),
	[VertexEventName.TaskDelegationCompleted]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
		z.string(), // completionResultSummary
	]),
	[VertexEventName.TaskDelegationResumed]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),

	[VertexEventName.Message]: z.tuple([
		z.object({
			taskId: z.string(),
			action: z.union([z.literal("created"), z.literal("updated")]),
			message: clineMessageSchema,
		}),
	]),
	[VertexEventName.TaskModeSwitched]: z.tuple([z.string(), z.string()]),
	[VertexEventName.TaskAskResponded]: z.tuple([z.string()]),
	[VertexEventName.TaskUserMessage]: z.tuple([z.string()]),
	[VertexEventName.QueuedMessagesUpdated]: z.tuple([z.string(), z.array(queuedMessageSchema)]),

	[VertexEventName.TaskToolFailed]: z.tuple([z.string(), toolNamesSchema, z.string()]),
	[VertexEventName.TaskTokenUsageUpdated]: z.tuple([z.string(), tokenUsageSchema, toolUsageSchema]),

	[VertexEventName.ModeChanged]: z.tuple([z.string()]),
	[VertexEventName.ProviderProfileChanged]: z.tuple([z.object({ name: z.string(), provider: z.string() })]),

	[VertexEventName.CommandsResponse]: z.tuple([
		z.array(
			z.object({
				name: z.string(),
				source: z.enum(["global", "project", "built-in"]),
				filePath: z.string().optional(),
				description: z.string().optional(),
				argumentHint: z.string().optional(),
			}),
		),
	]),
	[VertexEventName.ModesResponse]: z.tuple([z.array(z.object({ slug: z.string(), name: z.string() }))]),
	[VertexEventName.ModelsResponse]: z.tuple([z.record(z.string(), modelInfoSchema)]),
})

export type VertexEvents = z.infer<typeof vertexEventsSchema>

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	// Task Provider Lifecycle
	z.object({
		eventName: z.literal(VertexEventName.TaskCreated),
		payload: vertexEventsSchema.shape[VertexEventName.TaskCreated],
		taskId: z.number().optional(),
	}),

	// Task Lifecycle
	z.object({
		eventName: z.literal(VertexEventName.TaskStarted),
		payload: vertexEventsSchema.shape[VertexEventName.TaskStarted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskCompleted),
		payload: vertexEventsSchema.shape[VertexEventName.TaskCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskAborted),
		payload: vertexEventsSchema.shape[VertexEventName.TaskAborted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskFocused),
		payload: vertexEventsSchema.shape[VertexEventName.TaskFocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskUnfocused),
		payload: vertexEventsSchema.shape[VertexEventName.TaskUnfocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskActive),
		payload: vertexEventsSchema.shape[VertexEventName.TaskActive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskInteractive),
		payload: vertexEventsSchema.shape[VertexEventName.TaskInteractive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskResumable),
		payload: vertexEventsSchema.shape[VertexEventName.TaskResumable],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskIdle),
		payload: vertexEventsSchema.shape[VertexEventName.TaskIdle],
		taskId: z.number().optional(),
	}),

	// Subtask Lifecycle
	z.object({
		eventName: z.literal(VertexEventName.TaskPaused),
		payload: vertexEventsSchema.shape[VertexEventName.TaskPaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskUnpaused),
		payload: vertexEventsSchema.shape[VertexEventName.TaskUnpaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskSpawned),
		payload: vertexEventsSchema.shape[VertexEventName.TaskSpawned],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskDelegated),
		payload: vertexEventsSchema.shape[VertexEventName.TaskDelegated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskDelegationCompleted),
		payload: vertexEventsSchema.shape[VertexEventName.TaskDelegationCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskDelegationResumed),
		payload: vertexEventsSchema.shape[VertexEventName.TaskDelegationResumed],
		taskId: z.number().optional(),
	}),

	// Task Execution
	z.object({
		eventName: z.literal(VertexEventName.Message),
		payload: vertexEventsSchema.shape[VertexEventName.Message],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskModeSwitched),
		payload: vertexEventsSchema.shape[VertexEventName.TaskModeSwitched],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskAskResponded),
		payload: vertexEventsSchema.shape[VertexEventName.TaskAskResponded],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.QueuedMessagesUpdated),
		payload: vertexEventsSchema.shape[VertexEventName.QueuedMessagesUpdated],
		taskId: z.number().optional(),
	}),

	// Task Analytics
	z.object({
		eventName: z.literal(VertexEventName.TaskToolFailed),
		payload: vertexEventsSchema.shape[VertexEventName.TaskToolFailed],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.TaskTokenUsageUpdated),
		payload: vertexEventsSchema.shape[VertexEventName.TaskTokenUsageUpdated],
		taskId: z.number().optional(),
	}),

	// Query Responses
	z.object({
		eventName: z.literal(VertexEventName.CommandsResponse),
		payload: vertexEventsSchema.shape[VertexEventName.CommandsResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.ModesResponse),
		payload: vertexEventsSchema.shape[VertexEventName.ModesResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(VertexEventName.ModelsResponse),
		payload: vertexEventsSchema.shape[VertexEventName.ModelsResponse],
		taskId: z.number().optional(),
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>
