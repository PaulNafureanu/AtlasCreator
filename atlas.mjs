#!C:\Program Files\nodejs
import fs from "node:fs";
import path from "node:path";
import readline from "readline";
import Jimp from "jimp";
import potpack from "potpack";
const __dirname = process.cwd();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout, // Output to standard output (console)
});
rl.question("Enter source folder: ", (answer) => {
    const [input, output] = answer.split(" ");
    createTextureAtlas(input, output).catch((error) => {
        console.error("Error creating texture atlas:", error);
    });
    rl.close();
});
async function createTextureAtlas(input, output) {
    const textureFolder = input ? path.resolve(__dirname, input) : __dirname;
    const outputFolder = output
        ? path.resolve(__dirname, output)
        : input
            ? textureFolder
            : __dirname;
    console.log("Input: ", textureFolder);
    console.log("Output: ", outputFolder);
    const textureFiles = fs.readdirSync(textureFolder);
    const textureDataList = [];
    const mapData = {};
    const textureLen = textureFiles.length;
    let index = 1;
    for (const textureFile of textureFiles) {
        const texturePath = path.join(textureFolder, textureFile);
        const texture = await Jimp.read(texturePath);
        textureDataList.push({
            w: texture.bitmap.width,
            h: texture.bitmap.height,
            data: texture.bitmap.data,
            name: textureFile,
        });
        console.log(index, ":", textureLen, "Texture read: ", textureFile);
        index++;
    }
    const { w, h } = potpack(textureDataList);
    const atlas = new Jimp(w, h);
    console.log("Atlas W: ", w);
    console.log("Atlas H: ", h);
    textureDataList.forEach((textureData, index) => {
        const atlasTexture = new Jimp(textureData.w, textureData.h);
        const { data, name } = textureDataList[index];
        atlasTexture.bitmap.data = data;
        atlas.blit(atlasTexture, textureData.x || 0, textureData.y || 0);
        mapData[name] = {
            xPos: textureData.x || 0,
            yPos: textureData.y || 0,
            width: textureData.w,
            height: textureData.h,
        };
        console.log("Texture map created: ", mapData[name]);
    });
    const atlasPath = path.join(outputFolder, "atlas.png");
    await atlas.writeAsync(atlasPath);
    const mapDataPath = path.join(outputFolder, "map.json");
    fs.writeFileSync(mapDataPath, JSON.stringify(mapData, null, 2));
    console.log("Texture atlas and map created successfully.");
}
export default {};
