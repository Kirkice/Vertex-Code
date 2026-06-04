// VS Code Webview API 类型定义

interface VsCodeApi {
  postMessage(message: any): void
  getState(): any
  setState(state: any): void
}

// 全局声明 acquireVsCodeApi 函数
declare global {
  function acquireVsCodeApi(): VsCodeApi
}

export interface VsCodeMessage {
  type: string
  [key: string]: any
}

export type { VsCodeApi }