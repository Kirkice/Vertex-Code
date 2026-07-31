import React, { HTMLAttributes, useCallback, forwardRef, useRef } from "react"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"

type TabProps = HTMLAttributes<HTMLDivElement>

export const Tab = ({ className, children, ...props }: TabProps) => (
	<div className={cn("fixed inset-0 flex flex-col", className)} {...props}>
		{children}
	</div>
)

export const TabHeader = ({ className, children, ...props }: TabProps) => (
	<div className={cn("px-5 py-2.5 border-b border-vscode-panel-border", className)} {...props}>
		{children}
	</div>
)

export const TabContent = forwardRef<HTMLDivElement, TabProps>(({ className, children, ...props }, ref) => {
	const { renderContext } = useExtensionState()

	const onWheel = useCallback(
		(e: React.WheelEvent<HTMLDivElement>) => {
			if (renderContext !== "editor") {
				return
			}

			const target = e.target as HTMLElement

			// Prevent scrolling if the target is a listbox or option
			// (e.g. selects, dropdowns, etc).
			if (target.role === "listbox" || target.role === "option") {
				return
			}

			e.currentTarget.scrollTop += e.deltaY
		},
		[renderContext],
	)

	return (
		<div ref={ref} className={cn("flex-1 overflow-auto p-5", className)} onWheel={onWheel} {...props}>
			{children}
		</div>
	)
})
TabContent.displayName = "TabContent"

export const TabList = forwardRef<
	HTMLDivElement,
	HTMLAttributes<HTMLDivElement> & {
		value: string
		onValueChange: (value: string) => void
	}
>(({ children, className, value, onValueChange, ...props }, ref) => {
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
	const tabs = React.Children.toArray(children).filter(React.isValidElement)

	const focusTab = (index: number) => {
		const nextIndex = (index + tabs.length) % tabs.length
		const tab = tabRefs.current[nextIndex]
		if (!tab) return
		tab.focus()
		const nextValue = (tabs[nextIndex] as React.ReactElement<{ value: string }>).props.value
		onValueChange(nextValue)
	}

	return (
		<div ref={ref} role="tablist" className={cn("flex", className)} {...props}>
			{tabs.map((child, index) => {
				const tab = child as React.ReactElement<any>
				const tabId = `tab-${String(tab.props.value).replace(/[^a-zA-Z0-9_-]/g, "-")}`
				const panelId = `${tabId}-panel`
				return React.cloneElement(tab, {
					id: tab.props.id ?? tabId,
					"aria-controls": tab.props["aria-controls"] ?? panelId,
					ref: (element: HTMLButtonElement | null) => {
						tabRefs.current[index] = element
					},
					isSelected: tab.props.value === value,
					onSelect: () => onValueChange(tab.props.value),
					onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
						if (event.key === "ArrowRight" || event.key === "ArrowDown") {
							event.preventDefault()
							focusTab(index + 1)
						} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
							event.preventDefault()
							focusTab(index - 1)
						} else if (event.key === "Home") {
							event.preventDefault()
							focusTab(0)
						} else if (event.key === "End") {
							event.preventDefault()
							focusTab(tabs.length - 1)
						}
						tab.props.onKeyDown?.(event)
					},
				})
			})}
		</div>
	)
})

export const TabTrigger = forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		value: string
		isSelected?: boolean
		onSelect?: () => void
	}
>(({ children, className, value: _value, isSelected, onSelect, ...props }, ref) => {
	return (
		<button
			ref={ref}
		role="tab"
			aria-selected={isSelected}
			aria-controls={props["aria-controls"]}
			tabIndex={isSelected ? 0 : -1}
			className={cn("focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder", className)}
			onClick={onSelect}
			{...props}>
			{children}
		</button>
	)
})
