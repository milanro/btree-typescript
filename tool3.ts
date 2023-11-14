import BTree from "./b+tree";
import { setPersistenceManager } from "./persistence/globals/globals";
import { SyncFSPersistenceManager } from "./persistence/manager/persistenceManager";

console.log('tool3');

const tree = new BTree();



for(let i=0; i<35; i++){
    tree.set('miso'+i, 'kura' + i);
}


tree.getRange('miso1a', 'miso3').forEach((value, key) => {
     console.log(key, value);
});
setPersistenceManager(new SyncFSPersistenceManager("/tmp1/btree/db3"));
tree.commit();




