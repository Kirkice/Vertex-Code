import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { GraphicsArchitectureAnalyzer } from "../analyzers"
import { buildGraphicsArchitectureIndex } from "../GraphicsArchitectureIndex"

describe("buildGraphicsArchitectureIndex", () => {
	let workspacePath: string

	beforeEach(async () => {
		workspacePath = await mkdtemp(path.join(tmpdir(), "vertex-graphics-architecture-"))
	})

	afterEach(async () => {
		await rm(workspacePath, { recursive: true, force: true })
	})

	it("extracts pipeline, pass, shader, client, asset, and quality findings", async () => {
		const files = {
			"ProjectSettings/GraphicsSettings.asset":
				"m_CustomRenderPipeline: {fileID: 11400000, guid: 1234567890abcdef1234567890abcdef, type: 2}\n",
			"ProjectSettings/QualitySettings.asset": "m_CurrentQuality: 2\n",
			"Assets/Rendering/OutlineRendererFeature.cs": `
				class OutlineRendererFeature : ScriptableRendererFeature {}
				class OutlinePass : ScriptableRenderPass {
					void Setup() { renderPassEvent = RenderPassEvent.AfterRenderingOpaques; }
					void RecordRenderGraph(RenderGraph graph) {}
				}
			`,
			"Assets/Shaders/Outline.shader": `
				#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
				#pragma multi_compile _ OUTLINE_ON
				Tags { "LightMode" = "UniversalForward" }
			`,
			"Assets/Scripts/OutlineController.cs": `
				class OutlineController : MonoBehaviour {
					void OnEnable() {}
				}
			`,
		}

		for (const [relativePath, content] of Object.entries(files)) {
			const absolutePath = path.join(workspacePath, relativePath)
			await mkdir(path.dirname(absolutePath), { recursive: true })
			await writeFile(absolutePath, content)
		}

		const index = await buildGraphicsArchitectureIndex(workspacePath, Object.keys(files))

		expect(index).toEqual(expect.objectContaining({ version: 1, analyzedFileCount: 5, truncated: false }))
		expect(index.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ category: "pipeline", kind: "render-pipeline-asset" }),
				expect.objectContaining({
					category: "pass",
					kind: "renderer-feature",
					symbol: "OutlineRendererFeature",
				}),
				expect.objectContaining({
					category: "pass",
					kind: "pass-injection-point",
					symbol: "AfterRenderingOpaques",
				}),
				expect.objectContaining({ category: "pass", kind: "render-graph" }),
				expect.objectContaining({ category: "shader", kind: "shader-include" }),
				expect.objectContaining({ category: "shader", kind: "shader-keyword", symbol: "_ OUTLINE_ON" }),
				expect.objectContaining({ category: "client", kind: "unity-component", symbol: "OutlineController" }),
				expect.objectContaining({ category: "client", kind: "lifecycle", symbol: "OnEnable" }),
				expect.objectContaining({ category: "asset", kind: "graphics-asset-directory" }),
				expect.objectContaining({ category: "quality", kind: "quality-settings" }),
			]),
		)
	})

	it("supports injected analyzers and deterministic scan limits", async () => {
		const files = ["Assets/A.cs", "Assets/B.cs"]
		for (const relativePath of files) {
			const absolutePath = path.join(workspacePath, relativePath)
			await mkdir(path.dirname(absolutePath), { recursive: true })
			await writeFile(absolutePath, `class ${path.basename(relativePath, ".cs")} {}`)
		}
		const analyzer: GraphicsArchitectureAnalyzer = {
			id: "test-analyzer",
			analyze: ({ path: relativePath }) => [
				{
					category: "client",
					path: relativePath,
					kind: "test-entry",
					detail: `Analyzed ${relativePath}.`,
				},
			],
		}

		const index = await buildGraphicsArchitectureIndex(workspacePath, files, {
			analyzers: [analyzer],
			maxAnalyzedFiles: 1,
		})

		expect(index).toEqual(
			expect.objectContaining({
				analyzedFileCount: 1,
				truncated: true,
				findings: [expect.objectContaining({ kind: "test-entry", path: "Assets/A.cs" })],
			}),
		)
	})
})
