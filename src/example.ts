// Use or import from the three js / api library the following:
let fetch: any;
let scene: any;
let gltfLoader: any;
let RepeatWrapping: any;

// Make the key to type from the map's texture types
const keyToType = {
  map: "baseColorTexture",
  roughnessMap: "metallicRoughnessTexture",
  metalnessMap: "metallicRoughnessTexture",
  normalMap: "normalTexture",
  aoMap: "occlusionTexture",
  clearcoatMap: "clearcoatTexture",
  clearcoatRoughnessMap: "clearcoatRoughnessTexture",
  clearcoatNormalMap: "clearcoatNormalTexture",
};

// Load map.json from url (public folder)
const mapFile = await fetch("/models/model/output/map.json");
const map = await mapFile.json();

/**
 * An example function on how to update textures of a 3d model in three js
 */
const example = async () => {
  //Load the gltf scene with the model
  gltfLoader.load("/models/model/newscene.gltf", (gltf: any) => {
    const model = gltf.scene;

    // Traverse the model and for each material's mesh(node), add textures to that material
    model.traverse((node: any) => {
      const child = node;
      if (child.isMesh) {
        if (isArrayOfMaterials(child.material))
          child.material.forEach((mat: Material) => AddTexturesToMaterial(mat));
        else AddTexturesToMaterial(child.material);
      }
    });

    //Add model to the scene
    scene.add(model);
  });
};

// Check if an object is a material object or an array of material objects
type Material = { isMaterial: boolean };
const isArrayOfMaterials = (mat: Material | Material[]): mat is Material[] => {
  return Array.isArray(mat) && mat.every((m) => m.isMaterial);
};

// Add textures to the material
const AddTexturesToMaterial = (material: any) => {
  for (const key in material) {
    //If the key is a texture map, create a new texture and swap it
    if (
      material[key] &&
      typeof material[key] === "object" &&
      key.toLocaleLowerCase().includes("map")
    ) {
      const texture = material[key];
      const newTextureCoord = getTextureCoord(material.name, key);
      if (texture.isTexture && newTextureCoord) {
        const newTexture = texture.clone();
        newTexture.wrapS = RepeatWrapping;
        newTexture.wrapT = RepeatWrapping;
        const { repeat, offset } = newTextureCoord;
        newTexture.offset.set(offset[0], offset[1]);
        newTexture.repeat.set(repeat[0], repeat[1]);
        newTexture.needsUpdate = true;
        material[key] = newTexture;
      }
    }
  }
  material.needsUpdate = true;
};

// Get the texture information from the map.json file / map object
const getTextureCoord = (
  materialName: keyof (typeof map)["materials"],
  textureKey: string
) => {
  const material = map["materials"][materialName];
  const key = textureKey as keyof typeof keyToType;
  if ("texturesUsed" in material) {
    let textureName = material.texturesUsed.find(
      (texture: any) => texture.type === keyToType[key]
    )?.name as keyof (typeof map)["textures"];
    if (!textureName)
      textureName = material.texturesUsed[0]
        .name as keyof (typeof map)["textures"];
    if (textureName) return map["textures"][textureName];
  }
};
