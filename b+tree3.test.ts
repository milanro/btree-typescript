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
async function addToBoth<K, V>(a: BTree<K, V>, b: BTree<K, V>, k: K, v: V) {
  expect(await a.set(k, v)).toEqual(await b.set(k, v));
}

describe("Simple tests on leaf nodes", () => {
  test("A few insertions (fanout 8)", insert8.bind(null, 8));
  test("A few insertions (fanout 4)", insert8.bind(null, 4));
  async function insert8(maxNodeSize: number) {
    var items: [number, any][] = [
      [6, "six"],
      [7, 7],
      [5, 5],
      [2, "two"],
      [4, 4],
      [1, "one"],
      [3, 3],
      [8, 8],
    ];
    var tree = new BTree<number>(items, undefined, maxNodeSize);
    await tree.applyEntries();
    var list = new SortedArray(items, undefined);
    await tree.checkValid();
    expect(await tree.keysArray()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expectTreeEqualTo(tree, list);
  }

  function forExpector(
    k: number,
    v: string,
    counter: number,
    i: number,
    first: number = 0
  ) {
    expect(k).toEqual(v.length);
    expect(k - first).toEqual(counter);
    expect(k - first).toEqual(i);
  }

  {
    let items: [string, any][] = [
      ["A", 1],
      ["B", 2],
      ["C", 3],
      ["D", 4],
      ["E", 5],
      ["F", 6],
      ["G", 7],
      ["H", 8],
    ];
    let tree = new BTree<string>(items);

    test("validate", async () => {
      await tree.applyEntries();
      await tree.checkValid();
    });

    test("has() in a leaf node of strings", async () => {
      expect(await tree.has("!")).toBe(false);
      expect(await tree.has("A")).toBe(true);
      expect(await tree.has("H")).toBe(true);
      expect(await tree.has("Z")).toBe(false);
    });

    test("get() in a leaf node of strings", async () => {
      expect(await tree.get("!", 7)).toBe(7);
      expect(await tree.get("A", 7)).toBe(1);
      expect(await tree.get("H", 7)).toBe(8);
      expect(await tree.get("Z", 7)).toBe(7);
    });

    test("getRange() in a leaf node", async () => {
      expect(await tree.getRange("#", "B", false)).toEqual([["A", 1]]);
      expect(await tree.getRange("#", "B", true)).toEqual([
        ["A", 1],
        ["B", 2],
      ]);
      expect(await tree.getRange("G", "S", true)).toEqual([
        ["G", 7],
        ["H", 8],
      ]);
    });

    test("try out the reverse iterator", async () => {
      // expect(Array.from(await tree.entriesReversed())).toEqual(items.slice(0).reverse());
    });
    test("minKey() and maxKey()", async () => {
      expect(await tree.minKey()).toEqual("A");
      expect(await tree.maxKey()).toEqual("H");
    });

    test("delete() in a leaf node", async () => {
      expect(await tree.delete("C")).toBe(true);
      expect(await tree.delete("C")).toBe(false);
      expect(await tree.delete("H")).toBe(true);
      expect(await tree.delete("H")).toBe(false);
      expect(await tree.deleteRange(" ", "A", false)).toBe(0);
      expect(await tree.deleteRange(" ", "A", true)).toBe(1);
      expectTreeEqualTo(
        tree,
        new SortedArray([
          ["B", 2],
          ["D", 4],
          ["E", 5],
          ["F", 6],
          ["G", 7],
        ])
      );
    });
    test("editRange() - again", async () => {
      expect(
        await tree.editRange(
          (await tree.minKey())!,
          "F",
          true,
          (k, v, counter) => {
            if (k == "D") return { value: 44 };
            if (k == "E" || k == "G") return { delete: true };
            if (k >= "F") return { stop: counter + 1 };
          }
        )
      ).toBe(4);
      expectTreeEqualTo(
        tree,
        new SortedArray([
          ["B", 2],
          ["D", 44],
          ["F", 6],
          ["G", 7],
        ])
      );
    });

    test("A clone is independent", async () => {
      var tree2 = await tree.clone();
      expect(await tree.delete("G")).toBe(true);
      expect(await tree2.deleteRange("A", "F", false)).toBe(2);
      expect(await tree2.deleteRange("A", "F", true)).toBe(1);
      expectTreeEqualTo(
        tree,
        new SortedArray([
          ["B", 2],
          ["D", 44],
          ["F", 6],
        ])
      );
      expectTreeEqualTo(tree2, new SortedArray([["G", 7]]));
    });
  }

  test("Custom comparator", async () => {
    var tree = new BTree(undefined, (a, b) => {
      if (a.name > b.name) return 1; // Return a number >0 when a > b
      else if (a.name < b.name) return -1; // Return a number <0 when a < b
      // names are equal (or incomparable)
      else return a.age - b.age; // Return >0 when a.age > b.age
    });
    await tree.applyEntries();
    await tree.set({ name: "Bill", age: 17 }, "happy");
    await tree.set({ name: "Rose", age: 40 }, "busy & stressed");
    await tree.set({ name: "Bill", age: 55 }, "recently laid off");
    await tree.set({ name: "Rose", age: 10 }, "rambunctious");
    await tree.set({ name: "Chad", age: 18 }, "smooth");

    // Try editing a key
    await tree.set({ name: "Bill", age: 17, planet: "Earth" }, "happy");

    var list: any[] = [];
    expect(
      await tree.forEachPair((k, v) => {
        list.push(Object.assign({ value: v }, k));
      }, 10)
    ).toBe(15);

    expect(list).toEqual([
      { name: "Bill", age: 17, planet: "Earth", value: "happy" },
      { name: "Bill", age: 55, value: "recently laid off" },
      { name: "Chad", age: 18, value: "smooth" },
      { name: "Rose", age: 10, value: "rambunctious" },
      { name: "Rose", age: 40, value: "busy & stressed" },
    ]);
  });
});

// Tests relating to `isShared` and cloning.
// Tests on this subject that do not care about the specific interior structure of the tree
// (and are thus maxNodeSize agnostic) can be added to testBTree to be testing on different branching factors instead.
describe("cloning and sharing tests", () => {
  test("Regression test for failing to propagate shared when removing top two layers", async () => {
    // This tests make a full 3 layer tree (height = 2), so use a small branching factor.
    const maxNodeSize = 4;
    const tree = new BTree<number, number>(
      undefined,
      simpleComparator,
      maxNodeSize
    );
    await tree.applyEntries();
    // Build a 3 layer complete tree, all values 0.
    for (
      let index = 0;
      index < maxNodeSize * maxNodeSize * maxNodeSize;
      index++
    ) {
      await tree.set(index, 0);
    }
    // Leaf nodes don't count, so this is depth 2
    expect(await tree.getHeight()).toBe(2);

    // Edit the tree so it has a node in the second layer with exactly one child (key 0).
    await tree.deleteRange(1, maxNodeSize * maxNodeSize, false);
    expect(await tree.getHeight()).toBe(2);

    // Make a clone that should never be mutated.
    const clone = await tree.clone();

    // Mutate the original tree in such a way that clone gets mutated due to incorrect is shared tracking.
    // Delete everything outside of the internal node with only one child, so its child becomes the new root.
    await tree.deleteRange(maxNodeSize, Number.POSITIVE_INFINITY, false);
    expect(await tree.getHeight()).toBe(0);

    // Modify original
    await tree.set(0, 1);

    // Check that clone is not modified as well:
    expect(await clone.get(0)).toBe(0);
  });
});

// -------------



test("Regression test for greedyClone(true) not copying all nodes", async () => {
  const maxNodeSize = 4;
  const tree = new BTree<number, number>(
    undefined,
    simpleComparator,
    maxNodeSize
  );
  await tree.applyEntries();
  // Build a 3 layer tree.
  for (
    let index = 0;
    index < maxNodeSize * maxNodeSize + 1;
    index++
  ) {
    await tree.set(index, 0);
  }
  // Leaf nodes don't count, so this is depth 2
  expect(await tree.getHeight()).toBe(2);

  // To trigger the bug, mark children of the root node as shared (not just the root)
  await (await tree.clone()).set(1, 1);
  
  const clone = await tree.greedyClone(true);

  // The bug was that `force` was not passed down. This meant that non-shared nodes below the second layer would not be cloned.
  // Thus we check that the third layer of this tree did get cloned.
  // Since this depends on private APIs and types,
  // and this package currently has no way to expose them to tests without exporting them from the package,
  // do some private field access and any casts to make it work.

  const children1 = await((clone['_root'] as any).getChildren());
  const children2 = await((children1[0] as any).getChildren());
  const children3 = await (tree['_root'] as any).getChildren();
  const children4 = await (children3[0] as any).getChildren();
  expect (children2[0]).not.toBe(children4[0]);
});

test("Regression test for mergeSibling setting isShared", async () => {
  // This tests make a 3 layer tree (height = 2), so use a small branching factor.
  const maxNodeSize = 4;
  const tree = new BTree<number, number>(
    undefined,
    simpleComparator,
    maxNodeSize
  );
  await tree.applyEntries();
  // Build a 3 layer tree
  const count = maxNodeSize * maxNodeSize * maxNodeSize;
  for (
    let index = 0;
    index < count;
    index++
  ) {
    await tree.set(index, 0);
  }
  // Leaf nodes don't count, so this is depth 2
  expect(await tree.getHeight()).toBe(2);

  // Delete most of the keys so merging interior nodes is possible, marking all nodes as shared.
  for (
    let index = 0;
    index < count;
    index++
  ) {
    if (index % 4 !== 0) {
      await tree.delete(index);
    }
  }

  const deepClone = await tree.greedyClone(true);
  const cheapClone = await tree.clone();

  // These two clones should remain unchanged forever.
  // The bug this is testing for resulted in the cheap clone getting modified:
  // we will compare it against the deep clone to confirm it does not.

  // Delete a bunch more nodes, causing merging.
  for (
    let index = 0;
    index < count;
    index++
  ) {
    if (index % 16 !== 0) {
      await tree.delete(index);
    }
  }

  const different: number[] = [];
  const onDiff = (k: number) => { different.push(k); }
  await deepClone.diffAgainst(cheapClone, onDiff, onDiff, onDiff);
  expect(different).toEqual([]);
});




