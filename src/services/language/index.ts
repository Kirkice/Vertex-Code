/**
 * LanguageService - Manages language and localization settings
 * Ported from Zoo-Code with VertexAI naming
 */

export interface LanguageConfig {
	language: string
}

export const DEFAULT_LANGUAGE_CONFIG: LanguageConfig = {
	language: "en",
}

export const SUPPORTED_LANGUAGES = [
	{ code: "en", name: "English" },
	{ code: "zh-CN", name: "简体中文" },
	{ code: "zh-TW", name: "繁體中文" },
	{ code: "ja", name: "日本語" },
	{ code: "ko", name: "한국어" },
	{ code: "es", name: "Español" },
	{ code: "fr", name: "Français" },
	{ code: "de", name: "Deutsch" },
	{ code: "pt", name: "Português" },
	{ code: "ru", name: "Русский" },
]

export class LanguageService {
	private config: LanguageConfig

	constructor(config?: Partial<LanguageConfig>) {
		this.config = { ...DEFAULT_LANGUAGE_CONFIG, ...config }
	}

	getConfig(): LanguageConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<LanguageConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	getLanguage(): string {
		return this.config.language
	}

	setLanguage(language: string): void {
		const supported = SUPPORTED_LANGUAGES.find((l) => l.code === language)
		if (supported) {
			this.config.language = language
		}
	}

	getSupportedLanguages(): typeof SUPPORTED_LANGUAGES {
		return [...SUPPORTED_LANGUAGES]
	}

	isLanguageSupported(language: string): boolean {
		return SUPPORTED_LANGUAGES.some((l) => l.code === language)
	}

	getCurrentLanguageName(): string {
		const lang = SUPPORTED_LANGUAGES.find((l) => l.code === this.config.language)
		return lang?.name || "English"
	}
}