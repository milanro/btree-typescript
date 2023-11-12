import { type } from "os";
import { BNode } from "../../b+tree";


  type AnyNode = BNode<any,any>;
  type NodeArray = AnyNode[];
  type NodeProxy = AnyNode & PersistentBNode;

  export class PersistentBNode {
    
    node?: AnyNode;
    type?: string;
    id?: string;

    constructor(node?: BNode<any,any>, id?: string, type?: string) {
      this.node = node;
      this.id = id;
      this.type = type;
    }    

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
            const node = target.node;
            if(node===undefined){
                throw new Error('node is undefined');
            }    
            const nodeMethod = Reflect.get(node, prop);  
            if(nodeMethod!==undefined && typeof nodeMethod === 'function'){
                return function (...args: any[]) {
                    console.log('Call nodeMethod', nodeMethod);
                    const result = nodeMethod.apply(node, args);
                    return result;
                }
            }
        }
      },
    }) as NodeProxy;
  }
  
  export function nodeToProxy(node: AnyNode): NodeProxy {
    return wrapPersistentNode(new PersistentBNode(node));
  }

  export function proxifyNodeArray(array: NodeArray): NodeProxy[] {
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
        if (prop === "push") {
            return function(value: AnyNode) {
                target.push(nodeToProxy(value));
            }
        }
        if (prop === "unshift") {
            return function(value: AnyNode) {
                target.unshift(nodeToProxy(value));
                return value;
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
                const result = target.splice(values[0], values[1], ...args);
                return result;
            }
        }
        // default behavior of properties and methods
        return Reflect.get(target, prop, receiver);
      }}) as NodeProxy[];
  }
  

  