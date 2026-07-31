import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { TranslationProvider } from "@src/i18n/TranslationContext"
import GraphicsWorkspace from "@src/components/graphics/GraphicsWorkspace"
import { TooltipProvider } from "@src/components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "@src/components/ui/standard-tooltip"
import { ThemeProvider } from "@src/themes"

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
	},
})

/**
 * Browser-only harness for deterministic Graphics Workspace regression checks.
 * The production extension entry point remains unchanged unless the visual
 * regression query parameter is explicitly present.
 */
export const GraphicsWorkspaceHarness = () => (
	<ExtensionStateContextProvider>
		<ThemeProvider>
			<TranslationProvider>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
						<GraphicsWorkspace onDone={() => undefined} />
					</TooltipProvider>
				</QueryClientProvider>
			</TranslationProvider>
		</ThemeProvider>
	</ExtensionStateContextProvider>
)
