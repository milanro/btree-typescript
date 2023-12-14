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


  for (let size of [5, 25, 125]) {
    // Ensure standard operations work for various list sizes
    test(`Various operations [starting size ${size}]`, async () => {
      var tree = new BTree<number,number|undefined>(undefined, undefined, maxNodeSize);
      await tree.applyEntries();
      var list = new SortedArray<number,number|undefined>();
    
      var i = 0, key;
      for (var i = 0; await tree.getSize() < size; i++) {
        await addToBoth(tree, list, i, undefined);
        expect(list.size).toEqual(await tree.getSize());
      }
      await expectTreeEqualTo(tree, list);

      // Add some in the middle and try get()
      for (var i = size; i <= size + size/8; i += 0.5) {
        expect(await tree.get(i)).toEqual(list.get(i));
        await addToBoth(tree, list, i, i);
      }
      await expectTreeEqualTo(tree, list);
      expect(await tree.get(-15, 12345)).toBe(12345);
      expect(await tree.get(0.5, 12345)).toBe(12345);

      
      // Try some changes that should have no effect
      for (var i = size; i < size + size/8; i += 0.5) {
        expect(await tree.setIfNotPresent(i, -i)).toBe(false);
        expect(await tree.changeIfPresent(-i, -i)).toBe(false);
      }
      await expectTreeEqualTo(tree, list);
      
      // Remove a few items and check against has()
      for (var i = 0; i < 10; i++) {
        key = randInt(size * 2) / 2;
        var has = await tree.has(key);
        expect(has).toEqual(list.has(key));
        expect(has).toEqual(await tree.delete(key));
        expect(has).toEqual(list.delete(key));
        await expectTreeEqualTo(tree, list);
      }
      await expectTreeEqualTo(tree, list);
    });
  }


  test('persistent and functional operations', async () => {
    var tree = new BTree<number,number|undefined>(undefined, undefined, maxNodeSize);
    var list = new SortedArray<number,number|undefined>();
    
    // Add keys 10 to 5000, step 10
    for (var i = 1; i <= 500; i++)
      await addToBoth(tree, list, i*10, i);
    
    
    // Test mapValues()
    (await tree.mapValues(async v => v!*10)).forEachPair(async (k, v) => { expect(v).toBe(k) });

    // Perform various kinds of no-ops
    var t1 = tree;
    expect(await t1.withKeys([10,20,30], true)           ).toBe(tree);
    expect(await t1.withKeys([10,20,30], false)          ).not.toBe(tree);
    expect(await t1.withoutKeys([5,105,205], true)       ).toBe(tree);
    expect(await t1.without(666, true)                   ).toBe(tree);
    expect(await t1.withoutRange(1001, 1010, false, true)).toBe(tree);
    expect(await t1.filter(() => true, true)             ).toBe(tree);

    // Make a series of modifications in persistent mode
    var t2 = await (await t1.with(5,5)).with(999,999);
    var t3 = await (await t2.without(777)).without(7);
    var t4 = await (await t3.withPairs([[60,66],[6,6.6]], false));
    var t5 = await (await t4.withKeys([199,299,399], true));
    var t6 = await (await (await t4.without(200)).without(300)).without(400);
    var t7 = await (await t6.withoutKeys([10,20,30], true));
    var t8 = await (await t7.withoutRange(100, 200, false, true));

    // Check that it all worked as expected
    await expectTreeEqualTo(t1, list);
    list.set(5, 5);
    list.set(999, 999);
    await expectTreeEqualTo(t2, list);
    list.delete(777);
    list.delete(7);
    await expectTreeEqualTo(t3, list);
    list.set(6, 6.6);
    await expectTreeEqualTo(t4, list);
    list.set(199, undefined);
    list.set(299, undefined);
    list.set(399, undefined);
    await  expectTreeEqualTo(t5, list);
    for(var k of [199, 299, 399, 200, 300, 400])
      list.delete(k);
      await expectTreeEqualTo(t6, list);
    for(var k of [10, 20, 30])
      list.delete(k);
      await expectTreeEqualTo(t7, list);
    for(var i = 100; i < 200; i++)
      list.delete(i);
      await expectTreeEqualTo(t8, list);

    // Filter out all hundreds
    var t9 = await t8.filter(k => k % 100 !== 0, true);
    for (let k = 0; k <= (await tree.maxKey())!; k += 100)
      list.delete(k);
      await expectTreeEqualTo(t9, list);
  });

}





