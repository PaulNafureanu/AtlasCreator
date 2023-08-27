import _yargs from "yargs";
import { hideBin } from "yargs/helpers";

export interface AtlasOptions {
  input: string;
  output: string;
  atlas: string;
  map: string;
  resize: string;
  gltf: string;
  json: boolean;
  debug: string;
}

// Parse the arg of the process
const yargs = _yargs(hideBin(process.argv));

// Define the options of the command
const argv = yargs
  .wrap(null)
  .scriptName("atlas")
  .usage("Usage: $0 [options]")
  .option("input", {
    alias: "i",
    type: "string",
    demandOption: false,
    description:
      "Set the input directory name or the full path containing textures to be processed.",
  })
  .option("output", {
    alias: "o",
    type: "string",
    demandOption: false,
    description:
      "Set the output directory or the full path that will contain the atlas and the map files.",
  })
  .option("atlas", {
    alias: "a",
    type: "string",
    default: "atlas.png",
    demandOption: false,
    description:
      "Set the name and the extension [bmp, gif, jpeg, png, tiff] of the atlas file.",
  })
  .option("map", {
    alias: "m",
    type: "string",
    default: "map.json",
    demandOption: false,
    description: "Set the name and the extension [json] of the map file.",
  })
  .option("resize", {
    alias: "r",
    type: "string",
    default: "100%",
    demandOption: false,
    description:
      "Set the default resize of textures to a power of two number or percentage.",
  })
  .option("gltf", {
    alias: "g",
    type: "string",
    demandOption: false,
    description:
      "Set the default path to or the name in the current directory of the entry gltf file.",
  })
  .option("json", {
    alias: "j",
    type: "boolean",
    default: false,
    demandOption: false,
    description:
      "Set the flag to create a new json file from the new gltf file created.",
  })
  .option("debug", {
    alias: "d",
    type: "string",
    demandOption: false,
    description:
      "Set a list of debugger namespaces to see debug messages for specific namespaces",
  })
  .help().argv;

export default argv as AtlasOptions;
