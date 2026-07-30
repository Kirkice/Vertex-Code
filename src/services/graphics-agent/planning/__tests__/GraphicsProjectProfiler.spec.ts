import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { profileGraphicsProject } from "../GraphicsProjectProfiler"

describe("profileGraphicsProject", () => {
	let workspacePath: string

	beforeEach(async () => {
		workspacePath = await mkdtemp(path.join(tmpdir(), "vertex-graphics-profile-"))
	})

	afterEach(async () => {
		await rm(workspacePath, { recursive: true, force: true })
	})

	it("detects Unity URP, shader languages, platforms, and architecture signals", async () => {
		await mkdir(path.join(workspacePath, "ProjectSettings"), { recursive: true })
		await mkdir(path.join(workspacePath, "Packages"), { recursive: true })
		await mkdir(path.join(workspacePath, "Assets", "Rendering", "RendererFeatures"), { recursive: true })
		await mkdir(path.join(workspacePath, "Assets", "Shaders"), { recursive: true })
		await mkdir(path.join(workspacePath, "Assets", "Plugins", "Android"), { recursive: true })
		await writeFile(
			path.join(workspacePath, "ProjectSettings", "ProjectVersion.txt"),
			"m_EditorVersion: 2022.3.48f1\n",
		)
		await writeFile(
			path.join(workspacePath, "Packages", "manifest.json"),
			JSON.stringify({ dependencies: { "com.unity.render-pipelines.universal": "14.0.11" } }),
		)
		await writeFile(
			path.join(workspacePath, "Assets", "Rendering", "RendererFeatures", "OutlineRendererFeature.cs"),
			`class OutlineRendererFeature : ScriptableRendererFeature {
				class OutlinePass : ScriptableRenderPass {
					void Setup() { renderPassEvent = RenderPassEvent.AfterRenderingOpaques; }
				}
			}`,
		)
		await writeFile(
			path.join(workspacePath, "Assets", "Shaders", "Outline.shader"),
			`Shader "Vertex/Outline" { SubShader { Pass {
				HLSLPROGRAM
				#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
				#pragma shader_feature_local _ OUTLINE_ON
				ENDHLSL
			} } }`,
		)
		await writeFile(path.join(workspacePath, "Assets", "Plugins", "Android", "AndroidManifest.xml"), "<manifest />")

		const profile = await profileGraphicsProject(workspacePath)

		expect(profile).toEqual(
			expect.objectContaining({
				engine: "unity",
				engineVersion: "2022.3.48f1",
				renderPipelines: ["Unity URP"],
				targetPlatforms: expect.arrayContaining(["Android"]),
				shaderLanguages: expect.arrayContaining(["ShaderLab/HLSL"]),
				architectureSignals: expect.arrayContaining(["Renderer Feature / Scriptable Render Pass"]),
			}),
		)
		expect(profile.architectureIndex.findings).toEqual(
			expect.arrayContaining([
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
				expect.objectContaining({ category: "shader", kind: "shader-include" }),
				expect.objectContaining({ category: "shader", kind: "shader-keyword", symbol: "_ OUTLINE_ON" }),
			]),
		)
		expect(profile.evidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "ProjectSettings/ProjectVersion.txt" }),
				expect.objectContaining({ path: "Packages/manifest.json" }),
				expect.objectContaining({
					path: "Assets/Rendering/RendererFeatures/OutlineRendererFeature.cs",
					description: "Renderer Feature class OutlineRendererFeature.",
				}),
			]),
		)
	})

	it("returns an actionable warning without a workspace", async () => {
		const profile = await profileGraphicsProject()

		expect(profile.engine).toBe("unknown")
		expect(profile.warnings).toContain("Open a workspace to generate a Graphics Project Profile.")
	})
})
