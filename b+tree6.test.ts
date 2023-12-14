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

    const compare = (a: number, b: number) => a - b;
  
    async function reset() {
      const onlyOther = new Map();
      const onlyThis = new Map();
      const different = new Map();
      const OnlyThis = async (k: number, v: number) => { onlyThis.set(k, v); }
      const OnlyOther = async (k: number, v: number) => { onlyOther.set(k, v); }
      const Different = async (k: number, vThis: number, vOther: number) => { different.set(k, `vThis: ${vThis}, vOther: ${vOther}`); }
      return {OnlyOther, OnlyThis, Different, onlyOther, onlyThis, different};
    }

    function expectMapsEquals<K, V>(mapA: Map<K, V>, mapB: Map<K, V>) {
      const onlyA: [K, V][] = [];
      const onlyB: [K, V][] = [];
      const different: [K, V, V][] = [];

      mapA.forEach((valueA, keyA) => {
        const valueB = mapB.get(keyA);
        if (valueB === undefined) {
          onlyA.push([keyA, valueA]);
        } else if (!Object.is(valueA, valueB)) {
          different.push([keyA, valueA, valueB]);
        }
      });

      mapB.forEach((valueB, keyB) => {
        const valueA = mapA.get(keyB);
        if (valueA === undefined) {
          onlyB.push([keyB, valueB]);
        }
      });
      expect(onlyA.length).toEqual(0);
      expect(onlyB.length).toEqual(0);
      expect(different.length).toEqual(0);
    }

    async function expectDiffCorrect(treeThis: BTree<number, number>, treeOther: BTree<number, number>) {
      const maps = await reset();
      const {OnlyOther, OnlyThis, Different, onlyOther, onlyThis, different} = maps;
      await treeThis.diffAgainst(treeOther, OnlyThis, OnlyOther, Different);
      let onlyThisT: Map<number, number> = new Map();
      let onlyOtherT: Map<number, number> = new Map();
      let differentT: Map<number, string> = new Map();
      await treeThis.forEachPair( async (kThis, vThis) => {
        if (!(await treeOther.has(kThis))) {
          onlyThisT.set(kThis, vThis);
        } else {
          const vOther = await treeOther.get(kThis);
          if (!Object.is(vThis, vOther))
            differentT.set(kThis, `vThis: ${vThis}, vOther: ${vOther}`);
        }
      });
      await treeOther.forEachPair(async(kOther, vOther) => {
        if (!(await treeThis.has(kOther))) {
          onlyOtherT.set(kOther, vOther);
        }
      });
      expectMapsEquals(onlyThis, onlyThisT);
      expectMapsEquals(onlyOther, onlyOtherT);
      expectMapsEquals(different, differentT);
      return maps;
    }

 
    test(`Diff of trees with different comparators is an error`, async () => {
      const {OnlyOther, OnlyThis, Different, onlyOther, onlyThis, different} = await reset();
      const treeA = new BTree<number, number>([], compare);
      await treeA.applyEntries();
      const treeB = new BTree<number, number>([], (a, b) => b - a);
      await treeB.applyEntries();
      
      expect(async () => await treeA.diffAgainst(treeB, OnlyThis, OnlyOther, Different)).rejects.toThrow('comparators');
    });

    const entriesGroup: [number, number][][] = [[], [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]];
    entriesGroup.forEach(entries => {
      test(`Diff of the same tree ${entries.length > 0 ? "(non-empty)" : "(empty)"}`, async () => {
        const tree = new BTree<number, number>(entries, compare, maxNodeSize);
        await tree.applyEntries();
        const {onlyOther, onlyThis, different} =  await expectDiffCorrect(tree, tree);
        expect(onlyOther.size).toEqual(0);
        expect(onlyThis.size).toEqual(0);
        expect(different.size).toEqual(0);
      });
    });


    test(`Diff of identical trees`, async () => {
      const treeA = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      await treeA.applyEntries();
      const treeB = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      await treeB.applyEntries();
      await expectDiffCorrect(treeA, treeB);
    });

    [entriesGroup, [...entriesGroup].reverse()].forEach(doubleEntries => {
      test(`Diff of an ${doubleEntries[0].length === 0 ? 'empty' : 'non-empty'} tree and a ${doubleEntries[1].length === 0 ? 'empty' : 'non-empty'} one`, async () => {
        const treeA = new BTree<number, number>(doubleEntries[0], compare, maxNodeSize);
        await treeA.applyEntries();
        const treeB = new BTree<number, number>(doubleEntries[1], compare, maxNodeSize);
        await treeA.applyEntries();
        await expectDiffCorrect(treeA, treeB);
      });
    });

    test(`Diff of different trees`, async () => {
      const treeA = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      await treeA.applyEntries();
      const treeB = new BTree<number, number>(entriesGroup[1], compare, maxNodeSize);
      await treeB.applyEntries();
      await treeB.set(-1, -1);
      await treeB.delete(2);
      await treeB.set(3, 4);
      await treeB.set(10, 10);
      await expectDiffCorrect(treeA, treeB);
    });


    test(`Diff of odds and evens`, async () => {
      const treeA = new BTree<number, number>([[1, 1], [3, 3], [5, 5], [7, 7]], compare, maxNodeSize);
      await treeA.applyEntries();
      const treeB = new BTree<number, number>([[2, 2], [4, 4], [6, 6], [8, 8]], compare, maxNodeSize);
      await treeB.applyEntries();
      await expectDiffCorrect(treeA, treeB);
      await expectDiffCorrect(treeB, treeA);
    });
/*
    async function applyChanges(treeA: BTree<number, number>, duplicate: (tree: BTree<number, number>) => Promise<BTree<number, number>>) {
      const treeB = await duplicate(treeA);
      const maxKey: number = (await treeA.maxKey())!;
      const onlyInA = -10;
      treeA.set(onlyInA, onlyInA);
      const onlyInBSmall = -1;
      treeB.set(onlyInBSmall, onlyInBSmall);
      const onlyInBLarge = maxKey + 1;
      treeB.set(onlyInBLarge, onlyInBLarge);
      const onlyInAFromDelete = 10
      treeB.delete(onlyInAFromDelete);
      const differingValue = -100;
      const modifiedInB1 = 3, modifiedInB2 = maxKey - 2;
      treeB.set(modifiedInB1, differingValue);
      treeB.set(modifiedInB2, differingValue)
      treeA.diffAgainst(treeB, OnlyThis, OnlyOther, Different);
      expectDiffCorrect(treeA, treeB);
    }

    function makeLargeTree(size?: number): BTree<number, number> {
      size = size ?? Math.pow(maxNodeSize, 3);
      const tree = new BTree<number, number>([], compare, maxNodeSize);
      for (let i = 0; i < size; i++) {
        tree.set(i, i);
      }
      return tree;
    }

    test(`Diff of large trees`, async () => {
      const tree = makeLargeTree();
      applyChanges(tree, async (tree) => await tree.greedyClone());
    });

    test(`Diff of cloned trees`, () => {
      const tree = makeLargeTree();
      applyChanges(tree, tree => tree.clone());
    });

    test(`Diff can early exit`, async () => {
      const tree = await makeLargeTree(100);
      const tree2 = await tree.clone();
      await tree2.set(-1, -1);
      tree2.delete(10);
      tree2.set(20, -1);
      tree2.set(110, -1);
      const ReturnKey = (key: number) => { return { break: key }; };

      let val = tree.diffAgainst(tree2, OnlyThis, OnlyOther, ReturnKey);
      expect(onlyOther.size).toEqual(1);
      expect(onlyThis.size).toEqual(0);
      expect(val).toEqual(20);
      reset();

      val = tree.diffAgainst(tree2, OnlyThis, ReturnKey, Different);
      expect(different.size).toEqual(0);
      expect(onlyThis.size).toEqual(0);
      expect(val).toEqual(110);
      reset();

      val = tree.diffAgainst(tree2, ReturnKey, OnlyOther, Different);
      expect(different.size).toEqual(1);
      expect(onlyOther.size).toEqual(1);
      expect(val).toEqual(10);
      reset();

      expectDiffCorrect(tree, tree2);
    });
  });

  test("Issue #2 reproduction", async () => {
    const tree = new BTree<number>([], (a, b) => a - b, maxNodeSize);
    for (let i = 0; i <= 1999; i++) {
      tree.set(i, i);
      if (await tree.getSize() > 100 && i % 2 == 0) {
        const key = i / 2;
        tree.delete(key);
        tree.checkValid();
        expect(await tree.getSize()).toBe(i / 2 + 50);
      }
    }
  });


  test("nextLowerPair/nextHigherPair and issue #9: nextLowerPair returns highest pair if key is 0", () => {
    const tree = new BTree<number,number>(undefined, undefined, maxNodeSize);
    tree.set(-2, 123);
    tree.set(0, 1234);
    tree.set(2, 12345);
    
    expect(tree.nextLowerPair(-2)).toEqual(undefined);
    expect(tree.nextLowerPair(-1)).toEqual([-2, 123]);
    expect(tree.nextLowerPair(0)).toEqual([-2, 123]);
    expect(tree.nextLowerKey(0)).toBe(-2);
    expect(tree.nextHigherPair(-1)).toEqual([0, 1234]);
    expect(tree.nextHigherPair(0)).toEqual([2, 12345]);
    expect(tree.nextHigherKey(0)).toBe(2);
    expect(tree.nextHigherPair(1)).toEqual([2, 12345]);
    expect(tree.nextHigherPair(2)).toEqual(undefined);
    expect(tree.nextLowerPair(undefined)).toEqual([2, 12345]);
    expect(tree.nextHigherPair(undefined)).toEqual([-2, 123]);

    for (let i = -10; i <= 300; i++) // embiggen the tree
      tree.set(i, i*2);
    expect(tree.nextLowerPair(-1)).toEqual([-2, -4]);
    expect(tree.nextLowerPair(0)).toEqual([-1, -2]);
    expect(tree.nextHigherPair(-1)).toEqual([0, 0]);
    expect(tree.nextHigherPair(0)).toEqual([1, 2]);
    
    expect(tree.nextLowerPair(undefined)).toEqual([300, 600]);
    expect(tree.nextHigherPair(undefined)).toEqual([-10, -20]);
  });

  test('Regression test for invalid default comparator causing malformed trees', () => {
    const key = '24e26f0b-3c1a-47f8-a7a1-e8461ddb69ce6';
    const tree = new BTree<string,{}>(undefined, undefined, maxNodeSize);
    // The defaultComparator was not transitive for these inputs due to comparing numeric strings to each other numerically,
    // but lexically when compared to non-numeric strings. This resulted in keys not being orderable, and the tree behaving incorrectly.
    const inputs: [string,{}][] = [
      [key, {}],
      ['0', {}],
      ['1', {}],
      ['2', {}],
      ['3', {}],
      ['4', {}],
      ['Cheese', {}],
      ['10', {}],
      ['11', {}],
      ['12', {}],
      ['13', {}],
      ['15', {}],
      ['16', {}],
    ];

    for (const [id, node] of inputs) {
      expect( tree.set(id, node)).toBeTruthy();
      tree.checkValid();
      expect(tree.get(key)).not.toBeUndefined();
    }
    expect(tree.get(key)).not.toBeUndefined();
  });
*/


}





