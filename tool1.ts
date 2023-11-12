import BTree from "./b+tree";

console.log('tool1');

const tree = new BTree();
tree.set('miso1a', 'malinovo');
tree.set('miso1b', 'huba');
tree.set('miso1c', 'ebe');
tree.set('miso1d', 'kura');
tree.set('miso1e', 'rata');
tree.set('miso2a', 'raba');
tree.set('miso2b', 'kura');
tree.set('miso2', 'ebe');
tree.set('miso3', 'kura');


tree.getRange('miso1a', 'miso2').forEach((value, key) => {
    console.log(key, value);
});