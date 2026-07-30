import { fireEvent, render, screen } from "@testing-library/react"

import type { GraphicsProjectProfile } from "@roo-code/types"

import { GraphicsProjectProfileCard } from "../GraphicsProjectProfileCard"

const createProfile = (): GraphicsProjectProfile => ({
	version: 1,
	workspaceName: "SampleGame",
	engine: "unity",
	engineVersion: "2022.3.48f1",
	renderPipelines: ["Unity URP"],
	graphicsApis: ["Vulkan"],
	targetPlatforms: ["Android"],
	shaderLanguages: ["ShaderLab/HLSL"],
	architectureSignals: ["Renderer Feature / Scriptable Render Pass"],
	architectureIndex: {
		version: 1,
		analyzedFileCount: 3,
		truncated: false,
		findings: [
			{
				category: "pass",
				path: "Assets/Rendering/OutlineFeature.cs",
				kind: "renderer-feature",
				symbol: "OutlineFeature",
				detail: "Renderer Feature class OutlineFeature.",
			},
			{
				category: "shader",
				path: "Assets/Shaders/Outline.shader",
				kind: "shader-keyword",
				symbol: "OUTLINE_ON",
				detail: "Declares shader variants: OUTLINE_ON.",
			},
		],
	},
	evidence: [{ path: "Packages/manifest.json", description: "Unity package manifest" }],
	warnings: ["Sample warning"],
	scannedAt: "2026-07-30T00:00:00.000Z",
})

describe("GraphicsProjectProfileCard", () => {
	it("renders loading state and delegates refresh", () => {
		const onRefresh = vi.fn()
		render(<GraphicsProjectProfileCard profile={null} loading onRefresh={onRefresh} />)

		expect(screen.getByText("Inspecting project graphics architecture…")).toBeInTheDocument()
		const refreshButton = screen.getByRole("button", { name: "Refresh project profile" })
		expect(refreshButton).toBeDisabled()
		fireEvent.click(refreshButton)
		expect(onRefresh).not.toHaveBeenCalled()
	})

	it("renders typed findings and respects the visible finding limit", () => {
		const onRefresh = vi.fn()
		render(
			<GraphicsProjectProfileCard
				profile={createProfile()}
				loading={false}
				onRefresh={onRefresh}
				maxVisibleFindings={1}
			/>,
		)

		expect(screen.getByText(/unity 2022\.3\.48f1/i)).toBeInTheDocument()
		expect(screen.getByText("2 findings from 3 files")).toBeInTheDocument()
		expect(screen.getByText("OutlineFeature")).toBeInTheDocument()
		expect(screen.queryByText("OUTLINE_ON")).not.toBeInTheDocument()
		expect(screen.getByText("Sample warning")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Refresh project profile" }))
		expect(onRefresh).toHaveBeenCalledTimes(1)
	})
})
