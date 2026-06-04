import { jsx as _jsx } from "react/jsx-runtime";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
const MarkdownBlock = memo(({ markdown }) => {
    const components = useMemo(() => ({
        table: ({ children, ...props }) => (_jsx("div", { className: "overflow-x-auto my-2", children: _jsx("table", { ...props, children: children }) })),
        a: ({ href, children, ...props }) => {
            const handleClick = (e) => {
                const isLocalPath = href?.startsWith("file://") || href?.startsWith("/") || !href?.includes("://");
                if (!isLocalPath)
                    return;
                e.preventDefault();
            };
            return (_jsx("a", { ...props, href: href, onClick: handleClick, className: "text-vscode-link hover:underline", children: children }));
        },
        pre: ({ children, ..._props }) => {
            const codeEl = children;
            if (!codeEl || !codeEl.props) {
                return _jsx("pre", { children: children });
            }
            const { className = "", children: codeChildren } = codeEl.props;
            let codeString = "";
            if (typeof codeChildren === "string") {
                codeString = codeChildren;
            }
            else if (Array.isArray(codeChildren)) {
                codeString = codeChildren.filter((child) => typeof child === "string").join("");
            }
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : "text";
            return (_jsx("div", { style: { margin: "1em 0" }, children: _jsx("pre", { className: className !== "text" ? "pt-7" : "", children: _jsx("code", { className: className, children: codeString }) }) }));
        },
        code: ({ children, className, ...props }) => (_jsx("code", { className: className, ...props, children: children })),
    }), []);
    return (_jsx("div", { className: "markdown-content", children: _jsx(ReactMarkdown, { remarkPlugins: [[remarkGfm, { singleTilde: false }], remarkMath], rehypePlugins: [rehypeKatex, rehypeHighlight], components: components, children: markdown || "" }) }));
});
MarkdownBlock.displayName = "MarkdownBlock";
export default MarkdownBlock;
