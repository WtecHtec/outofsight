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
  OfficerRig,
  PatrolCarRig,
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

export interface OfficerAgent {
  id: 'A' | 'B' | 'C';
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
}

const _raycaster = new THREE.Raycaster();
const _eyePos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _dirToPlayer = new THREE.Vector3();
const _forwardVec = new THREE.Vector3();
const _moveVec = new THREE.Vector3();

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

  public officers: OfficerAgent[] = [];
  public globalAlert = 0;
  public timesSpotted = 0;
  public lastKnownPositionMarker: THREE.Mesh;
  public currentStageConfig: StageConfig = STAGE_CONFIGS.stage_1;

  // Full-Map 9-Stop Grand Loop for the "参保直通车" (Covers Central, North, East, South, and West Districts!)
  private route: WaypointNode[] = [
    { pos: new THREE.Vector3(-44, 0, 0), isStopPoint: true, stopDuration: 2.8, label: '商业街西路口' },
    { pos: new THREE.Vector3(-44, 0, -34), isStopPoint: false, stopDuration: 0, label: '西北联排街角' },
    { pos: new THREE.Vector3(0, 0, -34), isStopPoint: true, stopDuration: 2.6, label: '北区公寓中路' },
    { pos: new THREE.Vector3(38, 0, -34), isStopPoint: true, stopDuration: 2.8, label: '东北晴空广场' },
    { pos: new THREE.Vector3(38, 0, 0), isStopPoint: true, stopDuration: 3.0, label: '东侧地铁前路口' },
    { pos: new THREE.Vector3(38, 0, 29), isStopPoint: true, stopDuration: 2.8, label: '东南咖啡街角' },
    { pos: new THREE.Vector3(0, 0, 29), isStopPoint: true, stopDuration: 2.6, label: '南区拱廊中路' },
    { pos: new THREE.Vector3(-44, 0, 29), isStopPoint: false, stopDuration: 0, label: '西南商业街角' },
    { pos: new THREE.Vector3(-12, 0, 0), isStopPoint: true, stopDuration: 3.0, label: '中央商业大道' },
  ];

  private sirenPhase = 0;
  private cutsceneSoundFlags = {
    hornPlayed: false,
    doorPlayed: false,
    whistlePlayed: false,
  };

  constructor(scene: THREE.Scene, mats: MaterialLibrary) {
    // 1. "参保直通车" Van with Long-Range Forward Vision Cone
    this.carRig = createPatrolCarModel(mats);
    this.carRig.group.position.copy(this.carPosition);
    scene.add(this.carRig.group);

    // 2. Three Security Guards (保安队长·老王, 巡街保安·小李, 机动保安·阿强)
    const rigA = createOfficerModel(mats, 'captain');
    const rigB = createOfficerModel(mats, 'observer');
    const rigC = createOfficerModel(mats, 'searcher');

    scene.add(rigA.group, rigB.group, rigC.group);

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
        // Full-map cross-sector patrol route covering West Spawn, North Courtyard, Central, and South-West
        patrolRoute: [
          new THREE.Vector3(-38, 0, 4),
          new THREE.Vector3(-36, 0, -10),
          new THREE.Vector3(-26, 0, -29),
          new THREE.Vector3(8, 0, -29),
          new THREE.Vector3(0, 0, -9),
          new THREE.Vector3(-28, 0, 10),
          new THREE.Vector3(-36, 0, 28),
          new THREE.Vector3(-14, 0, 4),
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
        // Full-map cross-sector patrol route covering South Arcade, East Metro, North-East Plaza, and Central
        patrolRoute: [
          new THREE.Vector3(-14, 0, 29),
          new THREE.Vector3(22, 0, 29),
          new THREE.Vector3(38, 0, 16),
          new THREE.Vector3(28, 0, 9),
          new THREE.Vector3(28, 0, -10),
          new THREE.Vector3(30, 0, -29),
          new THREE.Vector3(6, 0, 9),
          new THREE.Vector3(-22, 0, -9),
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
        roleLabel: '全图机动突击与盲区搜捕',
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
        // Full-map diagonal sweep route
        patrolRoute: [
          new THREE.Vector3(36, 0, 18),
          new THREE.Vector3(14, 0, 29),
          new THREE.Vector3(-28, 0, 29),
          new THREE.Vector3(-38, 0, 4),
          new THREE.Vector3(-32, 0, -29),
          new THREE.Vector3(24, 0, -29),
          new THREE.Vector3(36, 0, -8),
        ],
        patrolIndex: 0,
        waypointsVisitedSinceSweep: 0,
        inVehicle: true,
        animPhase: 2.4,
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

  public setStageConfig(stageId: StageId) {
    this.currentStageConfig = STAGE_CONFIGS[stageId] || STAGE_CONFIGS.stage_1;
    const coneScaleZ = this.currentStageConfig.carVisionRange / 19.0;
    this.carRig.carVisionConeMesh.scale.set(1.22, 1, coneScaleZ);
    this.carRig.carVisionConeMesh.position.set(
      0,
      0.06,
      2.4 + (19.0 * coneScaleZ) / 2
    );
  }

  public prepareStrollPhase() {
    this.carPosition.set(46, 0, 0);
    this.carRotationY = -Math.PI / 2;
    this.carSpeed = 0;
    this.carHitDentTimer = 0;
    this.collectiveThrowBoostTimer = 0;
    this.completedTasksCount = 0;
    this.taskSpeedMultiplier = 1.0;
    this.campAnchorPos.set(-36, 0, 4);
    this.campTimer = 0;
    this.campExposureRatio = 0;
    this.campWarningSent = false;

    this.carRig.group.position.copy(this.carPosition);
    this.carRig.group.rotation.set(0, this.carRotationY, 0);
    this.carRig.slidingDoor.position.set(0, 0, 0);
    this.carRig.carVisionConeMesh.visible = false;

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

      if (this.currentStageConfig.allThreeOfficersOnFoot) {
        offC.inVehicle = false;
        offC.rig.group.visible = true;
        offC.position.set(
          THREE.MathUtils.lerp(-10, -2.5, deployT),
          0,
          THREE.MathUtils.lerp(1.6, -7.5, deployT)
        );
        offC.rotationY = -Math.PI * 0.35;
        offC.rig.group.position.copy(offC.position);
        offC.rig.group.rotation.y = offC.rotationY;
      }

      const swing = Math.sin(cutsceneTime * 15) * 0.5;
      [offA, offB, offC].forEach((o) => {
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
      this.carRig.slidingDoor.position.set(0, 0, 0);
      this.carRig.carVisionConeMesh.visible = true;
      this.carState = 'Patrol';
      this.currentWaypointIdx = 0;
      this.officers[0].inVehicle = false;
      this.officers[0].state = 'Patrol';
      this.officers[1].inVehicle = false;
      this.officers[1].state = 'Patrol';
      if (this.currentStageConfig.allThreeOfficersOnFoot) {
        this.officers[2].inVehicle = false;
        this.officers[2].state = 'Patrol';
        this.officers[2].rig.group.visible = true;
      } else {
        this.officers[2].inVehicle = true;
        this.officers[2].rig.group.visible = false;
      }
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
   * Finds the best target (Officer or Patrol Car) when the player throws a stone/wrench
   */
  public findBestThrowTarget(
    playerPos: THREE.Vector3,
    playerYaw: number
  ): {
    targetType: 'officer' | 'car';
    officerId: 'A' | 'B' | 'C' | null;
    targetName: string;
    targetPos: THREE.Vector3;
  } {
    const forward = new THREE.Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw));
    let bestScore = Infinity;
    let bestResult: {
      targetType: 'officer' | 'car';
      officerId: 'A' | 'B' | 'C' | null;
      targetName: string;
      targetPos: THREE.Vector3;
    } | null = null;

    // Check on-foot officers
    for (const off of this.officers) {
      if (off.inVehicle) continue;
      const toOff = new THREE.Vector3().subVectors(off.position, playerPos);
      toOff.y = 0;
      const dist = toOff.length();
      toOff.normalize();
      const angle = forward.angleTo(toOff); // 0..PI
      const score = dist * (1 + angle * 0.55);
      if (score < bestScore) {
        bestScore = score;
        bestResult = {
          targetType: 'officer',
          officerId: off.id,
          targetName: off.name,
          targetPos: off.position.clone().add(new THREE.Vector3(0, 1.35, 0)),
        };
      }
    }

    // Check Patrol Car ("参保直通车")
    const toCar = new THREE.Vector3().subVectors(this.carPosition, playerPos);
    toCar.y = 0;
    const carDist = toCar.length();
    toCar.normalize();
    const carAngle = forward.angleTo(toCar);
    const carScore = carDist * (1 + carAngle * 0.52);

    if (carScore < bestScore || !bestResult) {
      bestResult = {
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
    officerId: 'A' | 'B' | 'C' | null,
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
    this.sirenPhase += dt * (this.globalAlert >= 50 || this.carHitDentTimer > 0 ? 15 : 6);
    const redOn = Math.sin(this.sirenPhase) > 0;
    this.carRig.sirenRedMesh.scale.setScalar(redOn ? 1.14 : 0.94);
    this.carRig.sirenBlueMesh.scale.setScalar(!redOn ? 1.14 : 0.94);
    this.carRig.sirenPointLight.color.setHex(redOn ? 0xef4444 : 0x3b82f6);
    this.carRig.sirenPointLight.intensity =
      this.globalAlert >= 50 || this.carHitDentTimer > 0 ? 5.2 : 2.6;

    if (this.globalAlert >= 55) {
      soundFX.playSirenPulse(this.carPosition.distanceTo(playerPos));
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

    if (distFromCampAnchor <= 9.5) {
      // Player is staying within a 9.5m radius -> accumulate linger heat (full lock in 12s)
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
        this.campTimer = 4.5; // Reset partially so if they still don't move, it re-locks quickly
        this.campWarningSent = false;
        this.globalAlert = Math.min(100, Math.max(this.globalAlert, 78));
        this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
        this.lastKnownPositionMarker.visible = true;

        if (isHidingInLocker) {
          forceExitLocker = true;
        }

        this.carRadioAlertTimer = 3.4;
        this.carRadioMessage =
          '📡 参保大数据定位：检测到你在同一地点久留！保安小队已锁定坐标前来抓捕！';
        soundFX.playGuardWhistle();

        // Dispatch Patrol Car and On-Foot Guards directly to the camping player's coordinates!
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

    this.updatePatrolCar(dt, world, playerPos);

    // 1. Check Patrol Car ("参保直通车") Long-Range Forward Vision Cone!
    const carSeesPlayer = this.checkCarVision(
      playerPos,
      isCrouching,
      isHidingInLocker && !forceExitLocker,
      isInBush,
      world.occluderMeshes
    );
    this.carCanSeePlayer = carSeesPlayer;

    let anySeeingPlayer = carSeesPlayer;

    if (carSeesPlayer) {
      this.carDetectionProgress = Math.min(100, this.carDetectionProgress + 90 * dt);
      this.carRig.carVisionConeMat.color.setHex(0xef4444);
      this.carRig.carVisionConeMat.opacity = 0.28;

      this.lastKnownPositionMarker.position.set(playerPos.x, 0.07, playerPos.z);
      this.lastKnownPositionMarker.visible = true;
      this.globalAlert = Math.min(100, Math.max(this.globalAlert, 65));

      if (this.carBroadcastCooldown <= 0) {
        this.carBroadcastCooldown = 3.8;
        this.carRadioAlertTimer = 3.2;
        this.carRadioMessage = `📡 「参保直通车」远距雷达（${this.currentStageConfig.carVisionRange}m）锁定目标！呼叫保安追击！`;
        soundFX.playGuardWhistle();

        const carSpottedSnapshot = playerPos.clone();
        this.officers.forEach((guard) => {
          guard.lastKnownPlayerPos = carSpottedSnapshot.clone();
          if (guard.inVehicle && this.carState === 'Patrol') {
            this.carState = 'SlowDown';
          } else if (!guard.inVehicle && guard.state !== 'Chase') {
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
        world.occluderMeshes
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
        off.lastKnownPlayerPos = playerPos.clone();
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
            off.lastKnownPlayerPos = playerPos.clone();
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

    switch (this.carState) {
      case 'Patrol': {
        this.carRig.slidingDoor.position.z = THREE.MathUtils.damp(
          this.carRig.slidingDoor.position.z,
          0,
          8,
          dt
        );
        const targetSpeed = (this.globalAlert >= 50 ? 12.0 : 9.2) * speedMul;
        this.carSpeed = THREE.MathUtils.damp(this.carSpeed, targetSpeed, 4, dt);
        this.moveCarAlongRoute(targetNode.pos, dt);

        // Stop & deploy Officer C if near a stop point where the player is in the same half of the map, or if alert is active
        const playerNearStop = targetNode.pos.distanceTo(playerPos) < 34;
        if (
          !this.currentStageConfig.allThreeOfficersOnFoot &&
          distToWp < 6.5 &&
          ((targetNode.isStopPoint && playerNearStop) || offC.lastKnownPlayerPos !== null)
        ) {
          this.carState = 'SlowDown';
        } else if (distToWp < 2.0) {
          this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.route.length;
        }
        break;
      }

      case 'SlowDown': {
        this.carSpeed = THREE.MathUtils.damp(this.carSpeed, 1.5, 5, dt);
        this.moveCarAlongRoute(targetNode.pos, dt);
        if (distToWp < 2.0 || offC.lastKnownPlayerPos !== null) {
          this.carSpeed = 0;
          this.carState = 'Stop';
          this.stateTimer = this.globalAlert >= 50 ? 0.5 : targetNode.stopDuration * 0.4;
        }
        break;
      }

      case 'Stop': {
        this.carSpeed = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.carState = 'Deploy';
          this.stateTimer = 0.6;
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
        }
        break;
      }

      case 'Search': {
        this.carSpeed = 0;
        if (!offC.inVehicle && offC.state === 'Return') {
          this.carState = 'Return';
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

  private checkCarVision(
    playerPos: THREE.Vector3,
    isCrouching: boolean,
    isHidingInLocker: boolean,
    isInBush: boolean,
    occluderMeshes: THREE.Object3D[]
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

    _dirToPlayer.subVectors(_targetPos, _eyePos);
    const rayLength = _dirToPlayer.length();
    _dirToPlayer.normalize();

    _raycaster.set(_eyePos, _dirToPlayer);
    _raycaster.near = 0.3;
    _raycaster.far = rayLength;

    const hits = _raycaster.intersectObjects(occluderMeshes, true);
    return hits.length === 0;
  }

  private checkOfficerVision(
    off: OfficerAgent,
    playerPos: THREE.Vector3,
    isCrouching: boolean,
    isHidingInLocker: boolean,
    isInBush: boolean,
    maxDistance: number,
    halfAngleRad: number,
    occluderMeshes: THREE.Object3D[]
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

    _dirToPlayer.subVectors(_targetPos, _eyePos);
    const rayLength = _dirToPlayer.length();
    _dirToPlayer.normalize();

    _raycaster.set(_eyePos, _dirToPlayer);
    _raycaster.near = 0.2;
    _raycaster.far = rayLength;

    const hits = _raycaster.intersectObjects(occluderMeshes, true);
    return hits.length === 0;
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

    switch (off.state) {
      case 'Patrol': {
        moveSpeed = 2.65 * spdMul;
        if (off.id !== 'C' || this.currentStageConfig.allThreeOfficersOnFoot) {
          targetPoint = off.patrolRoute[off.patrolIndex];
          if (off.position.distanceTo(targetPoint) < 1.35) {
            off.patrolIndex = (off.patrolIndex + 1) % off.patrolRoute.length;
            off.waypointsVisitedSinceSweep += 1;

            // Every 2 patrol waypoints, dynamically sweep a waypoint near the player's current sector
            // so no corner of the map is ever a permanent blind spot!
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
          off.state =
            off.id === 'C' && !this.currentStageConfig.allThreeOfficersOnFoot
              ? 'Return'
              : 'Patrol';
        }
        break;
      }

      case 'Baffled': {
        moveSpeed = 0;
        off.rotationY += Math.sin(performance.now() * 0.006) * 1.4 * dt;
        off.searchTimer -= dt;
        if (off.searchTimer <= 0) {
          off.lastKnownPlayerPos = null;
          off.state =
            off.id === 'C' && !this.currentStageConfig.allThreeOfficersOnFoot
              ? 'Return'
              : 'Patrol';
        }
        break;
      }

      case 'Investigate': {
        moveSpeed = 3.4 * spdMul;
        targetPoint = off.lastKnownPlayerPos;
        off.searchTimer -= dt;
        if (
          !targetPoint ||
          off.position.distanceTo(targetPoint) < 1.8 ||
          off.searchTimer <= 0
        ) {
          off.lastKnownPlayerPos = null;
          off.state =
            off.id === 'C' && !this.currentStageConfig.allThreeOfficersOnFoot
              ? 'Return'
              : 'Patrol';
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
          off.state =
            off.id === 'C' && !this.currentStageConfig.allThreeOfficersOnFoot
              ? 'Return'
              : 'Patrol';
        }
        break;
      }

      case 'Chase': {
        // 玩家进入保安视野时触发视野加速 (visionSprintMul = 1.38x)，直到彻底摆脱视野阈值才解除！
        // 若同时被石头/扳手砸中，再叠加 5-10s 随机狂暴加速！
        const visionSprintMul = off.visionBoostActive ? 1.38 : 1.0;
        const extraThrowMul = off.throwBoostTimer > 0 ? 1.25 : 1.0;
        moveSpeed = 3.85 * spdMul * visionSprintMul * extraThrowMul;
        if (off.canSeePlayer) {
          targetPoint = playerPos;
        } else if (off.lastKnownPlayerPos) {
          targetPoint = off.lastKnownPlayerPos;
          if (off.position.distanceTo(off.lastKnownPlayerPos) < 1.2) {
            off.rotationY += Math.sin(performance.now() * 0.008) * 2.2 * dt;
          }
        } else {
          targetPoint = playerPos;
        }
        break;
      }

      case 'Return': {
        moveSpeed = 3.2 * spdMul;
        targetPoint =
          off.id === 'C' && !this.currentStageConfig.allThreeOfficersOnFoot
            ? this.carPosition
            : off.patrolRoute[off.patrolIndex];
        if (
          (off.id !== 'C' || this.currentStageConfig.allThreeOfficersOnFoot) &&
          off.position.distanceTo(targetPoint) < 1.5
        ) {
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

  private moveAgentWithCollision(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    step: number,
    colliders: ColliderBox[]
  ) {
    const radius = 0.55;
    const nextX = pos.x + dir.x * step;
    if (!this.collidesAt(nextX, pos.z, radius, colliders)) {
      pos.x = nextX;
    } else {
      // Slide / steer around obstacle along Z when X is blocked
      const slideZ = pos.z + (dir.z >= 0 ? 1 : -1) * step * 0.85;
      if (!this.collidesAt(pos.x, slideZ, radius, colliders)) {
        pos.z = slideZ;
      }
    }

    const nextZ = pos.z + dir.z * step;
    if (!this.collidesAt(pos.x, nextZ, radius, colliders)) {
      pos.z = nextZ;
    } else {
      // Slide / steer around obstacle along X when Z is blocked
      const slideX = pos.x + (dir.x >= 0 ? 1 : -1) * step * 0.85;
      if (!this.collidesAt(slideX, pos.z, radius, colliders)) {
        pos.x = slideX;
      }
    }
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
