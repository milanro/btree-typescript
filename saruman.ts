import BTree, {IMap, EmptyBTree, defaultComparator, simpleComparator} from './b+tree';
import SortedArray from './sorted-array';
import MersenneTwister from 'mersenne-twister';

var test: (name:string,f:()=>void)=>void = it;

var rand: any = new MersenneTwister(1234);
function randInt(max: number) { return rand.random_int() % max; }
function expectTreeEqualTo(a: BTree, b: SortedArray) {
  a.checkValid();
  expect(a.toArray()).toEqual(b.getArray());
}
function addToBoth<K,V>(a: IMap<K,V>, b: IMap<K,V>, k: K, v: V) {
  expect(a.set(k,v)).toEqual(b.set(k,v));
}

describe('defaultComparator', () =>
{
  const dateA = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateA2 = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateB = new Date(Date.UTC(96, 1, 2, 3, 4, 6));
  const values = [
    dateA,
    dateA2,
    dateB,
    dateA.valueOf(),
    '24x',
    '0',
    '1',
    '3',
    'String',
    '10',
    0,
    "NaN",
    NaN,
    Infinity,
    -0,
    -Infinity,
    1,
    10,
    2,
    [],
    '[]',
    [1],
    ['1']
  ];
  const sorted = [-Infinity, -10, -1, -0, 0, 1, 2, 10, Infinity];
  testComparison(defaultComparator, sorted, values, [[dateA, dateA2], [0, -0], [[1], ['1']]]);
});

describe('simpleComparator with non-NaN numbers and null', () =>
{
  const sorted = [-Infinity, -10, -1, -0, 0, null, 1, 2, 10, Infinity];
  testComparison<number | null>(simpleComparator, sorted, sorted, [[-0, 0], [-0, null], [0, null]]);
});

describe('simpleComparator with strings', () =>
{
  const values = [
    '24x',
    '+0',
    '0.0',
    '0',
    '-0',
    '1',
    '3',
    'String',
    '10',
    "NaN",
  ];;
  testComparison<string>(simpleComparator, [], values, []);
});

describe('simpleComparator with Date', () =>
{
  const dateA = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateA2 = new Date(Date.UTC(96, 1, 2, 3, 4, 5));
  const dateB = new Date(Date.UTC(96, 1, 2, 3, 4, 6));
  const values = [
    dateA,
    dateA2,
    dateB,
    null,
  ];
  testComparison<Date|null>(simpleComparator, [], values, [[dateA, dateA2]]);
});

describe('simpleComparator arrays', () =>
{
  const values = [
    [],
    [1],
    ['1'],
    [2],
  ];
  testComparison<(number|string)[] >(simpleComparator, [], values, [[[1], ['1']]]);
});

/**
 * Tests a comparison function, ensuring it produces a strict partial order over the provided values.
 * Additionally confirms that the comparison function has the correct definition of equality via expectedDuplicates.
 */
function testComparison<T>(comparison: (a: T, b: T) => number, inOrder: T[], values: T[], expectedDuplicates: [T, T][] = []) {
  function compare(a: T, b: T): number {
    const v = comparison(a, b);
    expect(typeof v).toEqual('number');
    if (v !== v)
      console.log('!!!', a, b);
    expect(v === v).toEqual(true); // Not NaN
    return Math.sign(v);
  }

  test('comparison has correct order', () => {
    expect([...inOrder].sort(comparison)).toMatchObject(inOrder);
  });

  test('comparison deffierantes values', () => {
    let duplicates: [T, T][] = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (compare(values[i], values[j]) === 0) {
          duplicates.push([values[i], values[j]]);
        }
      }
    }
    expect(duplicates).toMatchObject(expectedDuplicates);
  });

  test('comparison forms a strict partial ordering', () => {
    // To be a strict partial order, the function must be:
    // irreflexive: not a < a
    // transitive: if a < b and b < c then a < c
    // asymmetric: if a < b then not b < a

    // Since our comparison has three outputs, we adjust that to, we need to tighten the rules that involve 'not a < b' (where we have two possible outputs) as follows:
    // irreflexive: compare(a, a) === 0
    // transitive: if compare(a, b) < 0 and compare(b, c) < 0 then compare(a, c) < 0
    // asymmetric: sign(compare(a, b)) === -sign(compare(b, a))

    // This can is brute forced in O(n^3) time below:
    // Violations
    const irreflexive: T[] = []
    const transitive: T[][] = []
    const asymmetric: T[][] = []
    for (const a of values) {
      // irreflexive: compare(a, a) === 0
      if(compare(a, a) !== 0) irreflexive.push(a);
      for (const b of values) {
        for (const c of values) {
          // transitive: if compare(a, b) < 0 and compare(b, c) < 0 then compare(a, c) < 0
          if (compare(a, b) < 0 && compare(b, c) < 0) {
            if(compare(a, c) !== -1) transitive.push([a, b, c]);
          }
        }
        // sign(compare(a, b)) === -sign(compare(b, a))
        if(compare(a, b) !== -compare(b, a)) asymmetric.push([a, b]);
      }
    }
    expect(irreflexive).toEqual([]);
    expect(transitive).toEqual([]);
    expect(asymmetric).toEqual([]);
  });
}

describe('height calculation',  () =>
{
  test('Empty tree', async () => {
    const tree = new BTree<number>();
    expect(await tree.getHeight()).toEqual(0);
  });
  test('Single node', async () => {
    const tree = new BTree<number>([[0, 0]]);
    expect(await tree.getHeight()).toEqual(0);
  });
  test('Multiple node, no internal nodes', async () => {
    const tree = new BTree<number>([[0, 0], [1, 1]], undefined, 32);
    expect(await tree.getHeight()).toEqual(0);
  });
  test('Multiple internal nodes', async () => {
    for (let expectedHeight = 1; expectedHeight < 5; expectedHeight++) {
      for (let nodeSize = 4; nodeSize < 10; nodeSize++) {
        const numEntries = nodeSize ** expectedHeight;
        const entries: [number, number][] = [];
        for (let i = 0; i < numEntries; i++) {
          entries.push([i, i]);
        }
        const tree = new BTree<number>(entries, undefined, nodeSize);
        expect(await tree.getHeight()).toEqual(expectedHeight - 1);
      }
    }
  });
});

describe('Simple tests on leaf nodes', () =>
{
  test('A few insertions (fanout 8)', insert8.bind(null, 8));
  test('A few insertions (fanout 4)', insert8.bind(null, 4));
  async function insert8(maxNodeSize: number) {
    var items: [number,any][] = [[6,"six"],[7,7],[5,5],[2,"two"],[4,4],[1,"one"],[3,3],[8,8]];
    var tree = new BTree<number>(items, undefined, maxNodeSize);
    var list = new SortedArray(items, undefined);
    tree.checkValid();
    expect(await tree.keysArray()).toEqual([1,2,3,4,5,6,7,8]);
    expectTreeEqualTo(tree, list);
  }

  function forExpector(k:number, v:string, counter:number, i:number, first: number = 0) {
    expect(k).toEqual(v.length);
    expect(k - first).toEqual(counter);
    expect(k - first).toEqual(i);
  }
  {
    let tree = new BTree<number,string>([[0,""],[1,"1"],[2,"to"],[3,"tri"],[4,"four"],[5,"five!"]]);
    test('forEach', async() => {
      let i = 0;
      expect(await tree.forEach(function(this:any, v, k, tree_) {
        expect(tree_).toBe(tree);
        expect((this as any).self).toBe("me");
        forExpector(k, v, i, i++);
      }, {self:"me"})).toBe(6);
    });
    test('forEachPair', async () => {
      let i = 0;
      expect(await tree.forEachPair(function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(16);
    });
    test('forRange', async () => {
      let i = 0;
      expect(await tree.forRange(2, 4, false, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 2);
      }, 10)).toBe(12);
      i = 0;
      expect(await tree.forRange(2, 4, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 2);
      }, 10)).toBe(13);
      i = 0;
      expect(await tree.forRange(0, 4.5, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++);
      }, 10)).toBe(15);
    });
    test('editRange', async () => {
      let i = 0;
      expect(await tree.editRange(1, 4, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 1);
      }, 10)).toBe(14);
      i = 0;
      expect(await tree.editRange(1, 9, true, function(k,v,counter) {
        forExpector(k, v, counter - 10, i++, 1);
        if (k & 1)  return {delete:true};
        if (k == 2) return {value:"TWO!"};
        if (k >= 4) return {break:"STOP"};
      }, 10)).toBe("STOP");
      expect(await tree.toArray()).toEqual([[0,""],[2,"TWO!"],[4,"four"],[5,"five!"]])
    });
  }
  {
    let items: [string,any][] = [["A",1],["B",2],["C",3],["D",4],["E",5],["F",6],["G",7],["H",8]];
    let tree = new BTree<string>(items);
    tree.checkValid();
      
      test('has() in a leaf node of strings', async () => {
        expect(await tree.has("!")).toBe(false);
        expect(await tree.has("A")).toBe(true);
        expect(await tree.has("H")).toBe(true);
        expect(await tree.has("Z")).toBe(false);
      });
      test('get() in a leaf node of strings', async () => {
        expect(await tree.get("!", 7)).toBe(7);
        expect(await tree.get("A", 7)).toBe(1);
        expect(await tree.get("H", 7)).toBe(8);
        expect(await tree.get("Z", 7)).toBe(7);
      });
      test('getRange() in a leaf node', async() => {
        expect(await tree.getRange("#", "B", false)).toEqual([["A",1]]);
        expect(await tree.getRange("#", "B", true)).toEqual([["A",1],["B",2]]);
        expect(await tree.getRange("G", "S", true)).toEqual([["G",7],["H",8]]);
      });
      test('iterators work on leaf nodes', async () => {
        expect(Array.from(await tree.entries())).toEqual(items);
        expect(Array.from(await tree.keys())).toEqual(items.map(p => p[0]));
        expect(Array.from(await tree.values())).toEqual(items.map(p => p[1]));
      });
      test('try out the reverse iterator', async () => {
        expect(Array.from(await tree.entriesReversed())).toEqual(items.slice(0).reverse());
      });
      test('minKey() and maxKey()', async () => {
        expect(await tree.minKey()).toEqual("A");
        expect(await tree.maxKey()).toEqual("H");
      });
      test('delete() in a leaf node', async () => {
        expect(await tree.delete("C")).toBe(true);
        expect(await tree.delete("C")).toBe(false);
        expect(await tree.delete("H")).toBe(true);
        expect(await tree.delete("H")).toBe(false);
        expect(await tree.deleteRange(" ","A",false)).toBe(0);
        expect(await tree.deleteRange(" ","A",true)).toBe(1);
        expectTreeEqualTo(tree, new SortedArray([["B",2],["D",4],["E",5],["F",6],["G",7]]));
      });
      test('editRange() - again', async () => {
        expect(await tree.editRange((await tree.minKey())!, "F", true, (k,v,counter) => {
          if (k == "D")
            return {value: 44};
          if (k == "E" || k == "G")
            return {delete: true};
          if (k >= "F")
            return {stop: counter+1};
        })).toBe(4);
        expectTreeEqualTo(tree, new SortedArray([["B",2],["D",44],["F",6],["G",7]]));
      });
      test("A clone is independent", async () => {
        var tree2 = await tree.clone();
        expect(await tree.delete("G")).toBe(true);
        expect(await tree2.deleteRange("A", "F", false)).toBe(2);
        expect(await tree2.deleteRange("A", "F", true)).toBe(1);
        expectTreeEqualTo(tree, new SortedArray([["B",2],["D",44],["F",6]]));
        expectTreeEqualTo(tree2, new SortedArray([["G",7]]));
      });



  }

  test('Can be frozen and unfrozen', async () => {
    var tree = new BTree([[1,"one"]]);
    expect(tree.isFrozen).toBe(false);
    tree.freeze();
    expect(tree.isFrozen).toBe(true);
    expect(() => tree.set(2, "two")).toThrowError(/frozen/);
    expect(() => tree.setPairs([[2, "two"]])).toThrowError(/frozen/);
    expect(() => tree.clear()).toThrowError(/frozen/);
    expect(() => tree.delete(1)).toThrowError(/frozen/);
    expect(() => tree.editRange(0,10,true, ()=>{return {delete:true};})).toThrowError(/frozen/);
    expect(tree.toArray()).toEqual([[1, "one"]]);

    tree.unfreeze();
    tree.set(2, "two");
    tree.delete(1);
    expect(tree.toArray()).toEqual([[2, "two"]]);
    tree.clear();
    expect(tree.keysArray()).toEqual([]);
  });

});
