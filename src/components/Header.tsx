import React from 'react';
import { RefreshCw, FileSpreadsheet, Key, Play, Power, Activity, CheckCircle2, AlertCircle, ExternalLink, Lock, Unlock, Users, User, LogOut, LogIn, Clock, Bell, Volume2, VolumeX, Settings } from 'lucide-react';
import { DhanConfig, SheetConfig, Timeframe, UserAccount } from '../types';

interface HeaderProps {
  activeTimeframe: Timeframe | 'LOGS';
  dhanConfig: DhanConfig;
  sheetConfig: SheetConfig;
  isScanning: boolean;
  isAdminUnlocked: boolean;
  currentUser: UserAccount | null;
  onRunScan: () => void;
  onSyncCurrentTab: () => void;
  onSyncAllTabs: () => void;
  onOpenDhanModal: () => void;
  onOpenSheetModal: () => void;
  onOpenLockModal: (targetName: string) => void;
  onOpenUsersModal: () => void;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  onToggleLock: () => void;
  autoRefreshCountdown: number;
  scanInterval: number;
  onScanIntervalChange: (intervalSec: number) => void;
  onToggleAutoScan: () => void;
  unreadAlertCount: number;
  isAlertSoundEnabled: boolean;
  onToggleAlertSound: () => void;
  onOpenAlertHistory: () => void;
  onOpenAlertSettings: () => void;
  isDhanSyncing?: boolean;
  onSyncLiveTrading?: () => void;
  targetRule?: 'STRICT_1_2' | 'QUICK_SCALP';
  onToggleTargetRule?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTimeframe,
  dhanConfig,
  sheetConfig,
  isScanning,
  isAdminUnlocked,
  currentUser,
  onRunScan,
  onSyncCurrentTab,
  onSyncAllTabs,
  onOpenDhanModal,
  onOpenSheetModal,
  onOpenLockModal,
  onOpenUsersModal,
  onOpenLoginModal,
  onLogout,
  onToggleLock,
  autoRefreshCountdown,
  scanInterval,
  onScanIntervalChange,
  onToggleAutoScan,
  unreadAlertCount,
  isAlertSoundEnabled,
  onToggleAlertSound,
  onOpenAlertHistory,
  onOpenAlertSettings,
  isDhanSyncing = false,
  onSyncLiveTrading,
  targetRule = 'STRICT_1_2',
  onToggleTargetRule,
}) => {
  const handleDhanClick = () => {
    if (isAdminUnlocked) {
      onOpenDhanModal();
    } else {
      onOpenLockModal('Dhan API');
    }
  };

  const handleSheetClick = () => {
    if (isAdminUnlocked) {
      onOpenSheetModal();
    } else {
      onOpenLockModal('Google Sheets');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-emerald-600/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  TRENDFLUX
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Real-time Scanner
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600">
                <span className="text-emerald-700 font-semibold italic">“Read the Move. Find the Opportunity.”</span>
              </p>
            </div>
          </div>

          {/* Status Indicators & Control Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* User Account & Login / Logout Controls */}
            {currentUser ? (
              <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
                <span className="px-2 py-0.5 font-semibold text-slate-800 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[110px]">{currentUser.fullName}</span>
                  <span className="text-[10px] px-1.5 py-0.2 uppercase rounded font-bold bg-slate-200 text-slate-600">
                    {currentUser.role}
                  </span>
                </span>
                
                {/* Admin Manage Users (Up to 100) */}
                {(currentUser.role === 'admin' || isAdminUnlocked) && (
                  <button
                    onClick={onOpenUsersModal}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md transition-all shadow-sm"
                    title="Manage Users (Add up to 100 users, set passwords)"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Manage Users</span>
                  </button>
                )}

                <button
                  onClick={onLogout}
                  className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign In</span>
              </button>
            )}

            {/* Admin Security Lock Button */}
            <button
              onClick={onToggleLock}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isAdminUnlocked
                  ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200 shadow-sm'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title={isAdminUnlocked ? "Admin Mode Active - Click to Lock Settings" : "Settings Locked for Published App - Click to Unlock"}
            >
              {isAdminUnlocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Admin Mode</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Protected</span>
                </>
              )}
            </button>

            {/* Dhan API Status & Google Sheets Buttons (ADMIN ONLY) */}
            {(currentUser?.role === 'admin' || isAdminUnlocked) && (
              <>
                <button
                  onClick={handleDhanClick}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    dhanConfig.isConnected
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  }`}
                  title={isAdminUnlocked ? "Click to configure Dhan API credentials" : "Protected: Click to view status / unlock"}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Dhan API:</span>
                  <span className="font-semibold uppercase">
                    {dhanConfig.isConnected ? 'Live HQ' : 'Disconnected'}
                  </span>
                  {dhanConfig.isConnected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleSheetClick}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition-all"
                  title={isAdminUnlocked ? "Click to manage Google Sheets Sync" : "Protected: Click to view status / unlock"}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sheets:</span>
                  <span className="font-mono text-slate-700 truncate max-w-[100px]">
                    {currentUser?.role === 'admin' ? `${sheetConfig.spreadsheetId.slice(0, 8)}...` : 'Protected'}
                  </span>
                  {sheetConfig.isSyncing && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 ml-0.5" />
                  )}
                </button>
              </>
            )}

            {/* Alert System Controls: Bell Feed Button + Quick Sound Toggle + Rules Settings */}
            <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200 rounded-lg p-1 text-xs">
              <button
                onClick={onOpenAlertHistory}
                className="relative flex items-center space-x-1.5 px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-xs"
                title="View Live Breakout Alerts Feed"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Alerts</span>
                {unreadAlertCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white font-extrabold text-[10px] rounded-full animate-pulse">
                    {unreadAlertCount}
                  </span>
                )}
              </button>

              <button
                onClick={onToggleAlertSound}
                className={`p-1.5 rounded transition-colors ${
                  isAlertSoundEnabled
                    ? 'text-emerald-700 hover:bg-amber-100 bg-white border border-amber-200'
                    : 'text-slate-400 hover:bg-slate-200 bg-slate-100'
                }`}
                title={isAlertSoundEnabled ? "Alert Sound ON (Click to Mute)" : "Alert Sound MUTED (Click to Enable)"}
              >
                {isAlertSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Alert Settings Gear (ADMIN ONLY) */}
              {(currentUser?.role === 'admin' || isAdminUnlocked) && (
                <button
                  onClick={onOpenAlertSettings}
                  className="p-1.5 rounded text-slate-700 hover:bg-amber-100 bg-white border border-amber-200 transition-colors"
                  title="Alert System Rules & Timeframes Settings (Admin Only)"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Consolidated Auto-Scan Interval Controller & Actions */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl p-1.5 text-xs shadow-inner pointer-events-auto" style={{ pointerEvents: 'auto' }}>
              
              {/* Interval Dropdown Label & Selector */}
              <div className="flex items-center space-x-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-xs">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-slate-700 hidden sm:inline">Interval:</span>
                <select
                  value={scanInterval}
                  onChange={(e) => onScanIntervalChange(Number(e.target.value))}
                  className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer"
                  title="Select Auto Scan Refresh Interval"
                >
                  <optgroup label="High-frequency" className="text-emerald-700 font-semibold">
                    <option value={1}>⚡ 1 Sec</option>
                    <option value={2}>⚡ 2 Sec</option>
                    <option value={3}>⚡ 3 Sec</option>
                    <option value={5}>⚡ 5 Sec</option>
                    <option value={10}>⚡ 10 Sec</option>
                    <option value={15}>⚡ 15 Sec</option>
                    <option value={20}>⚡ 20 Sec</option>
                    <option value={30}>⚡ 30 Sec</option>
                  </optgroup>
                  <optgroup label="Standard" className="text-slate-700 font-semibold">
                    <option value={45}>45 Sec</option>
                    <option value={60}>1 Min (60s)</option>
                    <option value={120}>2 Min (120s)</option>
                    <option value={300}>5 Min</option>
                    <option value={600}>10 Min</option>
                    <option value={0}>Manual (Off)</option>
                  </optgroup>
                </select>
              </div>

              {/* Countdown/Timer badge */}
              <div className={`px-2 py-1 font-mono font-bold rounded-lg text-xs min-w-[54px] text-center shadow-xs border ${
                scanInterval > 0
                  ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
                  : 'text-slate-500 bg-slate-100 border-slate-200'
              }`} title="Scan Countdown">
                {scanInterval > 0 ? `${autoRefreshCountdown}s` : 'Off sec'}
              </div>

              {/* Status tag */}
              <span className={`px-2 py-1 text-[11px] font-extrabold rounded-lg border flex items-center gap-1.5 uppercase tracking-wider ${
                scanInterval > 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`} title="Scanner Status">
                <span className={`w-2 h-2 rounded-full ${scanInterval > 0 ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                {scanInterval > 0 ? 'ACTIVE' : 'PAUSED'}
              </span>

              {/* Toggle Button */}
              <button
                type="button"
                onClick={onToggleAutoScan}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 pointer-events-auto ${
                  scanInterval > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white' // toggled: PAUSE / OFF
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white' // start
                }`}
                title={scanInterval > 0 ? "Pause auto-scanning" : "Start auto-scanning"}
                style={{ pointerEvents: 'auto' }}
              >
                {scanInterval > 0 ? (
                  <>
                    <span>⏸ PAUSE / OFF</span>
                  </>
                ) : (
                  <>
                    <span>▶ START</span>
                  </>
                )}
              </button>

              {/* Instant Action Button */}
              <button
                onClick={onRunScan}
                disabled={isScanning}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all disabled:opacity-50 cursor-pointer pointer-events-auto hover:scale-[1.02] active:scale-95"
                title="Trigger immediate scan cycle / Active continuous scanner"
                style={{ pointerEvents: 'auto' }}
              >
                <span className={(scanInterval > 0 || isScanning) ? 'animate-spin inline-block' : ''}>🔄</span>
                <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
              </button>

              {/* Target Mode Toggle Rule Button */}
              {onToggleTargetRule && (
                <button
                  type="button"
                  onClick={onToggleTargetRule}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-extrabold text-xs border shadow-sm transition-all cursor-pointer pointer-events-auto hover:scale-[1.02] active:scale-95 shrink-0 whitespace-nowrap ${
                    targetRule === 'QUICK_SCALP'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
                  }`}
                  title={targetRule === 'QUICK_SCALP' ? 'Current: Quick Scalp Mode. Click to switch to Strict 1:2 R:R' : 'Current: Strict 1:2 R:R. Click to switch to Quick Scalp'}
                  style={{ pointerEvents: 'auto' }}
                >
                  <span className="shrink-0">{targetRule === 'QUICK_SCALP' ? '⚡ Scalp Mode (Quick %)' : '🎯 Strict 1:2 R:R'}</span>
                </button>
              )}

              {/* Action Button: Sync LIVE_TRADING */}
              <button
                type="button"
                onClick={onSyncLiveTrading || onSyncAllTabs}
                disabled={isDhanSyncing}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-50 cursor-pointer pointer-events-auto hover:scale-[1.02] active:scale-95 shrink-0 min-w-[155px] whitespace-nowrap"
                title="Actively fetch live positions, real-time P&L, and orders directly from Dhan HQ"
                style={{ pointerEvents: 'auto' }}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white shrink-0 ${isDhanSyncing ? 'animate-spin' : ''}`} />
                <span className="truncate">{isDhanSyncing ? 'Syncing Dhan...' : 'Sync LIVE_TRADING'}</span>
              </button>

            </div>

            {/* External Direct Link to Google Sheet */}
            {isAdminUnlocked ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetConfig.spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors border border-emerald-300 flex items-center space-x-1"
                title="Open Google Sheet in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <button
                onClick={() => onOpenLockModal('Google Sheet Direct Link')}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-800 transition-colors border border-slate-200 flex items-center space-x-1"
                title="Google Sheet Link is Protected for Admin. Click to Unlock."
              >
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

          </div>
        </div>
      </div>
    </header>
  );
};

