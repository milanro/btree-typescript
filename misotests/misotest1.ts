import BTree from "../b+tree";
import SortedArray from "../sorted-array";


async function insert8(maxNodeSize: number) {
    var items: [number,any][] = [[6,"six"],[7,7],[5,5],[2,"two"],[4,4],[1,"one"],[3,3],[8,8]];
    var tree = new BTree<number>(items, undefined, maxNodeSize);
    await tree.applyEntries();
    var list = new SortedArray(items, undefined);
    await tree.checkValid();
    console.log(await tree.keysArray());
  }

insert8(4);