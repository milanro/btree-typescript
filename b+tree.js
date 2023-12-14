"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyBTree = exports.BNodeInternal = exports.BNode = exports.simpleComparator = exports.defaultComparator = void 0;
// B+ tree by David Piepgrass. License: MIT
const globals_1 = require("./persistence/globals/globals");
const proxyUtil_1 = require("./persistence/util/proxyUtil");
/**
 * Compares DefaultComparables to form a strict partial ordering.
 *
 * Handles +/-0 and NaN like Map: NaN is equal to NaN, and -0 is equal to +0.
 *
 * Arrays are compared using '<' and '>', which may cause unexpected equality:
 * for example [1] will be considered equal to ['1'].
 *
 * Two objects with equal valueOf compare the same, but compare unequal to
 * primitives that have the same value.
 */
function defaultComparator(a, b) {
    // Special case finite numbers first for performance.
    // Note that the trick of using 'a - b' and checking for NaN to detect non-numbers
    // does not work if the strings are numeric (ex: "5"). This would leading most
    // comparison functions using that approach to fail to have transitivity.
    if (Number.isFinite(a) && Number.isFinite(b)) {
        return a - b;
    }
    // The default < and > operators are not totally ordered. To allow types to be mixed
    // in a single collection, compare types and order values of different types by type.
    let ta = typeof a;
    let tb = typeof b;
    if (ta !== tb) {
        return ta < tb ? -1 : 1;
    }
    if (ta === "object") {
        // standardized JavaScript bug: null is not an object, but typeof says it is
        if (a === null)
            return b === null ? 0 : -1;
        else if (b === null)
            return 1;
        a = a.valueOf();
        b = b.valueOf();
        ta = typeof a;
        tb = typeof b;
        // Deal with the two valueOf()s producing different types
        if (ta !== tb) {
            return ta < tb ? -1 : 1;
        }
    }
    // a and b are now the same type, and will be a number, string or array
    // (which we assume holds numbers or strings), or something unsupported.
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    if (a === b)
        return 0;
    // Order NaN less than other numbers
    if (Number.isNaN(a))
        return Number.isNaN(b) ? 0 : -1;
    else if (Number.isNaN(b))
        return 1;
    // This could be two objects (e.g. [7] and ['7']) that aren't ordered
    return Array.isArray(a) ? 0 : Number.NaN;
}
exports.defaultComparator = defaultComparator;
function simpleComparator(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
}
exports.simpleComparator = simpleComparator;
/**
 * A reasonably fast collection of key-value pairs with a powerful API.
 * Largely compatible with the standard Map. BTree is a B+ tree data structure,
 * so the collection is sorted by key.
 *
 * B+ trees tend to use memory more efficiently than hashtables such as the
 * standard Map, especially when the collection contains a large number of
 * items. However, maintaining the sort order makes them modestly slower:
 * O(log size) rather than O(1). This B+ tree implementation supports O(1)
 * fast cloning. It also supports freeze(), which can be used to ensure that
 * a BTree is not changed accidentally.
 *
 * Confusingly, the ES6 Map.forEach(c) method calls c(value,key) instead of
 * c(key,value), in contrast to other methods such as set() and entries()
 * which put the key first. I can only assume that the order was reversed on
 * the theory that users would usually want to examine values and ignore keys.
 * BTree's forEach() therefore works the same way, but a second method
 * `.forEachPair((key,value)=>{...})` is provided which sends you the key
 * first and the value second; this method is slightly faster because it is
 * the "native" for-each method for this class.
 *
 * Out of the box, BTree supports keys that are numbers, strings, arrays of
 * numbers/strings, Date, and objects that have a valueOf() method returning a
 * number or string. Other data types, such as arrays of Date or custom
 * objects, require a custom comparator, which you must pass as the second
 * argument to the constructor (the first argument is an optional list of
 * initial items). Symbols cannot be used as keys because they are unordered
 * (one Symbol is never "greater" or "less" than another).
 *
 * @example
 * Given a {name: string, age: number} object, you can create a tree sorted by
 * name and then by age like this:
 *
 *     var tree = new BTree(undefined, (a, b) => {
 *       if (a.name > b.name)
 *         return 1; // Return a number >0 when a > b
 *       else if (a.name < b.name)
 *         return -1; // Return a number <0 when a < b
 *       else // names are equal (or incomparable)
 *         return a.age - b.age; // Return >0 when a.age > b.age
 *     });
 *
 *     tree.set({name:"Bill", age:17}, "happy");
 *     tree.set({name:"Fran", age:40}, "busy & stressed");
 *     tree.set({name:"Bill", age:55}, "recently laid off");
 *     tree.forEachPair((k, v) => {
 *       console.log(`Name: ${k.name} Age: ${k.age} Status: ${v}`);
 *     });
 *
 * @description
 * The "range" methods (`forEach, forRange, editRange`) will return the number
 * of elements that were scanned. In addition, the callback can return {break:R}
 * to stop early and return R from the outer function.
 *
 * - TODO: Test performance of preallocating values array at max size
 * - TODO: Add fast initialization when a sorted array is provided to constructor
 *
 * For more documentation see https://github.com/qwertie/btree-typescript
 *
 * Are you a C# developer? You might like the similar data structures I made for C#:
 * BDictionary, BList, etc. See http://core.loyc.net/collections/
 *
 * @author David Piepgrass
 */
class BTree {
    /**
     * Initializes an empty B+ tree.
     * @param compare Custom function to compare pairs of elements in the tree.
     *   If not specified, defaultComparator will be used which is valid as long as K extends DefaultComparable.
     * @param entries A set of key-value pairs to initialize the tree
     * @param maxNodeSize Branching factor (maximum items or children per node)
     *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
     */
    constructor(entries, compare, maxNodeSize) {
        this._root = (0, proxyUtil_1.nodeToProxy)(EmptyLeaf);
        this._size = 0;
        this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 32;
        this._compare =
            compare || defaultComparator;
        this._entries = entries;
    }
    async applyEntries() {
        if (this._entries)
            await this.setPairs(this._entries);
        this._entries = undefined;
    }
    load(id) {
        this._root = (0, proxyUtil_1.setupPersistentNode)(id);
    }
    /////////////////////////////////////////////////////////////////////////////
    // ES6 Map<K,V> methods /////////////////////////////////////////////////////
    /** Gets the number of key-value pairs in the tree. */
    async getSize() {
        return this._size;
    }
    /** Gets the number of key-value pairs in the tree. */
    async getLength() {
        return this._size;
    }
    /** Returns true iff the tree contains no key-value pairs. */
    async isEmpty() {
        return this._size === 0;
    }
    async setSize(size) {
        this._size = size;
    }
    async incSize() {
        this._size++;
    }
    async decSize() {
        this._size--;
    }
    /** Releases the tree so that its size is 0. */
    async clear() {
        this._root = (0, proxyUtil_1.nodeToProxy)(EmptyLeaf);
        this._size = 0;
    }
    async commit() {
        const id = await this._root.saveTreeSync((0, globals_1.getPersistenceManager)());
        console.log("Commited to " + id);
        return id;
    }
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. For compatibility with ES6 Map, the argument order to
     *  the callback is backwards: value first, then key. Call forEachPair
     *  instead to receive the key as the first argument.
     * @param thisArg If provided, this parameter is assigned as the `this`
     *        value for each callback.
     * @returns the number of values that were sent to the callback,
     *        or the R value if the callback returned {break:R}. */
    async forEach(callback, thisArg) {
        if (thisArg !== undefined)
            callback = callback.bind(thisArg);
        return await this.forEachPair((k, v) => callback(v, k, this));
    }
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. The callback can return {break:R} (where R is any value
     *  except undefined) to stop immediately and return R from forEachPair.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     *        The reason that you must return {break:R} instead of simply R
     *        itself is for consistency with editRange(), which allows
     *        multiple actions, not just breaking.
     * @param initialCounter This is the value of the third argument of
     *        `onFound` the first time it is called. The counter increases
     *        by one each time `onFound` is called. Default value: 0
     * @returns the number of pairs sent to the callback (plus initialCounter,
     *        if you provided one). If the callback returned {break:R} then
     *        the R value is returned instead. */
    async forEachPair(callback, initialCounter) {
        var low = await this.minKey(), high = await this.maxKey();
        return await await this.forRange(low, high, true, callback, initialCounter);
    }
    /**
     * Finds a pair in the tree and returns the associated value.
     * @param defaultValue a value to return if the key was not found.
     * @returns the value, or defaultValue if the key was not found.
     * @description Computational complexity: O(log size)
     */
    async get(key, defaultValue) {
        return await this._root.get(key, defaultValue, this);
    }
    /**
     * Adds or overwrites a key-value pair in the B+ tree.
     * @param key the key is used to determine the sort order of
     *        data in the tree.
     * @param value data to associate with the key (optional)
     * @param overwrite Whether to overwrite an existing key-value pair
     *        (default: true). If this is false and there is an existing
     *        key-value pair then this method has no effect.
     * @returns true if a new key-value pair was added.
     * @description Computational complexity: O(log size)
     * Note: when overwriting a previous entry, the key is updated
     * as well as the value. This has no effect unless the new key
     * has data that does not affect its sort order.
     */
    async set(key, value, overwrite) {
        if (await this._root.isNodeShared())
            this._root = (0, proxyUtil_1.nodeToProxy)(await this._root.clone());
        var result = await this._root.set(key, value, overwrite, this);
        if (result === true || result === false)
            return result;
        // Root node has split, so create a new root node.
        this._root = (0, proxyUtil_1.nodeToProxy)(new BNodeInternal([this._root, result]));
        await this._root.applyMaxKeys();
        return true;
    }
    /**
     * Returns true if the key exists in the B+ tree, false if not.
     * Use get() for best performance; use has() if you need to
     * distinguish between "undefined value" and "key not present".
     * @param key Key to detect
     * @description Computational complexity: O(log size)
     */
    async has(key) {
        return await this.forRange(key, key, true, undefined) !== 0;
    }
    /**
     * Removes a single key-value pair from the B+ tree.
     * @param key Key to find
     * @returns true if a pair was found and removed, false otherwise.
     * @description Computational complexity: O(log size)
     */
    async delete(key) {
        return await this.editRange(key, key, true, DeleteRange) !== 0;
    }
    async with(key, value, overwrite) {
        let nu = await this.clone();
        return await nu.set(key, value, overwrite) || overwrite ? nu : this;
    }
    /** Returns a copy of the tree with the specified key-value pairs set. */
    async withPairs(pairs, overwrite) {
        let nu = await this.clone();
        return await nu.setPairs(pairs, overwrite) !== 0 || overwrite ? nu : this;
    }
    /** Returns a copy of the tree with the specified keys present.
     *  @param keys The keys to add. If a key is already present in the tree,
     *         neither the existing key nor the existing value is modified.
     *  @param returnThisIfUnchanged if true, returns this if all keys already
     *  existed. Performance note: due to the architecture of this class, all
     *  node(s) leading to existing keys are cloned even if the collection is
     *  ultimately unchanged.
     */
    async withKeys(keys, returnThisIfUnchanged) {
        let nu = await this.clone(), changed = false;
        for (var i = 0; i < keys.length; i++)
            changed = await nu.set(keys[i], undefined, false) || changed;
        return returnThisIfUnchanged && !changed ? this : nu;
    }
    /** Returns a copy of the tree with the specified key removed.
     * @param returnThisIfUnchanged if true, returns this if the key didn't exist.
     *  Performance note: due to the architecture of this class, node(s) leading
     *  to where the key would have been stored are cloned even when the key
     *  turns out not to exist and the collection is unchanged.
     */
    async without(key, returnThisIfUnchanged) {
        return await this.withoutRange(key, key, true, returnThisIfUnchanged);
    }
    /** Returns a copy of the tree with the specified keys removed.
     * @param returnThisIfUnchanged if true, returns this if none of the keys
     *  existed. Performance note: due to the architecture of this class,
     *  node(s) leading to where the key would have been stored are cloned
     *  even when the key turns out not to exist.
     */
    async withoutKeys(keys, returnThisIfUnchanged) {
        let nu = await this.clone();
        return await nu.deleteKeys(keys) || !returnThisIfUnchanged ? nu : this;
    }
    /** Returns a copy of the tree with the specified range of keys removed. */
    async withoutRange(low, high, includeHigh, returnThisIfUnchanged) {
        let nu = await this.clone();
        if (await nu.deleteRange(low, high, includeHigh) === 0 && returnThisIfUnchanged)
            return this;
        return nu;
    }
    /** Returns a copy of the tree with pairs removed whenever the callback
     *  function returns false. `where()` is a synonym for this method. */
    async filter(callback, returnThisIfUnchanged) {
        var nu = await this.greedyClone();
        var del;
        await (nu).editAll((k, v, i) => {
            if (!callback(k, v, i))
                return (del = Delete);
        });
        if (!del && returnThisIfUnchanged)
            return this;
        return nu;
    }
    /** Returns a copy of the tree with all values altered by a callback function. */
    async mapValues(callback) {
        var tmp = {};
        var nu = await this.greedyClone();
        await nu.editAll((k, v, i) => {
            return (tmp.value = callback(v, k, i)), tmp;
        });
        return nu;
    }
    /* Used by entries() and entriesReversed() to prepare to start iterating.
     * It develops a "node queue" for each non-leaf level of the tree.
     * Levels are numbered "bottom-up" so that level 0 is a list of leaf
     * nodes from a low-level non-leaf node. The queue at a given level L
     * consists of nodequeue[L] which is the children of a BNodeInternal,
     * and nodeindex[L], the current index within that child list, such
     * such that nodequeue[L-1] === nodequeue[L][nodeindex[L]].children.
     * (However inside this function the order is reversed.)
     */
    async findPath(key) {
        var nextnode = this._root;
        var nodequeue, nodeindex;
        if (await nextnode.isLeafNode()) {
            (nodequeue = EmptyArray), (nodeindex = EmptyArray); // avoid allocations
        }
        else {
            (nodequeue = []), (nodeindex = []);
            for (var d = 0; !await nextnode.isLeafNode(); d++) {
                nodequeue[d] = await nextnode.getChildren();
                nodeindex[d] =
                    key === undefined ? 0 : await nextnode.indexOf(key, 0, this._compare);
                if (nodeindex[d] >= nodequeue[d].length)
                    return; // first key > maxKey()
                nextnode = nodequeue[d][nodeindex[d]];
            }
            nodequeue.reverse();
            nodeindex.reverse();
        }
        return { nodequeue, nodeindex, leaf: nextnode };
    }
    /**
     * Computes the differences between `this` and `other`.
     * For efficiency, the diff is returned via invocations of supplied handlers.
     * The computation is optimized for the case in which the two trees have large amounts
     * of shared data (obtained by calling the `clone` or `with` APIs) and will avoid
     * any iteration of shared state.
     * The handlers can cause computation to early exit by returning {break: R}.
     * Neither of the collections should be changed during the comparison process (in your callbacks), as this method assumes they will not be mutated.
     * @param other The tree to compute a diff against.
     * @param onlyThis Callback invoked for all keys only present in `this`.
     * @param onlyOther Callback invoked for all keys only present in `other`.
     * @param different Callback invoked for all keys with differing values.
     */
    async diffAgainst(other, onlyThis, onlyOther, different) {
        if (other._compare !== this._compare) {
            throw new Error("Tree comparators are not the same.");
        }
        if (await this.isEmpty() || await other.isEmpty()) {
            if (await this.isEmpty() && await other.isEmpty())
                return undefined;
            // If one tree is empty, everything will be an onlyThis/onlyOther.
            if (await this.isEmpty())
                return onlyOther === undefined
                    ? undefined
                    : await BTree.stepToEnd(await BTree.makeDiffCursor(other), onlyOther);
            return onlyThis === undefined
                ? undefined
                : await BTree.stepToEnd(await BTree.makeDiffCursor(this), onlyThis);
        }
        // Cursor-based diff algorithm is as follows:
        // - Until neither cursor has navigated to the end of the tree, do the following:
        //  - If the `this` cursor is "behind" the `other` cursor (strictly <, via compare), advance it.
        //  - Otherwise, advance the `other` cursor.
        //  - Any time a cursor is stepped, perform the following:
        //    - If either cursor points to a key/value pair:
        //      - If thisCursor === otherCursor and the values differ, it is a Different.
        //      - If thisCursor > otherCursor and otherCursor is at a key/value pair, it is an OnlyOther.
        //      - If thisCursor < otherCursor and thisCursor is at a key/value pair, it is an OnlyThis as long as the most recent
        //        cursor step was *not* otherCursor advancing from a tie. The extra condition avoids erroneous OnlyOther calls
        //        that would occur due to otherCursor being the "leader".
        //    - Otherwise, if both cursors point to nodes, compare them. If they are equal by reference (shared), skip
        //      both cursors to the next node in the walk.
        // - Once one cursor has finished stepping, any remaining steps (if any) are taken and key/value pairs are logged
        //   as OnlyOther (if otherCursor is stepping) or OnlyThis (if thisCursor is stepping).
        // This algorithm gives the critical guarantee that all locations (both nodes and key/value pairs) in both trees that
        // are identical by value (and possibly by reference) will be visited *at the same time* by the cursors.
        // This removes the possibility of emitting incorrect diffs, as well as allowing for skipping shared nodes.
        const { _compare } = this;
        const thisCursor = await BTree.makeDiffCursor(this);
        const otherCursor = await BTree.makeDiffCursor(other);
        // It doesn't matter how thisSteppedLast is initialized.
        // Step order is only used when either cursor is at a leaf, and cursors always start at a node.
        let thisSuccess = true, otherSuccess = true, prevCursorOrder = BTree.compare(thisCursor, otherCursor, _compare);
        while (thisSuccess && otherSuccess) {
            const cursorOrder = BTree.compare(thisCursor, otherCursor, _compare);
            const { leaf: thisLeaf, internalSpine: thisInternalSpine, levelIndices: thisLevelIndices, } = thisCursor;
            const { leaf: otherLeaf, internalSpine: otherInternalSpine, levelIndices: otherLevelIndices, } = otherCursor;
            if (thisLeaf || otherLeaf) {
                // If the cursors were at the same location last step, then there is no work to be done.
                if (prevCursorOrder !== 0) {
                    if (cursorOrder === 0) {
                        if (thisLeaf && otherLeaf && different) {
                            // Equal keys, check for modifications
                            const valThis = (await thisLeaf.getValues())[thisLevelIndices[thisLevelIndices.length - 1]];
                            const valOther = (await otherLeaf.getValues())[otherLevelIndices[otherLevelIndices.length - 1]];
                            if (!Object.is(valThis, valOther)) {
                                const result = different(thisCursor.currentKey, valThis, valOther);
                                if (result && result.break)
                                    return result.break;
                            }
                        }
                    }
                    else if (cursorOrder > 0) {
                        // If this is the case, we know that either:
                        // 1. otherCursor stepped last from a starting position that trailed thisCursor, and is still behind, or
                        // 2. thisCursor stepped last and leapfrogged otherCursor
                        // Either of these cases is an "only other"
                        if (otherLeaf && onlyOther) {
                            const otherVal = (await otherLeaf.getValues())[otherLevelIndices[otherLevelIndices.length - 1]];
                            const result = onlyOther(otherCursor.currentKey, otherVal);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                    else if (onlyThis) {
                        if (thisLeaf && prevCursorOrder !== 0) {
                            const valThis = (await thisLeaf.getValues())[thisLevelIndices[thisLevelIndices.length - 1]];
                            const result = onlyThis(thisCursor.currentKey, valThis);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                }
            }
            else if (!thisLeaf && !otherLeaf && cursorOrder === 0) {
                const lastThis = thisInternalSpine.length - 1;
                const lastOther = otherInternalSpine.length - 1;
                const nodeThis = thisInternalSpine[lastThis][thisLevelIndices[lastThis]];
                const nodeOther = otherInternalSpine[lastOther][otherLevelIndices[lastOther]];
                if (nodeOther === nodeThis) {
                    prevCursorOrder = 0;
                    thisSuccess = await BTree.step(thisCursor, true);
                    otherSuccess = await BTree.step(otherCursor, true);
                    continue;
                }
            }
            prevCursorOrder = cursorOrder;
            if (cursorOrder < 0) {
                thisSuccess = await BTree.step(thisCursor);
            }
            else {
                otherSuccess = await BTree.step(otherCursor);
            }
        }
        if (thisSuccess && onlyThis)
            return await BTree.finishCursorWalk(thisCursor, otherCursor, _compare, onlyThis);
        if (otherSuccess && onlyOther)
            return await BTree.finishCursorWalk(otherCursor, thisCursor, _compare, onlyOther);
    }
    ///////////////////////////////////////////////////////////////////////////
    // Helper methods for diffAgainst /////////////////////////////////////////
    static async finishCursorWalk(cursor, cursorFinished, compareKeys, callback) {
        const compared = await BTree.compare(cursor, cursorFinished, compareKeys);
        if (compared === 0) {
            if (!await BTree.step(cursor))
                return undefined;
        }
        else if (compared < 0) {
            check(false, "cursor walk terminated early");
        }
        return await BTree.stepToEnd(cursor, callback);
    }
    static async stepToEnd(cursor, callback) {
        let canStep = true;
        while (canStep) {
            const { leaf, levelIndices, currentKey } = cursor;
            if (leaf) {
                const value = (await leaf.getValues())[levelIndices[levelIndices.length - 1]];
                const result = callback(currentKey, value);
                if (result && result.break)
                    return result.break;
            }
            canStep = await BTree.step(cursor);
        }
        return undefined;
    }
    static async makeDiffCursor(tree) {
        const { _root } = tree;
        const height = await tree.getHeight();
        return {
            height: height,
            internalSpine: [[_root]],
            levelIndices: [0],
            leaf: undefined,
            currentKey: await _root.maxKey(),
        };
    }
    /**
     * Advances the cursor to the next step in the walk of its tree.
     * Cursors are walked backwards in sort order, as this allows them to leverage maxKey() in order to be compared in O(1).
     * @param cursor The cursor to step
     * @param stepToNode If true, the cursor will be advanced to the next node (skipping values)
     * @returns true if the step was completed and false if the step would have caused the cursor to move beyond the end of the tree.
     */
    static async step(cursor, stepToNode) {
        const { internalSpine, levelIndices, leaf } = cursor;
        if (stepToNode === true || leaf) {
            const levelsLength = levelIndices.length;
            // Step to the next node only if:
            // - We are explicitly directed to via stepToNode, or
            // - There are no key/value pairs left to step to in this leaf
            if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
                const spineLength = internalSpine.length;
                // Root is leaf
                if (spineLength === 0)
                    return false;
                // Walk back up the tree until we find a new subtree to descend into
                const nodeLevelIndex = spineLength - 1;
                let levelIndexWalkBack = nodeLevelIndex;
                while (levelIndexWalkBack >= 0) {
                    if (levelIndices[levelIndexWalkBack] > 0) {
                        if (levelIndexWalkBack < levelsLength - 1) {
                            // Remove leaf state from cursor
                            cursor.leaf = undefined;
                            levelIndices.pop();
                        }
                        // If we walked upwards past any internal node, slice them out
                        if (levelIndexWalkBack < nodeLevelIndex)
                            cursor.internalSpine = internalSpine.slice(0, levelIndexWalkBack + 1);
                        // Move to new internal node
                        cursor.currentKey = await internalSpine[levelIndexWalkBack][--levelIndices[levelIndexWalkBack]].maxKey();
                        return true;
                    }
                    levelIndexWalkBack--;
                }
                // Cursor is in the far left leaf of the tree, no more nodes to enumerate
                return false;
            }
            else {
                // Move to new leaf value
                const valueIndex = --levelIndices[levelsLength - 1];
                cursor.currentKey = (await leaf.getKeys())[valueIndex];
                return true;
            }
        }
        else {
            // Cursor does not point to a value in a leaf, so move downwards
            const nextLevel = internalSpine.length;
            const currentLevel = nextLevel - 1;
            const node = internalSpine[currentLevel][levelIndices[currentLevel]];
            if (await node.isLeafNode()) {
                // Entering into a leaf. Set the cursor to point at the last key/value pair.
                cursor.leaf = node;
                const valueIndex = (levelIndices[nextLevel] =
                    (await node.getValues()).length - 1);
                cursor.currentKey = (await node.getKeys())[valueIndex];
            }
            else {
                const children = await node.getChildren();
                internalSpine[nextLevel] = children;
                const childIndex = children.length - 1;
                levelIndices[nextLevel] = childIndex;
                cursor.currentKey = await children[childIndex].maxKey();
            }
            return true;
        }
    }
    /**
     * Compares the two cursors. Returns a value indicating which cursor is ahead in a walk.
     * Note that cursors are advanced in reverse sorting order.
     */
    static compare(cursorA, cursorB, compareKeys) {
        const { height: heightA, currentKey: currentKeyA, levelIndices: levelIndicesA, } = cursorA;
        const { height: heightB, currentKey: currentKeyB, levelIndices: levelIndicesB, } = cursorB;
        // Reverse the comparison order, as cursors are advanced in reverse sorting order
        const keyComparison = compareKeys(currentKeyB, currentKeyA);
        if (keyComparison !== 0) {
            return keyComparison;
        }
        // Normalize depth values relative to the shortest tree.
        // This ensures that concurrent cursor walks of trees of differing heights can reliably land on shared nodes at the same time.
        // To accomplish this, a cursor that is on an internal node at depth D1 with maxKey X is considered "behind" a cursor on an
        // internal node at depth D2 with maxKey Y, when D1 < D2. Thus, always walking the cursor that is "behind" will allow the cursor
        // at shallower depth (but equal maxKey) to "catch up" and land on shared nodes.
        const heightMin = heightA < heightB ? heightA : heightB;
        const depthANormalized = levelIndicesA.length - (heightA - heightMin);
        const depthBNormalized = levelIndicesB.length - (heightB - heightMin);
        return depthANormalized - depthBNormalized;
    }
    // End of helper methods for diffAgainst //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    // Additional methods ///////////////////////////////////////////////////////
    /** Returns the maximum number of children/values before nodes will split. */
    async maxNodeSize() {
        return this._maxNodeSize;
    }
    /** Gets the lowest key in the tree. Complexity: O(log size) */
    async minKey() {
        return await this._root.minKey();
    }
    /** Gets the highest key in the tree. Complexity: O(1) */
    async maxKey() {
        return await this._root.maxKey();
    }
    /** Quickly clones the tree by marking the root node as shared.
     *  Both copies remain editable. When you modify either copy, any
     *  nodes that are shared (or potentially shared) between the two
     *  copies are cloned so that the changes do not affect other copies.
     *  This is known as copy-on-write behavior, or "lazy copying". */
    async clone() {
        await this._root.setShared(true);
        var result = new BTree(undefined, this._compare, this._maxNodeSize);
        await result.applyEntries();
        result._root = this._root;
        result._size = await this.getSize();
        return result;
    }
    /** Performs a greedy clone, immediately duplicating any nodes that are
     *  not currently marked as shared, in order to avoid marking any
     *  additional nodes as shared.
     *  @param force Clone all nodes, even shared ones.
     */
    async greedyClone(force) {
        var result = new BTree(undefined, this._compare, this._maxNodeSize);
        result.applyEntries();
        result._root = (0, proxyUtil_1.nodeToProxy)(await this._root.greedyClone(force));
        result._size = await this.getSize();
        return result;
    }
    /** Gets an array filled with the contents of the tree, sorted by key */
    async toArray(maxLength = 0x7fffffff) {
        let min = await this.minKey(), max = await this.maxKey();
        if (min !== undefined)
            return await this.getRange(min, max, true, maxLength);
        return [];
    }
    /** Gets an array of all keys, sorted */
    async keysArray() {
        var results = [];
        await this._root.forRange((await this.minKey()), (await this.maxKey()), true, false, this, 0, (k, v) => {
            results.push(k);
        });
        return results;
    }
    /** Gets an array of all values, sorted by key */
    async valuesArray() {
        var results = [];
        await this._root.forRange((await this.minKey()), (await this.maxKey()), true, false, this, 0, (k, v) => {
            results.push(v);
        });
        return results;
    }
    /** Gets a string representing the tree's data based on toArray(). */
    toString() {
        return this.toArray().toString();
    }
    /** Stores a key-value pair only if the key doesn't already exist in the tree.
     * @returns true if a new key was added
     */
    async setIfNotPresent(key, value) {
        return await this.set(key, value, false);
    }
    /** Returns the next pair whose key is larger than the specified key (or undefined if there is none).
     * If key === undefined, this function returns the lowest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     * avoid creating a new array on every iteration.
     */
    async nextHigherPair(key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return await this._root.minPair(reusedArray);
        }
        return await this._root.getPairOrNextHigher(key, this._compare, false, reusedArray);
    }
    /** Returns the next key larger than the specified key, or undefined if there is none.
     *  Also, nextHigherKey(undefined) returns the lowest key.
     */
    async nextHigherKey(key) {
        var p = await this.nextHigherPair(key, ReusedArray);
        return p && p[0];
    }
    /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none).
     *  If key === undefined, this function returns the highest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     */
    async nextLowerPair(key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return await this._root.maxPair(reusedArray);
        }
        return await this._root.getPairOrNextLower(key, this._compare, false, reusedArray);
    }
    /** Returns the next key smaller than the specified key, or undefined if there is none.
     *  Also, nextLowerKey(undefined) returns the highest key.
     */
    async nextLowerKey(key) {
        var p = await this.nextLowerPair(key, ReusedArray);
        return p && p[0];
    }
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    async getPairOrNextLower(key, reusedArray) {
        return await this._root.getPairOrNextLower(key, this._compare, true, reusedArray || []);
    }
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    async getPairOrNextHigher(key, reusedArray) {
        return await this._root.getPairOrNextHigher(key, this._compare, true, reusedArray || []);
    }
    /** Edits the value associated with a key in the tree, if it already exists.
     * @returns true if the key existed, false if not.
     */
    async changeIfPresent(key, value) {
        return await this.editRange(key, key, true, (k, v) => ({ value })) !== 0;
    }
    /**
     * Builds an array of pairs from the specified range of keys, sorted by key.
     * Each returned pair is also an array: pair[0] is the key, pair[1] is the value.
     * @param low The first key in the array will be greater than or equal to `low`.
     * @param high This method returns when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, its pair will be included
     *        in the output if and only if this parameter is true. Note: if the
     *        `low` key is present, it is always included in the output.
     * @param maxLength Length limit. getRange will stop scanning the tree when
     *                  the array reaches this size.
     * @description Computational complexity: O(result.length + log size)
     */
    async getRange(low, high, includeHigh, maxLength = 0x3ffffff) {
        var results = [];
        await this._root.forRange(low, high, includeHigh, false, this, 0, (k, v) => {
            results.push([k, v]);
            return results.length > maxLength ? Break : undefined;
        });
        return results;
    }
    /** Adds all pairs from a list of key-value pairs.
     * @param pairs Pairs to add to this tree. If there are duplicate keys,
     *        later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]]
     *        associates 0 with 7.)
     * @param overwrite Whether to overwrite pairs that already exist (if false,
     *        pairs[i] is ignored when the key pairs[i][0] already exists.)
     * @returns The number of pairs added to the collection.
     * @description Computational complexity: O(pairs.length * log(size + pairs.length))
     */
    async setPairs(pairs, overwrite) {
        var added = 0;
        for (var i = 0; i < pairs.length; i++)
            if (await this.set(pairs[i][0], pairs[i][1], overwrite))
                added++;
        return added;
    }
    /**
     * Scans the specified range of keys, in ascending order by key.
     * Note: the callback `onFound` must not insert or remove items in the
     * collection. Doing so may cause incorrect data to be sent to the
     * callback afterward.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     * @param initialCounter Initial third argument of onFound. This value
     *        increases by one each time `onFound` is called. Default: 0
     * @returns The number of values found, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description Computational complexity: O(number of items scanned + log size)
     */
    async forRange(low, high, includeHigh, onFound, initialCounter) {
        var r = await this._root.forRange(low, high, includeHigh, false, this, initialCounter || 0, onFound);
        return typeof r === "number" ? r : r.break;
    }
    /**
     * Scans and potentially modifies values for a subsequence of keys.
     * Note: the callback `onFound` should ideally be a pure function.
     *   Specfically, it must not insert items, call clone(), or change
     *   the collection except via return value; out-of-band editing may
     *   cause an exception or may cause incorrect data to be sent to
     *   the callback (duplicate or missed items). It must not cause a
     *   clone() of the collection, otherwise the clone could be modified
     *   by changes requested by the callback.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return `{value:v}` to change the value associated
     *        with the current key, `{delete:true}` to delete the current pair,
     *        `{break:R}` to stop early with result R, or it can return nothing
     *        (undefined or {}) to cause no effect and continue iterating.
     *        `{break:R}` can be combined with one of the other two commands.
     *        The third argument `counter` is the number of items iterated
     *        previously; it equals 0 when `onFound` is called the first time.
     * @returns The number of values scanned, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description
     *   Computational complexity: O(number of items scanned + log size)
     *   Note: if the tree has been cloned with clone(), any shared
     *   nodes are copied before `onFound` is called. This takes O(n) time
     *   where n is proportional to the amount of shared data scanned.
     */
    async editRange(low, high, includeHigh, onFound, initialCounter) {
        var root = this._root;
        if (await root.isNodeShared())
            this._root = root = (0, proxyUtil_1.nodeToProxy)(await root.clone());
        try {
            var r = await root.forRange(low, high, includeHigh, true, this, initialCounter || 0, onFound);
            return typeof r === "number" ? r : r.break;
        }
        finally {
            let isShared;
            while ((await root.getKeys()).length <= 1 && !await root.isLeafNode()) {
                isShared || (isShared = await root.isNodeShared());
                this._root = root =
                    (await root.getKeys()).length === 0
                        ? (0, proxyUtil_1.nodeToProxy)(EmptyLeaf)
                        : (0, proxyUtil_1.nodeToProxy)((await root.getChildren())[0]);
            }
            // If any ancestor of the new root was shared, the new root must also be shared
            if (isShared) {
                await root.setShared(true);
            }
        }
    }
    /** Same as `editRange` except that the callback is called for all pairs. */
    async editAll(onFound, initialCounter) {
        return await this.editRange((await this.minKey()), (await this.maxKey()), true, onFound, initialCounter);
    }
    /**
     * Removes a range of key-value pairs from the B+ tree.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh Specifies whether the `high` key, if present, is deleted.
     * @returns The number of key-value pairs that were deleted.
     * @description Computational complexity: O(log size + number of items deleted)
     */
    async deleteRange(low, high, includeHigh) {
        return await this.editRange(low, high, includeHigh, DeleteRange);
    }
    /** Deletes a series of keys from the collection. */
    async deleteKeys(keys) {
        for (var i = 0, r = 0; i < keys.length; i++)
            if (await this.delete(keys[i]))
                r++;
        return r;
    }
    /** Gets the height of the tree: the number of internal nodes between the
     *  BTree object and its leaf nodes (zero if there are no internal nodes). */
    async getHeight() {
        let node = this._root;
        let height = -1;
        while (node) {
            height++;
            if (await node.isLeafNode()) {
                node = undefined;
            }
            else {
                const childrenPromise = node.getChildren();
                const children = await childrenPromise;
                node = children[0];
            }
        }
        return height;
    }
    /** Makes the object read-only to ensure it is not accidentally modified.
     *  Freezing does not have to be permanent; unfreeze() reverses the effect.
     *  This is accomplished by replacing mutator functions with a function
     *  that throws an Error. Compared to using a property (e.g. this.isFrozen)
     *  this implementation gives better performance in non-frozen BTrees.
     */
    freeze() {
        var t = this;
        // Note: all other mutators ultimately call set() or editRange()
        //       so we don't need to override those others.
        t.clear =
            t.set =
                t.editRange =
                    function () {
                        throw new Error("Attempted to modify a frozen BTree");
                    };
    }
    /** Ensures mutations are allowed, reversing the effect of freeze(). */
    unfreeze() {
        // @ts-ignore "The operand of a 'delete' operator must be optional."
        //            (wrong: delete does not affect the prototype.)
        delete this.clear;
        // @ts-ignore
        delete this.set;
        // @ts-ignore
        delete this.editRange;
    }
    /** Returns true if the tree appears to be frozen. */
    async isFrozen() {
        return this.hasOwnProperty("editRange");
    }
    /** Scans the tree for signs of serious bugs (e.g. this.size doesn't match
     *  number of elements, internal nodes not caching max element properly...)
     *  Computational complexity: O(number of nodes), i.e. O(size). This method
     *  skips the most expensive test - whether all keys are sorted - but it
     *  does check that maxKey() of the children of internal nodes are sorted. */
    async checkValid() {
        var size = await this._root.checkValid(0, this, 0);
        check(size === await this.getSize(), "size mismatch: counted ", size, "but stored", await this.getSize());
    }
}
exports.default = BTree;
BTree.prototype.where = BTree.prototype.filter;
BTree.prototype.setRange = BTree.prototype.setPairs;
BTree.prototype.add = BTree.prototype.set; // for compatibility with ISetSink<K>
function iterator(next = () => Promise.resolve(({ done: true, value: undefined }))) {
    var result = { next };
    if (Symbol && Symbol.iterator)
        result[Symbol.iterator] = function () {
            return this;
        };
    return result;
}
// Nodes Miso
/** Leaf node / base class. **************************************************/
class BNode {
    constructor(keys = [], values) {
        this._keys = keys;
        this._values = values || undefVals;
        this._isShared = undefined;
    }
    async getKeys() {
        return this._keys;
    }
    async getValues() {
        return this._values;
    }
    async setValues(v) {
        this._values = v;
    }
    async isNodeShared() {
        return this._isShared === true;
    }
    async setShared(value) {
        if (value === true)
            this._isShared = true;
        else
            this._isShared = undefined;
    }
    async isLeafNode() {
        return this._children === undefined;
    }
    ///////////////////////////////////////////////////////////////////////////
    // Shared methods /////////////////////////////////////////////////////////
    async maxKey() {
        const keys = await this.getKeys();
        return keys[keys.length - 1];
    }
    // If key not found, returns i^failXor where i is the insertion index.
    // Callers that don't care whether there was a match will set failXor=0.
    async indexOf(key, failXor, cmp) {
        const keys = await this.getKeys();
        var lo = 0, hi = keys.length, mid = hi >> 1;
        while (lo < hi) {
            var c = cmp(keys[mid], key);
            if (c < 0)
                lo = mid + 1;
            else if (c > 0)
                // key < keys[mid]
                hi = mid;
            else if (c === 0)
                return mid;
            else {
                // c is NaN or otherwise invalid
                if (key === key)
                    // at least the search key is not NaN
                    return keys.length;
                else
                    throw new Error("BTree: NaN was used as a key");
            }
            mid = (lo + hi) >> 1;
        }
        return mid ^ failXor;
        // Unrolled version: benchmarks show same speed, not worth using
        /*var i = 1, c: number = 0, sum = 0;
        if (keys.length >= 4) {
          i = 3;
          if (keys.length >= 8) {
            i = 7;
            if (keys.length >= 16) {
              i = 15;
              if (keys.length >= 32) {
                i = 31;
                if (keys.length >= 64) {
                  i = 127;
                  i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 64 : -64;
                  sum += c;
                  i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 32 : -32;
                  sum += c;
                }
                i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 16 : -16;
                sum += c;
              }
              i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 8 : -8;
              sum += c;
            }
            i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 4 : -4;
            sum += c;
          }
          i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 2 : -2;
          sum += c;
        }
        i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 1 : -1;
        c = i < keys.length ? cmp(keys[i], key) : 1;
        sum += c;
        if (c < 0) {
          ++i;
          c = i < keys.length ? cmp(keys[i], key) : 1;
          sum += c;
        }
        if (sum !== sum) {
          if (key === key) // at least the search key is not NaN
            return keys.length ^ failXor;
          else
            throw new Error("BTree: NaN was used as a key");
        }
        return c === 0 ? i : i ^ failXor;*/
    }
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: misc //////////////////////////////////////////////////////////
    async minKey() {
        const keys = await this.getKeys();
        return keys[0];
    }
    async minPair(reusedArray) {
        const keys = await this.getKeys();
        const values = await this.getValues();
        if (keys.length === 0)
            return undefined;
        reusedArray[0] = keys[0];
        reusedArray[1] = values[0];
        return reusedArray;
    }
    async maxPair(reusedArray) {
        const keys = await this.getKeys();
        const values = await this.getValues();
        if (keys.length === 0)
            return undefined;
        const lastIndex = keys.length - 1;
        reusedArray[0] = keys[lastIndex];
        reusedArray[1] = values[lastIndex];
        return reusedArray;
    }
    async clone() {
        var v = await this.getValues();
        const cloned = (0, proxyUtil_1.nodeToProxy)(new BNode((await this.getKeys()).slice(0), v === undefVals ? v : v.slice(0)));
        return cloned;
    }
    async greedyClone(force) {
        return (await this.isNodeShared()) && !force ? this : await this.clone();
    }
    async get(key, defaultValue, tree) {
        var i = await this.indexOf(key, -1, tree._compare);
        return i < 0 ? defaultValue : (await this.getValues())[i];
    }
    async getPairOrNextLower(key, compare, inclusive, reusedArray) {
        var i = await this.indexOf(key, -1, compare);
        const indexOrLower = i < 0 ? ~i - 1 : inclusive ? i : i - 1;
        if (indexOrLower >= 0) {
            reusedArray[0] = (await this.getKeys())[indexOrLower];
            reusedArray[1] = (await this.getValues())[indexOrLower];
            return reusedArray;
        }
        return undefined;
    }
    async getPairOrNextHigher(key, compare, inclusive, reusedArray) {
        var i = await this.indexOf(key, -1, compare);
        const indexOrLower = i < 0 ? ~i : inclusive ? i : i + 1;
        const keys = await this.getKeys();
        if (indexOrLower < keys.length) {
            reusedArray[0] = keys[indexOrLower];
            reusedArray[1] = (await this.getValues())[indexOrLower];
            return reusedArray;
        }
        return undefined;
    }
    async checkValid(depth, tree, baseIndex) {
        var kL = (await this.getKeys()).length, vL = (await this.getValues()).length;
        check((await this.getValues()) === undefVals ? kL <= vL : kL === vL, "keys/values length mismatch: depth", depth, "with lengths", kL, vL, "and baseIndex", baseIndex);
        // Note: we don't check for "node too small" because sometimes a node
        // can legitimately have size 1. This occurs if there is a batch
        // deletion, leaving a node of size 1, and the siblings are full so
        // it can't be merged with adjacent nodes. However, the parent will
        // verify that the average node size is at least half of the maximum.
        check(depth == 0 || kL > 0, "empty leaf at depth", depth, "and baseIndex", baseIndex);
        return kL;
    }
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: set & node splitting //////////////////////////////////////////
    async set(key, value, overwrite, tree) {
        var i = await this.indexOf(key, -1, tree._compare);
        if (i < 0) {
            // key does not exist yet
            i = ~i;
            await tree.incSize();
            const mykeys = await this.getKeys();
            const keysLength = mykeys.length;
            if (keysLength < tree._maxNodeSize) {
                return await this.insertInLeaf(i, key, value, tree);
            }
            else {
                // This leaf node is full and must split
                var newRightSibling = await this.splitOffRightSide(), target = this;
                if (i > (await this.getKeys()).length) {
                    i -= (await this.getKeys()).length;
                    target = newRightSibling;
                }
                await target.insertInLeaf(i, key, value, tree);
                return newRightSibling;
            }
        }
        else {
            // Key already exists
            if (overwrite !== false) {
                if (value !== undefined)
                    await this.reifyValues();
                // usually this is a no-op, but some users may wish to edit the key
                (await this.getKeys())[i] = key;
                (await this.getValues())[i] = value;
            }
            return false;
        }
    }
    async reifyValues() {
        if ((await this.getValues()) === undefVals)
            await this.setValues((await this.getValues()).slice(0, (await this.getKeys()).length));
        return await this.getValues();
    }
    async insertInLeaf(i, key, value, tree) {
        (await this.getKeys()).splice(i, 0, key);
        if ((await this.getValues()) === undefVals) {
            while (undefVals.length < tree._maxNodeSize)
                undefVals.push(undefined);
            if (value === undefined) {
                return true;
            }
            else {
                await this.setValues(undefVals.slice(0, (await this.getKeys()).length - 1));
            }
        }
        (await this.getValues()).splice(i, 0, value);
        return true;
    }
    async takeFromRight(rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.getKeys().length > (maxNodeSize/2 && this.getKeys().length<maxNodeSize)
        var v = await this.getValues();
        if ((await rhs.getValues()) === undefVals) {
            if (v !== undefVals)
                v.push(undefined);
        }
        else {
            v = await this.reifyValues();
            v.push((await rhs.getValues()).shift());
        }
        (await this.getKeys()).push((await rhs.getKeys()).shift());
    }
    async takeFromLeft(lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.getKeys().length > (maxNodeSize/2 && this.getKeys().length<maxNodeSize)
        var v = await this.getValues();
        if ((await lhs.getValues()) === undefVals) {
            if (v !== undefVals)
                v.unshift(undefined);
        }
        else {
            v = await this.reifyValues();
            v.unshift((await lhs.getValues()).pop());
        }
        (await this.getKeys()).unshift((await lhs.getKeys()).pop());
    }
    async splitOffRightSide() {
        // Reminder: parent node must update its copy of key for this node
        var half = (await this.getKeys()).length >> 1, keys = (await this.getKeys()).splice(half);
        var values = (await this.getValues()) === undefVals
            ? undefVals
            : (await this.getValues()).splice(half);
        return new BNode(keys, values);
    }
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: scanning & deletions //////////////////////////////////////////
    async forRange(low, high, includeHigh, editMode, tree, count, onFound) {
        var cmp = tree._compare;
        var iLow, iHigh;
        if (high === low) {
            if (!includeHigh)
                return count;
            iHigh = (iLow = await this.indexOf(low, -1, cmp)) + 1;
            if (iLow < 0)
                return count;
        }
        else {
            iLow = await this.indexOf(low, 0, cmp);
            iHigh = await this.indexOf(high, -1, cmp);
            if (iHigh < 0)
                iHigh = ~iHigh;
            else if (includeHigh === true)
                iHigh++;
        }
        var keys = await this.getKeys(), values = await this.getValues();
        if (onFound !== undefined) {
            for (var i = iLow; i < iHigh; i++) {
                var key = keys[i];
                var result = onFound(key, values[i], count++);
                if (result !== undefined) {
                    if (editMode === true) {
                        if (key !== keys[i] || (await this.isNodeShared()) === true)
                            throw new Error("BTree illegally changed or cloned in editRange");
                        if (result.delete) {
                            (await this.getKeys()).splice(i, 1);
                            if ((await this.getValues()) !== undefVals)
                                (await this.getValues()).splice(i, 1);
                            await tree.decSize();
                            i--;
                            iHigh--;
                        }
                        else if (result.hasOwnProperty("value")) {
                            values[i] = result.value;
                        }
                    }
                    if (result.break !== undefined)
                        return result;
                }
            }
        }
        else
            count += iHigh - iLow;
        return count;
    }
    /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
    async mergeSibling(rhs, _) {
        (await this.getKeys()).push.apply(await this.getKeys(), await rhs.getKeys());
        if ((await this.getValues()) === undefVals) {
            if ((await rhs.getValues()) === undefVals)
                return;
            await this.setValues((await this.getValues()).slice(0, (await this.getKeys()).length));
        }
        (await this.getValues()).push.apply(await this.getValues(), await rhs.reifyValues());
    }
}
exports.BNode = BNode;
/** Internal node (non-leaf node) ********************************************/
class BNodeInternal extends BNode {
    /**
     * This does not mark `children` as shared, so it is the responsibility of the caller
     * to ensure children are either marked shared, or aren't included in another tree.
     */
    constructor(children, keys) {
        children = children.map((child) => (0, proxyUtil_1.nodeToProxy)(child));
        if (!keys) {
            keys = [];
        }
        super(keys);
        this._children = (0, proxyUtil_1.proxifyNodeArray)(children);
    }
    async getChildren() {
        return this._children;
    }
    async applyMaxKeys() {
        const children = await this.getChildren();
        const keys = await this.getKeys();
        if (keys.length !== children.length) {
            this._keys = [];
            for (var i = 0; i < children.length; i++)
                this._keys[i] = await children[i].maxKey();
        }
    }
    async clone() {
        var children = (await this.getChildren()).slice(0);
        for (var i = 0; i < children.length; i++)
            await children[i].setShared(true);
        const clonedNode = new BNodeInternal(children, (await this.getKeys()).slice(0));
        await clonedNode.applyMaxKeys();
        return (0, proxyUtil_1.nodeToProxy)(clonedNode);
    }
    async greedyClone(force) {
        if ((await this.isNodeShared()) && !force)
            return this;
        var nu = new BNodeInternal((await this.getChildren()).slice(0), (await this.getKeys()).slice(0));
        await nu.applyMaxKeys();
        for (var i = 0; i < (await nu.getChildren()).length; i++) {
            const children = await nu.getChildren();
            children[i] = await children[i].greedyClone(force);
        }
        return nu;
    }
    async minKey() {
        return (await this.getChildren())[0].minKey();
    }
    async minPair(reusedArray) {
        return (await this.getChildren())[0].minPair(reusedArray);
    }
    async maxPair(reusedArray) {
        return await (await this.getChildren())[(await this.getChildren()).length - 1].maxPair(reusedArray);
    }
    async get(key, defaultValue, tree) {
        var i = await this.indexOf(key, 0, tree._compare), children = await this.getChildren();
        return i < children.length
            ? await children[i].get(key, defaultValue, tree)
            : undefined;
    }
    async getPairOrNextLower(key, compare, inclusive, reusedArray) {
        var i = await this.indexOf(key, 0, compare), children = await this.getChildren();
        if (i >= children.length)
            return this.maxPair(reusedArray);
        const result = await children[i].getPairOrNextLower(key, compare, inclusive, reusedArray);
        if (result === undefined && i > 0) {
            return children[i - 1].maxPair(reusedArray);
        }
        return result;
    }
    async getPairOrNextHigher(key, compare, inclusive, reusedArray) {
        var i = await this.indexOf(key, 0, compare), children = await this.getChildren(), length = children.length;
        if (i >= length)
            return undefined;
        const result = await children[i].getPairOrNextHigher(key, compare, inclusive, reusedArray);
        if (result === undefined && i < length - 1) {
            return await children[i + 1].minPair(reusedArray);
        }
        return result;
    }
    async checkValid(depth, tree, baseIndex) {
        let kL = (await this.getKeys()).length, cL = (await this.getChildren()).length;
        check(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL, "baseIndex", baseIndex);
        check(kL > 1 || depth > 0, "internal node has length", kL, "at depth", depth, "baseIndex", baseIndex);
        let size = 0, c = await this.getChildren(), k = await this.getKeys(), childSize = 0;
        for (var i = 0; i < cL; i++) {
            size += await c[i].checkValid(depth + 1, tree, baseIndex + size);
            childSize += (await c[i].getKeys()).length;
            check(size >= childSize, "wtf", baseIndex); // no way this will ever fail
            const cp = c.map((child, index) => child.getNode());
            check(i === 0 || cp[i - 1].constructor === cp[i].constructor, "type mismatch, baseIndex:", baseIndex);
            if (await c[i].maxKey() != k[i])
                check(false, "keys[", i, "] =", k[i], "is wrong, should be ", c[i].maxKey(), "at depth", depth, "baseIndex", baseIndex);
            if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0))
                check(false, "sort violation at depth", depth, "index", i, "keys", k[i - 1], k[i]);
        }
        // 2020/08: BTree doesn't always avoid grossly undersized nodes,
        // but AFAIK such nodes are pretty harmless, so accept them.
        let toofew = childSize === 0; // childSize < (tree.maxNodeSize >> 1)*cL;
        if (toofew || childSize > await tree.maxNodeSize() * cL)
            check(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, "maxNodeSize:", tree.maxNodeSize, "children.length:", cL, "baseIndex:", baseIndex);
        return size;
    }
    /////////////////////////////////////////////////////////////////////////////
    // Internal Node: set & node splitting //////////////////////////////////////
    async set(key, value, overwrite, tree) {
        var c = await this.getChildren(), max = tree._maxNodeSize, cmp = tree._compare;
        var i = Math.min(await this.indexOf(key, 0, cmp), c.length - 1), child = c[i];
        if (await child.isNodeShared())
            c[i] = child = await child.clone();
        if ((await child.getKeys()).length >= max) {
            // child is full; inserting anything else will cause a split.
            // Shifting an item to the left or right sibling may avoid a split.
            // We can do a shift if the adjacent node is not full and if the
            // current key can still be placed in the same node after the shift.
            var other;
            if (i > 0 &&
                (await (other = c[i - 1]).getKeys()).length < max &&
                cmp((await child.getKeys())[0], key) < 0) {
                if (await other.isNodeShared())
                    c[i - 1] = other = await other.clone();
                await other.takeFromRight(child);
                const keys = await this.getKeys();
                keys[i - 1] = await other.maxKey();
            }
            else if ((other = c[i + 1]) !== undefined &&
                (await other.getKeys()).length < max &&
                cmp(await child.maxKey(), key) < 0) {
                if (await other.isNodeShared())
                    c[i + 1] = other = await other.clone();
                other.takeFromLeft(child);
                const keys = await this.getKeys();
                keys[i] = await c[i].maxKey();
            }
        }
        var result = await child.set(key, value, overwrite, tree);
        if ((await result) === false)
            return false;
        const keys = await this.getKeys();
        keys[i] = await child.maxKey();
        if ((await result) === true)
            return true;
        // The child has split and `result` is a new right child... does it fit?
        if ((await this.getKeys()).length < max) {
            // yes
            await this.insert(i + 1, result);
            return true;
        }
        else {
            // no, we must split also
            var newRightSibling = await this.splitOffRightSide(), target = this;
            if (cmp(await result.maxKey(), (await this.maxKey())) > 0) {
                // if ((await (result as BNode<K, V>).maxKey()) > (await this.maxKey())) {
                target = newRightSibling;
                i -= (await this.getKeys()).length;
            }
            await target.insert(i + 1, result);
            return newRightSibling;
        }
    }
    /**
     * Inserts `child` at index `i`.
     * This does not mark `child` as shared, so it is the responsibility of the caller
     * to ensure that either child is marked shared, or it is not included in another tree.
     */
    async insert(i, child) {
        (await this.getChildren()).splice(i, 0, child);
        (await this.getKeys()).splice(i, 0, await child.maxKey());
    }
    /**
     * Split this node.
     * Modifies this to remove the second half of the items, returning a separate node containing them.
     */
    async splitOffRightSide() {
        // assert !this.isShared;
        var half = (await this.getChildren()).length >> 1;
        const node = new BNodeInternal((await this.getChildren()).splice(half), (await this.getKeys()).splice(half));
        await node.applyMaxKeys();
        return node;
    }
    async takeFromRight(rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.getKeys().length > (maxNodeSize/2 && this.getKeys().length<maxNodeSize)
        (await this.getKeys()).push((await rhs.getKeys()).shift());
        (await this.getChildren()).push((await rhs.getChildren()).shift());
    }
    async takeFromLeft(lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.getKeys().length > (maxNodeSize/2 && this.getKeys().length<maxNodeSize)
        (await this.getKeys()).unshift((await lhs.getKeys()).pop());
        (await this.getChildren()).unshift((await lhs.getChildren()).pop());
    }
    /////////////////////////////////////////////////////////////////////////////
    // Internal Node: scanning & deletions //////////////////////////////////////
    // Note: `count` is the next value of the third argument to `onFound`.
    //       A leaf node's `forRange` function returns a new value for this counter,
    //       unless the operation is to stop early.
    async forRange(low, high, includeHigh, editMode, tree, count, onFound) {
        var cmp = tree._compare;
        var keys = await this.getKeys(), children = await this.getChildren();
        var iLow = await this.indexOf(low, 0, cmp), i = iLow;
        var iHigh = Math.min(await (high === low ? iLow : this.indexOf(high, 0, cmp)), (await keys).length - 1);
        if (!editMode) {
            // Simple case
            for (; i <= iHigh; i++) {
                var result = await children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                if (typeof result !== "number")
                    return result;
                count = result;
            }
        }
        else if (i <= iHigh) {
            try {
                for (; i <= iHigh; i++) {
                    if (await children[i].isNodeShared())
                        children[i] = await children[i].clone();
                    var result = await children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                    // Note: if children[i] is empty then keys[i]=undefined.
                    //       This is an invalid state, but it is fixed below.
                    keys[i] = await children[i].maxKey();
                    if (typeof result !== "number")
                        return result;
                    count = result;
                }
            }
            finally {
                // Deletions may have occurred, so look for opportunities to merge nodes.
                var half = tree._maxNodeSize >> 1;
                if (iLow > 0)
                    iLow--;
                for (i = iHigh; i >= iLow; i--) {
                    if ((await children[i].getKeys()).length <= half) {
                        if ((await children[i].getKeys()).length !== 0) {
                            await this.tryMerge(i, tree._maxNodeSize);
                        }
                        else {
                            // child is empty! delete it!
                            keys.splice(i, 1);
                            children.splice(i, 1);
                        }
                    }
                }
                if (children.length !== 0 && (await children[0].getKeys()).length === 0)
                    check(false, "emptiness bug");
            }
        }
        return count;
    }
    /** Merges child i with child i+1 if their combined size is not too large */
    async tryMerge(i, maxSize) {
        var children = await this.getChildren();
        if (i >= 0 && i + 1 < children.length) {
            if ((await children[i].getKeys()).length +
                (await children[i + 1].getKeys()).length <=
                maxSize) {
                if (await children[i].isNodeShared())
                    // cloned already UNLESS i is outside scan range
                    children[i] = await children[i].clone();
                await children[i].mergeSibling(children[i + 1], maxSize);
                children.splice(i + 1, 1);
                (await this.getKeys()).splice(i + 1, 1);
                (await this.getKeys())[i] = await children[i].maxKey();
                return true;
            }
        }
        return false;
    }
    /**
     * Move children from `rhs` into this.
     * `rhs` must be part of this tree, and be removed from it after this call
     * (otherwise isShared for its children could be incorrect).
     */
    async mergeSibling(rhs, maxNodeSize) {
        // assert !this.isShared;
        var oldLength = (await this.getKeys()).length;
        (await this.getKeys()).push.apply(await this.getKeys(), await rhs.getKeys());
        const rhsChildren = await rhs.getChildren();
        (await this.getChildren()).push.apply(await this.getChildren(), rhsChildren);
        if ((await rhs.isNodeShared()) && !(await this.isNodeShared())) {
            // All children of a shared node are implicitly shared, and since their new
            // parent is not shared, they must now be explicitly marked as shared.
            for (var i = 0; i < rhsChildren.length; i++)
                await rhsChildren[i].setShared(true);
        }
        // If our children are themselves almost empty due to a mass-delete,
        // they may need to be merged too (but only the oldLength-1 and its
        // right sibling should need this).
        await this.tryMerge(oldLength - 1, maxNodeSize);
    }
}
exports.BNodeInternal = BNodeInternal;
// Optimization: this array of `undefined`s is used instead of a normal
// array of values in nodes where `undefined` is the only value.
// Its length is extended to max node size on first use; since it can
// be shared between trees with different maximums, its length can only
// increase, never decrease. Its type should be undefined[] but strangely
// TypeScript won't allow the comparison V[] === undefined[]. To prevent
// users from making this array too large, BTree has a maximum node size.
//
// FAQ: undefVals[i] is already undefined, so why increase the array size?
// Reading outside the bounds of an array is relatively slow because it
// has the side effect of scanning the prototype chain.
var undefVals = [];
const Delete = { delete: true }, DeleteRange = () => Delete;
const Break = { break: true };
const EmptyLeaf = (function () {
    var n = new BNode();
    n.setShared(true);
    return n;
})();
const EmptyArray = [];
const ReusedArray = []; // assumed thread-local
function check(fact, ...args) {
    if (!fact) {
        args.unshift("B+ tree"); // at beginning of message
        throw new Error(args.join(" "));
    }
}
/** A BTree frozen in the empty state. */
exports.EmptyBTree = (() => {
    let t = new BTree();
    t.freeze();
    return t;
})();
