import Docker, { Container } from "dockerode";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { VirtualGitError } from "./error";

export const DOCKER_IMAGE_PREFIX = "virtual-git";
export const docker = new Docker({socketPath: '/var/run/docker.sock'});
export const containers: Set<string> = new Set();

let shouldCleanup = false;

const cleanup = async () => {
    let todo: Promise<any>[] = [];

    for(const container of Array.from(containers.keys())) {
        todo.push(docker.getContainer(container).kill({
            force: true,
        }));
    }
}

const setupCleanup = () => {
    if(shouldCleanup) return;
    shouldCleanup = true;

    process.on('SIGINT', cleanup);
    process.on('SIGQUIT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
}

export type DockerConfig = {
    from: string,
    buildCopy: string,
    buildCommand: string,
    runCommand: string[],
    exposedPorts: number[],
}

export const defaultDockerConfig: DockerConfig = {
    from: "ubuntu",
    buildCopy: "",
    buildCommand: "",
    runCommand: [],
    exposedPorts: [],
}

export const defaultNodeConfig: DockerConfig = {
    from: "node",
    buildCopy: "package*.json",
    buildCommand: "npm install",
    runCommand: ["npm", "run", "start"],
    exposedPorts: [8080],
}

export const runImage = async (image: string, cb: ((data: string) => void)) => {
    return new Promise<Container>((resolve, reject) => {
        let result = "";

        docker.createContainer({
            Image: image,
            name: image,
            Tty: true,
        }, (err, container) => {
            if(err || !container) {
                return reject(new VirtualGitError("CreateContainerFailed", "failed to create container"));
            }

            setupCleanup();
            containers.add(container.id);

            container.attach({ stream: true, stdout: true, stderr: true }, (err, stream) => {
                if(err) {
                    return reject(new VirtualGitError("RunContainerFailed", "failed to attach stream"));
                }

                if(!stream) return;

                stream.on("data", (data) => {
                    cb(data.toString());
                    result += data.toString();
                });

                stream.on("close", async () => {
                    await container.remove();
                    await docker.getImage(image).remove();

                    containers.delete(container.id);
                })
            });

            container.start((err) => {
                if(err) {
                    return reject(new VirtualGitError("RunContainerFailed", "failed to attach stream"));
                }

                resolve(container);
            });

            return container;
        });

    })
}

export const createDockerFile = (projectPath: string, config: DockerConfig) => {
    const dockerFilePath = path.join(projectPath, "Dockerfile");

    let file = "";
    file += `FROM ${config.from}\n`;
    file += `WORKDIR /\n`;

    if(config.buildCopy) {
        file += `COPY ${config.buildCopy} ./\n`;
    }

    if(config.buildCommand) {
        file += `RUN ${config.buildCommand}\n`;
    }

    file += `COPY . .\n`;

    for(const port of config.exposedPorts) {
        file += `EXPOSE ${port}\n`;
    }

    file += `CMD [ ${config.runCommand.map(cmd => `"${cmd}"`).join(", ")} ]`;

    return fs.writeFile(dockerFilePath, file);
}

export const buildImage = (projectPath: string, files: string[], config: DockerConfig) => {
    return new Promise<string>(async (resolve, reject) => {
        const id = crypto.randomBytes(8).toString("hex");
        const dockerImage = `${DOCKER_IMAGE_PREFIX}-${id}`;

        await createDockerFile(projectPath, config);

        docker.buildImage({
            context: projectPath,
            src: ['Dockerfile', ...files]
        }, {
            t: dockerImage,
            labels: {
                "owner": DOCKER_IMAGE_PREFIX
            }
        }, (err, stream) => {
            if(err) {
                reject(new VirtualGitError("BuildImageFailed", "failed to build image"));
                return;
            }

            if(!stream) return;

            stream.on("data", (_data) => {});

            stream.on('end', async () => {
                resolve(dockerImage);
            });
        });
    })
}
