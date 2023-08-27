#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Jimp from "jimp";
import potpack from "potpack";
import debugFactory from "debug";
import argv from "./command.js";
import type { AtlasOptions } from "./command.js";
import errorHandler from "./errorhandler.js";
import { getPathsFromArgv, getResize } from "./utils.js";

interface TextureData {
  data: Buffer;
  name: string;
  w: number;
  h: number;
  x?: number;
  y?: number;
}

type MapData = MapDataInstance[];
type MapDataInstance = {
  name: string;
  offset: [number, number];
  repeat: [number, number];
  pos: [number, number];
  scale: [number, number];
};

interface GLTFFile {
  extensionsUsed?: string[];
  images: { uri: string }[];
  materials: { extensions?: any }[];
  textures: { source: number }[];
}

// Creating debug functions for various namespaces
const debugPaths = debugFactory("paths");
const debugRawTextures = debugFactory("default:Texture");
const debugTextureAtlas = debugFactory("default:Atlas");
const debugDataMap = debugFactory("default:DataMap");
const debugFinal = debugFactory("default:Final");

// Get the current director where the process is running
const _dir = process.cwd();

// A function to create a texture atlas with map, as well as to modify a gltf file.
const createTextureAtlas = async ({
  input,
  output,
  atlas,
  map,
  resize,
  gltf,
  json,
  debug,
}: AtlasOptions) => {
  //Set debuggers
  debugFactory.enable(`default:*,${debug}`);

  // Check, create and save the full paths to the needed resources.
  const { textureFolderPath, outputFolderPath, gltfFilePath } =
    getPathsFromArgv(_dir, input, output, gltf);

  debugPaths("Texture folder full path: ", textureFolderPath);
  debugPaths("Output folder full path: ", outputFolderPath);
  debugPaths("Gltf file full path: ", gltfFilePath);
  debugPaths("Current directory full path: ", _dir);

  // Read raw texture files and store their data into the texture data array
  const rawTextureFiles = fs.readdirSync(textureFolderPath);
  const textureDataListOptions = { resize, textureFolderPath };
  const textureDataList = await getTextureDataList(
    rawTextureFiles,
    textureDataListOptions
  );

  // Sort the dimensions of the textures and define the texture atlas dimensions.
  const { w: atlasWidth, h: atlasHeight } = potpack(textureDataList);
  const rawTextureAtlas = new Jimp(atlasWidth, atlasHeight);
  debugTextureAtlas("Atlas Width (pixels): ", atlasWidth);
  debugTextureAtlas("Atlas Height (pixels): ", atlasHeight);

  // Check if the gltf exists, prepares it and returns its data or empty objects
  const { gltfFile, gltfPrepData, isGLTF } = getGLTFData(gltfFilePath);

  // Create the texture atlas and the map data
  const { textureAtlas, mapData } = getMapAtlasData(textureDataList, {
    rawTextureAtlas,
    atlasWidth,
    atlasHeight,
    isGLTF,
    gltfPrepData,
  });

  // Modify and write the new gltf file
  modifyAndWriteGLTFFile(
    atlas,
    json,
    outputFolderPath,
    isGLTF,
    gltfFilePath,
    gltfFile
  );

  //Write the atlas and the map data files
  const textureAtlasPath = path.join(outputFolderPath, atlas);
  await textureAtlas.writeAsync(textureAtlasPath);
  const mapDataPath = path.join(outputFolderPath, map);
  fs.writeFileSync(mapDataPath, JSON.stringify(mapData, null, 2));
  debugFinal("Texture Atlas and Map created successfully.");
};

// Read raw texture files from the texture folder and return their formatted data as an array
const getTextureDataList = async (
  rawTextureFiles: string[],
  { resize, textureFolderPath }: { resize: string; textureFolderPath: string }
) => {
  const rawTextureListLen = rawTextureFiles.length;
  if (rawTextureListLen === 0)
    throw new Error("No texture images found in the texture folder.");

  const textureDataList: TextureData[] = [];
  let rawTextureIndex = 1;

  // Get the resize factor from resize string
  const { pixels, percentage, usePercentage } = getResize(resize);

  for (const rawTextureFile of rawTextureFiles) {
    // Get texture
    const textureFilePath = path.join(textureFolderPath, rawTextureFile);
    const texture = await Jimp.read(textureFilePath);

    // Resize texture
    if (usePercentage) texture.scale(percentage);
    else texture.resize(pixels, Jimp.AUTO);

    // Add texture to the array
    textureDataList.push({
      w: texture.bitmap.width,
      h: texture.bitmap.height,
      data: texture.bitmap.data,
      name: rawTextureFile,
    });

    // Set the debug message
    const progress = `${rawTextureIndex} / ${rawTextureListLen}`;
    const debugMsg = `Texture read: `;
    debugRawTextures([progress], debugMsg, rawTextureFile);
    rawTextureIndex++;
  }

  return textureDataList;
};

// Get the gltf file and prep data in a json format
const getGLTFData = (
  gltfFilePath?: string
): { gltfFile?: GLTFFile; gltfPrepData: string[]; isGLTF: boolean } => {
  let gltfFile: GLTFFile | undefined = undefined;
  let gltfPrepData: string[] = [];
  let isGLTF = false;

  if (gltfFilePath) {
    // Get the gltf file in a json format
    gltfFile = JSON.parse(fs.readFileSync(gltfFilePath, "utf-8")) as GLTFFile;

    // Get some prep data needed for the parsing of the gltf json file
    gltfFile.images.forEach(({ uri }) => {
      // Get the name of the texture images linked in the gltf file and map them with the same index
      gltfPrepData.push(path.basename(uri).split(".")[0]);
    });

    isGLTF = Object.keys(gltfFile).length > 0 && gltfPrepData.length > 0;
  }

  return { gltfFile, gltfPrepData, isGLTF };
};

const getMapAtlasData = (
  textureDataList: TextureData[],
  {
    rawTextureAtlas,
    atlasWidth,
    atlasHeight,
    isGLTF,
    gltfPrepData,
  }: {
    rawTextureAtlas: Jimp;
    atlasWidth: number;
    atlasHeight: number;
    isGLTF: boolean;
    gltfPrepData: string[];
  }
): { textureAtlas: Jimp; mapData: MapData } => {
  let mapData: MapData = [];
  const textureDataLen = textureDataList.length;
  let textureIndex = 1;

  textureDataList.forEach(({ x = 0, y = 0, w, h }, index) => {
    // Read a texture data, create a empty texture and insert the data into the texture atlas
    const { data, name } = textureDataList[index];
    const texture = new Jimp(w, h);
    texture.bitmap.data = data;
    rawTextureAtlas.blit(texture, x, y);

    // Defines an instance of the map data based on the texture
    const textureMapData: MapDataInstance = {
      name: name,
      offset: [x / atlasWidth, y / atlasHeight],
      repeat: [w / atlasWidth, h / atlasHeight],
      pos: [x, y],
      scale: [w, h],
    };

    //Defines where the texture map data instance is placed in the map data array
    if (isGLTF) {
      const searchFunction = (v: string) => name.split(".")[0] === v;
      const indexImageFile = gltfPrepData.findIndex(searchFunction);
      if (indexImageFile >= 0) mapData[indexImageFile] = textureMapData;
    } else mapData.push(textureMapData);

    // Indicate the progress of the map data
    const progress = Math.round((textureIndex * 100) / textureDataLen);
    const indicatorMsg = `Map data added: `;
    debugDataMap([progress], indicatorMsg, name);
    textureIndex++;
  });

  return { textureAtlas: rawTextureAtlas, mapData };
};

const modifyAndWriteGLTFFile = (
  atlas: string,
  json: boolean,
  outputFolderPath: string,
  isGLTF: boolean,
  gltfFilePath?: string,
  gltfFile?: GLTFFile
) => {
  if (isGLTF && gltfFile) {
    // Modify the gltf images to point to the local atlas file
    gltfFile.images = [
      { uri: path.join(path.basename(outputFolderPath), atlas) },
    ];

    // Modify the gltf textures to point to a single source for images, that is the atlas image
    gltfFile.textures.forEach((texture) => (texture.source = 0));

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
      debugFinal("GLTF Json File created successfully: ", newGltfJsonFileName);
    }
  }
};

// Run the command and catch errors if there are some.
createTextureAtlas(argv).catch(errorHandler);
