import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { GraphicsArchitectureAnalyzer } from "../analyzers";
import { buildGraphicsArchitectureIndex } from "../GraphicsArchitectureIndex";

describe("buildGraphicsArchitectureIndex", () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(
      path.join(tmpdir(), "vertex-graphics-architecture-"),
    );
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it("builds resolved asset, GUID, include, and shader symbol graph entries", async () => {
    const files = {
      "Assets/Rendering/OutlineRendererFeature.cs.meta":
        "fileFormatVersion: 2\nguid: abcdefabcdefabcdefabcdefabcdefab\n",
      "Assets/Rendering/OutlineRendererFeature.cs": `
				class OutlineRendererFeature {}
				void Setup() {}
			`,
      "ProjectSettings/GraphicsSettings.asset":
        "m_CustomRenderPipeline: {fileID: 11400000, guid: abcdefabcdefabcdefabcdefabcdefab, type: 2}\n",
      "Assets/Shaders/Outline.shader": `
				Pass { Name "Outline" Tags { "LightMode" = "UniversalForward" } }
				#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
				float4 Vert() { return 0; }
			`,
    };

    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(workspacePath, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }

    const index = await buildGraphicsArchitectureIndex(
      workspacePath,
      Object.keys(files),
    );
    const nodes = index.graph?.nodes ?? [];
    const edges = index.graph?.edges ?? [];

    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "file",
          path: "ProjectSettings/GraphicsSettings.asset",
        }),
        expect.objectContaining({
          kind: "file",
          path: "Assets/Rendering/OutlineRendererFeature.cs",
        }),
        expect.objectContaining({
          kind: "symbol",
          label:
            "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl",
        }),
      ]),
    );
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "file:ProjectSettings/GraphicsSettings.asset",
          to: "file:Assets/Rendering/OutlineRendererFeature.cs",
          kind: "references",
        }),
        expect.objectContaining({ kind: "includes", detail: "Shader include" }),
        expect.objectContaining({ kind: "contains", detail: "Shader pass" }),
        expect.objectContaining({
          kind: "implements",
          detail: "Shader or client entry point",
        }),
      ]),
    );
    expect(index.similarFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "feature:Assets/Rendering/OutlineRendererFeature.cs",
          score: expect.any(Number),
        }),
      ]),
    );
  });

  it("classifies resolved renderer data and renderer feature GUID references", async () => {
    const files = {
      "Assets/Rendering/ForwardRenderer.asset":
        "m_RendererDataList: [{fileID: 11400000, guid: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, type: 2}]\n",
      "Assets/Rendering/ForwardRenderer.asset.meta":
        "fileFormatVersion: 2\nguid: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
      "Assets/Rendering/OutlineFeature.asset": "m_Script: {guid: cccccccccccccccccccccccccccccccc}\n",
      "Assets/Rendering/OutlineFeature.asset.meta":
        "fileFormatVersion: 2\nguid: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n",
      "ProjectSettings/GraphicsSettings.asset":
        "m_CustomRenderPipeline: {guid: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}\n",
    };

    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(workspacePath, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }

    const index = await buildGraphicsArchitectureIndex(workspacePath, Object.keys(files));
    expect(index.graph?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ detail: "Resolved Render Pipeline Asset GUID" }),
        expect.objectContaining({ detail: "Resolved Renderer Data asset GUID" }),
      ]),
    );
  });

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
     var camera = Camera.main;
     var material = Resources.Load<Material>("Outline");
     var pool = new ObjectPool<GameObject>();
    }
   `,
    };

    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(workspacePath, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }

    const index = await buildGraphicsArchitectureIndex(
      workspacePath,
      Object.keys(files),
    );

    expect(index).toEqual(
      expect.objectContaining({
        version: 1,
        analyzedFileCount: 5,
        truncated: false,
      }),
    );
    expect(index.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "pipeline",
          kind: "render-pipeline-asset",
        }),
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
        expect.objectContaining({
          category: "shader",
          kind: "shader-keyword",
          symbol: "_ OUTLINE_ON",
        }),
        expect.objectContaining({
          category: "client",
          kind: "unity-component",
          symbol: "OutlineController",
        }),
        expect.objectContaining({
          category: "client",
          kind: "lifecycle",
          symbol: "OnEnable",
        }),
        expect.objectContaining({
          category: "asset",
          kind: "graphics-asset-directory",
        }),
        expect.objectContaining({
          category: "quality",
          kind: "quality-settings",
        }),
        expect.objectContaining({
          category: "quality",
          kind: "quality-tier",
        }),
        expect.objectContaining({
          category: "client",
          kind: "camera-entry",
        }),
        expect.objectContaining({
          category: "client",
          kind: "resource-loading",
        }),
        expect.objectContaining({
          category: "client",
          kind: "object-pool",
        }),
      ]),
    );
  });

  it("indexes importer metadata, shader variants, and source symbols", async () => {
    const files = {
      "Assets/Rendering/T_Outline.png.meta": "fileFormatVersion: 2\nTextureImporter:\n  mipmaps: 1\n",
      "Assets/Shaders/Outline.shader": `
        #pragma shader_feature_local _ OUTLINE_ON
        struct Attributes { float3 position : POSITION; };
        float4 Fragment(Attributes input) { return 0; }
      `,
    };
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(workspacePath, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    }

    const index = await buildGraphicsArchitectureIndex(workspacePath, Object.keys(files));

    expect(index.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "asset", kind: "asset-importer" }),
        expect.objectContaining({
          category: "asset",
          kind: "asset-naming-convention",
          path: "Assets/Rendering/T_Outline.png.meta",
        }),
      ]),
    );
    expect(index.graph?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "symbol", label: "_ OUTLINE_ON" }),
        expect.objectContaining({ kind: "symbol", label: "Attributes" }),
        expect.objectContaining({ kind: "symbol", label: "Fragment" }),
      ]),
    );
  });

  it("supports injected analyzers and deterministic scan limits", async () => {
    const files = ["Assets/A.cs", "Assets/B.cs"];
    for (const relativePath of files) {
      const absolutePath = path.join(workspacePath, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(
        absolutePath,
        `class ${path.basename(relativePath, ".cs")} {}`,
      );
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
    };

    const index = await buildGraphicsArchitectureIndex(workspacePath, files, {
      analyzers: [analyzer],
      maxAnalyzedFiles: 1,
    });

    expect(index).toEqual(
      expect.objectContaining({
        analyzedFileCount: 1,
        truncated: true,
        findings: [
          expect.objectContaining({ kind: "test-entry", path: "Assets/A.cs" }),
        ],
      }),
    );
  });
});
