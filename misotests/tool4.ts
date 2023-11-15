import BTree from "../b+tree";
import { setPersistenceManager } from "../persistence/globals/globals";
import { SyncFSPersistenceManager } from "../persistence/manager/persistenceManager";
import { PersistentBNode } from "../persistence/util/proxyUtil";

console.log('tool4');
const db = "/tmp1/btree/db7";
setPersistenceManager(new SyncFSPersistenceManager(db));

const tree = new BTree();
tree.load('019c8503b0facde198fb54da38fb8eeb9f2a50a8439928fce0ff62b9344003a6');
const id = ((tree as any)._root as PersistentBNode).computeId();
console.log(id);



console.log(db)

console.log(((tree as any)._root as PersistentBNode).computeId());

tree.getRange('miso0000000001', 'miso0000000012').forEach((value, key) => {
   console.log(key, value);
});

console.log(((tree as any)._root as PersistentBNode).computeId());

 //tree.commit();




