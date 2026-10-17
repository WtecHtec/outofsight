import React, { useEffect, useRef } from 'react';
import { EXTRACTION_POINT, MAP_ZONES } from '../core/Config';
import {
  ColliderBox,
  MissionObject,
  SnackObject,
  ThrowableObject,
} from '../world/WorldBuilder';

export interface MinimapSnapshot {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  carX: number;
  carZ: number;
  carYaw: number;
  carSeesPlayer?: boolean;
  carVisionRange?: number;
  officers: {
    id: string;
    x: number;
    z: number;
    yaw: number;
    inVehicle: boolean;
    state: string;
  }[];
  missions: MissionObject[];
  snacks?: SnackObject[];
  throwables?: ThrowableObject[];
  colliders: ColliderBox[];
  monitors?: { x: number; z: number }[];
  globalAlert: number;
  heartbeatIntensity?: number;
  heartbeatBpm?: number;
}

interface MinimapProps {
  snapshotRef: React.MutableRefObject<MinimapSnapshot>;
  expanded: boolean;
  onToggleExpand: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  snapshotRef,
  expanded,
  onToggleExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId = 0;

    const renderMap = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const snap = snapshotRef.current;

          const toPxX = (wx: number) => ((wx + 75) / 150) * w;
          const toPxY = (wz: number) => ((wz + 55) / 110) * h;

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, w, h);

          // Draw Street Zones
          const zoneColors = ['#a855f7', '#38bdf8', '#2dd4bf', '#f59e0b', '#f43f5e', '#10b981'];
          MAP_ZONES.forEach((z, idx) => {
            const x1 = toPxX(z.bounds.minX);
            const y1 = toPxY(z.bounds.minZ);
            const zw = toPxX(z.bounds.maxX) - x1;
            const zh = toPxY(z.bounds.maxZ) - y1;
            const cHex = zoneColors[idx % zoneColors.length];
            ctx.fillStyle = cHex + '18';
            ctx.fillRect(x1, y1, zw, zh);
            ctx.strokeStyle = cHex + '3d';
            ctx.lineWidth = 1;
            ctx.strokeRect(x1, y1, zw, zh);

            if (expanded) {
              ctx.fillStyle = '#cbd5e1';
              ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
              ctx.fillText(z.name, x1 + 6, y1 + 15);
            }
          });

          // Draw Central Commercial Street
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(toPxX(-74), toPxY(-7.5), (148 / 150) * w, (15 / 110) * h);

          // Draw Building Colliders
          ctx.fillStyle = '#475569';
          snap.colliders.forEach((c) => {
            if (c.height >= 2.0 && c.maxX - c.minX < 90 && c.maxZ - c.minZ < 90) {
              const bx = toPxX(c.minX);
              const by = toPxY(c.minZ);
              const bw = Math.max(2, toPxX(c.maxX) - bx);
              const bh = Math.max(2, toPxY(c.maxZ) - by);
              ctx.fillRect(bx, by, bw, bh);
            }
          });

          // Draw Subway Extraction Point
          const extX = toPxX(EXTRACTION_POINT.position[0]);
          const extY = toPxY(EXTRACTION_POINT.position[2]);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(extX, extY, expanded ? 10 : 5.5, 0, Math.PI * 2);
          ctx.stroke();

          // Draw Street Energy Snacks (Bread & Banana)
          if (snap.snacks) {
            snap.snacks.forEach((s) => {
              if (s.respawnTimer > 0) return;
              const sx = toPxX(s.spec.position[0]);
              const sy = toPxY(s.spec.position[2]);
              ctx.fillStyle = s.spec.kind === 'banana' ? '#facc15' : '#fb923c';
              ctx.beginPath();
              ctx.arc(sx, sy, expanded ? 4.2 : 2.6, 0, Math.PI * 2);
              ctx.fill();
            });
          }

          // Draw Street Throwables (Stones & Wrenches)
          if (snap.throwables) {
            snap.throwables.forEach((th) => {
              if (th.respawnTimer > 0) return;
              const tx = toPxX(th.spec.position[0]);
              const ty = toPxY(th.spec.position[2]);
              ctx.fillStyle = th.spec.kind === 'stone' ? '#d6d3d1' : '#38bdf8';
              ctx.fillRect(
                tx - (expanded ? 3.5 : 2),
                ty - (expanded ? 3.5 : 2),
                expanded ? 7 : 4,
                expanded ? 7 : 4
              );
            });
          }

          // Draw Mission Items
          snap.missions.forEach((m) => {
            if (m.collected) return;
            const mx = toPxX(m.spec.position[0]);
            const my = toPxY(m.spec.position[2]);
            ctx.fillStyle = '#2dd4bf';
            ctx.beginPath();
            ctx.arc(mx, my, expanded ? 6 : 3.8, 0, Math.PI * 2);
            ctx.fill();
          });

          // Draw Street Surveillance Monitors (Cyan Camera Warning Dots with Pulse)
          if (snap.monitors && snap.monitors.length > 0) {
            snap.monitors.forEach((mon) => {
              const mx = toPxX(mon.x);
              const my = toPxY(mon.z);
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath();
              ctx.arc(mx, my, expanded ? 4.5 : 2.8, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#0284c7';
              ctx.lineWidth = 1;
              ctx.stroke();
            });
          }

          // Draw Patrol Car ("参保直通车") Direction Detector & Forward Radar Cone
          const carPx = toPxX(snap.carX);
          const carPy = toPxY(snap.carZ);
          const visionRangeMeters = snap.carVisionRange || 30;
          const coneRadiusPx = (visionRangeMeters / 150) * w;
          const halfFovRad = (76 * Math.PI) / 360; // 38 deg half-angle

          ctx.save();
          ctx.translate(carPx, carPy);
          // In Three.js, yaw=0 faces +Z (down on canvas, which is +PI/2 in canvas arc angles),
          // and canvas rotation(-carYaw) maps local +Y (down) to world heading (sin(yaw), cos(yaw))
          ctx.rotate(-snap.carYaw);

          // 1. Forward Vision Sector Cone
          ctx.fillStyle = snap.carSeesPlayer
            ? 'rgba(239, 68, 68, 0.34)'
            : 'rgba(56, 189, 248, 0.22)';
          ctx.strokeStyle = snap.carSeesPlayer
            ? 'rgba(248, 113, 113, 0.85)'
            : 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = expanded ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(
            0,
            0,
            coneRadiusPx,
            Math.PI / 2 - halfFovRad,
            Math.PI / 2 + halfFovRad
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 2. Center Forward Direction Detector Ray & Arrowhead
          ctx.strokeStyle = snap.carSeesPlayer ? '#ef4444' : '#facc15';
          ctx.lineWidth = expanded ? 2.0 : 1.3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, coneRadiusPx * 0.82);
          ctx.stroke();

          const arrowTipY = coneRadiusPx * 0.86;
          ctx.fillStyle = snap.carSeesPlayer ? '#ef4444' : '#facc15';
          ctx.beginPath();
          ctx.moveTo(0, arrowTipY);
          ctx.lineTo(expanded ? -4.5 : -2.8, arrowTipY - (expanded ? 7 : 4.5));
          ctx.lineTo(expanded ? 4.5 : 2.8, arrowTipY - (expanded ? 7 : 4.5));
          ctx.closePath();
          ctx.fill();

          // 3. Patrol Car Chassis Box & Roof Beacon
          const carW = expanded ? 8 : 5;
          const carL = expanded ? 13 : 8;
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.2;
          ctx.fillRect(-carW / 2, -carL / 2, carW, carL);
          ctx.strokeRect(-carW / 2, -carL / 2, carW, carL);

          // Front bumper cyan/red direction bar
          ctx.fillStyle = snap.carSeesPlayer ? '#ef4444' : '#38bdf8';
          ctx.fillRect(-carW / 2, carL / 2 - (expanded ? 3 : 2), carW, expanded ? 3 : 2);
          ctx.restore();

          // Proximity Heartbeat Ripple around Player
          const hb = snap.heartbeatIntensity || 0;
          const px = toPxX(snap.playerX);
          const py = toPxY(snap.playerZ);

          if (hb > 0.02) {
            const pulseWave = 0.5 + 0.5 * Math.sin(performance.now() * 0.008 * (1 + hb * 2));

            ctx.strokeStyle = `rgba(244, 63, 94, ${(hb * 0.65 * pulseWave).toFixed(2)})`;
            ctx.lineWidth = expanded ? 2.5 : 1.8;
            ctx.beginPath();
            ctx.arc(px, py, (expanded ? 16 : 9) + pulseWave * (expanded ? 12 : 6), 0, Math.PI * 2);
            ctx.stroke();

            // Red border vignette on map canvas when threat is close
            ctx.strokeStyle = `rgba(239, 68, 68, ${(hb * 0.8).toFixed(2)})`;
            ctx.lineWidth = expanded ? 4 : 2.5;
            ctx.strokeRect(1, 1, w - 2, h - 2);
          }

          // Directional Compass Pointer from Player toward Patrol Car
          const angleToCar = Math.atan2(carPy - py, carPx - px);
          const compassOrbitR = expanded ? 16 : 10.5;
          const tipX = px + Math.cos(angleToCar) * (compassOrbitR + (expanded ? 4 : 3));
          const tipY = py + Math.sin(angleToCar) * (compassOrbitR + (expanded ? 4 : 3));
          const leftX = px + Math.cos(angleToCar - 0.35) * compassOrbitR;
          const leftY = py + Math.sin(angleToCar - 0.35) * compassOrbitR;
          const rightX = px + Math.cos(angleToCar + 0.35) * compassOrbitR;
          const rightY = py + Math.sin(angleToCar + 0.35) * compassOrbitR;

          ctx.fillStyle = snap.carSeesPlayer ? '#ef4444' : '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(leftX, leftY);
          ctx.lineTo(rightX, rightY);
          ctx.closePath();
          ctx.fill();

          // Draw Player Marker (Orange Arrow)
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(-snap.playerYaw);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(0, 6.5);
          ctx.lineTo(-4.5, -4.5);
          ctx.lineTo(4.5, -4.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#0b0f19';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }
      animId = requestAnimationFrame(renderMap);
    };

    animId = requestAnimationFrame(renderMap);
    return () => cancelAnimationFrame(animId);
  }, [expanded, snapshotRef]);

  return (
    <div
      className={`pointer-events-auto transition-transform duration-150 ${
        expanded
          ? 'fixed inset-0 z-40 flex items-center justify-center bg-[#0b0f19]/90 p-6'
          : 'relative'
      }`}
    >
      <div
        className={`bg-[#0b0f19]/82 backdrop-blur-md border border-slate-700/75 shadow-lg overflow-hidden ${
          expanded ? 'w-[540px] max-w-full rounded-xl p-4' : 'w-[172px] rounded-lg p-1.5'
        }`}
      >
        <div className="flex items-center justify-between mb-1 text-[10px] text-slate-300">
          <span className="font-semibold tracking-wide text-slate-200 truncate">
            街区导航与车向检测器
          </span>
          <button
            onClick={onToggleExpand}
            className="text-amber-400 hover:text-amber-300 font-mono-tabular text-[10px] cursor-pointer whitespace-nowrap shrink-0"
          >
            {expanded ? '[M] 关闭' : '[M] 放大'}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={expanded ? 508 : 160}
          height={expanded ? 370 : 112}
          className="w-full rounded border border-slate-800/90 block"
        />

        <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
          <span>橙标:我</span>
          <span>·</span>
          <span className="text-amber-300">黄车+蓝扇:参保车方向检测</span>
          {expanded && (
            <>
              <span>·</span>
              <span className="text-rose-400">保安隐匿(听心跳辨距)</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
