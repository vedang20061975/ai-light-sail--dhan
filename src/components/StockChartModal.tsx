import React, { useState } from 'react';
import { StockScanItem } from '../types';
import { X, Flame, Zap, Activity, Info, ChevronRight, BarChart2, ExternalLink, LineChart } from 'lucide-react';

interface StockChartModalProps {
  stock: StockScanItem | null;
  onClose: () => void;
}

const getIntervalMinutes = (timeframe?: string): string => {
  if (!timeframe) return '30';
  if (timeframe.includes('1M')) return '1';
  if (timeframe.includes('5M')) return '5';
  if (timeframe.includes('10M')) return '10';
  if (timeframe.includes('30M')) return '30';
  return '30';
};

export const StockChartModal: React.FC<StockChartModalProps> = ({ stock, onClose }) => {
  const [chartView, setChartView] = useState<'custom' | 'tradingview'>('tradingview');

  if (!stock) return null;

  const interval = getIntervalMinutes(stock.timeframe);
  const tvSymbol = `NSE:${stock.stock}`;
  const tvUrl = `https://in.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}&interval=${interval}`;
  const dhanUrl = `https://tv.dhan.co/`;

  // Generate synthetic recent 15-candle visual for chart display
  const numBars = 15;
  const basePrice = stock.currentPrice;
  const range = stock.bbUpper - stock.bbLower || basePrice * 0.05;

  const mockCandles = Array.from({ length: numBars }).map((_, i) => {
    const progress = i / (numBars - 1);
    const close = basePrice - (1 - progress) * (stock.currentPrice - stock.averageLine) * 0.8 + (Math.random() - 0.5) * (range * 0.1);
    const open = close - (Math.random() - 0.48) * (range * 0.15);
    const high = Math.max(open, close) + Math.random() * (range * 0.08);
    const low = Math.min(open, close) - Math.random() * (range * 0.08);
    const isBurst = i >= numBars - 2;
    const vol = isBurst ? stock.volume : Math.round(stock.avgVolume * (0.6 + Math.random() * 0.4));

    return { i, open, high, low, close, vol };
  });

  const chartHeight = 220;
  const chartWidth = 500;
  const padding = 30;

  const minP = stock.bbLower * 0.995;
  const maxP = stock.bbUpper * 1.005;

  const getY = (p: number) => {
    return chartHeight - padding - ((p - minP) / (maxP - minP || 1)) * (chartHeight - padding * 2);
  };

  const getX = (index: number) => {
    return padding + (index / (numBars - 1)) * (chartWidth - padding * 2);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-900 my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 shrink-0 relative pr-24 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold font-mono text-base shrink-0 shadow-sm">
              {stock.stock.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">{stock.stock}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-emerald-800 border border-slate-200">
                  {stock.timeframe} Scanner
                </span>
              </div>
              <p className="text-xs text-slate-500">{stock.companyName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Open Directly in TradingView Button */}
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>TradingView</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>

            {/* Open Directly in Dhan Chart Button */}
            <a
              href={dhanUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(stock.stock);
                } catch {}
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
              title={`Open ${stock.stock} (${stock.timeframe || '30M'}) directly in Dhan TV Chart`}
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Dhan TV</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>

          {/* High-visibility Close Button */}
          <button
            onClick={onClose}
            type="button"
            title="Close Modal"
            aria-label="Close modal"
            className="absolute top-0 right-0 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-rose-500 text-slate-700 hover:text-white border border-slate-300 hover:border-rose-600 shadow-md transition-all flex items-center gap-1.5 font-bold text-xs z-30 cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto pr-1 py-1 space-y-4 flex-1">

        {/* Technical Key Indicators Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 mb-4 font-mono text-xs">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">Current Price</span>
            <span className="text-sm font-bold text-slate-900">₹{stock.currentPrice}</span>
          </div>
          <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-200">
            <span className="text-[10px] text-indigo-700 block uppercase font-sans font-bold">AI KNN Line</span>
            <span className="text-sm font-bold text-indigo-900">₹{stock.aiKnnLine}</span>
          </div>
          <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
            <span className="text-[10px] text-amber-700 block uppercase font-sans font-bold">Average Line</span>
            <span className="text-sm font-bold text-amber-900">₹{stock.averageLine}</span>
          </div>
          <div className="bg-purple-50 p-2 rounded-xl border border-purple-200">
            <span className="text-[10px] text-purple-700 block uppercase font-sans font-bold">RSI (14)</span>
            <span className="text-sm font-bold text-purple-900">
              {(stock.rsi ?? 50).toFixed(1)} {((stock.rsi ?? 50) >= 70) ? '🔥' : ((stock.rsi ?? 50) <= 30) ? '🧊' : ''}
            </span>
          </div>
          <div className="bg-blue-50 p-2 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 block uppercase font-sans font-bold">ADX (14)</span>
            <span className="text-sm font-bold text-blue-900">
              {(stock.adx ?? 20).toFixed(1)} {((stock.adx ?? 20) >= 25) ? '🔥' : ''}
            </span>
          </div>
          <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 block uppercase font-sans font-bold">MACD</span>
            <span className="text-xs font-bold text-emerald-900 truncate block">
              {stock.macdSignal === 'BULLISH_CROSS' ? '🟢 Bull Cross' : stock.macdSignal === 'BEARISH_CROSS' ? '🔴 Bear Cross' : stock.macdSignal === 'BULLISH' ? '📈 Bullish' : stock.macdSignal === 'BEARISH' ? '📉 Bearish' : '⚪ Neutral'}
            </span>
          </div>
          <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 block uppercase font-sans font-bold">Vol Ratio</span>
            <span className="text-sm font-bold text-emerald-900">{stock.volumeRatio}x</span>
          </div>
        </div>

        {/* Chart View Selector Toggle */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setChartView('tradingview')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                chartView === 'tradingview'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              TradingView Interactive Widget
            </button>
            <button
              onClick={() => setChartView('custom')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                chartView === 'custom'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AI KNN &amp; BB Overlay
            </button>
          </div>

          <a
            href={tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center space-x-1 font-semibold"
          >
            <span>Full TradingView Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Chart View Content */}
        {chartView === 'tradingview' ? (
          <div className="bg-slate-900 rounded-xl border border-slate-200 mb-6 h-[320px] overflow-hidden relative shadow-inner">
            <iframe
              title={`TradingView Chart ${tvSymbol}`}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=NSE%3A${encodeURIComponent(
                stock.stock
              )}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0f172a&studies=%5B%5D&theme=light&style=1&timezone=Asia%2FKolkata`}
              className="w-full h-full border-0"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-cyan-600 inline-block rounded" />
                  <span className="text-[10px]">BB Bands ({stock.bbUpper} / {stock.bbLower})</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-indigo-600 inline-block rounded" />
                  <span className="text-[10px]">AI KNN Line</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-amber-600 inline-block rounded" />
                  <span className="text-[10px]">Avg Line</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500">{stock.timestamp}</span>
            </div>

            <div className="w-full overflow-hidden bg-white p-2 rounded-lg border border-slate-200">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
                
                {/* Bollinger Upper & Lower Fill Area */}
                <path
                  d={`M ${getX(0)} ${getY(stock.bbUpper)} L ${getX(numBars - 1)} ${getY(stock.bbUpper)} L ${getX(numBars - 1)} ${getY(stock.bbLower)} L ${getX(0)} ${getY(stock.bbLower)} Z`}
                  fill="rgba(6, 182, 212, 0.08)"
                  stroke="rgba(6, 182, 212, 0.3)"
                  strokeDasharray="3 3"
                />

                {/* Upper Band Line */}
                <line x1={padding} y1={getY(stock.bbUpper)} x2={chartWidth - padding} y2={getY(stock.bbUpper)} stroke="#0891b2" strokeWidth="1" opacity="0.8" />
                {/* Lower Band Line */}
                <line x1={padding} y1={getY(stock.bbLower)} x2={chartWidth - padding} y2={getY(stock.bbLower)} stroke="#0891b2" strokeWidth="1" opacity="0.8" />
                {/* Average Middle Line */}
                <line x1={padding} y1={getY(stock.averageLine)} x2={chartWidth - padding} y2={getY(stock.averageLine)} stroke="#d97706" strokeWidth="1.5" />
                {/* AI KNN Line */}
                <line x1={padding} y1={getY(stock.aiKnnLine)} x2={chartWidth - padding} y2={getY(stock.aiKnnLine)} stroke="#4f46e5" strokeWidth="2" strokeDasharray="4 2" />

                {/* Candlesticks */}
                {mockCandles.map((c, idx) => {
                  const x = getX(idx);
                  const yOpen = getY(c.open);
                  const yClose = getY(c.close);
                  const yHigh = getY(c.high);
                  const yLow = getY(c.low);

                  const isUp = c.close >= c.open;
                  const color = isUp ? '#059669' : '#dc2626';

                  return (
                    <g key={idx}>
                      {/* Wick */}
                      <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" />
                      {/* Body */}
                      <rect
                        x={x - 4}
                        y={Math.min(yOpen, yClose)}
                        width={8}
                        height={Math.max(2, Math.abs(yClose - yOpen))}
                        fill={color}
                        rx={1}
                      />
                    </g>
                  );
                })}

              </svg>
            </div>
          </div>
        )}

        {/* Condition Summary */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs">
          <Flame className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-emerald-900">
              Condition Verified: BB Expansion &amp; Volume Breakout
            </div>
            <p className="text-slate-700 mt-0.5">
              Bandwidth expanded from <span className="font-mono text-slate-900 font-bold">{stock.prevBandwidth}%</span> to <span className="font-mono text-slate-900 font-bold">{stock.bandwidth}%</span> after maximum squeeze contraction. Volume expanded <span className="font-mono text-emerald-700 font-bold">{stock.volumeRatio}x</span> above average volume.
            </p>
          </div>
        </div>

        </div>

      </div>
    </div>
  );
};
