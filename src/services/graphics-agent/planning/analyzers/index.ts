import type { GraphicsArchitectureAnalyzer } from "./GraphicsArchitectureAnalyzer"
import { clientAnalyzer } from "./clientAnalyzer"
import { passAnalyzer } from "./passAnalyzer"
import { pipelineAnalyzer } from "./pipelineAnalyzer"
import { projectConfigurationAnalyzer } from "./projectConfigurationAnalyzer"
import { shaderAnalyzer } from "./shaderAnalyzer"

export type { GraphicsArchitectureAnalysisInput, GraphicsArchitectureAnalyzer } from "./GraphicsArchitectureAnalyzer"

export const defaultGraphicsArchitectureAnalyzers: readonly GraphicsArchitectureAnalyzer[] = [
	pipelineAnalyzer,
	passAnalyzer,
	shaderAnalyzer,
	clientAnalyzer,
	projectConfigurationAnalyzer,
]
