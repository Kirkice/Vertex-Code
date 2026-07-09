import { cn } from "@/lib/utils"

export const ToolUseBlock = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"overflow-hidden rounded-lg p-2 cursor-pointer",
			"bg-[linear-gradient(180deg,color-mix(in_srgb,var(--vscode-textCodeBlock-background)_96%,black),color-mix(in_srgb,var(--vscode-editor-background)_90%,black))]",
			"border shadow-[0_10px_30px_rgba(0,0,0,0.3)]",
			"border-[var(--vertex-theme-border,transparent)]",
			className,
		)}
		{...props}
	/>
)

export const ToolUseBlockHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex font-mono items-center select-none text-sm text-vscode-descriptionForeground",
			"rounded-md px-2 py-1.5 border",
			"border-[var(--vertex-theme-border-soft,transparent)]",
			"bg-[color-mix(in_srgb,var(--vscode-editor-background)_72%,black)]",
			className,
		)}
		{...props}
	/>
)
