import path from "path";
import { promises as fs } from "fs";

import { GitController, DockerConfig, buildImage, runImage, VirtualGitError } from ".";

export type Tree = {
    name: string,
    children: Node[]
};

export type Node = Tree | string;

export class Branch {
    private dockerImage?: string;
    private controller: GitController;

    public constructor(relativePath: string) {
        this.controller = new GitController(relativePath);
    }

    public getController(){
        return this.controller;
    }
    
    public save() {
        return this.controller.commit("virtual-js");
    }

    public undo(commit?: string | number) {
        return this.controller.undoCommit(commit);
    }

    public changes(from?: string | number, to?: string | number) {
        return this.controller.getDiff(from, to);
    }

    public runImage(cb: ((data: string) => void)) {
        if(!this.dockerImage) {
            throw new VirtualGitError("CreateContainerFailed", "image has not been built, run repo.buildImage(...)");
        }

        return runImage(this.dockerImage, cb);
    }

    public async buildImage(config: DockerConfig) {
        this.dockerImage = await buildImage(
            this.controller.getPath(), 
            await this.controller.getFiles(),
            config
        );

        return this.dockerImage;
    }

    public async readFile(relativePath: string) {
        const fullPath = path.join(this.controller.getPath(), relativePath);
        const content = await fs.readFile(fullPath);
        return content.toString();
    }

    public async writeFile(relativePath: string, content: string) {
        const fullPath = path.join(this.controller.getPath(), relativePath);

        const split = fullPath.split("/");
        split.pop();
        const dir = split.join("/");

        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content);

        await this.controller.addFiles(relativePath);
    }

    public async getFileTree() {
        const files = await this.controller.getFiles();

        let tree: Tree = {
            name: "root",
            children: []
        };

        for(const file of files) {
            let scope = tree;

            const dirPath = file.split("/");
            const fileName = dirPath.pop() ?? "";

            for(const dir of dirPath) {
                let node = scope.children.find(val => typeof val == "object" && val.name == dir) as Tree;

                if(!node) {
                    node = {
                        name: dir,
                        children: []
                    }

                    scope.children.push(node);
                }

                scope = node;
            }

            scope.children.push(fileName);
        }

        return tree;
    }
}
