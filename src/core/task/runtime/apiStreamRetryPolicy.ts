export type ApiStreamRetryAction = "context_window" | "automatic" | "user_confirmation"

export interface ApiStreamRetryPolicyOptions {
	contextWindowExceeded: boolean
	retryAttempt: number
	maxContextWindowRetries: number
	autoApprovalEnabled: boolean
}

/**
 * Selects the first-chunk recovery path without performing any side effects.
 */
export function getApiStreamRetryAction(options: ApiStreamRetryPolicyOptions): ApiStreamRetryAction {
	if (options.contextWindowExceeded && options.retryAttempt < options.maxContextWindowRetries) {
		return "context_window"
	}

	return options.autoApprovalEnabled ? "automatic" : "user_confirmation"
}
