import React, { useState } from 'react';
import { PLAYSTYLE_MODES, PlaystyleModeId } from '../core/Config';

interface BlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMode: PlaystyleModeId;
  onSelectMode: (mode: PlaystyleModeId) => void;
}

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  isOpen,
  onClose,
  selectedMode,
  onSelectMode,
}) => {
  const [activeTab, setActiveTab] = useState<'loop' | 'map' | 'ai' | 'roadmap'>('loop');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/92 p-4 md:p-8 pointer-events-auto">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#111827] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              《OUT OF SIGHT · 视线之外》可交互策划案与实时参数控制台
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Three.js + TypeScript · 风格化低多边形 (Stylized Low Poly) · 160×160m 封闭街区实时运行中
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            返回游戏场景
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#0b0f19] border-b border-slate-800 overflow-x-auto">
          {[
            { id: 'loop', label: '01. 核心循环与流派切换' },
            { id: 'map', label: '02. 160×160m 街区分区与色彩规范' },
            { id: 'ai', label: '03. 巡逻车与双 NPC 状态机' },
            { id: 'roadmap', label: '04. 五阶段开发架构与防作弊准则' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed">
          {activeTab === 'loop' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-2">
                  双层核心游戏循环 (已实装至当前 3D 引擎)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="text-xs font-semibold text-emerald-400 mb-1">
                      潜行主循环 (常态)
                    </div>
                    <p className="text-xs text-slate-300">
                      观察巡逻路线 → 规划过街路线 → 移动推进 → 利用掩体/储物柜躲藏 → 等待搜索结束 → 收集 3 件目标物 → 抵达东南撤离点保持 4 秒
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="text-xs font-semibold text-amber-400 mb-1">
                      暴露应急循环 (警戒触发)
                    </div>
                    <p className="text-xs text-slate-300">
                      视线/声响暴露 → 警戒值升级 → 拐入建筑盲区切断射线 → 执法员调查最后已知位置 (LKP) → 摆脱追捕恢复行动
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-white mb-2">
                  第十八章：实时切换第一版核心体验流派 (点击立即生效)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(Object.keys(PLAYSTYLE_MODES) as PlaystyleModeId[]).map((modeKey) => {
                    const m = PLAYSTYLE_MODES[modeKey];
                    const active = selectedMode === modeKey;
                    return (
                      <button
                        key={m.id}
                        onClick={() => onSelectMode(m.id)}
                        className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-500/10 border-amber-400 text-white'
                            : 'bg-[#0b0f19] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white">{m.name}</span>
                          <span className="text-xs font-mono-tabular text-amber-400">
                            {active ? '当前使用中' : '点击切换'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{m.subtitle}</div>
                        <p className="text-xs text-slate-300 mt-2">{m.description}</p>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-3 text-[11px] font-mono-tabular text-slate-400">
                          <span>行走 {m.walkSpeed}m/s</span>
                          <span>·</span>
                          <span>奔跑 {m.runSpeed}m/s</span>
                          <span>·</span>
                          <span>视野 {m.normalVisionRange}m</span>
                          <span>·</span>
                          <span>确认 {m.confirmTimeSec}s</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-2">
                  六大封闭街区分区与固定任务分布 (1 世界单位 = 1 米)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="font-semibold text-white">A. 主干道 & 环路</div>
                    <p className="text-slate-400 mt-1">
                      视野开阔，执法巡逻车沿主干道循环行驶并在四大路口减速停靠观察，过街需精准判断时机。
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="font-semibold text-teal-300">B. 西北住宅区 (任务物 1: 通行卡)</div>
                    <p className="text-slate-400 mt-1">
                      4 栋多层住宅密集排列，设有庭院矮墙、胡同通道与储物柜，难度低，适合熟悉视线遮挡。
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="font-semibold text-emerald-300">C. 东北城市公园</div>
                    <p className="text-slate-400 mt-1">
                      InstancedMesh 低多边形树林与深绿灌木丛。蹲伏于灌木中可显著缩短 NPC 有效发现距离。
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="font-semibold text-amber-300">D. 西侧停车场 (任务物 3: 电池)</div>
                    <p className="text-slate-400 mt-1">
                      停放多辆静态车辆与水泥护栏，执法车高频在此路口停靠部署搜索员，高风险核心区。
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="font-semibold text-cyan-300">E. 西南物流仓库 (任务物 2: 档案)</div>
                    <p className="text-slate-400 mt-1">
                      具备南北与东侧多个出入口的室内外一体结构，内部整齐排列货架与木箱通道。
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-800">
                    <div className="font-semibold text-emerald-400">F. 中央广场与东南撤离点</div>
                    <p className="text-slate-400 mt-1">
                      集齐 3 件物品后解锁东南撤离信标，进入绿环区域并安全保持 4 秒即可成功撤离。
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-white mb-2">
                  第三章：Stylized Low Poly 色彩与视觉识别规范
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {[
                    { name: '地面与人行道', hex: '#b4bbc5', desc: '暖灰/浅灰 · 保持画面清晰' },
                    { name: '柏油主干道', hex: '#2c333e', desc: '深灰 · 区分巡逻车通行区' },
                    { name: '街区建筑群', hex: '#d8d2c5', desc: '米白/灰蓝/浅棕 · 视线阻断体' },
                    { name: '公园低饱和植被', hex: '#4b7757', desc: '低饱和绿 · 提供自然掩护' },
                    { name: '执法巡逻车', hex: '#162b4d', desc: '深蓝+白+红蓝爆闪灯' },
                    { name: '玩家角色点缀', hex: '#f59e0b', desc: '战术橙背心 · 易辨认无突兀描边' },
                    { name: '任务目标物', hex: '#2dd4bf', desc: '青绿色高光 · 强化目标指引' },
                    { name: '撤离信标区', hex: '#10b981', desc: '翠绿信标环 · 撤离倒计时区' },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="p-2.5 rounded-lg bg-[#0b0f19] border border-slate-800 flex items-start gap-2.5"
                    >
                      <span
                        className="w-4 h-4 rounded shrink-0 mt-0.5 border border-white/20"
                        style={{ backgroundColor: item.hex }}
                      />
                      <div>
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#0b0f19] border border-slate-800">
                  <h4 className="font-semibold text-white mb-1.5">
                    第七章：执法巡逻车 7 态状态机
                  </h4>
                  <p className="text-xs text-slate-400 mb-2">
                    Patrol (巡航) → SlowDown (接近路口减速) → Stop (停车观察) → Deploy (搜索员B下车) → Search (协同搜索) → Return (登车) → Resume (恢复巡逻)
                  </p>
                  <p className="text-xs text-slate-300">
                    巡逻车是整局游戏节奏的节拍器。当全局警戒 ≥ 50 或观察员 A 通报异常时，巡逻车会主动减速并部署搜索员 B 前往最后已知位置 (LKP)。
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#0b0f19] border border-slate-800">
                  <h4 className="font-semibold text-white mb-1.5">
                    第八章：双执法员职责分工与公平感知
                  </h4>
                  <p className="text-xs text-slate-300 mb-1.5">
                    <strong>执法员 A (观察者)：</strong>巡视主干道与中央广场，发现异常后将玩家最后已知坐标 (橙色地面圆环) 共享给执法员 B。
                  </p>
                  <p className="text-xs text-slate-300">
                    <strong>执法员 B (搜索者)：</strong>随车机动，接令后下车前往可疑坐标并依次排查附近预设搜索点，绝不作弊获取玩家实时隐藏位置。
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#0b0f19] border border-slate-800">
                <h4 className="font-semibold text-white mb-2">
                  第五章 & 第九章：三重躲藏机制与真实射线遮挡 (THREE.Raycaster)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-amber-400 font-semibold">1. 真实射线遮挡：</span>
                    <p className="text-slate-400 mt-0.5">
                      从 NPC 眼部 (1.6m) 向玩家发射射线。玩家站立目标高度为 1.42m，蹲伏时降至 0.75m —— 因此在 1.2m 矮墙或货箱后蹲伏可真正阻断 NPC 视线！
                    </p>
                  </div>
                  <div>
                    <span className="text-teal-400 font-semibold">2. 交互式躲藏点 [E]：</span>
                    <p className="text-slate-400 mt-0.5">
                      地图分布 6 处蓝色储物柜/隐蔽箱，靠近按 E 进入完全隐蔽状态，按 E 随时钻出。
                    </p>
                  </div>
                  <div>
                    <span className="text-emerald-400 font-semibold">3. 声音传播感知：</span>
                    <p className="text-slate-400 mt-0.5">
                      奔跑 (Shift) 会产生较大声波半径，若 NPC 处于听觉范围内，将前往声源位置开展调查。
                    </p>
                  </div>
                </div>
              </div>

              {/* 核心最新策划机制：参保直通车、路面监控仪与防合体战术系统 */}
              <div className="p-4 rounded-lg bg-[#0b0f19] border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white">
                  新增升级：防合体战术包抄、路面监控仪与无限增援策划
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">🛡️ 保安防合体与 360° 环形战术包抄</span>
                    <p className="text-slate-400">
                      无论场上同时有多少名保安，均具备实时防挤压分离动力学 (保持 &ge; 1.35m 间距)，且追捕时按在场保安数量自动计算 360° 扇形包抄角，绝不合体重叠。
                    </p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-cyan-400 font-bold block mb-1">📡 参保车红外监控仪 (路面布设)</span>
                    <p className="text-slate-400">
                      参保直通车平稳巡逻 (3.4m/s 巡航 / 5.2m/s 警戒)，沿途布设红外扫描监控仪。若被监控仪扫描锁定，监控仪报警后立即自毁移除，并立即从参保车下放一名新保安。
                    </p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 col-span-1 md:col-span-2">
                    <span className="text-rose-400 font-bold block mb-1">🚨 保安人数不限总数 · 动态无限增援与独立搜查寿命策划</span>
                    <p className="text-slate-400">
                      只要被参保车视野或路面监控仪发现，参保车就会源源不断下放新的特勤保安（不限总数）！同时每位下放保安拥有独立的 22 秒地面搜查期：期间若再次看到玩家则重置延长搜捕；若玩家通过潜行躲藏 22 秒未被发现，该保安将自动返回参保车归队，兼顾刺激感与潜行博弈空间。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white">
                第十五章：五阶段开发演进状态 (当前已全部集成实现)
              </h3>
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    stage: '阶段一：灰盒原型',
                    desc: 'Three.js 场景、第三人称阻尼相机、WASD 角色移动、160×160m 街区碰撞与巡逻车路径行驶。',
                  },
                  {
                    stage: '阶段二：核心潜行机制',
                    desc: '三重条件视线检测 (距离+角度+Raycaster遮挡)、全局与个体警戒值、蹲伏、储物柜躲藏与 LKP 搜索。',
                  },
                  {
                    stage: '阶段三：完整任务流程',
                    desc: '通行卡/档案/电池 3 件目标物收集、撤离点 4 秒驻留判定、倒计时、主菜单/暂停/胜负结算闭环。',
                  },
                  {
                    stage: '阶段四：Stylized Low Poly 视觉与声效升级',
                    desc: '多部件组合模型 (3~10部件 Group)、PBR 车漆与透射车窗、红蓝爆闪警示灯、Web Audio 合成音效。',
                  },
                  {
                    stage: '阶段五：游戏体验优化',
                    desc: 'Canvas 2D 实时战术小地图、4 套节奏流派一键切换、零 GC 渲染循环优化。',
                  },
                ].map((s) => (
                  <div
                    key={s.stage}
                    className="p-3 rounded-lg bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="font-semibold text-amber-400">{s.stage}</span>
                      <p className="text-slate-300 mt-0.5">{s.desc}</p>
                    </div>
                    <span className="text-emerald-400 font-mono-tabular shrink-0">已实装</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
