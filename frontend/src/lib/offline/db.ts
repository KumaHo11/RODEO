// Offline compatibility shim — all functions are no-ops (app is online-only)
// This shim prevents build errors in components that still reference old offline functions.
// Can be removed once all call sites are cleaned up.

export const dbGetAll = async (_store: string): Promise<any[]> => []
export const dbUpsertMany = async (_store: string, _data: any[]): Promise<void> => {}
export const dbUpsert = async (_store: string, _data: any): Promise<void> => {}
export const dbDelete = async (_store: string, _id: string): Promise<void> => {}
export const dbGetOrg = async (): Promise<any> => null
export const dbUpsertOrg = async (_data: any): Promise<void> => {}
export const outboxGetAll = async (): Promise<any[]> => []
export const metaGet = async (_key: string): Promise<any> => null
export const metaSet = async (_key: string, _value: any): Promise<void> => {}
export const countPendingItems = async (): Promise<number> => 0
