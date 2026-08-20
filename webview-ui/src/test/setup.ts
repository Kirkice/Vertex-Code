import "@testing-library/jest-dom/vitest"

// jsdom 不提供浏览器布局引擎中的 ResizeObserver；Tooltip 等组件会在
// 挂载时创建观察器，因此测试环境需要一个行为安全的最小实现。
class ResizeObserverMock implements ResizeObserver {
	readonly #observed = new Set<Element>()

	disconnect(): void {
		this.#observed.clear()
	}

	observe(target: Element): void {
		this.#observed.add(target)
	}

	unobserve(target: Element): void {
		this.#observed.delete(target)
	}
}

if (typeof globalThis.ResizeObserver === "undefined") {
	globalThis.ResizeObserver = ResizeObserverMock
}

// jsdom 同样没有实现滚动 API；组件在 effect 中调用它时不应让测试进程
// 因环境缺失而抛出异常。
if (typeof Element.prototype.scrollIntoView !== "function") {
	Element.prototype.scrollIntoView = (): void => undefined
}

// jsdom 不提供响应式媒体查询 API；主题、布局和可访问性组件可能会在挂载时
// 读取它，因此测试环境提供一个符合 MediaQueryList 接口的静态实现。
if (typeof window.matchMedia !== "function") {
	window.matchMedia = (query: string): MediaQueryList => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		dispatchEvent: () => false,
	})
}
