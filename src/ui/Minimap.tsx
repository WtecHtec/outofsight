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

          // NOTE: Security Guards & Patrol Car ("参保直通车") are intentionally HIDDEN on the map!
          // Players must rely on 3D line-of-sight and the Proximity Heartbeat audio/pulse sensor!
          const hb = snap.heartbeatIntensity || 0;
          if (hb > 0.02) {
            const pulseWave = 0.5 + 0.5 * Math.sin(performance.now() * 0.008 * (1 + hb * 2));
            const px = toPxX(snap.playerX);
            const py = toPxY(snap.playerZ);

            // Omnidirectional heartbeat ripple around the player (no enemy direction/location revealed)
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

          // Draw Player Marker (Orange Arrow)
          const px = toPxX(snap.playerX);
          const py = toPxY(snap.playerZ);
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
            街区导航图 (盲区模式)
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
          <span>青点:材料</span>
          <span>·</span>
          <span>绿环:撤离</span>
          {expanded && (
            <>
              <span>·</span>
              <span className="text-rose-400">保安/车已隐藏(听心跳辨距)</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
