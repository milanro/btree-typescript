import BTree from "../b+tree";
import SortedArray from "../sorted-array";


insert8.bind(null, 8);
insert8.bind(null, 4);
function insert8(maxNodeSize: number) {
  var items: [number,any][] = [[6,"six"],[7,7],[5,5],[2,"two"],[4,4],[1,"one"],[3,3],[8,8]];
  var tree = new BTree<number>(items, undefined, maxNodeSize);
  var list = new SortedArray(items, undefined);
  console.log(maxNodeSize);
  tree.checkValid();
}

insert8(10);