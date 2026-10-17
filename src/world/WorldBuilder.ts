import * as THREE from 'three';
import {
  EXTRACTION_POINT,
  MAP_ZONES,
  MISSION_ITEMS,
  MissionItemSpec,
  PLAYER_START,
  STAGE_CONFIGS,
  StageId,
  STREET_SNACKS,
  STREET_THROWABLES,
  StreetSnackSpec,
  StreetThrowableSpec,
} from '../core/Config';
import { MaterialLibrary } from './Materials';
import {
  createBeachCabanaHidingModel,
  createCafeParasolSet,
  createCoastalBuildingMesh,
  createCountryFenceAndBarrelsProp,
  createCountryShedHidingModel,
  createCountrysideCottageMesh,
  createFireHydrantProp,
  createHaystackBushProp,
  createHidingLockerModel,
  createLighthouseLandmark,
  createMissionItemMesh,
  createPalmTreeProp,
  createPottedTopiaryProp,
  createRowhouseSegmentMesh,
  createStaticCivilianCar,
  createStreetBenchProp,
  createStreetLampModel,
  createStreetSnackMesh,
  createStreetThrowableMesh,
  createWindmillLandmark,
} from './ProceduralModels';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  blocksVision: boolean;
}

export interface HidingSpot {
  id: string;
  name: string;
  label: string;
  position: THREE.Vector3;
  hidePosition: THREE.Vector3;
  exitPosition: THREE.Vector3;
  mesh: THREE.Object3D;
  used?: boolean;
}

export interface BushZone {
  position: THREE.Vector3;
  radius: number;
}

export interface MissionObject {
  spec: MissionItemSpec;
  mesh: THREE.Group;
  collected: boolean;
}

export interface SnackObject {
  spec: StreetSnackSpec;
  mesh: THREE.Group;
  respawnTimer: number;
}

export interface ThrowableObject {
  spec: StreetThrowableSpec;
  mesh: THREE.Group;
  respawnTimer: number;
}

export interface WorldData {
  worldRootGroup: THREE.Group;
  stageId: StageId;
  colliders: ColliderBox[];
  occluderMeshes: THREE.Object3D[];
  hidingSpots: HidingSpot[];
  bushZones: BushZone[];
  missionObjects: MissionObject[];
  snackObjects: SnackObject[];
  throwableObjects: ThrowableObject[];
  extractionRing: THREE.Mesh;
  extractionBeacon: THREE.Group;
  searchPoints: THREE.Vector3[];
  windmillRotor?: THREE.Object3D | null;
  oceanWaveMesh?: THREE.Mesh | null;
}

/**
 * Checks whether a candidate (x, z) point on the ground is completely free of
 * buildings, parked cars, benches, cafe parasols, hiding booths, topiary pots,
 * snacks, throwables, player spawn, and extraction beacon.
 */
export function isSpawnPositionClear(
  x: number,
  z: number,
  colliders: ColliderBox[],
  bushZones: BushZone[],
  snackObjects: SnackObject[],
  throwableObjects: ThrowableObject[],
  placedPositions: [number, number][],
  buildingPadding = 2.35
): boolean {
  if (x < -42 || x > 44 || z < -36 || z > 34) {
    return false;
  }

  if (Math.hypot(x - PLAYER_START.position[0], z - PLAYER_START.position[2]) < 13.0) {
    return false;
  }

  if (
    Math.hypot(x - EXTRACTION_POINT.position[0], z - EXTRACTION_POINT.position[2]) <
    EXTRACTION_POINT.radius + 6.5
  ) {
    return false;
  }

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (
      x + buildingPadding > c.minX &&
      x - buildingPadding < c.maxX &&
      z + buildingPadding > c.minZ &&
      z - buildingPadding < c.maxZ
    ) {
      return false;
    }
  }

  for (let i = 0; i < bushZones.length; i++) {
    const b = bushZones[i];
    if (Math.hypot(x - b.position.x, z - b.position.z) < b.radius + 1.35) {
      return false;
    }
  }

  for (let i = 0; i < snackObjects.length; i++) {
    const s = snackObjects[i];
    if (Math.hypot(x - s.mesh.position.x, z - s.mesh.position.z) < 2.1) {
      return false;
    }
  }

  for (let i = 0; i < throwableObjects.length; i++) {
    const t = throwableObjects[i];
    if (Math.hypot(x - t.mesh.position.x, z - t.mesh.position.z) < 2.1) {
      return false;
    }
  }

  for (let i = 0; i < placedPositions.length; i++) {
    const [px, pz] = placedPositions[i];
    if (Math.hypot(x - px, z - pz) < 22.0) {
      return false;
    }
  }

  return true;
}

function resolveZoneNameForCoord(x: number, z: number, stageId: StageId): string {
  if (stageId === 'stage_2') {
    if (z < -15) return x < 0 ? '北湾·海景别墅街' : '东北·红白灯塔海岬';
    if (z > 15) return x < 0 ? '南岸·椰林冲浪滩' : '东南·海滨木栈道';
    return '蔚蓝海岸椰风大道';
  }
  if (stageId === 'stage_3') {
    if (z < -15) return x < 0 ? '北坡·木梁农舍村' : '东北·大风车麦田广场';
    if (z > 15) return x < 0 ? '南村·干草垛谷仓街' : '东南·农家果园集市';
    return '田园牧歌古镇主街';
  }
  for (const zone of MAP_ZONES) {
    if (
      x >= zone.bounds.minX &&
      x <= zone.bounds.maxX &&
      z >= zone.bounds.minZ &&
      z <= zone.bounds.maxZ
    ) {
      return zone.name;
    }
  }
  return '彩色联排商业大道';
}

/**
 * Randomly relocates all 3 Mission Objects across distinct map sectors while
 * strictly guaranteeing they never clip into buildings, cars, or street props.
 */
export function randomizeMissionObjects(world: WorldData): void {
  const sectorPools: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    anchors: [number, number][];
  }[] = [
    {
      minX: -39,
      maxX: -6,
      minZ: -33,
      maxZ: -10,
      anchors: [
        [-34, -27],
        [-22, -28],
        [-10, -27],
        [-27, -11],
        [-14, -11],
      ],
    },
    {
      minX: 4,
      maxX: 36,
      minZ: -33,
      maxZ: -10,
      anchors: [
        [8, -28],
        [20, -28],
        [32, -28],
        [12, -11],
        [28, -11],
      ],
    },
    {
      minX: -38,
      maxX: -6,
      minZ: 10,
      maxZ: 31,
      anchors: [
        [-32, 27],
        [-18, 27],
        [-8, 27],
        [-26, 11],
        [-12, 11],
      ],
    },
    {
      minX: 4,
      maxX: 35,
      minZ: 10,
      maxZ: 31,
      anchors: [
        [8, 27],
        [22, 27],
        [32, 27],
        [14, 11],
        [27, 11],
      ],
    },
    {
      minX: -28,
      maxX: 34,
      minZ: -9,
      maxZ: 9,
      anchors: [
        [-12, -3.5],
        [6, 3.8],
        [26, -3.8],
        [-4, -8.5],
        [16, 8.5],
      ],
    },
  ];

  for (let i = sectorPools.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = sectorPools[i];
    sectorPools[i] = sectorPools[j];
    sectorPools[j] = tmp;
  }

  const placedPositions: [number, number][] = [];

  world.missionObjects.forEach((mObj, idx) => {
    const sector = sectorPools[idx % sectorPools.length];
    let chosenX = mObj.spec.position[0];
    let chosenZ = mObj.spec.position[2];
    let found = false;

    const shuffledAnchors = [...sector.anchors].sort(() => Math.random() - 0.5);
    for (const [ax, az] of shuffledAnchors) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const rx = Number((ax + (Math.random() - 0.5) * 6.5).toFixed(2));
        const rz = Number((az + (Math.random() - 0.5) * 4.5).toFixed(2));
        if (
          isSpawnPositionClear(
            rx,
            rz,
            world.colliders,
            world.bushZones,
            world.snackObjects,
            world.throwableObjects,
            placedPositions
          )
        ) {
          chosenX = rx;
          chosenZ = rz;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const rx = Number(
          (sector.minX + Math.random() * (sector.maxX - sector.minX)).toFixed(2)
        );
        const rz = Number(
          (sector.minZ + Math.random() * (sector.maxZ - sector.minZ)).toFixed(2)
        );
        if (
          isSpawnPositionClear(
            rx,
            rz,
            world.colliders,
            world.bushZones,
            world.snackObjects,
            world.throwableObjects,
            placedPositions
          )
        ) {
          chosenX = rx;
          chosenZ = rz;
          found = true;
          break;
        }
      }
    }

    if (!found && world.searchPoints.length > 0) {
      const shuffledPts = [...world.searchPoints].sort(() => Math.random() - 0.5);
      for (const pt of shuffledPts) {
        if (
          isSpawnPositionClear(
            pt.x,
            pt.z,
            world.colliders,
            world.bushZones,
            world.snackObjects,
            world.throwableObjects,
            placedPositions,
            1.8
          )
        ) {
          chosenX = pt.x;
          chosenZ = pt.z;
          break;
        }
      }
    }

    placedPositions.push([chosenX, chosenZ]);
    mObj.spec.position = [chosenX, 0, chosenZ];
    mObj.spec.zoneName = resolveZoneNameForCoord(chosenX, chosenZ, world.stageId);
    mObj.mesh.position.set(chosenX, 0, chosenZ);
    mObj.collected = false;
    mObj.mesh.visible = true;
  });
}

export function buildGameWorld(
  scene: THREE.Scene,
  mats: MaterialLibrary,
  stageId: StageId = 'stage_1'
): WorldData {
  const worldRootGroup = new THREE.Group();
  worldRootGroup.name = `WorldRoot_${stageId}`;
  scene.add(worldRootGroup);

  const stageTheme = STAGE_CONFIGS[stageId]?.sceneTheme || 'urban_rowhouse';

  const colliders: ColliderBox[] = [];
  const occluderMeshes: THREE.Object3D[] = [];
  const hidingSpots: HidingSpot[] = [];
  const bushZones: BushZone[] = [];
  const missionObjects: MissionObject[] = [];
  const snackObjects: SnackObject[] = [];
  const throwableObjects: ThrowableObject[] = [];
  const searchPoints: THREE.Vector3[] = [];
  let windmillRotor: THREE.Object3D | null = null;
  let oceanWaveMesh: THREE.Mesh | null = null;

  // ============================================================================
  // 1. STAGE-SPECIFIC TERRAIN, OCEAN / MEADOW & SIDEWALK PAVERS
  // ============================================================================
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    mats.groundWarmGray
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.06;
  outerGround.receiveShadow = true;
  worldRootGroup.add(outerGround);

  // Stage-specific Plaza / Sidewalk surface material
  const plazaMat =
    stageTheme === 'coastal_seaside'
      ? new THREE.MeshStandardMaterial({
          color: 0xfde68a, // Golden sandy beach & coastal promenade
          roughness: 0.85,
          flatShading: true,
        })
      : stageTheme === 'countryside_village'
      ? new THREE.MeshStandardMaterial({
          color: 0x65a30d, // Lush countryside pasture grass
          roughness: 0.88,
          flatShading: true,
        })
      : mats.sidewalkPaver;

  const citySidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(148, 114),
    plazaMat
  );
  citySidewalk.rotation.x = -Math.PI / 2;
  citySidewalk.position.y = 0.0;
  citySidewalk.receiveShadow = true;
  worldRootGroup.add(citySidewalk);

  // If Stage 2 (Coastal Seaside Town): Add sparkling Turquoise Ocean Seafront on South & North horizons!
  if (stageTheme === 'coastal_seaside') {
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.22,
      metalness: 0.15,
      emissive: new THREE.Color(0x0369a1),
      emissiveIntensity: 0.25,
      flatShading: true,
    });
    oceanWaveMesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 110), seaMat);
    oceanWaveMesh.rotation.x = -Math.PI / 2;
    oceanWaveMesh.position.set(0, -0.02, -104);
    worldRootGroup.add(oceanWaveMesh);

    const southSea = new THREE.Mesh(new THREE.PlaneGeometry(360, 110), seaMat);
    southSea.rotation.x = -Math.PI / 2;
    southSea.position.set(0, -0.02, 104);
    worldRootGroup.add(southSea);

    // White seafoam shoreline strips
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.75,
    });
    [-49.5, 49.5].forEach((fz) => {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(220, 2.2), foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(0, 0.015, fz);
      worldRootGroup.add(foam);
    });
  }

  // ============================================================================
  // 2. FULL-MAP GRAND LOOP ROADS (Urban Asphalt / Coastal Boardwalk / Country Dirt Lane)
  // ============================================================================
  const dashWhiteMat = new THREE.MeshBasicMaterial({
    color: stageTheme === 'countryside_village' ? 0xd6d3d1 : 0xf8fafc,
  });
  const lineYellowMat = new THREE.MeshBasicMaterial({
    color: stageTheme === 'coastal_seaside' ? 0x38bdf8 : 0xeab308,
  });

  const addRoadSegment = (
    x: number,
    z: number,
    w: number,
    d: number,
    isHorizontal: boolean
  ) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.roadAsphalt);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, z);
    road.receiveShadow = true;
    worldRootGroup.add(road);

    if (isHorizontal) {
      [-1, 1].forEach((side) => {
        const edgeZ = z + side * (d / 2 - 0.85);
        const yellowLine = new THREE.Mesh(
          new THREE.PlaneGeometry(w, 0.18),
          lineYellowMat
        );
        yellowLine.rotation.x = -Math.PI / 2;
        yellowLine.position.set(x, 0.032, edgeZ);
        worldRootGroup.add(yellowLine);

        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(w, 0.18, 0.5),
          mats.curbStone
        );
        curb.position.set(x, 0.09, z + side * (d / 2 + 0.25));
        curb.receiveShadow = true;
        worldRootGroup.add(curb);
      });

      const count = Math.floor(w / 5.2);
      for (let i = -count / 2; i < count / 2; i++) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 0.24),
          dashWhiteMat
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x + i * 5.2 + 2.2, 0.032, z);
        worldRootGroup.add(dash);
      }
    } else {
      const count = Math.floor(d / 5.2);
      for (let i = -count / 2; i < count / 2; i++) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.22, 2.4),
          dashWhiteMat
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.032, z + i * 5.2 + 2.2);
        worldRootGroup.add(dash);
      }
    }
  };

  addRoadSegment(0, 0, 122, 13.2, true);
  addRoadSegment(-3, -34, 92, 8.4, true);
  addRoadSegment(-3, 29, 92, 8.4, true);
  addRoadSegment(-44, -2.5, 8.8, 71, false);
  addRoadSegment(0, -2.5, 8.8, 71, false);
  addRoadSegment(38, -2.5, 8.8, 71, false);

  [-36, -12, 14].forEach((cx) => {
    for (let zOff = -4.8; zOff <= 4.8; zOff += 1.2) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.55),
        dashWhiteMat
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(cx, 0.034, zOff);
      worldRootGroup.add(stripe);
    }
  });

  // ============================================================================
  // 3. STAGE-SPECIFIC 3D BUILDINGS & ICONIC LANDMARKS
  //    - Stage 1: European Rowhouses (都市多彩联排商铺)
  //    - Stage 2: Coastal Seaside Villas + Red/White Lighthouse (海边白墙蓝顶海景房 + 大灯塔)
  //    - Stage 3: Countryside Timber Cottages + Rotating Windmill (乡村斜顶木梁农舍 + 旋转大风车)
  // ============================================================================
  interface BuildingPlacementSpec {
    id: string;
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    mat: THREE.MeshStandardMaterial;
    hasStorefront?: boolean;
    awningStyle?: 'blue_white' | 'orange_white' | 'none';
    windowCols?: number;
    floors?: number;
    signTitle?: string;
    signSub?: string;
    signBg?: string;
    signAccent?: string;
    coastalRoofHex?: number;
    coastalWallHex?: number;
    countryWallHex?: number;
    countryRoofHex?: number;
  }

  const buildingSpecs: BuildingPlacementSpec[] = [
    {
      id: 'rh_nw_1',
      x: -36.5,
      z: -19.5,
      w: 8.6,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseSlateBlue,
      hasStorefront: false,
      windowCols: 3,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x9a3412,
    },
    {
      id: 'rh_nw_2',
      x: -29.4,
      z: -19.5,
      w: 5.6,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseMustardYellow,
      hasStorefront: true,
      awningStyle: 'orange_white',
      windowCols: 1,
      floors: 3,
      coastalRoofHex: 0x0ea5e9,
      coastalWallHex: 0xfef9c3,
      countryWallHex: 0xffedd5,
      countryRoofHex: 0x7c2d12,
    },
    {
      id: 'rh_nw_3',
      x: -21.8,
      z: -19.5,
      w: 9.6,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseCoralOrange,
      hasStorefront: true,
      awningStyle: 'blue_white',
      windowCols: 3,
      floors: 3,
      signTitle:
        stageTheme === 'coastal_seaside'
          ? 'ALOHA SURF BAR'
          : stageTheme === 'countryside_village'
          ? 'COUNTRY BAKERY'
          : 'BLUE AWNING CAFE',
      signSub:
        stageTheme === 'coastal_seaside'
          ? '椰林冲浪板 · 冰镇椰汁吧'
          : stageTheme === 'countryside_village'
          ? '田园柴火面包坊 · 鲜奶酪'
          : '欧式街角烘焙 · 咖啡',
      signBg: '#1e3a8a',
      signAccent: '#38bdf8',
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0xb91c1c,
    },
    {
      id: 'rh_nw_4',
      x: -14.2,
      z: -19.5,
      w: 5.6,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseTealGreen,
      hasStorefront: false,
      windowCols: 2,
      floors: 3,
      coastalRoofHex: 0x0d9488,
      coastalWallHex: 0xf0fdfa,
      countryWallHex: 0xfde68a,
      countryRoofHex: 0x78350f,
    },
    {
      id: 'rh_nw_5',
      x: -7.8,
      z: -19.5,
      w: 7.2,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseRosePink,
      hasStorefront: false,
      windowCols: 2,
      floors: 3,
      coastalRoofHex: 0xf97316,
      coastalWallHex: 0xfff7ed,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x991b1b,
    },
    {
      id: 'rh_ne_1',
      x: 7.8,
      z: -19.5,
      w: 6.4,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseMustardYellow,
      hasStorefront: false,
      windowCols: 2,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xffedd5,
      countryRoofHex: 0x9a3412,
    },
    {
      id: 'rh_ne_2',
      x: 15.8,
      z: -19.5,
      w: 9.6,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseSkyShop,
      hasStorefront: true,
      awningStyle: 'blue_white',
      windowCols: 3,
      floors: 3,
      signTitle:
        stageTheme === 'coastal_seaside'
          ? 'CORAL SHELL SHOP'
          : stageTheme === 'countryside_village'
          ? 'HARVEST TAVERN'
          : 'ARCADE BOUTIQUE',
      signSub:
        stageTheme === 'coastal_seaside'
          ? '海岛贝壳馆 · 潜水装备店'
          : stageTheme === 'countryside_village'
          ? '丰收麦田驿站 · 农家乐'
          : '联排百货 · 潮玩买手店',
      signBg: '#0f172a',
      signAccent: '#facc15',
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf0f9ff,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x78350f,
    },
    {
      id: 'rh_ne_3',
      x: 24.6,
      z: -19.5,
      w: 8.0,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseLavender,
      hasStorefront: true,
      awningStyle: 'orange_white',
      windowCols: 2,
      floors: 3,
      coastalRoofHex: 0x0ea5e9,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xfde68a,
      countryRoofHex: 0x9a3412,
    },
    {
      id: 'rh_ne_4',
      x: 32.0,
      z: -19.5,
      w: 6.8,
      h: 12.2,
      d: 8.8,
      mat: mats.rowhouseCoralOrange,
      hasStorefront: false,
      windowCols: 2,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xffedd5,
      countryRoofHex: 0x991b1b,
    },
    {
      id: 'rh_sw_1',
      x: -35.0,
      z: 19.5,
      w: 9.6,
      h: 11.8,
      d: 8.8,
      mat: mats.rowhouseCoralOrange,
      hasStorefront: true,
      awningStyle: 'orange_white',
      windowCols: 3,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x9a3412,
    },
    {
      id: 'rh_sw_2',
      x: -25.8,
      z: 19.5,
      w: 8.8,
      h: 11.8,
      d: 8.8,
      mat: mats.rowhouseTealGreen,
      hasStorefront: true,
      awningStyle: 'blue_white',
      windowCols: 2,
      floors: 3,
      coastalRoofHex: 0x0d9488,
      coastalWallHex: 0xf0fdfa,
      countryWallHex: 0xfde68a,
      countryRoofHex: 0x78350f,
    },
    {
      id: 'rh_sw_3',
      x: -10.5,
      z: 19.5,
      w: 9.2,
      h: 11.8,
      d: 8.8,
      mat: mats.rowhouseMustardYellow,
      hasStorefront: true,
      awningStyle: 'orange_white',
      windowCols: 3,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xffedd5,
      countryRoofHex: 0xb91c1c,
    },
    {
      id: 'rh_se_1',
      x: 10.5,
      z: 19.5,
      w: 9.2,
      h: 11.8,
      d: 8.8,
      mat: mats.rowhouseRosePink,
      hasStorefront: true,
      awningStyle: 'blue_white',
      windowCols: 3,
      floors: 3,
      coastalRoofHex: 0x0ea5e9,
      coastalWallHex: 0xf0f9ff,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x9a3412,
    },
    {
      id: 'rh_se_2',
      x: 19.8,
      z: 19.5,
      w: 9.2,
      h: 11.8,
      d: 8.8,
      mat: mats.rowhouseSlateBlue,
      hasStorefront: false,
      windowCols: 3,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xfde68a,
      countryRoofHex: 0x78350f,
    },
    {
      id: 'rh_se_3',
      x: 31.0,
      z: 19.5,
      w: 9.2,
      h: 11.8,
      d: 8.8,
      mat: mats.rowhouseMustardYellow,
      hasStorefront: true,
      awningStyle: 'orange_white',
      windowCols: 3,
      floors: 3,
      coastalRoofHex: 0xf97316,
      coastalWallHex: 0xfff7ed,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x991b1b,
    },
    {
      id: 'rh_back_n1',
      x: -24,
      z: -43.5,
      w: 16.0,
      h: 12.5,
      d: 8.0,
      mat: mats.rowhouseLavender,
      hasStorefront: false,
      windowCols: 4,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x9a3412,
    },
    {
      id: 'rh_back_n2',
      x: 18,
      z: -43.5,
      w: 18.0,
      h: 12.5,
      d: 8.0,
      mat: mats.rowhouseSlateBlue,
      hasStorefront: true,
      awningStyle: 'blue_white',
      windowCols: 4,
      floors: 3,
      coastalRoofHex: 0x0ea5e9,
      coastalWallHex: 0xf0f9ff,
      countryWallHex: 0xfde68a,
      countryRoofHex: 0x78350f,
    },
    {
      id: 'rh_back_s1',
      x: -24,
      z: 41.5,
      w: 16.0,
      h: 12.0,
      d: 8.5,
      mat: mats.rowhouseSkyShop,
      hasStorefront: true,
      awningStyle: 'blue_white',
      windowCols: 4,
      floors: 3,
      coastalRoofHex: 0x0284c7,
      coastalWallHex: 0xf8fafc,
      countryWallHex: 0xffedd5,
      countryRoofHex: 0x991b1b,
    },
    {
      id: 'rh_back_s2',
      x: 22,
      z: 41.5,
      w: 16.0,
      h: 12.0,
      d: 8.5,
      mat: mats.rowhouseCoralOrange,
      hasStorefront: true,
      awningStyle: 'orange_white',
      windowCols: 4,
      floors: 3,
      coastalRoofHex: 0x0d9488,
      coastalWallHex: 0xf0fdfa,
      countryWallHex: 0xfef3c7,
      countryRoofHex: 0x9a3412,
    },
  ];

  // In Stage 2 (Coastal Seaside Town) and Stage 3 (Countryside Village), replace `rh_ne_4` (at x=32, z=-19.5)
  // with the Stage Landmark: Red-and-White Coastal Lighthouse OR Rotating Countryside Windmill!
  buildingSpecs.forEach((b, idx) => {
    let bGroup: THREE.Group;

    if (b.id === 'rh_ne_4' && stageTheme === 'coastal_seaside') {
      bGroup = createLighthouseLandmark(mats);
      bGroup.position.set(b.x, 0, b.z);
      worldRootGroup.add(bGroup);
      occluderMeshes.push(bGroup);
    } else if (b.id === 'rh_ne_4' && stageTheme === 'countryside_village') {
      bGroup = createWindmillLandmark(mats);
      bGroup.position.set(b.x, 0, b.z);
      worldRootGroup.add(bGroup);
      occluderMeshes.push(bGroup);
      windmillRotor = bGroup.getObjectByName('windmillRotor') || null;
    } else if (stageTheme === 'coastal_seaside') {
      bGroup = createCoastalBuildingMesh(mats, b.w, b.h, b.d, b.coastalRoofHex, {
        hasStorefront: b.hasStorefront,
        hasDome: idx % 2 === 0,
        wallColorHex: b.coastalWallHex,
      });
      bGroup.position.set(b.x, 0, b.z);
      worldRootGroup.add(bGroup);
      occluderMeshes.push(bGroup);
    } else if (stageTheme === 'countryside_village') {
      // Slightly separate cottages so pitched roofs look like an authentic village street!
      const cottageW = Math.max(4.8, b.w - 0.8);
      bGroup = createCountrysideCottageMesh(
        mats,
        cottageW,
        b.h,
        b.d,
        b.countryWallHex,
        b.countryRoofHex
      );
      bGroup.position.set(b.x, 0, b.z);
      worldRootGroup.add(bGroup);
      occluderMeshes.push(bGroup);
    } else {
      bGroup = createRowhouseSegmentMesh(mats, b.w, b.h, b.d, b.mat, {
        hasStorefront: b.hasStorefront,
        awningStyle: b.awningStyle,
        windowCols: b.windowCols,
        floors: b.floors,
      });
      bGroup.position.set(b.x, 0, b.z);
      worldRootGroup.add(bGroup);
      occluderMeshes.push(bGroup);
    }

    if (b.signTitle && b.signSub && b.signBg && b.signAccent) {
      const signMat = mats.createSignMaterial(
        b.signTitle,
        b.signSub,
        b.signBg,
        b.signAccent
      );
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(5.2, b.w * 0.65), 1.05, 0.22),
        signMat
      );
      signMesh.position.set(b.x, 4.15, b.z + b.d / 2 + 0.25);
      worldRootGroup.add(signMesh);
    }

    colliders.push({
      id: b.id,
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
      height: b.h,
      blocksVision: true,
    });
  });

  // ============================================================================
  // 4. STAGE-SPECIFIC VEGETATION / STEALTH BUSHES & SIDEWALK PROPS
  //    - Stage 1: Potted Topiaries + Street Benches + Red Fire Hydrants
  //    - Stage 2: Tropical Coconut Palm Trees + Beach Deck Benches
  //    - Stage 3: Golden Haystack Bales + Wooden Split-Rail Fences & Oak Barrels
  // ============================================================================
  const topiaryCoords: [number, number][] = [
    [-32.5, -14.2],
    [-25.8, -14.2],
    [-17.2, -14.2],
    [-11.2, -14.2],
    [-4.8, -14.2],
    [11.2, -14.2],
    [20.2, -14.2],
    [28.4, -14.2],
    [-30.5, 14.2],
    [-21.5, 14.2],
    [-6.5, 14.2],
    [6.5, 14.2],
    [15.5, 14.2],
    [26.5, 14.2],
  ];
  topiaryCoords.forEach(([tx, tz], idx) => {
    const foliageProp =
      stageTheme === 'coastal_seaside'
        ? createPalmTreeProp(mats)
        : stageTheme === 'countryside_village'
        ? createHaystackBushProp(mats)
        : createPottedTopiaryProp(mats);

    foliageProp.position.set(tx, 0, tz);
    if (stageTheme !== 'urban_rowhouse') {
      foliageProp.rotation.y = (idx * 1.1) % (Math.PI * 2);
    }
    worldRootGroup.add(foliageProp);
    bushZones.push({
      position: new THREE.Vector3(tx, 0, tz),
      radius: stageTheme === 'urban_rowhouse' ? 1.5 : 1.85,
    });
  });

  // Sidewalk Benches OR Countryside Split-Rail Wooden Fences & Barrels
  const benchCoords: [number, number, number][] = [
    [-31.2, -13.6, 0],
    [-7.8, -13.6, 0],
    [15.8, -13.6, 0],
    [30.5, -13.6, 0],
    [-29.0, 8.2, 0],
    [-19.0, 8.2, 0],
    [12.0, 8.2, 0],
    [22.0, 8.2, 0],
    [32.0, 8.2, 0],
  ];
  benchCoords.forEach(([bx, bz, rotY], idx) => {
    const propMesh =
      stageTheme === 'countryside_village'
        ? createCountryFenceAndBarrelsProp(mats)
        : createStreetBenchProp(mats);
    propMesh.position.set(bx, 0, bz);
    propMesh.rotation.y = rotY;
    worldRootGroup.add(propMesh);
    colliders.push({
      id: `bench_${idx}`,
      minX: bx - 1.2,
      maxX: bx + 1.2,
      minZ: bz - 0.5,
      maxZ: bz + 0.5,
      height: 0.75,
      blocksVision: false,
    });
  });

  if (stageTheme === 'urban_rowhouse') {
    const hydrantCoords: [number, number][] = [
      [-24.5, -7.6],
      [-6.2, -7.6],
      [18.5, -7.6],
      [33.5, -7.6],
      [-15.5, 7.6],
      [16.5, 7.6],
    ];
    hydrantCoords.forEach(([hx, hz]) => {
      const hydrant = createFireHydrantProp(mats);
      hydrant.position.set(hx, 0, hz);
      worldRootGroup.add(hydrant);
    });
  }

  // ============================================================================
  // 5. PARKED VEHICLES & COURTYARD UMBRELLA SETS
  // ============================================================================
  const parkedCarSpecs: {
    id: string;
    x: number;
    z: number;
    rotY: number;
    color: number;
  }[] = [
    {
      id: 'car_ref2_yellow_1',
      x: -20,
      z: -4.6,
      rotY: Math.PI / 2,
      color: stageTheme === 'coastal_seaside' ? 0x38bdf8 : stageTheme === 'countryside_village' ? 0xd97706 : 0xfacc15,
    },
    {
      id: 'car_ref2_yellow_2',
      x: 20,
      z: -4.6,
      rotY: Math.PI / 2,
      color: 0xfacc15,
    },
    { id: 'car_coral_3', x: -25, z: 11.2, rotY: -Math.PI / 2, color: 0xf97316 },
    { id: 'car_cyan_4', x: 18, z: 11.2, rotY: -Math.PI / 2, color: 0x38bdf8 },
    { id: 'car_mint_5', x: -34, z: -26.5, rotY: Math.PI / 2, color: 0x34d399 },
    { id: 'car_rose_6', x: 26, z: -26.5, rotY: -Math.PI / 2, color: 0xf43f5e },
  ];

  parkedCarSpecs.forEach((c) => {
    const car = createStaticCivilianCar(mats, c.color);
    car.position.set(c.x, 0, c.z);
    car.rotation.y = c.rotY;
    worldRootGroup.add(car);
    occluderMeshes.push(car);

    const isHorizontal = Math.abs(Math.sin(c.rotY)) > 0.7;
    const halfW = isHorizontal ? 2.35 : 1.1;
    const halfD = isHorizontal ? 1.1 : 2.35;

    colliders.push({
      id: c.id,
      minX: c.x - halfW,
      maxX: c.x + halfW,
      minZ: c.z - halfD,
      maxZ: c.z + halfD,
      height: 1.5,
      blocksVision: true,
    });
  });

  const cafeCoords: [number, number, THREE.Material][] = [
    [-18, -26.2, mats.awningTealWhite],
    [8, -26.2, mats.awningRedWhite],
    [-16, 35.0, mats.awningAmberNavy],
    [14, 35.0, mats.awningTealWhite],
  ];
  cafeCoords.forEach(([cx, cz, mat], idx) => {
    const cafe = createCafeParasolSet(mats, mat);
    cafe.position.set(cx, 0, cz);
    worldRootGroup.add(cafe);
    occluderMeshes.push(cafe);
    colliders.push({
      id: `cafe_${idx}`,
      minX: cx - 1.1,
      maxX: cx + 1.1,
      minZ: cz - 1.1,
      maxZ: cz + 1.1,
      height: 2.4,
      blocksVision: true,
    });
  });

  // ============================================================================
  // 6. STAGE-SPECIFIC INTERACTIVE HIDING BOOTHS
  //    - Stage 1: 街头电话亭 / 智能快递柜
  //    - Stage 2: 海滨冲浪换衣木屋 (Beach Cabanas)
  //    - Stage 3: 乡村木质谷仓掩体棚 (Countryside Barn Sheds)
  // ============================================================================
  const boothPrefix =
    stageTheme === 'coastal_seaside'
      ? '海滨冲浪换衣木屋'
      : stageTheme === 'countryside_village'
      ? '乡村谷仓木哨棚'
      : '街头隐蔽电话亭';

  const hidingSpecs: {
    id: string;
    name: string;
    pos: [number, number, number];
    exit: [number, number, number];
  }[] = [
    {
      id: 'hide_1',
      name: `${boothPrefix} A`,
      pos: [-34, 0, -11.5],
      exit: [-34, 0, -9.2],
    },
    {
      id: 'hide_2',
      name: `${boothPrefix} B`,
      pos: [-16, 0, -28],
      exit: [-13.8, 0, -28],
    },
    {
      id: 'hide_3',
      name: `${boothPrefix} C`,
      pos: [6, 0, -11.5],
      exit: [6, 0, -9.2],
    },
    {
      id: 'hide_4',
      name: `${boothPrefix} D`,
      pos: [-18, 0, 11.5],
      exit: [-18, 0, 9.2],
    },
    {
      id: 'hide_5',
      name: `${boothPrefix} E`,
      pos: [6, 0, 34.8],
      exit: [6, 0, 32.4],
    },
    {
      id: 'hide_6',
      name: `${boothPrefix} F`,
      pos: [34, 0, 11.5],
      exit: [34, 0, 9.2],
    },
  ];

  hidingSpecs.forEach((h) => {
    const locker =
      stageTheme === 'coastal_seaside'
        ? createBeachCabanaHidingModel(mats)
        : stageTheme === 'countryside_village'
        ? createCountryShedHidingModel(mats)
        : createHidingLockerModel(mats);
    locker.position.set(h.pos[0], h.pos[1], h.pos[2]);
    worldRootGroup.add(locker);
    hidingSpots.push({
      id: h.id,
      name: h.name,
      label: h.name,
      position: new THREE.Vector3(...h.pos),
      hidePosition: new THREE.Vector3(...h.pos),
      exitPosition: new THREE.Vector3(...h.exit),
      mesh: locker,
    });
    colliders.push({
      id: h.id,
      minX: h.pos[0] - 0.75,
      maxX: h.pos[0] + 0.75,
      minZ: h.pos[2] - 0.75,
      maxZ: h.pos[2] + 0.75,
      height: 2.5,
      blocksVision: true,
    });
  });

  // ============================================================================
  // 7. STREET LAMPS
  // ============================================================================
  const lampCoords: [number, number, number][] = [
    [-38, -7.8, Math.PI / 2],
    [-14, -7.8, Math.PI / 2],
    [10, -7.8, Math.PI / 2],
    [34, -7.8, Math.PI / 2],
    [-38, 7.8, -Math.PI / 2],
    [-14, 7.8, -Math.PI / 2],
    [10, 7.8, -Math.PI / 2],
    [34, 7.8, -Math.PI / 2],
  ];
  lampCoords.forEach(([lx, lz, rot]) => {
    const lamp = createStreetLampModel(mats);
    lamp.position.set(lx, 0, lz);
    lamp.rotation.y = rot;
    worldRootGroup.add(lamp);
  });

  // ============================================================================
  // 8. STREET ENERGY SNACKS (BREAD 🥐 & BANANA 🍌) & THROWABLES (STONE 🪨 & WRENCH 🔧)
  // ============================================================================
  STREET_SNACKS.forEach((spec) => {
    const mesh = createStreetSnackMesh(mats, spec.kind);
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);
    worldRootGroup.add(mesh);
    snackObjects.push({
      spec,
      mesh,
      respawnTimer: 0,
    });
  });

  STREET_THROWABLES.forEach((spec) => {
    const mesh = createStreetThrowableMesh(mats, spec.kind, true);
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);
    worldRootGroup.add(mesh);
    throwableObjects.push({
      spec,
      mesh,
      respawnTimer: 0,
    });
  });

  MISSION_ITEMS.forEach((spec) => {
    const clonedSpec: MissionItemSpec = {
      ...spec,
      position: [...spec.position] as [number, number, number],
    };
    const mesh = createMissionItemMesh(mats, clonedSpec.id);
    mesh.position.set(
      clonedSpec.position[0],
      clonedSpec.position[1],
      clonedSpec.position[2]
    );
    worldRootGroup.add(mesh);
    missionObjects.push({
      spec: clonedSpec,
      mesh,
      collected: false,
    });
  });

  // ============================================================================
  // 9. SUBWAY / DOCK / STATION EXTRACTION ZONE ([52, 0, 18])
  // ============================================================================
  const extractionBeacon = new THREE.Group();
  extractionBeacon.position.set(
    EXTRACTION_POINT.position[0],
    0,
    EXTRACTION_POINT.position[2]
  );

  const ringGeo = new THREE.RingGeometry(
    EXTRACTION_POINT.radius - 0.35,
    EXTRACTION_POINT.radius,
    36
  );
  ringGeo.rotateX(-Math.PI / 2);
  const extractionRing = new THREE.Mesh(ringGeo, mats.extractionEmerald);
  extractionRing.position.set(
    EXTRACTION_POINT.position[0],
    0.06,
    EXTRACTION_POINT.position[2]
  );
  worldRootGroup.add(extractionRing);

  const archLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 3.4, 0.4),
    mats.extractionEmerald
  );
  archLeft.position.set(-2.2, 1.7, 0);
  const archRight = archLeft.clone();
  archRight.position.x = 2.2;
  const archTop = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.55, 0.6),
    mats.extractionEmerald
  );
  archTop.position.set(0, 3.5, 0);
  extractionBeacon.add(archLeft, archRight, archTop);
  worldRootGroup.add(extractionBeacon);

  // ============================================================================
  // 10. FULL-MAP AI PATROL & INVESTIGATION WAYPOINTS
  // ============================================================================
  const rawSearchCoords: [number, number][] = [
    [-38, -10],
    [-22, -10],
    [-4, -10],
    [14, -10],
    [30, -10],
    [-38, 10],
    [-20, 10],
    [-4, 10],
    [14, 10],
    [30, 10],
    [-38, -32],
    [-24, -29],
    [-8, -29],
    [12, -29],
    [28, -29],
    [38, -32],
    [-38, 29],
    [-24, 29],
    [-8, 29],
    [12, 29],
    [28, 29],
    [38, 29],
    [-42, 4],
    [-42, -16],
    [-42, 18],
    [42, 6],
    [44, 18],
    [38, 20],
  ];
  rawSearchCoords.forEach(([sx, sz]) => {
    searchPoints.push(new THREE.Vector3(sx, 0, sz));
  });

  const worldData: WorldData = {
    worldRootGroup,
    stageId,
    colliders,
    occluderMeshes,
    hidingSpots,
    bushZones,
    missionObjects,
    snackObjects,
    throwableObjects,
    extractionRing,
    extractionBeacon,
    searchPoints,
    windmillRotor,
    oceanWaveMesh,
  };

  randomizeMissionObjects(worldData);

  return worldData;
}
