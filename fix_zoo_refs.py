import os, glob

patterns = [
    ('zooGatewaySchema', 'vertexGatewaySchema'),
    ('zooGatewayModelId', 'vertexGatewayModelId'),
    ('zooGatewayBaseUrl', 'vertexGatewayBaseUrl'),
    ('zooGatewayDefaultModelId', 'vertexGatewayDefaultModelId'),
    ('ZOO_GATEWAY_PROMPT_CACHING_MODELS', 'VERTEX_GATEWAY_PROMPT_CACHING_MODELS'),
    ('ZOO_GATEWAY_DEFAULT_TEMPERATURE', 'VERTEX_GATEWAY_DEFAULT_TEMPERATURE'),
    ('pickZooGatewayDefaultModelId', 'pickVertexGatewayDefaultModelId'),
    ('ZooGatewayProps', 'VertexGatewayProps'),
    ('ZooGateway', 'VertexGateway'),
    ('settings:validation.zooGatewaySignIn', 'settings:validation.vertexGatewaySignIn'),
    ('settings:providers.zooGateway', 'settings:providers.vertexGateway'),
    ('orgWithoutZooGateway', 'orgWithoutVertexGateway'),
    ('zooModels', 'vertexModels'),
    ('Zoo Gateway', 'Vertex Gateway'),
    ('ZooGateway.tsx', 'VertexGateway.tsx'),
    ('"Zoo Gateway"', '"Vertex Gateway"'),
    ('from "../ZooGateway"', 'from "../VertexGateway"'),
    ('from "./ZooGateway"', 'from "./VertexGateway"'),
]

count = 0
for f in glob.glob('webview-ui/src/**/*.ts', recursive=True) + glob.glob('webview-ui/src/**/*.tsx', recursive=True):
    with open(f, 'r', encoding='utf-8') as fh:
        c = fh.read()
    orig = c
    for old, new in patterns:
        c = c.replace(old, new)
    if c != orig:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(c)
        count += 1
        print(f'Updated: {f}')

# Also fix i18n JSON files
for f in glob.glob('webview-ui/src/i18n/**/*.json', recursive=True):
    with open(f, 'r', encoding='utf-8') as fh:
        c = fh.read()
    orig = c
    c = c.replace('zooGatewaySignIn', 'vertexGatewaySignIn')
    c = c.replace('"zooGateway"', '"vertexGateway"')
    if c != orig:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(c)
        count += 1
        print(f'Updated: {f}')

print(f'Total updated: {count}')