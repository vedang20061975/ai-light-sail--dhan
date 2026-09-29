import React from 'react';
import { Search, Filter, TrendingUp, Zap } from 'lucide-react';
import { ScannerFilter } from '../types';

interface FilterBarProps {
  filter: ScannerFilter;
  onFilterChange: (newFilter: ScannerFilter) => void;
  totalCount: number;
  filteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onFilterChange,
  totalCount,
  filteredCount,
}) => {
  return (
    <div className="bg-white/80 border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stock symbol or name..."
            value={filter.search}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-sm"
          />
        </div>

        {/* Filter Buttons & Strict Strategy Indicator */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-medium shadow-xs">
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500 animate-pulse" />
            <span>Strict Rules: <strong>BB Narrow Squeeze → Expansion</strong> + <strong>KNN Cross</strong> + <strong>Vol Breakout</strong></span>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onFilterChange({ ...filter, statusType: 'ALL' })}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter.statusType === 'ALL'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => onFilterChange({ ...filter, statusType: 'BULLISH' })}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1 ${
                filter.statusType === 'BULLISH'
                  ? 'bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🔥 Bullish Expansion</span>
            </button>
            <button
              onClick={() => onFilterChange({ ...filter, statusType: 'BEARISH' })}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1 ${
                filter.statusType === 'BEARISH'
                  ? 'bg-red-100 text-red-800 font-semibold border border-red-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>💥 Bearish Expansion</span>
            </button>
          </div>

          {/* Volume Multiplier Selector & Input */}
          <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs text-slate-600 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-slate-700">Vol &gt;</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={filter.minVolumeMultiplier}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onFilterChange({ ...filter, minVolumeMultiplier: isNaN(val) ? 5.0 : val });
              }}
              className="w-14 bg-slate-50 border border-slate-200 rounded border-slate-300 px-1 py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center"
              title="Type custom volume multiplier e.g. 5.1, 5.2"
            />
            <span className="font-bold text-slate-700">x</span>
            <select
              value={filter.minVolumeMultiplier}
              onChange={(e) => onFilterChange({ ...filter, minVolumeMultiplier: Number(e.target.value) })}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer border-l border-slate-200 pl-1 text-xs"
            >
              <option value={0.5} className="bg-white text-slate-900">0.5x Avg</option>
              <option value={1.0} className="bg-white text-slate-900">1.0x Avg</option>
              <option value={1.25} className="bg-white text-slate-900">1.25x Avg</option>
              <option value={1.5} className="bg-white text-slate-900">1.5x Avg</option>
              <option value={2.0} className="bg-white text-slate-900">2.0x Avg</option>
              <option value={2.5} className="bg-white text-slate-900">2.5x Avg</option>
              <option value={3.0} className="bg-white text-slate-900">3.0x Avg</option>
              <option value={3.5} className="bg-white text-slate-900">3.5x Avg</option>
              <option value={4.0} className="bg-white text-slate-900">4.0x Avg</option>
              <option value={4.5} className="bg-white text-slate-900">4.5x Avg</option>
              <option value={5.0} className="bg-white text-slate-900 font-bold">5.0x (Default)</option>
              <option value={5.1} className="bg-white text-slate-900">5.1x Avg</option>
              <option value={5.2} className="bg-white text-slate-900">5.2x Avg</option>
              <option value={5.3} className="bg-white text-slate-900">5.3x Avg</option>
              <option value={5.4} className="bg-white text-slate-900">5.4x Avg</option>
              <option value={5.5} className="bg-white text-slate-900">5.5x Avg</option>
              <option value={5.6} className="bg-white text-slate-900">5.6x Avg</option>
              <option value={5.7} className="bg-white text-slate-900">5.7x Avg</option>
              <option value={5.8} className="bg-white text-slate-900">5.8x Avg</option>
              <option value={5.9} className="bg-white text-slate-900">5.9x Avg</option>
              <option value={6.0} className="bg-white text-slate-900">6.0x Avg</option>
              <option value={6.5} className="bg-white text-slate-900">6.5x Avg</option>
              <option value={7.0} className="bg-white text-slate-900">7.0x Avg</option>
              <option value={7.5} className="bg-white text-slate-900">7.5x Avg</option>
              <option value={8.0} className="bg-white text-slate-900">8.0x Avg</option>
              <option value={8.5} className="bg-white text-slate-900">8.5x Avg</option>
              <option value={9.0} className="bg-white text-slate-900">9.0x Avg</option>
              <option value={9.5} className="bg-white text-slate-900">9.5x Avg</option>
              <option value={10.0} className="bg-white text-slate-900">10.0x Avg</option>
            </select>
          </div>

          {(filter.search || filter.statusType !== 'ALL' || filter.minVolumeMultiplier !== 5.0) && (
            <button
              onClick={() => onFilterChange({ search: '', statusType: 'ALL', minVolumeMultiplier: 5.0, minBandwidthExpansion: 15 })}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              title="Reset all filters to default"
            >
              Reset Filter (5.0x)
            </button>
          )}

          <div className="text-xs text-slate-500 font-mono pl-2">
            Showing <span className="font-bold text-slate-900">{filteredCount}</span> stocks
          </div>

        </div>

      </div>
    </div>
  );
};
