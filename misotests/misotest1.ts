import BTree, { simpleComparator } from "../b+tree";

const maxNodeSize = 4;
const tree = new BTree<number, number>(
  undefined,
  simpleComparator,
  maxNodeSize
);
// Build a 3 layer tree
const count = maxNodeSize * maxNodeSize * maxNodeSize;
for (
  let index = 0;
  index < count;
  index++
) {
  tree.set(index, 0);
}
// Leaf nodes don't count, so this is depth 2
console.log(tree.height===2);

// Delete most of the keys so merging interior nodes is possible, marking all nodes as shared.
for (
  let index = 0;
  index < count;
  index++
) {
  if (index % 4 !== 0) {
    tree.delete(index);
  }
}