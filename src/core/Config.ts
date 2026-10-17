export type PlaystyleModeId = 'balanced' | 'stealth' | 'chase' | 'casual';

export type StageId = 'stage_1' | 'stage_2' | 'stage_3';

export type ThrowableKind = 'stone' | 'wrench';

export type PlayerCharacterId =
  | 'luna_cyber'
  | 'street_kid'
  | 'flash_rider'
  | 'suited_worker';

export interface StageConfig {
  id: StageId;
  stageNumber: number;
  name: string;
  subtitle: string;
  themeBadge: string;
  sceneTheme: 'urban_rowhouse' | 'coastal_seaside' | 'countryside_village';
  description: string;
  skyColorHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  keyLightHex: number;
  keyLightIntensity: number;
  rimLightHex: number;
  roadColorHex: number;
  groundColorHex: number;
  curbColorHex: number;
  carVisionRange: number; // 参保车超远视野（明显远于保安！）
  officerVisionMultiplier: number;
  officerSpeedMultiplier: number;
  carSpeedMultiplier: number;
  loseSightThresholdSec: number; // 离开保安视野后仍继续追逐的阈值时间（超过此阈值才放弃追捕）
  allThreeOfficersOnFoot: boolean;
  maxOnFootOfficers: number; // 场上允许同时活动的最大保安总人数上限（杜绝保安不限数人海问题）
}

export const STAGE_CONFIGS: Record<StageId, StageConfig> = {
  stage_1: {
    id: 'stage_1',
    stageNumber: 1,
    name: '第一关 · 阳光欧式商业街',
    subtitle: '繁华商业大道 · 联排商铺与街角电话亭',
    themeBadge: 'STAGE 01 · 都市商业街',
    sceneTheme: 'urban_rowhouse',
    description:
      '阳光倾洒的欧式联排商铺街区，条纹遮阳篷、街角修剪盆栽、复古电话亭与路边停靠的轿跑交错分布，可借街角掩体灵活潜行。',
    skyColorHex: 0x3b235a,
    fogDensity: 0.0032,
    hemiSkyHex: 0xfff4de,
    hemiGroundHex: 0x6b21a8,
    keyLightHex: 0xffe8c2,
    keyLightIntensity: 1.75,
    rimLightHex: 0xc084fc,
    roadColorHex: 0x674b78,
    groundColorHex: 0x5c426e,
    curbColorHex: 0xb59bb5,
    carVisionRange: 30.0,
    officerVisionMultiplier: 1.0,
    officerSpeedMultiplier: 1.0,
    carSpeedMultiplier: 1.0,
    loseSightThresholdSec: 3.6,
    allThreeOfficersOnFoot: false,
    maxOnFootOfficers: 3,
  },
  stage_2: {
    id: 'stage_2',
    stageNumber: 2,
    name: '第二关 · 蔚蓝海岸滨海镇',
    subtitle: '阳光海滨小镇 · 灯塔沙滩与椰林大道',
    themeBadge: 'STAGE 02 · 海边度假镇',
    sceneTheme: 'coastal_seaside',
    description:
      '海风拂面的地中海白墙蓝顶海滨小镇，红白海岸灯塔、高耸椰林、沙滩换衣木屋与蔚蓝海岸线环绕，需善用椰林与木屋隐蔽行踪。',
    skyColorHex: 0x0ea5e9,
    fogDensity: 0.0026,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0xd97706,
    keyLightHex: 0xfffbeb,
    keyLightIntensity: 1.9,
    rimLightHex: 0x38bdf8,
    roadColorHex: 0x94a3b8,
    groundColorHex: 0xfde68a,
    curbColorHex: 0xf8fafc,
    carVisionRange: 33.0,
    officerVisionMultiplier: 1.08,
    officerSpeedMultiplier: 1.08,
    carSpeedMultiplier: 1.14,
    loseSightThresholdSec: 4.2,
    allThreeOfficersOnFoot: false,
    maxOnFootOfficers: 3,
  },
  stage_3: {
    id: 'stage_3',
    stageNumber: 3,
    name: '第三关 · 田园牧歌古镇街',
    subtitle: '秋日乡村古镇 · 大风车农舍与干草垛',
    themeBadge: 'STAGE 03 · 乡村田园街',
    sceneTheme: 'countryside_village',
    description:
      '宁静悠然的秋日乡村古镇，旋转大风车、红砖木梁农舍、金黄干草垛与谷仓木哨棚错落有致，可藏身干草垛或木棚躲避严密搜查。',
    skyColorHex: 0x78350f,
    fogDensity: 0.0028,
    hemiSkyHex: 0xfef3c7,
    hemiGroundHex: 0x3f6212,
    keyLightHex: 0xfbbf24,
    keyLightIntensity: 1.85,
    rimLightHex: 0xf97316,
    roadColorHex: 0x785c44,
    groundColorHex: 0x4d7c0f,
    curbColorHex: 0xa8a29e,
    carVisionRange: 36.0,
    officerVisionMultiplier: 1.15,
    officerSpeedMultiplier: 1.14,
    carSpeedMultiplier: 1.2,
    loseSightThresholdSec: 4.8,
    allThreeOfficersOnFoot: false,
    maxOnFootOfficers: 4,
  },
};

export interface StreetThrowableSpec {
  id: string;
  kind: ThrowableKind;
  name: string;
  position: [number, number, number];
}

export const STREET_THROWABLES: StreetThrowableSpec[] = [
  { id: 'th_stone_1', kind: 'stone', name: '街角鹅卵石', position: [-31, 0, 4.2] },
  { id: 'th_wrench_1', kind: 'wrench', name: '修车合金扳手', position: [-19, 0, -3.8] },
  { id: 'th_stone_2', kind: 'stone', name: '街角鹅卵石', position: [-14, 0, 9.2] },
  { id: 'th_wrench_2', kind: 'wrench', name: '修车合金扳手', position: [-2, 0, -9.2] },
  { id: 'th_stone_3', kind: 'stone', name: '街角鹅卵石', position: [9, 0, 4.2] },
  { id: 'th_wrench_3', kind: 'wrench', name: '修车合金扳手', position: [19, 0, -4.0] },
  { id: 'th_stone_4', kind: 'stone', name: '街角鹅卵石', position: [24, 0, 12.5] },
  { id: 'th_wrench_4', kind: 'wrench', name: '修车合金扳手', position: [-24, 0, -24.0] },
  { id: 'th_stone_5', kind: 'stone', name: '街角鹅卵石', position: [14, 0, -24.0] },
  { id: 'th_wrench_5', kind: 'wrench', name: '修车合金扳手', position: [36, 0, 8.5] },
];

export interface PlayerCharacterSpec {
  id: PlayerCharacterId;
  name: string;
  title: string;
  badge: string;
  glbFileName: string;
  outfitDesc: string;
  description: string;
  perkLabel: string;
  walkSpeedMul: number;
  runSpeedMul: number;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  staminaDrainMul: number;
  stealthDetectMul: number;
  stealthFactor: number;
  snackDurationMul: number;
  snackBuffBonusSec: number;
  accentHex: string;
}

export const PLAYER_CHARACTERS: Record<PlayerCharacterId, PlayerCharacterSpec> = {
  luna_cyber: {
    id: 'luna_cyber',
    name: '紫晶幻影 · 露娜',
    title: '暗巷疾影特工',
    badge: '灵动潜行型 · 推荐',
    glbFileName: 'char_luna_cyber.glb',
    outfitDesc: '紫晶短发 + 星芒额饰 + 青碧轻甲 + 流光围巾',
    description:
      '身着青碧轻捷夹克与流光战术围巾，步伐轻盈敏捷，擅长在街角阴影与掩体之间快速穿梭。',
    perkLabel: '特长：冲刺速度 +10% · 暴露速度减缓 15% · 零食加速 +2.5秒',
    walkSpeedMul: 1.08,
    runSpeedMul: 1.1,
    runSpeedMultiplier: 1.1,
    crouchSpeedMultiplier: 1.12,
    staminaDrainMul: 0.85,
    stealthDetectMul: 0.85,
    stealthFactor: 0.85,
    snackDurationMul: 1.25,
    snackBuffBonusSec: 2.5,
    accentHex: '#2dd4bf',
  },
  street_kid: {
    id: 'street_kid',
    name: '街头潮玩 · 阿杰',
    title: '滑板街区达人',
    badge: '均衡全能型',
    glbFileName: 'char_street_kid.glb',
    outfitDesc: '街头潮帽 + 降噪耳麦 + 撞色背心 + 双肩潮包',
    description:
      '头戴立体耳麦、身背街头双肩包的阳光少年，对商业街的每一条近道与藏身点都了如指掌。',
    perkLabel: '特长：吃下面包/香蕉后加速延长 +3秒 · 蹲伏移速 +15%',
    walkSpeedMul: 1.02,
    runSpeedMul: 1.04,
    runSpeedMultiplier: 1.04,
    crouchSpeedMultiplier: 1.15,
    staminaDrainMul: 0.95,
    stealthDetectMul: 0.95,
    stealthFactor: 0.95,
    snackDurationMul: 1.3,
    snackBuffBonusSec: 3.0,
    accentHex: '#f97316',
  },
  flash_rider: {
    id: 'flash_rider',
    name: '闪送疾风 · 小风',
    title: '王牌闪送骑手',
    badge: '极速狂飙型',
    glbFileName: 'char_flash_rider.glb',
    outfitDesc: '竹蜻蜓头盔 + 闪送保温箱 + 疾风跑鞋',
    description:
      '头戴标志性竹蜻蜓黄盔、背负闪送保温箱，脚力惊人，擅长用极速冲刺甩开保安视线。',
    perkLabel: '特长：移动与冲刺速度 +16% · 体力消耗降低 25%',
    walkSpeedMul: 1.1,
    runSpeedMul: 1.16,
    runSpeedMultiplier: 1.16,
    crouchSpeedMultiplier: 1.05,
    staminaDrainMul: 0.75,
    stealthDetectMul: 1.0,
    stealthFactor: 1.0,
    snackDurationMul: 1.15,
    snackBuffBonusSec: 1.5,
    accentHex: '#eab308',
  },
  suited_worker: {
    id: 'suited_worker',
    name: '摸鱼精英 · 老陈',
    title: '写字楼资深白领',
    badge: '低调伪装型',
    glbFileName: 'char_suited_worker.glb',
    outfitDesc: '修身西装 + 金丝眼镜 + 红色领带 + 冰美式咖啡',
    description:
      '西装革履、手捧冰美式咖啡的资深白领，神态自若地混迹于繁华街道，巡逻保安很难第一眼起疑。',
    perkLabel: '特长：保安视野暴露速度降低 25% · 极不易触发警报',
    walkSpeedMul: 1.02,
    runSpeedMul: 1.04,
    runSpeedMultiplier: 1.04,
    crouchSpeedMultiplier: 1.08,
    staminaDrainMul: 0.9,
    stealthDetectMul: 0.75,
    stealthFactor: 0.75,
    snackDurationMul: 1.15,
    snackBuffBonusSec: 1.5,
    accentHex: '#38bdf8',
  },
};

export interface StreetSnackSpec {
  id: string;
  kind: 'bread' | 'banana';
  name: string;
  position: [number, number, number];
  staminaRestore: number;
  boostSeconds: number;
  boostDurationSec: number;
  speedBonusMul: number;
}

export const STREET_SNACKS: StreetSnackSpec[] = [
  {
    id: 'snack_bread_1',
    kind: 'bread',
    name: '香烤法式牛角面包',
    position: [-26, 0, -9.5],
    staminaRestore: 80,
    boostSeconds: 7.0,
    boostDurationSec: 7.0,
    speedBonusMul: 1.24,
  },
  {
    id: 'snack_banana_1',
    kind: 'banana',
    name: '黄金能量香蕉串',
    position: [-8, 0, -9.5],
    staminaRestore: 90,
    boostSeconds: 9.0,
    boostDurationSec: 9.0,
    speedBonusMul: 1.28,
  },
  {
    id: 'snack_bread_2',
    kind: 'bread',
    name: '香烤法式牛角面包',
    position: [12, 0, -9.5],
    staminaRestore: 80,
    boostSeconds: 7.0,
    boostDurationSec: 7.0,
    speedBonusMul: 1.24,
  },
  {
    id: 'snack_banana_2',
    kind: 'banana',
    name: '黄金能量香蕉串',
    position: [28, 0, -9.5],
    staminaRestore: 90,
    boostSeconds: 9.0,
    boostDurationSec: 9.0,
    speedBonusMul: 1.28,
  },
  {
    id: 'snack_bread_3',
    kind: 'bread',
    name: '香烤法式牛角面包',
    position: [-22, 0, 9.5],
    staminaRestore: 80,
    boostSeconds: 7.0,
    boostDurationSec: 7.0,
    speedBonusMul: 1.24,
  },
  {
    id: 'snack_banana_3',
    kind: 'banana',
    name: '黄金能量香蕉串',
    position: [2, 0, 9.5],
    staminaRestore: 90,
    boostSeconds: 9.0,
    boostDurationSec: 9.0,
    speedBonusMul: 1.28,
  },
  {
    id: 'snack_bread_4',
    kind: 'bread',
    name: '香烤法式牛角面包',
    position: [24, 0, 9.5],
    staminaRestore: 80,
    boostSeconds: 7.0,
    boostDurationSec: 7.0,
    speedBonusMul: 1.24,
  },
  {
    id: 'snack_banana_4',
    kind: 'banana',
    name: '黄金能量香蕉串',
    position: [40, 0, 4.0],
    staminaRestore: 90,
    boostSeconds: 9.0,
    boostDurationSec: 9.0,
    speedBonusMul: 1.28,
  },
];

export interface PlaystyleConfig {
  id: PlaystyleModeId;
  name: string;
  subtitle: string;
  description: string;
  timeLimit: number;
  timeLimitSec: number;
  walkSpeed: number;
  runSpeed: number;
  crouchSpeed: number;
  playerWalkSpeed: number;
  playerRunSpeed: number;
  playerCrouchSpeed: number;
  staminaDrain: number;
  staminaDrainRate: number;
  staminaRegenIdle: number;
  staminaRegenCrouch: number;
  staminaRegenRate: number;
  officerPatrolSpeed: number;
  officerInvestigateSpeed: number;
  officerChaseSpeed: number;
  normalVisionRange: number;
  highAlertVisionRange: number;
  visionAngleDeg: number;
  visionRangeNormal: number;
  visionAngleNormalDeg: number;
  visionRangeAlert: number;
  visionAngleAlertDeg: number;
  confirmTimeSec: number;
  detectionFillSpeed: number;
  alertDecayPerSec: number;
  alertDecaySpeed: number;
}

export const PLAYSTYLE_MODES: Record<PlaystyleModeId, PlaystyleConfig> = {
  balanced: {
    id: 'balanced',
    name: '标准潜行模式',
    subtitle: '推荐体验 · 视线博弈与阈值脱离',
    description: '被发现或投掷命中后触发保安紧追，离开视野并保持至脱离阈值满即可甩开追捕。',
    timeLimit: 300,
    timeLimitSec: 300,
    walkSpeed: 6.2,
    runSpeed: 9.5,
    crouchSpeed: 3.8,
    playerWalkSpeed: 6.2,
    playerRunSpeed: 9.5,
    playerCrouchSpeed: 3.8,
    staminaDrain: 13,
    staminaDrainRate: 13,
    staminaRegenIdle: 26,
    staminaRegenCrouch: 32,
    staminaRegenRate: 26,
    officerPatrolSpeed: 2.8,
    officerInvestigateSpeed: 3.8,
    officerChaseSpeed: 5.4,
    normalVisionRange: 16.0,
    highAlertVisionRange: 19.0,
    visionAngleDeg: 84,
    visionRangeNormal: 16.0,
    visionAngleNormalDeg: 84,
    visionRangeAlert: 19.0,
    visionAngleAlertDeg: 94,
    confirmTimeSec: 1.15,
    detectionFillSpeed: 1.0,
    alertDecayPerSec: 16,
    alertDecaySpeed: 16,
  },
  stealth: {
    id: 'stealth',
    name: '硬核特工模式',
    subtitle: '高敏锐度巡逻 · 严密搜索',
    description: '执法人员视野更敏锐、追击韧性更强，需要合理借助墙角遮挡与电话亭累积脱离阈值。',
    timeLimit: 240,
    timeLimitSec: 240,
    walkSpeed: 6.0,
    runSpeed: 9.1,
    crouchSpeed: 3.6,
    playerWalkSpeed: 6.0,
    playerRunSpeed: 9.1,
    playerCrouchSpeed: 3.6,
    staminaDrain: 15,
    staminaDrainRate: 15,
    staminaRegenIdle: 22,
    staminaRegenCrouch: 28,
    staminaRegenRate: 22,
    officerPatrolSpeed: 3.2,
    officerInvestigateSpeed: 4.2,
    officerChaseSpeed: 5.9,
    normalVisionRange: 18.0,
    highAlertVisionRange: 21.0,
    visionAngleDeg: 90,
    visionRangeNormal: 18.0,
    visionAngleNormalDeg: 90,
    visionRangeAlert: 21.0,
    visionAngleAlertDeg: 100,
    confirmTimeSec: 0.9,
    detectionFillSpeed: 1.25,
    alertDecayPerSec: 13,
    alertDecaySpeed: 13,
  },
  chase: {
    id: 'chase',
    name: '街头狂飙模式',
    subtitle: '超高速冲刺 · 投掷互动爽局',
    description: '大幅强化玩家奔跑速度与耐力回复，捡石头/扳手砸保安与参保车，体验刺激拉扯！',
    timeLimit: 260,
    timeLimitSec: 260,
    walkSpeed: 6.8,
    runSpeed: 10.6,
    crouchSpeed: 4.2,
    playerWalkSpeed: 6.8,
    playerRunSpeed: 10.6,
    playerCrouchSpeed: 4.2,
    staminaDrain: 10,
    staminaDrainRate: 10,
    staminaRegenIdle: 34,
    staminaRegenCrouch: 40,
    staminaRegenRate: 34,
    officerPatrolSpeed: 3.1,
    officerInvestigateSpeed: 4.1,
    officerChaseSpeed: 5.7,
    normalVisionRange: 16.0,
    highAlertVisionRange: 19.0,
    visionAngleDeg: 84,
    visionRangeNormal: 16.0,
    visionAngleNormalDeg: 84,
    visionRangeAlert: 19.0,
    visionAngleAlertDeg: 94,
    confirmTimeSec: 1.25,
    detectionFillSpeed: 0.95,
    alertDecayPerSec: 18,
    alertDecaySpeed: 18,
  },
  casual: {
    id: 'casual',
    name: '剧情漫游模式',
    subtitle: '低压探索 · 轻松收集',
    description: '宽裕的任务时间与更短的脱离视野阈值，适合畅玩三大关卡场景与投掷恶搞。',
    timeLimit: 420,
    timeLimitSec: 420,
    walkSpeed: 6.6,
    runSpeed: 9.8,
    crouchSpeed: 4.1,
    playerWalkSpeed: 6.6,
    playerRunSpeed: 9.8,
    playerCrouchSpeed: 4.1,
    staminaDrain: 9,
    staminaDrainRate: 9,
    staminaRegenIdle: 35,
    staminaRegenCrouch: 42,
    staminaRegenRate: 35,
    officerPatrolSpeed: 2.4,
    officerInvestigateSpeed: 3.2,
    officerChaseSpeed: 4.7,
    normalVisionRange: 14.5,
    highAlertVisionRange: 17.5,
    visionAngleDeg: 78,
    visionRangeNormal: 14.5,
    visionAngleNormalDeg: 78,
    visionRangeAlert: 17.5,
    visionAngleAlertDeg: 88,
    confirmTimeSec: 1.5,
    detectionFillSpeed: 0.72,
    alertDecayPerSec: 22,
    alertDecaySpeed: 22,
  },
};

export interface MissionItemSpec {
  id: string;
  name: string;
  zoneName: string;
  position: [number, number, number];
}

export const MISSION_ITEMS: MissionItemSpec[] = [
  {
    id: 'chip_alpha',
    name: '加密终端密钥 A',
    zoneName: '北区·彩色联排商业街',
    position: [-26, 0, -25],
  },
  {
    id: 'chip_beta',
    name: '巡逻频段解码器 B',
    zoneName: '南区·复古拱廊书店街',
    position: [-14, 0, 25],
  },
  {
    id: 'chip_gamma',
    name: '封锁通行黑匣子 C',
    zoneName: '东区·暖阳街角咖啡座',
    position: [26, 0, 25],
  },
];

export const PLAYER_START = {
  position: [-36, 0, 4] as [number, number, number],
  zoneName: '彩色联排商业大道',
};

export const EXTRACTION_POINT = {
  position: [52, 0, 18] as [number, number, number],
  radius: 4.2,
  name: '东侧地铁疏散口',
};

export const WORLD_CONFIG = {
  mapHalfWidth: 68,
  mapHalfDepth: 48,
  playerSpawn: [-36, 0, 4] as [number, number, number],
  playerRadius: 0.55,
  officerCaptureDistance: 1.5,
  captureDistance: 1.5,
  extractionHoldTime: 3.5,
  interactionDistance: 3.2,
  roadWaypoints: [
    [-44, 0, 0],
    [-44, 0, -34],
    [38, 0, -34],
    [38, 0, 0],
    [-12, 0, 0],
  ] as [number, number, number][],
  stopPointIndices: [0, 2, 3, 4],
};

export interface ZoneBound {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bounds: {
    minX: number;
    minX2?: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export const MAP_ZONES: ZoneBound[] = [
  {
    name: '彩色联排商业大道',
    minX: -54,
    maxX: 54,
    minZ: -15,
    maxZ: 15,
    bounds: { minX: -54, maxX: 54, minZ: -15, maxZ: 15 },
  },
  {
    name: '北区·欧式联排公寓街',
    minX: -54,
    maxX: 0,
    minZ: -44,
    maxZ: -15,
    bounds: { minX: -54, maxX: 0, minZ: -44, maxZ: -15 },
  },
  {
    name: '东北·晴空街景广场',
    minX: 0,
    maxX: 54,
    minZ: -44,
    maxZ: -15,
    bounds: { minX: 0, maxX: 54, minZ: -44, maxZ: -15 },
  },
  {
    name: '南区·拱廊精品街区',
    minX: -54,
    maxX: 0,
    minZ: 15,
    maxZ: 44,
    bounds: { minX: -54, maxX: 0, minZ: 15, maxZ: 44 },
  },
  {
    name: '东南·露天咖啡街角',
    minX: 0,
    maxX: 44,
    minZ: 15,
    maxZ: 44,
    bounds: { minX: 0, maxX: 44, minZ: 15, maxZ: 44 },
  },
  {
    name: '东侧·地铁疏散通道',
    minX: 44,
    maxX: 64,
    minZ: 6,
    maxZ: 34,
    bounds: { minX: 44, maxX: 64, minZ: 6, maxZ: 34 },
  },
];
