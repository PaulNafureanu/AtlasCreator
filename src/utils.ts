import fs from "node:fs";
import path from "node:path";

// Check, create and save the full paths to the needed resources.
export function getPathsFromArgv(
  _dir: string,
  input: string,
  output: string,
  gltf?: string
): {
  textureFolderPath: string;
  outputFolderPath: string;
  gltfFilePath?: string;
} {
  // Define the paths to return:
  let textureFolderPath: string;
  let outputFolderPath: string;
  let gltfFilePath: string | undefined = undefined;

  // Check the input folder for textures and save the full path to the folder.

  if (input) {
    if (fs.existsSync(input)) {
      if (input.indexOf(":") >= 0) textureFolderPath = input;
      else textureFolderPath = path.join(_dir, input);
    } else {
      throw new Error(`Could not find directory '${input}'.`);
    }
  } else textureFolderPath = _dir;

  // Check the existence of the output folder, otherwise create it and save its full path.
  if (output) {
    if (fs.existsSync(output)) {
      if (output.indexOf(":") >= 0) outputFolderPath = output;
      else outputFolderPath = path.join(_dir, output);
    } else {
      if (output.indexOf(":") >= 0) {
        fs.mkdirSync(output);
        outputFolderPath = output;
      } else {
        outputFolderPath = path.join(_dir, output);
        fs.mkdirSync(outputFolderPath);
      }
    }
  } else outputFolderPath = input ? textureFolderPath : _dir;

  // If the gltf flag is set, check the existence of the file and save its full path
  if (gltf) {
    if (fs.existsSync(gltf)) {
      if (gltf.indexOf(":") >= 0) gltfFilePath = gltf;
      else gltfFilePath = path.join(_dir, gltf);
    } else {
      throw new Error(`Could not find the file '${gltf}'.`);
    }
  }

  return { textureFolderPath, outputFolderPath, gltfFilePath };
}

// Detect and convert the resize string into a useful number
export function getResize(resize: string): {
  percentage: number;
  pixels: number;
  usePercentage: boolean;
} {
  // Set defaults
  let percentage: number | undefined = 1;
  let pixels: number | undefined = 1024;
  let usePercentage = resize.indexOf("%") >= 0;

  // Check for either percentages or pixels and update the proper one.
  if (usePercentage) percentage = Number(resize.split("%")[0]) / 100;
  else pixels = Number(resize.split("px")[0]);

  return { percentage, pixels, usePercentage };
}

export function findIndexesOfMaterials(obj: any, indexes: number[]) {
  for (const key in obj) {
    if (key === "index") indexes.push(obj[key]);
    else if (typeof obj[key] === "object") {
      findIndexesOfMaterials(obj[key], indexes);
    }
  }
  return indexes;
}

export function getTextureName(textureId: number) {
  return `Texture${textureId || 0}`;
}

export function getDefaultMaterialName(materialId: number) {
  return `_Mat${materialId || 0}`;
}
