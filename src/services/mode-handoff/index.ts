/**
 * Mode Handoff 服务入口
 *
 * 统一导出 handoff 相关类型与函数。
 */

export type {
	ModeHandoffSummary,
	ModeHandoffTrigger,
	ModeHandoffExtractInput,
	ModeHandoffInjectFormat,
} from "./ModeHandoffTypes"

export {
	shouldCreateHandoff,
	isHandoffConsumed,
	determineTrigger,
} from "./ModeHandoffRules"

export { extractHandoffSummary } from "./ModeHandoffExtractor"

export { formatHandoffForInjection, formatHandoffForDisplay } from "./ModeHandoffFormatter"

export {
	createHandoff,
	getLatestPendingHandoff,
	consumePendingHandoff,
	handoffToMessage,
} from "./ModeHandoffService"

export {
	generateExecutionReport,
	formatExecutionReportForInjection,
	type ExecutionReportInput,
} from "./ExecutionReportService"

export {
	formatValidationResultForInjection,
	needsRepairCycle,
	buildRepairObjective,
	requiresAutoReturn,
	hasAcceptanceCriteria,
} from "./ValidationService"
