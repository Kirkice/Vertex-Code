import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as vscode from "vscode"

import {
	clearVertexToken,
	clearVertexUserInfo,
	disconnectVertex,
	getCachedVertexToken,
	getCachedVertexUserInfo,
	getVertexBaseUrl,
	handleAuthCallback,
	initVertexAuth,
	resolveVertexGatewaySessionToken,
	setVertexToken,
	setVertexUserInfo,
	verifyVertexToken,
} from "../vertex-auth"

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string, defaultValue?: string) => defaultValue),
		})),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
}))

vi.mock("../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe("vertex-auth", () => {
	let mockSecrets: any
	let mockContext: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockFetch.mockReset()

		const secretStore: Record<string, string> = {}
		mockSecrets = {
			get: vi.fn(async (key: string) => secretStore[key]),
			store: vi.fn(async (key: string, value: string) => {
				secretStore[key] = value
			}),
			delete: vi.fn(async (key: string) => {
				delete secretStore[key]
			}),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
		}

		mockContext = {
			secrets: mockSecrets,
		}
	})

	afterEach(async () => {
		await clearVertexToken()
		await clearVertexUserInfo()
		vi.restoreAllMocks()
	})

	describe("getCachedVertexToken", () => {
		it("returns an empty string when no token is set", async () => {
			await clearVertexToken()

			expect(getCachedVertexToken()).toBe("")
		})

		it("preloads the cached token during initialization", async () => {
			await mockSecrets.store("vertex-session-token", "vertex_ext_cached_token")
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ valid: true }),
			})

			await initVertexAuth(mockContext)
			await Promise.resolve()

			expect(getCachedVertexToken()).toBe("vertex_ext_cached_token")
		})
	})

	describe("initVertexAuth", () => {
		it("clears stored user info and token when the cached token is invalid", async () => {
			await mockSecrets.store("vertex-session-token", "vertex_ext_stale_token")
			await mockSecrets.store("vertex-user-name", "Jane Doe")
			await mockSecrets.store("vertex-user-email", "jane@example.com")
			await mockSecrets.store("vertex-user-image", "https://example.com/avatar.png")
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ valid: false }),
			})

			await initVertexAuth(mockContext)

			// Both token and user info should be cleared on a definitive invalid response
			expect(getCachedVertexToken()).toBe("")
			expect(getCachedVertexUserInfo()).toEqual({
				name: undefined,
				email: undefined,
				image: undefined,
			})
		})

		it("clears stored user info and token when backend returns HTTP error (invalid token)", async () => {
			await mockSecrets.store("vertex-session-token", "vertex_ext_stale_token")
			await mockSecrets.store("vertex-user-name", "Jane Doe")
			await mockSecrets.store("vertex-user-email", "jane@example.com")
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
			})

			await initVertexAuth(mockContext)

			expect(getCachedVertexToken()).toBe("")
			expect(getCachedVertexUserInfo()).toEqual({
				name: undefined,
				email: undefined,
				image: undefined,
			})
		})

		it("preserves token and user info when the backend is temporarily unreachable", async () => {
			await mockSecrets.store("vertex-session-token", "vertex_ext_valid_token")
			await mockSecrets.store("vertex-user-name", "Jane Doe")
			await mockSecrets.store("vertex-user-email", "jane@example.com")
			// Simulate a network error during verification
			mockFetch.mockRejectedValueOnce(new Error("Network error"))

			await initVertexAuth(mockContext)

			expect(getCachedVertexToken()).toBe("vertex_ext_valid_token")
			expect(getCachedVertexUserInfo().name).toBe("Jane Doe")
		})

		it("preserves token and user info when verify returns 5xx (transient backend error)", async () => {
			await mockSecrets.store("vertex-session-token", "vertex_ext_valid_token")
			await mockSecrets.store("vertex-user-name", "Jane Doe")
			await mockSecrets.store("vertex-user-email", "jane@example.com")
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				statusText: "Service Unavailable",
			})

			await initVertexAuth(mockContext)

			expect(getCachedVertexToken()).toBe("vertex_ext_valid_token")
			expect(getCachedVertexUserInfo().name).toBe("Jane Doe")
		})
	})

	describe("clearVertexToken", () => {
		it("clears the cached token", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_test_token")

			await clearVertexToken()

			expect(getCachedVertexToken()).toBe("")
		})
	})

	describe("getVertexBaseUrl", () => {
		it("returns the default URL when VERTEX_BASE_URL is not set", () => {
			const originalEnv = process.env.VERTEX_BASE_URL
			delete process.env.VERTEX_BASE_URL

			expect(getVertexBaseUrl()).toBe("https://www.vertex.dev")

			if (originalEnv) {
				process.env.VERTEX_BASE_URL = originalEnv
			}
		})

		it("respects VERTEX_BASE_URL", () => {
			const originalEnv = process.env.VERTEX_BASE_URL
			process.env.VERTEX_BASE_URL = "https://staging.vertex.dev"

			expect(getVertexBaseUrl()).toBe("https://staging.vertex.dev")

			if (originalEnv) {
				process.env.VERTEX_BASE_URL = originalEnv
			} else {
				delete process.env.VERTEX_BASE_URL
			}
		})
	})

	describe("handleAuthCallback", () => {
		it("does not persist a token when backend verification fails", async () => {
			await initVertexAuth(mockContext)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ valid: false }),
			})

			const success = await handleAuthCallback("vertex_ext_fake_token")

			expect(success).toBe(false)
			expect(getCachedVertexToken()).toBe("")
			expect(mockSecrets.store).not.toHaveBeenCalledWith("vertex-session-token", "vertex_ext_fake_token")
		})

		it("persists a token only after backend verification succeeds", async () => {
			await initVertexAuth(mockContext)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ valid: true }),
			})

			const success = await handleAuthCallback("vertex_ext_real_token")

			expect(success).toBe(true)
			expect(getCachedVertexToken()).toBe("vertex_ext_real_token")
			expect(mockSecrets.store).toHaveBeenCalledWith("vertex-session-token", "vertex_ext_real_token")
		})
	})

	describe("verifyVertexToken", () => {
		it("returns 'valid' when the backend confirms the token", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_valid_token")
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ valid: true }),
			})

			expect(await verifyVertexToken()).toBe("valid")
			// Token should NOT be cleared — no side effects
			expect(getCachedVertexToken()).toBe("vertex_ext_valid_token")
		})

		it("returns 'invalid' when the backend reports valid: false", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_invalid_token")
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ valid: false }),
			})

			expect(await verifyVertexToken()).toBe("invalid")
			// No side effects — caller decides what to do
			expect(getCachedVertexToken()).toBe("vertex_ext_invalid_token")
		})

		it("returns 'invalid' when the backend returns 4xx", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_invalid_token")
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
			})

			expect(await verifyVertexToken()).toBe("invalid")
		})

		it("returns 'unreachable' when the backend returns 5xx (transient)", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_token")
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				statusText: "Service Unavailable",
			})

			expect(await verifyVertexToken()).toBe("unreachable")
			expect(getCachedVertexToken()).toBe("vertex_ext_token")
		})

		it("returns 'unreachable' when a network error occurs", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_token")
			mockFetch.mockRejectedValueOnce(new Error("Network error"))

			expect(await verifyVertexToken()).toBe("unreachable")
			// Token must NOT be cleared on network error
			expect(getCachedVertexToken()).toBe("vertex_ext_token")
		})

		it("returns 'invalid' when no token is stored", async () => {
			await initVertexAuth(mockContext)

			expect(await verifyVertexToken()).toBe("invalid")
		})
	})

	describe("setVertexUserInfo", () => {
		it("clears email when passed null", async () => {
			await initVertexAuth(mockContext)
			await setVertexUserInfo({
				name: "Jane Doe",
				email: "jane@example.com",
				image: "https://example.com/avatar.png",
			})

			// Verify email is set
			expect(getCachedVertexUserInfo().email).toBe("jane@example.com")

			// Clear email with null
			await setVertexUserInfo({ email: null })

			// Email should be cleared, but other fields should remain
			const info = getCachedVertexUserInfo()
			expect(info.email).toBeUndefined()
			expect(info.name).toBe("Jane Doe")
			expect(info.image).toBe("https://example.com/avatar.png")
		})

		it("does not clear email when passed undefined", async () => {
			await initVertexAuth(mockContext)
			await setVertexUserInfo({
				name: "Jane Doe",
				email: "jane@example.com",
				image: "https://example.com/avatar.png",
			})

			// Pass undefined for email - should preserve existing value
			await setVertexUserInfo({ name: "John Doe", email: undefined })

			const info = getCachedVertexUserInfo()
			expect(info.email).toBe("jane@example.com")
			expect(info.name).toBe("John Doe")
		})
	})

	describe("resolveVertexGatewaySessionToken", () => {
		it("prefers the cached token over a profile token", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_cached")

			expect(resolveVertexGatewaySessionToken("vertex_ext_profile")).toBe("vertex_ext_cached")
		})

		it("ignores profile tokens after an explicit sign-out clear", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_cached")
			await clearVertexToken()

			expect(resolveVertexGatewaySessionToken("vertex_ext_stale_profile")).toBeUndefined()
		})

		it("falls back to the profile token when the cache is empty and not cleared", async () => {
			await initVertexAuth(mockContext)

			expect(resolveVertexGatewaySessionToken("vertex_ext_profile")).toBe("vertex_ext_profile")
		})
	})

	describe("disconnectVertex", () => {
		it("revokes the current token and clears cached auth state", async () => {
			await initVertexAuth(mockContext)
			await setVertexToken("vertex_ext_real_token")
			await setVertexUserInfo({
				name: "Jane Doe",
				email: "jane@example.com",
				image: "https://example.com/avatar.png",
			})
			mockFetch.mockResolvedValueOnce({ ok: true })

			await disconnectVertex()

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/extension/auth/revoke"),
				expect.objectContaining({
					method: "POST",
					headers: { Authorization: "Bearer vertex_ext_real_token" },
				}),
			)
			expect(getCachedVertexToken()).toBe("")
			expect(getCachedVertexUserInfo()).toEqual({
				name: undefined,
				email: undefined,
				image: undefined,
			})
		})
	})
})
