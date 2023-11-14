import { PersistenceManager, SyncFSPersistenceManager } from "../manager/persistenceManager";

let persistenceManager: PersistenceManager;
export function setPersistenceManager(manager: PersistenceManager) {
    persistenceManager = manager;
}
export function getPersistenceManager(): PersistenceManager {
    return persistenceManager;
}