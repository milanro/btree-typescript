import BTree, {IMap, EmptyBTree, defaultComparator, simpleComparator} from './b+tree';
import SortedArray from './sorted-array';
import MersenneTwister from 'mersenne-twister';

var test: (name:string,f:()=>void)=>void = it;

var rand: any = new MersenneTwister(1234);
function randInt(max: number) { return rand.random_int() % max; }
async function expectTreeEqualTo(a: BTree, b: SortedArray) {
  await a.checkValid();
  expect(await a.toArray()).toEqual(b.getArray());
}
async function addToBoth<K,V>(a: IMap<K,V>, b: IMap<K,V>, k: K, v: V) {
  expect(await a.set(k,v)).toEqual(await b.set(k,v));
}

describe('Simple tests on leaf nodes', () =>
{
  test('A few insertions (fanout 8)', insert8.bind(null, 8));
  test('A few insertions (fanout 4)', insert8.bind(null, 4));
  async function insert8(maxNodeSize: number) {
    var items: [number,any][] = [[6,"six"],[7,7],[5,5],[2,"two"],[4,4],[1,"one"],[3,3],[8,8]];
    var tree = new BTree<number>(items, undefined, maxNodeSize);
    await tree.applyEntries();
    var list = new SortedArray(items, undefined);
    await tree.checkValid();
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
    tree.applyEntries();
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
 
});
