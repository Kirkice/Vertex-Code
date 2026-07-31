/**
 * Deterministic three-way merge for shared Graphics Feature Plans.
 *
 * Scalar and object fields use base/local/current semantics. Identity-bearing
 * arrays are merged by their stable IDs so independent task, risk, acceptance,
 * and compatibility edits do not overwrite one another.
 */
import type { GraphicsFeaturePlan } from "@roo-code/types"

export type GraphicsMergeChoice = "local" | "shared"

export interface GraphicsFeaturePlanMergeConflict {
	path: string
	baseValue: unknown
	localValue: unknown
	currentValue: unknown
}

export interface GraphicsFeaturePlanMergeResult {
	mergedPlan: GraphicsFeaturePlan
	conflicts: GraphicsFeaturePlanMergeConflict[]
}

const ID_ARRAY_KEYS = new Set(["tasks", "risks", "acceptancePlan"])
const TARGET_ARRAY_KEYS = new Set(["compatibility"])

function equal(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right)
}

function mergeValue(
	base: unknown,
	local: unknown,
	current: unknown,
	path: string,
	conflicts: GraphicsFeaturePlanMergeConflict[],
	choices: Record<string, GraphicsMergeChoice>,
): unknown {
	if (equal(local, base)) return current
	if (equal(current, base) || equal(local, current)) return local

	if (
		local &&
		current &&
		base &&
		typeof local === "object" &&
		typeof current === "object" &&
		typeof base === "object" &&
		!Array.isArray(local) &&
		!Array.isArray(current) &&
		!Array.isArray(base)
	) {
		const keys = new Set([
			...Object.keys(base as Record<string, unknown>),
			...Object.keys(local as Record<string, unknown>),
			...Object.keys(current as Record<string, unknown>),
		])
		return Object.fromEntries(
			[...keys].map((key) => [
				key,
				mergeValue(
					(base as Record<string, unknown>)[key],
					(local as Record<string, unknown>)[key],
					(current as Record<string, unknown>)[key],
					path ? `${path}.${key}` : key,
					conflicts,
					choices,
				),
			]),
		)
	}

	if (Array.isArray(local) && Array.isArray(current) && Array.isArray(base)) {
		const key = path.split(".").pop() ?? ""
		const identity = ID_ARRAY_KEYS.has(key) ? "id" : TARGET_ARRAY_KEYS.has(key) ? "target" : undefined
		if (identity) {
			const baseMap = new Map(base.map((item) => [String((item as Record<string, unknown>)[identity]), item]))
			const localMap = new Map(local.map((item) => [String((item as Record<string, unknown>)[identity]), item]))
			const currentMap = new Map(current.map((item) => [String((item as Record<string, unknown>)[identity]), item]))
			const keys = new Set([...baseMap.keys(), ...localMap.keys(), ...currentMap.keys()])
			return [...keys].map((itemKey) =>
				mergeValue(
					baseMap.get(itemKey),
					localMap.get(itemKey),
					currentMap.get(itemKey),
					`${path}[${identity}=${itemKey}]`,
					conflicts,
					choices,
				),
			)
		}
	}

	const conflict: GraphicsFeaturePlanMergeConflict = {
		path,
		baseValue: base,
		localValue: local,
		currentValue: current,
	}
	conflicts.push(conflict)
	return choices[path] === "local" ? local : current
}

export function mergeGraphicsFeaturePlans(
	base: GraphicsFeaturePlan,
	local: GraphicsFeaturePlan,
	current: GraphicsFeaturePlan,
	choices: Record<string, GraphicsMergeChoice> = {},
): GraphicsFeaturePlanMergeResult {
	const conflicts: GraphicsFeaturePlanMergeConflict[] = []
	const merged = mergeValue(base, local, current, "", conflicts, choices) as GraphicsFeaturePlan
	return { mergedPlan: merged, conflicts }
}
