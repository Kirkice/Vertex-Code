import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:opacity-80", {
    variants: {
        variant: {
            primary: "bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]",
            secondary: "bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]",
            ghost: "hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]",
            destructive: "bg-[var(--vscode-errorForeground)] text-white hover:opacity-80",
            outline: "border border-[var(--vscode-input-border)] text-[var(--vscode-foreground)] bg-transparent hover:bg-[var(--vscode-list-hoverBackground)]",
            link: "text-[var(--vscode-textLink-foreground)] underline-offset-4 hover:underline",
            combobox: "border border-[var(--vscode-dropdown-border)] focus-visible:border-[var(--vscode-focusBorder)] bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] font-normal",
        },
        size: {
            default: "h-7 px-3",
            sm: "h-6 px-2 text-xs",
            lg: "h-8 px-4",
            icon: "h-7 w-7",
        },
    },
    defaultVariants: {
        variant: "secondary",
        size: "default",
    },
});
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return _jsx(Comp, { className: cn(buttonVariants({ variant, size, className })), ref: ref, ...props });
});
Button.displayName = "Button";
export { Button, buttonVariants };
