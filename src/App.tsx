import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OfficerId, PatrolAndAISystem } from './ai/PatrolAndAI';
import { BGM_TRACKS, BgmTrackId, soundFX } from './core/AudioSystem';
import {
  EXTRACTION_POINT,
  MAP_ZONES,
  MISSION_ITEMS,
  PLAYER_CHARACTERS,
  PLAYER_START,
  PlayerCharacterId,
  PLAYSTYLE_MODES,
  PlaystyleModeId,
  STAGE_CONFIGS,
  StageId,
  ThrowableKind,
  WORLD_CONFIG,
} from './core/Config';
import { Minimap, MinimapSnapshot } from './ui/Minimap';
import { glbAssetRegistry } from './world/GLBAssetManager';
import { createMaterialLibrary } from './world/Materials';
import {
  createStreetThrowableMesh,
  PlayerRig,
  renderPlayerPortraitDataUrl,
} from './world/ProceduralModels';
import {
  buildGameWorld,
  HidingSpot,
  randomizeMissionObjects,
} from './world/WorldBuilder';

type GamePhase = 'title' | 'strolling' | 'cutscene' | 'playing' | 'paused' | 'victory' | 'gameover';

interface HitReactionPopupState {
  targetType: 'officer' | 'car';
  targetName: string;
  weaponKind: ThrowableKind;
  weaponName: string;
  boostDurationSec: number;
  remainingSec: number;
  totalSec: number;
}

interface ActiveProjectile {
  mesh: THREE.Group;
  kind: ThrowableKind;
  weaponName: string;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  targetType: 'officer' | 'car';
  officerId: OfficerId | null;
  targetName: string;
  elapsed: number;
  duration: number;
}

interface HudState {
  stamina: number;
  globalAlert: number;
  maxOfficerDetection: number;
  collectedIds: string[];
  timeRemaining: number;
  extractionProgress: number;
  isCrouching: boolean;
  isSprinting: boolean;
  hidingSpotLabel: string | null;
  inBush: boolean;
  currentZone: string;
  interactionPrompt: string | null;
  carStatusText: string;
  carRadioMessage: string | null;
  escapeBannerMessage: string | null;
  timesSpotted: number;
  failReason: string;
  capturedByOfficer: string;
  certificateNo: string;
  noiseLevel: '静默' | '轻微' | '中低' | '中高';
  strollProgress: number;
  cutsceneTitle: string;
  cutsceneSubtitle: string;
  // 参保金额与躲藏时间系统
  contributionAmount: number;
  contributionRate: number;
  contributionStatusLabel: string;
  totalHidingSeconds: number;
  // 面包/香蕉能量加速状态
  snackBoostRemaining: number;
  lastSnackEatenName: string | null;
  // 石头/扳手投掷库存与右下角 1.8s 受击特写状态
  stoneCount: number;
  wrenchCount: number;
  hitReactionPopup: HitReactionPopupState | null;
  // 脱离保安视野阈值进度条 & 投掷激怒加速状态
  activeChaserName: string | null;
  isChaserSeeingPlayer: boolean;
  chaseLoseSightRatio: number;
  chaseLoseSightRemainingSec: number;
  throwBoostActiveSec: number;
  collectiveBoostActive: boolean;
  // 盲区迫近心跳感应 & 任务完成保安永久增速 & 久留防挂机热力 & 随机任务区域 & 视野内加速状态
  heartbeatIntensity: number;
  heartbeatBpm: number;
  officerSpeedBonusPct: number;
  campExposurePct: number;
  missionZones: string[];
  visionBoostCount: number;
  // 投掷有效射程检测与超距拦截提示
  throwWarningMessage: string | null;
  targetInRange: boolean;
  targetDistance: number;
  targetMaxRange: number;
  nearestTargetName: string | null;
  // 参保直通车发现玩家紧急下放保安 20s 地面搜捕状态
  deployedOfficerRemainingSec: number;
  isOfficerDeployedFromCar: boolean;
  // 电话亭最多隐蔽 10 秒状态
  isHidingInBooth: boolean;
  boothHidingRemainingSec: number;
  // 参保直通车方向检测器状态 (相对方位角、距离、行驶朝向、视野锁定) 与路面检测器数量
  carBearingDeg: number;
  carDistance: number;
  carHeadingLabel: string;
  carSeesPlayer: boolean;
  activeMonitorCount: number;
}

const _camDesiredPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _forwardDir = new THREE.Vector3();
const _rightDir = new THREE.Vector3();
const _moveInput = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _projTargetPos = new THREE.Vector3();

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [stageId, setStageId] = useState<StageId>('stage_1');
  const [playstyle, setPlaystyle] = useState<PlaystyleModeId>('balanced');
  const [characterId, setCharacterId] = useState<PlayerCharacterId>('luna_cyber');
  const [characterPortraits, setCharacterPortraits] = useState<Record<PlayerCharacterId, string>>({
    luna_cyber: '',
    street_kid: '',
    flash_rider: '',
    suited_worker: '',
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0.65);
  const [bgmTrack, setBgmTrack] = useState<BgmTrackId>('sneaky_pizzicato');
  const [mapExpanded, setMapExpanded] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(true);
  const [cameraDistancePreset, setCameraDistancePreset] = useState<'near' | 'standard' | 'tactical'>('standard');
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [mouseSensitivity, setMouseSensitivity] = useState<number>(1.0);

  const [hud, setHud] = useState<HudState>({
    stamina: 100,
    globalAlert: 0,
    maxOfficerDetection: 0,
    collectedIds: [],
    timeRemaining: PLAYSTYLE_MODES.balanced.timeLimitSec,
    extractionProgress: 0,
    isCrouching: false,
    isSprinting: false,
    hidingSpotLabel: null,
    inBush: false,
    currentZone: PLAYER_START.zoneName,
    interactionPrompt: null,
    carStatusText: 'Patrol (街道巡航)',
    carRadioMessage: null,
    escapeBannerMessage: null,
    timesSpotted: 0,
    failReason: '',
    capturedByOfficer: '保安队长·老王',
    certificateNo: 'NO.2026-CB-883921',
    noiseLevel: '静默',
    strollProgress: 0,
    cutsceneTitle: '',
    cutsceneSubtitle: '',
    contributionAmount: 1280,
    contributionRate: 38,
    contributionStatusLabel: '基础核定',
    totalHidingSeconds: 0,
    snackBoostRemaining: 0,
    lastSnackEatenName: null,
    stoneCount: 1,
    wrenchCount: 1,
    hitReactionPopup: null,
    activeChaserName: null,
    isChaserSeeingPlayer: false,
    chaseLoseSightRatio: 0,
    chaseLoseSightRemainingSec: 0,
    throwBoostActiveSec: 0,
    collectiveBoostActive: false,
    heartbeatIntensity: 0,
    heartbeatBpm: 0,
    officerSpeedBonusPct: 0,
    campExposurePct: 0,
    missionZones: MISSION_ITEMS.map((m) => m.zoneName),
    visionBoostCount: 0,
    throwWarningMessage: null,
    targetInRange: false,
    targetDistance: 99.9,
    targetMaxRange: 22.0,
    nearestTargetName: null,
    deployedOfficerRemainingSec: 0,
    isOfficerDeployedFromCar: false,
    isHidingInBooth: false,
    boothHidingRemainingSec: 0,
    carBearingDeg: 0,
    carDistance: 32,
    carHeadingLabel: '向东巡航',
    carSeesPlayer: false,
    activeMonitorCount: 8,
  });

  const simRef = useRef({
    phase: 'title' as GamePhase,
    phaseBeforePause: 'playing' as 'playing' | 'strolling',
    stageId: 'stage_1' as StageId,
    currentActiveStageId: 'stage_1' as StageId,
    stageSwapRequested: true,
    playstyle: 'balanced' as PlaystyleModeId,
    characterId: 'luna_cyber' as PlayerCharacterId,
    characterSwapRequested: false,
    cameraPreset: 'standard' as 'near' | 'standard' | 'tactical',
    mouseSensitivity: 1.0,
    playerPos: new THREE.Vector3(...PLAYER_START.position),
    playerYaw: Math.PI / 2,
    cameraYaw: -Math.PI / 2,
    cameraPitch: 0.36,
    targetCameraYaw: -Math.PI / 2,
    targetCameraPitch: 0.36,
    cameraDistance: 10.5,
    targetCameraDistance: 10.5,
    cameraPivotPos: new THREE.Vector3(...PLAYER_START.position),
    lastMouseMoveTime: 0,
    stamina: 100,
    isCrouching: false,
    activeHidingSpot: null as HidingSpot | null,
    boothHidingTimer: 0,
    timeRemaining: PLAYSTYLE_MODES.balanced.timeLimitSec,
    extractionTimer: 0,
    collectedCount: 0,
    animCycle: 0,
    cameraShake: 0,
    strollTimer: 0,
    cutsceneTimer: 0,
    resetToStrollRequested: false,
    triggerCutsceneRequested: false,
    skipCutsceneRequested: false,
    interactJustPressed: false,
    crouchJustPressed: false,
    throwJustPressed: false,
    throwWarningMessage: null as string | null,
    throwWarningTimer: 0,
    // 参保金额累计状态
    contributionAmount: 1280,
    totalHidingSeconds: 0,
    // 面包/香蕉能量加速计时器
    snackBoostTimer: 0,
    lastSnackEatenName: null as string | null,
    // 投掷物库存（石头 & 合金扳手）与右下角 1.8s 受击特写弹窗
    stoneCount: 1,
    wrenchCount: 1,
    hitReactionPopup: null as HitReactionPopupState | null,
  });

  const minimapSnapRef = useRef<MinimapSnapshot>({
    playerX: PLAYER_START.position[0],
    playerZ: PLAYER_START.position[2],
    playerYaw: 0,
    carX: -12,
    carZ: 0,
    carYaw: 0,
    carSeesPlayer: false,
    carVisionRange: 30,
    officers: [],
    missions: [],
    snacks: [],
    throwables: [],
    colliders: [],
    globalAlert: 0,
  });

  useEffect(() => {
    simRef.current.phase = phase;
  }, [phase]);

  useEffect(() => {
    simRef.current.stageId = stageId;
    simRef.current.stageSwapRequested = true;
  }, [stageId]);

  useEffect(() => {
    simRef.current.playstyle = playstyle;
  }, [playstyle]);

  useEffect(() => {
    simRef.current.characterId = characterId;
    simRef.current.characterSwapRequested = true;
  }, [characterId]);

  useEffect(() => {
    simRef.current.cameraPreset = cameraDistancePreset;
    simRef.current.targetCameraDistance =
      cameraDistancePreset === 'near' ? 7.2 : cameraDistancePreset === 'tactical' ? 16.0 : 10.5;
  }, [cameraDistancePreset]);

  useEffect(() => {
    simRef.current.mouseSensitivity = mouseSensitivity;
  }, [mouseSensitivity]);

  const requestGamePointerLock = useCallback(() => {
    try {
      const mount = canvasMountRef.current;
      const canvas = (mount?.querySelector('canvas') || mount) as HTMLElement | null;
      if (canvas && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        const res = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Ignore pointer lock restrictions in sandboxed environments
    }
  }, []);

  const exitGamePointerLock = useCallback(() => {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (phase === 'paused' || phase === 'title' || phase === 'victory' || phase === 'gameover') {
      exitGamePointerLock();
    }
  }, [phase, exitGamePointerLock]);

  const selectCharacter = useCallback((cId: PlayerCharacterId) => {
    setCharacterId(cId);
    simRef.current.characterId = cId;
    simRef.current.characterSwapRequested = true;
  }, []);

  const startStreetStroll = useCallback(
    (
      modeOverride?: PlaystyleModeId,
      stageOverride?: StageId,
      charOverride?: PlayerCharacterId
    ) => {
      const targetMode = modeOverride || playstyle;
      if (modeOverride) setPlaystyle(modeOverride);
      if (charOverride) {
        setCharacterId(charOverride);
        simRef.current.characterId = charOverride;
        simRef.current.characterSwapRequested = true;
      }
      if (stageOverride) {
        setStageId(stageOverride);
        simRef.current.stageId = stageOverride;
        simRef.current.stageSwapRequested = true;
      }
      simRef.current.playstyle = targetMode;
      simRef.current.resetToStrollRequested = true;
      simRef.current.phaseBeforePause = 'strolling';
      simRef.current.phase = 'strolling';
      setPhase('strolling');
      setMapExpanded(false);
      soundFX.setChaseTension(false);
      soundFX.startBgm();
      requestGamePointerLock();
    },
    [playstyle, requestGamePointerLock]
  );

  const resumeGameplay = useCallback(() => {
    // If a different stage was picked while paused, rebuild and start that stage!
    if (simRef.current.currentActiveStageId !== stageId) {
      startStreetStroll(undefined, stageId, characterId);
      return;
    }
    const targetResumePhase = simRef.current.phaseBeforePause || 'playing';
    simRef.current.phase = targetResumePhase;
    setPhase(targetResumePhase);
    soundFX.startBgm();
    requestGamePointerLock();
  }, [stageId, characterId, startStreetStroll, requestGamePointerLock]);

  const pauseGameplay = useCallback(() => {
    exitGamePointerLock();
    if (simRef.current.phase === 'strolling' || simRef.current.phase === 'playing') {
      simRef.current.phaseBeforePause = simRef.current.phase;
    }
    simRef.current.phase = 'paused';
    setPhase('paused');
  }, [exitGamePointerLock]);

  const returnToTitleScreen = useCallback(() => {
    exitGamePointerLock();
    soundFX.setChaseTension(false);
    simRef.current.phase = 'title';
    setPhase('title');
    setMapExpanded(false);
  }, [exitGamePointerLock]);

  const triggerThrowNow = useCallback(() => {
    simRef.current.throwJustPressed = true;
  }, []);

  const triggerCutsceneNow = useCallback(() => {
    simRef.current.triggerCutsceneRequested = true;
  }, []);

  const skipCutsceneNow = useCallback(() => {
    simRef.current.skipCutsceneRequested = true;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundFX.setMuted(next);
      return next;
    });
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setAudioVolume(vol);
    soundFX.setVolume(vol);
    if (vol > 0 && isMuted) {
      setIsMuted(false);
      soundFX.setMuted(false);
    }
  }, [isMuted]);

  const handleSelectBgmTrack = useCallback((trackId: BgmTrackId) => {
    setBgmTrack(trackId);
    soundFX.setBgmTrack(trackId);
    if (trackId !== 'off') {
      soundFX.startBgm();
    }
  }, []);

  const activeCharSpec = PLAYER_CHARACTERS[characterId];
  const activeStageSpec = STAGE_CONFIGS[stageId];
  const activePortraitUrl = characterPortraits[characterId];

  // Downloads the Official Enrollment Certificate ("参保证明") with the Selected Character's 3D Avatar as a PNG image
  const downloadCertificateImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 0, 760, 480);

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 728, 448);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, 708, 428);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('阳光商业街 · 流动参保登记证明书', 380, 72);

    ctx.fillStyle = '#b45309';
    ctx.font = '600 13px monospace';
    ctx.fillText(`证书编号：${hud.certificateNo}   |   签发关卡：${activeStageSpec.name}`, 380, 100);

    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 116);
    ctx.lineTo(712, 116);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`参保登记人：${activeCharSpec.name}（${activeCharSpec.title}）`, 230, 158);

    ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`督查拦截保安：${hud.capturedByOfficer}`, 230, 194);
    ctx.fillText(`躲藏时长（未被抓获时间）：${hud.totalHidingSeconds} 秒`, 230, 226);
    ctx.fillText(`免检材料收集进度：${hud.collectedIds.length} / 3 份`, 230, 258);

    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(230, 278, 460, 76);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(230, 278, 460, 76);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('最终核定应缴参保金额（随躲藏时长动态递增）：', 246, 304);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`¥ ${hud.contributionAmount.toLocaleString('zh-CN')}.00 元`, 246, 340);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('备注：本证明由「参保直通车」现场终端自动核发，凭此证可继续挑战街道潜行。', 54, 424);

    ctx.save();
    ctx.translate(610, 365);
    ctx.rotate(-0.18);
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.82)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('参保直通车', 0, -10);
    ctx.fillText('现场办结专用章', 0, 10);
    ctx.fillText('★', 0, 32);
    ctx.restore();

    const triggerDownload = () => {
      const link = document.createElement('a');
      link.download = `参保证明_${activeCharSpec.name}_${hud.certificateNo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    if (activePortraitUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(54, 138, 148, 184);
        ctx.drawImage(img, 54, 138, 148, 184);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.strokeRect(54, 138, 148, 184);
        triggerDownload();
      };
      img.src = activePortraitUrl;
    } else {
      triggerDownload();
    }
  }, [
    activeCharSpec.name,
    activeCharSpec.title,
    activePortraitUrl,
    activeStageSpec.name,
    hud.capturedByOfficer,
    hud.certificateNo,
    hud.collectedIds.length,
    hud.contributionAmount,
    hud.totalHidingSeconds,
  ]);

  // Downloads the Official Victory Honor Certificate ("免检通关荣誉证书") with the Selected Character's 3D Avatar as a PNG image
  const downloadVictoryCertificateImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(0, 0, 760, 480);

    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 728, 448);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, 708, 428);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('视线之外 · 街区潜行免检通关荣誉证书', 380, 72);

    ctx.fillStyle = '#047857';
    ctx.font = '600 13px monospace';
    ctx.fillText(
      `荣誉编号：${hud.certificateNo}   |   通关街区：${activeStageSpec.name}`,
      380,
      100
    );

    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 116);
    ctx.lineTo(712, 116);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`荣誉通关者：${activeCharSpec.name}（${activeCharSpec.title}）`, 230, 158);

    ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`通关撤离方式：集齐 3/3 份免检材料 · 穿越东侧时空传送门`, 230, 194);
    ctx.fillText(`街区周旋时长：${hud.totalHidingSeconds} 秒（剩余时间 ${formatTime(hud.timeRemaining)}）`, 230, 226);
    ctx.fillText(`全图警报暴露：${hud.timesSpotted} 次`, 230, 258);

    ctx.fillStyle = '#d1fae5';
    ctx.fillRect(230, 278, 460, 76);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.strokeRect(230, 278, 460, 76);

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('核定成功规避参保金额（全额免缴认证）：', 246, 304);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`¥ ${hud.contributionAmount.toLocaleString('zh-CN')}.00 元`, 246, 340);

    ctx.fillStyle = '#475569';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      '表彰词：面对参保直通车、红外检测器与保安围堵，凭高超身法全身而退，特发此证以资鼓励！',
      54,
      424
    );

    ctx.save();
    ctx.translate(610, 365);
    ctx.rotate(-0.18);
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.88)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(5, 150, 105, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('街区潜行委员会', 0, -10);
    ctx.fillText('免检通关荣誉章', 0, 10);
    ctx.fillText('★', 0, 32);
    ctx.restore();

    const triggerDownload = () => {
      const link = document.createElement('a');
      link.download = `通关荣誉证书_${activeCharSpec.name}_${hud.certificateNo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    if (activePortraitUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(54, 138, 148, 184);
        ctx.drawImage(img, 54, 138, 148, 184);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 3;
        ctx.strokeRect(54, 138, 148, 184);
        triggerDownload();
      };
      img.src = activePortraitUrl;
    } else {
      triggerDownload();
    }
  }, [
    activeCharSpec.name,
    activeCharSpec.title,
    activePortraitUrl,
    activeStageSpec.name,
    hud.certificateNo,
    hud.contributionAmount,
    hud.timeRemaining,
    hud.timesSpotted,
    hud.totalHidingSeconds,
  ]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColorHex = 0x3b235a;
    const fog = new THREE.FogExp2(skyColorHex, 0.0036);
    scene.background = new THREE.Color(skyColorHex);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      46,
      window.innerWidth / window.innerHeight,
      0.2,
      260
    );

    const hemiLight = new THREE.HemisphereLight(0xfff4de, 0x6b21a8, 1.15);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffe8c2, 1.75);
    dirLight.position.set(42, 68, 38);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    const d = 68;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 0.65);
    rimLight.position.set(-48, 32, -40);
    scene.add(rimLight);

    const mats = createMaterialLibrary(renderer);
    let currentBuiltStageId: StageId = simRef.current.stageId;
    let worldData = buildGameWorld(scene, mats, currentBuiltStageId);

    const disposeHierarchy = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
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
    };

    let playerRig: PlayerRig = glbAssetRegistry.instantiatePlayerRigFromGLB(
      mats,
      simRef.current.characterId
    );
    playerRig.group.position.copy(simRef.current.playerPos);
    scene.add(playerRig.group);

    glbAssetRegistry.initializeCoreGLBAssets(mats);

    const p0 = renderPlayerPortraitDataUrl(renderer, mats, 'luna_cyber');
    const p1 = renderPlayerPortraitDataUrl(renderer, mats, 'street_kid');
    const p2 = renderPlayerPortraitDataUrl(renderer, mats, 'flash_rider');
    const p3 = renderPlayerPortraitDataUrl(renderer, mats, 'suited_worker');
    setCharacterPortraits({
      luna_cyber: p0,
      street_kid: p1,
      flash_rider: p2,
      suited_worker: p3,
    });

    const aiSystem = new PatrolAndAISystem(scene, mats);
    aiSystem.setStageConfig(simRef.current.stageId);

    const activeProjectiles: ActiveProjectile[] = [];

    const syncMinimapWorldRefs = () => {
      minimapSnapRef.current.colliders = worldData.colliders;
      minimapSnapRef.current.missions = worldData.missionObjects;
      minimapSnapRef.current.snacks = worldData.snackObjects;
      minimapSnapRef.current.throwables = worldData.throwableObjects;
    };

    const applyStageEnvironment = (targetStageId: StageId) => {
      const sCfg = STAGE_CONFIGS[targetStageId] || STAGE_CONFIGS.stage_1;
      scene.background = new THREE.Color(sCfg.skyColorHex);
      fog.color.setHex(sCfg.skyColorHex);
      fog.density = sCfg.fogDensity;
      hemiLight.color.setHex(sCfg.hemiSkyHex);
      hemiLight.groundColor.setHex(sCfg.hemiGroundHex);
      dirLight.color.setHex(sCfg.keyLightHex);
      dirLight.intensity = sCfg.keyLightIntensity;
      rimLight.color.setHex(sCfg.rimLightHex);
      mats.roadAsphalt.color.setHex(sCfg.roadColorHex);
      mats.groundWarmGray.color.setHex(sCfg.groundColorHex);
      mats.curbStone.color.setHex(sCfg.curbColorHex);

      if (targetStageId === 'stage_3') {
        mats.foliageGreen.color.setHex(0x65a30d);
      } else if (targetStageId === 'stage_2') {
        mats.foliageGreen.color.setHex(0x10b981);
      } else {
        mats.foliageGreen.color.setHex(0x3ca370);
      }

      // Dynamically rebuild the 3D Architectural World when switching stages
      // Stage 1: European Rowhouse Commercial Street | Stage 2: Coastal Seaside Town | Stage 3: Countryside Village Street
      if (currentBuiltStageId !== targetStageId) {
        disposeHierarchy(worldData.worldRootGroup);
        scene.remove(worldData.worldRootGroup);
        worldData = buildGameWorld(scene, mats, targetStageId);
        currentBuiltStageId = targetStageId;
        simRef.current.currentActiveStageId = targetStageId;
        syncMinimapWorldRefs();
      }

      aiSystem.setStageConfig(targetStageId);
      minimapSnapRef.current.carVisionRange = sCfg.carVisionRange;
    };

    applyStageEnvironment(simRef.current.stageId);
    renderer.compile(scene, camera);
    syncMinimapWorldRefs();

    const heldKeys = new Set<string>();
    let isPointerDragging = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let isHoldingAltForCursor = false;
    let ignoreNextMovementSpike = false;

    const lockCanvasPointer = () => {
      try {
        if (
          document.pointerLockElement !== renderer.domElement &&
          renderer.domElement.requestPointerLock
        ) {
          ignoreNextMovementSpike = true;
          const res = renderer.domElement.requestPointerLock() as unknown as
            | Promise<void>
            | undefined;
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        }
      } catch {
        // Ignore if browser/iframe blocks pointer lock
      }
    };

    const handlePointerLockChange = () => {
      const locked =
        document.pointerLockElement === renderer.domElement ||
        document.pointerLockElement === canvasMountRef.current;
      setIsPointerLocked(locked);
      if (locked) {
        ignoreNextMovementSpike = true;
      } else if (
        !isHoldingAltForCursor &&
        simRef.current.phase === 'playing'
      ) {
        // Pressing Esc while pointer-locked during active gameplay pauses the game.
        // Note: In 'strolling' (before game formally starts), unlocking pointer will NOT trap the game in paused state!
        simRef.current.phaseBeforePause = 'playing';
        simRef.current.phase = 'paused';
        setPhase('paused');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      // Hold Left/Right Alt to temporarily unlock and show normal mouse cursor for clicking UI (like Genshin Impact)
      if (code === 'AltLeft' || code === 'AltRight') {
        isHoldingAltForCursor = true;
        try {
          if (document.pointerLockElement) document.exitPointerLock();
        } catch {
          // ignore
        }
      }

      if (!heldKeys.has(code)) {
        if (code === 'KeyE') {
          simRef.current.interactJustPressed = true;
        } else if (code === 'KeyC') {
          simRef.current.crouchJustPressed = true;
        } else if (code === 'KeyG' || code === 'KeyF') {
          simRef.current.throwJustPressed = true;
        } else if (
          (code === 'KeyM' || code === 'Tab') &&
          (simRef.current.phase === 'playing' || simRef.current.phase === 'strolling')
        ) {
          e.preventDefault();
          setMapExpanded((prev) => !prev);
        } else if (code === 'KeyH') {
          setDockCollapsed((prev) => !prev);
        } else if (code === 'KeyR') {
          if (
            simRef.current.phase === 'playing' ||
            simRef.current.phase === 'paused' ||
            simRef.current.phase === 'strolling'
          ) {
            e.preventDefault();
            simRef.current.resetToStrollRequested = true;
            simRef.current.phaseBeforePause = 'strolling';
            simRef.current.phase = 'strolling';
            setPhase('strolling');
            lockCanvasPointer();
          }
        } else if (code === 'Escape' || code === 'KeyP') {
          if (simRef.current.phase === 'playing') {
            isHoldingAltForCursor = false;
            try {
              if (document.pointerLockElement) document.exitPointerLock();
            } catch {
              // ignore
            }
            simRef.current.phaseBeforePause = 'playing';
            simRef.current.phase = 'paused';
            setPhase('paused');
          } else if (simRef.current.phase === 'strolling') {
            // Pressing ESC before game starts (in strolling phase) skips strolling and starts the arrival cutscene + guard deployment!
            simRef.current.triggerCutsceneRequested = true;
          } else if (simRef.current.phase === 'paused') {
            const resumeTarget = simRef.current.phaseBeforePause || 'playing';
            simRef.current.phase = resumeTarget;
            setPhase(resumeTarget);
            lockCanvasPointer();
          } else if (simRef.current.phase === 'cutscene') {
            simRef.current.skipCutsceneRequested = true;
          }
        } else if (code === 'Enter' || code === 'Space') {
          if (simRef.current.phase === 'title') {
            e.preventDefault();
            simRef.current.resetToStrollRequested = true;
            simRef.current.phaseBeforePause = 'strolling';
            simRef.current.phase = 'strolling';
            setPhase('strolling');
            soundFX.startBgm();
            lockCanvasPointer();
          } else if (simRef.current.phase === 'strolling') {
            e.preventDefault();
            simRef.current.triggerCutsceneRequested = true;
          } else if (simRef.current.phase === 'cutscene') {
            e.preventDefault();
            simRef.current.skipCutsceneRequested = true;
          }
        }
      }
      heldKeys.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        isHoldingAltForCursor = false;
      }
    };

    const handleWindowBlur = () => {
      heldKeys.clear();
      isPointerDragging = false;
      isHoldingAltForCursor = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, select, [role="dialog"]')) {
        return;
      }

      const activeGameplay =
        simRef.current.phase === 'playing' || simRef.current.phase === 'strolling';

      isPointerDragging = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      // Clicking on the 3D viewport locks the pointer for seamless 360° third-person camera control
      if (activeGameplay && !isHoldingAltForCursor) {
        lockCanvasPointer();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const activeGameplay =
        simRef.current.phase === 'playing' || simRef.current.phase === 'strolling';
      const sens = 0.0038 * simRef.current.mouseSensitivity;

      const isLocked =
        document.pointerLockElement === renderer.domElement ||
        document.pointerLockElement === canvasMountRef.current;

      // 1. Mainstream 3D Third-Person Pointer-Locked Free-Look (Infinite 360° rotation, never hits window edges)
      if (isLocked && activeGameplay) {
        if (ignoreNextMovementSpike) {
          ignoreNextMovementSpike = false;
          if (Math.abs(e.movementX) > 80 || Math.abs(e.movementY) > 80) {
            return;
          }
        }
        const moveX = THREE.MathUtils.clamp(e.movementX, -90, 90);
        const moveY = THREE.MathUtils.clamp(e.movementY, -90, 90);
        simRef.current.targetCameraYaw -= moveX * sens;
        simRef.current.targetCameraPitch = THREE.MathUtils.clamp(
          simRef.current.targetCameraPitch + moveY * (sens * 0.78),
          0.12,
          1.05
        );
        simRef.current.lastMouseMoveTime = performance.now();
        return;
      }

      // 2. Smooth Drag-to-Orbit when Pointer Lock is not active (e.g. holding Alt or dragging on canvas)
      // Never spin the camera on passive hover when unlocked so the player can freely click UI buttons!
      if (!isPointerDragging) return;

      const rawDx = e.clientX - prevPointerX;
      const rawDy = e.clientY - prevPointerY;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      const dx = THREE.MathUtils.clamp(rawDx, -90, 90);
      const dy = THREE.MathUtils.clamp(rawDy, -90, 90);

      simRef.current.targetCameraYaw -= dx * (sens * 1.15);
      simRef.current.targetCameraPitch = THREE.MathUtils.clamp(
        simRef.current.targetCameraPitch + dy * (sens * 0.9),
        0.12,
        1.05
      );
      simRef.current.lastMouseMoveTime = performance.now();
    };

    const handlePointerUp = () => {
      isPointerDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      const activeGameplay =
        simRef.current.phase === 'playing' || simRef.current.phase === 'strolling';
      if (!activeGameplay) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[role="dialog"]')) return;

      simRef.current.targetCameraDistance = THREE.MathUtils.clamp(
        simRef.current.targetCameraDistance + e.deltaY * 0.008,
        6.2,
        17.5
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (simRef.current.phase === 'playing' || simRef.current.phase === 'strolling') {
        e.preventDefault();
      }
    };

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('resize', handleResize);

    const executeResetToStroll = () => {
      const cfg = PLAYSTYLE_MODES[simRef.current.playstyle];
      applyStageEnvironment(simRef.current.stageId);

      simRef.current.playerPos.set(...PLAYER_START.position);
      simRef.current.playerYaw = Math.PI / 2;
      simRef.current.cameraYaw = -Math.PI / 2;
      simRef.current.cameraPitch = 0.34;
      simRef.current.targetCameraYaw = -Math.PI / 2;
      simRef.current.targetCameraPitch = 0.34;
      simRef.current.cameraPivotPos.set(...PLAYER_START.position);
      simRef.current.stamina = 100;
      simRef.current.isCrouching = false;
      simRef.current.activeHidingSpot = null;
      simRef.current.timeRemaining = cfg.timeLimitSec;
      simRef.current.extractionTimer = 0;
      simRef.current.collectedCount = 0;
      simRef.current.cameraShake = 0;
      simRef.current.strollTimer = 0;
      simRef.current.cutsceneTimer = 0;
      simRef.current.contributionAmount = 1280;
      simRef.current.totalHidingSeconds = 0;
      simRef.current.snackBoostTimer = 0;
      simRef.current.lastSnackEatenName = null;
      // Start each stage with 1 Stone + 1 Alloy Wrench ready to throw, plus more on the street!
      simRef.current.stoneCount = 1;
      simRef.current.wrenchCount = 1;
      simRef.current.hitReactionPopup = null;
      simRef.current.throwJustPressed = false;

      activeProjectiles.forEach((p) => {
        disposeHierarchy(p.mesh);
        scene.remove(p.mesh);
      });
      activeProjectiles.length = 0;

      playerRig.group.visible = true;
      playerRig.group.position.copy(simRef.current.playerPos);
      playerRig.group.rotation.y = simRef.current.playerYaw;
      playerRig.bodyGroup.scale.set(1, 1, 1);

      // Randomize mission item positions across safe, obstacle-free street coordinates every game!
      randomizeMissionObjects(worldData);

      worldData.snackObjects.forEach((s) => {
        s.respawnTimer = 0;
        s.mesh.visible = true;
      });

      worldData.throwableObjects.forEach((t) => {
        t.respawnTimer = 0;
        t.mesh.visible = true;
      });

      simRef.current.boothHidingTimer = 0;
      worldData.hidingSpots.forEach((h) => {
        h.used = false;
        h.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
            child.visible = true;
          }
        });
      });

      aiSystem.prepareStrollPhase();
    };

    // Checks & consumes Street Energy Snacks (Bread 🥐 & Banana 🍌) AND Street Throwables (Stones 🪨 & Wrenches 🔧)
    const checkStreetPickupsAndProjectiles = (dt: number) => {
      const sim = simRef.current;
      const charSpec = PLAYER_CHARACTERS[sim.characterId];

      if (sim.snackBoostTimer > 0) {
        sim.snackBoostTimer = Math.max(0, sim.snackBoostTimer - dt);
        if (sim.snackBoostTimer <= 0) {
          sim.lastSnackEatenName = null;
        }
      }

      if (sim.throwWarningTimer > 0) {
        sim.throwWarningTimer = Math.max(0, sim.throwWarningTimer - dt);
        if (sim.throwWarningTimer <= 0) {
          sim.throwWarningMessage = null;
        }
      }

      if (sim.hitReactionPopup) {
        sim.hitReactionPopup.remainingSec = Math.max(
          0,
          sim.hitReactionPopup.remainingSec - dt
        );
        if (sim.hitReactionPopup.remainingSec <= 0) {
          sim.hitReactionPopup = null;
        }
      }

      for (const s of worldData.snackObjects) {
        if (s.respawnTimer > 0) {
          s.respawnTimer = Math.max(0, s.respawnTimer - dt);
          if (s.respawnTimer <= 0) {
            s.mesh.visible = true;
          }
          continue;
        }

        if (!sim.activeHidingSpot && sim.playerPos.distanceTo(s.mesh.position) < 1.85) {
          s.respawnTimer = 18.0;
          s.mesh.visible = false;
          sim.stamina = Math.min(100, sim.stamina + s.spec.staminaRestore);
          sim.snackBoostTimer = s.spec.boostDurationSec + charSpec.snackBuffBonusSec;
          sim.lastSnackEatenName = s.spec.name;
          soundFX.playSnackEat();
        }
      }

      // Street Throwables (Stones 🪨 & Alloy Wrenches 🔧) Pickup
      const totalHeld = sim.stoneCount + sim.wrenchCount;
      for (const th of worldData.throwableObjects) {
        if (th.respawnTimer > 0) {
          th.respawnTimer = Math.max(0, th.respawnTimer - dt);
          if (th.respawnTimer <= 0) {
            th.mesh.visible = true;
          }
          continue;
        }

        if (
          !sim.activeHidingSpot &&
          totalHeld < 6 &&
          sim.playerPos.distanceTo(th.mesh.position) < 1.85
        ) {
          th.respawnTimer = 14.0;
          th.mesh.visible = false;
          if (th.spec.kind === 'stone') {
            sim.stoneCount += 1;
          } else {
            sim.wrenchCount += 1;
          }
          soundFX.playThrowablePickup();
        }
      }

      // Launch Projectile when player presses [G] / [F] or clicks the Throw button
      if (sim.throwJustPressed) {
        sim.throwJustPressed = false;
        if (!sim.activeHidingSpot && (sim.stoneCount > 0 || sim.wrenchCount > 0)) {
          const useKind: ThrowableKind = sim.wrenchCount > 0 ? 'wrench' : 'stone';
          const maxRange = useKind === 'wrench' ? 18.0 : 22.0;
          const weaponName = useKind === 'wrench' ? '修车合金扳手' : '街角鹅卵石';

          const targetInfo = aiSystem.findBestThrowTarget(sim.playerPos, sim.playerYaw, maxRange);

          if (!targetInfo.inRange) {
            // Target is beyond effective throwing range! Do NOT consume the item!
            sim.throwWarningMessage = `⚠️ 目标【${targetInfo.targetName}】超出有效射程！(最大 ${maxRange}m，当前相距 ${targetInfo.distance.toFixed(1)}m)`;
            sim.throwWarningTimer = 2.4;
            soundFX.playOutOfRange();
          } else {
            sim.throwWarningMessage = null;
            sim.throwWarningTimer = 0;
            if (useKind === 'wrench') {
              sim.wrenchCount -= 1;
            } else {
              sim.stoneCount -= 1;
            }

            soundFX.playThrowWhoosh();

            // Rotate player toward target and swing right arm
            _toTarget.subVectors(targetInfo.targetPos, sim.playerPos);
            if (_toTarget.lengthSq() > 0.01) {
              sim.playerYaw = Math.atan2(_toTarget.x, _toTarget.z);
            }
            playerRig.rightArm.rotation.x = -1.6;

            const projMesh = createStreetThrowableMesh(mats, useKind, false);
            const startPos = sim.playerPos.clone();
            startPos.y += 1.35;
            projMesh.position.copy(startPos);
            scene.add(projMesh);

            const dist = startPos.distanceTo(targetInfo.targetPos);
            const flightDuration = THREE.MathUtils.clamp(dist / 28.0, 0.28, 0.65);

            activeProjectiles.push({
              mesh: projMesh,
              kind: useKind,
              weaponName,
              startPos,
              endPos: targetInfo.targetPos.clone(),
              targetType: targetInfo.targetType,
              officerId: targetInfo.officerId,
              targetName: targetInfo.targetName,
              elapsed: 0,
              duration: flightDuration,
            });
          }
        }
      }

      // Update In-Flight Projectiles along Parabolic Arc
      for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.elapsed += dt;
        const t = Math.min(1, p.elapsed / p.duration);

        // Track moving target position in real time so throws feel snappy and accurate!
        if (p.targetType === 'officer' && p.officerId) {
          const off = aiSystem.officers.find((o) => o.id === p.officerId);
          if (off && !off.inVehicle) {
            p.endPos.copy(off.position);
            p.endPos.y += 1.35;
          }
        } else if (p.targetType === 'car') {
          p.endPos.copy(aiSystem.carPosition);
          p.endPos.y += 1.3;
        }

        p.mesh.position.lerpVectors(p.startPos, p.endPos, t);
        // Parabolic arc height
        p.mesh.position.y += Math.sin(t * Math.PI) * 2.2;
        p.mesh.rotation.x += dt * 16;
        p.mesh.rotation.y += dt * 12;

        if (t >= 1) {
          disposeHierarchy(p.mesh);
          scene.remove(p.mesh);
          activeProjectiles.splice(i, 1);

          // Trigger AI chase & 5-10s random speed boost reaction
          const rolledBoostSec = aiSystem.applyThrowableImpact(
            p.targetType,
            p.officerId,
            p.kind,
            sim.playerPos
          );
          sim.cameraShake = 0.35;

          // Trigger the 1.8-second Bottom-Right Hit Reaction PiP Window!
          sim.hitReactionPopup = {
            targetType: p.targetType,
            targetName: p.targetName,
            weaponKind: p.kind,
            weaponName: p.weaponName,
            boostDurationSec: rolledBoostSec,
            remainingSec: 1.8,
            totalSec: 1.8,
          };
        }
      }
    };

    const updatePlayerMovement = (dt: number, maxWalkSpeed: number, allowSprint: boolean) => {
      const sim = simRef.current;
      const cfg = PLAYSTYLE_MODES[sim.playstyle];
      const charSpec = PLAYER_CHARACTERS[sim.characterId];
      const hasSnackBoost = sim.snackBoostTimer > 0;
      const snackSpeedMult = hasSnackBoost ? 1.24 : 1.0;

      if (heldKeys.has('ArrowLeft') || heldKeys.has('KeyQ')) {
        sim.targetCameraYaw += 1.9 * dt;
      }
      if (heldKeys.has('ArrowRight')) {
        sim.targetCameraYaw -= 1.9 * dt;
      }
      if (heldKeys.has('ArrowUp')) {
        sim.targetCameraPitch = Math.max(0.12, sim.targetCameraPitch - 1.1 * dt);
      }
      if (heldKeys.has('ArrowDown')) {
        sim.targetCameraPitch = Math.min(1.05, sim.targetCameraPitch + 1.1 * dt);
      }

      let moveZ = 0;
      let moveX = 0;
      if (heldKeys.has('KeyW')) moveZ += 1;
      if (heldKeys.has('KeyS')) moveZ -= 1;
      if (heldKeys.has('KeyA')) moveX -= 1;
      if (heldKeys.has('KeyD')) moveX += 1;

      const isMoving = moveX !== 0 || moveZ !== 0;
      const wantsSprint =
        allowSprint &&
        (heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || hasSnackBoost) &&
        isMoving &&
        (sim.stamina > 3 || hasSnackBoost);

      let currentSpeed = 0;
      let isSprinting = false;
      let noiseType: '静默' | '轻微' | '中低' | '中高' = '静默';

      if (wantsSprint && (heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight'))) {
        sim.isCrouching = false;
        isSprinting = true;
        currentSpeed = cfg.runSpeed * charSpec.runSpeedMultiplier * snackSpeedMult;
        if (!hasSnackBoost) {
          sim.stamina = Math.max(0, sim.stamina - cfg.staminaDrain * dt);
        }
        noiseType = '中高';
      } else if (isMoving) {
        currentSpeed = sim.isCrouching
          ? cfg.crouchSpeed * charSpec.crouchSpeedMultiplier * (hasSnackBoost ? 1.15 : 1.0)
          : maxWalkSpeed * charSpec.runSpeedMultiplier * (hasSnackBoost ? 1.2 : 1.0);
        noiseType = sim.isCrouching ? '轻微' : '中低';
        const regen = sim.isCrouching ? cfg.staminaRegenCrouch : cfg.staminaRegenIdle * 0.55;
        sim.stamina = Math.min(100, sim.stamina + regen * dt);
      } else {
        const regen = sim.isCrouching ? cfg.staminaRegenCrouch : cfg.staminaRegenIdle;
        sim.stamina = Math.min(100, sim.stamina + regen * dt);
      }

      if (isMoving && currentSpeed > 0) {
        _forwardDir.set(-Math.sin(sim.cameraYaw), 0, -Math.cos(sim.cameraYaw)).normalize();
        _rightDir.set(Math.cos(sim.cameraYaw), 0, -Math.sin(sim.cameraYaw)).normalize();

        _moveInput
          .set(0, 0, 0)
          .addScaledVector(_forwardDir, moveZ)
          .addScaledVector(_rightDir, moveX)
          .normalize();

        const targetYaw = Math.atan2(_moveInput.x, _moveInput.z);
        let diff = targetYaw - sim.playerYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sim.playerYaw += diff * Math.min(1, dt * 14);

        // Gentle auto-follow camera when player is strafing left/right and hasn't moved the mouse recently
        if (moveX !== 0 && performance.now() - sim.lastMouseMoveTime > 900) {
          sim.targetCameraYaw -= moveX * 0.65 * dt;
        }

        const step = currentSpeed * dt;
        const pRadius = 0.46;
        const nextX = sim.playerPos.x + _moveInput.x * step;
        let blockedX = false;
        for (let i = 0; i < worldData.colliders.length; i++) {
          const c = worldData.colliders[i];
          if (
            nextX + pRadius > c.minX &&
            nextX - pRadius < c.maxX &&
            sim.playerPos.z + pRadius > c.minZ &&
            sim.playerPos.z - pRadius < c.maxZ
          ) {
            blockedX = true;
            break;
          }
        }
        if (!blockedX) sim.playerPos.x = nextX;

        const nextZ = sim.playerPos.z + _moveInput.z * step;
        let blockedZ = false;
        for (let i = 0; i < worldData.colliders.length; i++) {
          const c = worldData.colliders[i];
          if (
            sim.playerPos.x + pRadius > c.minX &&
            sim.playerPos.x - pRadius < c.maxX &&
            nextZ + pRadius > c.minZ &&
            nextZ - pRadius < c.maxZ
          ) {
            blockedZ = true;
            break;
          }
        }
        if (!blockedZ) sim.playerPos.z = nextZ;

        soundFX.playFootstep(isSprinting ? 'run' : sim.isCrouching ? 'crouch' : 'walk');

        sim.animCycle += dt * currentSpeed * 2.5;
        const swing = Math.sin(sim.animCycle) * (isSprinting ? 0.72 : 0.45);
        playerRig.leftLeg.rotation.x = swing;
        playerRig.rightLeg.rotation.x = -swing;
        playerRig.leftArm.rotation.x = -swing * 0.7;
        playerRig.rightArm.rotation.x = swing * 0.7;
      } else {
        playerRig.leftLeg.rotation.x = THREE.MathUtils.damp(playerRig.leftLeg.rotation.x, 0, 10, dt);
        playerRig.rightLeg.rotation.x = THREE.MathUtils.damp(playerRig.rightLeg.rotation.x, 0, 10, dt);
        playerRig.leftArm.rotation.x = THREE.MathUtils.damp(playerRig.leftArm.rotation.x, 0, 10, dt);
        playerRig.rightArm.rotation.x = THREE.MathUtils.damp(playerRig.rightArm.rotation.x, 0, 10, dt);
      }

      if (playerRig.scarfTailGroup) {
        const scarfWave = isMoving
          ? 0.28 + Math.sin(sim.animCycle * 1.4) * (isSprinting ? 0.22 : 0.12)
          : 0.08 + Math.sin(performance.now() * 0.003) * 0.04;
        playerRig.scarfTailGroup.rotation.x = THREE.MathUtils.damp(
          playerRig.scarfTailGroup.rotation.x,
          scarfWave,
          10,
          dt
        );
      }

      const targetScaleY = sim.isCrouching ? 0.66 : 1.0;
      playerRig.bodyGroup.scale.y = THREE.MathUtils.damp(
        playerRig.bodyGroup.scale.y,
        targetScaleY,
        12,
        dt
      );
      playerRig.group.position.copy(sim.playerPos);
      playerRig.group.rotation.y = sim.playerYaw;

      return { isMoving, isSprinting, noiseType };
    };

    const updateThirdPersonCamera = (dt: number) => {
      const sim = simRef.current;

      // Smoothly damp camera rotation & zoom distance (Mainstream 3D Action/Adventure Camera)
      sim.cameraYaw = THREE.MathUtils.damp(sim.cameraYaw, sim.targetCameraYaw, 24, dt);
      sim.cameraPitch = THREE.MathUtils.damp(sim.cameraPitch, sim.targetCameraPitch, 24, dt);
      sim.cameraDistance = THREE.MathUtils.damp(sim.cameraDistance, sim.targetCameraDistance, 14, dt);

      // Smoothly follow the player's position with a dedicated camera pivot (no rigid jitter on character)
      sim.cameraPivotPos.x = THREE.MathUtils.damp(sim.cameraPivotPos.x, sim.playerPos.x, 16, dt);
      sim.cameraPivotPos.y = THREE.MathUtils.damp(sim.cameraPivotPos.y, sim.playerPos.y, 16, dt);
      sim.cameraPivotPos.z = THREE.MathUtils.damp(sim.cameraPivotPos.z, sim.playerPos.z, 16, dt);

      const camDist = sim.cameraDistance;
      const horizDist = camDist * Math.cos(sim.cameraPitch);
      const vertDist = camDist * Math.sin(sim.cameraPitch);

      _camDesiredPos.set(
        sim.cameraPivotPos.x + Math.sin(sim.cameraYaw) * horizDist,
        sim.cameraPivotPos.y + vertDist + 1.45,
        sim.cameraPivotPos.z + Math.cos(sim.cameraYaw) * horizDist
      );

      if (sim.cameraShake > 0.01) {
        _camDesiredPos.x += (Math.random() - 0.5) * sim.cameraShake;
        _camDesiredPos.y += (Math.random() - 0.5) * sim.cameraShake;
        sim.cameraShake = Math.max(0, sim.cameraShake - dt * 1.8);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesiredPos.x, 18, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesiredPos.y, 18, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesiredPos.z, 18, dt);

      // Look slightly above the character's head/shoulders so the character sits naturally in the lower-middle frame
      // without any artificial anchor point on the character!
      const lookAheadOffset = 1.15;
      _camLookAt.set(
        sim.cameraPivotPos.x - Math.sin(sim.cameraYaw) * lookAheadOffset,
        sim.cameraPivotPos.y + (sim.isCrouching ? 1.25 : 1.72),
        sim.cameraPivotPos.z - Math.cos(sim.cameraYaw) * lookAheadOffset
      );
      camera.lookAt(_camLookAt);
    };

    const clock = new THREE.Clock();
    let hudSyncTimer = 0;
    let animFrameId = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const sim = simRef.current;
      const cfg = PLAYSTYLE_MODES[sim.playstyle];
      const charSpec = PLAYER_CHARACTERS[sim.characterId];

      if (sim.stageSwapRequested) {
        sim.stageSwapRequested = false;
        applyStageEnvironment(sim.stageId);
      }

      if (sim.characterSwapRequested) {
        sim.characterSwapRequested = false;
        const wasVisible = playerRig.group.visible;
        disposeHierarchy(playerRig.group);
        scene.remove(playerRig.group);
        playerRig = glbAssetRegistry.instantiatePlayerRigFromGLB(
          mats,
          sim.characterId
        );
        playerRig.group.position.copy(sim.playerPos);
        playerRig.group.rotation.y = sim.playerYaw;
        playerRig.group.visible = wasVisible;
        scene.add(playerRig.group);
      }

      if (sim.resetToStrollRequested) {
        sim.resetToStrollRequested = false;
        executeResetToStroll();
      }

      // Animate Stage-Specific 3D Landmarks (Countryside Windmill Blades & Coastal Ocean Waves)
      if (worldData.windmillRotor) {
        worldData.windmillRotor.rotation.z -= dt * 0.85;
      }
      if (worldData.oceanWaveMesh) {
        worldData.oceanWaveMesh.position.z = -35.8 + Math.sin(elapsed * 2.2) * 0.85;
      }

      // Animate floating mission items, street snacks (Bread & Banana), throwables (Stone & Wrench) & subway orb
      worldData.missionObjects.forEach((m, idx) => {
        if (!m.collected) {
          const core = m.mesh.getObjectByName('floatingCore');
          if (core) {
            core.rotation.y = elapsed * 1.8 + idx;
            core.position.y = 1.2 + Math.sin(elapsed * 2.5 + idx) * 0.12;
          }
        }
      });

      worldData.snackObjects.forEach((s, idx) => {
        if (s.respawnTimer <= 0) {
          const core = s.mesh.getObjectByName('snackCore');
          if (core) {
            core.rotation.y = elapsed * 2.4 + idx;
            core.position.y = 0.85 + Math.sin(elapsed * 3.2 + idx) * 0.12;
          }
        }
      });

      worldData.throwableObjects.forEach((th, idx) => {
        if (th.respawnTimer <= 0) {
          const core = th.mesh.getObjectByName('throwableCore');
          if (core) {
            core.rotation.y = elapsed * 2.1 + idx;
            core.position.y = 0.68 + Math.sin(elapsed * 3.0 + idx) * 0.1;
          }
        }
      });

      const extOrb = worldData.extractionBeacon.getObjectByName('beaconOrb');
      if (extOrb) {
        extOrb.rotation.y = elapsed * 2.4;
        extOrb.rotation.x = elapsed * 1.3;
        extOrb.position.y = 5.65 + Math.sin(elapsed * 3.2) * 0.16;
      }
      const portalInnerRing = worldData.extractionBeacon.getObjectByName('portalInnerRing');
      if (portalInnerRing) {
        portalInnerRing.rotation.z = -elapsed * 1.45;
      }
      const portalVortex = worldData.extractionBeacon.getObjectByName('portalVortex');
      if (portalVortex) {
        portalVortex.rotation.z = elapsed * 2.1;
        const pulseScale = 0.96 + Math.sin(elapsed * 4.5) * 0.05;
        portalVortex.scale.set(pulseScale, pulseScale, 1);
      }

      // PHASE A: TITLE SCREEN (Showcasing 3D Chibi Character + Reference Image 2 Yellow Car & Colorful Rowhouse Street!)
      if (sim.phase === 'title') {
        aiSystem.updateMonitorsVisualRotation(dt);
        const panX = -18 + Math.sin(elapsed * 0.25) * 6;
        playerRig.group.visible = true;
        playerRig.group.position.set(panX + 2.2, 0, 5.2);
        playerRig.group.rotation.y = -0.35 + Math.sin(elapsed * 1.5) * 0.18;
        playerRig.leftArm.rotation.x = Math.sin(elapsed * 2.2) * 0.15;
        playerRig.rightArm.rotation.x = -Math.sin(elapsed * 2.2) * 0.15;

        camera.position.set(panX, 4.2, 10.8);
        camera.lookAt(panX, 2.2, -16.0);
        renderer.render(scene, camera);
        return;
      }

      // PHASE B: STREET STROLLING
      if (sim.phase === 'strolling') {
        checkStreetPickupsAndProjectiles(dt);
        const moveInfo = updatePlayerMovement(dt, cfg.walkSpeed, true);
        updateThirdPersonCamera(dt);

        // Rotate 360° detectors & check if player stepped into a detector during strolling
        const spottedByMonitorInStroll = aiSystem.updateStreetMonitors(
          dt,
          sim.playerPos,
          sim.isCrouching,
          false,
          false,
          worldData.colliders
        );
        if (spottedByMonitorInStroll) {
          aiSystem.completeArrivalDeployment();
          sim.phaseBeforePause = 'playing';
          sim.phase = 'playing';
          setPhase('playing');
          renderer.render(scene, camera);
          return;
        }

        sim.strollTimer += dt * (moveInfo.isMoving ? 1.0 : 0.38);

        hudSyncTimer += dt;
        if (hudSyncTimer >= 0.08) {
          hudSyncTimer = 0;
          setHud((prev) => ({
            ...prev,
            strollProgress: Math.min(100, Math.round((sim.strollTimer / 3.0) * 100)),
            stoneCount: sim.stoneCount,
            wrenchCount: sim.wrenchCount,
          }));
        }

        if (sim.strollTimer >= 3.0 || sim.triggerCutsceneRequested) {
          sim.triggerCutsceneRequested = false;
          sim.cutsceneTimer = 0;
          aiSystem.resetForArrivalCutscene();
          sim.phase = 'cutscene';
          setPhase('cutscene');
        }

        renderer.render(scene, camera);
        return;
      }

      // PHASE C: CINEMATIC CUTSCENE
      if (sim.phase === 'cutscene') {
        aiSystem.updateMonitorsVisualRotation(dt);
        sim.cutsceneTimer += dt;
        if (sim.skipCutsceneRequested) {
          sim.skipCutsceneRequested = false;
          sim.cutsceneTimer = 5.3;
        }

        const cutState = aiSystem.updateArrivalCutscene(sim.cutsceneTimer, dt);
        camera.position.lerp(cutState.cameraPos, Math.min(1, dt * 8));
        camera.lookAt(cutState.cameraLookAt);

        hudSyncTimer += dt;
        if (hudSyncTimer >= 0.06) {
          hudSyncTimer = 0;
          setHud((prev) => ({
            ...prev,
            cutsceneTitle: cutState.captionTitle,
            cutsceneSubtitle: cutState.captionSubtitle,
          }));
        }

        if (cutState.finished) {
          aiSystem.completeArrivalDeployment();
          sim.phaseBeforePause = 'playing';
          sim.phase = 'playing';
          setPhase('playing');
        }

        renderer.render(scene, camera);
        return;
      }

      if (sim.phase !== 'playing') {
        renderer.render(scene, camera);
        return;
      }

      // PHASE D: ACTIVE GAMEPLAY
      sim.timeRemaining = Math.max(0, sim.timeRemaining - dt);
      if (sim.timeRemaining <= 0) {
        sim.phase = 'gameover';
        soundFX.playCaptured();
        setHud((prev) => ({
          ...prev,
          timeRemaining: 0,
          capturedByOfficer: '「参保直通车」街区督查组',
          certificateNo: `NO.2026-CB-${Math.floor(100000 + Math.random() * 899999)}`,
          failReason: '街区封锁倒计时归零，被流动督查组现场办结参保登记。',
        }));
        setPhase('gameover');
        return;
      }

      if (sim.crouchJustPressed) {
        sim.crouchJustPressed = false;
        if (!sim.activeHidingSpot) {
          sim.isCrouching = !sim.isCrouching;
        }
      }

      let nearestSpot: HidingSpot | null = null;
      let nearestSpotDist = Infinity;
      for (const spot of worldData.hidingSpots) {
        const dSpot = sim.playerPos.distanceTo(spot.position);
        if (dSpot < 3.0 && dSpot < nearestSpotDist) {
          nearestSpotDist = dSpot;
          nearestSpot = spot;
        }
      }

      let nearestMission = null;
      for (const m of worldData.missionObjects) {
        if (!m.collected && sim.playerPos.distanceTo(m.mesh.position) < 2.5) {
          nearestMission = m;
          break;
        }
      }

      if (sim.interactJustPressed) {
        sim.interactJustPressed = false;
        if (sim.activeHidingSpot) {
          // 主动离开电话亭：消耗该电话亭（每个电话亭限躲一次）
          const spot = sim.activeHidingSpot;
          spot.used = true;
          spot.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
              child.visible = false;
            }
          });
          sim.playerPos.copy(spot.exitPosition);
          sim.activeHidingSpot = null;
          sim.boothHidingTimer = 0;
          playerRig.group.visible = true;
          soundFX.playHideToggle(false);
          sim.throwWarningMessage = '🚪 已主动钻出电话亭，该电话亭已使用完毕（限躲一次）！';
          sim.throwWarningTimer = 2.5;
        } else if (nearestMission) {
          nearestMission.collected = true;
          nearestMission.mesh.visible = false;
          sim.collectedCount += 1;
          soundFX.playPickup();
          aiSystem.onMissionTaskCompleted(sim.collectedCount, nearestMission.spec.name);
        } else if (nearestSpot) {
          if (nearestSpot.used) {
            sim.throwWarningMessage = '🚫 该电话亭已使用过（每个电话亭限躲一次）！请寻找其他掩体！';
            sim.throwWarningTimer = 2.5;
            soundFX.playAlertPing('suspicious');
          } else {
            sim.activeHidingSpot = nearestSpot;
            sim.boothHidingTimer = 0;
            sim.playerPos.copy(nearestSpot.hidePosition);
            sim.isCrouching = false;
            playerRig.group.visible = false;
            soundFX.playHideToggle(true);
          }
        }
      }

      // 核心策划机制：电话亭最多能隐藏 10 秒，一个电话亭只能躲一次！
      if (sim.activeHidingSpot) {
        sim.boothHidingTimer += dt;
        if (sim.boothHidingTimer >= 10.0) {
          const expiredSpot = sim.activeHidingSpot;
          expiredSpot.used = true;
          expiredSpot.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
              child.visible = false;
            }
          });
          sim.playerPos.copy(expiredSpot.exitPosition);
          sim.activeHidingSpot = null;
          sim.boothHidingTimer = 0;
          playerRig.group.visible = true;
          soundFX.playHideToggle(false);
          soundFX.playAlertPing('suspicious');
          sim.throwWarningMessage = '⚠️ 电话亭隐蔽达到 10 秒上限！已被强制现身，该电话亭无法再次使用！';
          sim.throwWarningTimer = 3.5;
        }
      }

      for (const m of worldData.missionObjects) {
        if (!m.collected && sim.playerPos.distanceTo(m.mesh.position) < 1.6) {
          m.collected = true;
          m.mesh.visible = false;
          sim.collectedCount += 1;
          soundFX.playPickup();
          aiSystem.onMissionTaskCompleted(sim.collectedCount, m.spec.name);
        }
      }

      // Check & consume Street Energy Snacks (Bread & Banana) + Street Throwables (Stones & Wrenches) + Projectiles
      checkStreetPickupsAndProjectiles(dt);

      let isSprinting = false;
      let noiseType: '静默' | '轻微' | '中低' | '中高' = '静默';

      if (!sim.activeHidingSpot) {
        const moveRes = updatePlayerMovement(dt, cfg.walkSpeed, true);
        isSprinting = moveRes.isSprinting;
        noiseType = moveRes.noiseType;
      }

      let isInBush = false;
      for (const b of worldData.bushZones) {
        if (sim.playerPos.distanceTo(b.position) <= b.radius) {
          isInBush = true;
          break;
        }
      }

      // 【躲藏时长】按玩家未被保安抓获的累计存活周旋时间计算（只要未被抓，每秒持续累加！）
      sim.totalHidingSeconds += dt;

      const hideDurationMultiplier = 1 + sim.totalHidingSeconds * 0.035;
      const alertMultiplier = aiSystem.globalAlert >= 50 ? 1.45 : 1.0;

      let baseRate = 38;
      let rateLabel = '街头周旋核定';
      if (sim.activeHidingSpot) {
        baseRate = 165;
        rateLabel = '亭内躲藏加计';
      } else if (isInBush && sim.isCrouching) {
        baseRate = 115;
        rateLabel = '灌木隐蔽加计';
      } else if (sim.isCrouching) {
        baseRate = 82;
        rateLabel = '矮墙蹲伏加计';
      }

      const currentContributionRate = Math.round(
        baseRate * hideDurationMultiplier * alertMultiplier
      );
      sim.contributionAmount += currentContributionRate * dt;

      // Update AI, Full-Map Patrol Loop, Anti-Camping Radar & Security Guards
      const prevSpotted = aiSystem.timesSpotted;
      const aiOutcome = aiSystem.update(
        dt,
        cfg,
        worldData,
        sim.playerPos,
        sim.isCrouching,
        sim.activeHidingSpot !== null,
        isInBush,
        charSpec.stealthFactor
      );

      // If player camped inside a hiding booth for 12s, big-data radar forces them out!
      if (aiOutcome.forceExitLocker && sim.activeHidingSpot) {
        sim.playerPos.copy(sim.activeHidingSpot.exitPosition);
        sim.activeHidingSpot = null;
        playerRig.group.visible = true;
        soundFX.playHideToggle(false);
      }

      if (aiSystem.timesSpotted > prevSpotted) {
        sim.cameraShake = 0.45;
        sim.contributionAmount += 800;
      }

      if (aiOutcome.captured) {
        sim.phase = 'gameover';
        const certId = `NO.2026-CB-${Math.floor(100000 + Math.random() * 899999)}`;
        setHud((prev) => ({
          ...prev,
          capturedByOfficer: aiOutcome.capturedBy || '保安队长·老王',
          certificateNo: certId,
          failReason: `在【${STAGE_CONFIGS[sim.stageId].name}】被 ${aiOutcome.capturedBy} 当场拦下，现场签发《参保登记证明》！`,
          timesSpotted: aiSystem.timesSpotted,
          contributionAmount: Math.round(sim.contributionAmount),
          totalHidingSeconds: Number(sim.totalHidingSeconds.toFixed(1)),
          hitReactionPopup: null,
        }));
        setPhase('gameover');
        return;
      }

      // Check Subway Extraction Progress
      const distToExtraction = Math.hypot(
        sim.playerPos.x - EXTRACTION_POINT.position[0],
        sim.playerPos.z - EXTRACTION_POINT.position[2]
      );
      if (
        sim.collectedCount >= MISSION_ITEMS.length &&
        distToExtraction <= EXTRACTION_POINT.radius &&
        !sim.activeHidingSpot
      ) {
        sim.extractionTimer += dt;
        if (sim.extractionTimer >= WORLD_CONFIG.extractionHoldTime) {
          sim.phase = 'victory';
          soundFX.playVictory();
          const passCertId = `NO.2026-PASS-${Math.floor(100000 + Math.random() * 899999)}`;
          setHud((prev) => ({
            ...prev,
            certificateNo: passCertId,
            timesSpotted: aiSystem.timesSpotted,
            contributionAmount: Math.round(sim.contributionAmount),
            totalHidingSeconds: Number(sim.totalHidingSeconds.toFixed(1)),
            hitReactionPopup: null,
          }));
          setPhase('victory');
          return;
        }
      } else {
        sim.extractionTimer = Math.max(0, sim.extractionTimer - dt * 2);
      }

      updateThirdPersonCamera(dt);

      // Proximity Heartbeat Audio & Sensor + Dynamic BGM Chase Tension
      soundFX.setChaseTension(aiSystem.activeChaserName !== null);
      const minThreatDist = aiSystem.getMinThreatDistance(sim.playerPos);
      const heartbeatState = soundFX.updateProximityHeartbeat(minThreatDist, dt);

      // Update Minimap Snapshot (Note: Minimap hides guard/car positions and only pulses with heartbeat)
      minimapSnapRef.current.playerX = sim.playerPos.x;
      minimapSnapRef.current.playerZ = sim.playerPos.z;
      minimapSnapRef.current.playerYaw = sim.playerYaw;
      minimapSnapRef.current.carX = aiSystem.carPosition.x;
      minimapSnapRef.current.carZ = aiSystem.carPosition.z;
      minimapSnapRef.current.carYaw = aiSystem.carRotationY;
      minimapSnapRef.current.carSeesPlayer = aiSystem.carCanSeePlayer;
      minimapSnapRef.current.carVisionRange = aiSystem.currentStageConfig.carVisionRange;
      minimapSnapRef.current.globalAlert = aiSystem.globalAlert;
      minimapSnapRef.current.heartbeatIntensity = heartbeatState.intensity;
      minimapSnapRef.current.heartbeatBpm = heartbeatState.bpm;

      // Sync HUD at ~14Hz (Greatly reduces virtual DOM diffing & CPU load!)
      hudSyncTimer += dt;
      if (hudSyncTimer >= 0.07) {
        hudSyncTimer = 0;

        minimapSnapRef.current.officers = aiSystem.officers.map((o) => ({
          id: o.id,
          x: o.position.x,
          z: o.position.z,
          yaw: o.rotationY,
          inVehicle: o.inVehicle,
          state: o.state,
        }));

        minimapSnapRef.current.monitors = aiSystem.monitors.map((m) => ({
          x: m.position.x,
          z: m.position.z,
          yaw: m.baseYaw + m.sweepAngle,
          radius: m.detectionRadius,
        }));

        const currentUseKind: ThrowableKind = sim.wrenchCount > 0 ? 'wrench' : 'stone';
        const currentMaxThrowRange = currentUseKind === 'wrench' ? 18.0 : 22.0;
        const currentTargetStatus = aiSystem.findBestThrowTarget(
          sim.playerPos,
          sim.playerYaw,
          currentMaxThrowRange
        );

        let activeZoneName = '中央商业街道';
        for (const z of MAP_ZONES) {
          if (
            sim.playerPos.x >= z.bounds.minX &&
            sim.playerPos.x <= z.bounds.maxX &&
            sim.playerPos.z >= z.bounds.minZ &&
            sim.playerPos.z <= z.bounds.maxZ
          ) {
            activeZoneName = z.name;
            break;
          }
        }

        let prompt: string | null = null;
        if (sim.activeHidingSpot) {
          const remSec = Math.max(0, 10.0 - sim.boothHidingTimer);
          prompt = `📞 正在【${sim.activeHidingSpot.label}】内隐蔽 · 倒计时 ${remSec.toFixed(1)}s (上限10s·限躲1次) · 按 [E] 钻出`;
        } else if (nearestMission) {
          prompt = `按 [E] 拾取：【${nearestMission.spec.name}】`;
        } else if (nearestSpot) {
          if (nearestSpot.used) {
            prompt = `🚫【${nearestSpot.label}】已使用过（每个电话亭限躲一次，请寻找其他掩体）`;
          } else {
            prompt = `按 [E] 钻进【${nearestSpot.label}】隐蔽 (最多10秒·限躲1次)`;
          }
        } else if (distToExtraction <= EXTRACTION_POINT.radius) {
          if (sim.collectedCount < MISSION_ITEMS.length) {
            prompt = `🌀 时空撤离传送门未激活：需先收集 3 份免检材料 (${sim.collectedCount}/3)`;
          } else {
            prompt = `🌀 正在穿越时空传送门撤离... ${(
              WORLD_CONFIG.extractionHoldTime - sim.extractionTimer
            ).toFixed(1)}s`;
          }
        }

        const carStateMap: Record<string, string> = {
          Patrol: `直通车巡航 (视野 ${aiSystem.currentStageConfig.carVisionRange}m)`,
          SlowDown: '接近街口减速观察',
          Stop: '街口停车核查',
          Deploy: '车门打开 · 派遣保安下车',
          Search: '停车配合保安搜街',
          Return: '等待保安返回登车',
          Resume: '恢复街道巡航',
        };

        let maxDet = aiSystem.carDetectionProgress;
        for (let i = 0; i < aiSystem.officers.length; i++) {
          if (aiSystem.officers[i].detectionProgress > maxDet) {
            maxDet = aiSystem.officers[i].detectionProgress;
          }
        }

        // Compute Patrol Car Direction Detector metrics (distance, camera-relative compass angle, and street heading)
        const dxCar = aiSystem.carPosition.x - sim.playerPos.x;
        const dzCar = aiSystem.carPosition.z - sim.playerPos.z;
        const carDist = Math.round(Math.hypot(dxCar, dzCar));
        // Camera forward look vector is (-sin(cameraYaw), -cos(cameraYaw))
        const camForwardYaw = sim.cameraYaw + Math.PI;
        const worldAngleToCar = Math.atan2(dxCar, dzCar);
        const relBearingRad = camForwardYaw - worldAngleToCar;
        const carBearingDeg = Math.round((relBearingRad * 180) / Math.PI);

        // Determine Patrol Car's driving direction label from carRotationY
        const carFwdX = Math.sin(aiSystem.carRotationY);
        const carFwdZ = Math.cos(aiSystem.carRotationY);
        let carHeadingLabel = '向东巡航';
        if (Math.abs(carFwdX) >= Math.abs(carFwdZ)) {
          carHeadingLabel = carFwdX >= 0 ? '车头朝东 →' : '← 车头朝西';
        } else {
          carHeadingLabel = carFwdZ >= 0 ? '车头朝南 ↓' : '↑ 车头朝北';
        }

        let visionBoostCnt = 0;
        for (let i = 0; i < aiSystem.officers.length; i++) {
          if (aiSystem.officers[i].visionBoostActive) visionBoostCnt++;
        }

        const collectedIdsList: string[] = [];
        const missionZoneList: string[] = [];
        for (let i = 0; i < worldData.missionObjects.length; i++) {
          const mObj = worldData.missionObjects[i];
          if (mObj.collected) collectedIdsList.push(mObj.spec.id);
          missionZoneList.push(mObj.spec.zoneName);
        }

        setHud((prev) => ({
          ...prev,
          stamina: Math.round(sim.stamina),
          globalAlert: Math.round(aiSystem.globalAlert),
          maxOfficerDetection: Math.round(maxDet),
          collectedIds: collectedIdsList,
          timeRemaining: Math.ceil(sim.timeRemaining),
          extractionProgress: Math.min(
            100,
            Math.round((sim.extractionTimer / WORLD_CONFIG.extractionHoldTime) * 100)
          ),
          isCrouching: sim.isCrouching,
          isSprinting,
          hidingSpotLabel: sim.activeHidingSpot ? sim.activeHidingSpot.label : null,
          inBush: isInBush,
          currentZone: activeZoneName,
          interactionPrompt: prompt,
          carStatusText: carStateMap[aiSystem.carState] || aiSystem.carState,
          carRadioMessage: aiSystem.carRadioMessage,
          escapeBannerMessage: aiSystem.escapeBannerMessage,
          timesSpotted: aiSystem.timesSpotted,
          noiseLevel: noiseType,
          contributionAmount: Math.round(sim.contributionAmount),
          contributionRate: currentContributionRate,
          contributionStatusLabel: rateLabel,
          totalHidingSeconds: Number(sim.totalHidingSeconds.toFixed(1)),
          snackBoostRemaining: Number(sim.snackBoostTimer.toFixed(1)),
          lastSnackEatenName: sim.lastSnackEatenName,
          stoneCount: sim.stoneCount,
          wrenchCount: sim.wrenchCount,
          hitReactionPopup: sim.hitReactionPopup ? { ...sim.hitReactionPopup } : null,
          activeChaserName: aiSystem.activeChaserName,
          isChaserSeeingPlayer: aiSystem.isChaserSeeingPlayer,
          chaseLoseSightRatio: aiSystem.activeChaseLoseSightRatio,
          chaseLoseSightRemainingSec: Number(
            aiSystem.activeChaseLoseSightRemainingSec.toFixed(1)
          ),
          throwBoostActiveSec: Number(aiSystem.activeChaserThrowBoostSec.toFixed(1)),
          collectiveBoostActive: aiSystem.collectiveThrowBoostTimer > 0,
          heartbeatIntensity: Number(heartbeatState.intensity.toFixed(2)),
          heartbeatBpm: heartbeatState.bpm,
          officerSpeedBonusPct: Math.round((aiSystem.taskSpeedMultiplier - 1) * 100),
          campExposurePct: Math.round(aiSystem.campExposureRatio * 100),
          missionZones: missionZoneList,
          visionBoostCount: visionBoostCnt,
          throwWarningMessage: sim.throwWarningMessage,
          targetInRange: currentTargetStatus.inRange,
          targetDistance: Number(currentTargetStatus.distance.toFixed(1)),
          targetMaxRange: currentMaxThrowRange,
          nearestTargetName: currentTargetStatus.targetName,
          deployedOfficerRemainingSec: Number(
            aiSystem.deployedOfficerRemainingSec.toFixed(1)
          ),
          isOfficerDeployedFromCar: aiSystem.isOfficerDeployedFromCar,
          isHidingInBooth: sim.activeHidingSpot !== null,
          boothHidingRemainingSec: sim.activeHidingSpot
            ? Math.max(0, 10.0 - sim.boothHidingTimer)
            : 0,
          carBearingDeg,
          carDistance: carDist,
          carHeadingLabel,
          carSeesPlayer: aiSystem.carCanSeePlayer,
          activeMonitorCount: aiSystem.monitors.length,
        }));
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('resize', handleResize);
      activeProjectiles.forEach((p) => {
        disposeHierarchy(p.mesh);
        scene.remove(p.mesh);
      });
      disposeHierarchy(playerRig.group);
      disposeHierarchy(worldData.worldRootGroup);
      aiSystem.dispose();
      soundFX.stopBgm();
      mats.dispose();
      renderer.dispose();
    };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatCurrency = (val: number) => {
    return `¥ ${val.toLocaleString('zh-CN')}`;
  };

  const getAlertTierLabel = (alert: number) => {
    if (alert < 25) return { text: '平静 (Calm)', color: 'text-slate-300', bar: 'bg-sky-400' };
    if (alert < 50) return { text: '警觉 (Vigilant)', color: 'text-amber-300', bar: 'bg-amber-400' };
    if (alert < 75) return { text: '搜街 (Investigate)', color: 'text-orange-400', bar: 'bg-orange-500' };
    if (alert < 100) return { text: '高度警戒 (High Alert)', color: 'text-red-400', bar: 'bg-red-500' };
    return { text: '全街封锁 (Lockdown)', color: 'text-red-500', bar: 'bg-red-600' };
  };

  const alertTier = getAlertTierLabel(hud.globalAlert);
  const activeModeSpec = PLAYSTYLE_MODES[playstyle];
  const nextStageId: StageId =
    stageId === 'stage_1' ? 'stage_2' : stageId === 'stage_2' ? 'stage_3' : 'stage_1';

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#0b0f19]">
      {/* Isolated WebGL Canvas Mount — Clean Third-Person Viewport without any character anchor/crosshair */}
      <div
        ref={canvasMountRef}
        className={`fixed inset-0 w-full h-full z-0 ${
          phase === 'playing' || phase === 'strolling'
            ? isPointerLocked
              ? 'cursor-none'
              : 'cursor-grab active:cursor-grabbing'
            : ''
        }`}
      />

      {/* 1. TITLE SCREEN OVERLAY */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 md:p-8 pointer-events-none bg-gradient-to-t from-[#0b0f19]/95 via-[#0b0f19]/45 to-[#0b0f19]/80 overflow-y-auto">
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="text-xs font-mono-tabular tracking-wider text-slate-300">
              OUT OF SIGHT · 3D 街道潜行躲猫猫
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={bgmTrack}
                onChange={(e) => handleSelectBgmTrack(e.target.value as BgmTrackId)}
                className="px-2.5 py-1.5 text-xs font-medium text-amber-300 bg-[#111827] border border-slate-700 rounded-lg cursor-pointer outline-none"
                title="切换可商用背景音乐 (BGM)"
              >
                {BGM_TRACKS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#0b0f19] text-slate-200">
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111827] border border-slate-700 rounded-lg">
                <button
                  onClick={toggleMute}
                  className="text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isMuted ? '🔇 已静音' : `🔊 音量 ${Math.round(audioVolume * 100)}%`}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : audioVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 accent-amber-400 cursor-pointer"
                  title="调节主音量"
                />
              </div>
            </div>
          </div>

          <div className="my-auto max-w-5xl pointer-events-auto py-2">
            <svg
              viewBox="0 0 560 110"
              className="w-full max-w-[430px] h-auto mb-2"
              aria-label="OUT OF SIGHT 视线之外"
            >
              <defs>
                <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="65%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <polygon
                points="6,92 78,20 78,92"
                fill="rgba(245, 158, 11, 0.22)"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <circle cx="14" cy="86" r="5" fill="#f59e0b" />
              <line
                x1="14"
                y1="86"
                x2="78"
                y2="56"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <text
                x="94"
                y="70"
                fill="url(#titleGrad)"
                fontFamily="'Barlow Condensed', sans-serif"
                fontWeight="700"
                fontSize="66"
                letterSpacing="3"
              >
                OUT OF SIGHT
              </text>
              <text
                x="96"
                y="100"
                fill="#fbbf24"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontWeight="700"
                fontSize="19"
                letterSpacing="4"
              >
                视线之外 · 街头潜行大作战
              </text>
            </svg>

            <p className="text-xs md:text-sm text-slate-200 max-w-3xl leading-relaxed mb-3.5">
              在「参保直通车」、巡逻保安与路口 <span className="text-sky-300 font-bold">📡 红外检测器</span> 的严密排查下，收集齐街区内的 <span className="text-amber-300 font-semibold">3 份免检材料</span> 并从东侧地铁口撤离！善用街角建筑、灌木丛与电话亭隐蔽行踪；拾取路边的 <span className="text-sky-300 font-semibold">🪨鹅卵石 / 🔧合金扳手</span> 按 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-amber-300 font-mono">G</kbd> 键可投掷干扰目标，若被发现请迅速绕过街角摆脱视线！
            </p>

            {/* 1. CHOOSE STAGE / SCENE (3 Distinct Stages) */}
            <div className="mb-3.5">
              <div className="text-xs font-semibold text-sky-300 mb-1.5">
                1. 选择行动街区：
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(Object.keys(STAGE_CONFIGS) as StageId[]).map((sKey) => {
                  const st = STAGE_CONFIGS[sKey];
                  const isSel = stageId === sKey;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setStageId(st.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#1e293b] border-sky-400 shadow-lg ring-1 ring-sky-400/50'
                          : 'bg-[#0b0f19]/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white">{st.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono-tabular">
                          车载探测 {st.carVisionRange}m
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                        {st.description}
                      </div>
                      <div className="text-[10px] text-amber-300 font-mono-tabular mt-1">
                        摆脱追击需隐蔽: {st.loseSightThresholdSec}秒 · 含多处路口检测器
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CHOOSE 3D PLAYER CHARACTER */}
            <div className="mb-3.5">
              <div className="text-xs font-semibold text-amber-300 mb-1.5">
                2. 选择出战角色：
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {(Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]).map((cKey) => {
                  const ch = PLAYER_CHARACTERS[cKey];
                  const isSel = characterId === cKey;
                  const portrait = characterPortraits[cKey];
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setCharacterId(ch.id)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        isSel
                          ? 'bg-[#1e293b] border-amber-400 shadow-lg ring-1 ring-amber-400/50'
                          : 'bg-[#0b0f19]/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-600 bg-slate-900 shrink-0">
                        {portrait ? (
                          <img
                            src={portrait}
                            alt={ch.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                            角色头像
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-white truncate">
                            {ch.name}
                          </span>
                          {isSel && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold shrink-0">
                              出战
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-amber-300 font-medium mt-0.5 leading-snug line-clamp-2">
                          {ch.perkLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. CHOOSE PLAYSTYLE MODE */}
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-400 mb-1.5">
                3. 选择体验节奏模式：
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(PLAYSTYLE_MODES) as PlaystyleModeId[]).map((mKey) => {
                  const m = PLAYSTYLE_MODES[mKey];
                  const selected = playstyle === mKey;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPlaystyle(m.id)}
                      className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#1e293b] border-amber-400 text-white'
                          : 'bg-[#0b0f19]/90 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{m.name}</div>
                      <div className="text-[11px] font-mono-tabular text-amber-400/90 mt-0.5">
                        保安视野 {m.normalVisionRange}m · 冲刺 {m.runSpeed}m/s
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => startStreetStroll()}
                className="px-7 py-3.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-lg transition-transform active:scale-98 cursor-pointer whitespace-nowrap shrink-0"
              >
                进入【{activeStageSpec.name}】开始挑战 (Enter / Space)
              </button>
            </div>
          </div>

          <div className="text-xs font-mono-tabular text-slate-400 pointer-events-auto">
            WASD 移动 · Shift 冲刺 · C 蹲伏 · E 互动/躲藏 · G 投掷道具 · 收集 3 份免检材料后前往东侧地铁口撤离
          </div>
        </div>
      )}

      {/* 2A. STROLLING PHASE OVERLAY */}
      {phase === 'strolling' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <div className="bg-[#0b0f19]/90 border border-slate-700/80 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
              {activePortraitUrl && (
                <img
                  src={activePortraitUrl}
                  alt={activeCharSpec.name}
                  className="w-11 h-11 rounded-lg border border-amber-400 object-cover"
                />
              )}
              <div>
                <div className="text-xs text-amber-400 font-semibold">
                  {activeStageSpec.name} · {activeCharSpec.name} 正在街上闲逛
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  用 W / A / S / D 走走看风景（路上的 🪨石头/🔧扳手 与 🥐面包/🍌香蕉 可直接捡起！）
                </div>
                <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-amber-400 transition-all duration-100"
                    style={{ width: `${hud.strollProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={triggerCutsceneNow}
                className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                立即触发「参保直通车」抵达 [Space]
              </button>
              <button
                onClick={() => startStreetStroll()}
                className="px-3 py-2.5 text-xs font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                🔄 重开 [R]
              </button>
              <button
                onClick={pauseGameplay}
                className="px-3 py-2.5 text-xs font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                ⏸ 暂停 [Esc]
              </button>
            </div>
          </div>

          <div className="mx-auto mb-4 px-5 py-2.5 rounded-lg bg-[#0b0f19]/90 border border-slate-700 text-xs text-slate-300 flex items-center gap-3">
            <span>
              🖱️ {isPointerLocked ? '已进入 3D 自由视角（直接移动鼠标 360° 环视，滚轮缩放视距）' : '点击街道画面进入 360° 自由鼠标视角（或按住鼠标拖拽旋转）'}
            </span>
            <span className="text-slate-500">|</span>
            <span>按住 [Alt] 呼出鼠标指针 · 按 [G] 投掷 · 按 [Esc] 暂停</span>
          </div>
        </div>
      )}

      {/* 2B. CINEMATIC CUTSCENE OVERLAY */}
      {phase === 'cutscene' && (
        <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between">
          <div className="w-full h-20 bg-[#0b0f19] border-b border-slate-800 flex items-center justify-between px-8 pointer-events-auto">
            <div className="text-xs font-mono-tabular tracking-widest text-amber-400 font-semibold">
              CINEMATIC EVENT · {activeStageSpec.name} · 参保直通车突击巡查
            </div>
            <button
              onClick={skipCutsceneNow}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              跳过特写镜头 [Space / Esc]
            </button>
          </div>

          <div className="w-full h-28 bg-[#0b0f19] border-t border-slate-800 flex flex-col items-center justify-center px-6 text-center">
            <div className="text-base md:text-lg font-bold text-amber-400 tracking-wide">
              {hud.cutsceneTitle}
            </div>
            <div className="text-xs md:text-sm text-slate-200 mt-1 max-w-2xl">
              {hud.cutsceneSubtitle}
            </div>
          </div>
        </div>
      )}

      {/* 3. ULTRA-CLEAN LOW-OCCLUSION IN-GAME HUD (90%+ Unobstructed 3D Viewport) */}
      {phase === 'playing' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3">
          {/* Subtle Screen-Edge Heartbeat Vignette when Guard/Patrol Car is Close (< 28m) */}
          {hud.heartbeatIntensity > 0.08 && (
            <div
              className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-150"
              style={{
                boxShadow: `inset 0 0 ${Math.round(45 + hud.heartbeatIntensity * 95)}px rgba(239, 68, 68, ${(
                  hud.heartbeatIntensity * 0.42
                ).toFixed(2)})`,
              }}
            />
          )}

          {/* TOP EDGE BAR: Left Compact Status Card + Center Floating Alerts + Right Blind Minimap */}
          <div className="relative z-10 flex items-start justify-between gap-3">
            {/* Top-Left: Sleek Compact Status & Mission Pill Box (264px wide, translucent) */}
            <div className="pointer-events-auto bg-[#0b0f19]/78 backdrop-blur-md border border-slate-800/90 rounded-xl p-2.5 w-[268px] shadow-lg space-y-2">
              {/* Row 1: Avatar + Stage Switcher + Countdown */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {activePortraitUrl && (
                    <img
                      src={activePortraitUrl}
                      alt={activeCharSpec.name}
                      className="w-8 h-8 rounded-md border border-amber-400 object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      {(['stage_1', 'stage_2', 'stage_3'] as StageId[]).map((sKey, idx) => (
                        <button
                          key={sKey}
                          onClick={() => startStreetStroll(undefined, sKey)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer transition-colors ${
                            stageId === sKey
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-slate-800/90 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          关{idx + 1}
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] font-bold text-white truncate mt-0.5">
                      {hud.currentZone}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[9px] text-slate-400">封锁倒计时</div>
                  <div
                    className={`text-sm font-extrabold font-mono-tabular leading-tight ${
                      hud.timeRemaining <= 45 ? 'text-red-400' : 'text-amber-400'
                    }`}
                  >
                    {formatTime(hud.timeRemaining)}
                  </div>
                </div>
              </div>

              {/* Row 2: Live Contribution Amount + Uncaught Hiding Duration + Proximity Heartbeat Sensor */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="px-2 py-1.5 rounded-lg bg-slate-900/90 border border-amber-500/35">
                  <div className="flex items-center justify-between text-[9px] text-amber-300">
                    <span>参保金</span>
                    <span className="font-mono-tabular text-sky-300">
                      躲藏 {hud.totalHidingSeconds.toFixed(0)}s
                    </span>
                  </div>
                  <div className="text-sm font-extrabold font-mono-tabular text-amber-400 leading-tight mt-0.5">
                    {formatCurrency(hud.contributionAmount)}
                  </div>
                </div>

                {/* Heartbeat Proximity Sensor (Replaces Map Enemy Markers!) */}
                <div
                  className={`px-2 py-1.5 rounded-lg border flex flex-col justify-between ${
                    hud.heartbeatIntensity > 0.55
                      ? 'bg-red-950/85 border-red-500 text-red-200'
                      : hud.heartbeatIntensity > 0.02
                      ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                      : 'bg-slate-900/90 border-slate-800 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px]">
                    <span>心跳迫近感应</span>
                    <span className="font-mono-tabular font-bold">
                      {hud.heartbeatBpm > 0 ? `${hud.heartbeatBpm} BPM` : '平静'}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold truncate mt-0.5">
                    {hud.heartbeatIntensity > 0.65
                      ? '💓 极近！强烈心跳'
                      : hud.heartbeatIntensity > 0.25
                      ? '💗 逼近！心跳加快'
                      : hud.heartbeatIntensity > 0.02
                      ? '🩷 附近有巡逻声'
                      : '💚 走远安全(无声)'}
                  </div>
                </div>
              </div>

              {/* Row 2.5: Patrol Car 360° Direction Detector & Heading Radar */}
              <div
                className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                  hud.carSeesPlayer
                    ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
                    : 'bg-slate-900/90 border-sky-500/45 text-sky-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 ${
                      hud.carSeesPlayer
                        ? 'bg-red-500/30 border-red-400 text-red-200'
                        : 'bg-sky-500/20 border-sky-400 text-amber-300'
                    }`}
                    title="参保车相对您当前镜头视角的方位指针"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 transition-transform duration-75"
                      style={{ transform: `rotate(${hud.carBearingDeg}deg)` }}
                    >
                      <path
                        d="M12 2L19 19L12 15L5 19L12 2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] text-slate-300 flex items-center gap-1">
                      <span className="font-bold text-amber-300">🚐 参保车方向检测器</span>
                      <span className="font-mono-tabular text-sky-300">({hud.carDistance}m)</span>
                    </div>
                    <div className="text-[10px] font-bold truncate">
                      {hud.carSeesPlayer
                        ? '🚨 已被参保车前向雷达锁定！'
                        : `${hud.carHeadingLabel} · ${hud.carStatusText}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Compact Randomized Mission Progress + Permanent Officer Speed Bonus */}
              <div className="px-2 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-200">
                    免检材料 ({hud.collectedIds.length}/3)
                  </span>
                  <span
                    className={`font-mono-tabular font-bold px-1.5 py-0.5 rounded text-[9px] ${
                      hud.officerSpeedBonusPct > 0
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    👮 保安增速 +{hud.officerSpeedBonusPct}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {MISSION_ITEMS.map((item, idx) => {
                    const done = hud.collectedIds.includes(item.id);
                    const zoneLabel = hud.missionZones[idx] || item.zoneName;
                    return (
                      <div
                        key={item.id}
                        className={`px-1.5 py-0.5 rounded text-[9px] truncate text-center font-medium ${
                          done
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800/90 text-slate-300'
                        }`}
                        title={`${item.name} (${zoneLabel})`}
                      >
                        {done ? '✓' : `○`} {zoneLabel.slice(0, 2)}#{idx + 1}
                      </div>
                    );
                  })}
                </div>

                {hud.collectedIds.length === 3 && (
                  <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between pt-0.5">
                    <span>→ 速去东侧传送门撤离!</span>
                    {hud.extractionProgress > 0 && (
                      <span className="font-mono-tabular">{hud.extractionProgress}%</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Top-Center: Non-Blocking Pursuit Threshold Bar & Alerts (Hugs Top Edge, Leaves Center 3D View Clear!) */}
            <div className="flex-1 max-w-[430px] mx-auto flex flex-col items-center space-y-1.5 pt-0.5">
              {hud.activeChaserName && (
                <div className="w-full px-3 py-2 rounded-xl bg-[#0b0f19]/90 backdrop-blur-md border border-red-500 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold gap-1">
                    <span className="text-red-400 truncate">
                      🚨 {hud.activeChaserName}
                      {hud.throwBoostActiveSec > 0 ? (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-extrabold">
                          ⚡ {hud.collectiveBoostActive ? '全员狂暴加速' : '受击加速'} {hud.throwBoostActiveSec}s
                        </span>
                      ) : (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-500/30 border border-rose-400/60 text-rose-200 text-[9px] font-extrabold">
                          🔥 视野锁定加速 (+38%)
                        </span>
                      )}
                    </span>
                    <span className="font-mono-tabular text-amber-300 shrink-0">
                      {hud.isChaserSeeingPlayer
                        ? '👁️ 在保安视野内(持续加速)'
                        : `脱离视野减速倒计时 ${hud.chaseLoseSightRemainingSec}s`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hud.isChaserSeeingPlayer ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
                      }`}
                      style={{
                        width: `${
                          hud.isChaserSeeingPlayer
                            ? 100
                            : Math.round(hud.chaseLoseSightRatio * 100)
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {hud.campExposurePct >= 45 && !hud.activeChaserName && (
                <div className="px-3 py-1 rounded-lg bg-amber-950/90 backdrop-blur-md border border-amber-400 text-amber-200 text-[11px] font-bold shadow-md text-center">
                  ⚠️ 原地久留热力 {hud.campExposurePct}% · 请移动位置避免被保安合围锁定！
                </div>
              )}
              {hud.escapeBannerMessage && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-950/90 backdrop-blur-md border border-emerald-400 text-emerald-200 text-[11px] font-bold shadow-md text-center">
                  {hud.escapeBannerMessage}
                </div>
              )}
              {hud.throwWarningMessage && (
                <div className="px-3.5 py-1.5 rounded-xl bg-rose-950/95 backdrop-blur-md border border-rose-500 text-rose-200 text-[11px] font-bold shadow-xl text-center animate-pulse">
                  {hud.throwWarningMessage}
                </div>
              )}
              {hud.isHidingInBooth && (
                <div className="px-3.5 py-1.5 rounded-xl bg-cyan-950/95 backdrop-blur-md border-2 border-cyan-400 text-cyan-200 text-[11px] font-bold shadow-xl flex items-center justify-center gap-2 animate-pulse">
                  <span>📞 电话亭隐蔽中</span>
                  <span className="font-mono-tabular bg-cyan-500/40 px-2 py-0.5 rounded text-white font-extrabold text-xs">
                    {hud.boothHidingRemainingSec.toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-cyan-300 font-normal">
                    (上限10秒 · 仅限躲一次 · 保安已向四周散开)
                  </span>
                </div>
              )}
              {hud.isOfficerDeployedFromCar && hud.deployedOfficerRemainingSec > 0 && (
                <div className="px-3.5 py-1.5 rounded-xl bg-orange-950/95 backdrop-blur-md border-2 border-orange-400 text-orange-200 text-[11px] font-bold shadow-xl flex items-center justify-center gap-2 animate-pulse">
                  <span>🚨 参保车下放机动保安搜查中</span>
                  <span className="font-mono-tabular bg-orange-500/40 px-2 py-0.5 rounded text-white font-extrabold text-xs">
                    {hud.deployedOfficerRemainingSec.toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-orange-300 font-normal">
                    (若发现玩家则延长存活时间，否则归队上车)
                  </span>
                </div>
              )}
              {hud.carRadioMessage && (
                <div className="px-3 py-1.5 rounded-lg bg-red-950/90 backdrop-blur-md border border-red-500 text-red-200 text-[11px] font-bold shadow-md text-center">
                  {hud.carRadioMessage}
                </div>
              )}
              {hud.interactionPrompt && (
                <div className="px-3.5 py-1.5 rounded-lg bg-[#0b0f19]/90 backdrop-blur-md border border-amber-400 text-amber-300 text-xs font-bold shadow-md">
                  {hud.interactionPrompt}
                </div>
              )}
            </div>

            {/* Top-Right: Quick Game Lifecycle Controls (Pause / Restart / Lock) + Blind Street Radar */}
            <div className="pointer-events-auto flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1 bg-[#0b0f19]/82 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-md">
                <button
                  onClick={() => startStreetStroll()}
                  className="px-2 py-1 text-[10px] font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 rounded cursor-pointer whitespace-nowrap"
                  title="快捷键 [R] 立即重开本关"
                >
                  🔄 重开 [R]
                </button>
                <button
                  onClick={pauseGameplay}
                  className="px-2.5 py-1 text-[10px] font-bold text-amber-300 bg-slate-800/90 hover:bg-slate-700 border border-amber-400/40 rounded cursor-pointer whitespace-nowrap"
                  title="快捷键 [Esc] 暂停游戏"
                >
                  ⏸ 暂停 [Esc]
                </button>
              </div>

              <Minimap
                snapshotRef={minimapSnapRef}
                expanded={mapExpanded}
                onToggleExpand={() => setMapExpanded((prev) => !prev)}
              />
            </div>
          </div>

          {/* ==================================================================== */}
          {/* BOTTOM-RIGHT 1.8s HIT REACTION PICTURE-IN-PICTURE CAM (Compact & Non-Blocking) */}
          {/* ==================================================================== */}
          {hud.hitReactionPopup && (
            <div className="fixed bottom-14 right-3 z-30 w-[276px] rounded-xl bg-[#0f172a]/92 backdrop-blur-md border-2 border-amber-400 shadow-xl overflow-hidden pointer-events-none">
              <div className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 flex items-center justify-between text-[11px] font-extrabold">
                <span className="truncate">
                  🎯 命中 · {hud.hitReactionPopup.targetName}
                </span>
                <span className="font-mono-tabular bg-slate-950/20 px-1.5 py-0.5 rounded text-[10px]">
                  {hud.hitReactionPopup.remainingSec.toFixed(1)}s
                </span>
              </div>

              <div className="p-2.5 flex items-center gap-2.5">
                <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                  {hud.hitReactionPopup.targetType === 'officer' ? (
                    <svg viewBox="0 0 120 120" className="w-full h-full">
                      <rect width="120" height="120" fill="#1e1b4b" />
                      <polygon
                        points="60,8 72,30 98,18 84,42 112,52 86,66 96,92 68,80 56,108 44,80 18,90 32,64 8,48 36,40 24,16 50,28"
                        fill="#f59e0b"
                        opacity="0.28"
                      />
                      <path d="M24,115 C24,88 96,88 96,115 Z" fill="#1e3a8a" stroke="#f8fafc" strokeWidth="2" />
                      <rect x="54" y="92" width="12" height="22" fill="#ef4444" />
                      <g transform="rotate(-10 60 62)">
                        <circle cx="60" cy="64" r="24" fill="#fcd34d" stroke="#1e293b" strokeWidth="2.5" />
                        <ellipse cx="72" cy="40" rx="9" ry="7" fill="#ef4444" stroke="#fecaca" strokeWidth="1.5" />
                        <path d="M32,46 Q60,26 84,48 L40,52 Z" fill="#1e3a8a" stroke="#facc15" strokeWidth="2" />
                        <path d="M44,58 L54,63 L44,68" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
                        <path d="M76,58 L66,63 L76,68" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
                        <rect x="49" y="73" width="22" height="11" rx="4" fill="#991b1b" stroke="#0f172a" strokeWidth="2" />
                      </g>
                      <text x="86" y="50" fontSize="18" fill="#ef4444" fontWeight="bold">💢</text>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 120 120" className="w-full h-full">
                      <rect width="120" height="120" fill="#172554" />
                      <circle cx="58" cy="22" r="13" fill="#cbd5e1" opacity="0.65" />
                      <g transform="rotate(4 60 72)">
                        <path
                          d="M14,88 L18,54 L42,54 L58,68 L74,52 L102,54 L106,88 Z"
                          fill="#f8fafc"
                          stroke="#1e293b"
                          strokeWidth="2.5"
                        />
                        <rect x="14" y="72" width="92" height="16" fill="#2563eb" />
                        <path d="M44,54 L58,68 L72,53" stroke="#ef4444" strokeWidth="3" fill="none" />
                        <circle cx="34" cy="90" r="10" fill="#0f172a" stroke="#cbd5e1" strokeWidth="3" />
                        <circle cx="86" cy="90" r="10" fill="#0f172a" stroke="#cbd5e1" strokeWidth="3" />
                      </g>
                      <text x="48" y="42" fontSize="20">💥</text>
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-[11px] font-extrabold text-white leading-tight">
                    {hud.hitReactionPopup.targetType === 'officer'
                      ? `💢 保安被激怒！开启 ${hud.hitReactionPopup.boostDurationSec.toFixed(1)} 秒全力追捕！`
                      : `💥 参保车受创警报！全员保安开启 ${hud.hitReactionPopup.boostDurationSec.toFixed(1)} 秒集体围捕！`}
                  </div>
                  <div className="text-[10px] text-amber-300 font-semibold">
                    {hud.hitReactionPopup.targetType === 'officer'
                      ? '⚡ 追捕移速大幅提升，快绕过街角或钻入电话亭摆脱！'
                      : '⚡ 全员保安加速出动，注意隐蔽行踪！'}
                  </div>
                </div>
              </div>

              <div className="w-full h-1 bg-slate-800">
                <div
                  className="h-full bg-amber-400 transition-all duration-75"
                  style={{
                    width: `${Math.round(
                      (hud.hitReactionPopup.remainingSec / hud.hitReactionPopup.totalSec) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* BOTTOM EDGE: Ultra-Slim Single-Row Action & Stamina Bar (Zero Viewport Clutter!) */}
          <div className="relative z-10 w-full flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0b0f19]/82 backdrop-blur-md border border-slate-800/90 shadow-lg">
              {/* Stamina + Snack Boost Mini Bar */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap">
                  {hud.snackBoostRemaining > 0
                    ? `🍌 狂飙 ${hud.snackBoostRemaining}s`
                    : hud.hidingSpotLabel
                    ? '🚪 亭内隐蔽'
                    : hud.isCrouching
                    ? '🌿 蹲伏隐蔽'
                    : hud.isSprinting
                    ? '⚡ 冲刺'
                    : '🚶 体力'}
                </span>
                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hud.snackBoostRemaining > 0 ? 'bg-yellow-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${hud.stamina}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono-tabular text-slate-300 w-7">
                  {hud.stamina}%
                </span>
              </div>

              <div className="h-4 w-px bg-slate-700/80" />

              {/* Throwable Action Pill with Distance & Range Check */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono-tabular text-slate-200">
                  🪨{hud.stoneCount} 🔧{hud.wrenchCount}
                </span>
                <button
                  onClick={triggerThrowNow}
                  disabled={hud.stoneCount + hud.wrenchCount <= 0}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    hud.stoneCount + hud.wrenchCount <= 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : hud.targetInRange
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-md font-extrabold active:scale-95'
                      : 'bg-amber-500/85 hover:bg-amber-400 text-slate-950 shadow-sm active:scale-95'
                  }`}
                  title={
                    hud.targetInRange
                      ? `锁定【${hud.nearestTargetName}】相距 ${hud.targetDistance}m (射程内，按 G / 左键 投掷)`
                      : `距离【${hud.nearestTargetName || '目标'}】${hud.targetDistance}m (超出有效射程 ${hud.targetMaxRange}m)`
                  }
                >
                  {hud.stoneCount + hud.wrenchCount <= 0
                    ? '🎯 无投掷物'
                    : hud.targetInRange
                    ? `🎯 锁定: ${hud.nearestTargetName} (${hud.targetDistance}m) [G]`
                    : `⚠️ 超距 (${hud.targetDistance}m > ${hud.targetMaxRange}m) [G]`}
                </button>
              </div>

              <div className="h-4 w-px bg-slate-700/80 hidden sm:block" />

              {/* Quick Utility Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setCameraDistancePreset((prev) =>
                      prev === 'near'
                        ? 'standard'
                        : prev === 'standard'
                        ? 'tactical'
                        : 'near'
                    )
                  }
                  className="px-2 py-1 text-[11px] font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 rounded-md cursor-pointer whitespace-nowrap"
                >
                  视角: {cameraDistancePreset === 'near' ? '近距' : cameraDistancePreset === 'standard' ? '标准' : '高空'}
                </button>
                <button
                  onClick={toggleMute}
                  className="px-2 py-1 text-[11px] font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 rounded-md cursor-pointer whitespace-nowrap"
                >
                  {isMuted ? '🔇静音' : '🔊音效'}
                </button>
                <button
                  onClick={pauseGameplay}
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-300 bg-slate-800/90 hover:bg-slate-700 border border-amber-400/40 rounded-md cursor-pointer whitespace-nowrap"
                >
                  ⏸ 暂停 [Esc]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. COMPLETE PAUSE MENU OVERLAY (Esc Pause / Resume / Restart / Stage Select / Character Select / Main Menu) */}
      {phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0f19]/88 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-amber-400">
                  GAME PAUSED · 游戏已暂停
                </div>
                <h2 className="text-xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                  <span>{activeStageSpec.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 font-normal">
                    当前角色: {activeCharSpec.name}
                  </span>
                </h2>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono-tabular rounded-md bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-block">
                快捷键: Esc 继续 / R 重开
              </span>
            </div>

            {/* Primary Game Lifecycle Action Buttons (Continue / Restart / Main Menu) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={resumeGameplay}
                className="py-3 px-4 rounded-xl text-sm font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-lg transition-transform active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>▶️ 继续游戏 (Esc)</span>
              </button>
              <button
                onClick={() => startStreetStroll(undefined, stageId, characterId)}
                className="py-3 px-4 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md transition-transform active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🔄 重新开始本关 (R)</span>
              </button>
              <button
                onClick={returnToTitleScreen}
                className="py-3 px-4 rounded-xl text-sm font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🏠 返回主菜单</span>
              </button>
            </div>

            {/* Current Run Live Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
              <div>
                <div className="text-[10px] text-slate-400">当前躲藏存活时长</div>
                <div className="text-sm font-extrabold font-mono-tabular text-sky-300 mt-0.5">
                  {hud.totalHidingSeconds.toFixed(1)} 秒
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">累计核定参保金</div>
                <div className="text-sm font-extrabold font-mono-tabular text-amber-400 mt-0.5">
                  {formatCurrency(hud.contributionAmount)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">免检材料进度</div>
                <div className="text-sm font-extrabold font-mono-tabular text-emerald-400 mt-0.5">
                  {hud.collectedIds.length} / 3 份
                </div>
              </div>
            </div>

            {/* Operation Controls Guide & Pause Help */}
            <div className="p-4 rounded-xl bg-[#0b0f19]/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">
                  🎮 操作按键速查指南
                </span>
                <span className="text-[11px] text-slate-400">
                  当前出战: <strong className="text-white">{activeCharSpec.name}</strong> · 当前场景: <strong className="text-sky-300">{activeStageSpec.name}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tabular font-bold text-[10px]">
                    W / A / S / D
                  </span>
                  <span className="text-slate-300">街区前后左右行走与移动</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tabular font-bold text-[10px]">
                    Shift
                  </span>
                  <span className="text-slate-300">疾跑冲刺（消耗体力槽）</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tabular font-bold text-[10px]">
                    C
                  </span>
                  <span className="text-slate-300">蹲伏隐蔽（在矮墙/灌木中有效）</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tabular font-bold text-[10px]">
                    E
                  </span>
                  <span className="text-slate-300">拾取材料 / 钻进电话亭（限躲1次且最多10s）</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tabular font-bold text-[10px]">
                    G / 左键
                  </span>
                  <span className="text-slate-300">投掷石头/扳手锁定保安或参保车</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tabular font-bold text-[10px]">
                    鼠标移动 / 拖拽
                  </span>
                  <span className="text-slate-300">360° 全景观察街道与敌情</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
                <span>💡</span>
                <span>
                  提示：如需自由切换关卡与出战角色，请点击上方<strong>「🏠 返回主菜单」</strong>进行自由选择配置。
                </span>
              </div>
            </div>

            {/* Mouse Sensitivity & Camera / Audio Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#0b0f19]/90 border border-slate-800">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span>🖱️ 鼠标视角灵敏度</span>
                  <span className="font-mono-tabular text-amber-300 font-bold">
                    {mouseSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="2.2"
                  step="0.1"
                  value={mouseSensitivity}
                  onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>🔊 音效音量与镜头距离</span>
                  <span className="font-mono-tabular text-amber-300 font-bold">
                    {isMuted ? '静音' : `${Math.round(audioVolume * 100)}%`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : audioVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-24 accent-amber-400 cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      setCameraDistancePreset((prev) =>
                        prev === 'near' ? 'standard' : prev === 'standard' ? 'tactical' : 'near'
                      )
                    }
                    className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    镜头: {cameraDistancePreset === 'near' ? '近距' : cameraDistancePreset === 'tactical' ? '高空' : '标准'}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                </div>
              </div>
            </div>

            {/* Commercial-Safe Background Music (BGM) Selector */}
            <div className="p-3 rounded-xl bg-[#0b0f19]/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-300">
                <span className="font-bold text-amber-300">🎶 商业级免版权背景音乐 (BGM)：</span>
                <span className="text-[11px] text-slate-400 ml-1">
                  {BGM_TRACKS.find((t) => t.id === bgmTrack)?.license}
                </span>
              </div>
              <select
                value={bgmTrack}
                onChange={(e) => handleSelectBgmTrack(e.target.value as BgmTrackId)}
                className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer outline-none w-full sm:w-auto"
              >
                {BGM_TRACKS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#0b0f19] text-slate-200">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 5. VICTORY OVERLAY: OFFICIAL CLEARANCE HONOR CERTIFICATE ("街区潜行免检通关荣誉证书") */}
      {phase === 'victory' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0f19]/92 p-4 overflow-y-auto">
          <div className="bg-[#ecfdf5] text-slate-900 border-4 border-emerald-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="border-2 border-emerald-500/80 rounded-xl p-5 space-y-4 relative">
              {/* Official Honor Seal Stamp in Bottom-Right of Certificate Card */}
              <div className="hidden sm:flex pointer-events-none absolute right-5 bottom-16 w-24 h-24 rounded-full border-4 border-emerald-600/80 flex-col items-center justify-center text-emerald-700/85 font-extrabold -rotate-12 select-none">
                <span className="text-[9px] tracking-tighter">街区潜行委员会</span>
                <span className="text-xs border-y border-emerald-600/70 px-1 my-0.5">
                  免检通关章
                </span>
                <span className="text-sm">★</span>
              </div>

              <div className="text-center border-b-2 border-emerald-200 pb-3">
                <div className="text-[11px] font-mono-tabular tracking-widest text-emerald-800 font-semibold">
                  街区潜行委员会 · 免参保通关荣誉认证 ({hud.certificateNo})
                </div>
                <h2 className="text-2xl font-extrabold text-emerald-950 tracking-wide mt-1">
                  《 街区潜行免检通关荣誉证书 》
                </h2>
                <div className="text-xs text-emerald-700 font-semibold mt-1">
                  恭喜成功集齐 3 份免检材料并穿越【东侧时空撤离传送门】全身而退！
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-28 h-36 rounded-lg overflow-hidden border-2 border-emerald-700 bg-slate-900 shadow-md">
                    {activePortraitUrl ? (
                      <img
                        src={activePortraitUrl}
                        alt={activeCharSpec.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-300">
                        玩家头像
                      </div>
                    )}
                  </div>
                  <span className="mt-1.5 text-[11px] font-bold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded">
                    荣誉通关者证件照
                  </span>
                </div>

                <div className="flex-1 space-y-2 text-xs w-full">
                  <div className="flex items-center justify-between py-1 border-b border-emerald-200/80">
                    <span className="text-slate-600 font-medium">荣誉通关潜行者：</span>
                    <span className="font-bold text-slate-900">
                      {activeCharSpec.name}（{activeCharSpec.title}）
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-emerald-200/80">
                    <span className="text-slate-600 font-medium">通关街区场景：</span>
                    <span className="font-bold text-slate-900">{activeStageSpec.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-emerald-200/80">
                    <span className="text-slate-600 font-medium">周旋时长 / 剩余时间：</span>
                    <span className="font-mono-tabular font-bold text-emerald-900">
                      {hud.totalHidingSeconds} 秒（余 {formatTime(hud.timeRemaining)}）
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-emerald-200/80">
                    <span className="text-slate-600 font-medium">全图警报暴露次数：</span>
                    <span className="font-mono-tabular font-bold text-slate-900">
                      {hud.timesSpotted} 次
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-100/90 border border-emerald-400 mt-2">
                    <div className="text-[11px] font-semibold text-emerald-900">
                      核定成功规避参保金额（全额免缴认证）：
                    </div>
                    <div className="text-2xl font-extrabold font-mono-tabular text-emerald-700 mt-0.5">
                      {formatCurrency(hud.contributionAmount)}.00 元
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-emerald-200">
                <button
                  onClick={downloadVictoryCertificateImage}
                  className="px-4 py-2 text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-400 border border-emerald-600 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  📥 保存《通关荣誉证书》图片 (含头像)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPhase('title')}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    返回主界面
                  </button>
                  <button
                    onClick={() => startStreetStroll(undefined, nextStageId)}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md cursor-pointer whitespace-nowrap shrink-0"
                  >
                    挑战下一关：{STAGE_CONFIGS[nextStageId].name} →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. GAME OVER OVERLAY: OFFICIAL ENROLLMENT CERTIFICATE ("参保证明") */}
      {phase === 'gameover' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0f19]/92 p-4 overflow-y-auto">
          <div className="bg-[#fffbeb] text-slate-900 border-4 border-amber-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="border-2 border-amber-500/80 rounded-xl p-5 space-y-4 relative">
              <div className="text-center border-b-2 border-amber-200 pb-3">
                <div className="text-[11px] font-mono-tabular tracking-widest text-amber-800 font-semibold">
                  阳光商业街流动督查组 · 现场办结凭证 ({ hud.certificateNo })
                </div>
                <h2 className="text-2xl font-extrabold text-amber-950 tracking-wide mt-1">
                  《 街区流动参保登记证明书 》
                </h2>
                <div className="text-xs text-red-700 font-semibold mt-1">
                  {hud.failReason}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-28 h-36 rounded-lg overflow-hidden border-2 border-amber-700 bg-slate-900 shadow-md">
                    {activePortraitUrl ? (
                      <img
                        src={activePortraitUrl}
                        alt={activeCharSpec.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-300">
                        玩家头像
                      </div>
                    )}
                  </div>
                  <span className="mt-1.5 text-[11px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                    登记人证件照
                  </span>
                </div>

                <div className="flex-1 space-y-2 text-xs w-full">
                  <div className="flex items-center justify-between py-1 border-b border-amber-200/80">
                    <span className="text-slate-600 font-medium">参保登记人角色：</span>
                    <span className="font-bold text-slate-900">
                      {activeCharSpec.name}（{activeCharSpec.title}）
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-amber-200/80">
                    <span className="text-slate-600 font-medium">所属关卡场景：</span>
                    <span className="font-bold text-slate-900">{activeStageSpec.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-amber-200/80">
                    <span className="text-slate-600 font-medium">现场拦截保安：</span>
                    <span className="font-bold text-blue-900">{hud.capturedByOfficer}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-amber-200/80">
                    <span className="text-slate-600 font-medium">躲藏时长（未被抓获时间）：</span>
                    <span className="font-mono-tabular font-bold text-slate-900">
                      {hud.totalHidingSeconds} 秒
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-100/90 border border-amber-400 mt-2">
                    <div className="text-[11px] font-semibold text-amber-900">
                      核定应缴参保金额（随躲藏时长递增）：
                    </div>
                    <div className="text-2xl font-extrabold font-mono-tabular text-red-600 mt-0.5">
                      {formatCurrency(hud.contributionAmount)}.00 元
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-amber-200">
                <button
                  onClick={downloadCertificateImage}
                  className="px-4 py-2 text-xs font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 border border-amber-600 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  📥 保存《参保证明》图片 (含头像)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPhase('title')}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    更换关卡/角色
                  </button>
                  <button
                    onClick={() => startStreetStroll()}
                    className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md cursor-pointer whitespace-nowrap shrink-0"
                  >
                    不服重来！再次挑战街道
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
