export declare const PERMISSION_CONTEXT_ARG: "_glean_permission_context";
export declare function stripPermissionContext(args: Record<string, unknown>): Record<string, unknown>;
export declare function createBypassReceipt(baseDir: string, toolName: string, args: Record<string, unknown>): string;
export declare function consumeBypassReceipt(baseDir: string, token: unknown, toolName: string, args: Record<string, unknown>): boolean;
export declare function cleanupBypassReceipts(baseDir: string): void;
