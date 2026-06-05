/**
 * LanguageService - Manages language and localization settings
 * Ported from Zoo-Code with VertexAI naming
 */
export interface LanguageConfig {
    language: string;
}
export declare const DEFAULT_LANGUAGE_CONFIG: LanguageConfig;
export declare const SUPPORTED_LANGUAGES: {
    code: string;
    name: string;
}[];
export declare class LanguageService {
    private config;
    constructor(config?: Partial<LanguageConfig>);
    getConfig(): LanguageConfig;
    updateConfig(updates: Partial<LanguageConfig>): void;
    getLanguage(): string;
    setLanguage(language: string): void;
    getSupportedLanguages(): typeof SUPPORTED_LANGUAGES;
    isLanguageSupported(language: string): boolean;
    getCurrentLanguageName(): string;
}
//# sourceMappingURL=index.d.ts.map