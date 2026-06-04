import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
    return (_jsx("textarea", { className: cn("flex min-h-[60px] w-full rounded-md border border-[var(--vscode-input-border)] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[var(--vscode-input-placeholderForeground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)] disabled:cursor-not-allowed disabled:opacity-50", className), ref: ref, ...props }));
});
Textarea.displayName = "Textarea";
export { Textarea };
