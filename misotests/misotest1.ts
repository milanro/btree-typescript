import BTree from "../b+tree";

for (let expectedHeight = 1; expectedHeight < 5; expectedHeight++) {
    for (let nodeSize = 4; nodeSize < 10; nodeSize++) {
      const numEntries = nodeSize ** expectedHeight;
      const entries: [number, number][] = [];
      for (let i = 0; i < numEntries; i++) {
        entries.push([i, i]);
      }
      const tree = new BTree<number>(entries, undefined, nodeSize);
      if(tree.height === (expectedHeight - 1)){
        console.log('OK', expectedHeight, nodeSize);
      }
        else{
            console.log('ERROR', expectedHeight, nodeSize, tree.height);
        }
    }
  }