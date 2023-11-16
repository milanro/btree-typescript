import * as fs from 'fs';


export interface PersistenceManager {
    
    get(id: string): Promise<string>;
    put(id: string, content: string): Promise<void>;
    contains(id: string): Promise<boolean>;

    getSync(id: string): string;
    putSync(id: string, content: string): void;
    containsSync(id: string): boolean;

}

export class SyncFSPersistenceManager implements PersistenceManager {
    constructor(private rootPath: string) {
    }
    async get(id: string) {
        const dir = this.computeDir(id);
        const path = this.computePath(dir, id);
        const content = await fs.promises.readFile(path, {encoding: 'utf-8'}) as string;
        return content;
    }
    async put(id: string, content: string): Promise<void> {
        if(await this.containsSync(id)){
            return;
        }
        const dir = this.computeDir(id);
        this.createDirectories(dir);
        const path = this.computePath(dir, id);
        await fs.promises.writeFile(path, content, {encoding: 'utf-8'});
    }

    

    async exists(path: string): Promise<boolean> {
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            return true;
          } catch (error) {
            return false;
          }
    }

    async contains(id: string): Promise<boolean> {
        const dir = this.computeDir(id);
        const path = this.computePath(dir, id);
        return await this.exists(path);
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
      
    getSync(id: string): string {
        const dir = this.computeDir(id);
        const path = this.computePath(dir, id);
        const content = fs.readFileSync(path, 'utf-8');
        return content;
    }

    putSync(id: string, content: string): void {
        if(this.containsSync(id)){
            return;
        }
        const dir = this.computeDir(id);
        this.createDirectoriesSync(dir);
        const path = this.computePath(dir, id);
        fs.writeFileSync(path, content, 'utf-8');
        console.log('wrote file: ', path);
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

 
    async createDirectories(fullPath: string): Promise<void> {
        const pathSegments = fullPath.split('/');
        await pathSegments.reduce(async (currentPath: Promise<string>, segment: string) => {
            const currentFullPath = `${currentPath}/${segment}`;
            if (! await this.exists(currentFullPath)) {
                await fs.promises.mkdir(currentFullPath);
            }
            return currentFullPath;
        }, Promise.resolve(''));
    }

    createDirectoriesSync(fullPath: string): void {
        const pathSegments = fullPath.split('/');
        pathSegments.reduce((currentPath: string, segment: string) => {
            const currentFullPath = `${currentPath}/${segment}`;
            if (!fs.existsSync(currentFullPath)) {
                fs.mkdirSync(currentFullPath);
            }
            return currentFullPath;
        }, '');
    }

}