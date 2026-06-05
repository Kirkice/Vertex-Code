/**
 * McpHub - Core MCP Server Connection Manager
 * Manages connections to MCP servers via stdio, SSE, or streamable-http transports
 */
import EventEmitter from "events";
import type { McpServerConfig, McpServer, McpTool, McpToolCallResponse, McpResourceResponse } from "./types";
export interface McpHubEvents {
    "server-connected": (server: McpServer) => void;
    "server-disconnected": (serverName: string) => void;
    "server-error": (serverName: string, error: Error) => void;
    "servers-updated": (servers: McpServer[]) => void;
}
export declare class McpHub extends EventEmitter {
    private connections;
    private servers;
    constructor();
    /**
     * Get all registered servers
     */
    getServers(): McpServer[];
    /**
     * Get a specific server by name
     */
    getServer(name: string): McpServer | undefined;
    /**
     * Get all available tools from all connected servers
     */
    getAllTools(): Array<{
        serverName: string;
        tool: McpTool;
    }>;
    /**
     * Connect to an MCP server
     */
    connectServer(config: McpServerConfig): Promise<void>;
    /**
     * Disconnect from an MCP server
     */
    disconnectServer(name: string): Promise<void>;
    /**
     * Disconnect all servers
     */
    disconnectAll(): Promise<void>;
    /**
     * Restart a specific server
     */
    restartServer(name: string): Promise<void>;
    /**
     * Call a tool on an MCP server
     */
    callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<McpToolCallResponse>;
    /**
     * Read a resource from an MCP server
     */
    readResource(serverName: string, uri: string): Promise<McpResourceResponse>;
    /**
     * Create a connection based on config type
     */
    private createConnection;
    /**
     * Fetch tools from a connected server
     */
    private fetchTools;
    /**
     * Fetch resources from a connected server
     */
    private fetchResources;
    /**
     * Fetch resource templates from a connected server
     */
    private fetchResourceTemplates;
    emit<K extends keyof McpHubEvents>(event: K, ...args: Parameters<McpHubEvents[K]>): boolean;
    on<K extends keyof McpHubEvents>(event: K, listener: McpHubEvents[K]): this;
    off<K extends keyof McpHubEvents>(event: K, listener: McpHubEvents[K]): this;
}
//# sourceMappingURL=McpHub.d.ts.map