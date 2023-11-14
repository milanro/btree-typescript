import BTree from "./b+tree";
import { setPersistenceManager } from "./persistence/globals/globals";
import { SyncFSPersistenceManager } from "./persistence/manager/persistenceManager";

console.log('tool3');

const tree = new BTree();



for(let i=0; i<10000; i++){
    const nr = i.toString().padStart(10, '0');
    tree.set('miso'+nr, 'kura' + nr);
}


tree.getRange('miso0000000001', 'miso0000000012').forEach((value, key) => {
     console.log(key, value);
});
setPersistenceManager(new SyncFSPersistenceManager("/tmp1/btree/db5"));
tree.commit();




