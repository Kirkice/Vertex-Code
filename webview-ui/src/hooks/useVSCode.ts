import { useEffect, useCallback, useRef } from 'react'
import type { VsCodeApi, VsCodeMessage } from '../types/vscode'

// 全局 VS Code API 实例
let vscodeApi: VsCodeApi | undefined

function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi()
  }
  return vscodeApi!
}

/**
 * VS Code API Hook
 * 提供与扩展通信的功能
 */
export function useVSCode() {
  const messageHandlersRef = useRef<Map<string, ((message: any) => void)[]>>(new Map())

  // 发送消息到扩展
  const postMessage = useCallback((message: VsCodeMessage) => {
    const api = getVsCodeApi()
    api.postMessage(message)
  }, [])

  // 获取状态
  const getState = useCallback(() => {
    const api = getVsCodeApi()
    return api.getState()
  }, [])

  // 设置状态
  const setState = useCallback((state: any) => {
    const api = getVsCodeApi()
    api.setState(state)
  }, [])

  // 监听消息
  const onMessage = useCallback((type: string, handler: (message: any) => void) => {
    const handlers = messageHandlersRef.current
    if (!handlers.has(type)) {
      handlers.set(type, [])
    }
    handlers.get(type)!.push(handler)

    // 返回取消订阅的函数
    return () => {
      const currentHandlers = handlers.get(type)
      if (currentHandlers) {
        const index = currentHandlers.indexOf(handler)
        if (index > -1) {
          currentHandlers.splice(index, 1)
        }
      }
    }
  }, [])

  // 设置全局消息监听器
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      const handlers = messageHandlersRef.current.get(message.type)
      if (handlers) {
        handlers.forEach(handler => handler(message))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  return {
    postMessage,
    getState,
    setState,
    onMessage
  }
}