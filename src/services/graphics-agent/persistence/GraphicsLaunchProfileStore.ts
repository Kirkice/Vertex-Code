import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { GraphicsInvestigationSession, GraphicsLaunchProfile } from "../../graphics-provider/GraphicsProviderTypes"
import { validateGraphicsLaunchProfile } from "../GraphicsLaunchSession"

const DIRECTORY = ".vertex"
const PROFILE_FILE = "graphics-profiles.json"
const SESSION_DIRECTORY = "graphics-sessions"

export class GraphicsLaunchProfileStore {
	constructor(private readonly workspacePath: string | undefined, private readonly log: (message: string) => void = () => undefined) {}

	async listProfiles(): Promise<GraphicsLaunchProfile[]> {
		const value = await this.readJson<unknown>(path.join(DIRECTORY, PROFILE_FILE))
		return Array.isArray(value)
			? value.filter((candidate): candidate is GraphicsLaunchProfile => this.isValidProfile(candidate))
			: []
	}

	async getProfile(id: string): Promise<GraphicsLaunchProfile | undefined> {
		return (await this.listProfiles()).find((profile) => profile.id === id)
	}

	async saveProfile(profile: GraphicsLaunchProfile): Promise<boolean> {
		const profiles = await this.listProfiles()
		const index = profiles.findIndex((candidate) => candidate.id === profile.id)
		if (index >= 0) profiles[index] = profile
		else profiles.push(profile)
		return this.saveProfiles(profiles)
	}

	async saveProfiles(profiles: GraphicsLaunchProfile[]): Promise<boolean> {
		if (profiles.some((profile) => !this.isValidProfile(profile))) return false
		return this.writeJson(path.join(DIRECTORY, PROFILE_FILE), profiles)
	}

	async deleteProfile(id: string): Promise<boolean> {
		const profiles = await this.listProfiles()
		const next = profiles.filter((profile) => profile.id !== id)
		return next.length === profiles.length ? true : this.saveProfiles(next)
	}

	async loadSession(id: string): Promise<GraphicsInvestigationSession | undefined> {
		return this.readJson<GraphicsInvestigationSession>(path.join(DIRECTORY, SESSION_DIRECTORY, `${id}.json`))
	}

	async saveSession(session: GraphicsInvestigationSession): Promise<boolean> {
		return this.writeJson(path.join(DIRECTORY, SESSION_DIRECTORY, `${session.id}.json`), session)
	}

	async listSessions(): Promise<GraphicsInvestigationSession[]> {
		if (!this.workspacePath) return []
		try {
			const entries = await (await import("node:fs/promises")).readdir(path.join(this.workspacePath, DIRECTORY, SESSION_DIRECTORY))
			const sessions = await Promise.all(
				entries.filter((entry) => entry.endsWith(".json")).map((entry) => this.readJson<GraphicsInvestigationSession>(path.join(DIRECTORY, SESSION_DIRECTORY, entry))),
			)
			return sessions.filter((session): session is GraphicsInvestigationSession => Boolean(session))
		} catch (error) {
			if ((error as { code?: string }).code !== "ENOENT") this.log(`[Graphics] Could not list sessions: ${String(error)}`)
			return []
		}
	}

	private isValidProfile(candidate: unknown): candidate is GraphicsLaunchProfile {
		if (!candidate || typeof candidate !== "object") return false
		const profile = candidate as GraphicsLaunchProfile
		return profile.version === 1 && typeof profile.id === "string" && typeof profile.name === "string" &&
			(profile.platform === "windows" || profile.platform === "android") &&
			typeof profile.startupWaitMs === "number" && typeof profile.captureTrigger === "object" &&
			validateGraphicsLaunchProfile(profile).length === 0
	}

	private async readJson<T>(relativePath: string): Promise<T | undefined> {
		if (!this.workspacePath) return undefined
		try {
			return JSON.parse(await readFile(path.join(this.workspacePath, relativePath), "utf8")) as T
		} catch (error) {
			if ((error as { code?: string }).code !== "ENOENT") this.log(`[Graphics] Could not read ${relativePath}: ${String(error)}`)
			return undefined
		}
	}

	private async writeJson(relativePath: string, value: unknown): Promise<boolean> {
		if (!this.workspacePath) return false
		const target = path.join(this.workspacePath, relativePath)
		const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
		try {
			await mkdir(path.dirname(target), { recursive: true })
			await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
			await rename(temporary, target)
			return true
		} catch (error) {
			this.log(`[Graphics] Could not write ${relativePath}: ${String(error)}`)
			await rm(temporary, { force: true }).catch(() => undefined)
			return false
		}
	}
}
