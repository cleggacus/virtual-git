import { VirtualGitError, defaultNodeConfig, repoFromUrl } from "virtual-git";

const a = `
module.exports = () => console.log("Boo");
`;

const index = `
require("./src/a")();
`;

const test = async () => {
    try {
        const repo = await repoFromUrl("https://github.com/cleggacus/git-js-test-project.git");

        const branches = await repo.getBranches();
        const main = await repo.getBranch(branches[0]);

        if(!main) return;

        // write index.js and commit
        console.log("writting index.js")

        await main.writeFile("index.js", index);
        const indexSave = await main.save();

        // write a.js and commit
        console.log("writting a.js")

        await main.writeFile("src/a.js", a);
        const aSave = await main.save();

        // print working tree
        const aTree = await main.getFileTree();
        console.log("working tree", JSON.stringify(aTree, null, 2));

        // undo to to index.js
        console.log("undo")
        await main.undo(indexSave);

        // print working tree
        const indexTree = await main.getFileTree();
        console.log("working tree", JSON.stringify(indexTree, null, 2));

        // redo
        console.log("redo")
        await main.undo(aSave);

        // prints changes at current stage
        const changes = await main.changes(2);
        console.log("changes", JSON.stringify(changes, null, 2));

        // runs the code
        await main.buildImage(defaultNodeConfig);
        await main.runImage((data) => {
            console.log(data);
        });
    } catch(err) {
        if(err instanceof VirtualGitError) {
            switch(err.code) {
                case "CreateContainerFailed":
                    // todo
                    break;
                case "RunContainerFailed":
                    // todo
                    break;
                case "BuildImageFailed":
                    // todo
                    break;
                case "UndoFailed":
                    // todo
                    break;
                case "CloneFailed":
                    // todo
                    break;
                case "CheckoutFailed":
                    // todo
                    break;
                case "GitCommandFailed":
                    // todo
                    break;
            }
        }
    }
}

test();

