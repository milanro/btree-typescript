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
        await tree.applyEntries();
        expect(await tree.getHeight()).toEqual(expectedHeight - 1);
      }
    }
  });
});

