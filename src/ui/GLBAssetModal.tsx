import React, { useEffect, useState } from 'react';
import { GLBAssetMetadata, glbAssetRegistry } from '../world/GLBAssetManager';

interface GLBAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomGLBUploaded: (assetId: string) => void;
}

export const GLBAssetModal: React.FC<GLBAssetModalProps> = ({
  isOpen,
  onClose,
  onCustomGLBUploaded,
}) => {
  const [assets, setAssets] = useState<GLBAssetMetadata[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAssets(glbAssetRegistry.getAllAssets());
    const unsub = glbAssetRegistry.subscribe(() => {
      setAssets(glbAssetRegistry.getAllAssets());
    });
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (
    assetId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStatusMsg(`正在通过 GLTFLoader 解析并热替换 ${file.name} ...`);
      const updated = await glbAssetRegistry.uploadCustomGLB(assetId, file);
      if (updated) {
        setStatusMsg(
          `✅ 已成功通过 GLTFLoader 加载自定义模型 ${updated.fileName} (${(
            updated.byteLength / 1024
          ).toFixed(1)} KB)`
        );
        onCustomGLBUploaded(assetId);
      }
    } catch (err) {
      setStatusMsg(
        `❌ GLB 解析失败，请确认上传的是标准 Binary GLTF 2.0 (.glb) 文件。`
      );
    }
  };

  const formatKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

  const categoryLabels: Record<string, string> = {
    character: '角色 GLB (参考图1风格 · 低多边形 Chibi 角色)',
    vehicle: '载具 GLB (参保直通车 & 参考图2同款明黄轿跑)',
    environment: '街景环境 GLB (参考图2风格 · 欧式彩色联排商业楼与街景道具)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/92 p-4 md:p-8 pointer-events-auto">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#111827] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
              📦 GLB 3D 资产管线与 Three.js 引擎架构控制台
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              主要环境与角色采用标准 Binary GLTF 2.0 (.glb) 管线 (GLTFLoader / GLTFExporter)，Three.js 驱动游戏逻辑 + AI + 摄像机 + 灯光 + 物理 + UI
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            返回游戏
          </button>
        </div>

        {/* Architecture Banner */}
        <div className="px-6 py-3 bg-[#0b0f19] border-b border-slate-800 grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
          {[
            { title: '1. GLB 资产层', desc: 'GLTFLoader 实时解析' },
            { title: '2. 游戏逻辑', desc: '参保计费/能量道具/撤离' },
            { title: '3. AI 状态机', desc: '扇形视野/断追保护/电台' },
            { title: '4. 摄像机系统', desc: '弹簧阻尼跟拍+特写运镜' },
            { title: '5. 灯光与阴影', desc: '暖阳+紫罗兰风格化阴影' },
            { title: '6. 物理与 UI', desc: 'AABB 碰撞+射线遮挡' },
          ].map((item) => (
            <div
              key={item.title}
              className="p-2 rounded bg-[#161f33] border border-slate-800"
            >
              <div className="font-bold text-amber-400">{item.title}</div>
              <div className="text-slate-300 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>

        {statusMsg && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-teal-950/90 border border-teal-500/60 text-teal-200 text-xs font-semibold">
            {statusMsg}
          </div>
        )}

        {/* Asset List */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {(['character', 'vehicle', 'environment'] as const).map((cat) => {
            const list = assets.filter((a) => a.category === cat);
            return (
              <div key={cat} className="space-y-2.5">
                <h3 className="text-sm font-bold text-amber-300 border-b border-slate-800 pb-1.5">
                  {categoryLabels[cat]}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white text-xs">
                            {asset.label}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono-tabular font-semibold ${
                              asset.isCustomUploaded
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {asset.isCustomUploaded ? '自定义 GLB' : '内置 GLB 已加载'}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono-tabular text-slate-400">
                          <span>文件: {asset.fileName}</span>
                          <span>·</span>
                          <span>体积: {formatKB(asset.byteLength)}</span>
                          <span>·</span>
                          <span>面数: {asset.triangleCount} Tris</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => glbAssetRegistry.downloadGLB(asset.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer text-center"
                        >
                          📥 导出 .GLB (可在 Blender 打开)
                        </button>
                        <label className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-semibold transition-colors cursor-pointer text-center">
                          📂 替换外部 .GLB
                          <input
                            type="file"
                            accept=".glb,.gltf"
                            className="hidden"
                            onChange={(e) => handleFileChange(asset.id, e)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
