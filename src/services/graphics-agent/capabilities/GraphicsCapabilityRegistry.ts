/**
 * Graphics Capability Registry
 *
 * Normalizes marketplace and runtime capability declarations without replacing
 * the runtime provider registry's selection and preflight responsibilities.
 */

import type {
	GraphicsCapabilityAvailability,
	GraphicsCapabilityDependencyResolution,
	GraphicsCapabilityDescriptor,
	GraphicsCapabilityHealth,
	GraphicsCapabilityRegistryEntry,
	GraphicsCapabilitySourceKind,
} from "@roo-code/types"

/** Public contract for the source-independent graphics capability index. */
export interface IGraphicsCapabilityRegistry {
	register(entry: GraphicsCapabilityRegistryEntry): void
	unregister(sourceKind: GraphicsCapabilitySourceKind, sourceId: string): void
	list(): GraphicsCapabilityRegistryEntry[]
	findByCapability(capability: string): GraphicsCapabilityRegistryEntry[]
	resolveDependencies(
		entry: GraphicsCapabilityRegistryEntry,
	): GraphicsCapabilityDependencyResolution
	getAvailability(capability: string): GraphicsCapabilityAvailability
}

/**
 * In-memory registry used by planning and capability-driven UI layers.
 * Registration is deterministic and idempotent per source kind/source id.
 */
export class GraphicsCapabilityRegistry implements IGraphicsCapabilityRegistry {
	private readonly entries = new Map<string, GraphicsCapabilityRegistryEntry>()

	/** Register or replace the complete declaration for one source. */
	public register(entry: GraphicsCapabilityRegistryEntry): void {
		const descriptor = normalizeDescriptor(entry.descriptor)
		this.entries.set(createSourceKey(descriptor.sourceKind, descriptor.sourceId), {
			descriptor,
			registeredAt: entry.registeredAt,
		})
	}

	/** Remove every declaration contributed by one source. */
	public unregister(sourceKind: GraphicsCapabilitySourceKind, sourceId: string): void {
		this.entries.delete(createSourceKey(sourceKind, sourceId))
	}

	/** Return entries in stable source and descriptor order. */
	public list(): GraphicsCapabilityRegistryEntry[] {
		return [...this.entries.values()]
			.map(cloneEntry)
			.sort((left, right) => compareEntries(left, right))
	}

	/** Find sources that declare a capability, with duplicate IDs removed per source. */
	public findByCapability(capability: string): GraphicsCapabilityRegistryEntry[] {
		const normalizedCapability = capability.trim()
		return this.list().filter((entry) =>
			entry.descriptor.providedCapabilities.includes(normalizedCapability),
		)
	}

	/**
	 * Resolve dependencies against healthy and fully available declarations.
	 * Degraded providers remain visible but do not satisfy hard dependencies.
	 */
	public resolveDependencies(
		entry: GraphicsCapabilityRegistryEntry,
	): GraphicsCapabilityDependencyResolution {
		const provided = new Set(
			this.list()
				.filter((candidate) => isOperational(candidate.descriptor))
				.flatMap((candidate) => candidate.descriptor.providedCapabilities),
		)
		const missing = uniqueSorted(
			(entry.descriptor.dependencies ?? []).filter((dependency) => !provided.has(dependency)),
		)
		return { satisfied: missing.length === 0, missing }
	}

	/** Aggregate the best known availability for a capability across all sources. */
	public getAvailability(capability: string): GraphicsCapabilityAvailability {
		const matching = this.findByCapability(capability)
		if (matching.length === 0) {
			return "unknown"
		}

		if (matching.some((entry) => isOperational(entry.descriptor))) {
			return "available"
		}
		if (
			matching.some(
				(entry) =>
					entry.descriptor.availability === "degraded" ||
					entry.descriptor.health === "degraded",
			)
		) {
			return "degraded"
		}
		return "unavailable"
	}
}

function createSourceKey(sourceKind: GraphicsCapabilitySourceKind, sourceId: string): string {
	return `${sourceKind}:${sourceId}`
}

function normalizeDescriptor(descriptor: GraphicsCapabilityDescriptor): GraphicsCapabilityDescriptor {
	return {
		...descriptor,
		providedCapabilities: uniqueSorted(descriptor.providedCapabilities),
		requiredCapabilities: descriptor.requiredCapabilities
			? uniqueSorted(descriptor.requiredCapabilities)
			: undefined,
		dependencies: descriptor.dependencies ? uniqueSorted(descriptor.dependencies) : undefined,
		diagnostics: descriptor.diagnostics ? uniqueSorted(descriptor.diagnostics) : undefined,
	}
}

function uniqueSorted(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort()
}

function isOperational(descriptor: GraphicsCapabilityDescriptor): boolean {
	return descriptor.availability === "available" && descriptor.health === "healthy"
}

function compareEntries(
	left: GraphicsCapabilityRegistryEntry,
	right: GraphicsCapabilityRegistryEntry,
): number {
	const leftKey = createSourceKey(left.descriptor.sourceKind, left.descriptor.sourceId)
	const rightKey = createSourceKey(right.descriptor.sourceKind, right.descriptor.sourceId)
	return leftKey.localeCompare(rightKey) || left.descriptor.id.localeCompare(right.descriptor.id)
}

function cloneEntry(entry: GraphicsCapabilityRegistryEntry): GraphicsCapabilityRegistryEntry {
	return {
		...entry,
		descriptor: {
			...entry.descriptor,
			providedCapabilities: [...entry.descriptor.providedCapabilities],
			requiredCapabilities: entry.descriptor.requiredCapabilities
				? [...entry.descriptor.requiredCapabilities]
				: undefined,
			dependencies: entry.descriptor.dependencies ? [...entry.descriptor.dependencies] : undefined,
			diagnostics: entry.descriptor.diagnostics ? [...entry.descriptor.diagnostics] : undefined,
		},
	}
}
