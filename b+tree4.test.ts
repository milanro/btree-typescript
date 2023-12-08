import BTree, { simpleComparator } from "./b+tree";
import SortedArray from "./sorted-array";
import MersenneTwister from "mersenne-twister";

var test: (name: string, f: () => void) => void = it;

var rand: any = new MersenneTwister(1234);
function randInt(max: number) {
  return rand.random_int() % max;
}
async function expectTreeEqualTo(a: BTree, b: SortedArray) {
  await a.checkValid();
  expect(await a.toArray()).toEqual(b.getArray());
}
async function addToBoth<K, V>(a: BTree<K, V>, b: SortedArray<K, V>, k: K, v: V) {
  const aSet = await a.set(k, v);
  const bSet = b.set(k, v);
  expect(aSet).toEqual(bSet);
}




describe('B+ tree with fanout 32', testBTree.bind(null, 32));
describe('B+ tree with fanout 10', testBTree.bind(null, 10));
describe('B+ tree with fanout 4',  testBTree.bind(null, 4));



function testBTree(maxNodeSize: number)
{
  for (let size of [8, 64, 512]) {
    let tree = new BTree<number,number>(undefined, undefined, maxNodeSize);    
    let list = new SortedArray<number,number>();

    test(`Insert randomly & toArray [size ${size}]`, async () => {
      await tree.applyEntries();
      while (await tree.getSize() < size) {
        var key = randInt(size * 2);
        await addToBoth(tree, list, key, key);
        expect(await tree.getSize()).toEqual(list.size);
      }
      expectTreeEqualTo(tree, list);
    });


    test(`Insert with few values [size ${size}]`, async () => {
      let list = new SortedArray<number,string|undefined>();
      for (var i = 0; i < size; i++) {
        var key = randInt(size * 2);
        // Use a value only occasionally to stress out the no-values optimization
        list.set(key, key % 10 == 0 ? key.toString() : undefined);
      }
      let tree = new BTree<number,string|undefined>(list.getArray(), undefined, maxNodeSize);
      await tree.applyEntries();
      expectTreeEqualTo(tree, list);
    });
  }
}


describe('dummy', () => { test('dummy', () => {}) } );  
