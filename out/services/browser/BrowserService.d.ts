/**
 * BrowserService - Browser automation using Playwright
 * Provides screenshot, click, type, and navigation capabilities
 */
import type { BrowserConfig, BrowserState, BrowserActionResult, NavigateOptions, ClickOptions, TypeOptions, ScreenshotOptions, WaitForSelectorOptions, ScrollOptions } from "./types";
export declare class BrowserService {
    private browser;
    private page;
    private context;
    private config;
    constructor(config?: BrowserConfig);
    /**
     * Get current browser state
     */
    getState(): BrowserState;
    /**
     * Launch browser
     */
    launch(): Promise<BrowserActionResult>;
    /**
     * Close browser
     */
    close(): Promise<BrowserActionResult>;
    /**
     * Navigate to URL
     */
    navigate(options: NavigateOptions): Promise<BrowserActionResult>;
    /**
     * Click on element
     */
    click(options: ClickOptions): Promise<BrowserActionResult>;
    /**
     * Type text into element
     */
    type(options: TypeOptions): Promise<BrowserActionResult>;
    /**
     * Take screenshot
     */
    screenshot(options?: ScreenshotOptions): Promise<BrowserActionResult>;
    /**
     * Get page content
     */
    getContent(): Promise<BrowserActionResult>;
    /**
     * Wait for selector
     */
    waitForSelector(options: WaitForSelectorOptions): Promise<BrowserActionResult>;
    /**
     * Scroll page or element
     */
    scroll(options: ScrollOptions): Promise<BrowserActionResult>;
    /**
     * Hover over element
     */
    hover(selector: string): Promise<BrowserActionResult>;
    /**
     * Select option from dropdown
     */
    select(selector: string, value: string): Promise<BrowserActionResult>;
}
//# sourceMappingURL=BrowserService.d.ts.map