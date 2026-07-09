/**
 * Fix orphaned code fragments left by TelemetryService removal
 */
const fs = require('fs');
const path = require('path');

const fixes = [
  {
    file: 'src/api/providers/anthropic.ts',
    patterns: [
      // Remove orphaned ApiProviderError instantiations in catch blocks
      {
        search: /catch \(error\) \{\s+new ApiProviderError\(\s+error instanceof Error \? error\.message : String\(error\),\s+this\.providerName,\s+(modelId|model),\s+"(createMessage|completePrompt)",\s+\),\s+\)\s+throw error\s+\}/g,
        replace: 'catch (error) {\n\t\t\t\t\tthrow error\n\t\t\t\t}'
      }
    ]
  },
  {
    file: 'src/api/providers/fetchers/modelCache.ts',
    patterns: [
      // Remove orphaned telemetry call in empty model count branch
      {
        search: /else if \(modelCount === 0\) \{\s+provider,\s+context: "getModels",\s+hasExistingCache: false,\s+\}\)\s+\}/g,
        replace: 'else if (modelCount === 0) {\n\t\t\t// Telemetry removed\n\t\t}'
      },
      // Remove orphaned telemetry call in refreshModels
      {
        search: /if \(modelCount === 0\) \{\s+provider,\s+context: "refreshModels",\s+hasExistingCache: existingCount > 0,\s+existingCacheSize: existingCount,\s+\}\)/g,
        replace: 'if (modelCount === 0) {\n\t\t\t\t// Telemetry removed'
      }
    ]
  },
  {
    file: 'src/core/assistant-message/presentAssistantMessage.ts',
    patterns: [
      // Remove orphaned telemetry properties
      {
        search: /const modelInfo = cline\.api\.getModel\(\)\s+taskId: cline\.taskId,\s+model: modelInfo\?\.id,\s+\}\)/g,
        replace: 'const modelInfo = cline.api.getModel()\n\t\t\t\t\t// Telemetry removed'
      }
    ]
  },
  {
    file: 'src/core/condense/index.ts',
    patterns: [
      // Remove orphaned telemetry parameters
      {
        search: /rooIgnoreController,\s+\} = options\s+taskId,\s+isAutomaticTrigger \?\? false,\s+!!customCondensingPrompt\?\.trim\(\),\s+\)/g,
        replace: 'rooIgnoreController,\n\t} = options'
      }
    ]
  },
  {
    file: 'src/core/config/ProviderSettingsManager.ts',
    patterns: [
      // Remove orphaned telemetry in catch block
      {
        search: /if \(error instanceof ZodError\) \{\s+schemaName: "ProviderProfiles",\s+error,\s+\}\)\s+\}/g,
        replace: 'if (error instanceof ZodError) {\n\t\t\t\t// Telemetry removed\n\t\t\t}'
      }
    ]
  },
  {
    file: 'src/core/task/validateToolResultIds.ts',
    patterns: [
      // Remove orphaned MissingToolResultError
      {
        search: /if \(missingToolUseIds\.length > 0 && TelemetryService\.hasInstance\(\)\) \{\s+new MissingToolResultError\(\s+`Detected missing tool_result blocks[^}]+\},\s+\)\s+\}/gs,
        replace: '// Telemetry removed'
      },
      // Remove orphaned ToolResultIdMismatchError
      {
        search: /if \(hasInvalidIds && TelemetryService\.hasInstance\(\)\) \{\s+new ToolResultIdMismatchError\(\s+`Detected tool_result ID mismatch[^}]+\},\s+\)\s+\}/gs,
        replace: '// Telemetry removed'
      }
    ]
  },
  {
    file: 'src/core/webview/messageEnhancer.ts',
    patterns: [
      // Replace entire captureTelemetry method with stub
      {
        search: /static captureTelemetry\(taskId\?: string, includeTaskHistory\?: boolean\): void \{\s+if \(TelemetryService\.hasInstance\(\)\) \{\s+\/\/ Use captureEvent directly[^}]+\}\s+\}\s+\}/gs,
        replace: 'static captureTelemetry(_taskId?: string, _includeTaskHistory?: boolean): void {\n\t\t// Telemetry removed\n\t}'
      }
    ]
  },
  {
    file: 'src/services/code-index/manager.ts',
    patterns: [
      // Remove orphaned error tracking in _recreateServices
      {
        search: /console\.error\("Unexpected error loading \.gitignore:", error\)\s+error: error instanceof Error \? error\.message : String\(error\),\s+stack: error instanceof Error \? error\.stack : undefined,\s+location: "_recreateServices",\s+\}\)/g,
        replace: 'console.error("Unexpected error loading .gitignore:", error)'
      },
      // Remove orphaned error tracking in handleSettingsChange
      {
        search: /console\.error\("Failed to recreate services:", error\)\s+error: error instanceof Error \? error\.message : String\(error\),\s+stack: error instanceof Error \? error\.stack : undefined,\s+location: "handleSettingsChange",\s+\}\)/g,
        replace: 'console.error("Failed to recreate services:", error)'
      }
    ]
  }
];

let totalFixes = 0;

for (const fixConfig of fixes) {
  const filePath = path.join(process.cwd(), fixConfig.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fixConfig.file}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fileFixes = 0;
  
  for (const pattern of fixConfig.patterns) {
    const before = content;
    content = content.replace(pattern.search, pattern.replace);
    
    if (content !== before) {
      fileFixes++;
      totalFixes++;
    }
  }
  
  if (fileFixes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${fixConfig.file}: ${fileFixes} fix(es) applied`);
  } else {
    console.log(`⚪ ${fixConfig.file}: No changes needed`);
  }
}

console.log(`\n📊 Total fixes applied: ${totalFixes}`);
console.log('✨ Done! Run "pnpm build" to verify.');