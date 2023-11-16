import BTree from "../b+tree";
import { setPersistenceManager } from "../persistence/globals/globals";
import { SyncFSPersistenceManager } from "../persistence/manager/persistenceManager";
import { PersistentBNode } from "../persistence/util/proxyUtil";
import { db } from "./tool-config";

console.log('tool4');
setPersistenceManager(new SyncFSPersistenceManager(db));

const tree = new BTree();
tree.load('019c8503b0facde198fb54da38fb8eeb9f2a50a8439928fce0ff62b9344003a6');
const id = ((tree as any)._root as PersistentBNode).computeId();
console.log(id);



console.log(db)

console.log(((tree as any)._root as PersistentBNode).computeId());

console.log("m - 1");
tree.getRange('miso0000009999', 'miso0000010009').forEach((value, key) => {
   console.log(key, value);
});


for(let i=10000; i<20000; i++){
   const nr = i.toString().padStart(10, '0');
   tree.set('miso'+nr, 'kura' + nr);
}

console.log("m - 2");
tree.getRange('miso0000009999', 'miso0000010009').forEach((value, key) => {
   console.log(key, value);
});

console.log(((tree as any)._root as PersistentBNode).computeId());

 tree.commit();




