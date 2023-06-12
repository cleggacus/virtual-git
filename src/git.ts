import path from "path";
import parseDiff from "parse-diff";
import { exec } from "./utils";
import { VirtualGitError } from "./error";

export class GitController {
    private path: string;

    public constructor(relativePath: string) {
        this.path = path.resolve(relativePath);
    }

    public getPath() {
        return this.path;
    }

    public async execGit(...command: string[]) {
        const response = await exec("git", ["-C", this.path, ...command]);

        if(response.status == "fail") {
            throw new VirtualGitError("GitCommandFailed", "git command failed to run");
        }

        return response.out;
    }

    public show() {
        return this.execGit("show");
    }

    public undoCommit(from: string | number = 1) {
        try {
            return this.execGit("reset", "--hard", GitController.parseCommit(from));
        } catch(e) {
            throw new VirtualGitError("UndoFailed", `failed to reset to "${from}"`);
        }
    }

    public async getCommit(ago: number = 0) {
        const response = await this.execGit("rev-parse", `HEAD~${ago}`);
        return response.split("\n")[0];
    }

    public async commit(message: string) {
        await this.execGit("commit", "-m", message);
        return this.getCommit();
    }

    public async getDiff(from: string | number = 0, to?: string | number) {
        const args = [GitController.parseCommit(from)];

        if(to) {
            args.push(GitController.parseCommit(to));
        }

        const response = await this.execGit("diff", ...args);
        return parseDiff(response);
    }

    public async addWorktree(name: string, branch = name) {
        const response = await this.execGit("worktree", "add", name, branch);
        return response;
    }

    public async getWorktrees() {
        const response = await this.execGit("worktree", "list", "--porcelain");
        const lines = response.split("\n");

        const worktrees: Map<string, string> = new Map();
        let worktree = "";

        for(const line of lines) {
            if(line.startsWith("worktree")) {
                worktree = line.split("worktree ")[1];
            }

            if(line.startsWith("branch")) {
                const branch = line.split("branch ")[1];
                const branchSplit = branch.split("/");

                if(branchSplit.length > 0) {
                    worktrees.set(branchSplit[branchSplit.length-1], worktree);
                }
            }
        }

        return worktrees;
    }
    
    public async checkout(branch: string) {
        try {
            const response = await this.execGit("checkout", branch);
            return response;
        } catch(e) {
            throw new VirtualGitError("CheckoutFailed", `failed to checkout "${branch}"`);
        }
    }

    public async getAllBranches() {
        const response = await this.execGit("branch", "-a");
        return GitController.extractBranchNames(response);
    }

    public async getRemoteBranches() {
        const response = await this.execGit("branch", "-r");
        return GitController.extractBranchNames(response);
    }

    public async getLocalBranches() {
        const response = await this.execGit("branch");
        return GitController.extractBranchNames(response);
    }

    public async getCurrentBranch() {
        const response = await this.execGit("rev-parse", "--abbrev-ref", "HEAD");
        return response;
    }

    public async clone(url: string) {
        try {
            const response = await this.execGit("clone", url, ".");
            return response;
        } catch(e) {
            throw new VirtualGitError("CloneFailed", "failed to clone repository");
        }
    }

    public async getFiles() {
        const response = await this.execGit("ls-files");
        const files = response.split("\n");
        files.pop();

        return files;
    }

    public async addFiles(...files: string[]) {
        const response = await this.execGit("add", ...files);
        return response;
    }

    public async addAll() {
        const response = await this.execGit("add", "--all");
        return response;
    }

    private static extractBranchNames(response: string) {
        const lines = response.split('\n');

        const names: string[] = [];

        for(let line of lines) {
            if(!line.trim() || line.includes("->")) {
                continue;
            }

            line = line.substring(2);

            const split = line.split("/");
            line = split[split.length - 1];

            if(names.includes(line)) {
                continue;
            }

            names.push(line);
        }

        return names;
    }

    private static parseCommit(commit: string | number) {
        return typeof commit == "string" ? commit : `HEAD~${commit}`;
    }
}
