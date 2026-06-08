/**
 * Comprehensive fix for all orphaned TelemetryService/CloudService code
 */
const fs = require('fs');
const path = require('path');

// Helper to fix a file with multiple replacements
function fixFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP: ${filePath} not found`);
    return 0;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let fixes = 0;
  for (const { search, replace } of replacements) {
    const before = content;
    if (search instanceof RegExp) {
      content = content.replace(search, replace);
    } else {
      content = content.replace(search, replace);
    }
    if (content !== before) fixes++;
  }
  if (fixes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  FIXED ${fixes}: ${filePath}`);
  }
  return fixes;
}

let total = 0;

// 1. validateToolResultIds.ts - remove orphaned telemetry blocks
total += fixFile('src/core/task/validateToolResultIds.ts', [
  {
    search: /\/\/ Report missing tool_results to PostHog error tracking\n\tif \(missingToolUseIds\.length > 0 && TelemetryService\.hasInstance\(\)\)[\s\S]*?\n\t\}\n/,
    replace: '// Telemetry tracking removed\n'
  },
  {
    search: /\/\/ Report ID mismatches to PostHog error tracking\n\tif \(hasInvalidIds && TelemetryService\.hasInstance\(\)\)[\s\S]*?\n\t\}\n/,
    replace: '// Telemetry tracking removed\n'
  }
]);

// 2. messageEnhancer.ts - fix orphaned captureTelemetry
total += fixFile('src/core/webview/messageEnhancer.ts', [
  {
    search: /static captureTelemetry[\s\S]*?^}/m,
    replace: 'static captureTelemetry(_taskId?: string, _includeTaskHistory?: boolean): void {\n\t\t// Telemetry removed\n\t}\n}'
  }
]);

// 3. ProviderSettingsManager.ts - fix orphaned ZodError catch
total += fixFile('src/core/config/ProviderSettingsManager.ts', [
  {
    search: /if \(error instanceof ZodError\) \{\s+schemaName: "ProviderProfiles",[\s\S]*?\}\)\s+\}/,
    replace: 'if (error instanceof ZodError) {\n\t\t\t\t// Telemetry removed\n\t\t\t}'
  }
]);

// 4. presentAssistantMessage.ts - fix orphaned code
total += fixFile('src/core/assistant-message/presentAssistantMessage.ts', [
  {
    search: /cline\.recordToolUsage\(recordName\)[\s\S]*?\/\/ Telemetry removed\n\t\t\t\t\}\n\n\t\t\t\/\/ Validate/,
    replace: 'cline.recordToolUsage(recordName)\n\n\t\t\t// Validate'
  },
  {
    search: /\/\/ Track tool repetition in telemetry via PostHog[\s\S]*?\}\s+\)\n/,
    replace: ''
  }
]);

// 5. anthropic.ts - fix orphaned ApiProviderError
total += fixFile('src/api/providers/anthropic.ts', [
  {
    search: /\} catch \(error\) \{\s+new ApiProviderError\([\s\S]*?"createMessage"[\s\S]*?\)\s+throw error\s+\}/,
    replace: '} catch (error) {\n\t\t\t\t\tthrow error\n\t\t\t\t}',
    flags: 'g'
  },
  {
    search: /\} catch \(error\) \{\s+new ApiProviderError\([\s\S]*?"completePrompt"[\s\S]*?\)\s+throw error\s+\}/,
    replace: '} catch (error) {\n\t\t\tthrow error\n\t\t}'
  }
]);

// 6. modelCache.ts
total += fixFile('src/api/providers/fetchers/modelCache.ts', [
  {
    search: /\} else if \(modelCount === 0\) \{\s+provider,[\s\S]*?\}\)\s+\}/,
    replace: '} else if (modelCount === 0) {\n\t\t\t// Telemetry removed\n\t\t}'
  },
  {
    search: /if \(modelCount === 0\) \{\s+provider,[\s\S]*?\}\)/,
    replace: 'if (modelCount === 0) {\n\t\t\t\t// Telemetry removed\n\t\t\t}'
  }
]);

// 7. condense/index.ts
total += fixFile('src/core/condense/index.ts', [
  {
    search: /\} = options\s+taskId,[\s\S]*?\)\n/,
    replace: '} = options\n'
  }
]);

// 8. code-index/manager.ts
total += fixFile('src/services/code-index/manager.ts', [
  {
    search: /console\.error\("Unexpected error loading \.gitignore:", error\)\s+error: error[\s\S]*?\}\)/,
    replace: 'console.error("Unexpected error loading .gitignore:", error)'
  },
  {
    search: /console\.error\("Failed to recreate services:", error\)\s+error: error[\s\S]*?\}\)/,
    replace: 'console.error("Failed to recreate services:", error)'
  }
]);

// 9. openai-codex.ts - remove orphaned import
total += fixFile('src/api/providers/openai-codex.ts', [
  {
    search: /import \{ openAiCodexOAuthManager \} from "\.\.\/\.\.\/integrations\/openai-codex\/oauth"\n/,
    replace: ''
  }
]);

// 10. code-index files - fix orphaned telemetry in cache-manager, bedrock, etc.
const codeIndexFiles = [
  'src/services/code-index/cache-manager.ts',
  'src/services/code-index/embedders/bedrock.ts',
  'src/services/code-index/embedders/gemini.ts',
  'src/services/code-index/embedders/mistral.ts',
  'src/services/code-index/embedders/ollama.ts',
  'src/services/code-index/embedders/openai-compatible.ts',
  'src/services/code-index/embedders/openai.ts',
  'src/services/code-index/embedders/openrouter.ts',
  'src/services/code-index/embedders/vercel-ai-gateway.ts',
  'src/services/code-index/orchestrator.ts',
  'src/services/code-index/processors/parser.ts',
  'src/services/code-index/processors/scanner.ts',
  'src/services/code-index/processors/file-watcher.ts',
  'src/services/code-index/search-service.ts',
  'src/services/code-index/service-factory.ts',
];

for (const f of codeIndexFiles) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  const before = content;
  // Remove TelemetryEventName import if standalone
  content = content.replace(/import \{ TelemetryEventName \} from "@roo-code\/types"\n?/g, '');
  // Remove orphaned TelemetryService.instance lines with multi-line args
  content = content.replace(/TelemetryService\.instance\.\w+\([\s\S]*?\n\s*\)\n?/g, '');
  // Remove single-line TelemetryService.instance calls
  content = content.replace(/^\s*TelemetryService\.instance\.\w+\([^)]*\);?\n?/gm, '');
  if (content !== before) {
    fs.writeFileSync(f, content, 'utf8');
    total++;
    console.log(`  FIXED: ${f}`);
  }
}

console.log(`\nTotal fixes: ${total}`);