import { name, version } from "../../package.json"

export const Package = {
	publisher: "vertex",
	name: process.env.PKG_NAME || name,
	version: process.env.PKG_VERSION || version,
	outputChannel: process.env.PKG_OUTPUT_CHANNEL || "Vertex-Code",
	releaseChannel: process.env.PKG_RELEASE_CHANNEL || "stable",
	sha: process.env.PKG_SHA,
} as const
