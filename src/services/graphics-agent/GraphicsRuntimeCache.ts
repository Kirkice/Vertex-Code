export interface GraphicsCacheEntry<T> {
	value: T
	createdAt: number
	expiresAt: number
	revision: number
	stale: boolean
}

export interface GraphicsCacheKeyParts {
	providerId?: string
	captureIdentity?: string
	eventId?: string | number
	profileId?: string
	sessionId?: string
	sessionRevision?: number
	sourceRevision?: string
}

export class GraphicsRuntimeCache {
	private readonly entries = new Map<string, GraphicsCacheEntry<unknown>>()
	private revision = 0

	get currentRevision(): number {
		return this.revision
	}

	static createKey(parts: GraphicsCacheKeyParts): string {
		return Object.entries(parts)
			.filter(([, value]) => value !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, value]) => `${key}=${String(value)}`)
			.join("|")
	}

	get<T>(key: string): GraphicsCacheEntry<T> | undefined {
		const entry = this.entries.get(key) as GraphicsCacheEntry<T> | undefined
		if (!entry) return undefined
		if (entry.expiresAt <= Date.now()) {
			entry.stale = true
			return { ...entry }
		}
		return { ...entry, stale: entry.stale }
	}

	set<T>(key: string, value: T, ttlMs = 60_000): GraphicsCacheEntry<T> {
		const entry: GraphicsCacheEntry<T> = {
			value,
			createdAt: Date.now(),
			expiresAt: Date.now() + Math.max(0, ttlMs),
			revision: ++this.revision,
			stale: false,
		}
		this.entries.set(key, entry)
		return { ...entry }
	}

	invalidate(predicate?: (key: string) => boolean): number {
		let count = 0
		for (const [key, entry] of this.entries) {
			if (!predicate || predicate(key)) {
			entry.stale = true
			count += 1
			}
		}
		if (count) this.revision += 1
		return count
	}

	clear(): void {
		this.entries.clear()
		this.revision += 1
	}
}
