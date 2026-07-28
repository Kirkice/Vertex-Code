import { describe, expect, it, vi } from "vitest"

import { createAbortableStreamIterator } from "../apiStreamCoordinator"

async function* createStream(values: string[]) {
	for (const value of values) {
		yield value
	}
}

describe("createAbortableStreamIterator", () => {
	it("preserves stream order and exposes the underlying iterator", async () => {
		const { iterator, next } = createAbortableStreamIterator(createStream(["first", "second"]), () => undefined)

		expect(await next()).toEqual({ value: "first", done: false })
		expect(await next()).toEqual({ value: "second", done: false })
		expect(await next()).toEqual({ value: undefined, done: true })
		expect(iterator).toBeDefined()
	})

	it("rejects a pending read when the current request is aborted", async () => {
		const controller = new AbortController()
		const nextDeferred = new Promise<IteratorResult<string>>(() => undefined)
		const iterator = { next: vi.fn(() => nextDeferred) }
		const stream = { [Symbol.asyncIterator]: () => iterator }

		const { next } = createAbortableStreamIterator(stream, () => controller.signal)
		const pending = next()
		controller.abort()

		await expect(pending).rejects.toThrow("Request cancelled by user")
	})

	it("checks an already-aborted signal before returning a chunk", async () => {
		const controller = new AbortController()
		controller.abort()

		const { next } = createAbortableStreamIterator(createStream(["ignored"]), () => controller.signal)

		await expect(next()).rejects.toThrow("Request cancelled by user")
	})
})
