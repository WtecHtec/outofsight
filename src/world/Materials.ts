import * as THREE from 'three';

export interface MaterialLibrary {
  groundWarmGray: THREE.MeshStandardMaterial;
  roadAsphalt: THREE.MeshStandardMaterial;
  sidewalkPaver: THREE.MeshStandardMaterial;
  curbStone: THREE.MeshStandardMaterial;
  // Reference Image 2 Rowhouse Palette (Solid Flat-Shaded Stylized Low-Poly)
  rowhouseSlateBlue: THREE.MeshStandardMaterial;
  rowhouseMustardYellow: THREE.MeshStandardMaterial;
  rowhouseCoralOrange: THREE.MeshStandardMaterial;
  rowhouseTealGreen: THREE.MeshStandardMaterial;
  rowhouseRosePink: THREE.MeshStandardMaterial;
  rowhouseSkyShop: THREE.MeshStandardMaterial;
  rowhouseLavender: THREE.MeshStandardMaterial;
  rowhouseCorniceWhite: THREE.MeshStandardMaterial;
  rowhouseWindowRecessPurple: THREE.MeshStandardMaterial;
  rowhouseShopGlass: THREE.MeshStandardMaterial;
  rowhouseDoorWood: THREE.MeshStandardMaterial;
  potTerracotta: THREE.MeshStandardMaterial;
  benchSalmonWood: THREE.MeshStandardMaterial;
  benchStoneLeg: THREE.MeshStandardMaterial;
  hydrantRed: THREE.MeshStandardMaterial;
  sportsCarYellow: THREE.MeshStandardMaterial;
  // Legacy / Shared Compatibility Materials
  buildingCream: THREE.MeshStandardMaterial;
  buildingTerracotta: THREE.MeshStandardMaterial;
  buildingSlateBlue: THREE.MeshStandardMaterial;
  buildingBrickWarm: THREE.MeshStandardMaterial;
  buildingRoofDark: THREE.MeshStandardMaterial;
  awningRedWhite: THREE.MeshStandardMaterial;
  awningTealWhite: THREE.MeshStandardMaterial;
  awningAmberNavy: THREE.MeshStandardMaterial;
  shopWindowWarm: THREE.MeshStandardMaterial;
  foliageSakura: THREE.MeshStandardMaterial;
  foliageGreen: THREE.MeshStandardMaterial;
  foliageGinkgoGold: THREE.MeshStandardMaterial;
  foliageBushDark: THREE.MeshStandardMaterial;
  trunkWood: THREE.MeshStandardMaterial;
  crateWood: THREE.MeshStandardMaterial;
  metalFence: THREE.MeshStandardMaterial;
  brassGold: THREE.MeshStandardMaterial;
  patrolNavy: THREE.MeshStandardMaterial;
  patrolWhite: THREE.MeshStandardMaterial;
  vanBannerMat: THREE.MeshStandardMaterial;
  carGlass: THREE.MeshStandardMaterial;
  tireRubber: THREE.MeshStandardMaterial;
  wheelAlloy: THREE.MeshStandardMaterial;
  sirenRed: THREE.MeshStandardMaterial;
  sirenBlue: THREE.MeshStandardMaterial;
  headlightGlow: THREE.MeshBasicMaterial;
  brakelightGlow: THREE.MeshStandardMaterial;
  streetLampWarm: THREE.MeshBasicMaterial;
  // Reference Image 1 Faceted Chibi Character Materials
  lunaHairViolet: THREE.MeshStandardMaterial;
  lunaCyanArmor: THREE.MeshStandardMaterial;
  lunaCyanDark: THREE.MeshStandardMaterial;
  lunaPurpleSash: THREE.MeshStandardMaterial;
  lunaDiamondWhite: THREE.MeshStandardMaterial;
  playerJacket: THREE.MeshStandardMaterial;
  playerAccentOrange: THREE.MeshStandardMaterial;
  playerDarkPants: THREE.MeshStandardMaterial;
  skinTone: THREE.MeshStandardMaterial;
  officerNavy: THREE.MeshStandardMaterial;
  officerLightBlueShirt: THREE.MeshStandardMaterial;
  officerBadgeGold: THREE.MeshStandardMaterial;
  missionCyan: THREE.MeshStandardMaterial;
  extractionEmerald: THREE.MeshStandardMaterial;
  hidingLockerTeal: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  createSignMaterial: (
    title: string,
    subtitle: string,
    bgHex: string,
    accentHex: string
  ) => THREE.MeshStandardMaterial;
  dispose: () => void;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(38, 16, 68, 0.72)');
  grad.addColorStop(0.55, 'rgba(54, 24, 92, 0.34)');
  grad.addColorStop(1, 'rgba(54, 24, 92, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Reference Image 2 warm rose-lavender sidewalk stone tiles
function createSidewalkPaverTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9a7a99';
  ctx.fillRect(0, 0, 256, 256);

  const tileSize = 64;
  for (let y = 0; y < 256; y += tileSize) {
    for (let x = 0; x < 256; x += tileSize) {
      const shade = (x / tileSize + y / tileSize) % 2 === 0 ? '#a888a6' : '#9d7e9c';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createAwningStripeTexture(
  colorA: string,
  colorB: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const stripeW = 32;
  for (let x = 0; x < 256; x += stripeW) {
    ctx.fillStyle = (x / stripeW) % 2 === 0 ? colorA : colorB;
    ctx.fillRect(x, 0, stripeW, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createVanBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#172554';
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 116, 512, 12);

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#172554';
  ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('保', 64, 65);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 46px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('参保直通车', 116, 52);

  ctx.fillStyle = '#fde047';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('躲得越久 · 核定参保金额越高', 118, 94);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMaterialLibrary(renderer?: THREE.WebGLRenderer): MaterialLibrary {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  const shadowTex = createContactShadowTexture();
  const paverTex = createSidewalkPaverTexture(maxAniso);
  const awningRedTex = createAwningStripeTexture('#ea7b44', '#f1f5f9', maxAniso);
  const awningTealTex = createAwningStripeTexture('#4ea8de', '#f1f5f9', maxAniso);
  const awningAmberTex = createAwningStripeTexture('#e11d48', '#f1f5f9', maxAniso);
  const vanBannerTex = createVanBannerTexture(maxAniso);

  const dynamicTextures: THREE.Texture[] = [
    shadowTex,
    paverTex,
    awningRedTex,
    awningTealTex,
    awningAmberTex,
    vanBannerTex,
  ];
  const dynamicMaterials: THREE.Material[] = [];

  const signMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

  const createSignMaterial = (
    title: string,
    subtitle: string,
    bgHex: string,
    accentHex: string
  ): THREE.MeshStandardMaterial => {
    const cacheKey = `${title}|${subtitle}|${bgHex}|${accentHex}`;
    const cached = signMaterialCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 160);

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 492, 140);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 68);

    ctx.fillStyle = accentHex;
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, 256, 122);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    dynamicTextures.push(tex);

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.45,
      metalness: 0.08,
    });
    mat.userData = { ...mat.userData, isSharedMat: true };
    dynamicMaterials.push(mat);
    signMaterialCache.set(cacheKey, mat);
    return mat;
  };

  // Reference Image 2 Rowhouse Colors (Standard flat-shaded materials)
  const rowhouseSlateBlue = new THREE.MeshStandardMaterial({
    color: 0x7680a6,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });
  const rowhouseMustardYellow = new THREE.MeshStandardMaterial({
    color: 0xeeb056,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });
  const rowhouseCoralOrange = new THREE.MeshStandardMaterial({
    color: 0xef8b67,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });
  const rowhouseTealGreen = new THREE.MeshStandardMaterial({
    color: 0x3b7a75,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });
  const rowhouseRosePink = new THREE.MeshStandardMaterial({
    color: 0xf06575,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });
  const rowhouseSkyShop = new THREE.MeshStandardMaterial({
    color: 0x779bc2,
    roughness: 0.7,
    metalness: 0.06,
    flatShading: true,
  });
  const rowhouseLavender = new THREE.MeshStandardMaterial({
    color: 0x9183b8,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });

  const materials = {
    groundWarmGray: new THREE.MeshStandardMaterial({
      color: 0x5c426e,
      roughness: 0.9,
      metalness: 0.03,
    }),
    roadAsphalt: new THREE.MeshStandardMaterial({
      color: 0x674b78,
      roughness: 0.82,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    sidewalkPaver: new THREE.MeshStandardMaterial({
      map: paverTex,
      roughness: 0.82,
      metalness: 0.04,
    }),
    curbStone: new THREE.MeshStandardMaterial({
      color: 0xb59bb5,
      roughness: 0.76,
      metalness: 0.04,
      flatShading: true,
    }),
    rowhouseSlateBlue,
    rowhouseMustardYellow,
    rowhouseCoralOrange,
    rowhouseTealGreen,
    rowhouseRosePink,
    rowhouseSkyShop,
    rowhouseLavender,
    rowhouseCorniceWhite: new THREE.MeshStandardMaterial({
      color: 0xe6e4f0,
      roughness: 0.65,
      metalness: 0.05,
      flatShading: true,
    }),
    rowhouseWindowRecessPurple: new THREE.MeshStandardMaterial({
      color: 0x452259,
      roughness: 0.35,
      metalness: 0.15,
      flatShading: true,
    }),
    rowhouseShopGlass: new THREE.MeshStandardMaterial({
      color: 0xa58fb8,
      roughness: 0.25,
      metalness: 0.2,
      flatShading: true,
    }),
    rowhouseDoorWood: new THREE.MeshStandardMaterial({
      color: 0x9e8279,
      roughness: 0.75,
      metalness: 0.06,
      flatShading: true,
    }),
    potTerracotta: new THREE.MeshStandardMaterial({
      color: 0xd97338,
      roughness: 0.68,
      metalness: 0.04,
      flatShading: true,
    }),
    benchSalmonWood: new THREE.MeshStandardMaterial({
      color: 0xe88e61,
      roughness: 0.64,
      metalness: 0.04,
      flatShading: true,
    }),
    benchStoneLeg: new THREE.MeshStandardMaterial({
      color: 0xa699ad,
      roughness: 0.78,
      metalness: 0.05,
      flatShading: true,
    }),
    hydrantRed: new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.45,
      metalness: 0.15,
      flatShading: true,
    }),
    sportsCarYellow: new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.38,
      metalness: 0.1,
      flatShading: true,
    }),
    buildingCream: rowhouseMustardYellow,
    buildingTerracotta: rowhouseCoralOrange,
    buildingSlateBlue: rowhouseSlateBlue,
    buildingBrickWarm: rowhouseRosePink,
    buildingRoofDark: new THREE.MeshStandardMaterial({
      color: 0x3b2754,
      roughness: 0.68,
      metalness: 0.12,
      flatShading: true,
    }),
    awningRedWhite: new THREE.MeshStandardMaterial({
      map: awningRedTex,
      roughness: 0.65,
      metalness: 0.04,
      flatShading: true,
    }),
    awningTealWhite: new THREE.MeshStandardMaterial({
      map: awningTealTex,
      roughness: 0.65,
      metalness: 0.04,
      flatShading: true,
    }),
    awningAmberNavy: new THREE.MeshStandardMaterial({
      map: awningAmberTex,
      roughness: 0.65,
      metalness: 0.04,
      flatShading: true,
    }),
    shopWindowWarm: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      flatShading: true,
    }),
    foliageSakura: new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.75,
      metalness: 0.02,
      flatShading: true,
    }),
    foliageGreen: new THREE.MeshStandardMaterial({
      color: 0x3fa368,
      roughness: 0.68,
      metalness: 0.04,
      flatShading: true,
    }),
    foliageGinkgoGold: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.72,
      metalness: 0.02,
      flatShading: true,
    }),
    foliageBushDark: new THREE.MeshStandardMaterial({
      color: 0x2c7d4d,
      roughness: 0.74,
      metalness: 0.03,
      flatShading: true,
    }),
    trunkWood: new THREE.MeshStandardMaterial({
      color: 0x7c4d34,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
    }),
    crateWood: new THREE.MeshStandardMaterial({
      color: 0xc27d48,
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true,
    }),
    metalFence: new THREE.MeshStandardMaterial({
      color: 0x4c3a69,
      roughness: 0.45,
      metalness: 0.45,
      flatShading: true,
    }),
    brassGold: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.6,
      flatShading: true,
    }),
    patrolNavy: new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.4,
      metalness: 0.2,
      flatShading: true,
    }),
    patrolWhite: new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.42,
      metalness: 0.08,
      flatShading: true,
    }),
    vanBannerMat: new THREE.MeshStandardMaterial({
      map: vanBannerTex,
      roughness: 0.4,
      metalness: 0.08,
    }),
    carGlass: new THREE.MeshStandardMaterial({
      color: 0x58367a,
      roughness: 0.25,
      metalness: 0.15,
      flatShading: true,
    }),
    tireRubber: new THREE.MeshStandardMaterial({
      color: 0x231934,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    }),
    wheelAlloy: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.5,
      flatShading: true,
    }),
    sirenRed: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      flatShading: true,
    }),
    sirenBlue: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      flatShading: true,
    }),
    headlightGlow: new THREE.MeshBasicMaterial({
      color: 0xfef08a,
    }),
    brakelightGlow: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      flatShading: true,
    }),
    streetLampWarm: new THREE.MeshBasicMaterial({
      color: 0xfde047,
    }),
    // Reference Image 1 Character Materials (Faceted Low-Poly Chibi)
    lunaHairViolet: new THREE.MeshStandardMaterial({
      color: 0x5244d4,
      roughness: 0.48,
      metalness: 0.08,
      flatShading: true,
    }),
    lunaCyanArmor: new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      roughness: 0.42,
      metalness: 0.1,
      flatShading: true,
    }),
    lunaCyanDark: new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      roughness: 0.48,
      metalness: 0.1,
      flatShading: true,
    }),
    lunaPurpleSash: new THREE.MeshStandardMaterial({
      color: 0x5b3fd1,
      roughness: 0.52,
      metalness: 0.06,
      flatShading: true,
    }),
    lunaDiamondWhite: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0e7ff,
      emissiveIntensity: 0.25,
      roughness: 0.28,
      metalness: 0.12,
      flatShading: true,
    }),
    playerJacket: new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.52,
      metalness: 0.08,
      flatShading: true,
    }),
    playerAccentOrange: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.46,
      metalness: 0.1,
      flatShading: true,
    }),
    playerDarkPants: new THREE.MeshStandardMaterial({
      color: 0x271e40,
      roughness: 0.68,
      metalness: 0.05,
      flatShading: true,
    }),
    skinTone: new THREE.MeshStandardMaterial({
      color: 0xf0a684,
      roughness: 0.55,
      metalness: 0.02,
      flatShading: true,
    }),
    officerNavy: new THREE.MeshStandardMaterial({
      color: 0x1e295e,
      roughness: 0.52,
      metalness: 0.12,
      flatShading: true,
    }),
    officerLightBlueShirt: new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.55,
      metalness: 0.08,
      flatShading: true,
    }),
    officerBadgeGold: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.3,
      metalness: 0.65,
      flatShading: true,
    }),
    missionCyan: new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.65,
      roughness: 0.28,
      metalness: 0.3,
      flatShading: true,
    }),
    extractionEmerald: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.3,
      flatShading: true,
    }),
    hidingLockerTeal: new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.48,
      metalness: 0.25,
      flatShading: true,
    }),
    contactShadowMat: new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  };

  Object.values(materials).forEach((m) => {
    if (m instanceof THREE.Material) {
      m.userData = { ...m.userData, isSharedMat: true };
    }
  });

  return {
    ...materials,
    createSignMaterial,
    dispose: () => {
      dynamicTextures.forEach((t) => t.dispose());
      dynamicMaterials.forEach((m) => m.dispose());
      Object.values(materials).forEach((m) => {
        if (m instanceof THREE.Material) {
          m.dispose();
        }
      });
    },
  };
}
