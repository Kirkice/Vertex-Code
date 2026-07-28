/**
 * Creates an async iterator that races each read against the current request's
 * abort signal. The underlying iterator remains exposed because Task also
 * drains trailing usage chunks after the main response loop finishes.
 */
export function createAbortableStreamIterator<T>(
	stream: AsyncIterable<T>,
	getAbortSignal: () => AbortSignal | undefined,
): {
	iterator: AsyncIterator<T>
	next: () => Promise<IteratorResult<T>>
} {
	const iterator = stream[Symbol.asyncIterator]()

	const next = async (): Promise<IteratorResult<T>> => {
		const nextPromise = iterator.next()
		const signal = getAbortSignal()

		if (!signal) {
			return nextPromise
		}

		const abortPromise = new Promise<never>((_, reject) => {
			const rejectOnAbort = () => reject(new Error("Request cancelled by user"))

			if (signal.aborted) {
				rejectOnAbort()
				return
			}

			signal.addEventListener("abort", rejectOnAbort, { once: true })
		})

		return Promise.race([nextPromise, abortPromise])
	}

	return { iterator, next }
}
