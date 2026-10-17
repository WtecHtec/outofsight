import * as THREE from 'three';
import { soundFX } from '../core/AudioSystem';
import {
  PlaystyleConfig,
  STAGE_CONFIGS,
  StageConfig,
  StageId,
  ThrowableKind,
  WORLD_CONFIG,
} from '../core/Config';
import { MaterialLibrary } from '../world/Materials';
import {
  createOfficerModel,
  createPatrolCarModel,
  createStreetMonitorModel,
  OfficerRig,
  PatrolCarRig,
  StreetMonitorRig,
} from '../world/ProceduralModels';
import { ColliderBox, WorldData } from '../world/WorldBuilder';

export type VehicleState =
  | 'Patrol'
  | 'SlowDown'
  | 'Stop'
  | 'Deploy'
  | 'Search'
  | 'Return'
  | 'Resume';

export type OfficerState =
  | 'Patrol'
  | 'Observe'
  | 'Investigate'
  | 'Search'
  | 'Chase'
  | 'Baffled'
  | 'Return';

export interface WaypointNode {
  pos: THREE.Vector3;
  isStopPoint: boolean;
  stopDuration: number;
  label: string;
}

export type OfficerId = string;

export interface ActiveStreetMonitor {
  id: string;
  rig: StreetMonitorRig;
  position: THREE.Vector3;
  baseYaw: number;
  sweepAngle: number;
  sweepDirection: number;
  detectionRadius: number;
  isTriggered: boolean;
}

export interface OfficerAgent {
  id: OfficerId;
  name: string;
  roleLabel: string;
  rig: OfficerRig;
  state: OfficerState;
  position: THREE.Vector3;
  rotationY: number;
  detectionProgress: number;
  lastKnownPlayerPos: THREE.Vector3 | null;
  memoryTimer: number;
  searchTimer: number;
  escapeGraceTimer: number;
  loseSightTimer: number; // 玩家离开保安视野后的累计时间（达到阈值 loseSightThresholdSec 后才放弃追击）
  hitStaggerTimer: number; // 被石头/扳手砸中时的受击硬直眩晕动作计时
  throwBoostTimer: number; // 投掷命中后触发的 5-10s 随机激怒狂暴加速追逐计时
  visionBoostActive: boolean; // 玩家进入保安视野时触发的视野加速状态（直到摆脱视野才解除！）
  currentSearchTarget: THREE.Vector3 | null;
  patrolRoute: THREE.Vector3[];
  patrolIndex: number;
  waypointsVisitedSinceSweep: number;
  inVehicle: boolean;
  animPhase: number;
  canSeePlayer: boolean;
  deployedFromCar?: boolean; // 是否为参保车动态下放的保安（不限总数）
  deployedRemainingSec?: number; // 该保安独立的地面搜捕剩余时长（发现玩家即重置刷新）
  returnTimer?: number; // 归队返回计时（超时则在附近哨亭交接归队）
}

const _raycaster = new THREE.Raycaster();
const _eyePos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _dirToPlayer = new THREE.Vector3();
const _forwardVec = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _tmpForward = new THREE.Vector3();
const _tmpToTarget = new THREE.Vector3();

export interface ThrowTargetResult {
  hasTarget: boolean;
  inRange: boolean;
  distance: number;
  maxRange: number;
  targetType: 'officer' | 'car';
  officerId: OfficerId | null;
  targetName: string;
  targetPos: THREE.Vector3;
}

export class PatrolAndAISystem {
  public carRig: PatrolCarRig;
  public carState: VehicleState = 'Patrol';
  public carPosition = new THREE.Vector3(-12, 0, 0);
  public carRotationY = -Math.PI / 2;
  public carSpeed = 0;
  public currentWaypointIdx = 0;
  public stateTimer = 0;

  // 巡逻车（参保直通车）独立超远视野与无线电通报状态
  public carCanSeePlayer = false;
  public carDetectionProgress = 0;
  public carRadioAlertTimer = 0;
  public carRadioMessage: string | null = null;
  private carBroadcastCooldown = 0;
  public carHitDentTimer = 0; // 参保车被石头/扳手砸凹时的震动与车顶牌歪斜计时
  public collectiveThrowBoostTimer = 0; // 参保车被砸触发的集体保安加速追逐计时 (5~10s随机)
  public lastRolledBoostSec = 7.5; // 最近一次触发的 5~10s 随机加速时长

  // 参保直通车动态下放保安系统（保安人数不限总数！只要被发现就会下放新保安！）
  public deployedOfficerRemainingSec = 0;
  public isOfficerDeployedFromCar = false;
  public carDeployCooldown = 0; // 仅用于车门拉开动作缓冲（约3秒），不限制总下放次数
  public totalDeployedGuardsCount = 3; // 动态增援编号计数

  public getActiveOnFootCount(): number {
    return this.officers.filter((o) => !o.inVehicle && o.rig.group.visible).length;
  }

  public getInVehicleCount(): number {
    return this.officers.filter((o) => o.inVehicle).length;
  }

  // 任务完成度驱动的保安永久增速状态（每次完成收集任务，全员保安永久提速）
  public completedTasksCount = 0;
  public taskSpeedMultiplier = 1.0;

  // 防原地挂机 / 区域久留热力排查机制（防止玩家一直待在同一个角落不被发现）
  public campAnchorPos = new THREE.Vector3(-36, 0, 4);
  public campTimer = 0;
  public campExposureRatio = 0; // 0 ~ 1 (满 1.0 触发大数据热力锁定与保安包抄)
  private campWarningSent = false;

  // 玩家脱离视野阈值进度（用于 HUD 实时展示“甩开追捕进度”）
  public activeChaseLoseSightRatio = 0; // 0 ~ 1
  public activeChaseLoseSightRemainingSec = 0;
  public activeChaserName: string | null = null;
  public isChaserSeeingPlayer = false;
  public isChaserVisionBoosted = false;
  public activeChaserThrowBoostSec = 0;

  // 玩家成功脱离视野提示
  public escapeBannerTimer = 0;
  public escapeBannerMessage: string | null = null;
  public wasHidingInLockerPrev = false;

  public officers: OfficerAgent[] = [];
  public monitors: ActiveStreetMonitor[] = [];
  private monitorDropTimer = 14.0;
  private scene: THREE.Scene;
  private mats: MaterialLibrary;
  public globalAlert = 0;
  public timesSpotted = 0;
  public lastKnownPositionMarker: THREE.Mesh;
  public currentStageConfig: StageConfig = STAGE_CONFIGS.stage_1;
  public initialDeploymentCompleted = false;

  // Pre-allocated frame buffers to avoid GC allocations at 60 FPS
  private _activeOfficersBuffer: OfficerAgent[] = [];
  private _deployedGuardsBuffer: OfficerAgent[] = [];

  // 100% Orthogonal Road-Centerline Grand Loop for the "参保直通车"
  // Every consecutive segment strictly follows the road grid (x = -44, 0, 38; z = -34, 0, 29) so the car NEVER cuts diagonally through buildings!
  private route: WaypointNode[] = [
    { pos: new THREE.Vector3(-44, 0, 0), isStopPoint: true, stopDuration: 2.5, label: '商业街西路口' },
    { pos: new THREE.Vector3(-44, 0, -34), isStopPoint: false, stopDuration: 0, label: '西北联排街角' },
    { pos: new THREE.Vector3(0, 0, -34), isStopPoint: true, stopDuration: 2.4, label: '北区公寓中路' },
    { pos: new THREE.Vector3(38, 0, -34), isStopPoint: true, stopDuration: 2.5, label: '东北晴空广场' },
    { pos: new THREE.Vector3(38, 0, 0), isStopPoint: true, stopDuration: 2.6, label: '东侧地铁前路口' },
    { pos: new THREE.Vector3(38, 0, 29), isStopPoint: true, stopDuration: 2.5, label: '东南咖啡街角' },
    { pos: new THREE.Vector3(0, 0, 29), isStopPoint: true, stopDuration: 2.4, label: '南区拱廊中路' },
    { pos: new THREE.Vector3(-44, 0, 29), isStopPoint: false, stopDuration: 0, label: '西南商业街角' },
    { pos: new THREE.Vector3(-44, 0, 0), isStopPoint: false, stopDuration: 0, label: '西侧十字路口' },
    { pos: new THREE.Vector3(0, 0, 0), isStopPoint: true, stopDuration: 2.6, label: '中央商业十字路口' },
    { pos: new THREE.Vector3(0, 0, -34), isStopPoint: false, stopDuration: 0, label: '北区中轴街口' },
    { pos: new THREE.Vector3(-44, 0, -34), isStopPoint: false, stopDuration: 0, label: '西北大道街口' },
  ];

  private sirenPhase = 0;
  private cutsceneSoundFlags = {
    hornPlayed: false,
    doorPlayed: false,
    whistlePlayed: false,
  };

  constructor(scene: THREE.Scene, mats: MaterialLibrary) {
    this.scene = scene;
    this.mats = mats;

    // 1. "参保直通车" Van with Long-Range Forward Vision Cone
    this.carRig = createPatrolCarModel(mats);
    this.carRig.group.position.copy(this.carPosition);
    scene.add(this.carRig.group);

    // 2. Security Guard Contingent:
    // Ground Patrols: 保安队长·老王, 巡街保安·小李
    // Van Deployed Squad: 机动保安·阿强, 特勤保安·阿杰, 突击保安·铁柱
    const rigA = createOfficerModel(mats, 'captain');
    const rigB = createOfficerModel(mats, 'observer');
    const rigC = createOfficerModel(mats, 'searcher');
    const rigD = createOfficerModel(mats, 'observer');
    const rigE = createOfficerModel(mats, 'captain');

    rigC.group.visible = false;
    rigD.group.visible = false;
    rigE.group.visible = false;

    scene.add(rigA.group, rigB.group, rigC.group, rigD.group, rigE.group);

    this.officers = [
      {
        id: 'A',
        name: '保安队长·老王',
        roleLabel: '西区/北区/中央大道全境巡查',
        rig: rigA,
        state: 'Patrol',
        position: new THREE.Vector3(-12, 0, -4),
        rotationY: 0,
        detectionProgress: 0,
        lastKnownPlayerPos: null,
        memoryTimer: 0,
        searchTimer: 0,
        escapeGraceTimer: 0,
        loseSightTimer: 0,
        hitStaggerTimer: 0,
        throwBoostTimer: 0,
        visionBoostActive: false,
        currentSearchTarget: null,
        patrolRoute: [
          new THREE.Vector3(-44, 0, 10.5),
          new THREE.Vector3(-24, 0, 10.5),
          new THREE.Vector3(0, 0, 10.5),
          new THREE.Vector3(0, 0, -10.5),
          new THREE.Vector3(-24, 0, -10.5),
          new THREE.Vector3(-44, 0, -10.5),
          new THREE.Vector3(-44, 0, -34),
          new THREE.Vector3(-20, 0, -34),
          new THREE.Vector3(0, 0, -34),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-22, 0, 0),
        ],
        patrolIndex: 0,
        waypointsVisitedSinceSweep: 0,
        inVehicle: false,
        animPhase: 0,
        canSeePlayer: false,
      },
      {
        id: 'B',
        name: '巡街保安·小李',
        roleLabel: '南区/东区/东北广场全境排查',
        rig: rigB,
        state: 'Patrol',
        position: new THREE.Vector3(-6, 0, 12),
        rotationY: 0,
        detectionProgress: 0,
        lastKnownPlayerPos: null,
        memoryTimer: 0,
        searchTimer: 0,
        escapeGraceTimer: 0,
        loseSightTimer: 0,
        hitStaggerTimer: 0,
        throwBoostTimer: 0,
        visionBoostActive: false,
        currentSearchTarget: null,
        patrolRoute: [
          new THREE.Vector3(0, 0, 10.5),
          new THREE.Vector3(24, 0, 10.5),
          new THREE.Vector3(38, 0, 10.5),
          new THREE.Vector3(38, 0, 29),
          new THREE.Vector3(18, 0, 29),
          new THREE.Vector3(0, 0, 29),
          new THREE.Vector3(0, 0, -10.5),
          new THREE.Vector3(24, 0, -10.5),
          new THREE.Vector3(38, 0, -10.5),
          new THREE.Vector3(38, 0, -34),
          new THREE.Vector3(18, 0, -34),
          new THREE.Vector3(0, 0, -34),
          new THREE.Vector3(20, 0, 0),
        ],
        patrolIndex: 0,
        waypointsVisitedSinceSweep: 0,
        inVehicle: false,
        animPhase: 1.2,
        canSeePlayer: false,
      },
      {
        id: 'C',
        name: '机动保安·阿强',
        roleLabel: '参保车随车机动与定点突击',
        rig: rigC,
        state: 'Patrol',
        position: new THREE.Vector3(-12, 0, 0),
        rotationY: 0,
        detectionProgress: 0,
        lastKnownPlayerPos: null,
        memoryTimer: 0,
        searchTimer: 0,
        escapeGraceTimer: 0,
        loseSightTimer: 0,
        hitStaggerTimer: 0,
        throwBoostTimer: 0,
        visionBoostActive: false,
        currentSearchTarget: null,
        patrolRoute: [
          new THREE.Vector3(38, 0, 0),
          new THREE.Vector3(24, 0, 10.5),
          new THREE.Vector3(-24, 0, 10.5),
          new THREE.Vector3(-44, 0, 0),
          new THREE.Vector3(-44, 0, 29),
          new THREE.Vector3(0, 0, 29),
          new THREE.Vector3(38, 0, 29),
          new THREE.Vector3(38, 0, -34),
          new THREE.Vector3(-44, 0, -34),
        ],
        patrolIndex: 0,
        waypointsVisitedSinceSweep: 0,
        inVehicle: true,
        animPhase: 2.4,
        canSeePlayer: false,
      },
      {
        id: 'D',
        name: '特勤保安·阿杰',
        roleLabel: '参保特派机动增援与快速合围',
        rig: rigD,
        state: 'Patrol',
        position: new THREE.Vector3(-12, 0, 0),
        rotationY: 0,
        detectionProgress: 0,
        lastKnownPlayerPos: null,
        memoryTimer: 0,
        searchTimer: 0,
        escapeGraceTimer: 0,
        loseSightTimer: 0,
        hitStaggerTimer: 0,
        throwBoostTimer: 0,
        visionBoostActive: false,
        currentSearchTarget: null,
        patrolRoute: [
          new THREE.Vector3(-24, 0, 10.5),
          new THREE.Vector3(0, 0, 29),
          new THREE.Vector3(24, 0, -10.5),
          new THREE.Vector3(-44, 0, -10.5),
          new THREE.Vector3(12, 0, 0),
        ],
        patrolIndex: 0,
        waypointsVisitedSinceSweep: 0,
        inVehicle: true,
        animPhase: 1.8,
        canSeePlayer: false,
      },
      {
        id: 'E',
        name: '突击保安·铁柱',
        roleLabel: '参保重装防暴搜捕与巷道拦截',
        rig: rigE,
        state: 'Patrol',
        position: new THREE.Vector3(-12, 0, 0),
        rotationY: 0,
        detectionProgress: 0,
        lastKnownPlayerPos: null,
        memoryTimer: 0,
        searchTimer: 0,
        escapeGraceTimer: 0,
        loseSightTimer: 0,
        hitStaggerTimer: 0,
        throwBoostTimer: 0,
        visionBoostActive: false,
        currentSearchTarget: null,
        patrolRoute: [
          new THREE.Vector3(20, 0, 0),
          new THREE.Vector3(0, 0, -34),
          new THREE.Vector3(-44, 0, 10.5),
          new THREE.Vector3(38, 0, 29),
          new THREE.Vector3(-12, 0, -4),
        ],
        patrolIndex: 0,
        waypointsVisitedSinceSweep: 0,
        inVehicle: true,
        animPhase: 3.1,
        canSeePlayer: false,
      },
    ];

    const lkpGeo = new THREE.RingGeometry(0.9, 1.28, 24);
    lkpGeo.rotateX(-Math.PI / 2);
    this.lastKnownPositionMarker = new THREE.Mesh(
      lkpGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      })
    );
    this.lastKnownPositionMarker.position.y = 0.07;
    this.lastKnownPositionMarker.visible = false;
    scene.add(this.lastKnownPositionMarker);
  }

  private disposeObjectHierarchy(root: THREE.Object3D) {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => {
              if (mat && !mat.userData?.isSharedMat) mat.dispose();
            });
          } else if (!m.material.userData?.isSharedMat) {
            m.material.dispose();
          }
        }
      }
    });
  }

  public dispose() {
    this.monitors.forEach((m) => {
      this.scene.remove(m.rig.group);
      this.disposeObjectHierarchy(m.rig.group);
    });
    this.monitors = [];

    this.officers.forEach((o) => {
      this.scene.remove(o.rig.group);
      this.disposeObjectHierarchy(o.rig.group);
    });
    this.officers = [];

    this.scene.remove(this.carRig.group);
    this.disposeObjectHierarchy(this.carRig.group);

    this.scene.remove(this.lastKnownPositionMarker);
    this.disposeObjectHierarchy(this.lastKnownPositionMarker);
  }

  private setOfficerLastKnownPos(off: OfficerAgent, pos: THREE.Vector3) {
    if (off.lastKnownPlayerPos) {
      off.lastKnownPlayerPos.copy(pos);
    } else {
      off.lastKnownPlayerPos = pos.clone();
    }
  }

  public setStageConfig(stageId: StageId) {
    this.currentStageConfig = STAGE_CONFIGS[stageId] || STAGE_CONFIGS.stage_1;
    // Keep the forward direction & vision detector cone attached directly at the front bumper (z = 2.55)
    // and scale uniformly based on the 30.0m base geometry radius!
    const coneScale = this.currentStageConfig.carVisionRange / 30.0;
    this.carRig.carVisionConeMesh.scale.set(coneScale, 1, coneScale);
    this.carRig.carVisionConeMesh.position.set(0, 0.06, 2.55);
  }

  public prepareStrollPhase() {
    this.carPosition.set(46, 0, 0);
    this.carRotationY = -Math.PI / 2;
    this.carSpeed = 0;
    this.carHitDentTimer = 0;
    this.collectiveThrowBoostTimer = 0;
    this.completedTasksCount = 0;
    this.taskSpeedMultiplier = 1.0;
    this.deployedOfficerRemainingSec = 0;
    this.isOfficerDeployedFromCar = false;
    this.carDeployCooldown = 0;
    this.initialDeploymentCompleted = false;

    // 清理并释放街区监控仪 GPU 几何体与材质
    this.monitors.forEach((m) => {
      this.scene.remove(m.rig.group);
      this.disposeObjectHierarchy(m.rig.group);
    });
    this.monitors = [];
    this.monitorDropTimer = 18.0;

    this.campAnchorPos.set(-36, 0, 4);
    this.campTimer = 0;
    this.campExposureRatio = 0;
    this.campWarningSent = false;

    this.carRig.group.position.copy(this.carPosition);
    this.carRig.group.rotation.set(0, this.carRotationY, 0);
    this.carRig.slidingDoor.position.set(0, 0, 0);
    this.carRig.carVisionConeMesh.visible = true;
    this.carRig.directionDetectorGroup.visible = true;

    // 清理上一局动态扩容生成的额外特勤保安模型并释放 GPU 显存，恢复初始 5 人预备队
    if (this.officers.length > 5) {
      for (let i = 5; i < this.officers.length; i++) {
        this.scene.remove(this.officers[i].rig.group);
        this.disposeObjectHierarchy(this.officers[i].rig.group);
      }
      this.officers.length = 5;
    }
    this.totalDeployedGuardsCount = 3;

    this.officers.forEach((o) => {
      o.inVehicle = true;
      o.rig.group.visible = false;
      o.detectionProgress = 0;
      o.lastKnownPlayerPos = null;
      o.currentSearchTarget = null;
      o.escapeGraceTimer = 0;
      o.loseSightTimer = 0;
      o.hitStaggerTimer = 0;
      o.throwBoostTimer = 0;
      o.visionBoostActive = false;
      o.waypointsVisitedSinceSweep = 0;
      o.canSeePlayer = false;
      o.deployedRemainingSec = 0;
      o.returnTimer = 0;
    });

    this.carCanSeePlayer = false;
    this.carDetectionProgress = 0;
    this.carRadioAlertTimer = 0;
    this.carRadioMessage = null;
    this.escapeBannerTimer = 0;
    this.escapeBannerMessage = null;
    this.activeChaseLoseSightRatio = 0;
    this.activeChaseLoseSightRemainingSec = 0;
    this.activeChaserName = null;
    this.isChaserSeeingPlayer = false;
    this.isChaserVisionBoosted = false;
    this.activeChaserThrowBoostSec = 0;
    this.globalAlert = 0;
    this.timesSpotted = 0;
    this.lastKnownPositionMarker.visible = false;
  }

  /**
   * Guarantees that the Patrol Car and the initial on-foot security guards (老王, 小李, and 阿强 in Stage 3)
   * are properly positioned and deployed onto the street even if the player pressed ESC during Strolling or early Cutscene!
   */
  public completeArrivalDeployment() {
    if (this.initialDeploymentCompleted) return;
    this.initialDeploymentCompleted = true;

    this.carPosition.set(-12, 0, 0);
    this.carRotationY = -Math.PI / 2;
    this.carRig.group.position.copy(this.carPosition);
    this.carRig.group.rotation.set(0, this.carRotationY, 0);
    this.carRig.slidingDoor.position.set(0, 0, 0);
    this.carRig.carVisionConeMesh.visible = true;
    this.carRig.directionDetectorGroup.visible = true;
    this.carState = 'Patrol';
    this.currentWaypointIdx = 0;

    const offA = this.officers[0];
    if (offA) {
      offA.inVehicle = false;
      offA.rig.group.visible = true;
      offA.state = 'Patrol';
      offA.position.set(-14.5, 0, -4.2);
      offA.rotationY = -Math.PI * 0.7;
      offA.rig.group.position.copy(offA.position);
      offA.rig.group.rotation.y = offA.rotationY;
    }

    const offB = this.officers[1];
    if (offB) {
      offB.inVehicle = false;
      offB.rig.group.visible = true;
      offB.state = 'Patrol';
      offB.position.set(-7.5, 0, 8.2);
      offB.rotationY = Math.PI * 0.15;
      offB.rig.group.position.copy(offB.position);
      offB.rig.group.rotation.y = offB.rotationY;
    }

    for (let i = 2; i < this.officers.length; i++) {
      const off = this.officers[i];
      if (i === 2 && this.currentStageConfig.allThreeOfficersOnFoot) {
        off.inVehicle = false;
        off.rig.group.visible = true;
        off.state = 'Patrol';
        off.position.set(-12.0, 0, 5.2);
        off.rotationY = 0;
        off.rig.group.position.copy(off.position);
        off.rig.group.rotation.y = off.rotationY;
      } else {
        off.inVehicle = true;
        off.rig.group.visible = false;
        off.state = 'Patrol';
      }
    }
  }

  /**
   * Returns the minimum horizontal distance from the player to any security guard or the Patrol Car.
   * Used to drive the Proximity Heartbeat system (since guards/car are hidden from the minimap!).
   */
  public getMinThreatDistance(playerPos: THREE.Vector3): number {
    let minDist = Math.hypot(
      playerPos.x - this.carPosition.x,
      playerPos.z - this.carPosition.z
    );
    for (const off of this.officers) {
      if (off.inVehicle) continue;
      const d = Math.hypot(playerPos.x - off.position.x, playerPos.z - off.position.z);
      if (d < minDist) {
        minDist = d;
      }
    }
    return minDist;
  }

  /**
   * Triggered whenever the player completes a mission task (collects a document).
   * Permanently increases all security guards' movement & chase speed!
   */
  public onMissionTaskCompleted(completedCount: number, itemName: string) {
    this.completedTasksCount = completedCount;
    // +15% permanent speed boost per completed mission task (1st: +15%, 2nd: +30%, 3rd: +45%)
    this.taskSpeedMultiplier = 1 + completedCount * 0.15;
    this.globalAlert = Math.min(100, this.globalAlert + 18);
    soundFX.playTaskSpeedUpAlert();

    const pct = Math.round(completedCount * 15);
    this.carRadioAlertTimer = 3.2;
    this.carRadioMessage = `⚡ 已完成任务【${itemName}】(${completedCount}/3)！全员保安巡逻与追捕移速永久提升 +${pct}%！`;
  }

  public resetForArrivalCutscene() {
    this.prepareStrollPhase();
    this.cutsceneSoundFlags = {
      hornPlayed: false,
      doorPlayed: false,
      whistlePlayed: false,
    };
  }

  public updateArrivalCutscene(
    cutsceneTime: number,
    dt: number
  ): {
    captionTitle: string;
    captionSubtitle: string;
    cameraPos: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    finished: boolean;
  } {
    this.sirenPhase += dt * 15;
    const redOn = Math.sin(this.sirenPhase) > 0;
    this.carRig.sirenRedMesh.scale.setScalar(redOn ? 1.18 : 0.92);
    this.carRig.sirenBlueMesh.scale.setScalar(!redOn ? 1.18 : 0.92);
    this.carRig.sirenPointLight.color.setHex(redOn ? 0xef4444 : 0x3b82f6);
    this.carRig.sirenPointLight.intensity = 5.0;

    let captionTitle = '';
    let captionSubtitle = '';
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();

    if (cutsceneTime < 2.2) {
      if (!this.cutsceneSoundFlags.hornPlayed) {
        this.cutsceneSoundFlags.hornPlayed = true;
        soundFX.playVanArrivalHorn();
      }
      const t = THREE.MathUtils.clamp(cutsceneTime / 2.2, 0, 1);
      const easeOut = 1 - Math.pow(1 - t, 3);
      this.carPosition.x = THREE.MathUtils.lerp(42, -12, easeOut);
      this.carPosition.z = 0;
      this.carRotationY = -Math.PI / 2;

      this.carRig.group.position.copy(this.carPosition);
      this.carRig.group.rotation.y = this.carRotationY;

      const wheelSpin = (1 - t) * 20 * dt;
      this.carRig.wheels.forEach((w) => {
        w.rotation.x += wheelSpin;
      });

      camPos.set(this.carPosition.x - 9.5, 3.2, 8.2);
      camLook.set(this.carPosition.x + 1.5, 1.3, 0);

      captionTitle = '🚨 突发状况！一辆「参保直通车」疾驰冲入街区！';
      captionSubtitle = `全图环线巡航已启动（车载探照视野 ${this.currentStageConfig.carVisionRange}m），严禁在同一地点久留！`;
    } else if (cutsceneTime < 3.8) {
      this.carPosition.set(-12, 0, 0);
      this.carRig.group.position.copy(this.carPosition);

      if (!this.cutsceneSoundFlags.doorPlayed) {
        this.cutsceneSoundFlags.doorPlayed = true;
        soundFX.playDoorSlideOpen();
      }

      const doorT = THREE.MathUtils.clamp((cutsceneTime - 2.2) / 0.5, 0, 1);
      this.carRig.slidingDoor.position.z = THREE.MathUtils.lerp(0, -1.25, doorT);

      const deployT = THREE.MathUtils.clamp((cutsceneTime - 2.5) / 1.2, 0, 1);
      const offA = this.officers[0];
      const offB = this.officers[1];
      const offC = this.officers[2];

      offA.inVehicle = false;
      offA.rig.group.visible = true;
      offA.position.set(
        THREE.MathUtils.lerp(-12, -14.5, deployT),
        0,
        THREE.MathUtils.lerp(1.6, -4.2, deployT)
      );
      offA.rotationY = -Math.PI * 0.7;
      offA.rig.group.position.copy(offA.position);
      offA.rig.group.rotation.y = offA.rotationY;

      offB.inVehicle = false;
      offB.rig.group.visible = true;
      offB.position.set(
        THREE.MathUtils.lerp(-11, -7.5, deployT),
        0,
        THREE.MathUtils.lerp(1.6, 8.2, deployT)
      );
      offB.rotationY = Math.PI * 0.15;
      offB.rig.group.position.copy(offB.position);
      offB.rig.group.rotation.y = offB.rotationY;

      // Officer C (机动保安·阿强) remains stationed inside the Patrol Car, ready for rapid deployment when car spots player!
      offC.inVehicle = true;
      offC.rig.group.visible = false;

      const swing = Math.sin(cutsceneTime * 15) * 0.5;
      [offA, offB].forEach((o) => {
        if (!o.inVehicle) {
          o.rig.leftLeg.rotation.x = swing;
          o.rig.rightLeg.rotation.x = -swing;
        }
      });

      if (cutsceneTime >= 2.6 && !this.cutsceneSoundFlags.whistlePlayed) {
        this.cutsceneSoundFlags.whistlePlayed = true;
        soundFX.playGuardWhistle();
      }

      camPos.set(-18.5, 2.6, 8.2);
      camLook.set(-12, 1.4, 1.8);

      captionTitle = '👮 保安小队全图分片巡逻！动态热力排查每一处街角！';
      captionSubtitle =
        '保安队长·老王：“全场景拉网排查！谁要是在同一个地方久留，立刻包抄抓人！”';
    } else {
      const closeT = THREE.MathUtils.clamp((cutsceneTime - 3.8) / 0.5, 0, 1);
      this.carRig.slidingDoor.position.z = THREE.MathUtils.lerp(-1.25, 0, closeT);
      this.carRig.carVisionConeMesh.visible = true;

      const sweepT = THREE.MathUtils.clamp((cutsceneTime - 3.8) / 1.3, 0, 1);
      const smoothSweep = sweepT * sweepT * (3 - 2 * sweepT);
      camPos.lerpVectors(
        new THREE.Vector3(-18.5, 2.6, 8.2),
        new THREE.Vector3(-45, 7.5, 12),
        smoothSweep
      );
      camLook.lerpVectors(
        new THREE.Vector3(-12, 1.4, 1.8),
        new THREE.Vector3(-36, 1.3, 4),
        smoothSweep
      );

      captionTitle = '🪨 投掷石头/扳手触发保安 5~10 秒随机狂暴加速追逐！';
      captionSubtitle = `3份任务材料已随机分布在街区各处；离开视野并保持 ${this.currentStageConfig.loseSightThresholdSec.toFixed(1)} 秒即可甩开追捕！`;
    }

    if (cutsceneTime >= 5.2) {
      this.completeArrivalDeployment();
      return {
        captionTitle,
        captionSubtitle,
        cameraPos: camPos,
        cameraLookAt: camLook,
        finished: true,
      };
    }

    return {
      captionTitle,
      captionSubtitle,
      cameraPos: camPos,
      cameraLookAt: camLook,
      finished: false,
    };
  }

  /**
   * Finds the best target (Officer or Patrol Car) within effective throwing range.
   * - Enforces maximum effective range (Stone: 22m, Wrench: 18m).
   * - Returns inRange flag and distance for HUD targeting indicator.
   */
  public findBestThrowTarget(
    playerPos: THREE.Vector3,
    playerYaw: number,
    maxRange: number = 22.0
  ): ThrowTargetResult {
    _tmpForward.set(Math.sin(playerYaw), 0, Math.cos(playerYaw));
    let bestScore = Infinity;
    let closestDist = Infinity;
    let bestResult: ThrowTargetResult | null = null;

    // Check on-foot officers
    for (const off of this.officers) {
      if (off.inVehicle) continue;
      _tmpToTarget.subVectors(off.position, playerPos);
      _tmpToTarget.y = 0;
      const dist = _tmpToTarget.length();
      if (dist < closestDist) closestDist = dist;
      _tmpToTarget.normalize();
      const angle = _tmpForward.angleTo(_tmpToTarget); // 0..PI
      const score = dist * (1 + angle * 0.55);

      if (score < bestScore) {
        bestScore = score;
        bestResult = {
          hasTarget: true,
          inRange: dist <= maxRange,
          distance: dist,
          maxRange,
          targetType: 'officer',
          officerId: off.id,
          targetName: off.name,
          targetPos: off.position.clone().add(new THREE.Vector3(0, 1.35, 0)),
        };
      }
    }

    // Check Patrol Car ("参保直通车")
    _tmpToTarget.subVectors(this.carPosition, playerPos);
    _tmpToTarget.y = 0;
    const carDist = _tmpToTarget.length();
    if (carDist < closestDist) closestDist = carDist;
    _tmpToTarget.normalize();
    const carAngle = _tmpForward.angleTo(_tmpToTarget);
    const carScore = carDist * (1 + carAngle * 0.52);

    if (carScore < bestScore || !bestResult) {
      bestResult = {
        hasTarget: true,
        inRange: carDist <= maxRange,
        distance: carDist,
        maxRange,
        targetType: 'car',
        officerId: null,
        targetName: '参保直通车',
        targetPos: this.carPosition.clone().add(new THREE.Vector3(0, 1.25, 0)),
      };
    }

    return bestResult;
  }

  /**
   * Triggered when a thrown stone or wrench impacts an officer or the patrol car!
   * - Rolls a random 5.0 ~ 10.0 seconds speed boost duration!
   * - Hitting an officer triggers a 5-10s enraged speed boost chase for that officer!
   * - Hitting the patrol car ("参保直通车") triggers a 5-10s COLLECTIVE speed boost chase for ALL officers!
   */
  public applyThrowableImpact(
    targetType: 'officer' | 'car',
    officerId: OfficerId | null,
    _kind: ThrowableKind,
    playerPos: THREE.Vector3
  ): number {
    // 5.0s ~ 10.0s random acceleration duration!
    const randomBoostSec = Number((5.0 + Math.random() * 5.0).toFixed(1));
    this.lastRolledBoostSec = randomBoostSec;

    this.globalAlert = Math.min(100, Math.max(this.globalAlert, 88));
    this.timesSpotted += 1;
    this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
    this.lastKnownPositionMarker.visible = true;

    if (targetType === 'officer' && officerId) {
      soundFX.playHitOfficerBonk();
      const hitOff = this.officers.find((o) => o.id === officerId) || this.officers[0];
      hitOff.hitStaggerTimer = 0.22; // Quick 0.22s recoil, then immediate 5-10s enraged sprint!
      hitOff.throwBoostTimer = randomBoostSec;
      hitOff.state = 'Chase';
      hitOff.detectionProgress = 100;
      hitOff.loseSightTimer = 0;
      hitOff.escapeGraceTimer = 0;
      hitOff.lastKnownPlayerPos = playerPos.clone();

      this.carRadioAlertTimer = 3.0;
      this.carRadioMessage = `💢 ${hitOff.name} 被砸中激怒！触发 ${randomBoostSec.toFixed(1)} 秒随机狂暴加速追逐 (移速 +45%)！`;

      // Face the player who threw the item
      const dir = new THREE.Vector3().subVectors(playerPos, hitOff.position);
      if (dir.lengthSq() > 0.01) {
        hitOff.rotationY = Math.atan2(dir.x, dir.z);
      }
    } else {
      // Hit the Patrol Car ("参保直通车") -> 5-10s Random Collective Officer Speed-Boost Pursuit!
      soundFX.playHitCarDent();
      this.carHitDentTimer = 1.85;
      this.collectiveThrowBoostTimer = randomBoostSec;
      this.carRadioAlertTimer = 3.2;
      this.carRadioMessage = `💥 「参保直通车」被砸凹！触发全员保安 ${randomBoostSec.toFixed(1)} 秒集体狂暴加速追捕！`;

      // If Officer C is inside the van, deploy Officer C immediately!
      const offC = this.officers[2];
      if (offC.inVehicle) {
        offC.inVehicle = false;
        const sideOffset = new THREE.Vector3(2.3, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          this.carRotationY
        );
        offC.position.copy(this.carPosition).add(sideOffset);
        offC.rig.group.position.copy(offC.position);
        offC.rig.group.visible = true;
      }

      // ALL officers enter Chase toward the player with 5-10s random collective speed boost!
      this.officers.forEach((guard) => {
        if (!guard.inVehicle) {
          guard.state = 'Chase';
          guard.throwBoostTimer = randomBoostSec;
          guard.detectionProgress = 100;
          guard.loseSightTimer = 0;
          guard.escapeGraceTimer = 0;
          guard.lastKnownPlayerPos = playerPos.clone();
        }
      });
    }

    return randomBoostSec;
  }

  public update(
    dt: number,
    config: PlaystyleConfig,
    world: WorldData,
    playerPos: THREE.Vector3,
    isCrouching: boolean,
    isHidingInLocker: boolean,
    isInBush: boolean,
    stealthFactor: number = 1.0
  ): { captured: boolean; capturedBy: string | null; forceExitLocker: boolean } {
    // Safety guarantee: If gameplay started after pressing ESC during Strolling or Cutscene, ensure initial guards are deployed!
    if (!this.initialDeploymentCompleted) {
      this.completeArrivalDeployment();
    }

    this.sirenPhase += dt * (this.globalAlert >= 50 || this.carHitDentTimer > 0 ? 15 : 6);
    const redOn = Math.sin(this.sirenPhase) > 0;
    this.carRig.sirenRedMesh.scale.setScalar(redOn ? 1.14 : 0.94);
    this.carRig.sirenBlueMesh.scale.setScalar(!redOn ? 1.14 : 0.94);
    this.carRig.sirenPointLight.color.setHex(redOn ? 0xef4444 : 0x3b82f6);
    this.carRig.sirenPointLight.intensity =
      this.globalAlert >= 50 || this.carHitDentTimer > 0 ? 5.2 : 2.6;
    if (this.carRig.radarScannerGroup) {
      this.carRig.radarScannerGroup.rotation.y += dt * 3.8;
    }

    if (this.globalAlert >= 55) {
      soundFX.playSirenPulse(this.carPosition.distanceTo(playerPos));
    }

    if (this.carDeployCooldown > 0) {
      this.carDeployCooldown = Math.max(0, this.carDeployCooldown - dt);
    }
    if (this.carBroadcastCooldown > 0) {
      this.carBroadcastCooldown = Math.max(0, this.carBroadcastCooldown - dt);
    }
    if (this.carRadioAlertTimer > 0) {
      this.carRadioAlertTimer = Math.max(0, this.carRadioAlertTimer - dt);
      if (this.carRadioAlertTimer <= 0) {
        this.carRadioMessage = null;
      }
    }
    if (this.escapeBannerTimer > 0) {
      this.escapeBannerTimer = Math.max(0, this.escapeBannerTimer - dt);
      if (this.escapeBannerTimer <= 0) {
        this.escapeBannerMessage = null;
      }
    }
    if (this.carHitDentTimer > 0) {
      this.carHitDentTimer = Math.max(0, this.carHitDentTimer - dt);
    }
    if (this.collectiveThrowBoostTimer > 0) {
      this.collectiveThrowBoostTimer = Math.max(0, this.collectiveThrowBoostTimer - dt);
    }

    // ============================================================================
    // ANTI-CAMPING / LINGER HEAT SYSTEM (防止玩家一直待在同一个地方或亭子里不被发现)
    // ============================================================================
    let forceExitLocker = false;
    const distFromCampAnchor = Math.hypot(
      playerPos.x - this.campAnchorPos.x,
      playerPos.z - this.campAnchorPos.z
    );

    if (isHidingInLocker) {
      // 玩家躲入电话亭：清除原地挂机热力，保安立即散开！
      this.campTimer = 0;
      this.campExposureRatio = 0;
      this.campWarningSent = false;

      // 核心策划机制：玩家躲在电话亭中，保安应该散开了！
      this.officers.forEach((guard) => {
        guard.canSeePlayer = false;
        guard.detectionProgress = 0;
        guard.loseSightTimer = 0;
        guard.visionBoostActive = false;
        guard.lastKnownPlayerPos = null;

        if ((guard.id === 'C' || guard.id === 'D' || guard.id === 'E') && !guard.inVehicle) {
          guard.state = 'Return';
        } else if (guard.state === 'Chase' || guard.state === 'Investigate' || guard.state === 'Search') {
          guard.state = 'Baffled';
          guard.searchTimer = 1.2;
          // 寻找距离玩家最远的巡逻航点向外散开，绝不围堵电话亭！
          let farthestWp = guard.patrolRoute[0];
          let maxDist = 0;
          for (const wp of guard.patrolRoute) {
            const d = wp.distanceTo(playerPos);
            if (d > maxDist) {
              maxDist = d;
              farthestWp = wp;
            }
          }
          guard.currentSearchTarget = farthestWp.clone();
          guard.patrolIndex = (guard.patrolIndex + 1) % guard.patrolRoute.length;
        }
      });

      if (!this.wasHidingInLockerPrev) {
        this.wasHidingInLockerPrev = true;
        this.escapeBannerTimer = 3.5;
        this.escapeBannerMessage = '🤫 成功躲入电话亭！所有保安已丢失目标，正在向四周街区散开排查...';
        this.carRadioAlertTimer = 3.0;
        this.carRadioMessage = '📢 目标在街区失联！保安小队失去视野，已向各防区散开巡逻！';
        this.lastKnownPositionMarker.visible = false;
        this.globalAlert = Math.max(0, this.globalAlert - 35);
      }
    } else {
      this.wasHidingInLockerPrev = false;

      if (distFromCampAnchor <= 9.5) {
        // Player is staying within a 9.5m radius on open ground -> accumulate linger heat (full lock in 12s)
        this.campTimer = Math.min(12.0, this.campTimer + dt);
        this.campExposureRatio = THREE.MathUtils.clamp(this.campTimer / 12.0, 0, 1);

        // At 55% heat (~6.6s in one spot): warn player and redirect nearest patrolling officer toward player's sector!
        if (this.campExposureRatio >= 0.55 && !this.campWarningSent) {
          this.campWarningSent = true;
          this.carRadioAlertTimer = 3.0;
          this.carRadioMessage =
            '⚠️ 久留预警：你在同一区域停留过久，附近巡逻保安正朝你所在街区合围排查！';
          soundFX.playAlertPing('suspicious');

          const nearestGuard = this.findClosestOnFootOfficer(playerPos);
          if (nearestGuard && nearestGuard.state !== 'Chase') {
            nearestGuard.state = 'Search';
            nearestGuard.searchTimer = 7.5;
            nearestGuard.currentSearchTarget = this.findSearchPointNearPlayer(
              playerPos,
              world.searchPoints
            );
          }
        }

        // At 100% heat (12.0s in one spot): Full Anti-Camping Radar Lock!
        if (this.campTimer >= 12.0) {
          this.campTimer = 4.5;
          this.campWarningSent = false;
          this.globalAlert = Math.min(100, Math.max(this.globalAlert, 78));
          this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
          this.lastKnownPositionMarker.visible = true;

          this.carRadioAlertTimer = 3.4;
          this.carRadioMessage =
            '📡 参保大数据定位：检测到你在同一地点久留！保安小队已锁定坐标前来抓捕！';
          soundFX.playGuardWhistle();

          const campSnapshot = playerPos.clone();
          this.officers.forEach((guard) => {
            guard.lastKnownPlayerPos = campSnapshot.clone();
            if (guard.inVehicle && this.carState === 'Patrol') {
              this.carState = 'SlowDown';
            } else if (!guard.inVehicle && guard.state !== 'Chase') {
              guard.state = 'Investigate';
              guard.searchTimer = 9.0;
            }
          });
        }
      } else {
        // Player moved > 9.5m away -> update anchor and cool down linger heat!
        this.campAnchorPos.copy(playerPos);
        this.campTimer = Math.max(0, this.campTimer - dt * 2.6);
        this.campExposureRatio = THREE.MathUtils.clamp(this.campTimer / 12.0, 0, 1);
        if (this.campExposureRatio < 0.35) {
          this.campWarningSent = false;
        }
      }
    }

    this.updatePatrolCar(dt, world, playerPos);

    // 0. Update Street Surveillance Monitors placed along the road
    this.updateStreetMonitors(
      dt,
      playerPos,
      isCrouching,
      isHidingInLocker,
      isInBush,
      world.colliders
    );

    // 1. Check Patrol Car ("参保直通车") Long-Range Forward Vision Cone!
    const carSeesPlayer = this.checkCarVision(
      playerPos,
      isCrouching,
      isHidingInLocker,
      isInBush,
      world.colliders
    );
    this.carCanSeePlayer = carSeesPlayer;

    let anySeeingPlayer = carSeesPlayer;

    if (carSeesPlayer) {
      this.carDetectionProgress = Math.min(100, this.carDetectionProgress + 85 * dt);
      this.carRig.carVisionConeMat.color.setHex(0xef4444);
      this.carRig.carVisionConeMat.opacity = 0.28;

      this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
      this.lastKnownPositionMarker.visible = true;
      this.globalAlert = Math.min(100, Math.max(this.globalAlert, 75));

      // 核心策划机制：保安人数不限总数！只要参保车视野锁定玩家，立即开门下放新保安！
      if (this.carDetectionProgress >= 70 && this.carDeployCooldown <= 0) {
        this.deployNextOfficerFromCar(playerPos, world.colliders, 'car_spotted');
      }

      if (this.carBroadcastCooldown <= 0) {
        this.carBroadcastCooldown = 3.8;
        soundFX.playGuardWhistle();

        const carSpottedSnapshot = playerPos.clone();
        this.officers.forEach((guard) => {
          guard.lastKnownPlayerPos = carSpottedSnapshot.clone();
          if (!guard.inVehicle && guard.state !== 'Chase') {
            guard.state = 'Investigate';
            guard.searchTimer = 6.5;
          }
        });
      }
    } else {
      this.carDetectionProgress = Math.max(0, this.carDetectionProgress - 50 * dt);
      this.carRig.carVisionConeMat.color.setHex(0x60a5fa);
      this.carRig.carVisionConeMat.opacity = 0.15;
    }

    // 2. Check On-Foot Security Guards Vision & Threshold-Based Pursuit Mechanic
    const baseVisionRange =
      (this.globalAlert >= 75 ? config.highAlertVisionRange : config.normalVisionRange) *
      this.currentStageConfig.officerVisionMultiplier;
    const halfAngleRad = THREE.MathUtils.degToRad(config.visionAngleDeg * 0.5);
    const loseSightThreshold = this.currentStageConfig.loseSightThresholdSec;

    let trackedChaser: OfficerAgent | null = null;

    // Pre-populate active on-foot officers buffer once per frame to avoid O(N^2) array allocations
    this._activeOfficersBuffer.length = 0;
    for (let i = 0; i < this.officers.length; i++) {
      const o = this.officers[i];
      if (!o.inVehicle) {
        this._activeOfficersBuffer.push(o);
      }
    }

    for (const off of this.officers) {
      if (off.inVehicle) {
        off.position.copy(this.carPosition);
        off.rig.group.visible = false;
        off.canSeePlayer = false;
        continue;
      }

      off.rig.group.visible = true;

      if (off.escapeGraceTimer > 0) {
        off.escapeGraceTimer = Math.max(0, off.escapeGraceTimer - dt);
      }
      if (off.hitStaggerTimer > 0) {
        off.hitStaggerTimer = Math.max(0, off.hitStaggerTimer - dt);
      }
      if (off.throwBoostTimer > 0) {
        off.throwBoostTimer = Math.max(0, off.throwBoostTimer - dt);
      }

      const guardVisionRange =
        off.escapeGraceTimer > 0 ? baseVisionRange * 0.45 : baseVisionRange;

      const seesPlayer = this.checkOfficerVision(
        off,
        playerPos,
        isCrouching,
        isHidingInLocker && !forceExitLocker,
        isInBush,
        guardVisionRange,
        halfAngleRad,
        world.colliders
      );

      off.canSeePlayer = seesPlayer;

      if (seesPlayer) {
        anySeeingPlayer = true;
        // 玩家进入保安视野：立即重置脱离计时，并激活“视野加速追逐”直到玩家彻底摆脱视野！
        off.loseSightTimer = 0;
        off.visionBoostActive = true;
        off.detectionProgress = 100;
        this.globalAlert = Math.min(100, Math.max(this.globalAlert + 35 * dt, 78));

        if (off.state !== 'Chase') {
          off.state = 'Chase';
          this.timesSpotted += 1;
          soundFX.playAlertPing('spotted');
          if (this.carRadioAlertTimer <= 0) {
            this.carRadioAlertTimer = 2.8;
            this.carRadioMessage = `👁️ 进入 ${off.name} 视野！保安已开启视野加速追捕 (+38%移速)，摆脱视野后才减速！`;
          }
        }
        this.setOfficerLastKnownPos(off, playerPos);
        this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
        this.lastKnownPositionMarker.visible = true;
      } else {
        // ====================================================================
        // 核心玩法策划：玩家离开保安视野时，保安仍然继续保持视野加速追逐！
        // 只有当玩家离开视野累计达到设定阈值 (loseSightThresholdSec) 时，保安才解除加速并放弃追逐！
        // ====================================================================
        if (off.state === 'Chase') {
          off.visionBoostActive = true; // 摆脱视野前持续保持加速！

          if (isHidingInLocker && !forceExitLocker) {
            off.loseSightTimer += dt * 2.5;
          } else {
            const distToGuard = off.position.distanceTo(playerPos);
            const distanceBonus = distToGuard > 20 ? 1.45 : 1.0;
            off.loseSightTimer += dt * distanceBonus;
          }

          if (
            off.loseSightTimer < loseSightThreshold * 0.65 &&
            (!isHidingInLocker || forceExitLocker)
          ) {
            this.setOfficerLastKnownPos(off, playerPos);
            this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
            this.lastKnownPositionMarker.visible = true;
          }

          if (off.loseSightTimer >= loseSightThreshold) {
            off.state = 'Baffled';
            off.searchTimer = 2.0;
            off.loseSightTimer = 0;
            off.throwBoostTimer = 0;
            off.visionBoostActive = false; // 成功摆脱视野！解除保安视野加速！
            off.lastKnownPlayerPos = null;
            off.detectionProgress = 0;
            off.escapeGraceTimer = 2.8;
            this.lastKnownPositionMarker.visible = false;

            this.escapeBannerTimer = 2.8;
            this.escapeBannerMessage = `💨 摆脱视野满 ${loseSightThreshold.toFixed(1)} 秒！${off.name} 已停止视野加速并放弃追捕！`;
          }
        } else {
          off.visionBoostActive = false;
          off.detectionProgress = Math.max(0, off.detectionProgress - 60 * dt);
          if (off.state === 'Observe' && off.detectionProgress <= 5) {
            off.state =
              off.id === 'C' && !this.currentStageConfig.allThreeOfficersOnFoot
                ? 'Return'
                : 'Patrol';
          }
        }
      }

      if (off.state === 'Chase') {
        if (!trackedChaser || off.loseSightTimer < trackedChaser.loseSightTimer) {
          trackedChaser = off;
        }
      }

      this.updateOfficerBehavior(off, dt, world, playerPos);

      if ((!isHidingInLocker || forceExitLocker) && off.hitStaggerTimer <= 0) {
        const distToPlayer = off.position.distanceTo(playerPos);
        if (
          distToPlayer <= WORLD_CONFIG.captureDistance &&
          (off.state === 'Chase' || (seesPlayer && off.detectionProgress >= 75))
        ) {
          soundFX.playCaptured();
          return { captured: true, capturedBy: off.name, forceExitLocker };
        }
      }
    }

    // Resolve inter-officer separation so security guards never clip/overlap into each other ("合体")!
    this.resolveOfficerSeparation(dt, world.colliders);

    // 核心策划设计：保安人数不限总数，每位下车特勤保安拥有独立的 22 秒搜查寿命
    // 若期间发现玩家则刷新延长搜捕时间；若 22 秒未见目标则有序返回参保车归队！
    this._deployedGuardsBuffer.length = 0;
    for (let i = 0; i < this.officers.length; i++) {
      const o = this.officers[i];
      if (!o.inVehicle && (o.deployedFromCar || o.id === 'C' || o.id === 'D' || o.id === 'E')) {
        this._deployedGuardsBuffer.push(o);
      }
    }
    if (this._deployedGuardsBuffer.length > 0) {
      let maxRemaining = 0;
      let anyReturning = false;
      for (let i = 0; i < this._deployedGuardsBuffer.length; i++) {
        const g = this._deployedGuardsBuffer[i];
        if (g.canSeePlayer || (g.state === 'Chase' && g.loseSightTimer < 2.0)) {
          g.deployedRemainingSec = Math.max(g.deployedRemainingSec || 0, 20.0);
        } else {
          g.deployedRemainingSec = Math.max(0, (g.deployedRemainingSec ?? 20.0) - dt);
          if (g.deployedRemainingSec <= 0 && g.state !== 'Chase' && g.state !== 'Return') {
            g.state = 'Return';
            g.returnTimer = 0;
            g.searchTimer = 0;
            g.lastKnownPlayerPos = null;
            g.visionBoostActive = false;
          }
        }
        if (g.state !== 'Return') {
          maxRemaining = Math.max(maxRemaining, g.deployedRemainingSec || 0);
        } else {
          anyReturning = true;
        }
      }
      this.deployedOfficerRemainingSec = maxRemaining;
      this.isOfficerDeployedFromCar = maxRemaining > 0;
      if (maxRemaining <= 0 && anyReturning && this.carRadioAlertTimer <= 0) {
        this.carRadioAlertTimer = 3.5;
        this.carRadioMessage = '📢 搜查期满未发现目标，下车特勤保安正在返回参保车归队！';
      }
    } else {
      this.isOfficerDeployedFromCar = false;
      this.deployedOfficerRemainingSec = 0;
    }

    if (trackedChaser) {
      this.activeChaserName = trackedChaser.name;
      this.isChaserSeeingPlayer = trackedChaser.canSeePlayer;
      this.isChaserVisionBoosted = trackedChaser.visionBoostActive;
      this.activeChaserThrowBoostSec = Math.max(
        trackedChaser.throwBoostTimer,
        this.collectiveThrowBoostTimer
      );
      this.activeChaseLoseSightRatio = THREE.MathUtils.clamp(
        trackedChaser.loseSightTimer / loseSightThreshold,
        0,
        1
      );
      this.activeChaseLoseSightRemainingSec = Math.max(
        0,
        loseSightThreshold - trackedChaser.loseSightTimer
      );
    } else {
      this.activeChaserName = null;
      this.isChaserSeeingPlayer = false;
      this.isChaserVisionBoosted = false;
      this.activeChaserThrowBoostSec = 0;
      this.activeChaseLoseSightRatio = 0;
      this.activeChaseLoseSightRemainingSec = 0;
    }

    if (!anySeeingPlayer && !trackedChaser && this.globalAlert > 0) {
      this.globalAlert = Math.max(0, this.globalAlert - config.alertDecayPerSec * dt);
      if (this.globalAlert < 20) {
        this.lastKnownPositionMarker.visible = false;
      }
    }

    return { captured: false, capturedBy: null, forceExitLocker };
  }

  private updatePatrolCar(dt: number, world: WorldData, playerPos: THREE.Vector3) {
    const targetNode = this.route[this.currentWaypointIdx];
    const distToWp = this.carPosition.distanceTo(targetNode.pos);
    const offC = this.officers[2];
    const carBoost = this.collectiveThrowBoostTimer > 0 ? 1.38 : 1.0;
    const speedMul =
      this.currentStageConfig.carSpeedMultiplier * this.taskSpeedMultiplier * carBoost;

    // If collective speed boost is triggered (hit by stone/wrench), immediately break out into pursuit patrol!
    if (this.collectiveThrowBoostTimer > 0 && this.carState !== 'Patrol') {
      this.carState = 'Patrol';
      this.carSpeed = 5.8 * speedMul;
    }

    switch (this.carState) {
      case 'Patrol': {
        this.carRig.slidingDoor.position.z = THREE.MathUtils.damp(
          this.carRig.slidingDoor.position.z,
          0,
          8,
          dt
        );
        // 核心反馈优化：参保车行动太快了，调整为逼真平稳、富有压迫感的街区巡逻速度
        // 平时匀速巡查 3.4m/s (~12km/h)；高警报/全图搜捕时提升到 5.2m/s (~18km/h)
        const targetSpeed = (this.globalAlert >= 50 ? 5.2 : 3.4) * speedMul;
        this.carSpeed = THREE.MathUtils.damp(this.carSpeed, targetSpeed, 3.5, dt);
        this.moveCarAlongRoute(targetNode.pos, dt);

        // 核心策划机制：参保车巡逻时适量布设监控侦测器（场上最多 2 台，间隔 28~34 秒）
        if (this.carSpeed > 1.2 && this.monitors.length < 2) {
          this.monitorDropTimer -= dt;
          if (this.monitorDropTimer <= 0) {
            this.monitorDropTimer = 28.0 + Math.random() * 6.0;
            this.dropStreetMonitor(world.colliders);
          }
        }

        // Advance to next waypoint with a generous 3.2m threshold so car never loops or gets stuck
        if (distToWp < 3.2) {
          this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.route.length;
        }
        break;
      }

      case 'SlowDown': {
        this.carSpeed = THREE.MathUtils.damp(this.carSpeed, 1.2, 5, dt);
        this.moveCarAlongRoute(targetNode.pos, dt);
        this.stateTimer -= dt;
        if (distToWp < 2.2 || this.stateTimer <= 0) {
          this.carSpeed = 0;
          this.carState = 'Stop';
          this.stateTimer = this.globalAlert >= 50 ? 0.8 : Math.min(2.2, targetNode.stopDuration * 0.5);
        }
        break;
      }

      case 'Stop': {
        this.carSpeed = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (!this.currentStageConfig.allThreeOfficersOnFoot && offC.inVehicle) {
            this.carState = 'Deploy';
            this.stateTimer = 0.6;
          } else {
            this.carState = 'Resume';
            this.stateTimer = 0.4;
          }
        }
        break;
      }

      case 'Deploy': {
        this.carSpeed = 0;
        this.carRig.slidingDoor.position.z = THREE.MathUtils.damp(
          this.carRig.slidingDoor.position.z,
          -1.2,
          10,
          dt
        );
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (offC.inVehicle) {
            offC.inVehicle = false;
            const sideOffset = new THREE.Vector3(2.3, 0, 0).applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              this.carRotationY
            );
            offC.position.copy(this.carPosition).add(sideOffset);
            offC.rotationY = this.carRotationY;
            offC.rig.group.position.copy(offC.position);
            offC.rig.group.visible = true;

            if (offC.lastKnownPlayerPos) {
              offC.state = 'Investigate';
              offC.searchTimer = 6.0;
            } else {
              offC.state = 'Search';
              offC.searchTimer = 5.5;
              offC.currentSearchTarget = this.findSearchPointNearPlayer(
                playerPos,
                world.searchPoints
              );
            }
          }
          this.carState = 'Search';
          this.stateTimer = 3.2; // Maximum 3.2s pause before resuming patrol!
        }
        break;
      }

      case 'Search': {
        this.carSpeed = 0;
        this.stateTimer -= dt;
        // Officer returned OR search timer expired (never freeze!) -> resume cruising!
        if (this.stateTimer <= 0 || offC.inVehicle || offC.state === 'Return') {
          this.carState = 'Resume';
          this.stateTimer = 0.45;
        }
        break;
      }

      case 'Return': {
        this.carSpeed = 0;
        const distOfficerToCar = offC.position.distanceTo(this.carPosition);
        if (distOfficerToCar < 2.8 || offC.inVehicle) {
          offC.inVehicle = true;
          offC.rig.group.visible = false;
          this.carState = 'Resume';
          this.stateTimer = 0.45;
        } else {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            this.carState = 'Resume';
            this.stateTimer = 0.45;
          }
        }
        break;
      }

      case 'Resume': {
        this.carRig.slidingDoor.position.z = THREE.MathUtils.damp(
          this.carRig.slidingDoor.position.z,
          0,
          10,
          dt
        );
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.route.length;
          this.carState = 'Patrol';
        }
        break;
      }
    }

    this.carRig.group.position.copy(this.carPosition);
    this.carRig.group.rotation.y = this.carRotationY;

    // 3D Impact Dent / Shake effect when hit by a stone or wrench!
    if (this.carHitDentTimer > 0) {
      const shake = Math.sin(performance.now() * 0.045) * 0.08 * (this.carHitDentTimer / 1.85);
      this.carRig.group.rotation.z = shake;
      this.carRig.group.rotation.x = -Math.abs(shake) * 0.6;
    } else {
      this.carRig.group.rotation.z = 0;
      this.carRig.group.rotation.x = 0;
    }

    this.carRig.wheels.forEach((w) => {
      w.rotation.x += this.carSpeed * dt * 1.4;
    });
  }

  private moveCarAlongRoute(target: THREE.Vector3, dt: number) {
    _moveVec.subVectors(target, this.carPosition);
    _moveVec.y = 0;
    const dist = _moveVec.length();
    if (dist > 0.05) {
      _moveVec.normalize();
      const desiredYaw = Math.atan2(_moveVec.x, _moveVec.z);
      let diff = desiredYaw - this.carRotationY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.carRotationY += diff * Math.min(1, dt * 6);

      const step = Math.min(dist, this.carSpeed * dt);
      this.carPosition.addScaledVector(_moveVec, step);
    }
  }

  /**
   * High-performance analytical Slab Ray-vs-AABB intersection test.
   * Tests whether a ray from eye to target intersects any building/prop collider.
   * Replaces heavy recursive mesh raycasting, reducing CPU usage by >85% and preventing overheating!
   */
  private checkLineOccludedByColliders(
    eye: THREE.Vector3,
    target: THREE.Vector3,
    colliders: ColliderBox[]
  ): boolean {
    const dx = target.x - eye.x;
    const dy = target.y - eye.y;
    const dz = target.z - eye.z;
    const maxDist = Math.hypot(dx, dy, dz);
    if (maxDist < 0.25) return false;

    const invLen = 1 / maxDist;
    const rdx = dx * invLen;
    const rdy = dy * invLen;
    const rdz = dz * invLen;

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (!c.blocksVision) continue;
      const minY = 0.0;
      const maxY = c.height || 14.0;

      let tmin = 0;
      let tmax = maxDist;

      // X slab
      if (Math.abs(rdx) > 1e-6) {
        const invDx = 1 / rdx;
        let t1 = (c.minX - eye.x) * invDx;
        let t2 = (c.maxX - eye.x) * invDx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      } else if (eye.x < c.minX || eye.x > c.maxX) {
        continue;
      }

      // Y slab
      if (Math.abs(rdy) > 1e-6) {
        const invDy = 1 / rdy;
        let t1 = (minY - eye.y) * invDy;
        let t2 = (maxY - eye.y) * invDy;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      } else if (eye.y < minY || eye.y > maxY) {
        continue;
      }

      // Z slab
      if (Math.abs(rdz) > 1e-6) {
        const invDz = 1 / rdz;
        let t1 = (c.minZ - eye.z) * invDz;
        let t2 = (c.maxZ - eye.z) * invDz;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      } else if (eye.z < c.minZ || eye.z > c.maxZ) {
        continue;
      }

      if (tmax >= 0.25 && tmin <= maxDist - 0.25) {
        return true; // Occluded by building/wall AABB!
      }
    }

    return false;
  }

  private checkCarVision(
    playerPos: THREE.Vector3,
    isCrouching: boolean,
    isHidingInLocker: boolean,
    isInBush: boolean,
    colliders: ColliderBox[]
  ): boolean {
    if (isHidingInLocker) return false;

    const maxCarRange = this.currentStageConfig.carVisionRange;
    const effectiveRange =
      isInBush && isCrouching
        ? maxCarRange * 0.35
        : isInBush
        ? maxCarRange * 0.65
        : maxCarRange;

    _dirToPlayer.subVectors(playerPos, this.carPosition);
    _dirToPlayer.y = 0;
    const dist = _dirToPlayer.length();
    if (dist > effectiveRange || dist < 1.2) return false;

    _dirToPlayer.normalize();
    _forwardVec.set(Math.sin(this.carRotationY), 0, Math.cos(this.carRotationY));
    const angle = _forwardVec.angleTo(_dirToPlayer);
    const halfCarConeRad = THREE.MathUtils.degToRad(55);
    if (angle > halfCarConeRad) return false;

    _eyePos.set(
      this.carPosition.x + Math.sin(this.carRotationY) * 1.6,
      1.75,
      this.carPosition.z + Math.cos(this.carRotationY) * 1.6
    );
    _targetPos.set(playerPos.x, isCrouching ? 0.72 : 1.42, playerPos.z);

    return !this.checkLineOccludedByColliders(_eyePos, _targetPos, colliders);
  }

  private checkOfficerVision(
    off: OfficerAgent,
    playerPos: THREE.Vector3,
    isCrouching: boolean,
    isHidingInLocker: boolean,
    isInBush: boolean,
    maxDistance: number,
    halfAngleRad: number,
    colliders: ColliderBox[]
  ): boolean {
    if (isHidingInLocker) return false;

    const effectiveRange =
      isInBush && isCrouching
        ? maxDistance * 0.3
        : isInBush
        ? maxDistance * 0.58
        : maxDistance;

    _dirToPlayer.subVectors(playerPos, off.position);
    _dirToPlayer.y = 0;
    const dist = _dirToPlayer.length();
    if (dist > effectiveRange || dist < 0.05) return false;

    _dirToPlayer.normalize();
    _forwardVec.set(Math.sin(off.rotationY), 0, Math.cos(off.rotationY));
    const angle = _forwardVec.angleTo(_dirToPlayer);
    if (angle > halfAngleRad) return false;

    _eyePos.set(off.position.x, 1.6, off.position.z);
    _targetPos.set(playerPos.x, isCrouching ? 0.72 : 1.42, playerPos.z);

    return !this.checkLineOccludedByColliders(_eyePos, _targetPos, colliders);
  }

  private updateOfficerBehavior(
    off: OfficerAgent,
    dt: number,
    world: WorldData,
    playerPos: THREE.Vector3
  ) {
    // If just hit by a thrown stone or wrench, play brief dizzy stagger recoil in 3D before charging!
    if (off.hitStaggerTimer > 0) {
      const wobble = Math.sin(performance.now() * 0.035) * 0.38;
      off.rig.group.position.copy(off.position);
      off.rig.group.rotation.y = off.rotationY;
      off.rig.group.rotation.z = wobble * 0.35;
      off.rig.leftArm.rotation.x = -1.8 + wobble;
      off.rig.rightArm.rotation.x = -1.6 - wobble;
      off.rig.visionConeMat.color.setHex(0xef4444);
      off.rig.visionConeMat.opacity = 0.28;
      off.rig.alertRingMesh.visible = true;
      return;
    } else {
      off.rig.group.rotation.z = 0;
    }

    let moveSpeed = 0;
    let targetPoint: THREE.Vector3 | null = null;
    // Combine stage speed multiplier + permanent task completion speed multiplier
    const spdMul =
      this.currentStageConfig.officerSpeedMultiplier * this.taskSpeedMultiplier;
    // 5-10s Random Throw Impact Sprint Boost (+45% chase speed when hit by stone/wrench or collective car hit!)
    const throwSprintMul = off.throwBoostTimer > 0 ? 1.45 : 1.0;

    const isVehicleGuard = Boolean(
      off.deployedFromCar || off.id === 'C' || off.id === 'D' || off.id === 'E'
    );
    const guardIndex = Math.max(0, this._activeOfficersBuffer.indexOf(off));
    const totalActiveGuards = Math.max(1, this._activeOfficersBuffer.length);

    switch (off.state) {
      case 'Patrol': {
        moveSpeed = 2.65 * spdMul;
        if (off.patrolRoute.length > 0 && (!isVehicleGuard || this.currentStageConfig.allThreeOfficersOnFoot)) {
          targetPoint = off.patrolRoute[off.patrolIndex];
          if (off.position.distanceTo(targetPoint) < 1.35) {
            off.patrolIndex = (off.patrolIndex + 1) % off.patrolRoute.length;
            off.waypointsVisitedSinceSweep += 1;

            // Every 2 patrol waypoints, dynamically sweep a waypoint near the player's current sector
            if (off.waypointsVisitedSinceSweep >= 2 && world.searchPoints.length > 0) {
              off.waypointsVisitedSinceSweep = 0;
              off.currentSearchTarget = this.findSearchPointNearPlayer(
                playerPos,
                world.searchPoints
              );
              off.state = 'Search';
              off.searchTimer = 6.5;
            } else {
              off.state = 'Observe';
              off.searchTimer = 1.2;
            }
          }
        } else {
          off.state = 'Return';
        }
        break;
      }

      case 'Observe': {
        moveSpeed = 0;
        off.rotationY += Math.sin(performance.now() * 0.0025) * 0.75 * dt;
        off.searchTimer -= dt;
        if (off.searchTimer <= 0 && !off.canSeePlayer) {
          off.state = isVehicleGuard ? 'Return' : 'Patrol';
        }
        break;
      }

      case 'Baffled': {
        moveSpeed = 0;
        off.rotationY += Math.sin(performance.now() * 0.006) * 1.4 * dt;
        off.searchTimer -= dt;
        if (off.searchTimer <= 0) {
          off.lastKnownPlayerPos = null;
          off.state = isVehicleGuard ? 'Return' : 'Patrol';
        }
        break;
      }

      case 'Investigate': {
        moveSpeed = 3.4 * spdMul;
        // 360度动态扇形排查：不论场上有多少名保安，按序号分散包抄，绝对防止挤在一起合体！
        if (off.lastKnownPlayerPos) {
          if (guardIndex === 0) {
            targetPoint = off.lastKnownPlayerPos;
          } else {
            const angle = (guardIndex / totalActiveGuards) * Math.PI * 2;
            const spreadDist = 1.55 + (guardIndex % 3) * 0.45;
            targetPoint = _tmpToTarget.set(
              off.lastKnownPlayerPos.x + Math.sin(angle) * spreadDist,
              0,
              off.lastKnownPlayerPos.z + Math.cos(angle) * spreadDist
            );
          }
        }
        off.searchTimer -= dt;
        if (
          !targetPoint ||
          off.position.distanceTo(targetPoint) < 1.8 ||
          off.searchTimer <= 0
        ) {
          off.lastKnownPlayerPos = null;
          off.state = isVehicleGuard ? 'Return' : 'Patrol';
        }
        break;
      }

      case 'Search': {
        moveSpeed = 3.0 * spdMul;
        targetPoint = off.currentSearchTarget;
        off.searchTimer -= dt;
        if (!targetPoint || off.position.distanceTo(targetPoint) < 1.6) {
          off.rotationY += 1.6 * dt;
        }
        if (off.searchTimer <= 0) {
          off.lastKnownPlayerPos = null;
          off.state = isVehicleGuard ? 'Return' : 'Patrol';
        }
        break;
      }

      case 'Chase': {
        // 玩家进入保安视野时触发视野加速 (visionSprintMul = 1.38x)，直到彻底摆脱视野阈值才解除！
        // 若同时被石头/扳手砸中，再叠加 5-10s 随机狂暴加速！
        const visionSprintMul = off.visionBoostActive ? 1.38 : 1.0;
        const extraThrowMul = off.throwBoostTimer > 0 ? 1.25 : 1.0;
        moveSpeed = 3.85 * spdMul * visionSprintMul * extraThrowMul;

        // 核心策划机制：360度环形战术合围与防合体（支持任意无限数量保安同时围捕！）
        if (off.canSeePlayer) {
          if (guardIndex === 0) {
            targetPoint = playerPos; // 排头保安正面突击
          } else {
            const angle = (guardIndex / totalActiveGuards) * Math.PI * 2;
            const spreadDist = 1.6 + (guardIndex % 3) * 0.45;
            targetPoint = _tmpToTarget.set(
              playerPos.x + Math.sin(angle) * spreadDist,
              0,
              playerPos.z + Math.cos(angle) * spreadDist
            );
          }
        } else if (off.lastKnownPlayerPos) {
          if (guardIndex === 0) {
            targetPoint = off.lastKnownPlayerPos;
          } else {
            const angle = (guardIndex / totalActiveGuards) * Math.PI * 2;
            const spreadDist = 1.5 + (guardIndex % 3) * 0.4;
            targetPoint = _tmpToTarget.set(
              off.lastKnownPlayerPos.x + Math.sin(angle) * spreadDist,
              0,
              off.lastKnownPlayerPos.z + Math.cos(angle) * spreadDist
            );
          }
          if (off.position.distanceTo(off.lastKnownPlayerPos) < 1.2) {
            off.rotationY += Math.sin(performance.now() * 0.008) * 2.2 * dt;
          }
        } else {
          off.state = 'Baffled';
          off.searchTimer = 1.2;
          targetPoint = null;
        }
        break;
      }

      case 'Return': {
        moveSpeed = 3.4 * spdMul;
        off.returnTimer = (off.returnTimer || 0) + dt;
        targetPoint = isVehicleGuard
          ? this.carPosition
          : off.patrolRoute[off.patrolIndex] || this.carPosition;
        if (
          isVehicleGuard &&
          (off.position.distanceTo(this.carPosition) < 3.5 || (off.returnTimer || 0) > 16.0)
        ) {
          off.inVehicle = true;
          off.rig.group.visible = false;
          off.state = 'Patrol';
          off.returnTimer = 0;
          const anyDeployedStillOut = this.officers.some(
            (o) =>
              (o.deployedFromCar || o.id === 'C' || o.id === 'D' || o.id === 'E') && !o.inVehicle
          );
          if (!anyDeployedStillOut) {
            this.isOfficerDeployedFromCar = false;
            this.deployedOfficerRemainingSec = 0;
            this.carRig.slidingDoor.position.z = 0; // Door closes
          }
          this.carState = 'Resume';
          this.stateTimer = 0.45;
          this.carRadioAlertTimer = 3.5;
          this.carRadioMessage = `✅ 保安【${off.name}】已安全归队上车，参保直通车继续全图街区巡逻！`;
        } else if (!isVehicleGuard && targetPoint && off.position.distanceTo(targetPoint) < 1.5) {
          off.state = 'Patrol';
        }
        break;
      }
    }

    if (targetPoint && moveSpeed > 0) {
      _moveVec.subVectors(targetPoint, off.position);
      _moveVec.y = 0;
      const dist = _moveVec.length();
      if (dist > 0.1) {
        _moveVec.normalize();
        const desiredYaw = Math.atan2(_moveVec.x, _moveVec.z);
        let diff = desiredYaw - off.rotationY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        off.rotationY += diff * Math.min(1, dt * 5.2);

        this.moveAgentWithCollision(off.position, _moveVec, moveSpeed * dt, world.colliders);
      }
    }

    // Anti-Stuck Check: Always guarantee agent is pushed out of any building/obstacle colliders!
    this.resolveColliderPenetration(off.position, 0.52, world.colliders);

    off.rig.group.position.copy(off.position);
    off.rig.group.rotation.y = off.rotationY;

    if (moveSpeed > 0.1) {
      off.animPhase += dt * moveSpeed * 2.6;
      const swing = Math.sin(off.animPhase) * 0.45;
      off.rig.leftLeg.rotation.x = swing;
      off.rig.rightLeg.rotation.x = -swing;
      off.rig.leftArm.rotation.x = -swing * 0.6;
      off.rig.rightArm.rotation.x = swing * 0.4;
    } else {
      off.rig.leftLeg.rotation.x = 0;
      off.rig.rightLeg.rotation.x = 0;
      off.rig.leftArm.rotation.x = 0;
      off.rig.rightArm.rotation.x = 0;
    }

    if (off.state === 'Chase' || off.detectionProgress >= 80) {
      off.rig.visionConeMat.color.setHex(0xef4444);
      off.rig.visionConeMat.opacity = 0.25;
      off.rig.alertRingMesh.visible = true;
      (off.rig.alertRingMesh.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
    } else if (
      off.state === 'Investigate' ||
      off.state === 'Baffled' ||
      off.detectionProgress >= 25
    ) {
      off.rig.visionConeMat.color.setHex(0xf59e0b);
      off.rig.visionConeMat.opacity = 0.17;
      off.rig.alertRingMesh.visible = true;
      (off.rig.alertRingMesh.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
    } else {
      off.rig.visionConeMat.color.setHex(0x38bdf8);
      off.rig.visionConeMat.opacity = 0.13;
      off.rig.alertRingMesh.visible = false;
    }
  }

  /**
  * Drops a Surveillance Monitor / Camera Tripod from the Patrol Car onto the street
  */
  public dropStreetMonitor(colliders: ColliderBox[]) {
    if (this.monitors.length >= 2) {
      const oldest = this.monitors.shift();
      if (oldest) {
        this.scene.remove(oldest.rig.group);
        this.disposeObjectHierarchy(oldest.rig.group);
      }
    }

    const sideOffset = new THREE.Vector3(2.2, 0, -1.8).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.carRotationY
    );
    const monitorPos = this.carPosition.clone().add(sideOffset);
    monitorPos.y = 0;
    this.resolveColliderPenetration(monitorPos, 0.6, colliders);

    const rig = createStreetMonitorModel(this.mats);
    rig.group.position.copy(monitorPos);
    this.scene.add(rig.group);

    const monitor: ActiveStreetMonitor = {
      id: `mon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      rig,
      position: monitorPos,
      baseYaw: this.carRotationY + Math.PI / 2,
      sweepAngle: 0,
      sweepDirection: 1,
      detectionRadius: 7.5,
      isTriggered: false,
    };
    this.monitors.push(monitor);
    soundFX.playMonitorDeploy();

    this.carRadioAlertTimer = 3.8;
    this.carRadioMessage =
      '📡 参保直通车在路面布设了【红外扫描监控仪】！探测到违规未参保人员将调遣特勤保安！';
  }

  public removeMonitor(monitor: ActiveStreetMonitor) {
    this.scene.remove(monitor.rig.group);
    this.disposeObjectHierarchy(monitor.rig.group);
    this.monitors = this.monitors.filter((m) => m.id !== monitor.id);
  }

  /**
   * Updates street surveillance monitors placed by the patrol car.
   * Sweeps scanning cone, checks player proximity & line-of-sight.
   * When player is spotted: alarms, removes the monitor, and deploys a security guard!
   */
  public updateStreetMonitors(
    dt: number,
    playerPos: THREE.Vector3,
    isCrouching: boolean,
    isHidingInLocker: boolean,
    isInBush: boolean,
    colliders: ColliderBox[]
  ) {
    if (this.monitors.length === 0) return;

    for (let i = this.monitors.length - 1; i >= 0; i--) {
      const m = this.monitors[i];
      if (m.isTriggered) continue;

      // Sweep camera head left and right (+- 42 degrees)
      m.sweepAngle += dt * 1.5 * m.sweepDirection;
      if (Math.abs(m.sweepAngle) > 0.75) {
        m.sweepDirection *= -1;
        m.sweepAngle = Math.sign(m.sweepAngle) * 0.75;
      }
      m.rig.cameraHead.rotation.y = m.baseYaw + m.sweepAngle;

      // Status LED pulse
      const isBlink = (Date.now() % 500) < 250;
      (m.rig.statusLed.material as THREE.MeshBasicMaterial).color.setHex(
        isBlink ? 0x38bdf8 : 0x0284c7
      );

      // Player in telephone booth is immune!
      if (isHidingInLocker) continue;

      // Detection check
      const effectiveRange =
        isInBush && isCrouching ? 2.8 : isInBush ? 4.0 : isCrouching ? 5.2 : m.detectionRadius;

      _dirToPlayer.subVectors(playerPos, m.position);
      _dirToPlayer.y = 0;
      const dist = _dirToPlayer.length();

      if (dist <= effectiveRange && dist > 0.1) {
        _dirToPlayer.normalize();
        const camYaw = m.baseYaw + m.sweepAngle;
        _forwardVec.set(Math.sin(camYaw), 0, Math.cos(camYaw));
        const angle = _forwardVec.angleTo(_dirToPlayer);
        const halfCone = THREE.MathUtils.degToRad(45);

        if (angle <= halfCone) {
          _eyePos.set(m.position.x, 1.45, m.position.z);
          _targetPos.set(playerPos.x, isCrouching ? 0.72 : 1.42, playerPos.z);

          if (!this.checkLineOccludedByColliders(_eyePos, _targetPos, colliders)) {
            // DETECTED BY MONITOR!
            m.isTriggered = true;
            m.rig.scanConeMat.color.setHex(0xef4444);
            (m.rig.statusLed.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);

            soundFX.playMonitorTriggerAlarm();
            soundFX.playGuardWhistle();

            this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
            this.lastKnownPositionMarker.visible = true;
            this.globalAlert = Math.min(100, Math.max(this.globalAlert, 80));

            // 核心策划：保安人数不限总数！只要监控仪发现玩家，立即移除该监控仪并从参保车下放一位新保安！
            const deployed = this.deployNextOfficerFromCar(
              playerPos,
              colliders,
              'monitor_triggered'
            );
            const activeCount = this.getActiveOnFootCount();
            this.escapeBannerTimer = 4.2;
            this.escapeBannerMessage = `🚨 街区监控仪锁定你的坐标！监测器已自毁移除，参保车紧急下放【${deployed.name}】（场上共 ${activeCount} 名保安围捕中）！`;

            // Remove this monitor from the map immediately!
            this.removeMonitor(m);
          }
        }
      }
    }
  }

  /**
   * Deploys a security guard from the Patrol Car!
   * 核心策划：保安人数不限总数！只要被发现（车载视野或路面监控仪触发），参保车就会持续下放新保安！
   * 策划平衡优化：每位下放保安拥有独立的 22 秒搜查寿命，发现玩家则延长，未发现则归队上车！
   */
  public deployNextOfficerFromCar(
    playerPos: THREE.Vector3,
    colliders: ColliderBox[],
    reason: 'car_spotted' | 'monitor_triggered' = 'car_spotted'
  ): OfficerAgent {
    // 车门开启下车动作缓冲（3.2秒），不限制保安总人数
    this.carDeployCooldown = 3.2;

    // 1. 优先唤醒车内待命的机动保安
    let guardToDeploy = this.officers.find(
      (o) => o.inVehicle && (o.deployedFromCar || o.id === 'C' || o.id === 'D' || o.id === 'E')
    );

    // 2. 若车内预备队员已全部在地面搜捕，且总池未达上限（16人），则动态扩容；若已达16人池上限，则复用最远的一名机动保安重新从车门下放（兼顾无限下放体验与显存安全！）
    if (!guardToDeploy && this.officers.length >= 16) {
      guardToDeploy =
        this.officers.find((o) => o.deployedFromCar && o.state === 'Return') ||
        this.officers.find((o) => o.deployedFromCar && !o.canSeePlayer) ||
        this.officers[this.officers.length - 1];
    }

    if (!guardToDeploy) {
      this.totalDeployedGuardsCount += 1;
      const num = this.totalDeployedGuardsCount;
      const roleTypes: Array<'searcher' | 'observer' | 'captain'> = [
        'searcher',
        'observer',
        'captain',
      ];
      const newRig = createOfficerModel(this.mats, roleTypes[num % roleTypes.length]);
      newRig.group.visible = true;
      this.scene.add(newRig.group);

      const namesPool = [
        '阿强',
        '阿杰',
        '铁柱',
        '大勇',
        '志强',
        '建国',
        '振华',
        '少平',
        '浩然',
        '子轩',
      ];
      const guardTitle = `特勤${num < 10 ? '0' + num : num}·${namesPool[(num - 1) % namesPool.length]}`;

      guardToDeploy = {
        id: `D_${num}`,
        name: guardTitle,
        roleLabel: '参保车无限增援特勤组',
        rig: newRig,
        state: 'Chase',
        position: this.carPosition.clone(),
        rotationY: this.carRotationY,
        detectionProgress: 85,
        lastKnownPlayerPos: playerPos.clone(),
        memoryTimer: 0,
        searchTimer: 22.0,
        escapeGraceTimer: 0,
        loseSightTimer: 0,
        hitStaggerTimer: 0,
        throwBoostTimer: 0,
        visionBoostActive: true,
        currentSearchTarget: null,
        patrolRoute: [
          new THREE.Vector3(-44, 0, 0),
          new THREE.Vector3(0, 0, -34),
          new THREE.Vector3(38, 0, 0),
          new THREE.Vector3(0, 0, 29),
        ],
        patrolIndex: num % 4,
        waypointsVisitedSinceSweep: 0,
        inVehicle: false,
        animPhase: (num * 0.7) % 6.28,
        canSeePlayer: false,
        deployedFromCar: true,
        deployedRemainingSec: 22.0,
        returnTimer: 0,
      };
      this.officers.push(guardToDeploy);
    } else {
      guardToDeploy.inVehicle = false;
      guardToDeploy.deployedFromCar = true;
      guardToDeploy.deployedRemainingSec = 22.0;
      guardToDeploy.returnTimer = 0;
    }

    this.isOfficerDeployedFromCar = true;
    this.deployedOfficerRemainingSec = Math.max(this.deployedOfficerRemainingSec, 22.0);

    // Disembark beside the patrol car sliding door on open road with slight offset per guard so they never spawn on top of each other
    const activeCount = this.getActiveOnFootCount();
    const zJitter = ((activeCount % 3) - 1) * 0.9;
    const sideOffset = new THREE.Vector3(2.5, 0, zJitter).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.carRotationY
    );
    guardToDeploy.position.copy(this.carPosition).add(sideOffset);
    this.resolveColliderPenetration(guardToDeploy.position, 0.55, colliders);
    guardToDeploy.rotationY = this.carRotationY;
    guardToDeploy.rig.group.position.copy(guardToDeploy.position);
    guardToDeploy.rig.group.visible = true;

    // Immediately sprint towards target location with vision boost!
    this.setOfficerLastKnownPos(guardToDeploy, playerPos);
    guardToDeploy.state = 'Chase';
    guardToDeploy.searchTimer = 22.0;
    guardToDeploy.loseSightTimer = 0;
    guardToDeploy.visionBoostActive = true;
    guardToDeploy.detectionProgress = 85;

    // Push apart immediately if another officer is nearby
    this.resolveOfficerSeparation(0.016, colliders);

    // Van pauses and opens sliding door
    this.carState = 'Deploy';
    this.stateTimer = 2.0;
    this.carSpeed = 0;
    this.carRig.slidingDoor.position.z = -1.2;

    const totalOnFoot = this.getActiveOnFootCount();
    this.carRadioAlertTimer = 4.5;
    if (reason === 'monitor_triggered') {
      this.carRadioMessage = `🚨 街区监控仪警报！参保车已紧急下放【${guardToDeploy.name}】！当前场上共 ${totalOnFoot} 名保安围捕中！`;
    } else {
      this.carRadioMessage = `🚨 参保车视野锁定目标！已紧急下放【${guardToDeploy.name}】！当前场上共 ${totalOnFoot} 名保安围捕中！`;
    }

    soundFX.playGuardWhistle();
    soundFX.playDoorSlideOpen();

    return guardToDeploy;
  }

  public deployOfficerCFor20sPatrol(playerPos: THREE.Vector3, colliders: ColliderBox[]) {
    this.deployNextOfficerFromCar(playerPos, colliders, 'car_spotted');
  }

  /**
   * Anti-Clipping & Anti-Merging / Separation Steering (保安不能合体):
   * Ensures security officers NEVER overlap or clip into one another.
   * If two active guards are within 1.35m, gently pushes them apart.
   */
  public resolveOfficerSeparation(_dt: number, colliders: ColliderBox[]) {
    this._activeOfficersBuffer.length = 0;
    for (let i = 0; i < this.officers.length; i++) {
      const o = this.officers[i];
      if (!o.inVehicle && o.rig.group.visible) {
        this._activeOfficersBuffer.push(o);
      }
    }
    const activeOfficers = this._activeOfficersBuffer;
    const minSpacing = 1.35; // Minimum 1.35 meters between officers

    for (let i = 0; i < activeOfficers.length; i++) {
      for (let j = i + 1; j < activeOfficers.length; j++) {
        const o1 = activeOfficers[i];
        const o2 = activeOfficers[j];
        const dx = o1.position.x - o2.position.x;
        const dz = o1.position.z - o2.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < minSpacing * minSpacing) {
          const dist = Math.max(0.001, Math.sqrt(distSq));
          const overlap = minSpacing - dist;
          const pushDist = overlap * 0.5;

          let nx = dx / dist;
          let nz = dz / dist;
          if (dist < 0.05) {
            nx = Math.cos(i + 1);
            nz = Math.sin(i + 1);
          }

          o1.position.x += nx * pushDist;
          o1.position.z += nz * pushDist;
          o2.position.x -= nx * pushDist;
          o2.position.z -= nz * pushDist;
        }
      }
    }

    // Safety resolution to ensure agents aren't pushed inside obstacles
    for (let i = 0; i < activeOfficers.length; i++) {
      const o = activeOfficers[i];
      this.resolveColliderPenetration(o.position, 0.52, colliders);
      o.rig.group.position.copy(o.position);
    }
  }

  /**
   * Anti-Stuck Collider Penetration Resolution:
   * Smoothly pushes agent out of building or obstacle box colliders to the nearest open street boundary
   */
  public resolveColliderPenetration(
    pos: THREE.Vector3,
    radius: number,
    colliders: ColliderBox[]
  ) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        pos.x + radius > c.minX &&
        pos.x - radius < c.maxX &&
        pos.z + radius > c.minZ &&
        pos.z - radius < c.maxZ
      ) {
        const dLeft = pos.x + radius - c.minX;
        const dRight = c.maxX - (pos.x - radius);
        const dNear = pos.z + radius - c.minZ;
        const dFar = c.maxZ - (pos.z - radius);
        const minD = Math.min(dLeft, dRight, dNear, dFar);

        if (minD === dLeft) {
          pos.x = c.minX - radius - 0.08;
        } else if (minD === dRight) {
          pos.x = c.maxX + radius + 0.08;
        } else if (minD === dNear) {
          pos.z = c.minZ - radius - 0.08;
        } else {
          pos.z = c.maxZ + radius + 0.08;
        }
      }
    }
  }

  private moveAgentWithCollision(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    step: number,
    colliders: ColliderBox[]
  ) {
    const radius = 0.52;

    // Ensure agent is not already inside a wall
    this.resolveColliderPenetration(pos, radius, colliders);

    const nextX = pos.x + dir.x * step;
    if (!this.collidesAt(nextX, pos.z, radius, colliders)) {
      pos.x = nextX;
    } else {
      // Wall sliding along Z with wall avoidance
      const slideZDir = Math.abs(dir.z) > 0.08 ? Math.sign(dir.z) : 1;
      const slideZ = pos.z + slideZDir * step * 0.9;
      if (!this.collidesAt(pos.x, slideZ, radius, colliders)) {
        pos.z = slideZ;
      }
    }

    const nextZ = pos.z + dir.z * step;
    if (!this.collidesAt(pos.x, nextZ, radius, colliders)) {
      pos.z = nextZ;
    } else {
      // Wall sliding along X with wall avoidance
      const slideXDir = Math.abs(dir.x) > 0.08 ? Math.sign(dir.x) : 1;
      const slideX = pos.x + slideXDir * step * 0.9;
      if (!this.collidesAt(slideX, pos.z, radius, colliders)) {
        pos.x = slideX;
      }
    }

    // Safety resolution to eliminate any penetration
    this.resolveColliderPenetration(pos, radius, colliders);
  }

  private collidesAt(x: number, z: number, r: number, colliders: ColliderBox[]): boolean {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  private findClosestOnFootOfficer(playerPos: THREE.Vector3): OfficerAgent | null {
    let best: OfficerAgent | null = null;
    let bestDist = Infinity;
    for (const off of this.officers) {
      if (off.inVehicle) continue;
      const d = off.position.distanceTo(playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = off;
      }
    }
    return best;
  }

  private findSearchPointNearPlayer(
    playerPos: THREE.Vector3,
    points: THREE.Vector3[]
  ): THREE.Vector3 {
    if (points.length === 0) return playerPos.clone();
    let best = points[0];
    let bestScore = Infinity;
    for (const p of points) {
      const d = playerPos.distanceTo(p);
      // Prefer a search waypoint within 6m ~ 16m of the player's current sector
      const score = Math.abs(d - 9.0) + Math.random() * 5.0;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best.clone();
  }
}
