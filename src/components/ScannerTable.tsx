import React from 'react';
import { StockScanItem } from '../types';
import { LineChart, ArrowUpRight, ArrowDownRight, Flame, Zap, ShieldCheck, Trash2 } from 'lucide-react';

interface ScannerTableProps {
  items: StockScanItem[];
  onSelectStock: (stock: StockScanItem) => void;
  onDeleteStock?: (stock: StockScanItem) => void;
  isLoading: boolean;
}

const getIntervalMinutes = (timeframe?: string): string => {
  if (!timeframe) return '30';
  if (timeframe.includes('1M')) return '1';
  if (timeframe.includes('5M')) return '5';
  if (timeframe.includes('10M')) return '10';
  if (timeframe.includes('30M')) return '30';
  return '30';
};

// Formats timestamp to explicit HH:MM:SS format
function formatTimestampHHMMSS(timeStr: string): string {
  if (!timeStr) return '--:--:--';
  const str = timeStr.trim();
  
  // If already contains seconds (e.g. "09:15:23 AM" or "13:15:23")
  const hasSeconds = /^\d{1,2}:\d{2}:\d{2}/.test(str);
  if (hasSeconds) return str;

  // If time is "09:15 AM" or "9:15 PM" -> convert to "09:15:00 AM"
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    const hh = match12[1].padStart(2, '0');
    const mm = match12[2];
    const ampm = match12[3] ? ` ${match12[3].toUpperCase()}` : '';
    return `${hh}:${mm}:00${ampm}`;
  }

  return str;
}

export const ScannerTable: React.FC<ScannerTableProps> = ({
  items,
  onSelectStock,
  onDeleteStock,
  isLoading,
}) => {
  const [copiedStock, setCopiedStock] = React.useState<string | null>(null);

  const handleDhanClick = (stockSymbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(stockSymbol);
      setCopiedStock(stockSymbol);
      setTimeout(() => setCopiedStock(null), 5000);
    } catch {}
  };
  if (isLoading && items.length === 0) {
    return (
      <div className="bg-white p-12 text-center border border-slate-200 rounded-2xl my-6 max-w-7xl mx-auto shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-4"></div>
        <p className="text-slate-800 font-medium">Scanning live stock data...</p>
        <p className="text-xs text-slate-500 mt-1">Analyzing Bollinger Band Contraction &amp; Volume Breakouts</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white p-12 text-center border border-slate-200 rounded-2xl my-6 max-w-7xl mx-auto shadow-sm">
        <p className="text-slate-600 font-medium">No breakout stocks matching current criteria right now.</p>
        <p className="text-xs text-slate-500 mt-1">Try lowering volume threshold or switching timeframes (1M, 5M, 10M, 30M).</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto my-4 px-4 sm:px-6 lg:px-8 relative">
      {copiedStock && (
        <div className="mb-3 p-3 bg-emerald-950 text-white rounded-xl shadow-lg border border-emerald-500 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200 z-20">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400 shrink-0" />
            <span>
              Copied <strong>'{copiedStock}'</strong> to clipboard! In Dhan TV, press <kbd className="px-1.5 py-0.5 bg-emerald-800 rounded font-mono border border-emerald-600">Ctrl+V</kbd> in the search bar. Or click <strong>TradingView</strong> for 1-click auto-chart.
            </span>
          </div>
          <button 
            onClick={() => setCopiedStock(null)}
            className="text-emerald-300 hover:text-white font-bold ml-2 px-1.5 py-0.5 rounded bg-emerald-800"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            
            {/* Table Header matching Google Sheet layout */}
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
                <th className="py-3.5 px-4 sm:px-6 w-[180px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400">A</span>
                    <span className="text-slate-900 font-bold">Stock</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <span className="text-slate-400">B</span>
                    <span className="text-slate-900 font-bold">Current Price</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <span className="text-slate-400">C</span>
                    <span className="text-indigo-700 font-bold">AI KNN Line</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <span className="text-slate-400">D</span>
                    <span className="text-amber-700 font-bold">Average Line</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-purple-700 font-bold">RSI (14)</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-blue-700 font-bold">ADX (14)</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-emerald-700 font-bold">MACD</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span className="text-slate-400">E</span>
                    <span className="text-orange-600 font-bold">Vol Ratio</span>
                  </div>
                </th>
                <th className="py-3.5 px-6 min-w-[280px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400">F</span>
                    <span className="text-slate-900 font-bold">Status</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center space-x-1.5">
                    <span className="text-slate-400">G</span>
                    <span className="text-slate-900 font-bold">Timestamp</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <span className="text-slate-500 text-xs">Chart</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {items.map((item, idx) => {
                const isBullish = item.status.includes('Cross') || item.status.includes('Bullish') || item.status.includes('🔥');
                const isBearish = item.status.includes('Bearish') || item.status.includes('💥');

                return (
                  <tr
                    key={`${item.stock}-${idx}`}
                    onClick={() => onSelectStock(item)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    
                    {/* Column A: Stock */}
                    <td className="py-3 px-4 sm:px-6 font-sans font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center font-mono font-bold text-emerald-800 text-xs border border-emerald-200">
                          {item.stock.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{item.stock}</div>
                          <div className="text-[10px] text-slate-500 font-normal truncate max-w-[120px]">
                            {item.companyName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column B: Current Price */}
                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                      <div className="flex items-center justify-end space-x-1">
                        <span>₹{item.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                        {item.priceChangePercent >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 inline" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-red-600 inline" />
                        )}
                      </div>
                    </td>

                    {/* Column C: AI KNN Line */}
                    <td className="py-3 px-4 text-right font-bold text-indigo-700">
                      ₹{item.aiKnnLine.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Column D: Average Line */}
                    <td className="py-3 px-4 text-right font-bold text-amber-700">
                      ₹{item.averageLine.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* RSI (14) Context Badge */}
                    <td className="py-3 px-4 text-center font-mono">
                      {(() => {
                        const rsiVal = item.rsi ?? 50;
                        let colorStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                        let tag = '';

                        if (rsiVal >= 70) {
                          colorStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                          tag = 'OB';
                        } else if (rsiVal <= 30) {
                          colorStyle = 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
                          tag = 'OS';
                        } else if (rsiVal >= 55) {
                          colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
                        } else if (rsiVal <= 45) {
                          colorStyle = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
                        }

                        return (
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] border shadow-2xs ${colorStyle}`}
                            title={`RSI (14): ${rsiVal.toFixed(1)} ${tag ? `(${tag === 'OB' ? 'Overbought > 70' : 'Oversold < 30'})` : ''}`}
                          >
                            <span>{rsiVal.toFixed(1)}</span>
                            {tag && <span className="text-[9px] px-1 py-0.2 rounded bg-white/70 font-extrabold uppercase">{tag}</span>}
                          </span>
                        );
                      })()}
                    </td>

                    {/* ADX (14) Indicator Badge */}
                    <td className="py-3 px-4 text-center font-mono">
                      {(() => {
                        const adxVal = item.adx ?? 20;
                        const isStrong = adxVal >= 25;
                        const colorStyle = isStrong
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200';

                        return (
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] border shadow-2xs ${colorStyle}`}
                            title={`ADX (14): ${adxVal.toFixed(1)} ${isStrong ? '(Strong Trend >= 25)' : '(Weak Trend < 25)'}`}
                          >
                            <span>{adxVal.toFixed(1)}</span>
                            {isStrong && <span className="text-[9px] px-1 py-0.2 rounded bg-blue-200 text-blue-900 font-extrabold uppercase">STRONG</span>}
                          </span>
                        );
                      })()}
                    </td>

                    {/* MACD Crossover Badge */}
                    <td className="py-3 px-4 text-center font-mono">
                      {(() => {
                        const sig = item.macdSignal || 'NEUTRAL';
                        let label = 'Neutral';
                        let colorStyle = 'bg-slate-100 text-slate-600 border-slate-200';

                        if (sig === 'BULLISH_CROSS') {
                          label = '🟢 Bull Cross';
                          colorStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold animate-pulse';
                        } else if (sig === 'BEARISH_CROSS') {
                          label = '🔴 Bear Cross';
                          colorStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse';
                        } else if (sig === 'BULLISH') {
                          label = '📈 Bullish';
                          colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
                        } else if (sig === 'BEARISH') {
                          label = '📉 Bearish';
                          colorStyle = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
                        }

                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border shadow-2xs ${colorStyle}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Volume Ratio */}
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border shadow-2xs ${
                        item.volumeRatio >= 5 
                          ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse' 
                          : item.volumeRatio >= 2
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.volumeRatio?.toFixed(1) || '0.0'}x
                      </span>
                    </td>

                    {/* Column F: Status */}
                    <td className="py-3 px-6 font-sans font-medium text-xs">
                      <span
                        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full border ${
                          isBullish
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : isBearish
                            ? 'bg-red-50 text-red-900 border-red-300'
                            : 'bg-blue-50 text-blue-900 border-blue-300'
                        }`}
                      >
                        <span className="text-sm">{item.status.split(' ')[0]}</span>
                        <span className="font-semibold">{item.status.substring(item.status.indexOf(' ') + 1)}</span>
                      </span>
                    </td>

                    {/* Column F: Timestamp */}
                    <td className="py-3 px-4 text-center text-slate-600 font-semibold font-mono">
                      {formatTimestampHHMMSS(item.timestamp)}
                    </td>

                    {/* Chart Trigger Buttons - Opens TradingView & Dhan Web charts directly */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <a
                          href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(item.stock)}&interval=${getIntervalMinutes(item.timeframe)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white transition-all border border-blue-200 hover:border-blue-600 font-sans font-semibold text-xs shadow-2xs group/btn"
                          title={`Open NSE:${item.stock} (${item.timeframe || '30M'}) in TradingView`}
                        >
                          <LineChart className="w-3.5 h-3.5 text-blue-600 group-hover/btn:text-white" />
                          <span>TradingView</span>
                          <ArrowUpRight className="w-3 h-3 text-blue-600 group-hover/btn:text-white opacity-70" />
                        </a>

                        <a
                          href="https://tv.dhan.co/"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handleDhanClick(item.stock, e)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white transition-all border border-emerald-200 hover:border-emerald-600 font-sans font-bold text-xs shadow-2xs group/dhan"
                          title={`Click to copy '${item.stock}' and open Dhan TV`}
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-600 group-hover/dhan:text-white fill-emerald-500 group-hover/dhan:fill-white" />
                          <span>Dhan TV</span>
                          <ArrowUpRight className="w-3 h-3 text-emerald-600 group-hover/dhan:text-white opacity-70" />
                        </a>

                        {onDeleteStock && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteStock(item);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                            title={`Delete ${item.stock} from dashboard`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>

      </div>
    </div>
  );
};
