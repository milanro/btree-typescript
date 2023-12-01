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
    let items: [string,any][] = [["A",1],["B",2],["C",3],["D",4],["E",5],["F",6],["G",7],["H",8]];
    let tree = new BTree<string>(items);   
    
    test('validate', async () => {
      await tree.applyEntries(); 
      await tree.checkValid();
    });  

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


      test('try out the reverse iterator', async () => {
       // expect(Array.from(await tree.entriesReversed())).toEqual(items.slice(0).reverse());
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

  test('Custom comparator', async () => {
    var tree = new BTree(undefined, (a, b) => {
      if (a.name > b.name)
        return 1; // Return a number >0 when a > b
      else if (a.name < b.name)
        return -1; // Return a number <0 when a < b
      else // names are equal (or incomparable)
        return a.age - b.age; // Return >0 when a.age > b.age
    });
    await tree.applyEntries();
    await tree.set({name:"Bill", age:17}, "happy");
    await tree.set({name:"Rose", age:40}, "busy & stressed");
    await tree.set({name:"Bill", age:55}, "recently laid off");
    await tree.set({name:"Rose", age:10}, "rambunctious");
    await tree.set({name:"Chad", age:18}, "smooth");
    
    // Try editing a key
    await tree.set({name: "Bill", age: 17, planet: "Earth"}, "happy");
    
    var list: any[] = [];
    expect(await tree.forEachPair((k, v) => {
      list.push(Object.assign({value: v}, k));
    }, 10)).toBe(15);

    expect(list).toEqual([
      { name: "Bill", age: 17, planet: "Earth", value: "happy" },
      { name: "Bill", age: 55, value: "recently laid off" },
      { name: "Chad", age: 18, value: "smooth" },
      { name: "Rose", age: 10, value: "rambunctious" },
      { name: "Rose", age: 40, value: "busy & stressed" },
    ]);
  });
});


