import type {
  GraphicsFeatureBrief,
  GraphicsProjectProfile,
} from "@roo-code/types";

import { selectGraphicsSolution } from "../GraphicsSolutionSelector";

const createBrief = (
  overrides: Partial<GraphicsFeatureBrief> = {},
): GraphicsFeatureBrief => ({
  version: 1,
  title: "Stylized outline",
  visualGoal: "Add a camera-wide outline using depth and normals",
  lifecycle: "Enabled during gameplay by a client event",
  artControls: "Outline width and color",
  targetPlatforms: "Windows and Android",
  performanceBudget: "Under 0.4 ms GPU",
  compatibilityRequirements: "URP camera stacking and dynamic resolution",
  acceptanceCriteria: "Stable silhouette around selected characters",
  ...overrides,
});

const createProfile = (
  overrides: Partial<GraphicsProjectProfile> = {},
): GraphicsProjectProfile => ({
  version: 1,
  workspaceName: "SampleGame",
  engine: "unity",
  engineVersion: "2022.3",
  renderPipelines: ["Unity URP"],
  graphicsApis: ["Vulkan"],
  targetPlatforms: ["Android"],
  shaderLanguages: ["ShaderLab/HLSL"],
  architectureSignals: ["Renderer Feature / Scriptable Render Pass"],
  architectureIndex: {
    version: 1,
    findings: [
      {
        category: "pass",
        path: "Assets/Rendering/OutlineFeature.cs",
        kind: "renderer-feature",
        detail: "Renderer Feature class OutlineFeature.",
      },
    ],
    analyzedFileCount: 1,
    truncated: false,
  },
  evidence: [],
  warnings: [],
  scannedAt: "2026-07-30T00:00:00.000Z",
  ...overrides,
});

describe("selectGraphicsSolution", () => {
  it("prefers an existing renderer pass for a camera-wide depth and normal effect", () => {
    const recommendation = selectGraphicsSolution(
      createBrief(),
      createProfile(),
      {
        now: () => new Date("2026-07-30T01:00:00.000Z"),
      },
    );

    expect(recommendation.recommendedLevel).toBe("renderer-pass");
    expect(recommendation.candidates[0]).toEqual(
      expect.objectContaining({
        level: "renderer-pass",
        confidence: "high",
      }),
    );
    expect(recommendation.candidates[0].reasons).toContain(
      "The project already exposes a custom pass or renderer-feature extension point.",
    );
    expect(recommendation.generatedAt).toBe("2026-07-30T01:00:00.000Z");
  });

  it("prefers compute for a large GPU simulation and exposes missing-input assumptions", () => {
    const recommendation = selectGraphicsSolution(
      createBrief({
        title: "GPU particle simulation",
        visualGoal:
          "Simulate and draw one million GPU generated particles with indirect drawing",
        lifecycle: "",
        artControls: "",
        targetPlatforms: "",
        performanceBudget: "",
        compatibilityRequirements: "",
        acceptanceCriteria: "",
      }),
      createProfile({
        engine: "unknown",
        architectureSignals: [],
        architectureIndex: {
          version: 1,
          findings: [],
          analyzedFileCount: 0,
          truncated: true,
        },
      }),
    );

    expect(recommendation.recommendedLevel).toBe("compute");
    expect(recommendation.assumptions).toEqual(
      expect.arrayContaining([
        "No explicit performance budget was provided.",
        "No target platform or graphics API was provided.",
        "The project engine is unknown, so integration confidence is limited.",
        "The architecture index was truncated and may omit reusable entry points.",
      ]),
    );
    expect(
      recommendation.candidates.find(
        (candidate) => candidate.level === "render-graph",
      )?.rejectionReasons,
    ).not.toHaveLength(0);
  });

  it("matches Chinese requirements without relying on ASCII word boundaries", () => {
    const recommendation = selectGraphicsSolution(
      createBrief({
        title: "GPU 粒子模拟",
        visualGoal: "使用 GPU 并行模拟百万粒子并进行间接绘制",
        lifecycle: "由玩法事件触发",
        artControls: "",
        compatibilityRequirements: "",
        acceptanceCriteria: "",
      }),
      createProfile({
        architectureSignals: [],
        architectureIndex: {
          version: 1,
          findings: [],
          analyzedFileCount: 0,
          truncated: false,
        },
      }),
    );

    expect(recommendation.recommendedLevel).toBe("compute");
    expect(recommendation.candidates[0].reasons).toContain(
      "The workload suggests large-scale parallel processing or GPU-generated data.",
    );
  });
  it("applies packaged rules and records a human override in decision history", () => {
    const recommendation = selectGraphicsSolution(
      createBrief(),
      createProfile(),
      {
        now: () => new Date("2026-07-30T02:00:00.000Z"),
        rulePackages: [
          {
            id: "golden-outline-package",
            label: "Outline rules",
            rules: [
              {
                levels: ["shader"],
                pattern: "outline",
                score: 40,
                reason:
                  "Golden package identifies outline as a shader-local effect.",
              },
            ],
          },
        ],
        override: {
          level: "shader",
          reason: "The art direction requires a material-only prototype.",
        },
      },
    );

    expect(recommendation.recommendedLevel).toBe("shader");
    expect(recommendation.decisionHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "rule-package:golden-outline-package",
        }),
        expect.objectContaining({
          source: "human-override",
          decision: "shader",
        }),
      ]),
    );
  });

  it("gates candidates by capabilities and cost budget", () => {
    const recommendation = selectGraphicsSolution(
      createBrief({ visualGoal: "Add a render graph effect with compute shader resources" }),
      createProfile(),
      {
        availableCapabilities: ["renderer-pass"],
        maxCost: 4,
        costUnit: "points",
      },
    );

    const renderGraph = recommendation.candidates.find(
      (candidate) => candidate.level === "render-graph",
    );
    expect(renderGraph?.requiredCapabilities).toContain("render-graph");
    expect(renderGraph?.resourceNeeds).toContain("cross-pass-resource");
    expect(renderGraph?.rejectionReasons).toEqual(
      expect.arrayContaining([
        "Missing required capabilities: render-graph.",
        "Estimated cost exceeds the budget of 4 points.",
      ]),
    );
    expect(recommendation.constraints).toEqual({
      availableCapabilities: ["renderer-pass"],
      maxCost: 4,
      costUnit: "points",
    });
  });
  it("passes the fixed golden cases for configuration, post-process, and CPU/client features", () => {
    const goldenCases = [
      {
        name: "configuration-only material tuning",
        brief: createBrief({
          title: "Quality configuration",
          visualGoal: "Adjust existing quality configuration values",
          lifecycle: "",
          artControls: "Preset selection",
          compatibilityRequirements: "",
          acceptanceCriteria: "",
        }),
        expectedLevel: "configuration" as const,
      },
      {
        name: "explicit post-processing effect",
        brief: createBrief({
          title: "Bloom pass",
          visualGoal: "Add bloom and color grading as a post-process",
          lifecycle: "Enabled for the camera",
          artControls: "Intensity",
          compatibilityRequirements: "",
          acceptanceCriteria: "",
        }),
        expectedLevel: "post-process" as const,
      },
      {
        name: "client lifecycle orchestration",
        brief: createBrief({
          title: "Gameplay trigger",
          visualGoal: "Drive a visual state from a gameplay event",
          lifecycle: "Triggered by a network event and reset on lifecycle transition",
          artControls: "",
          compatibilityRequirements: "",
          acceptanceCriteria: "",
        }),
        expectedLevel: "cpu-client" as const,
      },
    ];

    for (const goldenCase of goldenCases) {
      const recommendation = selectGraphicsSolution(
        goldenCase.brief,
        createProfile(),
        { now: () => new Date("2026-07-30T03:00:00.000Z") },
      );
      expect(recommendation.recommendedLevel, goldenCase.name).toBe(
        goldenCase.expectedLevel,
      );
      expect(recommendation.candidates).toHaveLength(7);
      expect(
        recommendation.candidates.map((candidate) => candidate.level),
        goldenCase.name,
      ).toEqual(expect.arrayContaining([goldenCase.expectedLevel]));
    }
  });

  it("keeps architecture gates deterministic when a rule package adds required capabilities", () => {
    const recommendation = selectGraphicsSolution(
      createBrief({ visualGoal: "Use an existing renderer pass" }),
      createProfile(),
      {
        rulePackages: [
          {
            id: "architecture-gate",
            label: "Architecture gate",
            rules: [
              {
                levels: ["renderer-pass"],
                pattern: "renderer pass",
                score: 20,
                reason: "The golden architecture requires a renderer pass.",
                requiredCapabilities: ["renderer-pass-extension"],
              },
            ],
          },
        ],
        availableCapabilities: ["shader"],
      },
    );

    const rendererPass = recommendation.candidates.find(
      (candidate) => candidate.level === "renderer-pass",
    );
    expect(rendererPass?.rejectionReasons).toContain(
      "Missing required capabilities: renderer-pass, renderer-pass-extension.",
    );
    expect(recommendation.constraints?.availableCapabilities).toEqual(["shader"]);
  });
});
