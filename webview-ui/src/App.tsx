import React, { useEffect, useRef, useState, useCallback } from "react"
import { useVSCode } from "./hooks/useVSCode"
import MarkdownBlock from "./components/common/MarkdownBlock"
import { Button } from "./components/ui/button"
import { Badge } from "./components/ui/badge"
import { Progress } from "./components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./components/ui/collapsible"
import { TooltipProvider } from "./components/ui/tooltip"
import TextareaAutosize from "react-textarea-autosize"
import {
	Send, Trash2, Plus, ChevronDown, ChevronRight,
	Bot, User, Settings, Loader2, Brain, Copy, Check, Zap,
} from "lucide-react"
import { cn } from "./lib/utils"
import "./index.css"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
	id: string
	role: "user" | "assistant"
	content: string
	timestamp: number
}

interface Mode {
	slug: string
	name: string
	description?: string
	toolGroups: Array<string | [string, ...unknown[]]>
}

interface ModeSummary {
	name: string
	description?: string
	enabledTools: string[]
	disabledTools: string[]
}

interface ModelOption {
	id: string
	name: string
}

interface Profile {
	name: string
	provider: "openai" | "anthropic" | "custom"
	apiKey: string
	baseUrl: string
	model: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PREDEFINED_MODELS: Record<string, ModelOption[]> = {
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
}

const DEFAULT_MODE = "code"
const MAX_CONTEXT_TOKENS = 128000

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function estimateTokens(messages: ChatMessage[]) {
	const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
	return Math.ceil(totalChars / 4)
}

function extractReasoningBlocks(content: string) {
	const reasoningPattern = /```reasoning\n([\s\S]*?)```/g
	const reasoningBlocks: string[] = []
	let mainContent = content
	let match
	while ((match = reasoningPattern.exec(content)) !== null) {
		reasoningBlocks.push(match[1].trim())
		mainContent = mainContent.replace(match[0], "").trim()
	}
	return { reasoning: reasoningBlocks, mainContent }
}

function formatTokenCount(tokens: number): string {
	return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString()
}

/* ------------------------------------------------------------------ */
/*  Assistant message sub-component                                    */
/* ------------------------------------------------------------------ */

function AssistantMessage({ content }: { content: string; messageId: string }) {
	const { reasoning, mainContent } = extractReasoningBlocks(content)
	const [reasoningOpen, setReasoningOpen] = useState(false)

	return (
		<div className="space-y-2">
			{reasoning.length > 0 && (
				<Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
					<CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-vscode-description cursor-pointer hover:text-vscode-foreground transition-colors">
						{reasoningOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
						<Brain className="w-3 h-3" />
						<span>Thinking ({reasoning.length} blocks)</span>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="mt-2 pl-4 border-l-2 border-vscode-border">
							{reasoning.map((block, i) => (
								<pre key={i} className="text-xs text-vscode-description whitespace-pre-wrap font-mono">
									{block}
								</pre>
							))}
						</div>
					</CollapsibleContent>
				</Collapsible>
			)}
			<MarkdownBlock markdown={mainContent} />
		</div>
	)
}

/* ------------------------------------------------------------------ */
/*  Select component                                                   */
/* ------------------------------------------------------------------ */

function SelectField({
	label,
	value,
	onChange,
	children,
}: {
	label: string
	value: string
	onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
	children: React.ReactNode
}) {
	return (
		<div className="space-y-1">
			<label className="text-[11px] text-vscode-description uppercase font-medium">{label}</label>
			<select
				value={value}
				onChange={onChange}
				className="w-full h-7 px-2 rounded text-xs bg-vscode-input-bg border border-vscode-input-border text-vscode-foreground focus:border-vscode-focus outline-none"
			>
				{children}
			</select>
		</div>
	)
}

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */

function App() {
	const { postMessage, onMessage } = useVSCode()
	const chatContainerRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)

	const [modes, setModes] = useState<Mode[]>([])
	const [currentMode, setCurrentMode] = useState(DEFAULT_MODE)
	const [modeSummary, setModeSummary] = useState<ModeSummary | null>(null)

	const [provider, setProvider] = useState<"openai" | "anthropic" | "custom">("openai")
	const [model, setModel] = useState("gpt-4o-mini")
	const [models, setModels] = useState<ModelOption[]>(PREDEFINED_MODELS.openai)
	const [profiles, setProfiles] = useState<Profile[]>([])
	const [selectedProfile, setSelectedProfile] = useState("")
	const [configStatus, setConfigStatus] = useState("⚠ No API Key — Demo mode")
	const [configStatusType, setConfigStatusType] = useState<"success" | "warning" | "error">("warning")

	const usedTokens = estimateTokens(messages)
	const contextPercentage = Math.min((usedTokens / MAX_CONTEXT_TOKENS) * 100, 100)

	/* ---------- Scroll management ---------- */
	const scrollToBottom = useCallback(() => {
		if (chatContainerRef.current) {
			chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
		}
	}, [])

	useEffect(() => { scrollToBottom() }, [messages, isLoading, scrollToBottom])

	/* ---------- Message handlers ---------- */
	useEffect(() => {
		const offs: (() => void)[] = []

		offs.push(onMessage("modesList", (m: { modes: Mode[]; currentMode?: string }) => {
			const nm = m.modes || []
			setModes(nm)
			const nc = m.currentMode || nm[0]?.slug || DEFAULT_MODE
			setCurrentMode(nc)
			const matched = nm.find((x) => x.slug === nc)
			if (matched) {
				setModeSummary((prev) => ({
					name: matched.name,
					description: matched.description,
					enabledTools: prev?.enabledTools || [],
					disabledTools: prev?.disabledTools || [],
				}))
			}
		}))

		offs.push(onMessage("modeSummary", (m: { summary: ModeSummary; slug: string }) => {
			setCurrentMode(m.slug)
			setModeSummary(m.summary)
		}))

		offs.push(onMessage("assistantReply", (m: { content: string }) => {
			setMessages((prev) => [...prev, {
				id: `${Date.now()}-a`, role: "assistant", content: m.content, timestamp: Date.now(),
			}])
			setIsLoading(false)
		}))

		offs.push(onMessage("clearChat", () => { setMessages([]); setIsLoading(false) }))

		const updateConfig = (m: { provider: "openai" | "anthropic" | "custom"; model: string; apiKey?: string }) => {
			const np = m.provider || "openai"
			setProvider(np)
			const nm = PREDEFINED_MODELS[np] || []
			setModels(nm)
			setModel(m.model || nm[0]?.id || "gpt-4o-mini")
			if (m.apiKey) {
				setConfigStatus("✓ API Key configured")
				setConfigStatusType("success")
			} else {
				setConfigStatus("⚠ No API Key — Demo mode")
				setConfigStatusType("warning")
			}
		}

		offs.push(onMessage("providerInfo", updateConfig))
		offs.push(onMessage("modelsList", (m: { models: ModelOption[]; currentModel?: string }) => {
			setModels(m.models || [])
			if (m.currentModel) setModel(m.currentModel)
		}))
		offs.push(onMessage("profilesList", (m: { profiles: Profile[] }) => setProfiles(m.profiles || [])))
		offs.push(onMessage("currentConfig", updateConfig))

		postMessage({ type: "getCurrentConfig" })
		postMessage({ type: "getProfiles" })
		postMessage({ type: "getModels" })

		return () => offs.forEach((fn) => fn())
	}, [onMessage, postMessage])

	/* ---------- Actions ---------- */
	const handleSend = () => {
		const text = input.trim()
		if (!text || isLoading) return
		setMessages((prev) => [...prev, {
			id: `${Date.now()}-u`, role: "user", content: text, timestamp: Date.now(),
		}])
		setInput("")
		setIsLoading(true)
		postMessage({ type: "sendMessage", text })
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value)
		const ta = e.target
		ta.style.height = "auto"
		ta.style.height = Math.min(ta.scrollHeight, 150) + "px"
	}

	const handleCopyMessage = async (id: string, content: string) => {
		try {
			await navigator.clipboard.writeText(content)
			setCopiedId(id)
			setTimeout(() => setCopiedId(null), 1500)
		} catch { /* noop */ }
	}

	const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const slug = e.target.value
		setCurrentMode(slug)
		postMessage({ type: "switchMode", slug })
	}

	const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const np = e.target.value as "openai" | "anthropic" | "custom"
		const nm = PREDEFINED_MODELS[np] || []
		const nmdl = nm[0]?.id || "custom-model"
		setProvider(np); setModels(nm); setModel(nmdl)
		postMessage({ type: "switchProvider", provider: np })
		postMessage({ type: "switchModel", model: nmdl })
	}

	const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setModel(e.target.value)
		postMessage({ type: "switchModel", model: e.target.value })
	}

	const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const name = e.target.value
		setSelectedProfile(name)
		if (name) postMessage({ type: "selectProfile", profileName: name })
	}

	const handleNewChat = () => {
		postMessage({ type: "newChat" })
		setMessages([]); setIsLoading(false)
	}

	const handleClearChat = () => {
		postMessage({ type: "clearChat" })
		setMessages([]); setIsLoading(false)
	}

	/* ================================================================== */
	/*  RENDER                                                             */
	/* ================================================================== */

	return (
		<TooltipProvider>
			<div className="flex flex-col h-full bg-vscode-sidebar text-vscode-foreground">

				{/* ── Header ────────────────────────────────────────────── */}
				<header className="flex items-center justify-between px-3 py-2 border-b border-vscode-border bg-vscode-background shrink-0">
					<div className="flex items-center gap-2">
						<Zap className="w-4 h-4 text-vscode-button" />
						<span className="font-semibold text-sm">VertexAI</span>
						{modeSummary && (
							<Badge variant="secondary" className="text-[10px] py-0 px-1.5">
								{modeSummary.name}
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-1">
						<Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNewChat} title="New Chat">
							<Plus className="w-3.5 h-3.5" />
						</Button>
						<Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClearChat} title="Clear Chat">
							<Trash2 className="w-3.5 h-3.5" />
						</Button>
						<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(!showSettings)} title="Settings">
							<Settings className="w-3.5 h-3.5" />
						</Button>
					</div>
				</header>

				{/* ── Settings Panel ────────────────────────────────────── */}
				{showSettings && (
					<div className="border-b border-vscode-border bg-vscode-background p-3 space-y-3 shrink-0">
						<SelectField label="Mode" value={currentMode} onChange={handleModeChange}>
							{modes.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
						</SelectField>
						<SelectField label="Provider" value={provider} onChange={handleProviderChange}>
							<option value="openai">OpenAI</option>
							<option value="anthropic">Anthropic</option>
							<option value="custom">Custom</option>
						</SelectField>
						<SelectField label="Model" value={model} onChange={handleModelChange}>
							{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
						</SelectField>
						<SelectField label="Profile" value={selectedProfile} onChange={handleProfileChange}>
							<option value="">— Select Profile —</option>
							{profiles.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
						</SelectField>
						<div className={cn("text-[11px]", {
							"text-vscode-success": configStatusType === "success",
							"text-vscode-warning": configStatusType === "warning",
							"text-vscode-error": configStatusType === "error",
						})}>
							{configStatus}
						</div>
					</div>
				)}

				{/* ── Context Window Progress ───────────────────────────── */}
				{messages.length > 0 && (
					<div className="px-3 py-1.5 border-b border-vscode-border shrink-0">
						<div className="flex items-center justify-between text-[10px] text-vscode-description mb-1">
							<span className="flex items-center gap-1">
								<Brain className="w-3 h-3" /> Context Window
							</span>
							<span className={cn({
								"text-vscode-warning": contextPercentage >= 80,
								"text-vscode-error": contextPercentage >= 95,
							})}>
								{formatTokenCount(usedTokens)} / {formatTokenCount(MAX_CONTEXT_TOKENS)} ({contextPercentage.toFixed(1)}%)
							</span>
						</div>
						<Progress value={contextPercentage} className="h-1" />
					</div>
				)}

				{/* ── Chat Area ─────────────────────────────────────────── */}
				<div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
					{messages.length === 0 && !isLoading ? (
						<div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
							<div className="w-16 h-16 rounded-full bg-vscode-input-bg flex items-center justify-center">
								<Bot className="w-8 h-8 text-vscode-button" />
							</div>
							<div>
								<h2 className="text-base font-semibold text-vscode-foreground mb-1">
									Welcome to VertexAI
								</h2>
								<p className="text-xs text-vscode-description max-w-[280px] leading-relaxed">
									AI assistant focused on game development, graphics rendering,
									performance optimization, and graphics academia.
								</p>
							</div>
							<div className="flex flex-wrap gap-2 justify-center mt-2">
								<Badge variant="secondary" className="text-[10px]">Shader Dev</Badge>
								<Badge variant="secondary" className="text-[10px]">Renderer</Badge>
								<Badge variant="secondary" className="text-[10px]">Academia</Badge>
								<Badge variant="secondary" className="text-[10px]">Code</Badge>
							</div>
						</div>
					) : (
						messages.map((message) => (
							<div key={message.id} className={cn("group", message.role === "user" ? "ml-4" : "mr-4")}>
								{/* Header */}
								<div className="flex items-center gap-1.5 mb-1">
									{message.role === "user"
										? <User className="w-3.5 h-3.5 text-vscode-button" />
										: <Bot className="w-3.5 h-3.5 text-vscode-link" />}
									<span className="text-[11px] font-medium text-vscode-description">
										{message.role === "user" ? "You" : "VertexAI"}
									</span>
									{message.role === "assistant" && (
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={() => handleCopyMessage(message.id, message.content)}
										>
											{copiedId === message.id
												? <Check className="w-3 h-3 text-vscode-success" />
												: <Copy className="w-3 h-3" />}
										</Button>
									)}
								</div>
								{/* Content */}
								<div className={cn(
									"rounded-lg px-3 py-2.5 text-sm",
									message.role === "user"
										? "bg-vscode-input-bg border border-vscode-input-border"
										: "bg-vscode-background border border-vscode-border",
								)}>
									{message.role === "user"
										? <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
										: <AssistantMessage content={message.content} messageId={message.id} />
									}
								</div>
							</div>
						))
					)}

					{/* Loading */}
					{isLoading && (
						<div className="mr-4">
							<div className="flex items-center gap-1.5 mb-1">
								<Bot className="w-3.5 h-3.5 text-vscode-link" />
								<span className="text-[11px] font-medium text-vscode-description">VertexAI</span>
							</div>
							<div className="rounded-lg bg-vscode-background border border-vscode-border px-3 py-2.5 flex items-center gap-2 text-sm text-vscode-description">
								<Loader2 className="w-3.5 h-3.5 animate-spin text-vscode-button" />
								<span className="text-xs">Thinking...</span>
							</div>
						</div>
					)}
				</div>

				{/* ── Input Area ────────────────────────────────────────── */}
				<div className="shrink-0 px-1.5 pb-1 pt-1 bg-vscode-sidebar">
					<div className="rounded-lg border border-vscode-border bg-vscode-background p-1.5">
						<div className="flex items-end gap-1.5">
							<div className="flex min-w-0 flex-1 flex-col gap-1">
							<TextareaAutosize
								ref={textareaRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask VertexAI... (Enter to send, Shift+Enter for newline)"
								disabled={isLoading}
								minRows={3}
								maxRows={15}
								autoFocus
								className="w-full min-h-[94px] px-3 py-2 rounded-md text-sm bg-vscode-input-bg border border-vscode-input-border text-vscode-foreground placeholder:text-vscode-input-placeholder focus:border-vscode-focus outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed box-border"
							/>
							<div className="flex items-center justify-between px-1 text-[10px] text-vscode-description">
								<span>VertexAI · {model}</span>
								<span>{input.length > 0 ? `${input.length} chars` : ""}</span>
							</div>
							</div>
							<Button
								variant="primary"
								size="icon"
								className="h-9 w-9 shrink-0 rounded-lg self-end"
								onClick={handleSend}
								disabled={!input.trim() || isLoading}
							>
								<Send className="w-4 h-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</TooltipProvider>
	)
}

export default App
