/**
 * Fix remaining orphaned TelemetryService code fragments
 */
const fs = require('fs');
const path = require('path');

const filesToFix = [
  {
    path: 'src/core/task/validateToolResultIds.ts',
    replacements: [
      // Remove orphaned MissingToolResultError block
      {
        search: /\n\t\/\/ Report missing tool_results to PostHog error tracking\n\tif \(missingToolUseIds\.length > 0 && TelemetryService\.hasInstance\(\)\) \{\s+new MissingToolResultError\([\s\S]+?\}\n\t\}/,
        replace: '\n\t// Telemetry tracking removed'
      },
      // Remove orphaned ToolResultIdMismatchError block
      {
        search: /\n\t\/\/ Report ID mismatches to PostHog error tracking\n\tif \(hasInvalidIds && TelemetryService\.hasInstance\(\)\) \{\s+new ToolResultIdMismatchError\([\s\S]+?\}\n\t\}/,
        replace: '\n\t// Telemetry tracking removed'
      }
    ]
  },
  {
    path: 'src/core/webview/messageEnhancer.ts',
    replacements: [
      // Remove orphaned TelemetryService capture block
      {
        search: /if \(TelemetryService\.hasInstance\(\)\) \{\s+\/\/ Use captureEvent directly[\s\S]+?\}\s+\}/,
        replace: '// Telemetry tracking removed'
      }
    ]
  },
  {
    path: 'src/core/assistant-message/presentAssistantMessage.ts',
    replacements: [
      // Remove orphaned tool repetition tracking
      {
        search: /\n\t\t\t\t\t\/\/ Track tool repetition in telemetry[\s\S]+?\}\s+\)/,
        replace: ''
      }
    ]
  },
  {
    path: 'src/api/providers/anthropic.ts',
    replacements: [
      // Remove orphaned ApiProviderError instantiations
      {
        search: /\} catch \(error\) \{\s+new ApiProviderError\([\s\S]+?throw error/,
        replace: '} catch (error) {\n\t\t\t\t\tthrow error',
        flags: 'g'
      }
    ]
  },
  {
    path: 'src/api/providers/fetchers/modelCache.ts',
    replacements: [
      // Remove orphaned TelemetryService.captureException calls
      {
        search: /\} else if \(modelCount === 0\) \{\s+TelemetryService\.instance\.captureException\([\s\S]+?\}\)\s+\}/,
        replace: '} else if (modelCount === 0) {\n\t\t\t// No models returned\n\t\t}'
      },
      {
        search: /if \(modelCount === 0\) \{\s+TelemetryService\.instance\.captureException\([\s\S]+?\}\)/,
        replace: 'if (modelCount === 0) {\n\t\t\t\t// No models returned\n\t\t\t}'
      }
    ]
  },
  {
    path: 'src/core/condense/index.ts',
    replacements: [
      // Remove orphaned TelemetryService call
      {
        search: /\n\tTelemetryService\.instance\.captureCondenseContext\([\s\S]+?\)\)/,
        replace: ''
      }
    ]
  },
  {
    path: 'src/core/config/ProviderSettingsManager.ts',
    replacements: [
      // Remove orphaned TelemetryService call in ZodError catch
      {
        search: /if \(error instanceof ZodError\) \{\s+TelemetryService\.instance\.captureException\([\s\S]+?\}\)\s+\}/,
        replace: 'if (error instanceof ZodError) {\n\t\t\t// Telemetry removed\n\t\t}'
      }
    ]
  },
  {
    path: 'src/services/code-index/manager.ts',
    replacements: [
      // Remove orphaned TelemetryService calls
      {
        search: /\n\t\t\tTelemetryService\.instance\.captureException\([\s\S]+?\}\)/,
        replace: '',
        flags: 'g'
      }
    ]
  }
];

let totalFixed = 0;

for (const fileConfig of filesToFix) {
  const filePath = path.join(process.cwd(), fileConfig.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fileConfig.path}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fileFixed = 0;
  
  for (const replacement of fileConfig.replacements) {
    const regex = new RegExp(replacement.search.source, replacement.search.flags || '');
    const before = content;
    content = content.replace(regex, replacement.replace);
    
    if (content !== before) {
      fileFixed++;
      totalFixed++;
      console.log(`✅ Fixed: ${fileConfig.path} (${replacement.search.source.substring(0, 50)}...)`);
    }
  }
  
  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

console.log(`\n📊 Total fixes applied: ${totalFixed}`);

// Now check for any remaining TelemetryService references
console.log('\n🔍 Checking for remaining TelemetryService references...\n');

const srcFiles = [];
function findTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTsFiles(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      srcFiles.push(fullPath);
    }
  }
}

findTsFiles(path.join(process.cwd(), 'src'));

let remainingCount = 0;
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('TelemetryService')) {
    const relPath = path.relative(process.cwd(), file);
    console.log(`⚠️  ${relPath} still contains TelemetryService`);
    remainingCount++;
  }
}

if (remainingCount === 0) {
  console.log('✅ No TelemetryService references found in src/');
} else {
  console.log(`\n⚠️  ${remainingCount} files still contain TelemetryService references`);
}