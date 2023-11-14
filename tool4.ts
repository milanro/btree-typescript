import BTree from "./b+tree";
import { setPersistenceManager } from "./persistence/globals/globals";
import { SyncFSPersistenceManager } from "./persistence/manager/persistenceManager";

console.log('tool4');
setPersistenceManager(new SyncFSPersistenceManager("/tmp1/btree/db3"));

const tree = new BTree();
tree.load('f425cf886ed422d78052bd341df8e84856090d1646e1bb3773b21f4a6aa7451a');

tree.getRange('miso1a', 'miso3').forEach((value, key) => {
   console.log(key, value);
});

 //tree.commit();




