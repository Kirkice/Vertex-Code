/**
 * NotificationService - Manages notification settings (sound and TTS)
 * Ported from Zoo-Code with VertexAI naming
 */

export interface NotificationConfig {
	// TTS settings
	ttsEnabled: boolean
	ttsSpeed: number

	// Sound settings
	soundEnabled: boolean
	soundVolume: number
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
	ttsEnabled: false,
	ttsSpeed: 1.0,
	soundEnabled: true,
	soundVolume: 0.5,
}

export class NotificationService {
	private config: NotificationConfig

	constructor(config?: Partial<NotificationConfig>) {
		this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config }
	}

	getConfig(): NotificationConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<NotificationConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	// TTS settings
	isTtsEnabled(): boolean {
		return this.config.ttsEnabled
	}

	setTtsEnabled(enabled: boolean): void {
		this.config.ttsEnabled = enabled
	}

	getTtsSpeed(): number {
		return Math.min(Math.max(0.5, this.config.ttsSpeed), 2.0)
	}

	setTtsSpeed(speed: number): void {
		this.config.ttsSpeed = Math.min(Math.max(0.5, speed), 2.0)
	}

	// Sound settings
	isSoundEnabled(): boolean {
		return this.config.soundEnabled
	}

	setSoundEnabled(enabled: boolean): void {
		this.config.soundEnabled = enabled
	}

	getSoundVolume(): number {
		return Math.min(Math.max(0, this.config.soundVolume), 1.0)
	}

	setSoundVolume(volume: number): void {
		this.config.soundVolume = Math.min(Math.max(0, volume), 1.0)
	}
}