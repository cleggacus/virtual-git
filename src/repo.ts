import { createTempDir } from "./utils";
import { Branch, GitController } from ".";

export class Repo {
    private controller: GitController;
    private branches: Map<string, Branch>;

    public constructor(relativePath: string) {
        this.controller = new GitController(relativePath);
        this.branches = new Map();
    }

    public clone(url: string) {
        return this.controller.clone(url);
    }

    public getBranches() {
        return this.controller.getAllBranches();
    }

    public async getBranch(branch: string) {
        const branches = await this.controller.getAllBranches();

        if(!branches.includes(branch)) {
            return undefined;
        }

        const worktrees = await this.controller.getWorktrees();
        const worktree = worktrees.get(branch);

        if(!worktree) {
            this.controller.addWorktree(branch);
        }

        if(!this.branches.get(branch)) {
            this.branches.set(branch, new Branch(worktree ?? ""));
        }

        return this.branches.get(branch);
    }
}

export const repoFromPath = (relativePath: string) => {
    return new Repo(relativePath);
}

export const repoFromUrl = async (url: string) => {
    const relativePath = await createTempDir();

    const repo = repoFromPath(relativePath);
    await repo.clone(url);

    return repo;
}

