import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { randomUUID } from "node:crypto"

/**
 * 面向 JSON 文件的通用持久化辅助类。
 *
 * 写入采用“临时文件 + rename”策略，避免进程被终止时留下无法解析的半个 JSON。
 * 该类不包含业务字段，配置、Profile 和 Secret 可以复用同一套可靠写入逻辑。
 */
export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly initialValue: T,
  ) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as T
    } catch (error) {
      if (isFileNotFound(error)) return this.initialValue
      throw error
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf8")
    await rename(temporaryPath, this.filePath)
  }
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
