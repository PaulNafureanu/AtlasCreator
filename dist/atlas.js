#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Jimp from "jimp";
import potpack from "potpack";
import debugFactory from "debug";
import argv from "./command.js";
import errorHandler from "./errorhandler.js";
import { findIndexesOfMaterials, getDefaultMaterialName, getPathsFromArgv, getResize, getTextureName, updateArray, } from "./utils.js";
// Creating debug functions for various namespaces
const debugPaths = debugFactory("paths");
const debugRawTextures = debugFactory("default:Texture");
const debugTextureAtlas = debugFactory("default:Atlas");
const debugDataMap = debugFactory("default:DataMap");
const debugFinal = debugFactory("default:Final");
// Get the current director where the process is running
const _dir = process.cwd();
/**
 * A function to create a texture atlas with a JSON map, as well as modifying the gltf file.
 * @param argv an object having the user options read from the command line.
 */
const createTextureAtlas = async ({ input, output, atlas, map, resize, gltf, json, debug, }) => {
    //Set debuggers
    debugFactory.enable(`default:*,${debug}`);
    // Check, create and save the full paths to the needed resources.
    const { textureFolderPath, outputFolderPath, gltfFilePath } = getPathsFromArgv(_dir, input, output, gltf);
    debugPaths("Texture folder full path: ", textureFolderPath);
    debugPaths("Output folder full path: ", outputFolderPath);
    debugPaths("Gltf file full path: ", gltfFilePath);
    debugPaths("Current directory full path: ", _dir);
    // Read raw image files and store their data into the image data array
    const rawImageFiles = fs.readdirSync(textureFolderPath);
    const imageDataList = await getImageDataList(rawImageFiles, {
        resize,
        textureFolderPath,
    });
    // Sort the dimensions of the images and define the texture atlas dimensions.
    const { w: atlasWidth, h: atlasHeight } = potpack(imageDataList);
    const rawTextureAtlas = new Jimp(atlasWidth, atlasHeight);
    debugTextureAtlas("Atlas Width (pixels): ", atlasWidth);
    debugTextureAtlas("Atlas Height (pixels): ", atlasHeight);
    // Check if the gltf file exists, prepares it and returns its data or empty objects
    const { gltfFile, gltfPrepData, isGLTF } = getGLTFData(gltfFilePath);
    // Create the texture atlas and the map json data
    const { textureAtlas, mapData } = getMapAtlasData(imageDataList, {
        rawTextureAtlas,
        atlasWidth,
        atlasHeight,
        isGLTF,
        gltfPrepData,
    });
    // Modify and write the new gltf file
    modifyAndWriteGLTFFile(atlas, json, outputFolderPath, isGLTF, gltfFilePath, gltfFile);
    //Write the atlas and the map data files
    const textureAtlasPath = path.join(outputFolderPath, atlas);
    await textureAtlas.writeAsync(textureAtlasPath);
    const mapDataPath = path.join(outputFolderPath, map);
    fs.writeFileSync(mapDataPath, JSON.stringify(mapData, null, 2));
    debugFinal("Texture Atlas and Map created successfully.");
};
/**
 * Read raw texture files from the texture folder and return their formatted data as an array
 * @param rawImageFiles a list of raw files read by fs from the texture folder.
 * @param resize the resize factor read from the console.
 * @param textureFolderPath the full path to the texture folder used to read the files.
 * @returns
 */
const getImageDataList = async (rawImageFiles, { resize, textureFolderPath }) => {
    const imageFormatsSupported = ["jpeg", "png", "bmp", "tiff", "gif"];
    const rawImageListLen = rawImageFiles.length;
    if (rawImageListLen === 0)
        throw new Error("No texture images found in the texture folder.");
    const imageDataList = [];
    let rawTextureIndex = 1;
    // Get the resize factor from resize string
    const { pixels, percentage, usePercentage } = getResize(resize);
    for (const rawImageFile of rawImageFiles) {
        // Check if the image format is supported
        const [rawImageName, rawImageFormat] = rawImageFile.split(".");
        if (!imageFormatsSupported.includes(rawImageFormat))
            continue;
        // Get image
        const imageFilePath = path.join(textureFolderPath, rawImageFile);
        const image = await Jimp.read(imageFilePath);
        // Resize image
        if (usePercentage)
            image.scale(percentage);
        else
            image.resize(pixels, Jimp.AUTO);
        // Add image to the image data array
        imageDataList.push({
            w: image.bitmap.width,
            h: image.bitmap.height,
            data: image.bitmap.data,
            imageUsed: rawImageName,
        });
        // Set the debug message
        const progress = `${rawTextureIndex} / ${rawImageListLen}`;
        const debugMsg = `Texture read: `;
        debugRawTextures([progress], debugMsg, rawImageFile);
        rawTextureIndex++;
    }
    const filesUnsupportedCount = rawImageListLen - rawTextureIndex;
    if (filesUnsupportedCount > 0) {
        debugRawTextures(`Files with unsupported format in the texture folder: ${filesUnsupportedCount}`);
    }
    return imageDataList;
};
/**
 * Get the gltf file and prep gltf data in a json format
 * @param gltfFilePath the full path to the gltf file
 * @returns
 */
const getGLTFData = (gltfFilePath) => {
    let gltfFile = undefined;
    let gltfPrepData = {
        imagesUsed: [],
        texturesUsed: [],
        materialsUsed: [],
        texturesUsedByImage: {},
        texturesUsedByMaterial: {},
        materialsUsedByTexture: {}, // Store the name of the materials used sorted by image names
    };
    let isGLTF = false;
    if (gltfFilePath) {
        // Get the gltf file in a json format
        gltfFile = JSON.parse(fs.readFileSync(gltfFilePath, "utf-8"));
        if (!gltfFile.images)
            throw new Error("The gltf file does not have an images property.");
        if (!gltfFile.materials)
            throw new Error("The gltf file does not have a materials property.");
        if (!gltfFile.textures)
            throw new Error("The gltf file does not have a textures property.");
        // Get some prep data needed for the parsing of the gltf json file
        // Get the name of the images used in the gltf file and map them to the same index
        gltfFile.images?.forEach(({ uri }) => {
            gltfPrepData.imagesUsed.push(path.basename(uri).split(".")[0]);
        });
        // Get the name of the textures used in the gltf file and map them to the image they used
        gltfFile.textures?.forEach((texture, index) => {
            gltfPrepData.texturesUsed.push(getTextureName(index));
            const imageUsed = gltfPrepData.imagesUsed[texture.source];
            gltfPrepData.texturesUsedByImage = updateArray(gltfPrepData.texturesUsedByImage, imageUsed, getTextureName(index));
        });
        // Get the name of the materials used in the gltf file and map them to the textures they used.
        gltfFile.materials?.forEach((material, indexMat) => {
            gltfPrepData.materialsUsed.push(material.name || getDefaultMaterialName(indexMat));
            let textures = [];
            textures = findIndexesOfMaterials(material, textures);
            textures.forEach(({ index, type }) => {
                // const textureUsed = getTextureName(texture.index);
                const textureUsed = {
                    name: getTextureName(index),
                    type,
                    index,
                };
                gltfPrepData.materialsUsedByTexture = updateArray(gltfPrepData.materialsUsedByTexture, textureUsed.name, material.name || getDefaultMaterialName(indexMat));
                gltfPrepData.texturesUsedByMaterial = updateArray(gltfPrepData.texturesUsedByMaterial, material.name || getDefaultMaterialName(indexMat), textureUsed);
            });
        });
        // Check GLTF File validity
        const isFile = Object.keys(gltfFile).length > 0;
        const isImage = gltfPrepData.imagesUsed.length > 0;
        const isTexture = gltfPrepData.texturesUsed.length > 0;
        const isMaterial = gltfPrepData.materialsUsed.length > 0;
        isGLTF = isFile && isImage && isTexture && isMaterial;
    }
    return { gltfFile, gltfPrepData, isGLTF };
};
/**
 *
 * @param imageDataList a list of image data formatted from the raw image files read by fs
 * @param config an object containing configurations for the atlas and gltf file
 * @returns
 */
const getMapAtlasData = (imageDataList, { rawTextureAtlas, atlasWidth, atlasHeight, isGLTF, gltfPrepData, }) => {
    let mapData = {
        atlas: { width: atlasWidth, height: atlasHeight },
        textures: {},
        materials: {},
    };
    const imageDataLen = imageDataList.length;
    imageDataList.forEach(({ x = 0, y = 0, w = 0, h = 0 }, index) => {
        // Read a image data, create a empty texture and insert that data into the texture atlas
        const { data, imageUsed } = imageDataList[index];
        const texture = new Jimp(w, h);
        texture.bitmap.data = data;
        rawTextureAtlas.blit(texture, x, y);
        // Defines an instance of the texture map data based on the image data
        const textureMapData = {
            oldImageUsed: imageUsed,
            linkedMaterials: [],
            offset: [x / atlasWidth, y / atlasHeight],
            repeat: [w / atlasWidth, h / atlasHeight],
            position: [x, y],
            scale: [w, h],
        };
        //Defines how the texture map data instance is placed in the map data array
        if (isGLTF) {
            const texturesUsedByImage = gltfPrepData.texturesUsedByImage[imageUsed] || [];
            texturesUsedByImage.forEach((textureName) => {
                const materialsUsedByTexture = gltfPrepData.materialsUsedByTexture[textureName] || [];
                textureMapData.linkedMaterials = materialsUsedByTexture;
                mapData.textures[textureName] = textureMapData;
            });
        }
        else
            mapData.textures[imageUsed] = textureMapData;
        // Indicate the progress of the map data
        const progress = Math.round(((index + 1) * 100) / imageDataLen);
        const indicatorMsg = `Map data added: `;
        debugDataMap([progress], indicatorMsg, imageUsed);
    });
    // Insert materials information in the map data
    if (isGLTF) {
        gltfPrepData.materialsUsed.forEach((materialUsed) => {
            mapData.materials[materialUsed] = {
                texturesUsed: gltfPrepData.texturesUsedByMaterial[materialUsed],
            };
        });
    }
    return { textureAtlas: rawTextureAtlas, mapData };
};
/**
 *
 * @param atlas the name and the format of the texture atlas useful at writting the final file by fs.
 * @param json a flag for generating the version of the new gltf but in the JSON format.
 * @param outputFolderPath the full path to the output folder to save the atlas and map files.
 * @param isGLTF a check for the existence of the gltf file.
 * @param gltfFilePath a full path to gltf file if it exists.
 * @param gltfFile the gltf file read in json format by fs.
 */
const modifyAndWriteGLTFFile = (atlas, json, outputFolderPath, isGLTF, gltfFilePath, gltfFile) => {
    if (isGLTF && gltfFile) {
        // Modify the gltf images to point to the local atlas file
        gltfFile.images = [
            { uri: path.join(path.basename(outputFolderPath), atlas) },
        ];
        // Modify the gltf textures to point to a single source for images, the atlas image.
        // Add (or change) names for textures.
        gltfFile.textures?.forEach((texture, index) => {
            texture.name = getTextureName(index);
            texture.source = 0;
        });
        //Create a new gltf file with the above modifications
        const dirPath = path.dirname(gltfFilePath || _dir);
        const newGltfFileName = "new" + path.basename(gltfFilePath || _dir);
        const newGltfPathFile = path.join(dirPath, newGltfFileName);
        fs.writeFileSync(newGltfPathFile, JSON.stringify(gltfFile, null, 2));
        debugFinal("GLTF File created successfully: ", newGltfFileName);
        if (json) {
            const newGltfJsonFileName = newGltfFileName.split(".")[0] + ".json";
            const newGltfJsonPathFile = path.join(dirPath, newGltfJsonFileName);
            fs.writeFileSync(newGltfJsonPathFile, JSON.stringify(gltfFile, null, 2));
            debugFinal("GLTF JSON File created successfully: ", newGltfJsonFileName);
        }
    }
};
// Run the command and catch errors if there are some.
createTextureAtlas(argv).catch(errorHandler);
