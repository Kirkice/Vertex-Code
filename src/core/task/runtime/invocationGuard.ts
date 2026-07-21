/**
 * Prevents concurrent duplicate calls for one runtime operation while still
 * allowing the same operation to run again after the previous call completes.
 * This protects migration adapters from double execution during overlapping
 * webview/task events without changing normal sequential behavior.
 */
export class TaskRuntimeInvocationGuard {
	private readonly inFlight = new Map<string, Promise<unknown>>()

	run<T>(key: string, operation: () => Promise<T> | T): Promise<T> {
		const existing = this.inFlight.get(key)
		if (existing) {
			return existing as Promise<T>
		}

		const promise = Promise.resolve()
			.then(operation)
			.finally(() => {
				if (this.inFlight.get(key) === promise) {
					this.inFlight.delete(key)
				}
			})

		this.inFlight.set(key, promise)
		return promise
	}
}
