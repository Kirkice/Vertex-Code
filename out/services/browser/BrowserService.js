"use strict";
/**
 * BrowserService - Browser automation using Playwright
 * Provides screenshot, click, type, and navigation capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserService = void 0;
const playwright_1 = require("playwright");
class BrowserService {
    constructor(config = {}) {
        this.browser = null;
        this.page = null;
        this.context = null;
        this.config = {
            headless: true,
            defaultViewport: { width: 1280, height: 720 },
            timeout: 30000,
            ...config,
        };
    }
    /**
     * Get current browser state
     */
    getState() {
        return {
            isLaunched: this.browser !== null,
            currentUrl: this.page?.url(),
            pageTitle: undefined, // Would need async call
        };
    }
    /**
     * Launch browser
     */
    async launch() {
        try {
            if (this.browser) {
                return { success: true, data: "Browser already launched" };
            }
            this.browser = await playwright_1.chromium.launch({
                headless: this.config.headless,
                executablePath: this.config.executablePath,
                args: this.config.args,
            });
            this.context = await this.browser.newContext({
                viewport: this.config.defaultViewport,
            });
            this.page = await this.context.newPage();
            return { success: true, data: "Browser launched successfully" };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Close browser
     */
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                this.context = null;
            }
            return { success: true, data: "Browser closed" };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to close browser: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Navigate to URL
     */
    async navigate(options) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            const waitUntil = options.waitUntil === "networkidle0" || options.waitUntil === "networkidle2"
                ? "networkidle"
                : options.waitUntil || "load";
            await this.page.goto(options.url, {
                waitUntil: waitUntil,
                timeout: options.timeout || this.config.timeout,
            });
            return {
                success: true,
                data: {
                    url: this.page.url(),
                    title: await this.page.title(),
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Click on element
     */
    async click(options) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            await this.page.click(options.selector, {
                timeout: options.timeout || this.config.timeout,
            });
            if (options.waitForNavigation) {
                await this.page.waitForLoadState("networkidle");
            }
            return { success: true, data: `Clicked: ${options.selector}` };
        }
        catch (error) {
            return {
                success: false,
                error: `Click failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Type text into element
     */
    async type(options) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            if (options.clearFirst) {
                await this.page.fill(options.selector, "");
            }
            await this.page.type(options.selector, options.text, {
                delay: options.delay || 0,
                timeout: this.config.timeout,
            });
            return { success: true, data: `Typed into: ${options.selector}` };
        }
        catch (error) {
            return {
                success: false,
                error: `Type failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Take screenshot
     */
    async screenshot(options = {}) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            const screenshotOptions = {
                encoding: "base64",
                fullPage: options.fullPage || false,
            };
            if (options.selector) {
                const element = await this.page.$(options.selector);
                if (!element) {
                    return { success: false, error: `Element not found: ${options.selector}` };
                }
                screenshotOptions.clip = await element.boundingBox();
            }
            const screenshot = await this.page.screenshot(screenshotOptions);
            return {
                success: true,
                screenshot: String(screenshot),
                data: "Screenshot captured",
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Get page content
     */
    async getContent() {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            const content = await this.page.content();
            const textContent = await this.page.evaluate(() => document.body.innerText);
            return {
                success: true,
                data: {
                    html: content,
                    text: textContent,
                    url: this.page.url(),
                    title: await this.page.title(),
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Get content failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Wait for selector
     */
    async waitForSelector(options) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            await this.page.waitForSelector(options.selector, {
                state: options.hidden ? "hidden" : options.visible ? "visible" : "attached",
                timeout: options.timeout || this.config.timeout,
            });
            return { success: true, data: `Selector found: ${options.selector}` };
        }
        catch (error) {
            return {
                success: false,
                error: `Wait for selector failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Scroll page or element
     */
    async scroll(options) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            if (options.selector) {
                const sel = options.selector;
                const scrollX = options.x || 0;
                const scrollY = options.y || 0;
                await this.page.evaluate((args) => {
                    const element = document.querySelector(args.sel);
                    if (element) {
                        element.scrollLeft = args.scrollX;
                        element.scrollTop = args.scrollY;
                    }
                }, { sel, scrollX, scrollY });
            }
            else {
                const scrollX = options.x || 0;
                const scrollY = options.y || 0;
                await this.page.evaluate((args) => {
                    window.scrollTo(args.scrollX, args.scrollY);
                }, { scrollX, scrollY });
            }
            return { success: true, data: "Scrolled successfully" };
        }
        catch (error) {
            return {
                success: false,
                error: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Hover over element
     */
    async hover(selector) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            await this.page.hover(selector, { timeout: this.config.timeout });
            return { success: true, data: `Hovered: ${selector}` };
        }
        catch (error) {
            return {
                success: false,
                error: `Hover failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Select option from dropdown
     */
    async select(selector, value) {
        if (!this.page) {
            return { success: false, error: "Browser not launched" };
        }
        try {
            await this.page.selectOption(selector, value, { timeout: this.config.timeout });
            return { success: true, data: `Selected: ${value} in ${selector}` };
        }
        catch (error) {
            return {
                success: false,
                error: `Select failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
exports.BrowserService = BrowserService;
//# sourceMappingURL=BrowserService.js.map