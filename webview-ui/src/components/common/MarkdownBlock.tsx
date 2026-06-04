import React, { memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"

interface MarkdownBlockProps {
	markdown?: string
}

const MarkdownBlock = memo(({ markdown }: MarkdownBlockProps) => {
	const components = useMemo(
		() => ({
			table: ({ children, ...props }: any) => (
				<div className="overflow-x-auto my-2">
					<table {...props}>{children}</table>
				</div>
			),
			a: ({ href, children, ...props }: any) => {
				const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
					const isLocalPath = href?.startsWith("file://") || href?.startsWith("/") || !href?.includes("://")
					if (!isLocalPath) return
					e.preventDefault()
				}
				return (
					<a {...props} href={href} onClick={handleClick} className="text-vscode-link hover:underline">
						{children}
					</a>
				)
			},
			pre: ({ children, ...rest }: any) => {
				const codeEl = children as React.ReactElement
				if (!codeEl || !codeEl.props) {
					return <pre {...rest}>{children}</pre>
				}
				const codeProps = codeEl.props as any
				const className = codeProps.className || ""
				const codeChildren = codeProps.children
				let codeString = ""
				if (typeof codeChildren === "string") {
					codeString = codeChildren
				} else if (Array.isArray(codeChildren)) {
					codeString = codeChildren.filter((child) => typeof child === "string").join("")
				}
				return (
					<div style={{ margin: "1em 0" }}>
						<pre className={className !== "" ? "pt-7" : ""}>
							<code className={className}>{codeString}</code>
						</pre>
					</div>
				)
			},
			code: ({ children, className, ...props }: any) => (
				<code className={className} {...props}>
					{children}
				</code>
			),
		}),
		[],
	)

	return (
		<div className="markdown-content">
			<ReactMarkdown
				remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]}
				rehypePlugins={[rehypeKatex as any, rehypeHighlight]}
				components={components}
			>
				{markdown || ""}
			</ReactMarkdown>
		</div>
	)
})

MarkdownBlock.displayName = "MarkdownBlock"

export default MarkdownBlock