import BTree, { simpleComparator } from "../b+tree";

    // This tests make a 3 layer tree (height = 2), so use a small branching factor.
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
    myexpect(tree.height,2);

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

    const deepClone = tree.greedyClone(true);
    const cheapClone = tree.clone();

    // These two clones should remain unchanged forever.
    // The bug this is testing for resulted in the cheap clone getting modified:
    // we will compare it against the deep clone to confirm it does not.

    // Delete a bunch more nodes, causing merging.
    for (
      let index = 0;
      index < count;
      index++
    ) {
      if (index % 16 !== 0) {
        tree.delete(index);
      }
    }

    const different: number[] = [];
    const onDiff = (k: number) => { different.push(k); }
    deepClone.diffAgainst(cheapClone, onDiff, onDiff, onDiff);
    myexpect(different, []);


    function myexpect(a: any,b: any){
      if(a !== b){
        throw Error('not equal "' + a + '" : "' + b + '"');
      }
    }