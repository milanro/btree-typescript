import BTree from "../b+tree";

let items: [string,any][] = [["A",1],["B",2],["C",3],["D",4],["E",5],["F",6],["G",7],["H",8]];
let tree = new BTree<string>(items);

var tree2 = tree.clone();
tree.delete("G");
console.log(tree2.get('A'));


