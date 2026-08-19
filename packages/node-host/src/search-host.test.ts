import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { NodeFileSearchHost } from "./search-host.js"
import { NodeWorkspaceHost } from "./workspace-host.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("NodeFileSearchHost", () => {
  it("searches text files recursively and respects rooignore", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "vertex-search-"))
    temporaryDirectories.push(workspace)
    await mkdir(join(workspace, "ignored"))
    await writeFile(join(workspace, "main.ts"), "const target = true\n", "utf8")
    await writeFile(join(workspace, "ignored", "skip.ts"), "const target = false\n", "utf8")
    await writeFile(join(workspace, ".rooignore"), "ignored\n", "utf8")

    const host = new NodeFileSearchHost(new NodeWorkspaceHost(workspace))
    await expect(host.search("target")).resolves.toEqual([
      { path: "main.ts", line: 1, column: 7, preview: "const target = true" },
    ])
  })
})
