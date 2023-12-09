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

  describe(`Next higher/lower methods`, () => {
    test(`nextLower/nextHigher methods return undefined in an empty tree`, async () => {
      const tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
      await tree.applyEntries();
      expect(await tree.nextLowerPair(undefined)).toEqual(undefined);
      expect(await tree.nextHigherPair(undefined)).toEqual(undefined);
      expect(await tree.getPairOrNextLower(1)).toEqual(undefined);
      expect(await tree.getPairOrNextHigher(2)).toEqual(undefined);
      
      // This shouldn't make a difference
      await tree.set(5, 55);
      await tree.delete(5);
      
      expect(await tree.nextLowerPair(undefined)).toEqual(undefined);
      expect(await tree.nextHigherPair(undefined)).toEqual(undefined);
      expect(await tree.nextLowerPair(3)).toEqual(undefined);
      expect(await tree.nextHigherPair(4)).toEqual(undefined);
      expect(await tree.getPairOrNextLower(5)).toEqual(undefined);
      expect(await tree.getPairOrNextHigher(6)).toEqual(undefined);
    });

    async function initTreeandPairs(size: number) {
      const tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
      await tree.applyEntries();
      const pairs: [number,number][] = [];
      for (let i = 0; i < size; i++) {
        const value = i;
        await tree.set(i * 2, value);
        pairs.push([i * 2, value]);
      }
      return {tree, pairs}
    }

    for (let size of [5, 10, 300]) {


      test(`nextLowerPair/nextHigherPair for tree of size ${size}`, async () => {
        const {tree, pairs} = await initTreeandPairs(size);
        expect(await tree.nextHigherPair(undefined)).toEqual([await tree.minKey()!, await tree.get((await tree.minKey())!)]);
        expect(await tree.nextHigherPair(await tree.maxKey())).toEqual(undefined);
        for (let i = 0; i < size * 2; i++) {
          if (i > 0) {
            expect(await tree.nextLowerPair(i)).toEqual(pairs[((i + 1) >> 1) - 1]);
          }
          if (i < size - 1) {
            let testPair = await tree.nextHigherPair(i);
            if(testPair === undefined){
              console.log(i);
              testPair = await tree.nextHigherPair(i);
            }
            expect(await tree.nextHigherPair(i)).toEqual(pairs[(i >> 1) + 1]);
          }
        }
        expect(await tree.nextLowerPair(undefined)).toEqual([await tree.maxKey()!, await tree.get((await tree.maxKey())!)]);
        expect(await tree.nextLowerPair(await tree.minKey())).toEqual(undefined);
      })

      test(`getPairOrNextLower/getPairOrNextHigher for tree of size ${size}`, async () => {
        const {tree, pairs} = await initTreeandPairs(size);
        for (let i = 0; i < size * 2; i++) {
          if (i > 0) {
            expect(await tree.getPairOrNextLower(i)).toEqual(pairs[i >> 1]);
          }
          if (i < size - 1) {
            expect(await tree.getPairOrNextHigher(i)).toEqual(pairs[(i + 1) >> 1]);
          }
        }
      })
    }
  });

}


