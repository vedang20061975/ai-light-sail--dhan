import React, { useState } from 'react';
import { X, Bell, Trash2, CheckCheck, TrendingUp, TrendingDown, Zap, BarChart2, ExternalLink, Clock } from 'lucide-react';
import { TriggeredAlertItem, Timeframe, StockScanItem } from '../types';

interface AlertHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: TriggeredAlertItem[];
  onMarkAllRead: () => void;
  onClearAll?: () => void;
  onClearHistory?: () => void;
  onDeleteAlert?: (alert: TriggeredAlertItem) => void;
  onSelectStock: (stock: StockScanItem) => void;
}

export const AlertHistoryDrawer: React.FC<AlertHistoryDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  onMarkAllRead,
  onClearAll,
  onClearHistory,
  onDeleteAlert,
  onSelectStock
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe | 'ALL'>('ALL');

  if (!isOpen) return null;

  const handleClear = () => {
    const clearFn = onClearAll || onClearHistory;
    if (selectedTimeframe === 'ALL') {
      if (clearFn) clearFn();
    } else {
      if (onDeleteAlert) {
        const toDelete = alerts.filter(a => a.timeframe === selectedTimeframe);
        if (toDelete.length > 0) {
          toDelete.forEach(a => onDeleteAlert(a));
        } else if (clearFn) {
          clearFn();
        }
      } else if (clearFn) {
        clearFn();
      }
    }
  };

  const filteredAlerts = alerts.filter(item => {
    if (selectedTimeframe !== 'ALL' && item.timeframe !== selectedTimeframe) {
      return false;
    }
    return true;
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="relative">
              <Bell className="w-5 h-5 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">Live Breakout Alerts Feed</h3>
              <p className="text-[11px] text-slate-400">All Timeframes (30M, 10M, 5M, 1M)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeframe Filter Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1 overflow-x-auto">
          <div className="flex items-center space-x-1">
            {(['ALL', '30M', '10M', '5M', '1M'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200 bg-white border border-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center space-x-1">
              <button
                onClick={onMarkAllRead}
                className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4 text-emerald-600" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Clear alerts"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Market Schedule Banner */}
        <div className="bg-amber-50/90 px-4 py-2 border-b border-amber-200/80 text-[11px] text-amber-900 flex items-center space-x-2 shrink-0">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>NSE Schedule:</strong> Alerts automatically reset strictly at <strong>09:00 AM IST</strong> every morning. All breakout stocks triggered from 09:00 AM to 09:00 AM next day are retained in this feed.
          </span>
        </div>

        {/* Alert Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {filteredAlerts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Bell className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-sm font-medium">No alerts triggered for timeframe {selectedTimeframe}</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Alerts will appear instantly when stocks hit your configured breakout or volume conditions across 30M, 10M, 5M, or 1M.
              </p>
            </div>
          ) : (
            filteredAlerts.map(alert => {
              const isBullish = alert.signalType === 'BULLISH_CROSS' || alert.priceChangePercent >= 0;
              
              // Convert alert to StockScanItem to view in chart
              const dummyStockItem: StockScanItem = {
                id: alert.id,
                stock: alert.stock,
                companyName: alert.companyName,
                currentPrice: alert.price,
                aiKnnLine: alert.price * 0.99,
                averageLine: alert.price * 0.985,
                status: alert.message,
                timestamp: alert.triggeredAt,
                timeframe: alert.timeframe,
                bbUpper: alert.price * 1.01,
                bbLower: alert.price * 0.99,
                bbMiddle: alert.price,
                bandwidth: alert.bandwidth,
                prevBandwidth: alert.bandwidth * 0.8,
                volume: 500000,
                avgVolume: 250000,
                volumeRatio: alert.volumeRatio,
                knnSignal: isBullish ? 'BULLISH_CROSS' : 'BEARISH_EXPANSION',
                priceChangePercent: alert.priceChangePercent,
                rsi: alert.rsi ?? 55,
                adx: alert.adx ?? 25,
                macdSignal: (alert.macdSignal as any) ?? 'NEUTRAL'
              };

              return (
                <div
                  key={alert.id}
                  onClick={() => onSelectStock(dummyStockItem)}
                  className={`pt-3 first:pt-0 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                    !alert.read
                      ? isBullish
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : 'bg-rose-50/60 border-rose-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-sm text-slate-900">{alert.stock}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded bg-slate-900 text-white">
                        {alert.timeframe}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        isBullish ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {alert.signalType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-400 font-mono">{alert.triggeredAt}</span>
                      {onDeleteAlert && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAlert(alert);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete alert and remove stock from dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 font-medium">{alert.companyName}</p>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="font-bold text-slate-900">₹{(alert.price ?? 0).toFixed(2)}</span>
                      <span className={`font-semibold flex items-center ${isBullish ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isBullish ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                        {(alert.priceChangePercent ?? 0) > 0 ? '+' : ''}{(alert.priceChangePercent ?? 0).toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        Vol: {(alert.volumeRatio ?? 0).toFixed(1)}x
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
          Click any alert card to view interactive stock chart & technical indicators
        </div>

      </div>
    </div>
  );
};
