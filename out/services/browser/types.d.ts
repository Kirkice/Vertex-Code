/**
 * Browser Service Types
 * Defines browser automation operations
 */
export type BrowserAction = "launch" | "close" | "navigate" | "click" | "type" | "screenshot" | "getContent" | "waitForSelector" | "scroll" | "hover" | "select";
export interface BrowserConfig {
    headless?: boolean;
    defaultViewport?: {
        width: number;
        height: number;
    };
    args?: string[];
    executablePath?: string;
    timeout?: number;
}
export interface BrowserState {
    isLaunched: boolean;
    currentUrl?: string;
    pageTitle?: string;
}
export interface BrowserActionResult {
    success: boolean;
    data?: any;
    error?: string;
    screenshot?: string;
}
export interface NavigateOptions {
    url: string;
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
}
export interface ClickOptions {
    selector: string;
    waitForNavigation?: boolean;
    timeout?: number;
}
export interface TypeOptions {
    selector: string;
    text: string;
    clearFirst?: boolean;
    delay?: number;
}
export interface ScreenshotOptions {
    fullPage?: boolean;
    selector?: string;
    encoding?: "base64" | "binary";
}
export interface WaitForSelectorOptions {
    selector: string;
    visible?: boolean;
    hidden?: boolean;
    timeout?: number;
}
export interface ScrollOptions {
    x?: number;
    y?: number;
    selector?: string;
}
//# sourceMappingURL=types.d.ts.map