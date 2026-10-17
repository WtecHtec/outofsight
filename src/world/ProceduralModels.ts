import * as THREE from 'three';
import { PlayerCharacterId } from '../core/Config';
import { MaterialLibrary } from './Materials';

export interface PlayerRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

/**
 * Builds the Reference Image 1 Stylized Chibi Low-Poly Character Rig using 100% solid,
 * closed Three.js primitives with flatShading materials (no LatheGeometry/ExtrudeGeometry
 * winding or NaN normal issues).
 */
export function createPlayerModel(
  mats: MaterialLibrary,
  characterId: PlayerCharacterId = 'luna_cyber'
): PlayerRig {
  const group = new THREE.Group();
  group.name = `Player_${characterId}`;

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'bodyGroup';
  group.add(bodyGroup);

  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyePupilMat = new THREE.MeshBasicMaterial({
    color: characterId === 'luna_cyber' ? 0x26174a : 0x181326,
  });
  const browMat = new THREE.MeshStandardMaterial({
    color: characterId === 'luna_cyber' ? 0x231542 : 0x1e1829,
    roughness: 0.7,
    flatShading: true,
  });
  const riderYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.4,
    metalness: 0.08,
    flatShading: true,
  });
  const suitCharcoalMat = new THREE.MeshStandardMaterial({
    color: 0x29253b,
    roughness: 0.58,
    metalness: 0.1,
    flatShading: true,
  });

  // Ground contact shadow plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    mats.contactShadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  // ============================================================================
  // 1. STURDY TAPERED 4-SIDED LOW-POLY LEGS & WEDGE FEET (Reference Image 1)
  // ============================================================================
  const buildChibiLeg = (isLeft: boolean) => {
    const xOffset = isLeft ? -0.14 : 0.14;
    const legGroup = new THREE.Group();
    legGroup.name = isLeft ? 'leftLeg' : 'rightLeg';
    legGroup.position.set(xOffset, 0.56, 0);

    const legMat =
      characterId === 'luna_cyber'
        ? mats.skinTone
        : characterId === 'suited_worker'
        ? suitCharcoalMat
        : mats.playerDarkPants;

    // 6-sided tapered low-poly leg shaft
    const legShaftGeo = new THREE.CylinderGeometry(0.11, 0.085, 0.46, 6);
    const legShaft = new THREE.Mesh(legShaftGeo, legMat);
    legShaft.position.y = -0.22;
    legShaft.castShadow = true;
    legShaft.receiveShadow = true;
    legGroup.add(legShaft);

    // Chibi Wedge Foot
    const footMat =
      characterId === 'luna_cyber'
        ? mats.skinTone
        : characterId === 'flash_rider'
        ? riderYellowMat
        : characterId === 'suited_worker'
        ? mats.tireRubber
        : mats.playerAccentOrange;

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.1, 0.24),
      footMat
    );
    foot.position.set(0, -0.47, 0.04);
    foot.castShadow = true;
    legGroup.add(foot);

    // Dark sandal/shoe sole base
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.035, 0.25),
      mats.tireRubber
    );
    sole.position.set(0, -0.525, 0.04);
    legGroup.add(sole);

    return legGroup;
  };

  const leftLeg = buildChibiLeg(true);
  const rightLeg = buildChibiLeg(false);
  bodyGroup.add(leftLeg, rightLeg);

  // ============================================================================
  // 2. FACETED CHIBI TORSO, DIAMOND CHEST PLATE, WAIST BUCKLE & SASH (Ref Image 1)
  // ============================================================================
  const primaryArmorMat =
    characterId === 'luna_cyber'
      ? mats.lunaCyanArmor
      : characterId === 'flash_rider'
      ? riderYellowMat
      : characterId === 'suited_worker'
      ? suitCharcoalMat
      : mats.playerAccentOrange;

  const secondarySashMat =
    characterId === 'luna_cyber'
      ? mats.lunaPurpleSash
      : characterId === 'flash_rider'
      ? mats.buildingRoofDark
      : characterId === 'suited_worker'
      ? mats.patrolWhite
      : mats.playerJacket;

  const trimAccentMat =
    characterId === 'luna_cyber'
      ? mats.lunaCyanDark
      : characterId === 'suited_worker'
      ? mats.sirenRed
      : mats.lunaCyanArmor;

  // Lower pelvis / waist block
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 0.22, 8),
    characterId === 'luna_cyber' ? mats.skinTone : secondarySashMat
  );
  pelvis.position.set(0, 0.64, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyGroup.add(pelvis);

  // Main Faceted Upper Chest / Tunic (8-sided polygonal torso)
  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.18, 0.38, 8),
    primaryArmorMat
  );
  chest.scale.set(1.1, 1.0, 0.85);
  chest.position.set(0, 0.89, 0);
  chest.castShadow = true;
  chest.receiveShadow = true;
  bodyGroup.add(chest);

  // Faceted Polygonal Chest Plate Bevel
  const chestFacet = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.19, 0),
    primaryArmorMat
  );
  chestFacet.scale.set(1.25, 0.75, 0.68);
  chestFacet.position.set(0, 0.9, 0.08);
  chestFacet.castShadow = true;
  bodyGroup.add(chestFacet);

  // Center Chest Diamond Gem (Reference Image 1)
  const chestGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    characterId === 'suited_worker' ? mats.sirenRed : mats.lunaCyanArmor
  );
  chestGem.scale.set(0.85, 1.35, 0.48);
  chestGem.position.set(0, 0.92, 0.185);
  bodyGroup.add(chestGem);

  // Large Layered Waist Diamond Emblem (Reference Image 1 center waist diamond)
  const outerBuckle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    primaryArmorMat
  );
  outerBuckle.scale.set(1.0, 1.18, 0.42);
  outerBuckle.position.set(0, 0.68, 0.175);
  bodyGroup.add(outerBuckle);

  const innerBuckle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.072, 0),
    secondarySashMat
  );
  innerBuckle.scale.set(1.0, 1.15, 0.48);
  innerBuckle.position.set(0, 0.68, 0.2);
  bodyGroup.add(innerBuckle);

  // Left & Right Angled Geometric Hip Armor Plates (Tassets from Reference Image 1)
  [-1, 1].forEach((side) => {
    const tassetGroup = new THREE.Group();
    tassetGroup.position.set(side * 0.21, 0.58, 0.02);
    tassetGroup.rotation.z = side * -0.22;

    const outerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.25, 0.24),
      primaryArmorMat
    );
    outerPlate.castShadow = true;
    const innerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.16, 0.15),
      secondarySashMat
    );
    tassetGroup.add(outerPlate, innerPlate);
    bodyGroup.add(tassetGroup);
  });

  // Front Purple Sash / Tabard hanging between legs (Solid Box + Octahedron tip!)
  const frontSashUpper = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.28, 0.05),
    secondarySashMat
  );
  frontSashUpper.position.set(0, 0.48, 0.155);
  frontSashUpper.castShadow = true;
  bodyGroup.add(frontSashUpper);

  const frontSashPoint = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    secondarySashMat
  );
  frontSashPoint.scale.set(0.88, 1.2, 0.32);
  frontSashPoint.position.set(0.02, 0.33, 0.155);
  frontSashPoint.rotation.z = 0.18;
  frontSashPoint.castShadow = true;
  bodyGroup.add(frontSashPoint);

  // Back Sash / Capelet Panel so back view is equally detailed
  const backSash = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.3, 0.05),
    secondarySashMat
  );
  backSash.position.set(0, 0.5, -0.155);
  backSash.castShadow = true;
  bodyGroup.add(backSash);

  // Character-Specific Back Gear
  if (characterId === 'flash_rider') {
    const deliveryBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.38, 0.24),
      riderYellowMat
    );
    deliveryBox.position.set(0, 0.9, -0.24);
    deliveryBox.castShadow = true;
    bodyGroup.add(deliveryBox);
  } else if (characterId === 'street_kid') {
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.36, 0.18),
      mats.buildingRoofDark
    );
    backpack.position.set(0, 0.88, -0.22);
    backpack.castShadow = true;
    bodyGroup.add(backpack);
  }

  // Neck & Choker Collar
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.1, 0.14, 8),
    mats.skinTone
  );
  neck.position.set(0, 1.1, 0);
  bodyGroup.add(neck);

  const choker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.11, 0.05, 8),
    secondarySashMat
  );
  choker.position.set(0, 1.07, 0);
  bodyGroup.add(choker);

  // ============================================================================
  // 3. BIG CHIBI FACETED HEAD, ANIME EYES & BOB-CUT HAIR WITH DIAMOND (Ref 1)
  // ============================================================================
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  headGroup.position.set(0, 1.4, 0);
  bodyGroup.add(headGroup);

  // Solid Low-Poly Faceted Chibi Head (Icosahedron subdivision 1 = 80 crisp low-poly facets!)
  const faceGeo = new THREE.IcosahedronGeometry(0.285, 1);
  const faceMesh = new THREE.Mesh(faceGeo, mats.skinTone);
  faceMesh.scale.set(1.12, 0.98, 0.94);
  faceMesh.castShadow = true;
  faceMesh.receiveShadow = true;
  headGroup.add(faceMesh);

  // Crisp Faceted 3D Nose Wedge
  const nose = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.038, 0),
    mats.skinTone
  );
  nose.scale.set(0.85, 0.85, 1.3);
  nose.position.set(0, -0.035, 0.265);
  headGroup.add(nose);

  // Cute Confident Smile Line
  const smileBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.018, 0.02),
    browMat
  );
  smileBar.position.set(0, -0.115, 0.25);
  smileBar.rotation.z = 0.08;
  headGroup.add(smileBar);

  // Large Expressive Stylized Eyes (Exact Reference Image 1 proportions!)
  [-1, 1].forEach((side) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.13, -0.01, 0.242);
    eyeGroup.rotation.y = side * 0.22;

    // Wide White Sclera Plate
    const sclera = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, 0.115, 0.024),
      eyeWhiteMat
    );
    eyeGroup.add(sclera);

    // Big Dark-Indigo Iris/Pupil
    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.088, 0.098, 0.03),
      eyePupilMat
    );
    pupil.position.set(side * -0.012, 0.005, 0.005);
    eyeGroup.add(pupil);

    // Eye Catchlight Spark
    const spark = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.028, 0.034),
      eyeWhiteMat
    );
    spark.position.set(side * -0.028, 0.026, 0.008);
    eyeGroup.add(spark);

    // Bold Angled Eyebrow
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.155, 0.038, 0.036),
      browMat
    );
    brow.position.set(0, 0.08, 0.014);
    brow.rotation.z = side * 0.22;
    eyeGroup.add(brow);

    headGroup.add(eyeGroup);
  });

  // ============================================================================
  // 4. SCULPTED FACETED HELMET-BOB HAIR & FOREHEAD DIAMOND CREST (Ref Image 1)
  // ============================================================================
  const hairMainMat =
    characterId === 'luna_cyber'
      ? mats.lunaHairViolet
      : characterId === 'flash_rider'
      ? riderYellowMat
      : characterId === 'suited_worker'
      ? suitCharcoalMat
      : mats.playerAccentOrange;

  // Top & Back Faceted Bob-Hair Crown (Solid Icosahedron cap)
  const hairCrown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.335, 1),
    hairMainMat
  );
  hairCrown.scale.set(1.12, 0.96, 1.04);
  hairCrown.position.set(0, 0.06, -0.035);
  hairCrown.castShadow = true;
  headGroup.add(hairCrown);

  // Back Hair Bob Skirt (frames the back of the neck cleanly)
  const hairBackSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.26, 7),
    hairMainMat
  );
  hairBackSkirt.scale.set(1.08, 1.0, 0.72);
  hairBackSkirt.position.set(0, -0.04, -0.09);
  hairBackSkirt.castShadow = true;
  headGroup.add(hairBackSkirt);

  // Left & Right Angled Side Hair Wings (Reference Image 1 signature bob-cut side locks!)
  [-1, 1].forEach((side) => {
    const sideWingGroup = new THREE.Group();
    sideWingGroup.position.set(side * 0.29, -0.02, 0.04);
    sideWingGroup.rotation.z = side * 0.16;
    sideWingGroup.rotation.y = side * 0.25;

    const upperWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.34, 0.26),
      hairMainMat
    );
    upperWing.castShadow = true;
    sideWingGroup.add(upperWing);

    // Tapered sharp inward-pointing lock below the cheek
    const lowerTip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      hairMainMat
    );
    lowerTip.scale.set(0.45, 1.35, 0.85);
    lowerTip.position.set(side * -0.03, -0.18, 0.04);
    lowerTip.rotation.z = side * -0.35;
    lowerTip.castShadow = true;
    sideWingGroup.add(lowerTip);

    headGroup.add(sideWingGroup);
  });

  // Front Brow Bangs
  const frontBangs = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.13, 0.18),
    hairMainMat
  );
  frontBangs.position.set(0, 0.19, 0.18);
  frontBangs.rotation.x = 0.18;
  frontBangs.castShadow = true;
  headGroup.add(frontBangs);

  // Iconic Forehead White Diamond Gem (Reference Image 1 centerpiece!)
  const foreheadDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    mats.lunaDiamondWhite
  );
  foreheadDiamond.scale.set(0.82, 1.25, 0.45);
  foreheadDiamond.position.set(0, 0.19, 0.295);
  headGroup.add(foreheadDiamond);

  // Character-Specific Extra Head Accents
  if (characterId === 'flash_rider') {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6),
      mats.playerAccentOrange
    );
    stem.position.set(0, 0.4, 0);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.025, 0.055),
      mats.playerAccentOrange
    );
    blade.position.set(0, 0.47, 0);
    headGroup.add(stem, blade);
  } else if (characterId === 'street_kid') {
    [-1, 1].forEach((side) => {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.07, 8).rotateZ(Math.PI / 2),
        mats.lunaCyanArmor
      );
      cup.position.set(side * 0.36, -0.01, 0.05);
      headGroup.add(cup);
    });
  } else if (characterId === 'suited_worker') {
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    [-1, 1].forEach((side) => {
      const glassFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.025, 0.025),
        frameMat
      );
      glassFrame.position.set(side * 0.13, 0.05, 0.265);
      headGroup.add(glassFrame);
    });
  }

  // ============================================================================
  // 5. FACETED CHIBI ARMS, HEXAGONAL WRIST CUFFS & HANDS (Reference Image 1)
  // ============================================================================
  const buildChibiArm = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;
    const armGroup = new THREE.Group();
    armGroup.name = isLeft ? 'leftArm' : 'rightArm';
    armGroup.position.set(side * 0.26, 0.98, 0);
    armGroup.rotation.z = side * -0.22;

    const armMat =
      characterId === 'suited_worker' ? suitCharcoalMat : mats.skinTone;

    // Tapered low-poly arm shaft
    const armShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.065, 0.38, 6),
      armMat
    );
    armShaft.position.y = -0.18;
    armShaft.castShadow = true;
    armGroup.add(armShaft);

    // Chunky Turquoise-Cyan Hexagonal Wrist Cuff (Exact Reference Image 1 feature!)
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.098, 0.085, 6),
      trimAccentMat
    );
    cuff.position.y = -0.34;
    cuff.castShadow = true;
    armGroup.add(cuff);

    // Low-Poly Hand + Thumb Wedge
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.115, 0.085),
      mats.skinTone
    );
    palm.position.y = -0.42;
    palm.castShadow = true;
    armGroup.add(palm);

    const thumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.065, 0.045),
      mats.skinTone
    );
    thumb.position.set(side * 0.058, -0.41, 0.035);
    thumb.rotation.z = side * -0.45;
    armGroup.add(thumb);

    if (!isLeft && characterId === 'suited_worker') {
      const coffeeCup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.042, 0.14, 8),
        mats.patrolWhite
      );
      coffeeCup.position.set(0, -0.46, 0.08);
      armGroup.add(coffeeCup);
    }

    return armGroup;
  };

  const leftArm = buildChibiArm(true);
  const rightArm = buildChibiArm(false);
  bodyGroup.add(leftArm, rightArm);

  return { group, bodyGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg };
}

/**
 * Generates a crisp, reliable 256x256 character portrait DataURL for UI cards & the Enrollment Certificate
 * using a dedicated 2D/3D stylized illustration pass (zero shared WebGLRenderTarget side-effects!).
 */
export function renderPlayerPortraitDataUrl(
  _renderer: THREE.WebGLRenderer,
  _mats: MaterialLibrary,
  characterId: PlayerCharacterId = 'luna_cyber'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const palette =
    characterId === 'luna_cyber'
      ? {
          bgTop: '#311b61',
          bgBot: '#180d38',
          hair: '#5244d4',
          hairDark: '#3b2ea8',
          skin: '#f0a684',
          skinShadow: '#d98a66',
          armor: '#22d3ee',
          sash: '#5b3fd1',
          eye: '#26174a',
          diamond: '#f8fafc',
        }
      : characterId === 'flash_rider'
      ? {
          bgTop: '#0f766e',
          bgBot: '#064e3b',
          hair: '#facc15',
          hairDark: '#ca8a04',
          skin: '#f0a684',
          skinShadow: '#d98a66',
          armor: '#facc15',
          sash: '#1e293b',
          eye: '#181326',
          diamond: '#f97316',
        }
      : characterId === 'suited_worker'
      ? {
          bgTop: '#312e81',
          bgBot: '#1e1b4b',
          hair: '#29253b',
          hairDark: '#181524',
          skin: '#f0a684',
          skinShadow: '#d98a66',
          armor: '#334155',
          sash: '#ef4444',
          eye: '#181326',
          diamond: '#f8fafc',
        }
      : {
          bgTop: '#1e3a8a',
          bgBot: '#0f172a',
          hair: '#f97316',
          hairDark: '#c2410c',
          skin: '#f0a684',
          skinShadow: '#d98a66',
          armor: '#f97316',
          sash: '#2563eb',
          eye: '#181326',
          diamond: '#22d3ee',
        };

  // Faceted Low-Poly Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, palette.bgTop);
  bgGrad.addColorStop(1, palette.bgBot);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle low-poly background facets
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(140, 0);
  ctx.lineTo(60, 120);
  ctx.closePath();
  ctx.fill();

  // Torso / Shoulders (Faceted Chibi Tunic)
  ctx.fillStyle = palette.armor;
  ctx.beginPath();
  ctx.moveTo(64, 256);
  ctx.lineTo(84, 182);
  ctx.lineTo(172, 182);
  ctx.lineTo(192, 256);
  ctx.closePath();
  ctx.fill();

  // Center Chest Diamond Gem
  ctx.fillStyle = palette.sash;
  ctx.beginPath();
  ctx.moveTo(128, 192);
  ctx.lineTo(146, 214);
  ctx.lineTo(128, 238);
  ctx.lineTo(110, 214);
  ctx.closePath();
  ctx.fill();

  // Neck & Choker
  ctx.fillStyle = palette.skinShadow;
  ctx.fillRect(112, 158, 32, 28);
  ctx.fillStyle = palette.sash;
  ctx.fillRect(110, 168, 36, 9);

  // Back Bob Hair Volume
  ctx.fillStyle = palette.hairDark;
  ctx.beginPath();
  ctx.moveTo(46, 108);
  ctx.lineTo(128, 34);
  ctx.lineTo(210, 108);
  ctx.lineTo(196, 174);
  ctx.lineTo(60, 174);
  ctx.closePath();
  ctx.fill();

  // Faceted Low-Poly Chibi Face
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.moveTo(72, 86);
  ctx.lineTo(184, 86);
  ctx.lineTo(188, 134);
  ctx.lineTo(164, 162);
  ctx.lineTo(128, 168);
  ctx.lineTo(92, 162);
  ctx.lineTo(68, 134);
  ctx.closePath();
  ctx.fill();

  // Expressive Eyes (Reference Image 1 style)
  [-1, 1].forEach((dir) => {
    const ex = 128 + dir * 32;
    const ey = 124;
    // White sclera
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex - 16, ey - 13, 32, 24);
    // Dark pupil
    ctx.fillStyle = palette.eye;
    ctx.fillRect(ex - 10 - dir * 2, ey - 11, 22, 21);
    // Spark catchlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex - 8 - dir * 4, ey - 8, 7, 7);
    // Angled eyebrow
    ctx.fillStyle = palette.eye;
    ctx.save();
    ctx.translate(ex, ey - 19);
    ctx.rotate(dir * -0.18);
    ctx.fillRect(-18, -4, 36, 7);
    ctx.restore();
  });

  // Nose & Smile
  ctx.fillStyle = palette.skinShadow;
  ctx.beginPath();
  ctx.moveTo(128, 126);
  ctx.lineTo(134, 138);
  ctx.lineTo(122, 138);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = palette.eye;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(118, 149);
  ctx.quadraticCurveTo(128, 154, 139, 147);
  ctx.stroke();

  // Faceted Bob-Cut Hair Crown & Side Wings (Reference Image 1)
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.moveTo(52, 96);
  ctx.lineTo(84, 42);
  ctx.lineTo(128, 34);
  ctx.lineTo(172, 42);
  ctx.lineTo(204, 96);
  ctx.lineTo(192, 172);
  ctx.lineTo(170, 148);
  ctx.lineTo(174, 98);
  ctx.lineTo(128, 106);
  ctx.lineTo(82, 98);
  ctx.lineTo(86, 148);
  ctx.lineTo(64, 172);
  ctx.closePath();
  ctx.fill();

  // Forehead White Diamond Crest (Reference Image 1)
  ctx.fillStyle = palette.diamond;
  ctx.beginPath();
  ctx.moveTo(128, 60);
  ctx.lineTo(143, 82);
  ctx.lineTo(128, 104);
  ctx.lineTo(113, 82);
  ctx.closePath();
  ctx.fill();

  // ID Frame Border
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 250);

  return canvas.toDataURL('image/png');
}

export interface OfficerRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  capGroup: THREE.Group;
  dizzyStarsGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  visionConeMesh: THREE.Mesh;
  visionConeMat: THREE.MeshBasicMaterial;
  alertRingMesh: THREE.Mesh;
}

/**
 * Builds the Security Guard (参保核查员) in the same Stylized Faceted Chibi Low-Poly style
 * using 100% solid, closed Three.js primitives.
 */
export function createOfficerModel(
  mats: MaterialLibrary,
  roleOrIndex: 'captain' | 'observer' | 'searcher' | number = 0
): OfficerRig {
  const group = new THREE.Group();
  group.name = `Officer_${roleOrIndex}`;

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'bodyGroup';
  group.add(bodyGroup);

  const eyeDarkMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hiVisNeonMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.2,
    roughness: 0.4,
    flatShading: true,
  });

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    mats.contactShadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  // 1. Sturdy Low-Poly Chibi Legs & Boots
  const buildLeg = (isLeft: boolean) => {
    const xOffset = isLeft ? -0.145 : 0.145;
    const legGroup = new THREE.Group();
    legGroup.name = isLeft ? 'leftLeg' : 'rightLeg';
    legGroup.position.set(xOffset, 0.56, 0);

    const legMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.095, 0.46, 6),
      mats.officerNavy
    );
    legMesh.position.y = -0.22;
    legMesh.castShadow = true;
    legGroup.add(legMesh);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.11, 0.25),
      mats.tireRubber
    );
    boot.position.set(0, -0.48, 0.04);
    boot.castShadow = true;
    legGroup.add(boot);

    return legGroup;
  };

  const leftLeg = buildLeg(true);
  const rightLeg = buildLeg(false);
  bodyGroup.add(leftLeg, rightLeg);

  // 2. Faceted Chibi Security Uniform Torso & Gold Diamond Belt
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.21, 0.2, 8),
    mats.officerNavy
  );
  pelvis.position.set(0, 0.64, 0);
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.2, 0.4, 8),
    mats.officerNavy
  );
  chest.scale.set(1.12, 1.0, 0.86);
  chest.position.set(0, 0.89, 0);
  chest.castShadow = true;
  chest.receiveShadow = true;
  bodyGroup.add(chest);

  const tie = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.085, 0),
    mats.sirenRed
  );
  tie.scale.set(0.65, 1.8, 0.4);
  tie.position.set(0, 0.9, 0.19);
  bodyGroup.add(tie);

  const beltBuckle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    mats.officerBadgeGold
  );
  beltBuckle.scale.set(1.1, 1.1, 0.45);
  beltBuckle.position.set(0, 0.68, 0.19);
  bodyGroup.add(beltBuckle);

  [-1, 1].forEach((side) => {
    const hipPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.22, 0.22),
      hiVisNeonMat
    );
    hipPlate.position.set(side * 0.23, 0.62, 0);
    hipPlate.rotation.z = side * -0.18;
    bodyGroup.add(hipPlate);
  });

  // 3. Big Chibi Faceted Security Head, Stern Cartoon Eyes & Octagonal Cap
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  headGroup.position.set(0, 1.4, 0);
  bodyGroup.add(headGroup);

  const skull = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    mats.skinTone
  );
  skull.scale.set(1.1, 0.98, 0.94);
  skull.castShadow = true;
  headGroup.add(skull);

  [-1, 1].forEach((side) => {
    const sclera = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.105, 0.024),
      eyeWhiteMat
    );
    sclera.position.set(side * 0.125, -0.01, 0.24);
    sclera.rotation.y = side * 0.2;
    headGroup.add(sclera);

    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.09, 0.03),
      eyeDarkMat
    );
    pupil.position.set(side * 0.115, -0.01, 0.246);
    pupil.rotation.y = side * 0.2;
    headGroup.add(pupil);

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.042, 0.038),
      mats.tireRubber
    );
    brow.position.set(side * 0.12, 0.068, 0.25);
    brow.rotation.z = side * 0.28;
    headGroup.add(brow);
  });

  if (roleOrIndex === 0 || roleOrIndex === 'captain') {
    const mustache = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.045, 0.045),
      mats.tireRubber
    );
    mustache.position.set(0, -0.1, 0.255);
    headGroup.add(mustache);
  }

  // Octagonal Security Peaked Cap + Gold Diamond Forehead Emblem (inside capGroup so it can tilt when hit!)
  const capGroup = new THREE.Group();
  headGroup.add(capGroup);

  const capCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.29, 0.18, 8),
    mats.officerNavy
  );
  capCrown.position.set(0, 0.22, -0.01);
  capCrown.castShadow = true;
  capGroup.add(capCrown);

  const capVisor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.04, 0.24),
    mats.tireRubber
  );
  capVisor.position.set(0, 0.13, 0.19);
  capVisor.rotation.x = 0.15;
  capGroup.add(capVisor);

  const capDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.085, 0),
    mats.officerBadgeGold
  );
  capDiamond.scale.set(0.85, 1.2, 0.45);
  capDiamond.position.set(0, 0.23, 0.285);
  capGroup.add(capDiamond);

  // 3B. Dizzy Stars & Red Head Bump Group (appears when hit by player's stone/wrench!)
  const dizzyStarsGroup = new THREE.Group();
  dizzyStarsGroup.position.set(0, 0.44, 0);
  dizzyStarsGroup.visible = false;
  headGroup.add(dizzyStarsGroup);

  const headBump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.18, 7),
    mats.sirenRed
  );
  headBump.position.set(0.12, -0.08, 0.05);
  headBump.rotation.z = -0.35;
  dizzyStarsGroup.add(headBump);

  for (let s = 0; s < 4; s++) {
    const angle = (s * Math.PI * 2) / 4;
    const starMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.095, 0),
      hiVisNeonMat
    );
    starMesh.position.set(Math.cos(angle) * 0.36, 0.06, Math.sin(angle) * 0.36);
    dizzyStarsGroup.add(starMesh);
  }

  // 4. Faceted Chibi Arms, White Gloves, Clipboard & Flashlight
  const buildArm = (isLeft: boolean) => {
    const side = isLeft ? -1 : 1;
    const armGroup = new THREE.Group();
    armGroup.name = isLeft ? 'leftArm' : 'rightArm';
    armGroup.position.set(side * 0.28, 0.98, 0);
    armGroup.rotation.z = side * -0.18;

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.075, 0.36, 6),
      mats.officerLightBlueShirt
    );
    upperArm.position.y = -0.18;
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.098, 0.075, 6),
      hiVisNeonMat
    );
    cuff.position.y = -0.34;
    armGroup.add(cuff);

    const glove = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.11, 0.09),
      mats.patrolWhite
    );
    glove.position.y = -0.42;
    armGroup.add(glove);

    return armGroup;
  };

  const leftArm = buildArm(true);
  const rightArm = buildArm(false);
  bodyGroup.add(leftArm, rightArm);

  const clipboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.3, 0.03),
    mats.crateWood
  );
  clipboard.position.set(-0.04, -0.44, 0.14);
  clipboard.rotation.x = -0.5;
  leftArm.add(clipboard);

  const torch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.03, 0.22, 6).rotateX(Math.PI / 2),
    mats.tireRubber
  );
  torch.position.set(0, -0.42, 0.12);
  rightArm.add(torch);

  const beamGeo = new THREE.CylinderGeometry(0.08, 1.1, 4.5, 12, 1, true);
  beamGeo.translate(0, -2.25, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.set(0.28, 0.62, 0.25);
  bodyGroup.add(beamMesh);

  // 5. Ground Vision Sector (+Z forward, 16.0m standard officer vision)
  const coneRadius = 16.0;
  const coneAngleRad = THREE.MathUtils.degToRad(84);
  const sectorGeo = new THREE.CircleGeometry(
    coneRadius,
    28,
    -Math.PI / 2 - coneAngleRad / 2,
    coneAngleRad
  );
  sectorGeo.rotateX(-Math.PI / 2);
  sectorGeo.rotateY(Math.PI);

  const visionConeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const visionConeMesh = new THREE.Mesh(sectorGeo, visionConeMat);
  visionConeMesh.position.y = 0.06;
  group.add(visionConeMesh);

  // 6. Floating Alert Indicator Ring above Head
  const ringGeo = new THREE.RingGeometry(0.2, 0.3, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const alertRingMesh = new THREE.Mesh(ringGeo, ringMat);
  alertRingMesh.position.set(0, 2.25, 0);
  group.add(alertRingMesh);

  return {
    group,
    bodyGroup,
    headGroup,
    capGroup,
    dizzyStarsGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    visionConeMesh,
    visionConeMat,
    alertRingMesh,
  };
}

export interface PatrolCarRig {
  group: THREE.Group;
  upperCabin: THREE.Mesh;
  dentDamageGroup: THREE.Group;
  slidingDoor: THREE.Group;
  wheels: THREE.Object3D[];
  sirenRedMesh: THREE.Mesh;
  sirenBlueMesh: THREE.Mesh;
  sirenPointLight: THREE.PointLight;
  carVisionConeMesh: THREE.Mesh;
  carVisionConeMat: THREE.MeshBasicMaterial;
}

/**
 * Builds the "参保直通车" Patrol Van using 100% solid Box/Cylinder primitives,
 * with a 30m+ Long-Range Vision Cone and a 3D Dent/Crater group when hit by a stone/wrench!
 */
export function createPatrolCarModel(mats: MaterialLibrary): PatrolCarRig {
  const group = new THREE.Group();
  group.name = 'PatrolVan';
  const slidingDoor = new THREE.Group();
  slidingDoor.name = 'slidingDoor';
  group.add(slidingDoor);
  const wheels: THREE.Object3D[] = [];

  const carShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 6.8),
    mats.contactShadowMat
  );
  carShadow.rotation.x = -Math.PI / 2;
  carShadow.position.y = 0.03;
  group.add(carShadow);

  // 1. Solid Lower Navy Chassis
  const lowerChassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.72, 5.4),
    mats.patrolNavy
  );
  lowerChassis.position.set(0, 0.64, 0);
  lowerChassis.castShadow = true;
  lowerChassis.receiveShadow = true;
  group.add(lowerChassis);

  // Front & Rear Bumpers
  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(2.68, 0.28, 0.35),
    mats.tireRubber
  );
  frontBumper.position.set(0, 0.45, 2.68);
  const rearBumper = frontBumper.clone();
  rearBumper.position.set(0, 0.45, -2.68);
  group.add(frontBumper, rearBumper);

  // 2. Solid Upper White Van Cabin
  const upperCabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.48, 1.15, 4.4),
    mats.patrolWhite
  );
  upperCabin.position.set(0, 1.52, -0.25);
  upperCabin.castShadow = true;
  upperCabin.receiveShadow = true;
  group.add(upperCabin);

  // 2B. 3D Dent Crater & Sparks Group (Visible for ~2s when hit by player's stone/wrench!)
  const dentDamageGroup = new THREE.Group();
  dentDamageGroup.visible = false;
  group.add(dentDamageGroup);

  [-1, 1].forEach((side) => {
    // Crushed dark metal crater on van side
    const crater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.28, 0.18, 7).rotateZ(Math.PI / 2),
      mats.tireRubber
    );
    crater.position.set(side * 1.24, 1.35, 0.2);
    crater.rotation.x = 0.3;
    dentDamageGroup.add(crater);

    // Bent metallic shards & orange impact sparks
    for (let k = 0; k < 4; k++) {
      const spark = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        k % 2 === 0 ? mats.playerAccentOrange : mats.sirenRed
      );
      spark.position.set(
        side * 1.38,
        1.35 + Math.sin(k * 1.6) * 0.38,
        0.2 + Math.cos(k * 1.6) * 0.42
      );
      dentDamageGroup.add(spark);
    }
  });

  // Angled Front Hood Wedge & Windshield
  const frontHood = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 0.55, 1.1),
    mats.patrolWhite
  );
  frontHood.position.set(0, 1.12, 2.15);
  frontHood.rotation.x = 0.22;
  frontHood.castShadow = true;
  group.add(frontHood);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(2.22, 0.76, 0.16),
    mats.carGlass
  );
  windshield.position.set(0, 1.58, 1.98);
  windshield.rotation.x = -0.28;
  group.add(windshield);

  // Side Cab Windows
  const sideWinGeo = new THREE.BoxGeometry(2.52, 0.58, 1.45);
  const sideWin = new THREE.Mesh(sideWinGeo, mats.carGlass);
  sideWin.position.set(0, 1.62, 0.95);
  group.add(sideWin);

  // Headlights & Taillights
  [-0.88, 0.88].forEach((hx) => {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.12),
      mats.headlightGlow
    );
    hl.position.set(hx, 0.82, 2.71);
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.12),
      mats.brakelightGlow
    );
    tl.position.set(hx, 0.82, -2.71);
    group.add(hl, tl);
  });

  // Side Sliding Door Panel
  const doorPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.18, 1.35),
    mats.patrolNavy
  );
  doorPanel.position.set(1.26, 1.18, 0.15);
  slidingDoor.add(doorPanel);

  // Side Banners ("参保直通车")
  const bannerGeo = new THREE.PlaneGeometry(3.4, 0.78);
  const bannerLeft = new THREE.Mesh(bannerGeo, mats.vanBannerMat);
  bannerLeft.position.set(1.26, 1.5, -0.45);
  bannerLeft.rotation.y = Math.PI / 2;
  group.add(bannerLeft);

  const bannerRight = new THREE.Mesh(bannerGeo, mats.vanBannerMat);
  bannerRight.position.set(-1.26, 1.5, -0.45);
  bannerRight.rotation.y = -Math.PI / 2;
  group.add(bannerRight);

  // Roof Billboard & Siren Lightbar
  const roofBillboard = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.55, 0.14),
    mats.vanBannerMat
  );
  roofBillboard.position.set(0, 2.38, -0.2);
  group.add(roofBillboard);

  // 4 Solid Low-Poly Wheels
  const wheelPositions: [number, number, number][] = [
    [-1.32, 0.45, 1.65],
    [1.32, 0.45, 1.65],
    [-1.32, 0.45, -1.65],
    [1.32, 0.45, -1.65],
  ];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.34, 12).rotateZ(Math.PI / 2),
      mats.tireRubber
    );
    tire.castShadow = true;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.36, 8).rotateZ(Math.PI / 2),
      mats.wheelAlloy
    );
    wheelGroup.add(tire, rim);
    group.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // Siren Lightbar
  const sirenRedMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.22, 0.36),
    mats.sirenRed
  );
  sirenRedMesh.position.set(-0.42, 2.2, 0.85);
  const sirenBlueMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.22, 0.36),
    mats.sirenBlue
  );
  sirenBlueMesh.position.set(0.42, 2.2, 0.85);
  group.add(sirenRedMesh, sirenBlueMesh);

  const sirenPointLight = new THREE.PointLight(0x3b82f6, 3.5, 18);
  sirenPointLight.position.set(0, 2.55, 0.85);
  group.add(sirenPointLight);

  // Forward Long-Range Radar & Headlight Vision Cone (30m base radius, much farther than Officer's 16m!)
  const carConeRadius = 30.0;
  const carConeAngleRad = THREE.MathUtils.degToRad(102);
  const carSectorGeo = new THREE.CircleGeometry(
    carConeRadius,
    36,
    -Math.PI / 2 - carConeAngleRad / 2,
    carConeAngleRad
  );
  carSectorGeo.rotateX(-Math.PI / 2);
  carSectorGeo.rotateY(Math.PI);

  const carVisionConeMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const carVisionConeMesh = new THREE.Mesh(carSectorGeo, carVisionConeMat);
  carVisionConeMesh.position.set(0, 0.05, 1.8);
  group.add(carVisionConeMesh);

  return {
    group,
    upperCabin,
    dentDamageGroup,
    slidingDoor,
    wheels,
    sirenRedMesh,
    sirenBlueMesh,
    sirenPointLight,
    carVisionConeMesh,
    carVisionConeMat,
  };
}

/**
 * Reference Image 2: Stylized Low-Poly Sports Sedan (Bright Yellow Car with White Pillars,
 * Deep Purple Windows & 5-Spoke Star Rims!) built from 100% solid Box/Cylinder primitives.
 */
export function createStaticCivilianCar(
  mats: MaterialLibrary,
  bodyColorHex: number = 0xfacc15
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CivilianSportsSedan';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColorHex,
    roughness: 0.38,
    metalness: 0.1,
    flatShading: true,
  });
  const pillarWhiteMat = mats.rowhouseCorniceWhite;
  const windowPurpleMat = mats.rowhouseWindowRecessPurple;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.2),
    mats.contactShadowMat
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  // 1. Solid Lower Wedge Sports Chassis (Reference Image 2 yellow car body)
  const lowerBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.08, 0.58, 4.65),
    bodyMat
  );
  lowerBody.position.y = 0.56;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  group.add(lowerBody);

  // Hood Power Dome Scoop (Reference Image 2 yellow car hood detail)
  const hoodScoop = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.15, 1.25),
    bodyMat
  );
  hoodScoop.position.set(0, 0.88, 1.25);
  hoodScoop.castShadow = true;
  group.add(hoodScoop);

  // 2. Solid Greenhouse Cabin with White Roof/Pillars & Deep Purple Windows (Reference Image 2!)
  const cabinCore = new THREE.Mesh(
    new THREE.BoxGeometry(1.76, 0.58, 2.25),
    windowPurpleMat
  );
  cabinCore.position.set(0, 1.1, -0.2);
  cabinCore.castShadow = true;
  group.add(cabinCore);

  // White Roof Plate
  const roofPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, 0.1, 2.1),
    pillarWhiteMat
  );
  roofPlate.position.set(0, 1.4, -0.2);
  roofPlate.castShadow = true;
  group.add(roofPlate);

  // Sloped Front Windshield & Rear Fastback Window
  const frontWindshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.58, 0.75),
    windowPurpleMat
  );
  frontWindshield.position.set(0, 1.04, 0.92);
  frontWindshield.rotation.x = -0.52;
  group.add(frontWindshield);

  const rearWindow = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.55, 0.75),
    windowPurpleMat
  );
  rearWindow.position.set(0, 1.04, -1.32);
  rearWindow.rotation.x = 0.52;
  group.add(rearWindow);

  // Headlights & Taillights
  [-0.72, 0.72].forEach((hx) => {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.18, 0.1),
      mats.headlightGlow
    );
    hl.position.set(hx, 0.62, 2.34);
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.18, 0.1),
      mats.brakelightGlow
    );
    tl.position.set(hx, 0.62, -2.34);
    group.add(hl, tl);
  });

  // 3. 4 Sport Wheels with 5-Spoke Star Alloy Rims (Reference Image 2!)
  const wheelCoords: [number, number, number][] = [
    [-1.04, 0.38, 1.38],
    [1.04, 0.38, 1.38],
    [-1.04, 0.38, -1.38],
    [1.04, 0.38, -1.38],
  ];
  wheelCoords.forEach(([x, y, z]) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(x, y, z);

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12).rotateZ(Math.PI / 2),
      mats.tireRubber
    );
    tire.castShadow = true;
    const innerWell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.3, 10).rotateZ(Math.PI / 2),
      windowPurpleMat
    );
    wGroup.add(tire, innerWell);

    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.06, 0.26),
        mats.rowhouseCorniceWhite
      );
      spoke.rotation.x = (s * Math.PI * 2) / 5;
      wGroup.add(spoke);
    }

    group.add(wGroup);
  });

  return group;
}

/**
 * Reference Image 2: Single Colorful Multi-Story Rowhouse Facade Module
 */
export function createRowhouseSegmentMesh(
  mats: MaterialLibrary,
  width: number,
  height: number,
  depth: number,
  wallMat: THREE.MeshStandardMaterial,
  options: {
    hasStorefront?: boolean;
    awningStyle?: 'blue_white' | 'orange_white' | 'none';
    windowCols?: number;
    floors?: number;
  } = {}
): THREE.Group {
  const group = new THREE.Group();
  const floors = options.floors ?? 3;
  const winCols = options.windowCols ?? Math.max(2, Math.round(width / 3.2));

  // Main Solid Low-Poly Building Volume
  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    wallMat
  );
  bodyMesh.position.y = height / 2;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Horizontal 3D Protruding White Cornice Ledges between every floor & roof (Reference Image 2!)
  const floorH = height / floors;
  for (let f = 1; f <= floors; f++) {
    const ledgeY = f * floorH;
    const isRoof = f === floors;
    const ledgeH = isRoof ? 0.45 : 0.34;
    const ledgeDepth = depth + (isRoof ? 0.7 : 0.52);
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.24, ledgeH, ledgeDepth),
      mats.rowhouseCorniceWhite
    );
    ledge.position.y = ledgeY - ledgeH / 2;
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    group.add(ledge);
  }

  // Helper to populate 3D Recessed Windows with White Frames, Mullions & Sills on Front (+Z) and Back (-Z)
  const addFacadeDetails = (zDir: 1 | -1) => {
    const zFace = (depth / 2) * zDir;

    for (let f = 1; f < floors; f++) {
      const floorBaseY = f * floorH;
      const winCenterY = floorBaseY + floorH * 0.48;
      const colStep = width / (winCols + 0.6);
      const startX = -((winCols - 1) * colStep) / 2;

      for (let c = 0; c < winCols; c++) {
        const wx = startX + c * colStep;
        const winW = 1.25;
        const winH = 1.85;

        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(winW, winH, 0.12),
          mats.rowhouseWindowRecessPurple
        );
        pane.position.set(wx, winCenterY, zFace + zDir * 0.04);
        group.add(pane);

        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(winW + 0.36, 0.22, 0.28),
          mats.rowhouseCorniceWhite
        );
        lintel.position.set(wx, winCenterY + winH / 2 + 0.08, zFace + zDir * 0.12);
        lintel.castShadow = true;
        group.add(lintel);

        const sill = new THREE.Mesh(
          new THREE.BoxGeometry(winW + 0.42, 0.24, 0.34),
          mats.rowhouseCorniceWhite
        );
        sill.position.set(wx, winCenterY - winH / 2 - 0.1, zFace + zDir * 0.15);
        sill.castShadow = true;
        group.add(sill);

        const vMullion = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, winH, 0.18),
          mats.rowhouseCorniceWhite
        );
        vMullion.position.set(wx, winCenterY, zFace + zDir * 0.07);
        const hMullion = new THREE.Mesh(
          new THREE.BoxGeometry(winW, 0.11, 0.18),
          mats.rowhouseCorniceWhite
        );
        hMullion.position.set(wx, winCenterY + 0.22, zFace + zDir * 0.07);
        group.add(vMullion, hMullion);
      }
    }

    // Ground Floor Door & Storefront
    const doorX = width * 0.26;
    const doorW = 1.45;
    const doorH = 2.65;

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.34, doorH + 0.2, 0.26),
      mats.rowhouseCorniceWhite
    );
    doorFrame.position.set(doorX, doorH / 2 + 0.1, zFace + zDir * 0.08);
    group.add(doorFrame);

    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, doorH, 0.16),
      mats.rowhouseDoorWood
    );
    doorPanel.position.set(doorX, doorH / 2 + 0.05, zFace + zDir * 0.12);
    group.add(doorPanel);

    const doorStep = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.5, 0.18, 0.55),
      mats.rowhouseCorniceWhite
    );
    doorStep.position.set(doorX, 0.09, zFace + zDir * 0.24);
    group.add(doorStep);

    if (options.hasStorefront) {
      const shopWinW = Math.max(2.2, width * 0.46);
      const shopWinH = 1.95;
      const shopWinX = -width * 0.18;

      const shopFrame = new THREE.Mesh(
        new THREE.BoxGeometry(shopWinW + 0.32, shopWinH + 0.32, 0.24),
        mats.rowhouseCorniceWhite
      );
      shopFrame.position.set(shopWinX, 1.75, zFace + zDir * 0.08);
      group.add(shopFrame);

      const shopGlass = new THREE.Mesh(
        new THREE.BoxGeometry(shopWinW, shopWinH, 0.18),
        mats.rowhouseShopGlass
      );
      shopGlass.position.set(shopWinX, 1.75, zFace + zDir * 0.12);
      group.add(shopGlass);

      if (options.awningStyle && options.awningStyle !== 'none') {
        const awningGroup = new THREE.Group();
        const awningW = width * 0.92;
        const stripeCount = Math.max(6, Math.round(awningW / 0.85));
        const stripeW = awningW / stripeCount;

        const colorMat =
          options.awningStyle === 'blue_white'
            ? new THREE.MeshStandardMaterial({
                color: 0x4ea8de,
                roughness: 0.6,
                flatShading: true,
              })
            : new THREE.MeshStandardMaterial({
                color: 0xee7b44,
                roughness: 0.6,
                flatShading: true,
              });

        for (let s = 0; s < stripeCount; s++) {
          const sx = -awningW / 2 + stripeW * (s + 0.5);
          const sMat = s % 2 === 0 ? colorMat : mats.rowhouseCorniceWhite;

          const slopeSeg = new THREE.Mesh(
            new THREE.BoxGeometry(stripeW, 0.16, 1.95),
            sMat
          );
          slopeSeg.position.set(sx, 0, zDir * 0.92);
          slopeSeg.rotation.x = zDir * 0.34;
          slopeSeg.castShadow = true;
          awningGroup.add(slopeSeg);

          const valance = new THREE.Mesh(
            new THREE.BoxGeometry(stripeW, 0.28, 0.14),
            sMat
          );
          valance.position.set(sx, -0.38, zDir * 1.82);
          valance.castShadow = true;
          awningGroup.add(valance);
        }

        awningGroup.position.set(0, floorH - 0.35, zFace);
        group.add(awningGroup);
      }
    } else {
      const resCols = Math.max(1, winCols - 1);
      for (let c = 0; c < resCols; c++) {
        const wx = -width * 0.32 + c * 2.4;
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.8, 0.12),
          mats.rowhouseWindowRecessPurple
        );
        pane.position.set(wx, 1.85, zFace + zDir * 0.04);
        const sill = new THREE.Mesh(
          new THREE.BoxGeometry(1.56, 0.24, 0.32),
          mats.rowhouseCorniceWhite
        );
        sill.position.set(wx, 0.85, zFace + zDir * 0.14);
        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(1.52, 0.22, 0.28),
          mats.rowhouseCorniceWhite
        );
        lintel.position.set(wx, 2.82, zFace + zDir * 0.12);
        group.add(pane, sill, lintel);
      }
    }
  };

  addFacadeDetails(1);
  addFacadeDetails(-1);

  return group;
}

/**
 * Reference Image 2 Sidewalk Prop: Terracotta Flowerpot with Sculpted Conical Green Topiary Bush
 * Built with closed Cylinder/Icosahedron geometries (no inverted LatheGeometry!).
 */
export function createPottedTopiaryProp(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PottedTopiary';

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.32, 0.68, 8),
    mats.potTerracotta
  );
  pot.position.y = 0.34;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  const potRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.48, 0.14, 8),
    mats.potTerracotta
  );
  potRim.position.y = 0.66;
  potRim.castShadow = true;
  group.add(potRim);

  // Sculpted Egg/Cone Topiary Green Bush (built from 2 overlapping faceted volumes)
  const bushLower = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.56, 1),
    mats.foliageGreen
  );
  bushLower.scale.set(1.0, 1.15, 1.0);
  bushLower.position.y = 1.18;
  bushLower.castShadow = true;
  bushLower.receiveShadow = true;
  group.add(bushLower);

  const bushUpper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.48, 0.85, 8),
    mats.foliageGreen
  );
  bushUpper.position.y = 1.65;
  bushUpper.castShadow = true;
  group.add(bushUpper);

  return group;
}

/**
 * Reference Image 2 Sidewalk Prop: Chunky Beveled Salmon-Orange Street Bench on Stone Legs
 */
export function createStreetBenchProp(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'StreetBench';

  // Solid Wooden Seat Plank + Beveled Top Cushion
  const seatBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.22, 0.96),
    mats.benchSalmonWood
  );
  seatBase.position.y = 0.52;
  seatBase.castShadow = true;
  seatBase.receiveShadow = true;
  group.add(seatBase);

  const seatTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.26, 0.08, 0.84),
    mats.benchSalmonWood
  );
  seatTop.position.y = 0.65;
  seatTop.castShadow = true;
  group.add(seatTop);

  [-0.78, 0.78].forEach((lx) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, 0.76),
      mats.benchStoneLeg
    );
    leg.position.set(lx, 0.21, 0);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  });

  return group;
}

/**
 * Reference Image 2 Sidewalk Prop: Bright Red Low-Poly Fire Hydrant
 */
export function createFireHydrantProp(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'FireHydrant';

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 0.22, 8),
    mats.hydrantRed
  );
  base.position.y = 0.11;
  base.castShadow = true;
  group.add(base);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.62, 8),
    mats.hydrantRed
  );
  body.position.y = 0.52;
  body.castShadow = true;
  group.add(body);

  const nozzles = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.58, 8).rotateZ(Math.PI / 2),
    mats.hydrantRed
  );
  nozzles.position.y = 0.62;
  nozzles.castShadow = true;
  group.add(nozzles);

  const dome = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 1),
    mats.hydrantRed
  );
  dome.position.y = 0.84;
  dome.castShadow = true;
  group.add(dome);

  const topNut = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    mats.rowhouseCorniceWhite
  );
  topNut.position.y = 1.06;
  group.add(topNut);

  return group;
}

export function createHidingLockerModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    mats.contactShadowMat
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.15, 1.4),
    mats.buildingRoofDark
  );
  base.position.y = 0.08;
  group.add(base);

  const pillarPositions: [number, number][] = [
    [-0.58, -0.58],
    [0.58, -0.58],
    [-0.58, 0.58],
    [0.58, 0.58],
  ];
  pillarPositions.forEach(([px, pz]) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.3, 0.14),
      mats.hidingLockerTeal
    );
    post.position.set(px, 1.25, pz);
    post.castShadow = true;
    group.add(post);
  });

  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 1.85, 0.08),
    mats.carGlass
  );
  backPanel.position.set(0, 1.22, -0.58);
  group.add(backPanel);

  const dome = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.28, 1.5),
    mats.hidingLockerTeal
  );
  dome.position.y = 2.48;
  dome.castShadow = true;
  group.add(dome);

  const ringGeo = new THREE.RingGeometry(0.85, 1.02, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, mats.missionCyan);
  ring.position.y = 0.04;
  group.add(ring);

  return group;
}

export function createCafeParasolSet(
  mats: MaterialLibrary,
  awningMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  const tableTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.1, 8),
    mats.rowhouseCorniceWhite
  );
  tableTop.position.y = 0.82;
  tableTop.castShadow = true;
  group.add(tableTop);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 2.75, 6),
    mats.metalFence
  );
  pole.position.y = 1.38;
  pole.castShadow = true;
  group.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 2.15, 0.78, 8),
    awningMat
  );
  canopy.position.y = 2.68;
  canopy.castShadow = true;
  group.add(canopy);

  return group;
}

export function createStreetLampModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 0.6, 6),
    mats.metalFence
  );
  base.position.y = 0.3;
  base.castShadow = true;
  group.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.11, 5.2, 6),
    mats.metalFence
  );
  pole.position.y = 2.9;
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.09, 0.09),
    mats.metalFence
  );
  arm.position.set(0.5, 5.4, 0);
  group.add(arm);

  const bulb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    mats.streetLampWarm
  );
  bulb.position.set(0.98, 5.15, 0);
  group.add(bulb);

  return group;
}

export function createMissionItemMesh(
  mats: MaterialLibrary,
  _id: string
): THREE.Group {
  const group = new THREE.Group();

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.65, 0.3, 6),
    mats.buildingRoofDark
  );
  pedestal.position.y = 0.15;
  pedestal.castShadow = true;
  group.add(pedestal);

  const coreGroup = new THREE.Group();
  coreGroup.position.y = 1.15;
  coreGroup.name = 'floatingCore';

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    mats.missionCyan
  );
  crystal.scale.set(0.85, 1.35, 0.85);
  crystal.castShadow = true;
  coreGroup.add(crystal);

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.04, 6, 12),
    mats.brassGold
  );
  outerRing.rotation.x = Math.PI / 3;
  coreGroup.add(outerRing);

  group.add(coreGroup);

  const ringGeo = new THREE.RingGeometry(0.88, 1.1, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, mats.missionCyan);
  ring.position.y = 0.05;
  group.add(ring);

  return group;
}

export function createStreetSnackMesh(
  _mats: MaterialLibrary,
  kind: 'bread' | 'banana'
): THREE.Group {
  const group = new THREE.Group();

  const padRingGeo = new THREE.RingGeometry(0.55, 0.76, 20);
  padRingGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshBasicMaterial({
    color: kind === 'banana' ? 0xfacc15 : 0xf97316,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const padRing = new THREE.Mesh(padRingGeo, padMat);
  padRing.position.y = 0.05;
  group.add(padRing);

  const floatingFood = new THREE.Group();
  floatingFood.position.y = 0.85;
  floatingFood.name = 'snackCore';

  if (kind === 'bread') {
    const breadCrustMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      emissive: new THREE.Color(0x92400e),
      emissiveIntensity: 0.25,
      flatShading: true,
    });
    const breadInnerMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.55,
      flatShading: true,
    });

    const centerSeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.28, 7).rotateZ(Math.PI / 2),
      breadCrustMat
    );
    centerSeg.castShadow = true;
    floatingFood.add(centerSeg);

    const endL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.17, 0.26, 7).rotateZ(Math.PI * 0.62),
      breadCrustMat
    );
    endL.position.set(-0.22, -0.05, 0.04);
    const endR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.17, 0.26, 7).rotateZ(-Math.PI * 0.62),
      breadCrustMat
    );
    endR.position.set(0.22, -0.05, 0.04);
    floatingFood.add(endL, endR);

    [-0.08, 0, 0.08].forEach((sx) => {
      const score = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.06, 0.28),
        breadInnerMat
      );
      score.position.set(sx, 0.16, 0);
      score.rotation.y = 0.25;
      floatingFood.add(score);
    });
  } else {
    const bananaYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.32,
      emissive: new THREE.Color(0xca8a04),
      emissiveIntensity: 0.3,
      flatShading: true,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.7,
      flatShading: true,
    });

    const buildSingleBanana = (zOff: number, rotZ: number) => {
      const bGroup = new THREE.Group();
      const seg1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, 0.24, 6).rotateZ(Math.PI / 2),
        bananaYellowMat
      );
      seg1.position.set(0, -0.04, zOff);
      const segL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.075, 0.2, 6).rotateZ(Math.PI * 0.35),
        bananaYellowMat
      );
      segL.position.set(-0.18, 0.04, zOff);
      const segR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.075, 0.2, 6).rotateZ(-Math.PI * 0.35),
        bananaYellowMat
      );
      segR.position.set(0.18, 0.04, zOff);
      bGroup.add(seg1, segL, segR);
      bGroup.rotation.z = rotZ;
      return bGroup;
    };

    floatingFood.add(buildSingleBanana(-0.05, 0.08));
    floatingFood.add(buildSingleBanana(0.05, -0.05));

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6),
      stemMat
    );
    stem.position.set(-0.27, 0.16, 0);
    stem.rotation.z = 0.55;
    floatingFood.add(stem);
  }

  group.add(floatingFood);
  return group;
}

/**
 * Creates a 3D mesh for throwable items on the street (Stone or Alloy Wrench)
 */
export function createStreetThrowableMesh(
  _mats: MaterialLibrary,
  kind: 'stone' | 'wrench',
  isPickupOnGround = true
): THREE.Group {
  const group = new THREE.Group();

  if (isPickupOnGround) {
    const padRingGeo = new THREE.RingGeometry(0.5, 0.72, 20);
    padRingGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshBasicMaterial({
      color: kind === 'stone' ? 0xa8a29e : 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const padRing = new THREE.Mesh(padRingGeo, padMat);
    padRing.position.y = 0.05;
    group.add(padRing);
  }

  const core = new THREE.Group();
  core.position.y = isPickupOnGround ? 0.68 : 0;
  core.name = 'throwableCore';

  if (kind === 'stone') {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xa8a29e,
      roughness: 0.75,
      metalness: 0.08,
      emissive: new THREE.Color(0x44403c),
      emissiveIntensity: 0.25,
      flatShading: true,
    });
    const highlightRockMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.65,
      flatShading: true,
    });

    const mainRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.24, 0),
      rockMat
    );
    mainRock.scale.set(1.18, 0.88, 1.05);
    mainRock.castShadow = true;
    core.add(mainRock);

    const subRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14, 0),
      highlightRockMat
    );
    subRock.position.set(0.14, 0.08, 0.09);
    subRock.castShadow = true;
    core.add(subRock);
  } else {
    // Heavy Alloy Wrench
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.28,
      metalness: 0.65,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.22,
      flatShading: true,
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.45,
      flatShading: true,
    });

    // Wrench handle
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.07, 0.11),
      steelMat
    );
    shaft.castShadow = true;
    core.add(shaft);

    const redGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.085, 0.13),
      gripMat
    );
    redGrip.position.set(-0.08, 0, 0);
    core.add(redGrip);

    // U-shaped wrench head jaws (right side)
    const jawBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.08, 6),
      steelMat
    );
    jawBase.position.set(0.24, 0, 0);
    core.add(jawBase);

    const jawTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.06),
      steelMat
    );
    jawTop.position.set(0.32, 0, -0.09);
    const jawBot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.06),
      steelMat
    );
    jawBot.position.set(0.32, 0, 0.09);
    core.add(jawTop, jawBot);

    core.rotation.z = 0.45;
  }

  group.add(core);
  return group;
}

// ============================================================================
// STAGE 2: COASTAL SEASIDE TOWN 3D ARCHITECTURE & PROPS (海边小镇场景专用建模)
// ============================================================================

/**
 * Mediterranean / Seaside Whitewashed & Azure Roof Coastal Villa / Surf Shop
 */
export function createCoastalBuildingMesh(
  mats: MaterialLibrary,
  width: number,
  height: number,
  depth: number,
  roofColorHex: number = 0x0284c7,
  options: {
    hasStorefront?: boolean;
    hasDome?: boolean;
    wallColorHex?: number;
  } = {}
): THREE.Group {
  const group = new THREE.Group();

  const stuccoWallMat = new THREE.MeshStandardMaterial({
    color: options.wallColorHex ?? 0xf8fafc,
    roughness: 0.72,
    metalness: 0.02,
    flatShading: true,
  });
  const seaBlueMat = new THREE.MeshStandardMaterial({
    color: roofColorHex,
    roughness: 0.48,
    metalness: 0.08,
    flatShading: true,
  });
  const woodDeckMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.68,
    flatShading: true,
  });

  // 1. Main Stucco Villa Body (2-story coastal proportions)
  const coastalH = Math.min(height * 0.78, 9.2);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, coastalH, depth),
    stuccoWallMat
  );
  body.position.y = coastalH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Coastal Azure Wave Trim Baseboard & Roof Parapet
  const baseTrim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.18, 0.65, depth + 0.18),
    seaBlueMat
  );
  baseTrim.position.y = 0.32;
  group.add(baseTrim);

  const roofRim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.36, 0.48, depth + 0.36),
    seaBlueMat
  );
  roofRim.position.y = coastalH + 0.22;
  roofRim.castShadow = true;
  group.add(roofRim);

  // Optional Santorini-style Azure Roof Dome or Sun Terrace Pergola
  if (options.hasDome) {
    const domeDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.26, width * 0.28, 1.1, 10),
      stuccoWallMat
    );
    domeDrum.position.set(0, coastalH + 0.75, 0);
    const domeCap = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      seaBlueMat
    );
    domeCap.position.set(0, coastalH + 1.25, 0);
    domeCap.castShadow = true;
    group.add(domeDrum, domeCap);
  } else {
    // Rooftop Wooden Pergola & Sun Deck
    for (let px = -width * 0.35; px <= width * 0.35; px += width * 0.35) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.2, depth * 0.75),
        woodDeckMat
      );
      beam.position.set(px, coastalH + 1.35, 0);
      group.add(beam);
    }
  }

  // Front & Back Nautical Porthole Windows, Shutters, Lifebuoys & Surfboards
  const addSeasideFacade = (zDir: 1 | -1) => {
    const zFace = (depth / 2) * zDir;
    const cols = Math.max(2, Math.round(width / 3.4));
    const colStep = width / (cols + 0.5);
    const startX = -((cols - 1) * colStep) / 2;

    // Upper floor nautical arched/shuttered windows
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * colStep;
      const winY = coastalH * 0.66;

      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 0.14, 10).rotateX(Math.PI / 2),
        mats.carGlass
      );
      glass.position.set(wx, winY, zFace + zDir * 0.05);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.1, 6, 12),
        seaBlueMat
      );
      ring.position.set(wx, winY, zFace + zDir * 0.1);
      group.add(glass, ring);

      // Balcony flower box / wooden rail
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.25, 0.32),
        woodDeckMat
      );
      rail.position.set(wx, winY - 0.9, zFace + zDir * 0.16);
      group.add(rail);
    }

    // Ground floor Tiki / Surf Shop Awning & Surfboards
    if (options.hasStorefront) {
      const awningW = width * 0.88;
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(awningW, 0.18, 2.1),
        seaBlueMat
      );
      canopy.position.set(0, 3.1, zFace + zDir * 0.95);
      canopy.rotation.x = zDir * 0.28;
      canopy.castShadow = true;
      group.add(canopy);

      // Decorative Red & White Lifebuoy Ring mounted on wall
      const buoyTorus = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.13, 8, 12),
        mats.sirenRed
      );
      buoyTorus.position.set(width * 0.3, 1.9, zFace + zDir * 0.12);
      group.add(buoyTorus);

      // Colorful Surfboard leaning against the storefront
      const surfboard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8),
        mats.sportsCarYellow
      );
      surfboard.scale.set(1.3, 1.0, 0.25);
      surfboard.position.set(-width * 0.32, 1.1, zFace + zDir * 0.32);
      surfboard.rotation.z = -0.15;
      surfboard.rotation.x = -zDir * 0.18;
      surfboard.castShadow = true;
      group.add(surfboard);
    }

    // Arched Wooden Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.4, 0.18),
      woodDeckMat
    );
    door.position.set(0, 1.2, zFace + zDir * 0.08);
    group.add(door);
  };

  addSeasideFacade(1);
  addSeasideFacade(-1);

  return group;
}

/**
 * Tall Tropical Coconut Palm Tree with Bush Cover at Base (海边椰子树与沙生灌木掩体)
 */
export function createPalmTreeProp(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CoastalPalmTree';

  const sandMoundMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.85,
    flatShading: true,
  });
  const palmBarkMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.82,
    flatShading: true,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.55,
    flatShading: true,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.7,
    flatShading: true,
  });

  // Base sandy mound + tropical bush ring (for player stealth hiding!)
  const sandMound = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.55, 0.28, 10),
    sandMoundMat
  );
  sandMound.position.y = 0.14;
  group.add(sandMound);

  // Tropical fern bush cluster at base
  for (let i = 0; i < 5; i++) {
    const ang = (i * Math.PI * 2) / 5;
    const fern = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      frondMat
    );
    fern.scale.set(1.15, 0.85, 1.15);
    fern.position.set(Math.cos(ang) * 0.55, 0.58, Math.sin(ang) * 0.55);
    fern.castShadow = true;
    group.add(fern);
  }

  // Segmented Curved Palm Trunk (6 stacked slightly curving segments)
  let curX = 0;
  let curY = 0.2;
  for (let s = 0; s < 6; s++) {
    const segH = 0.85;
    const rBot = 0.28 - s * 0.022;
    const rTop = 0.25 - s * 0.022;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, segH, 7),
      palmBarkMat
    );
    const tilt = s * 0.055;
    curX += Math.sin(tilt) * segH * 0.45;
    curY += segH * 0.92;
    seg.position.set(curX, curY - segH / 2, 0);
    seg.rotation.z = -tilt;
    seg.castShadow = true;
    group.add(seg);
  }

  // Crown of Coconuts & 7 Radiating Palm Fronds
  const crownPos = new THREE.Vector3(curX + 0.15, curY, 0);
  for (let c = 0; c < 3; c++) {
    const a = (c * Math.PI * 2) / 3;
    const nut = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18, 0),
      coconutMat
    );
    nut.position.set(
      crownPos.x + Math.cos(a) * 0.22,
      crownPos.y - 0.12,
      crownPos.z + Math.sin(a) * 0.22
    );
    group.add(nut);
  }

  for (let f = 0; f < 7; f++) {
    const fGroup = new THREE.Group();
    fGroup.position.copy(crownPos);
    fGroup.rotation.y = (f * Math.PI * 2) / 7;

    const leafInner = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.08, 1.45),
      frondMat
    );
    leafInner.position.set(0, 0.12, 0.72);
    leafInner.rotation.x = -0.22;
    leafInner.castShadow = true;

    const leafOuter = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.06, 1.25),
      frondMat
    );
    leafOuter.position.set(0, -0.12, 1.85);
    leafOuter.rotation.x = 0.38;
    leafOuter.castShadow = true;

    fGroup.add(leafInner, leafOuter);
    group.add(fGroup);
  }

  return group;
}

/**
 * Iconic Red-and-White Striped Coastal Lighthouse Landmark (海边大灯塔地标)
 */
export function createLighthouseLandmark(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CoastalLighthouse';

  const redStripeMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.55,
    flatShading: true,
  });
  const whiteStripeMat = mats.rowhouseCorniceWhite;

  // Rock base
  const rockBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.1, 1.2, 9),
    mats.curbStone
  );
  rockBase.position.y = 0.6;
  rockBase.castShadow = true;
  group.add(rockBase);

  // 5 Alternating Red & White Tapered Tower Bands
  for (let i = 0; i < 5; i++) {
    const rBot = 2.1 - i * 0.18;
    const rTop = 2.1 - (i + 1) * 0.18;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 2.2, 10),
      i % 2 === 0 ? whiteStripeMat : redStripeMat
    );
    band.position.y = 1.2 + i * 2.2 + 1.1;
    band.castShadow = true;
    group.add(band);
  }

  // Observation Deck Balcony
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.45, 0.45, 12),
    mats.buildingRoofDark
  );
  gallery.position.y = 12.3;
  group.add(gallery);

  // Lantern Glass Room + Rotating Light Beam Group
  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10),
    mats.streetLampWarm
  );
  lanternGlass.position.y = 13.3;
  group.add(lanternGlass);

  const domeRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.45, 1.6, 10),
    redStripeMat
  );
  domeRoof.position.y = 14.8;
  domeRoof.castShadow = true;
  group.add(domeRoof);

  return group;
}

/**
 * Seaside Striped Beach Changing Cabana (海边冲浪换衣木屋掩体)
 */
export function createBeachCabanaHidingModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const stripeBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.55,
    flatShading: true,
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 1.5),
    mats.benchSalmonWood
  );
  base.position.y = 0.09;
  group.add(base);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 2.2, 1.32),
    mats.rowhouseCorniceWhite
  );
  cabin.position.y = 1.2;
  cabin.castShadow = true;
  group.add(cabin);

  // Vertical blue coastal stripes
  [-0.4, 0, 0.4].forEach((sx) => {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.22, 1.36),
      stripeBlueMat
    );
    stripe.position.set(sx, 1.2, 0);
    group.add(stripe);
  });

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.18, 0.95, 4),
    stripeBlueMat
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.75;
  roof.castShadow = true;
  group.add(roof);

  const ringGeo = new THREE.RingGeometry(0.88, 1.05, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, mats.missionCyan);
  ring.position.y = 0.04;
  group.add(ring);

  return group;
}

// ============================================================================
// STAGE 3: COUNTRYSIDE VILLAGE 3D ARCHITECTURE & PROPS (乡村古镇场景专用建模)
// ============================================================================

/**
 * Timber-Framed Countryside Cottage & Farmhouse with Pitched Gable Roof & Brick Chimney
 */
export function createCountrysideCottageMesh(
  mats: MaterialLibrary,
  width: number,
  height: number,
  depth: number,
  wallColorHex: number = 0xfef3c7,
  roofColorHex: number = 0x9a3412
): THREE.Group {
  const group = new THREE.Group();

  const plasterWallMat = new THREE.MeshStandardMaterial({
    color: wallColorHex,
    roughness: 0.78,
    flatShading: true,
  });
  const timberBeamMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.85,
    flatShading: true,
  });
  const roofTileMat = new THREE.MeshStandardMaterial({
    color: roofColorHex,
    roughness: 0.65,
    flatShading: true,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.75,
    flatShading: true,
  });

  const wallH = Math.min(height * 0.62, 7.2);

  // 1. Stone Foundation Plinth
  const stonePlinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.25, 0.75, depth + 0.25),
    mats.curbStone
  );
  stonePlinth.position.y = 0.375;
  stonePlinth.castShadow = true;
  group.add(stonePlinth);

  // 2. Main Cottage Wall Body
  const wallBody = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallH, depth),
    plasterWallMat
  );
  wallBody.position.y = wallH / 2 + 0.4;
  wallBody.castShadow = true;
  wallBody.receiveShadow = true;
  group.add(wallBody);

  // 3. Exposed Timber Frame Beams (Horizontal & Vertical Half-Timbering)
  [-0.5, 0, 0.5].forEach((fx) => {
    const vPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, wallH, depth + 0.14),
      timberBeamMat
    );
    vPost.position.set(fx * (width - 0.2), wallH / 2 + 0.4, 0);
    group.add(vPost);
  });

  [wallH * 0.52, wallH + 0.35].forEach((hy) => {
    const hBeam = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.16, 0.24, depth + 0.16),
      timberBeamMat
    );
    hBeam.position.y = hy;
    group.add(hBeam);
  });

  // 4. Pitched Overhanging Gable Roof (Dual Sloped Roof Planes + Gable Triangles)
  const roofOverhangW = width + 1.1;
  const slopeLen = Math.hypot(depth * 0.58, 2.8);
  const slopeAngle = Math.atan2(2.6, depth * 0.54);

  [-1, 1].forEach((zSide) => {
    const roofSlope = new THREE.Mesh(
      new THREE.BoxGeometry(roofOverhangW, 0.32, slopeLen),
      roofTileMat
    );
    roofSlope.position.set(0, wallH + 1.55, zSide * (depth * 0.27));
    roofSlope.rotation.x = zSide * slopeAngle;
    roofSlope.castShadow = true;
    roofSlope.receiveShadow = true;
    group.add(roofSlope);
  });

  // Ridge beam at top peak
  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(roofOverhangW + 0.2, 0.36, 0.4),
    timberBeamMat
  );
  ridgeBeam.position.set(0, wallH + 2.82, 0);
  group.add(ridgeBeam);

  // 5. Tall Red-Brick Country Chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 3.8, 1.1),
    brickMat
  );
  chimney.position.set(width * 0.3, wallH + 2.1, -depth * 0.18);
  chimney.castShadow = true;
  group.add(chimney);

  // 6. Warm Glowing Cottage Windows & Stacked Firewood Logs on Front/Back
  [-1, 1].forEach((zDir) => {
    const zFace = (depth / 2) * zDir;
    const cols = Math.max(2, Math.round(width / 3.6));
    const step = width / (cols + 0.5);
    const startX = -((cols - 1) * step) / 2;

    for (let c = 0; c < cols; c++) {
      const wx = startX + c * step;
      const winPane = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.35, 0.16),
        mats.shopWindowWarm
      );
      winPane.position.set(wx, wallH * 0.68, zFace + zDir * 0.06);
      const winFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 1.55, 0.12),
        timberBeamMat
      );
      winFrame.position.set(wx, wallH * 0.68, zFace + zDir * 0.04);
      group.add(winFrame, winPane);
    }

    // Rustic Barn/Cottage Wooden Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.35, 0.2),
      timberBeamMat
    );
    door.position.set(0, 1.35, zFace + zDir * 0.08);
    group.add(door);
  });

  return group;
}

/**
 * Iconic Countryside Windmill Tower with Rotating Sails (乡村旋转大风车地标)
 */
export function createWindmillLandmark(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CountrysideWindmill';

  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.8,
    flatShading: true,
  });
  const sailClothMat = mats.rowhouseCorniceWhite;

  // Stone base
  const stoneBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.9, 2.2, 8),
    mats.curbStone
  );
  stoneBase.position.y = 1.1;
  stoneBase.castShadow = true;
  group.add(stoneBase);

  // Octagonal Wooden Windmill Tower
  const towerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 2.45, 7.6, 8),
    timberMat
  );
  towerBody.position.y = 5.9;
  towerBody.castShadow = true;
  group.add(towerBody);

  // Domed Windmill Cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1.72, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
    mats.buildingRoofDark
  );
  cap.position.y = 9.6;
  cap.castShadow = true;
  group.add(cap);

  // Rotating 4-Blade Sail Rotor (named 'windmillRotor' so animate() spins it!)
  const rotorGroup = new THREE.Group();
  rotorGroup.name = 'windmillRotor';
  rotorGroup.position.set(0, 9.2, 1.85);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8).rotateX(Math.PI / 2),
    timberMat
  );
  rotorGroup.add(hub);

  for (let b = 0; b < 4; b++) {
    const bladeGroup = new THREE.Group();
    bladeGroup.rotation.z = (b * Math.PI) / 2;

    const spar = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 4.6, 0.14),
      timberMat
    );
    spar.position.y = 2.3;
    spar.castShadow = true;

    const sail = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 3.6, 0.06),
      sailClothMat
    );
    sail.position.set(0.52, 2.55, 0.04);
    sail.castShadow = true;

    bladeGroup.add(spar, sail);
    rotorGroup.add(bladeGroup);
  }

  group.add(rotorGroup);
  return group;
}

/**
 * Golden Countryside Haystack Bales (乡村金黄大干草垛掩体 - 可蹲伏隐蔽)
 */
export function createHaystackBushProp(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CountrysideHaystack';

  const hayMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.88,
    flatShading: true,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.8,
    flatShading: true,
  });

  // Main cylindrical rolled hay bale + stacked hay mound
  const bale1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 1.35, 10).rotateZ(Math.PI / 2),
    hayMat
  );
  bale1.position.set(-0.2, 0.72, 0);
  bale1.castShadow = true;
  bale1.receiveShadow = true;
  group.add(bale1);

  const bale2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.85, 1.45, 9),
    hayMat
  );
  bale2.position.set(0.45, 0.72, 0.25);
  bale2.castShadow = true;
  group.add(bale2);

  const hayCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 0.75, 9),
    hayMat
  );
  hayCap.position.set(0.45, 1.75, 0.25);
  hayCap.castShadow = true;
  group.add(hayCap);

  // Binding ropes
  [-0.5, 0.1].forEach((rx) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.74, 0.74, 0.08, 10).rotateZ(Math.PI / 2),
      ropeMat
    );
    band.position.set(rx, 0.72, 0);
    group.add(band);
  });

  return group;
}

/**
 * Countryside Wooden Split-Rail Fence & Oak Barrels Prop (乡村木栅栏与木酒桶)
 */
export function createCountryFenceAndBarrelsProp(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.82,
    flatShading: true,
  });

  [-1.05, 1.05].forEach((px) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 1.15, 6),
      woodMat
    );
    post.position.set(px, 0.57, 0);
    post.castShadow = true;
    group.add(post);
  });

  [0.42, 0.84].forEach((ry) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.12, 0.1),
      woodMat
    );
    rail.position.set(0, ry, 0);
    rail.castShadow = true;
    group.add(rail);
  });

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.82, 8),
    mats.benchSalmonWood
  );
  barrel.position.set(0.65, 0.41, 0.38);
  barrel.castShadow = true;
  group.add(barrel);

  return group;
}

/**
 * Countryside Rustic Barn Sentry Shed (乡村木质谷仓掩体亭)
 */
export function createCountryShedHidingModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const barnRedMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.72,
    flatShading: true,
  });
  const woodTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.7,
    flatShading: true,
  });

  const shedBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.25, 1.4),
    barnRedMat
  );
  shedBody.position.y = 1.15;
  shedBody.castShadow = true;
  group.add(shedBody);

  // White X-brace barn door trim
  const brace1 = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.1, 1.44),
    woodTrimMat
  );
  brace1.position.y = 1.15;
  brace1.rotation.z = 0.72;
  const brace2 = brace1.clone();
  brace2.rotation.z = -0.72;
  group.add(brace1, brace2);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.22, 1.0, 4),
    mats.buildingRoofDark
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.75;
  roof.castShadow = true;
  group.add(roof);

  const ringGeo = new THREE.RingGeometry(0.88, 1.05, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, mats.missionCyan);
  ring.position.y = 0.04;
  group.add(ring);

  return group;
}


