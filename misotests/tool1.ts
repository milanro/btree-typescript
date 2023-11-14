import BTree from "../b+tree";
import { setPersistenceManager } from "../persistence/globals/globals";
import { SyncFSPersistenceManager } from "../persistence/manager/persistenceManager";

console.log('tool1');

const tree = new BTree();
tree.set('miso1a', 'malinovo');
tree.set('miso1b', 'huba');
tree.set('miso1c', 'ebe');
tree.set('miso1d', 'kura');
tree.set('miso1e', 'rata');
tree.set('miso2a', 'raba');
tree.set('miso2b', 'kura');
tree.set('miso2', 'ebe');
tree.set('miso3', 'kura');
tree.set('miso4', 'rata');


for(let i=0; i<1000; i++){
    tree.set('miso'+i, 'kura' + i);
}


tree.getRange('miso1a', 'miso3').forEach((value, key) => {
     console.log(key, value);
});
setPersistenceManager(new SyncFSPersistenceManager("/tmp1/btree/db1"));
tree.commit();




