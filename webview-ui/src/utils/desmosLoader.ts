import type { DesmosNamespace } from "@src/types/desmos"

let loadPromise: Promise<DesmosNamespace> | undefined

export function loadDesmos(scriptUri?: string): Promise<DesmosNamespace> {
	if (typeof window !== "undefined" && window.Desmos) return Promise.resolve(window.Desmos)
	if (!scriptUri) return Promise.reject(new Error("Desmos API script URI is unavailable"))
	if (loadPromise) return loadPromise

	loadPromise = new Promise<DesmosNamespace>((resolve, reject) => {
		const script = document.createElement("script")
		script.src = scriptUri
		script.async = true
		// The production Webview CSP allows extension-local script sources. Do not
		// use strict-dynamic here: this script is intentionally injected after the
		// React bundle has initialized and cannot receive the HTML nonce.
		script.onload = () => {
			if (window.Desmos) resolve(window.Desmos)
			else reject(new Error("Desmos API loaded without a global namespace"))
		}
		script.onerror = () => {
			console.error("[Desmos] Failed to load local API script", {
				uri: scriptUri,
				baseUri: document.baseURI,
				readyState: document.readyState,
			})
			reject(new Error(`Failed to load the local Desmos API (${scriptUri})`))
		}
		document.head.appendChild(script)
	})

	return loadPromise
}

export function resetDesmosLoaderForTests() {
	loadPromise = undefined
}
