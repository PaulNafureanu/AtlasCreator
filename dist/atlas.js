#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Jimp from "jimp";
import potpack from "potpack";
import _yargs from "yargs";
import { hideBin } from "yargs/helpers";
const yargs = _yargs(hideBin(process.argv));
const _dir = process.cwd();
const argv = yargs
    .wrap(null)
    .scriptName("atlas")
    .usage("Usage: $0 [options]")
    .option("input", {
    alias: "i",
    type: "string",
    demandOption: false,
    description: "Set the input directory name or the full path containing textures to be processed.",
})
    .option("output", {
    alias: "o",
    type: "string",
    demandOption: false,
    description: "Set the output directory or the full path that will contain the atlas and the map files.",
})
    .option("atlas", {
    alias: "a",
    type: "string",
    default: "atlas.png",
    demandOption: false,
    description: "Set the name and the extension [bmp, gif, jpeg, png, tiff] of the atlas file.",
})
    .option("map", {
    alias: "m",
    type: "string",
    default: "map.json",
    demandOption: false,
    description: "Set the name and the extension [json] of the map file.",
})
    .help().argv;
createTextureAtlas(argv).catch((err) => {
    console.error("Atlas could not be created: \n", err);
});
async function createTextureAtlas({ input, output, atlas: atlasName, map: mapName, }) {
    let textureFolder;
    if (input) {
        if (fs.existsSync(input)) {
            if (input.indexOf(":") >= 0)
                textureFolder = input;
            else
                textureFolder = path.join(_dir, input);
        }
        else {
            console.error(`Could not find directory '${input}'.`);
            return;
        }
    }
    else
        textureFolder = _dir;
    let outputFolder;
    if (output) {
        if (fs.existsSync(output)) {
            if (output.indexOf(":") >= 0)
                outputFolder = output;
            else
                outputFolder = path.join(_dir, output);
        }
        else {
            if (output.indexOf(":") >= 0) {
                fs.mkdirSync(output);
                outputFolder = output;
            }
            else {
                outputFolder = path.join(_dir, output);
                fs.mkdirSync(outputFolder);
            }
        }
    }
    else
        outputFolder = input ? textureFolder : _dir;
    console.log("Input: ", textureFolder);
    console.log("Output: ", outputFolder);
    console.log("Directory: ", _dir);
    return;
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
    const atlasPath = path.join(outputFolder, atlasName);
    await atlas.writeAsync(atlasPath);
    const mapDataPath = path.join(outputFolder, mapName);
    fs.writeFileSync(mapDataPath, JSON.stringify(mapData, null, 2));
    console.log("Texture atlas and map created successfully.");
}
