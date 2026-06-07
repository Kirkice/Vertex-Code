import * as vscode from "vscode"

import { t } from "../i18n"

const VERTEX_TOKEN_KEY = "vertex-session-token"
const VERTEX_USER_NAME_KEY = "vertex-user-name"
const VERTEX_USER_EMAIL_KEY = "vertex-user-email"
const VERTEX_USER_IMAGE_KEY = "vertex-user-image"

let secretStorage: vscode.SecretStorage | undefined

// In-memory cache for synchronous access in VertexHandler hot path
let _cachedToken: string | undefined = undefined
let _sessionCleared = false
let _cachedUserName: string | undefined = undefined
let _cachedUserEmail: string | undefined = undefined
let _cachedUserImage: string | undefined = undefined

export async function initVertexAuth(context: vscode.ExtensionContext): Promise<void> {
	if (!context.secrets) {
		// Secret storage unavailable (e.g. test environment without secrets mock).
		// Treat as unauthenticated startup — all cached values remain undefined.
		return
	}
	secretStorage = context.secrets

	// Pre-load the token and user info into memory on init so VertexHandler can access them synchronously
	_cachedToken = await secretStorage.get(VERTEX_TOKEN_KEY)
	_sessionCleared = false
	_cachedUserName = await secretStorage.get(VERTEX_USER_NAME_KEY)
	_cachedUserEmail = await secretStorage.get(VERTEX_USER_EMAIL_KEY)
	_cachedUserImage = await secretStorage.get(VERTEX_USER_IMAGE_KEY)

	// Validate persisted auth state on init before reporting the user as connected.
	// Network errors / 5xx ("unreachable") leave the cached session in place so a
	// transient backend blip doesn't force users to sign in again.
	if (_cachedToken) {
		const result = await verifyVertexToken()
		if (result === "invalid") {
			await clearVertexUserInfo()
			await clearVertexToken()
		}
	}

	// Watch for secret changes and update cache
	context.secrets.onDidChange((e) => {
		if (e.key === VERTEX_TOKEN_KEY) {
			secretStorage?.get(VERTEX_TOKEN_KEY).then((token) => {
				_cachedToken = token
			})
		}
		if (e.key === VERTEX_USER_NAME_KEY) {
			secretStorage?.get(VERTEX_USER_NAME_KEY).then((name) => {
				_cachedUserName = name
			})
		}
		if (e.key === VERTEX_USER_EMAIL_KEY) {
			secretStorage?.get(VERTEX_USER_EMAIL_KEY).then((email) => {
				_cachedUserEmail = email
			})
		}
		if (e.key === VERTEX_USER_IMAGE_KEY) {
			secretStorage?.get(VERTEX_USER_IMAGE_KEY).then((image) => {
				_cachedUserImage = image
			})
		}
	})
}

// Synchronous getter for use in VertexHandler (called in hot path during API requests)
export function getCachedVertexToken(): string {
	return _cachedToken ?? ""
}

/**
 * Resolves the Vertex Gateway session token for API calls.
 * Secret-storage cache wins over profile-persisted tokens; after an explicit sign-out
 * or 401 clear, profile tokens are ignored so stale credentials cannot be reused.
 */
export function resolveVertexGatewaySessionToken(profileToken?: string): string | undefined {
	if (_cachedToken) {
		return _cachedToken
	}
	if (_sessionCleared) {
		return undefined
	}
	return profileToken || undefined
}

export function getCachedVertexUserInfo(): { name?: string; email?: string; image?: string } {
	return {
		name: _cachedUserName,
		email: _cachedUserEmail,
		image: _cachedUserImage,
	}
}

export async function getVertexToken(): Promise<string | undefined> {
	if (!secretStorage) return undefined
	return secretStorage.get(VERTEX_TOKEN_KEY)
}

export async function setVertexToken(token: string): Promise<void> {
	if (!secretStorage) return
	await secretStorage.store(VERTEX_TOKEN_KEY, token)
	_cachedToken = token
	_sessionCleared = false
}

export async function setVertexUserInfo(info: {
	name?: string | null
	email?: string | null
	image?: string | null
}): Promise<void> {
	if (!secretStorage) return

	if (info.name) {
		await secretStorage.store(VERTEX_USER_NAME_KEY, info.name)
		_cachedUserName = info.name
	} else if (info.name === null) {
		await secretStorage.delete(VERTEX_USER_NAME_KEY)
		_cachedUserName = undefined
	}

	if (info.email) {
		await secretStorage.store(VERTEX_USER_EMAIL_KEY, info.email)
		_cachedUserEmail = info.email
	} else if (info.email === null) {
		await secretStorage.delete(VERTEX_USER_EMAIL_KEY)
		_cachedUserEmail = undefined
	}

	if (info.image) {
		await secretStorage.store(VERTEX_USER_IMAGE_KEY, info.image)
		_cachedUserImage = info.image
	} else if (info.image === null) {
		await secretStorage.delete(VERTEX_USER_IMAGE_KEY)
		_cachedUserImage = undefined
	}
}

export async function clearVertexUserInfo(): Promise<void> {
	if (!secretStorage) return
	await secretStorage.delete(VERTEX_USER_NAME_KEY)
	await secretStorage.delete(VERTEX_USER_EMAIL_KEY)
	await secretStorage.delete(VERTEX_USER_IMAGE_KEY)
	_cachedUserName = undefined
	_cachedUserEmail = undefined
	_cachedUserImage = undefined
}

export async function clearVertexToken(): Promise<void> {
	if (!secretStorage) return
	await secretStorage.delete(VERTEX_TOKEN_KEY)
	_cachedToken = undefined
	_sessionCleared = true
}

export function getVertexBaseUrl(): string {
	return process.env.VERTEX_BASE_URL || "https://www.vertex.dev"
}

export async function handleAuthCallback(token: string): Promise<boolean> {
	if (!token || !token.startsWith("vertex_ext_")) {
		vscode.window.showErrorMessage(t("common:vertexAuth.errors.invalid_token_received"))
		return false
	}

	// Verify token with backend before storing
	const baseUrl = getVertexBaseUrl()
	try {
		const response = await fetch(`${baseUrl}/api/extension/auth/verify`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(10_000),
		})
		if (!response.ok) {
			// Treat 5xx as a transient backend issue (e.g. DB unreachable) so the
			// user can retry sign-in instead of being told the token is bad.
			if (response.status >= 500) {
				vscode.window.showErrorMessage(t("common:vertexAuth.errors.could_not_verify_token"))
			} else {
				vscode.window.showErrorMessage(t("common:vertexAuth.errors.token_verification_failed"))
			}
			return false
		}
		const data = (await response.json()) as { valid?: boolean }
		if (!data.valid) {
			vscode.window.showErrorMessage(t("common:vertexAuth.errors.invalid_token"))
			return false
		}
	} catch {
		vscode.window.showErrorMessage(t("common:vertexAuth.errors.could_not_verify_token"))
		return false
	}

	await setVertexToken(token)

	vscode.window.showInformationMessage(t("common:vertexAuth.info.connected"))
	return true
}

/**
 * Verify the stored token against the backend.
 * Returns:
 *   - "valid"       — backend confirmed the token is good
 *   - "invalid"     — backend explicitly rejected the token (4xx or valid: false)
 *   - "unreachable" — network error / timeout / 5xx backend error; token state is unknown
 *
 * 5xx responses are treated as transient: the website returns 503 when the
 * database is unreachable, and clearing a real session on a backend hiccup
 * forces users to sign in again every time the API blips.
 *
 * This function has no side-effects; callers are responsible for acting on the result.
 */
export async function verifyVertexToken(): Promise<"valid" | "invalid" | "unreachable"> {
	const token = await getVertexToken()
	if (!token) return "invalid"

	const baseUrl = getVertexBaseUrl()

	try {
		const response = await fetch(`${baseUrl}/api/extension/auth/verify`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(10_000),
		})

		if (!response.ok) {
			if (response.status >= 500) {
				return "unreachable"
			}
			return "invalid"
		}

		const data = (await response.json()) as { valid?: boolean }
		return data.valid === true ? "valid" : "invalid"
	} catch {
		return "unreachable"
	}
}

export async function isVertexAuthenticated(): Promise<boolean> {
	const token = await getVertexToken()
	return !!token
}

export async function disconnectVertex(): Promise<void> {
	const token = await getVertexToken()
	if (token) {
		const baseUrl = getVertexBaseUrl()

		try {
			await fetch(`${baseUrl}/api/extension/auth/revoke`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(10_000),
			})
		} catch {
			// Ignore errors during revocation
		}
	}
	await clearVertexToken()
	await clearVertexUserInfo()
	vscode.window.showInformationMessage(t("common:vertexAuth.info.disconnected"))
}
