import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva("inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
    variants: {
        variant: {
            default: "bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-background)]/80",
            secondary: "bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryBackground)]/80",
            destructive: "bg-[var(--vscode-errorForeground)] text-white hover:opacity-80",
            outline: "text-[var(--vscode-foreground)] border-[var(--vscode-input-border)]",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
function Badge({ className, variant, ...props }) {
    return _jsx("div", { className: cn(badgeVariants({ variant }), className), ...props });
}
export { Badge, badgeVariants };
