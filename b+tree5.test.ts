import BTree, { simpleComparator } from "./b+tree";
import SortedArray from "./sorted-array";
import MersenneTwister from "mersenne-twister";

var test: (name: string, f: () => void) => void = it;

var rand: any = new MersenneTwister(1234);
function randInt(max: number) {
  return rand.random_int() % max;
}
async function expectTreeEqualTo(a: BTree, b: SortedArray,) {
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
  
  for (let size of [6, 36, 216]) {
    test(`setPairs & deleteRange [size ${size}]`, async () => {
      // Store numbers in descending order
      var reverseComparator = (a:number, b:number) => b - a;
  
      // Prepare reference list
      var list = new SortedArray<number,string>([], reverseComparator);
      for (var i = size-1; i >= 0; i--)
        list.set(i, i.toString());
  
      // Add all to tree in the "wrong" order (ascending)
      var tree = new BTree<number,string>(undefined, reverseComparator, maxNodeSize);
      await tree.applyEntries();
      await tree.setPairs(list.getArray().slice(0).reverse());
      await expectTreeEqualTo(tree, list);
  
      // Remove most of the items
      expect(await tree.deleteRange(size-2, 5, true)).toEqual(size-6);
      await expectTreeEqualTo(tree, new SortedArray<number,string>([
        [size-1, (size-1).toString()], [4,"4"], [3,"3"], [2,"2"], [1,"1"], [0,"0"]
      ], reverseComparator));
      expect(await tree.deleteRange(size, 0, true)).toEqual(6);
      expect(await tree.toArray()).toEqual([]);
    });
  }



/*

  for (let size of [36]) {
    test(`setPairs & deleteRange [size ${size}]`, async () => {
      // Store numbers in descending order
      var reverseComparator = (a:number, b:number) => b - a;
  
      // Prepare reference list
      var list = new SortedArray<number,string>([], reverseComparator);
      for (var i = size-1; i >= 0; i--)
        list.set(i, i.toString());
  
      // Add all to tree in the "wrong" order (ascending)
      var tree = new BTree<number,string>(undefined, reverseComparator, maxNodeSize);
      await tree.applyEntries();
  
      // throw new Error(JSON.stringify(list.getArray().slice(0).reverse()));
      // 

      await tree.setPairs(list.getArray().slice(0).reverse());
      await expectTreeEqualTo(tree, list);
    });
  }
  */

}





