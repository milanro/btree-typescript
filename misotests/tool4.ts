import BTree from "./b+tree";
import { setPersistenceManager } from "./persistence/globals/globals";
import { SyncFSPersistenceManager } from "./persistence/manager/persistenceManager";

console.log('tool4');
setPersistenceManager(new SyncFSPersistenceManager("/tmp1/btree/db5"));

const tree = new BTree();
tree.load('ae67073795b88eefbafb99916bd4b484635d531ed4c47a6cf5b8356bf3a64104');

tree.getRange('miso0000000001', 'miso0000000212').forEach((value, key) => {
   console.log(key, value);
});

 //tree.commit();




