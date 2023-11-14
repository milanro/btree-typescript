import { type } from "os";
import { BNode, BNodeInternal } from "../../b+tree";
import { createHash } from "crypto";
import { PersistenceManager } from "../manager/persistenceManager";
import { getPersistenceManager } from "../globals/globals";
import * as util from 'util';


  type AnyNode = BNode<any,any>;
  type NodeArray = AnyNode[];
  type NodeProxy = AnyNode & PersistentBNode;

  export enum NodeType {
    BRANCH = 'branch',
    LEAF = 'leaf'
  }

  export interface INodeContent {
    type: NodeType;
    values: any[];
    children: string[];
    keys: string[];
  } 

  export class PersistentBNode {


    node?: AnyNode;
    type?: NodeType;
    id?: string;
    loadId?: string;

    constructor(node?: BNode<any,any>, id?: string) {
      this.node = node;
      this.id = id;
      if(node?.isLeaf) {
        this.type = NodeType.LEAF;
      }
      else {
        this.type = NodeType.BRANCH;
      }
      if(this.node===undefined && id===undefined){
        throw new Error('node and id are undefined');
      }
    }    

    computeContent(): INodeContent {
      const node = this.node;
      if(node===undefined){
        throw new Error('node is undefined');
      }
      let children: string[] = [];
      if(this.type===NodeType.BRANCH){
        children = (node as BNodeInternal<any,any>).children.map(child => (child as unknown as PersistentBNode) .computeId());
      }
      return {
        type: this.type!,
        values: node.values,
        children,
        keys: node.keys
      }
    }

    serializeBNode(): string {
      const node = this.node;
      if(node===undefined){
        throw new Error('node is undefined');
      }
      return JSON.stringify(this.computeContent());
    }

    computeId(): string {
      if(this.id!==undefined){
        return this.id;
      }
      else {
        const serialized = this.serializeBNode();
        const hash = createHash('sha256').update(serialized).digest('hex');
        return hash;
      }
    }

    saveSync(persistence: PersistenceManager): void {
      if(!this.isLoaded()){
        return;
      }
      const id = this.computeId();
      if(this.loadId===undefined || this.loadId!==id){
        const content = this.serializeBNode();
        persistence.putSync(id, content);
      }
    }

    isLoaded(): boolean {
      return this.node!==undefined;
    }

    loadSync(persistence: PersistenceManager): void {
      if(this.isLoaded()){
        return;
      }
      const id = this.computeId();
      const content = persistence.getSync(id);
      const parsed = JSON.parse(content) as INodeContent;
      this.type = parsed.type;

      if(parsed.type===NodeType.BRANCH){
        this.node = new BNodeInternal(parsed.children.map(childId => wrapPersistentNode(new PersistentBNode(undefined, childId))), parsed.keys);
      }
      else {
        this.node = new BNode(parsed.keys, parsed.values);
      }
      this.loadId = id;
      this.id = undefined
      console.log('loaded : ', id);
    }

    printWholeTree(): void {
      console.log(this);
      if(this.type===NodeType.BRANCH){
        (this.node as BNodeInternal<any,any>).children.forEach(child => {
          (child as unknown as PersistentBNode).printWholeTree();
        });
      }      
    }

    saveTreeSync(persistence: PersistenceManager): string {      
      if(!this.isLoaded()){
        return '';
      }
      if(this.type===NodeType.BRANCH){   
        if((this.node as BNodeInternal<any,any>).children===undefined){
          console.log('children undefined', this.node);
        }
         (this.node as BNodeInternal<any,any>)
         .children
         .forEach(
          child => {          
          (child as unknown as PersistentBNode)
            .saveTreeSync(persistence)
          }
          );
      }
      this.saveSync(persistence);
      this.loadId = this.computeId();
      this.id = undefined;
      return this.loadId;
    }
    
  }

  export function setupPersistentNode(id: string): NodeProxy {
    const node = new PersistentBNode(undefined, id);
    return wrapPersistentNode(node);
  }

  function wrapPersistentNode(target: PersistentBNode): NodeProxy {
    return new Proxy<PersistentBNode>(target, {
      get(target, prop, receiver) {
        const originalMethod = Reflect.get(target, prop, receiver);
        if(originalMethod !== undefined && typeof originalMethod === 'function'){
            return function (...args: any[]) {
                const result = originalMethod.apply(target, args);
                return result;
            }
        }
        else {
          target.loadSync(getPersistenceManager());
            const node = target.node;
            if(node===undefined){
                throw new Error('node is undefined');
            }    
            const nodeMember = Reflect.get(node, prop);  
            if(nodeMember!==undefined && typeof nodeMember === 'function'){
                return function (...args: any[]) {                    
                    const result = nodeMember.apply(node, args);
                    return result;
                }
            }
            else {
              return nodeMember;
            }
        }
      },
    }) as NodeProxy;
  }
  
  export function nodeToProxy(node: AnyNode): NodeProxy {
    if(util.types.isProxy(node)){
      return node as unknown as NodeProxy;
    }   
    const proxy = wrapPersistentNode(new PersistentBNode(node));
    return proxy;
  }

  export function proxifyNodeArray(array: NodeArray): NodeProxy[] {
    if(util.types.isProxy(array)){
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
      get( target, prop, receiver ) {
        if(prop !== "length" && isNaN(parseInt(prop as string, 10))) {
            // console.log('prop', prop);
        }
        if (prop === "push") {
            return function(value: AnyNode) {
                target.push(nodeToProxy(value));
            }
        }
        if (prop === "unshift") {
            return function(...values: AnyNode[]) {
              const args = values.map((value, index) => {
                return nodeToProxy(value);
            });
            const result = target.unshift(...args);
            return result;
            }
        }
        if (prop === "splice") {
            return function(...values: any[]) {                
                const args = values.map((value, index) => {
                    if(index===0 || index===1){
                        return value;
                    }
                    return nodeToProxy(value);
                });
                if(args.length===1){
                    return target.splice(values[0]);
                }
                if(args.length===2){
                    return target.splice(values[0], values[1]);
                }
                const result = target.splice(values[0], values[1], ...args.slice(2));
                return result;
            }
        }
        // default behavior of properties and methods
        const result = Reflect.get(target, prop, receiver);
        if(prop !== "length" && isNaN(parseInt(prop as string, 10))) {
          // console.log('prop', prop, result, target);
      }
        return result;
      }}) as NodeProxy[];
  }
  

  