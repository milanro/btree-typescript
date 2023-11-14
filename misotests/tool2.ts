import BTree from "../b+tree";
import { setPersistenceManager } from "../persistence/globals/globals";
import { SyncFSPersistenceManager } from "../persistence/manager/persistenceManager";

console.log('tool1');
setPersistenceManager(new SyncFSPersistenceManager("/tmp1/btree/db1"));

const tree = new BTree();
tree.load('63ee3dc8ae1470b1eb75015a2c3de9cf4d0bd2b2134bae56208a4f3470c84618');

tree.getRange('miso1a', 'miso3').forEach((value, key) => {
   console.log(key, value);
});

 tree.commit();




