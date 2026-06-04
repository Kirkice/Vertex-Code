import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from "react";
import { useVSCode } from "./hooks/useVSCode";
import MarkdownBlock from "./components/common/MarkdownBlock";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./components/ui/collapsible";
import { TooltipProvider } from "./components/ui/tooltip";
import { Send, Trash2, Plus, ChevronDown, ChevronRight, Bot, User, Settings, Loader2, Brain, Copy, Check, Zap, } from "lucide-react";
import { cn } from "./lib/utils";
import "./index.css";
/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PREDEFINED_MODELS = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-4", name: "GPT-4" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    ],
    custom: [{ id: "custom-model", name: "Custom Model" }],
};
const DEFAULT_MODE = "code";
const MAX_CONTEXT_TOKENS = 128000;
/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function estimateTokens(messages) {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
}
function extractReasoningBlocks(content) {
    const reasoningPattern = /```reasoning\n([\s\S]*?)```/g;
    const reasoningBlocks = [];
    let mainContent = content;
    let match;
    while ((match = reasoningPattern.exec(content)) !== null) {
        reasoningBlocks.push(match[1].trim());
        mainContent = mainContent.replace(match[0], "").trim();
    }
    return { reasoning: reasoningBlocks, mainContent };
}
function formatTokenCount(tokens) {
    return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
}
/* ------------------------------------------------------------------ */
/*  Assistant message sub-component                                    */
/* ------------------------------------------------------------------ */
function AssistantMessage({ content }) {
    const { reasoning, mainContent } = extractReasoningBlocks(content);
    const [reasoningOpen, setReasoningOpen] = useState(false);
    return (_jsxs("div", { className: "space-y-2", children: [reasoning.length > 0 && (_jsxs(Collapsible, { open: reasoningOpen, onOpenChange: setReasoningOpen, children: [_jsxs(CollapsibleTrigger, { className: "flex items-center gap-1.5 text-[11px] text-vscode-description cursor-pointer hover:text-vscode-foreground transition-colors", children: [reasoningOpen ? _jsx(ChevronDown, { className: "w-3 h-3" }) : _jsx(ChevronRight, { className: "w-3 h-3" }), _jsx(Brain, { className: "w-3 h-3" }), _jsxs("span", { children: ["Thinking (", reasoning.length, " blocks)"] })] }), _jsx(CollapsibleContent, { children: _jsx("div", { className: "mt-2 pl-4 border-l-2 border-vscode-border", children: reasoning.map((block, i) => (_jsx("pre", { className: "text-xs text-vscode-description whitespace-pre-wrap font-mono", children: block }, i))) }) })] })), _jsx(MarkdownBlock, { markdown: mainContent })] }));
}
/* ------------------------------------------------------------------ */
/*  Select component                                                   */
/* ------------------------------------------------------------------ */
function SelectField({ label, value, onChange, children, }) {
    return (_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-[11px] text-vscode-description uppercase font-medium", children: label }), _jsx("select", { value: value, onChange: onChange, className: "w-full h-7 px-2 rounded text-xs bg-vscode-input-bg border border-vscode-input-border text-vscode-foreground focus:border-vscode-focus outline-none", children: children })] }));
}
/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
function App() {
    const { postMessage, onMessage } = useVSCode();
    const chatContainerRef = useRef(null);
    const textareaRef = useRef(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [modes, setModes] = useState([]);
    const [currentMode, setCurrentMode] = useState(DEFAULT_MODE);
    const [modeSummary, setModeSummary] = useState(null);
    const [provider, setProvider] = useState("openai");
    const [model, setModel] = useState("gpt-4o-mini");
    const [models, setModels] = useState(PREDEFINED_MODELS.openai);
    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState("");
    const [configStatus, setConfigStatus] = useState("⚠ No API Key — Demo mode");
    const [configStatusType, setConfigStatusType] = useState("warning");
    const usedTokens = estimateTokens(messages);
    const contextPercentage = Math.min((usedTokens / MAX_CONTEXT_TOKENS) * 100, 100);
    /* ---------- Scroll management ---------- */
    const scrollToBottom = useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);
    useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);
    /* ---------- Message handlers ---------- */
    useEffect(() => {
        const offs = [];
        offs.push(onMessage("modesList", (m) => {
            const nm = m.modes || [];
            setModes(nm);
            const nc = m.currentMode || nm[0]?.slug || DEFAULT_MODE;
            setCurrentMode(nc);
            const matched = nm.find((x) => x.slug === nc);
            if (matched) {
                setModeSummary((prev) => ({
                    name: matched.name,
                    description: matched.description,
                    enabledTools: prev?.enabledTools || [],
                    disabledTools: prev?.disabledTools || [],
                }));
            }
        }));
        offs.push(onMessage("modeSummary", (m) => {
            setCurrentMode(m.slug);
            setModeSummary(m.summary);
        }));
        offs.push(onMessage("assistantReply", (m) => {
            setMessages((prev) => [...prev, {
                    id: `${Date.now()}-a`, role: "assistant", content: m.content, timestamp: Date.now(),
                }]);
            setIsLoading(false);
        }));
        offs.push(onMessage("clearChat", () => { setMessages([]); setIsLoading(false); }));
        const updateConfig = (m) => {
            const np = m.provider || "openai";
            setProvider(np);
            const nm = PREDEFINED_MODELS[np] || [];
            setModels(nm);
            setModel(m.model || nm[0]?.id || "gpt-4o-mini");
            if (m.apiKey) {
                setConfigStatus("✓ API Key configured");
                setConfigStatusType("success");
            }
            else {
                setConfigStatus("⚠ No API Key — Demo mode");
                setConfigStatusType("warning");
            }
        };
        offs.push(onMessage("providerInfo", updateConfig));
        offs.push(onMessage("modelsList", (m) => {
            setModels(m.models || []);
            if (m.currentModel)
                setModel(m.currentModel);
        }));
        offs.push(onMessage("profilesList", (m) => setProfiles(m.profiles || [])));
        offs.push(onMessage("currentConfig", updateConfig));
        postMessage({ type: "getCurrentConfig" });
        postMessage({ type: "getProfiles" });
        postMessage({ type: "getModels" });
        return () => offs.forEach((fn) => fn());
    }, [onMessage, postMessage]);
    /* ---------- Actions ---------- */
    const handleSend = () => {
        const text = input.trim();
        if (!text || isLoading)
            return;
        setMessages((prev) => [...prev, {
                id: `${Date.now()}-u`, role: "user", content: text, timestamp: Date.now(),
            }]);
        setInput("");
        setIsLoading(true);
        postMessage({ type: "sendMessage", text });
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const handleInputChange = (e) => {
        setInput(e.target.value);
        const ta = e.target;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
    };
    const handleCopyMessage = async (id, content) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        }
        catch { /* noop */ }
    };
    const handleModeChange = (e) => {
        const slug = e.target.value;
        setCurrentMode(slug);
        postMessage({ type: "switchMode", slug });
    };
    const handleProviderChange = (e) => {
        const np = e.target.value;
        const nm = PREDEFINED_MODELS[np] || [];
        const nmdl = nm[0]?.id || "custom-model";
        setProvider(np);
        setModels(nm);
        setModel(nmdl);
        postMessage({ type: "switchProvider", provider: np });
        postMessage({ type: "switchModel", model: nmdl });
    };
    const handleModelChange = (e) => {
        setModel(e.target.value);
        postMessage({ type: "switchModel", model: e.target.value });
    };
    const handleProfileChange = (e) => {
        const name = e.target.value;
        setSelectedProfile(name);
        if (name)
            postMessage({ type: "selectProfile", profileName: name });
    };
    const handleNewChat = () => {
        postMessage({ type: "newChat" });
        setMessages([]);
        setIsLoading(false);
    };
    const handleClearChat = () => {
        postMessage({ type: "clearChat" });
        setMessages([]);
        setIsLoading(false);
    };
    /* ================================================================== */
    /*  RENDER                                                             */
    /* ================================================================== */
    return (_jsx(TooltipProvider, { children: _jsxs("div", { className: "flex flex-col h-full bg-vscode-sidebar text-vscode-foreground", children: [_jsxs("header", { className: "flex items-center justify-between px-3 py-2 border-b border-vscode-border bg-vscode-background shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Zap, { className: "w-4 h-4 text-vscode-button" }), _jsx("span", { className: "font-semibold text-sm", children: "VertexAI" }), modeSummary && (_jsx(Badge, { variant: "secondary", className: "text-[10px] py-0 px-1.5", children: modeSummary.name }))] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-6 w-6", onClick: handleNewChat, title: "New Chat", children: _jsx(Plus, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-6 w-6", onClick: handleClearChat, title: "Clear Chat", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-6 w-6", onClick: () => setShowSettings(!showSettings), title: "Settings", children: _jsx(Settings, { className: "w-3.5 h-3.5" }) })] })] }), showSettings && (_jsxs("div", { className: "border-b border-vscode-border bg-vscode-background p-3 space-y-3 shrink-0", children: [_jsx(SelectField, { label: "Mode", value: currentMode, onChange: handleModeChange, children: modes.map((m) => _jsx("option", { value: m.slug, children: m.name }, m.slug)) }), _jsxs(SelectField, { label: "Provider", value: provider, onChange: handleProviderChange, children: [_jsx("option", { value: "openai", children: "OpenAI" }), _jsx("option", { value: "anthropic", children: "Anthropic" }), _jsx("option", { value: "custom", children: "Custom" })] }), _jsx(SelectField, { label: "Model", value: model, onChange: handleModelChange, children: models.map((m) => _jsx("option", { value: m.id, children: m.name }, m.id)) }), _jsxs(SelectField, { label: "Profile", value: selectedProfile, onChange: handleProfileChange, children: [_jsx("option", { value: "", children: "\u2014 Select Profile \u2014" }), profiles.map((p) => _jsx("option", { value: p.name, children: p.name }, p.name))] }), _jsx("div", { className: cn("text-[11px]", {
                                "text-vscode-success": configStatusType === "success",
                                "text-vscode-warning": configStatusType === "warning",
                                "text-vscode-error": configStatusType === "error",
                            }), children: configStatus })] })), messages.length > 0 && (_jsxs("div", { className: "px-3 py-1.5 border-b border-vscode-border shrink-0", children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] text-vscode-description mb-1", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Brain, { className: "w-3 h-3" }), " Context Window"] }), _jsxs("span", { className: cn({
                                        "text-vscode-warning": contextPercentage >= 80,
                                        "text-vscode-error": contextPercentage >= 95,
                                    }), children: [formatTokenCount(usedTokens), " / ", formatTokenCount(MAX_CONTEXT_TOKENS), " (", contextPercentage.toFixed(1), "%)"] })] }), _jsx(Progress, { value: contextPercentage, className: "h-1" })] })), _jsxs("div", { ref: chatContainerRef, className: "flex-1 overflow-y-auto p-3 space-y-4 min-h-0", children: [messages.length === 0 && !isLoading ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center space-y-4 py-12", children: [_jsx("div", { className: "w-16 h-16 rounded-full bg-vscode-input-bg flex items-center justify-center", children: _jsx(Bot, { className: "w-8 h-8 text-vscode-button" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-vscode-foreground mb-1", children: "Welcome to VertexAI" }), _jsx("p", { className: "text-xs text-vscode-description max-w-[280px] leading-relaxed", children: "AI assistant focused on game development, graphics rendering, performance optimization, and graphics academia." })] }), _jsxs("div", { className: "flex flex-wrap gap-2 justify-center mt-2", children: [_jsx(Badge, { variant: "secondary", className: "text-[10px]", children: "Shader Dev" }), _jsx(Badge, { variant: "secondary", className: "text-[10px]", children: "Renderer" }), _jsx(Badge, { variant: "secondary", className: "text-[10px]", children: "Academia" }), _jsx(Badge, { variant: "secondary", className: "text-[10px]", children: "Code" })] })] })) : (messages.map((message) => (_jsxs("div", { className: cn("group", message.role === "user" ? "ml-4" : "mr-4"), children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1", children: [message.role === "user"
                                            ? _jsx(User, { className: "w-3.5 h-3.5 text-vscode-button" })
                                            : _jsx(Bot, { className: "w-3.5 h-3.5 text-vscode-link" }), _jsx("span", { className: "text-[11px] font-medium text-vscode-description", children: message.role === "user" ? "You" : "VertexAI" }), message.role === "assistant" && (_jsx(Button, { variant: "ghost", size: "icon", className: "h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity", onClick: () => handleCopyMessage(message.id, message.content), children: copiedId === message.id
                                                ? _jsx(Check, { className: "w-3 h-3 text-vscode-success" })
                                                : _jsx(Copy, { className: "w-3 h-3" }) }))] }), _jsx("div", { className: cn("rounded-lg px-3 py-2.5 text-sm", message.role === "user"
                                        ? "bg-vscode-input-bg border border-vscode-input-border"
                                        : "bg-vscode-background border border-vscode-border"), children: message.role === "user"
                                        ? _jsx("p", { className: "whitespace-pre-wrap leading-relaxed", children: message.content })
                                        : _jsx(AssistantMessage, { content: message.content, messageId: message.id }) })] }, message.id)))), isLoading && (_jsxs("div", { className: "mr-4", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1", children: [_jsx(Bot, { className: "w-3.5 h-3.5 text-vscode-link" }), _jsx("span", { className: "text-[11px] font-medium text-vscode-description", children: "VertexAI" })] }), _jsxs("div", { className: "rounded-lg bg-vscode-background border border-vscode-border px-3 py-2.5 flex items-center gap-2 text-sm text-vscode-description", children: [_jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-vscode-button" }), _jsx("span", { className: "text-xs", children: "Thinking..." })] })] }))] }), _jsxs("div", { className: "border-t border-vscode-border bg-vscode-background p-3 shrink-0", children: [_jsxs("div", { className: "flex items-end gap-2", children: [_jsx("textarea", { ref: textareaRef, value: input, onChange: handleInputChange, onKeyDown: handleKeyDown, placeholder: "Ask VertexAI... (Enter to send, Shift+Enter for newline)", disabled: isLoading, rows: 1, className: "flex-1 min-h-[36px] max-h-[150px] px-3 py-2 rounded-lg text-sm bg-vscode-input-bg border border-vscode-input-border text-vscode-foreground placeholder:text-vscode-input-placeholder focus:border-vscode-focus outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed" }), _jsx(Button, { variant: "primary", size: "icon", className: "h-9 w-9 shrink-0 rounded-lg", onClick: handleSend, disabled: !input.trim() || isLoading, children: _jsx(Send, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "flex items-center justify-between mt-1.5 text-[10px] text-vscode-description", children: [_jsxs("span", { children: ["VertexAI \u00B7 ", model] }), _jsx("span", { children: input.length > 0 ? `${input.length} chars` : "" })] })] })] }) }));
}
export default App;
