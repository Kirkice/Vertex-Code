import type { VsCodeMessage } from '../types/vscode';
/**
 * VS Code API Hook
 * 提供与扩展通信的功能
 */
export declare function useVSCode(): {
    postMessage: (message: VsCodeMessage) => void;
    getState: () => any;
    setState: (state: any) => void;
    onMessage: (type: string, handler: (message: any) => void) => () => void;
};
//# sourceMappingURL=useVSCode.d.ts.map