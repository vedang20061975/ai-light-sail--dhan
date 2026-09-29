import React, { useState } from 'react';
import { X, Check, ShieldAlert, Zap, Clock, DollarSign, Layers, Percent, Activity, FileText, Lock } from 'lucide-react';
import { AlertRuleConfig, Timeframe } from '../types';

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AlertRuleConfig;
  onSaveConfig: (newConfig: AlertRuleConfig) => void;
  onClearHistory: () => void;
  alertHistoryCount: number;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onClearHistory,
  alertHistoryCount
}) => {
  const [localConfig, setLocalConfig] = useState<AlertRuleConfig>(() => ({
    ...config,
    dhanLiveOrderEngine: config.dhanLiveOrderEngine ?? true,
    strictlyOnlyNSEHours: config.strictlyOnlyNSEHours ?? true,
    timeframes: config.timeframes || { '30M': true, '10M': true, '5M': true, '1M': false },
    freshnessWindow: config.freshnessWindow || { '30M': '5 Min', '10M': '1 Min', '5M': '1 Min', '1M': '45 Sec' },
    accountAllocationCapital: config.accountAllocationCapital ?? 5000,
    capitalPerTrade: config.capitalPerTrade ?? 1250,
    riskRewardRatio: config.riskRewardRatio || '1 : 2.0 Target (Recommended)',
    maxOpenPositions: config.maxOpenPositions ?? 4,
    useTechnicalBBMdleSL: config.useTechnicalBBMdleSL ?? true,
    quickProfitAutoExit: config.quickProfitAutoExit ?? 200,
    quickMaxLossAutoExit: config.quickMaxLossAutoExit ?? 200,
    enableSlippageEngine: config.enableSlippageEngine ?? true,
    bidAskSpreadPercent: config.bidAskSpreadPercent ?? 0.05,
    brokerSlippagePercent: config.brokerSlippagePercent ?? 0.05,
    autoDeductDhanTaxes: config.autoDeductDhanTaxes ?? true,
    telegram: config.telegram || {
      botToken: '',
      chatId: '',
      enabled: false,
      sendOnBullishCross: true,
      sendOnBearishExpansion: true,
      sendOnSqueezeRelease: true
    },
    signals: config.signals || {
      bullishCross: true,
      bearishExpansion: true,
      squeezeRelease: true,
      minVolumeRatio: 5.0,
      minPriceChangePercent: 0.3,
      minBandwidthExpansion: 10
    }
  }));

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig(localConfig);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const activeTimeframesList = (Object.keys(localConfig.timeframes) as Timeframe[])
    .filter(tf => localConfig.timeframes[tf])
    .join(', ') || 'None';

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden pointer-events-auto">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">⚙ ⚡</span>
            <h2 className="text-base font-extrabold tracking-wide uppercase text-slate-100">
              Dhan Live Trading Rules
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-lg font-bold p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal View */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs font-sans">

          {/* Relay Banner */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-[11px] text-emerald-300 font-mono">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Bridge Endpoint: http://15.252.191.43:3000/api/dhan-relay</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold text-[10px]">
              AWS Lightsail Active
            </span>
          </div>

          {/* SECTION 1: Execution Engines & Hours */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
              <span>⚡</span> 1. Execution Engines & Hours
            </h3>

            <div className="space-y-2.5 pt-1">
              {/* Checkbox 1: Dhan Live Order Engine */}
              <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                localConfig.dhanLiveOrderEngine ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={localConfig.dhanLiveOrderEngine ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, dhanLiveOrderEngine: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-emerald-400 flex items-center gap-1">
                    ⚡ Dhan Live Order Engine
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Auto-execute REAL orders on Dhan HQ when live scanner signals match rules.
                  </p>
                </div>
              </label>

              {/* Checkbox 2: Strictly Only in NSE Market Hours */}
              <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                localConfig.strictlyOnlyNSEHours ? 'bg-slate-900 border-slate-750 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={localConfig.strictlyOnlyNSEHours ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, strictlyOnlyNSEHours: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-200 flex items-center gap-1">
                    🕒 Strictly Only in NSE Market Hours
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Only trigger auto trades between 09:15 AM - 03:30 PM IST (Mon-Fri), checked by default.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 2: Live Trading Timeframes Selection */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
                <span>🕒</span> 2. Select Dhan Live Trading Timeframes
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-extrabold text-[10px]">
                Active: {activeTimeframesList}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Auto paper/live trades will execute ONLY for breakout signals on the checked timeframes below:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {(['30M', '10M', '5M', '1M'] as Timeframe[]).map((tf) => (
                <label
                  key={`tf-select-${tf}`}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 cursor-pointer font-extrabold text-xs transition-all ${
                    localConfig.timeframes[tf]
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={localConfig.timeframes[tf]}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      timeframes: { ...localConfig.timeframes, [tf]: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>{tf}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SECTION 3: Stock Selection Breakout Freshness Window (Momentum Protection) */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
                <span>⚡</span> 3. Stock Selection Breakout Freshness Window
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-extrabold text-[10px]">
                Momentum Protection
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Select max allowed time since breakout. Only stocks breaking out within this window are selected:
            </p>

            <div className="space-y-2.5 pt-1">
              {/* 30M Breakout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 gap-2">
                <span className="font-bold text-slate-300 text-xs shrink-0">30M Breakout:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['1 Min', '2 Min', '3 Min', '5 Min'].map((val) => (
                    <button
                      key={`fw-30m-${val}`}
                      type="button"
                      onClick={() => setLocalConfig({
                        ...localConfig,
                        freshnessWindow: { ...localConfig.freshnessWindow!, '30M': val }
                      })}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        localConfig.freshnessWindow?.['30M'] === val
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* 10M Breakout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 gap-2">
                <span className="font-bold text-slate-300 text-xs shrink-0">10M Breakout:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['30 Sec', '1 Min', '1.5 Min', '2 Min'].map((val) => (
                    <button
                      key={`fw-10m-${val}`}
                      type="button"
                      onClick={() => setLocalConfig({
                        ...localConfig,
                        freshnessWindow: { ...localConfig.freshnessWindow!, '10M': val }
                      })}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        localConfig.freshnessWindow?.['10M'] === val
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5M Breakout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 gap-2">
                <span className="font-bold text-slate-300 text-xs shrink-0">5M Breakout:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['10 Sec', '20 Sec', '30 Sec', '45 Sec', '1 Min'].map((val) => (
                    <button
                      key={`fw-5m-${val}`}
                      type="button"
                      onClick={() => setLocalConfig({
                        ...localConfig,
                        freshnessWindow: { ...localConfig.freshnessWindow!, '5M': val }
                      })}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        localConfig.freshnessWindow?.['5M'] === val
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1M Breakout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 gap-2">
                <span className="font-bold text-slate-300 text-xs shrink-0">1M Breakout:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['15 Sec', '30 Sec', '45 Sec', '1 Min'].map((val) => (
                    <button
                      key={`fw-1m-${val}`}
                      type="button"
                      onClick={() => setLocalConfig({
                        ...localConfig,
                        freshnessWindow: { ...localConfig.freshnessWindow!, '1M': val }
                      })}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        localConfig.freshnessWindow?.['1M'] === val
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Capital, Position & Risk Allocation */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
              <span>💰</span> 4. Capital, Position & Risk Allocation
            </h3>

            {/* Account Trade Allocation Capital */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Account Trade Allocation Capital (₹):
              </label>
              <input
                type="number"
                value={localConfig.accountAllocationCapital ?? 5000}
                onChange={(e) => setLocalConfig({ ...localConfig, accountAllocationCapital: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 font-mono font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '₹5k', val: 5000 },
                  { label: '₹10k', val: 10000 },
                  { label: '₹25k', val: 25000 },
                  { label: '₹50k', val: 50000 },
                  { label: '₹1L', val: 100000 },
                  { label: '₹2.5L', val: 250000 },
                  { label: '₹5L', val: 500000 }
                ].map((p) => (
                  <button
                    key={`ac-preset-${p.val}`}
                    type="button"
                    onClick={() => setLocalConfig({ ...localConfig, accountAllocationCapital: p.val })}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                      localConfig.accountAllocationCapital === p.val
                        ? 'bg-slate-800 text-white border-slate-700 font-extrabold'
                        : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Capital Per Trade */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Capital Per Trade (₹):
              </label>
              <input
                type="number"
                value={localConfig.capitalPerTrade ?? 1250}
                onChange={(e) => setLocalConfig({ ...localConfig, capitalPerTrade: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 font-mono font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '₹1.25k', val: 1250 },
                  { label: '₹2.5k', val: 2500 },
                  { label: '₹5k', val: 5000 },
                  { label: '₹10k', val: 10000 },
                  { label: '₹25k', val: 25000 },
                  { label: '₹50k', val: 50000 },
                  { label: '₹1L', val: 100000 }
                ].map((p) => (
                  <button
                    key={`cpt-preset-${p.val}`}
                    type="button"
                    onClick={() => setLocalConfig({ ...localConfig, capitalPerTrade: p.val })}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                      localConfig.capitalPerTrade === p.val
                        ? 'bg-slate-800 text-white border-slate-700 font-extrabold'
                        : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk to Reward Dropdown & Max Positions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Risk to Reward Ratio (1:X):
                </label>
                <select
                  value={localConfig.riskRewardRatio || '1 : 2.0 Target (Recommended)'}
                  onChange={(e) => setLocalConfig({ ...localConfig, riskRewardRatio: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="1 : 1.5 Target">1 : 1.5 Target</option>
                  <option value="1 : 2.0 Target (Recommended)">1 : 2.0 Target (Recommended)</option>
                  <option value="1 : 2.5 Target">1 : 2.5 Target</option>
                  <option value="1 : 3.0 Target">1 : 3.0 Target</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Max Open Positions:
                </label>
                <input
                  type="number"
                  value={localConfig.maxOpenPositions ?? 4}
                  onChange={(e) => setLocalConfig({ ...localConfig, maxOpenPositions: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 font-mono font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Checkbox: Use Technical Bollinger Middle Band for SL */}
            <div className="pt-2">
              <label className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.useTechnicalBBMdleSL ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, useTechnicalBBMdleSL: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-bold text-xs text-slate-200">
                  ☑ Use Technical Bollinger Middle Band for SL (Fallback to fixed %)
                </span>
              </label>
            </div>
          </div>

          {/* SECTION 5: Quick Profit & Max Loss Auto-Exit Rules */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
              <span>🎯</span> 5. Quick Profit & Max Loss Auto-Exit Rules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Left Box (Green): Quick Profit Auto-Exit */}
              <div className="bg-slate-900/90 border border-emerald-500/30 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-emerald-400 flex items-center gap-1">
                    🎯 Quick Profit Auto-Exit
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold text-[9px]">
                    Target ₹
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Auto close trade on profit (₹):
                </p>
                <div className="flex items-center space-x-1.5 pt-1">
                  {['OFF', 200, 500].map((opt) => (
                    <button
                      key={`qp-${opt}`}
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, quickProfitAutoExit: opt as any })}
                      className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        localConfig.quickProfitAutoExit === opt
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {opt === 'OFF' ? 'OFF' : `₹${opt}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Box (Red): Quick Max Loss Auto-Exit */}
              <div className="bg-slate-900/90 border border-rose-500/30 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-rose-400 flex items-center gap-1">
                    🛑 Quick Max Loss Auto-Exit
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-extrabold text-[9px]">
                    StopLoss ₹
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Auto close trade on loss (-₹):
                </p>
                <div className="flex items-center space-x-1.5 pt-1">
                  {['OFF', 200, 500].map((opt) => (
                    <button
                      key={`ql-${opt}`}
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, quickMaxLossAutoExit: opt as any })}
                      className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        localConfig.quickMaxLossAutoExit === opt
                          ? 'bg-rose-600 text-white border-rose-500 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {opt === 'OFF' ? 'OFF' : `₹${opt}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Allowed Auto-Entry Signals & Spread Slippage Engine */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
              <span>🏷️</span> 6. Allowed Auto-Entry Signals & Spread Slippage Engine
            </h3>

            {/* Checkboxes for allowed signals */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Allowed Entry Signal Types:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={localConfig.signals.bullishCross}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      signals: { ...localConfig.signals, bullishCross: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>☑ Bullish Cross</span>
                </label>

                <label className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={localConfig.signals.squeezeRelease}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      signals: { ...localConfig.signals, squeezeRelease: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>☑ Squeeze Release</span>
                </label>

                <label className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={localConfig.signals.bearishExpansion}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      signals: { ...localConfig.signals, bearishExpansion: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>☑ Bearish Expansion</span>
                </label>
              </div>
            </div>

            {/* Slippage Box */}
            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-200 flex items-center gap-1">
                  🏷️ Bid-Ask Spread & Slippage Engine (બિડ અને આસ્ક પ્રાઇઝ)
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-extrabold text-[9px]">
                  Real Market Fills
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Calculates realistic execution fills at Ask/Bid prices rather than raw LTP to account for live order book market depth.
              </p>

              <label className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center space-x-2.5 cursor-pointer text-xs font-bold text-slate-200">
                <input
                  type="checkbox"
                  checked={localConfig.enableSlippageEngine ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, enableSlippageEngine: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <span>☑ Enable Ask-Bid & Slippage Execution</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Bid-Ask Spread */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Bid-Ask Spread (%):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={localConfig.bidAskSpreadPercent ?? 0.05}
                    onChange={(e) => setLocalConfig({ ...localConfig, bidAskSpreadPercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
                  />
                  <div className="flex gap-1 pt-1">
                    {[0.02, 0.05, 0.1].map((v) => (
                      <button
                        key={`bas-${v}`}
                        type="button"
                        onClick={() => setLocalConfig({ ...localConfig, bidAskSpreadPercent: v })}
                        className={`flex-1 py-0.5 rounded text-[9px] font-bold border transition-all ${
                          localConfig.bidAskSpreadPercent === v
                            ? 'bg-slate-800 text-white border-slate-700 font-extrabold'
                            : 'bg-slate-950 text-slate-500 border-slate-850'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Broker Order Slippage */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Broker Order Slippage (%):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={localConfig.brokerSlippagePercent ?? 0.05}
                    onChange={(e) => setLocalConfig({ ...localConfig, brokerSlippagePercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
                  />
                  <div className="flex gap-1 pt-1">
                    {[0.02, 0.05, 0.1].map((v) => (
                      <button
                        key={`bos-${v}`}
                        type="button"
                        onClick={() => setLocalConfig({ ...localConfig, brokerSlippagePercent: v })}
                        className={`flex-1 py-0.5 rounded text-[9px] font-bold border transition-all ${
                          localConfig.brokerSlippagePercent === v
                            ? 'bg-slate-800 text-white border-slate-700 font-extrabold'
                            : 'bg-slate-950 text-slate-500 border-slate-850'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 7: Dhan Brokerage & Statutory Taxes Engine */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
                <span>📄</span> 7. Dhan Brokerage & Statutory Taxes Engine (ધન બ્રોકરેજ અને સરકારી ટેક્સ)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-extrabold text-[10px]">
                Official Dhan Rules
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>Exact Dhan Billing:</strong> Automatically deducts Intraday Brokerage (Min ₹20 or 0.03% per leg), STT (0.025% on sell), NSE Exchange Fee (0.00297%), Stamp Duty (0.003% on buy), SEBI Charges and GST 18% to present 100% accurate Net Profit.
            </p>

            <label className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-3 cursor-pointer text-xs font-bold text-slate-200">
              <input
                type="checkbox"
                checked={localConfig.autoDeductDhanTaxes ?? true}
                onChange={(e) => setLocalConfig({ ...localConfig, autoDeductDhanTaxes: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <span>☑ Auto Deduct Dhan Official Taxes & Brokerage</span>
            </label>
          </div>

        </div>

        {/* Fixed Footer Actions */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs rounded-xl font-black tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Saved Live Trading Rules!</span>
              </>
            ) : (
              <span>⚡ Save Rules</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
