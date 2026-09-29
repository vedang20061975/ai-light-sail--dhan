import React from 'react';
import { Timeframe } from '../types';
import { Clock, Terminal, Flame, Lock } from 'lucide-react';

interface TimeframeTabsProps {
  activeTab: Timeframe | 'LOGS';
  onSelectTab: (tab: Timeframe | 'LOGS') => void;
  tabCounts: Record<Timeframe, number>;
  isAdminUnlocked?: boolean;
  onOpenLockModal?: (targetName: string) => void;
}

export const TimeframeTabs: React.FC<TimeframeTabsProps> = ({
  activeTab,
  onSelectTab,
  tabCounts,
  isAdminUnlocked = false,
  onOpenLockModal,
}) => {
  const timeframes: { id: Timeframe; label: string; desc: string }[] = [
    { id: '30M', label: '30M', desc: '30 Min Timeframe' },
    { id: '10M', label: '10M', desc: '10 Min Timeframe' },
    { id: '5M', label: '5M', desc: '5 Min Timeframe' },
    { id: '1M', label: '1M', desc: '1 Min Timeframe' },
  ];

  const handleLogsClick = () => {
    if (isAdminUnlocked) {
      onSelectTab('LOGS');
    } else if (onOpenLockModal) {
      onOpenLockModal('Client System Logs');
    } else {
      onSelectTab('LOGS');
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-2 min-w-max">
          {timeframes.map((tf) => {
            const isActive = activeTab === tf.id;
            const count = tabCounts[tf.id] || 0;

            return (
              <button
                key={tf.id}
                onClick={() => onSelectTab(tf.id)}
                className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Clock className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                <span>{tf.label}</span>

                {count > 0 && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="h-6 w-px bg-slate-200 mx-2" />

          {/* Client Logs Tab */}
          <button
            onClick={handleLogsClick}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'LOGS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
            title={isAdminUnlocked ? "View Client System Logs" : "Protected: Admin PIN required to view system logs"}
          >
            <Terminal className={`w-4 h-4 ${activeTab === 'LOGS' ? 'text-white' : 'text-indigo-600'}`} />
            <span>Client_Logs</span>
            {!isAdminUnlocked && (
              <Lock className="w-3 h-3 text-slate-400 ml-1" />
            )}
          </button>
        </div>

        <div className="hidden md:flex items-center space-x-2 text-xs text-slate-600 pl-4">
          <Flame className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
          <span>Scanning for BB Maximum Contraction → Expansion + Volume Surge</span>
        </div>
      </div>
    </div>
  );
};
