"use strict";
/**
 * McpHub - Core MCP Server Connection Manager
 * Manages connections to MCP servers via stdio, SSE, or streamable-http transports
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpHub = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const events_1 = __importDefault(require("events"));
class McpHub extends events_1.default {
    constructor() {
        super();
        this.connections = new Map();
        this.servers = new Map();
    }
    /**
     * Get all registered servers
     */
    getServers() {
        return Array.from(this.servers.values());
    }
    /**
     * Get a specific server by name
     */
    getServer(name) {
        return this.servers.get(name);
    }
    /**
     * Get all available tools from all connected servers
     */
    getAllTools() {
        const tools = [];
        for (const [serverName, server] of this.servers.entries()) {
            if (server.status === "connected" && server.tools) {
                for (const tool of server.tools) {
                    if (tool.enabled !== false) {
                        tools.push({ serverName, tool });
                    }
                }
            }
        }
        return tools;
    }
    /**
     * Connect to an MCP server
     */
    async connectServer(config) {
        const { name } = config;
        if (this.connections.has(name)) {
            console.log(`[McpHub] Server ${name} already connected`);
            return;
        }
        // Initialize server entry
        const server = {
            name,
            config,
            status: "connecting",
        };
        this.servers.set(name, server);
        this.emit("servers-updated", this.getServers());
        try {
            const { client, transport } = await this.createConnection(config);
            // Store connection
            this.connections.set(name, { client, transport, config });
            // Fetch server capabilities
            const tools = await this.fetchTools(client);
            const resources = await this.fetchResources(client);
            const resourceTemplates = await this.fetchResourceTemplates(client);
            // Update server status
            const updatedServer = {
                ...server,
                status: "connected",
                tools,
                resources,
                resourceTemplates,
            };
            this.servers.set(name, updatedServer);
            console.log(`[McpHub] Connected to ${name}: ${tools.length} tools, ${resources.length} resources`);
            this.emit("server-connected", updatedServer);
            this.emit("servers-updated", this.getServers());
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errorServer = {
                ...server,
                status: "error",
                error: err.message,
            };
            this.servers.set(name, errorServer);
            console.error(`[McpHub] Failed to connect to ${name}:`, err.message);
            this.emit("server-error", name, err);
            this.emit("servers-updated", this.getServers());
        }
    }
    /**
     * Disconnect from an MCP server
     */
    async disconnectServer(name) {
        const connection = this.connections.get(name);
        if (connection) {
            try {
                await connection.client.close();
            }
            catch (error) {
                console.error(`[McpHub] Error disconnecting ${name}:`, error);
            }
            this.connections.delete(name);
        }
        this.servers.delete(name);
        this.emit("server-disconnected", name);
        this.emit("servers-updated", this.getServers());
    }
    /**
     * Disconnect all servers
     */
    async disconnectAll() {
        const names = Array.from(this.connections.keys());
        for (const name of names) {
            await this.disconnectServer(name);
        }
    }
    /**
     * Restart a specific server
     */
    async restartServer(name) {
        const server = this.servers.get(name);
        if (!server) {
            throw new Error(`Server ${name} not found`);
        }
        await this.disconnectServer(name);
        await this.connectServer(server.config);
    }
    /**
     * Call a tool on an MCP server
     */
    async callTool(serverName, toolName, args) {
        const connection = this.connections.get(serverName);
        if (!connection) {
            throw new Error(`Server ${serverName} not connected`);
        }
        try {
            const result = await connection.client.callTool({
                name: toolName,
                arguments: args,
            });
            return result;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error(`[McpHub] Tool call failed: ${serverName}.${toolName}:`, err.message);
            return {
                content: [{ type: "text", text: `Error: ${err.message}` }],
                isError: true,
            };
        }
    }
    /**
     * Read a resource from an MCP server
     */
    async readResource(serverName, uri) {
        const connection = this.connections.get(serverName);
        if (!connection) {
            throw new Error(`Server ${serverName} not connected`);
        }
        try {
            const result = await connection.client.readResource({ uri });
            return result;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error(`[McpHub] Resource read failed: ${serverName}:${uri}:`, err.message);
            throw err;
        }
    }
    /**
     * Create a connection based on config type
     */
    async createConnection(config) {
        let transport;
        switch (config.type) {
            case "stdio":
                if (!config.command) {
                    throw new Error("stdio transport requires 'command'");
                }
                transport = new stdio_js_1.StdioClientTransport({
                    command: config.command,
                    args: config.args,
                    env: config.env,
                });
                break;
            case "sse":
                if (!config.url) {
                    throw new Error("sse transport requires 'url'");
                }
                transport = new sse_js_1.SSEClientTransport(new URL(config.url));
                break;
            case "streamable-http":
                // Use SSE transport for streamable-http (similar protocol)
                if (!config.url) {
                    throw new Error("streamable-http transport requires 'url'");
                }
                transport = new sse_js_1.SSEClientTransport(new URL(config.url));
                break;
            default:
                throw new Error(`Unknown transport type: ${config.type}`);
        }
        const client = new index_js_1.Client({
            name: "vertex-ai",
            version: "0.3.0",
        }, {
            capabilities: {},
        });
        await client.connect(transport);
        return { client, transport };
    }
    /**
     * Fetch tools from a connected server
     */
    async fetchTools(client) {
        try {
            const result = await client.listTools();
            return (result.tools || []).map((tool) => ({
                name: tool.name,
                description: tool.description || "",
                inputSchema: tool.inputSchema || {},
                enabled: true,
            }));
        }
        catch (error) {
            console.error("[McpHub] Failed to fetch tools:", error);
            return [];
        }
    }
    /**
     * Fetch resources from a connected server
     */
    async fetchResources(client) {
        try {
            const result = await client.listResources();
            return (result.resources || []).map((resource) => ({
                uri: resource.uri,
                name: resource.name || resource.uri,
                description: resource.description,
                mimeType: resource.mimeType,
            }));
        }
        catch (error) {
            console.error("[McpHub] Failed to fetch resources:", error);
            return [];
        }
    }
    /**
     * Fetch resource templates from a connected server
     */
    async fetchResourceTemplates(client) {
        try {
            const result = await client.listResourceTemplates();
            return (result.resourceTemplates || []).map((template) => ({
                uriTemplate: template.uriTemplate,
                name: template.name || template.uriTemplate,
                description: template.description,
                mimeType: template.mimeType,
            }));
        }
        catch (error) {
            console.error("[McpHub] Failed to fetch resource templates:", error);
            return [];
        }
    }
    // Typed event emitter methods
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
}
exports.McpHub = McpHub;
//# sourceMappingURL=McpHub.js.map