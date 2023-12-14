import { type } from "os";
import { BNode, BNodeInternal } from "../../b+tree";
import { createHash } from "crypto";
import { PersistenceManager } from "../manager/persistenceManager";
import { getPersistenceManager } from "../globals/globals";
import * as util from "util";

type AnyNode = BNode<any, any>;
type NodeArray = AnyNode[];
type NodeProxy = AnyNode & PersistentBNode;

export enum NodeType {
  BRANCH = "branch",
  LEAF = "leaf",
}

export interface INodeContent {
  type: NodeType;
  values: any[];
  children: string[];
  keys: string[];
}

export class PersistentBNode {
  _node?: AnyNode;
  type?: NodeType;
  id?: string;
  loadId?: string;

  constructor(node?: BNode<any, any>, id?: string) {
    this._node = node;
    this.id = id;
  }

  async getNode(): Promise<AnyNode | undefined> {
    if(this.isLoaded()) {
      if (await this._node?.isLeafNode()) {
        this.type = NodeType.LEAF;
      } else {
        this.type = NodeType.BRANCH;
      }
    }
      return this._node;
  }

  
  getNodeSync(): AnyNode | undefined {
      return this._node;
  }


  setNode(node: AnyNode):void {
    this._node = node;
  }

  async computeContent(): Promise<INodeContent> {
    const node = await this.getNode();
    if (node === undefined) {
      throw new Error("node is undefined");
    }
    let children: string[] = [];
    if (this.type === NodeType.BRANCH) {
      const internalNode = node as BNodeInternal<any, any>;
      const childrenNodes = await internalNode.getChildren();
      const mapper = async (child: AnyNode) => {return await (child as unknown as PersistentBNode).computeId();}
      for(const child of childrenNodes) {
        children.push(await mapper(child));
      }
    }
    const values = await node.getValues();
    const keys = await node.getKeys();
    const ret = 
      {
        type: this.type!,
        values,
        children,
        keys
      };
    return ret;
  }

  async serializeBNode(): Promise<string> {
    const node = await this.getNode();
    if (node === undefined) {
      throw new Error("node is undefined");
    }
    return JSON.stringify(await this.computeContent());
  }

  async computeId(): Promise<string> {
    if (!this.isLoaded()) {
      return this.id!;
    } else {
      const serialized = await this.serializeBNode();
      // console.log('\nserialized', serialized);
      const hash = createHash("sha256").update(serialized).digest("hex");
      return hash;
    }
  }

  async saveSync(persistence: PersistenceManager): Promise<void> {
    if (!this.isLoaded()) {
      return;
    }
    const id = await this.computeId();
    if (this.loadId === undefined || this.loadId !== id) {
      const content = await this.serializeBNode();
      persistence.putSync(id, content);
    }
  }

  isLoaded(): boolean {
    return this._node !== undefined;
  }

  async loadSync(persistence: PersistenceManager): Promise<void> {
    if (this.isLoaded()) {
      return;
    }
    const id = await this.computeId();
    const content = persistence.getSync(id);

    const parsed = JSON.parse(content) as INodeContent;
    this.type = parsed.type;

    if (parsed.type === NodeType.BRANCH) {
      this.setNode(new BNodeInternal(
        parsed.children.map((childId) =>
          wrapPersistentNode(new PersistentBNode(undefined, childId))
        ),
        parsed.keys
      ));
    } else {
      this.setNode(new BNode(parsed.keys, parsed.values));
    }
    this.loadId = id;
    this.id = undefined;
    // console.log("loaded : ", id);
  }

 async  printWholeTree(): Promise<void> {
    // console.log(this.computeId());
    if (this.type === NodeType.BRANCH) {
      (await (await this.getNode() as BNodeInternal<any, any>).getChildren()).forEach((child) => {
        (child as unknown as PersistentBNode).printWholeTree();
      });
    }
  }

  async saveTreeSync(persistence: PersistenceManager): Promise<string> {
    if (!this.isLoaded()) {
      return this.id!;
    }
    if (this.type === NodeType.BRANCH) {
      if ((await this.getNode() as BNodeInternal<any, any>).getChildren() === undefined) {
        // console.log('children undefined', this.node);
      }
      (await (await this.getNode() as BNodeInternal<any, any>).getChildren()).forEach((child) => {
        (child as unknown as PersistentBNode).saveTreeSync(persistence);
      });
    }
    this.saveSync(persistence);
    this.loadId = await this.computeId();
    this.id = undefined;
    return this.loadId;
  }
}

export function setupPersistentNode(id: string): NodeProxy {
  const node = new PersistentBNode(undefined, id);
  return wrapPersistentNode(node);
}

const syncMethods = ["maxKeySync"];

function wrapPersistentNode(target: PersistentBNode): NodeProxy {
  return new Proxy<PersistentBNode>(target, {
    set(target, prop, value, receiver) {
      throw new Error("Set property to Node " + (prop as string));
    },
    get(target, prop, receiver) {
      // console.log('get property from node', prop);
      const originalMethod = Reflect.get(target, prop, receiver);
      if (
        originalMethod !== undefined &&
        typeof originalMethod === "function"
      ) {
        return function (...args: any[]) {
          const result = originalMethod.apply(target, args);
          return result;
        };
      } else {
        if (syncMethods.indexOf(prop as string) !== -1) {
          const node = target.getNodeSync();
          const result = Reflect.get(node!, prop, receiver);
          return result;
        } else {
          if(prop === 'then') {
            // console.log('then');
            return undefined;
          }
          return async function (...args: any[]) {
            await target.loadSync(getPersistenceManager());
            const node = await target.getNode();
            const nodeMember = Reflect.get(node!, prop);
            if (node === undefined) {
              throw new Error("node is undefined");
            }
            if(nodeMember === undefined) {
              // console.log('Failing all method from node' + " PROP : ", (prop as string), "\nargs:\n" + args);
            }                        
            try{
              const result = await nodeMember.apply(node, args);
              return result;
            }
            catch(e) {
              throw new Error("Failing all method from node" + " PROP : " + " : " 
              +  (prop as string) + " : " + "\nargs:\n" + args + " : " + e);
            }
          };
        }
      }
    },
  }) as NodeProxy;
}

export function nodeToProxy(node: AnyNode): NodeProxy {
  if (util.types.isProxy(node)) {
    return node as unknown as NodeProxy;
  }
  const proxy = wrapPersistentNode(new PersistentBNode(node));
  return proxy;
}

export function proxifyNodeArray(array: NodeArray): NodeProxy[] {
  if (util.types.isProxy(array)) {
    return array as unknown as NodeProxy[];
  }
  return new Proxy(array, {
    set(target, prop, value, receiver) {
      const index = parseInt(prop as string, 10);

      if (!isNaN(index) && index >= 0) {
        target[index] = nodeToProxy(value);
      } else {
        target[prop as any] = value;
      }

      return true;
    },
    get(target, prop, receiver) {
      if (prop !== "length" && isNaN(parseInt(prop as string, 10))) {
        // console.log('prop', prop);
      }
      if (prop === "push") {
        return function (...values: AnyNode[]) {
          const args = values.map((value, index) => {
            return nodeToProxy(value);
          });
          const result = target.push(...args);
          return result;
        };
      }
      if (prop === "unshift") {
        return function (...values: AnyNode[]) {
          const args = values.map((value, index) => {
            return nodeToProxy(value);
          });
          const result = target.unshift(...args);
          return result;
        };
      }
      if (prop === "splice") {
        return function (...values: any[]) {
          const args = values.map((value, index) => {
            if (index === 0 || index === 1) {
              return value;
            }
            return nodeToProxy(value);
          });
          if (args.length === 1) {
            return target.splice(values[0]);
          }
          if (args.length === 2) {
            return target.splice(values[0], values[1]);
          }
          const result = target.splice(values[0], values[1], ...args.slice(2));
          return result;
        };
      }
      // default behavior of properties and methods
      const result = Reflect.get(target, prop, receiver);
      if (prop !== "length" && isNaN(parseInt(prop as string, 10))) {
        // console.log('prop', prop, result, target);
      }
      return result;
    },
  }) as NodeProxy[];
}
