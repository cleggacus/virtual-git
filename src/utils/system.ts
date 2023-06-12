import { SpawnOptionsWithoutStdio, spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

type ExecResponse = {
    status: "success" | "fail",
    out: string
}

export const exec = (command: string, args?: string[], options?: SpawnOptionsWithoutStdio) => {
    return new Promise<ExecResponse>((resolve, reject) => {
        const proc = spawn(command, args, options);

        let out = "";

        proc.stdout.on("data", (data) => {
            out += data.toString();
        });

        proc.stderr.on("data", (data) => {
            out += data.toString();
        });

        proc.on("close", (code) => {
            resolve({
                status: code ? "fail" : "success",
                out
            });
        });
    })
}

export const createTempDir = async (prefix: string = "virtual-git-") => {
    const tempDirPath = path.join(os.tmpdir(), prefix);
    const dir = await fs.mkdtemp(tempDirPath);
    return dir;
}

export const pathExists = async (path: string) => {
    return fs.access(path)
        .then(() => true)
        .catch().then(() => false)
}

export const copyDirectory = async (from: string, to: string) => {
    const files = await fs.readdir(from);

    for(const file of files) {
        const fromFile = path.join(from, file);
        const stat = await fs.stat(fromFile);

        const toFile = path.join(to, file);

        if(stat.isDirectory()) {
            await fs.mkdir(toFile);
            await copyDirectory(fromFile, toFile)
        } else {
            await fs.copyFile(fromFile, toFile);
        }
    }
}
