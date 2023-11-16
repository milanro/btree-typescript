import BTree from "../b+tree";
import { setPersistenceManager } from "../persistence/globals/globals";
import { SyncFSPersistenceManager } from "../persistence/manager/persistenceManager";
import { PersistentBNode } from "../persistence/util/proxyUtil";
import { db } from "./tool-config";

async function test() {
   console.log('tool4');

   setPersistenceManager(new SyncFSPersistenceManager(db));
   
   const tree = new BTree();
   tree.load('019c8503b0facde198fb54da38fb8eeb9f2a50a8439928fce0ff62b9344003a6');
   const id = await ((tree as any)._root as PersistentBNode).computeId();
   
   console.log("m - 1");
   
   const range = await tree.getRange('miso0000009999', 'miso0000010009');
   
   range.forEach((value, key) => {
      console.log(key, value);
   });
      
   console.log("m - 2");
   
   
   tree.load('99ff13614eff16b8b3b1925899851311f40878878841eb1fa041b5f686154de4');
   console.log("m - 2");
   (await tree.getRange('miso0000009999', 'miso0000010009')).forEach((value, key) => {
      console.log(key, value);
   });
   console.log("m - 2");
} 

test();

 //tree.commit();




