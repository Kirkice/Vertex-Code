/**
 * NotificationService - Manages notification settings (sound and TTS)
 * Ported from Zoo-Code with VertexAI naming
 */
export interface NotificationConfig {
    ttsEnabled: boolean;
    ttsSpeed: number;
    soundEnabled: boolean;
    soundVolume: number;
}
export declare const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig;
export declare class NotificationService {
    private config;
    constructor(config?: Partial<NotificationConfig>);
    getConfig(): NotificationConfig;
    updateConfig(updates: Partial<NotificationConfig>): void;
    isTtsEnabled(): boolean;
    setTtsEnabled(enabled: boolean): void;
    getTtsSpeed(): number;
    setTtsSpeed(speed: number): void;
    isSoundEnabled(): boolean;
    setSoundEnabled(enabled: boolean): void;
    getSoundVolume(): number;
    setSoundVolume(volume: number): void;
}
//# sourceMappingURL=index.d.ts.map