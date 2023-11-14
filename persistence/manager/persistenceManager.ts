import * as fs from 'fs';


export interface PersistenceManager {
    /*
    get(id: string): Promise<string>;
    put(id: string, content: string): Promise<void>;
    contains(id: string): Promise<boolean>;
    */
    getSync(id: string): string;
    putSync(id: string, content: string): void;
    containsSync(id: string): boolean;
}

export class SyncFSPersistenceManager implements PersistenceManager {
    constructor(private rootPath: string) {
    }

    private computeDir(id: string): string {
        const truncatedHash = id.slice(0, 8);
        const hashcode = parseInt(truncatedHash, 16);
        const dir1 = hashcode % 256;
        const dir2 = Math.floor(hashcode / 256) % 256;
        const dir3 = Math.floor(hashcode / 256 / 256) % 256;
        return `${this.rootPath}/${dir1}/${dir2}/${dir3}`;
    }

    private computePath(dir: string, id: string): string {
        return `${dir}/${id}.json`;
    }

    private readTextFileToStringSync(filePath: string) {
        return fs.readFileSync(filePath, 'utf-8');
    }

    private writeStringToTextFileSync(filePath: string, content: string) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
      

    getSync(id: string): string {
        const dir = this.computeDir(id);
        const path = this.computePath(dir, id);
        const content = this.readTextFileToStringSync(path);
        return content;
    }

    putSync(id: string, content: string): void {
        if(this.containsSync(id)){
            return;
        }
        const dir = this.computeDir(id);
        this.createDirectories(dir);
        const path = this.computePath(dir, id);
        this.writeStringToTextFileSync(path, content);
    }

    containsSync(id: string): boolean {
        const dir = this.computeDir(id);
        const path = this.computePath(dir, id);
        try {
            fs.accessSync(path, fs.constants.F_OK);
            return true;
          } catch (error) {
            return false;
          }
    }


    createDirectories(fullPath: string): void {
        const pathSegments = fullPath.split('/');      
        pathSegments.reduce((currentPath, segment) => {
          const currentFullPath = `${currentPath}/${segment}`;      
          if (!fs.existsSync(currentFullPath)) {
            fs.mkdirSync(currentFullPath);
          }
          return currentFullPath;
        }, '');
      }



}