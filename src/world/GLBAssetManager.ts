import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_CHARACTERS, PlayerCharacterId } from '../core/Config';
import { MaterialLibrary } from './Materials';
import {
  createFireHydrantProp,
  createOfficerModel,
  createPatrolCarModel,
  createPlayerModel,
  createPottedTopiaryProp,
  createRowhouseSegmentMesh,
  createStaticCivilianCar,
  createStreetBenchProp,
  PlayerRig,
} from './ProceduralModels';

export type GLBAssetCategory = 'character' | 'vehicle' | 'environment';

export interface GLBAssetMetadata {
  id: string;
  fileName: string;
  label: string;
  category: GLBAssetCategory;
  byteLength: number;
  triangleCount: number;
  meshCount: number;
  isCustomUploaded: boolean;
  blobUrl: string;
}

class GLBAssetRegistry {
  private gltfLoader = new GLTFLoader();
  private gltfExporter = new GLTFExporter();
  private metadataMap = new Map<string, GLBAssetMetadata>();
  private parsedTemplates = new Map<string, THREE.Group>();
  private factoryMap = new Map<string, () => THREE.Object3D>();
  private listeners = new Set<() => void>();
  private initialized = false;

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  private countStats(root: THREE.Object3D): { triangles: number; meshes: number } {
    let triangles = 0;
    let meshes = 0;
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        meshes++;
        const geo = (obj as THREE.Mesh).geometry;
        if (geo) {
          if (geo.index) {
            triangles += Math.round(geo.index.count / 3);
          } else if (geo.attributes.position) {
            triangles += Math.round(geo.attributes.position.count / 3);
          }
        }
      }
    });
    return { triangles, meshes };
  }

  private registerBuiltinDescriptor(
    id: string,
    fileName: string,
    label: string,
    category: GLBAssetCategory,
    factory: () => THREE.Object3D
  ) {
    const sample = factory();
    const stats = this.countStats(sample);
    this.factoryMap.set(id, factory);
    this.metadataMap.set(id, {
      id,
      fileName,
      label,
      category,
      byteLength: stats.triangles * 48 + 2048,
      triangleCount: stats.triangles,
      meshCount: stats.meshes,
      isCustomUploaded: false,
      blobUrl: '',
    });
  }

  /**
   * Registers built-in 3D assets instantaneously without running GLTFExporter at startup,
   * ensuring 100% native Three.js rendering stability in the main game loop.
   */
  public initializeCoreGLBAssets(mats: MaterialLibrary): void {
    if (this.initialized) return;
    this.initialized = true;

    const charIds: PlayerCharacterId[] = [
      'luna_cyber',
      'street_kid',
      'flash_rider',
      'suited_worker',
    ];

    for (const cid of charIds) {
      const spec = PLAYER_CHARACTERS[cid];
      this.registerBuiltinDescriptor(
        `char_${cid}`,
        spec.glbFileName,
        `${spec.name} (${spec.title})`,
        'character',
        () => createPlayerModel(mats, cid).group
      );
    }

    this.registerBuiltinDescriptor(
      'char_officer',
      'char_security_officer.glb',
      '参保核查保安 · 执法角色模型',
      'character',
      () => createOfficerModel(mats, 0).group
    );

    this.registerBuiltinDescriptor(
      'veh_patrol_van',
      'veh_patrol_van.glb',
      '参保直通车 · 执法巡逻车模型',
      'vehicle',
      () => createPatrolCarModel(mats).group
    );

    this.registerBuiltinDescriptor(
      'veh_yellow_sedan',
      'veh_yellow_sedan.glb',
      '明黄低多边形轿跑 (参考图2同款车辆)',
      'vehicle',
      () => createStaticCivilianCar(mats, 0xfacc15)
    );

    this.registerBuiltinDescriptor(
      'env_rowhouse_terrace',
      'env_rowhouse_terrace.glb',
      '欧式彩色联排商业楼 (参考图2同款建筑)',
      'environment',
      () =>
        createRowhouseSegmentMesh(mats, 10, 12, 10, mats.rowhouseCoralOrange, {
          hasStorefront: true,
          awningStyle: 'blue_white',
          windowCols: 3,
          floors: 3,
        })
    );

    this.registerBuiltinDescriptor(
      'env_street_props',
      'env_street_props.glb',
      '街景道具包 (陶土盆栽/木长椅/消防栓)',
      'environment',
      () => {
        const propSuite = new THREE.Group();
        const pot = createPottedTopiaryProp(mats);
        pot.position.x = -2.0;
        const bench = createStreetBenchProp(mats);
        const hydrant = createFireHydrantProp(mats);
        hydrant.position.x = 2.0;
        propSuite.add(pot, bench, hydrant);
        return propSuite;
      }
    );

    this.notify();
  }

  public instantiatePlayerRigFromGLB(
    mats: MaterialLibrary,
    characterId: PlayerCharacterId
  ): PlayerRig {
    const assetId = `char_${characterId}`;
    const meta = this.metadataMap.get(assetId);
    const template = this.parsedTemplates.get(assetId);

    if (template && meta?.isCustomUploaded) {
      const cloned = template.clone(true);
      const box = new THREE.Box3().setFromObject(cloned);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = size.y > 0.01 ? 1.72 / size.y : 1;
      cloned.scale.setScalar(scale);
      cloned.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      const group = new THREE.Group();
      const bodyGroup = new THREE.Group();
      bodyGroup.add(cloned);
      group.add(bodyGroup);

      const headGroup =
        (cloned.getObjectByName('headGroup') as THREE.Group) ||
        (cloned.getObjectByName('Head') as THREE.Group) ||
        new THREE.Group();
      const leftArm =
        (cloned.getObjectByName('leftArm') as THREE.Group) ||
        (cloned.getObjectByName('LeftArm') as THREE.Group) ||
        new THREE.Group();
      const rightArm =
        (cloned.getObjectByName('rightArm') as THREE.Group) ||
        (cloned.getObjectByName('RightArm') as THREE.Group) ||
        new THREE.Group();
      const leftLeg =
        (cloned.getObjectByName('leftLeg') as THREE.Group) ||
        (cloned.getObjectByName('LeftLeg') as THREE.Group) ||
        new THREE.Group();
      const rightLeg =
        (cloned.getObjectByName('rightLeg') as THREE.Group) ||
        (cloned.getObjectByName('RightLeg') as THREE.Group) ||
        new THREE.Group();

      return {
        group,
        bodyGroup,
        headGroup,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
      };
    }

    return createPlayerModel(mats, characterId);
  }

  public getAllAssets(): GLBAssetMetadata[] {
    return Array.from(this.metadataMap.values());
  }

  public downloadGLB(id: string): void {
    const meta = this.metadataMap.get(id);
    if (!meta) return;

    if (meta.blobUrl) {
      const link = document.createElement('a');
      link.href = meta.blobUrl;
      link.download = meta.fileName;
      link.click();
      return;
    }

    const factory = this.factoryMap.get(id);
    if (!factory) return;

    const obj = factory();
    this.gltfExporter.parse(
      obj,
      (result) => {
        const buffer =
          result instanceof ArrayBuffer
            ? result
            : new TextEncoder().encode(JSON.stringify(result)).buffer;
        const blob = new Blob([buffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = meta.fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      },
      () => {},
      { binary: true }
    );
  }

  public async uploadCustomGLB(id: string, file: File): Promise<GLBAssetMetadata | null> {
    const existing = this.metadataMap.get(id);
    if (!existing) return null;
    const glbBuffer = await file.arrayBuffer();

    if (existing.blobUrl) {
      URL.revokeObjectURL(existing.blobUrl);
    }

    const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
    const blobUrl = URL.createObjectURL(blob);

    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      this.gltfLoader.parse(
        glbBuffer.slice(0),
        '',
        (parsed) => resolve(parsed as unknown as { scene: THREE.Group }),
        (err) => reject(err)
      );
    });

    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    const stats = this.countStats(gltf.scene);
    const meta: GLBAssetMetadata = {
      id,
      fileName: file.name.endsWith('.glb') ? file.name : `${file.name}.glb`,
      label: existing.label,
      category: existing.category,
      byteLength: glbBuffer.byteLength,
      triangleCount: stats.triangles,
      meshCount: stats.meshes,
      isCustomUploaded: true,
      blobUrl,
    };

    this.metadataMap.set(id, meta);
    this.parsedTemplates.set(id, gltf.scene);
    this.notify();
    return meta;
  }
}

export const glbAssetRegistry = new GLBAssetRegistry();
