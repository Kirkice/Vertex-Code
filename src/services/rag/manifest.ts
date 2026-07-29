import * as fs from "fs/promises"
import * as path from "path"

export interface RagManifest {
	version: 1
	embeddingModel?: string
	vectorDimension?: number
	files: Record<string, { hash: string; nodeIds: string[] }>
	updatedAt: string
}

const emptyManifest = (): RagManifest => ({ version: 1, files: {}, updatedAt: new Date(0).toISOString() })

export async function loadManifest(filePath: string): Promise<RagManifest> {
	try {
		const raw = await fs.readFile(filePath, "utf8")
		const parsed = JSON.parse(raw) as Partial<RagManifest>
		if (parsed.version !== 1 || !parsed.files) return emptyManifest()
		return { ...emptyManifest(), ...parsed, files: parsed.files }
	} catch {
		return emptyManifest()
	}
}

export async function saveManifest(filePath: string, manifest: RagManifest): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	const next = { ...manifest, updatedAt: new Date().toISOString() }
	await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8")
}
