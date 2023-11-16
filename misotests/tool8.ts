import BTree from "../b+tree";
import { setPersistenceManager } from "../persistence/globals/globals";
import { SyncFSPersistenceManager } from "../persistence/manager/persistenceManager";
import { PersistentBNode } from "../persistence/util/proxyUtil";
import { db } from "./tool-config";

console.log('tool8');
let commitId: string;
setPersistenceManager(new SyncFSPersistenceManager(db));
let down: string;
let up: string;

async function fillData() {
   const tree = new BTree();
   for(let i=0; i<10; i++){
      const nr = i.toString().padStart(10, '0');
      const key = 'miso' + nr;
      if(i===0)
         down = key;
      if(i===9)
         up = key;
      await tree.set(key, 'kura' + nr);

   }
   commitId = await tree.commit();
}

async function test() {

   
   const tree = new BTree();
   await tree.load(commitId);
   const id = await ((tree as any)._root as PersistentBNode).computeId();
   
   console.log("m - 1");
   
   const range = await tree.getRange(down , up);
   
   range.forEach((value, key) => {
      console.log(key, value);
   });
      
   console.log("m - 2");
   

} 


fillData().then(() => {
   test();
});


 //tree.commit();




