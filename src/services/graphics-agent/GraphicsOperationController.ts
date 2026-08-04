import type {
	CaptureCompletionResult,
	CaptureTriggerResult,
	GraphicsCaptureTriggerPolicy,
	GraphicsLaunchProfile,
	GraphicsOperationContext,
	LaunchTargetResult,
	LiveTargetResult,
} from "../graphics-provider/GraphicsProviderTypes"
import type { GraphicsCaptureProvider } from "../graphics-provider/GraphicsCaptureProvider"

export type GraphicsOperationStage =
	| "launch"
	| "live-target"
	| "capture-trigger"
	| "capture-completion"

export interface GraphicsOperationProgress {
	stage: GraphicsOperationStage
	completedStages: GraphicsOperationStage[]
}

export interface GraphicsOperationCleanupProvider {
	stopTarget?(targetId: string, context?: GraphicsOperationContext): Promise<void>
	cancelCapture?(operationId: string, context?: GraphicsOperationContext): Promise<void>
}

export class GraphicsOperationStageError extends Error {
	readonly stage: GraphicsOperationStage
	readonly originalError: unknown

	constructor(stage: GraphicsOperationStage, originalError: unknown) {
		super(originalError instanceof Error ? originalError.message : String(originalError))
		this.name = "GraphicsOperationStageError"
		this.stage = stage
		this.originalError = originalError
	}
}

export interface GraphicsOperationControllerOptions {
	timeouts?: Partial<Record<GraphicsOperationStage, number>>
	onProgress?: (progress: GraphicsOperationProgress) => void
}

const DEFAULT_STAGE_TIMEOUTS: Record<GraphicsOperationStage, number> = {
	launch: 30_000,
	"live-target": 60_000,
	"capture-trigger": 15_000,
	"capture-completion": 90_000,
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new Error("CANCELLED")
}

async function withTimeout<T>(
	operation: Promise<T>,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<T> {
	throwIfAborted(signal)
	let timer: ReturnType<typeof setTimeout> | undefined
	let abort: (() => void) | undefined
	const cancellation = signal
		? new Promise<never>((_, reject) => {
				abort = () => reject(new Error("CANCELLED"))
				if (signal.aborted) abort()
				else signal.addEventListener("abort", abort, { once: true })
			})
		: undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
	})
	try {
		return await Promise.race([operation, timeout, ...(cancellation ? [cancellation] : [])])
	} finally {
		if (timer) clearTimeout(timer)
		if (signal && abort) signal.removeEventListener("abort", abort)
	}
}

export class GraphicsOperationController {
	constructor(
		private readonly provider: GraphicsCaptureProvider,
		private readonly options: GraphicsOperationControllerOptions = {},
	) {}

	async run(
		profile: GraphicsLaunchProfile,
		context: GraphicsOperationContext = {},
	): Promise<{
		launched: LaunchTargetResult
		live: LiveTargetResult
		triggered: CaptureTriggerResult
		completed: CaptureCompletionResult
	}> {
		if (!this.provider.launchTarget || !this.provider.waitForLiveTarget || !this.provider.triggerCapture || !this.provider.waitForCapture) {
			throw new Error("PROVIDER_UNAVAILABLE")
		}
		if (context.signal?.aborted) throw new GraphicsOperationStageError("launch", new Error("CANCELLED"))
		const completedStages: GraphicsOperationStage[] = []
		let targetId: string | undefined
		let captureOperationId: string | undefined
		const runStage = async <T>(stage: GraphicsOperationStage, operation: Promise<T>): Promise<T> => {
			this.options.onProgress?.({ stage, completedStages: [...completedStages] })
			try {
				const value = await withTimeout(operation, this.options.timeouts?.[stage] ?? DEFAULT_STAGE_TIMEOUTS[stage], context.signal)
				completedStages.push(stage)
				this.options.onProgress?.({ stage, completedStages: [...completedStages] })
				return value
			} catch (error) {
				throw new GraphicsOperationStageError(stage, error)
			}
		}
		try {
		const launched = await runStage("launch", this.provider.launchTarget(profile, context))
		targetId = launched.targetId
		if (!launched.success || !launched.targetId) return { launched, live: { success: false }, triggered: { success: false }, completed: { success: false } }
		const live = await runStage("live-target", this.provider.waitForLiveTarget(launched.targetId, context))
		if (!live.success || !live.ready) return { launched, live, triggered: { success: false }, completed: { success: false } }
		const triggered = await runStage("capture-trigger", this.provider.triggerCapture(launched.targetId, profile, context))
		captureOperationId = triggered.operationId
		if (!triggered.success || !triggered.operationId) return { launched, live, triggered, completed: { success: false } }
		const completed = await runStage("capture-completion", this.provider.waitForCapture(triggered.operationId, context))
		return { launched, live, triggered, completed }
		} catch (error) {
			const cleanup = this.provider as GraphicsOperationCleanupProvider
			await Promise.allSettled([
				captureOperationId && cleanup.cancelCapture ? cleanup.cancelCapture(captureOperationId, context) : Promise.resolve(),
				targetId && cleanup.stopTarget ? cleanup.stopTarget(targetId, context) : Promise.resolve(),
			])
			throw error
		}
	}
}
