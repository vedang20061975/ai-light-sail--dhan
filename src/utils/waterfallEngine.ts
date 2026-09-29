import { StockScanItem, Timeframe } from '../types';

/**
 * Helper to parse time strings like "09:15 AM", "01:30 PM", "14:15" to total seconds for timestamp sorting.
 */
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm) {
    const period = ampm.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  return hours * 3600 + minutes * 60;
}

/**
 * Strict 4-Stock Priority Selection and Waterfall Engine for Auto-Trading
 * 
 * Rules:
 * 1. Auto-Trade Eligibility Filter:
 *    - DISQUALIFIED (WATCHLIST-ONLY): Stocks with status "Above AI Line" or "Below AI Line" (knnSignal === 'NEUTRAL').
 *    - QUALIFIED: Only stocks with "🔥 Fresh BB Expansion Cross" (BULLISH_CROSS / Buy)
 *      or "💥 Fresh Bearish Expansion" (BEARISH_EXPANSION / Sell).
 * 
 * 2. Timeframe Waterfall Allocation (Max 4 Positions):
 *    - Priority order: Fill 4 slots sequentially starting from 30M -> 10M -> 5M -> 1M.
 *    - If 30M produces 4 qualified stocks, pick all 4 from 30M and stop.
 *    - If 30M produces fewer than 4 (e.g. 2 stocks), fill remaining slots from 10M, then 5M, and lastly 1M
 *      until maxOpenPositions = 4 is reached.
 * 
 * 3. Intra-Timeframe Sorting (Best Candidate Ranking):
 *    - When more candidates exist within the same timeframe than available slots, rank and pick candidates using:
 *      (1) Volume Ratio DESC -> (2) ADX DESC -> (3) Most Recent Timestamp.
 */
export function selectWaterfallAutoTradeCandidates(
  scannedData: Record<Timeframe, StockScanItem[]>,
  maxOpenPositions: number = 4
): StockScanItem[] {
  const selectedCandidates: StockScanItem[] = [];
  const selectedSymbols = new Set<string>();

  const timeframePriorityOrder: Timeframe[] = ['30M', '10M', '5M', '1M'];

  for (const tf of timeframePriorityOrder) {
    if (selectedCandidates.length >= maxOpenPositions) {
      break; // Max 4 slots fully allocated
    }

    const rawItems = scannedData[tf] || [];

    // Filter ONLY qualified breakout candidates: DISQUALIFY "Above AI Line" / "Below AI Line"
    const qualifiedItems = rawItems.filter(item => {
      // Do not duplicate a symbol if already selected from a higher timeframe
      if (selectedSymbols.has(item.stock.toUpperCase())) {
        return false;
      }

      // Check if item is a qualified breakout/breakdown
      const isQualifiedSignal =
        item.knnSignal === 'BULLISH_CROSS' ||
        item.knnSignal === 'BEARISH_EXPANSION' ||
        item.knnSignal === 'SQUEEZE_RELEASE' ||
        item.status.includes('🔥') ||
        item.status.includes('💥') ||
        item.status.includes('Cross') ||
        item.status.includes('Expansion');

      const isDisqualifiedWatchlist =
        item.knnSignal === 'NEUTRAL' ||
        item.status.includes('Above AI Line') ||
        item.status.includes('Below AI Line');

      return isQualifiedSignal && !isDisqualifiedWatchlist;
    });

    // Intra-timeframe candidate ranking:
    // Sort by: (1) Volume Ratio DESC -> (2) ADX DESC -> (3) Most Recent Timestamp DESC
    qualifiedItems.sort((a, b) => {
      // (1) Volume Ratio DESC
      const volDiff = (b.volumeRatio || 0) - (a.volumeRatio || 0);
      if (Math.abs(volDiff) > 0.01) {
        return volDiff;
      }

      // (2) ADX DESC
      const adxDiff = (b.adx || 0) - (a.adx || 0);
      if (Math.abs(adxDiff) > 0.1) {
        return adxDiff;
      }

      // (3) Most Recent Timestamp DESC
      const timeA = parseTimeToSeconds(a.timestamp);
      const timeB = parseTimeToSeconds(b.timestamp);
      return timeB - timeA;
    });

    // Fill available remaining slots from this timeframe
    const remainingSlots = maxOpenPositions - selectedCandidates.length;
    const candidatesFromTf = qualifiedItems.slice(0, remainingSlots);

    for (const item of candidatesFromTf) {
      selectedCandidates.push(item);
      selectedSymbols.add(item.stock.toUpperCase());
    }
  }

  return selectedCandidates;
}
