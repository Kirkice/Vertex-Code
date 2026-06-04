import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = React.forwardRef(({ className, ...props }, ref) => (_jsx(CollapsiblePrimitive.CollapsibleContent, { ref: ref, className: "overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down", ...props })));
CollapsibleContent.displayName = CollapsiblePrimitive.CollapsibleContent.displayName;
export { Collapsible, CollapsibleTrigger, CollapsibleContent };
