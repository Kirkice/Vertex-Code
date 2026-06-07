import os, glob, re, shutil

# ─── Replacement patterns (ordered by specificity - longer first) ───
patterns = [
    # URLs
    ("https://github.com/Zoo-Code-Org/Zoo-Code", "https://github.com/Kirkice/Vertex-Code"),
    ("https://zoocode.dev", "https://vertex.dev"),
    ("zoocode.dev", "vertex.dev"),
    ("zoocode.com", "vertex.dev"),
    
    # Organization / Publisher
    ("ZooCodeOrganization", "learner"),
    ("Zoo Code Organization", "Vertex Team"),
    
    # Auth
    ("initZooCodeAuth", "initVertexAuth"),
    ("zoo-code-auth", "vertex-auth"),
    ("zooSessionToken", "vertexSessionToken"),
    ("zoo_ext_test_token", "vertex_ext_test_token"),
    
    # Gateway full patterns
    ("ZOO_GATEWAY_PROMPT_CACHING_MODELS", "VERTEX_GATEWAY_PROMPT_CACHING_MODELS"),
    ("ZOO_GATEWAY_DEFAULT_TEMPERATURE", "VERTEX_GATEWAY_DEFAULT_TEMPERATURE"),
    ("ZOO_GATEWAY", "VERTEX_GATEWAY"),
    ("ZooGatewayProps", "VertexGatewayProps"),
    ("pickZooGatewayDefaultModelId", "pickVertexGatewayDefaultModelId"),
    ("getZooGatewayModels", "getVertexGatewayModels"),
    ("handleZooGatewayAuth", "handleVertexGatewayAuth"),
    ("ZooGatewayAuth", "VertexGatewayAuth"),
    ("orgWithoutZooGateway", "orgWithoutVertexGateway"),
    ("zooGatewaySchema", "vertexGatewaySchema"),
    ("zooGatewayModelId", "vertexGatewayModelId"),
    ("zooGatewayBaseUrl", "vertexGatewayBaseUrl"),
    ("zooGatewayDefaultModelId", "vertexGatewayDefaultModelId"),
    ("zooGatewaySignIn", "vertexGatewaySignIn"),
    ("zooGatewayToken", "vertexGatewayToken"),
    ("zooGatewayApiKey", "vertexGatewayApiKey"),
    ("zooGatewayOrg", "vertexGatewayOrg"),
    ("zooGatewaySettings", "vertexGatewaySettings"),
    ("zooModels", "vertexModels"),
    
    # Quoted strings
    ('"zooGateway"', '"vertexGateway"'),
    ("'zooGateway'", "'vertexGateway'"),
    ('"Zoo Gateway"', '"Vertex Gateway"'),
    ("Zoo Gateway token", "Vertex Gateway token"),
    ("Zoo Gateway", "Vertex Gateway"),
    ("zoo-gateway", "vertex-gateway"),
    ("zooGateway", "vertexGateway"),
    ("ZooGateway", "VertexGateway"),
    
    # Zoo Code Auth Badge
    ("ZooCodeAuthBadge", "VertexAuthBadge"),
    ("ZooCodeAuth", "VertexAuth"),
    ("ZooCode", "Vertex"),
    
    # Settings keys
    ("settings:validation.zooGatewaySignIn", "settings:validation.vertexGatewaySignIn"),
    ("settings:providers.zooGateway", "settings:providers.vertexGateway"),
    
    # Display names
    ("Zoo-Code", "Vertex"),
    ("zoo-code", "vertex"),
    ("Zoo Code", "Vertex"),
    ("zoo code", "vertex"),
    ("zoocode", "vertex"),
    ("Zoocode", "Vertex"),
    ("zooCode", "vertex"),
    
    # i18n keys
    ("zooAuth", "vertexAuth"),
    
    # HTTP headers
    ("X-Zoo-Editor", "X-Vertex-Editor"),
    ("X-Zoo-Extension-Version", "X-Vertex-Extension-Version"),
    ("X-Zoo-Task-ID", "X-Vertex-Task-ID"),
    ("X-Zoo-Mode", "X-Vertex-Mode"),
    
    # Hard-coded strings
    ('part of Zoo Code', 'part of Vertex'),
    ('Zoo Code says', 'Vertex says'),
    ('Zoo Code is', 'Vertex is'),
    ('zoo_ext_', 'vertex_ext_'),
    
    # CSS variables
    ("--zoo-chat-font-size", "--vertex-chat-font-size"),
    
    # Constants
    ("ZOO_CODE_DEFAULT_BASE_URL", "VERTEX_DEFAULT_BASE_URL"),
    ("ZOO_CODE_TOKEN_KEY", "VERTEX_TOKEN_KEY"),
    ("ZOO_CODE_USER_NAME_KEY", "VERTEX_USER_NAME_KEY"),
    ("ZOO_CODE_USER_EMAIL_KEY", "VERTEX_USER_EMAIL_KEY"),
    ("ZOO_CODE_USER_IMAGE_KEY", "VERTEX_USER_IMAGE_KEY"),
    ("ZOO_CODE_BASE_URL", "VERTEX_BASE_URL"),
    
    # Comments
    ("Zoo-specific", "Vertex-specific"),
    
    # "You are Zoo" in mode descriptions
    ('"You are Zoo,', '"You are Vertex,'),
    ('"You are Zoo.', '"You are Vertex.'),
    
    # Variable names
    ("zooProfiles", "vertexProfiles"),
    
    # Keywords
    ('"zoo",', '"vertex",'),
    
    # Comments / test strings
    ("Zoo auth", "Vertex auth"),
    ("nor Zoo", "nor Vertex"),
    
    # Diagnostic filename
    ("zoo-diagnostics-", "vertex-diagnostics-"),
    
    # Test data values "Backup Zoo"
    ('"Backup Zoo"', '"Backup Vertex"'),
    
    # Complex forms
    ("Zoo's", "Vertex's"),
    ("Zoo?", "Vertex?"),
    ("Zoo.", "Vertex."),
    
    # a "Zoo" pattern (quoted in text)
    ('a "Zoo"', 'a "Vertex"'),
    ('un "Zoo"', 'un "Vertex"'),
    ('ein "Zoo"', 'ein "Vertex"'),
    ('„Zoo"', '„Vertex"'),
    ('"Zoo"', '"Vertex"'),
    ('\'Zoo\'', "'Vertex'"),
    
    # Japanese/Korean/Chinese patterns with Zoo + suffix
    ("Zooが", "Vertexが"),
    ("Zooは", "Vertexは"),
    ("Zooの", "Vertexの"),
    ("Zooを", "Vertexを"),
    ("Zooに", "Vertexに"),
    ("Zooへ", "Vertexへ"),
    ("Zooと", "Vertexと"),
    ("Zooも", "Vertexも"),
    ("Zoo에서", "Vertex에서"),
    ("Zoo가", "Vertex가"),
    ("Zoo을", "Vertex을"),
    ("Zoo에게", "Vertex에게"),
    ("Zoo는", "Vertex는"),
    ("Zoo의", "Vertex의"),
    
    # Turkish suffixes
    ("Zoo'nun", "Vertex'in"),
    ("Zoo'ya", "Vertex'e"),
    ("Zoo'nu", "Vertex'i"),
    ("Zoo'da", "Vertex'te"),
    ("Zoo'dan", "Vertex'ten"),
    
    # Dutch compound
    ("Zoo-", "Vertex-"),
]

# File rename map
file_renames = {
    "zoo-gateway.ts": "vertex-gateway.ts",
    "zoo-gateway.spec.ts": "vertex-gateway.spec.ts",
    "zoo-code-auth.ts": "vertex-auth.ts",
    "zoo-code-auth.test.ts": "vertex-auth.test.ts",
    "ZooGateway.tsx": "VertexGateway.tsx",
    "ZooGateway.spec.tsx": "VertexGateway.spec.tsx",
    "ZooCodeAuthBadge.tsx": "VertexAuthBadge.tsx",
}

def fix_content(filepath):
    """Fix content of a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except:
        return False
    
    original = content
    for old, new in patterns:
        content = content.replace(old, new)
    
    # Final regex pass: replace standalone "Zoo" word that wasn't caught above
    # This catches "Zoo" at line starts, ends, and with various punctuation
    # But we need to be careful not to catch "Zoom", "Zoocode", etc.
    content = re.sub(r'(?<=[^a-zA-Z])Zoo(?=[^a-zA-Z]|$)', 'Vertex', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def get_all_files(root_dirs, extensions):
    """Get all files with given extensions from root dirs"""
    files = []
    for root_dir in root_dirs:
        for ext in extensions:
            pattern = f"**/*{ext}"
            files.extend(glob.glob(os.path.join(root_dir, pattern), recursive=True))
    return [f for f in files if 'node_modules' not in f and '.git' not in f]


# ─── Main ───
script_dir = os.path.dirname(os.path.abspath(__file__))

root_dirs = [
    os.path.join(script_dir, 'src'),
    os.path.join(script_dir, 'webview-ui'),
    os.path.join(script_dir, 'packages'),
    os.path.join(script_dir, 'locales'),
    os.path.join(script_dir, 'schemas'),
    os.path.join(script_dir, 'scripts'),
]

extensions = ['.ts', '.tsx', '.json', '.html', '.css', '.mjs', '.yaml', '.yml', '.js', '.md']

# Step 1: Fix file contents
print("=== Fixing file contents ===")
all_files = get_all_files(root_dirs, extensions)
count = 0
for f in all_files:
    if os.path.isfile(f):
        if fix_content(f):
            count += 1
print(f'Content updated in {count} files')

# Step 2: Fix root-level config files
print("\n=== Fixing root config files ===")
root_files = glob.glob(os.path.join(script_dir, '*.json')) + \
             glob.glob(os.path.join(script_dir, '*.yaml')) + \
             glob.glob(os.path.join(script_dir, '*.yml')) + \
             glob.glob(os.path.join(script_dir, '*.md')) + \
             glob.glob(os.path.join(script_dir, '.*')) + \
             glob.glob(os.path.join(script_dir, '.github', '**', '*.yml'), recursive=True)

for f in root_files:
    if os.path.isfile(f):
        if fix_content(f):
            count += 1
            print(f'Updated: {f}')

print(f'\nTotal files updated: {count}')

# Step 3: Verify only zoom/ZoomControls false positives remain
print("\n=== Final verification ===")
print("Running grep for remaining Zoo references...")
import subprocess
result = subprocess.run(
    ['grep', '-r', '-l', '-P', '(?<![a-zA-Z])Zoo(?![a-zA-Z])', 
     '--include=*.ts', '--include=*.tsx', '--include=*.json', '--include=*.html', 
     '--include=*.css', '--include=*.mjs', '--include=*.yaml', '--include=*.yml',
     'src/', 'webview-ui/src/', 'packages/', 'locales/', 'scripts/', 'schemas/'],
    capture_output=True, text=True, shell=True
)
remaining = [f for f in result.stdout.strip().split('\n') if f]
if remaining:
    print("Files still with standalone Zoo:")
    for f in remaining[:20]:
        print(f"  {f}")
    if len(remaining) > 20:
        print(f"  ... and {len(remaining) - 20} more")
else:
    print("No standalone Zoo references found!")

print("Done!")