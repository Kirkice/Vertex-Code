const fs = require('fs');
const path = require('path');

const files = [
  'src/services/code-index/embedders/openai-compatible.ts',
  'src/services/code-index/service-factory.ts',
  'src/services/marketplace/MarketplaceManager.ts',
  'src/services/code-index/search-service.ts',
  'src/services/code-index/embedders/ollama.ts',
  'src/services/code-index/embedders/mistral.ts',
  'src/services/code-index/embedders/gemini.ts',
  'src/services/code-index/embedders/bedrock.ts',
  'src/services/code-index/processors/scanner.ts',
  'src/services/code-index/embedders/vercel-ai-gateway.ts',
  'src/services/code-index/embedders/openrouter.ts',
  'src/services/code-index/embedders/openai.ts',
  'src/services/code-index/cache-manager.ts',
  'src/services/code-index/orchestrator.ts',
  'src/services/code-index/manager.ts',
  'src/services/code-index/processors/parser.ts',
  'src/services/code-index/processors/file-watcher.ts',
  'src/core/assistant-message/presentAssistantMessage.ts',
  'src/core/config/importExport.ts',
  'src/core/config/ContextProxy.ts',
  'src/core/config/ProviderSettingsManager.ts',
  'src/core/webview/messageEnhancer.ts',
  'src/core/condense/index.ts',
  'src/core/checkpoints/index.ts',
  'src/core/tools/ExecuteCommandTool.ts',
  'src/core/tools/AttemptCompletionTool.ts',
  'src/core/tools/ApplyDiffTool.ts',
  'src/core/task/validateToolResultIds.ts',
  'src/api/providers/xai.ts',
  'src/api/providers/poe.ts',
  'src/api/providers/openrouter.ts',
  'src/api/providers/openai-native.ts',
  'src/api/providers/openai-codex.ts',
  'src/api/providers/mistral.ts',
  'src/api/providers/gemini.ts',
  'src/api/providers/fetchers/modelCache.ts',
  'src/api/providers/bedrock.ts',
  'src/api/providers/anthropic.ts',
  'src/core/context-management/index.ts'
];

let updated = 0;
files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove import line
  const original = content;
  content = content.replace(/import\s+\{[^}]*TelemetryService[^}]*\}\s+from\s+['"]@roo-code\/telemetry['"];?\n?/g, '');
  content = content.replace(/import\s+TelemetryService\s+from\s+['"]@roo-code\/telemetry['"];?\n?/g, '');
  
  // Remove TelemetryService.instance calls (standalone statements)
  content = content.replace(/^\s*TelemetryService\.instance\.[^\n]*\n?/gm, '');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    updated++;
    console.log('Updated:', file);
  }
});

console.log('\nTotal files updated:', updated);