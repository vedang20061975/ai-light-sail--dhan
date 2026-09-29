import { StockScanItem, Timeframe } from '../src/types.js';

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dateStr?: string;
}

/**
 * Calculates Bollinger Bands (20 periods, stdDev multiplier 2)
 */
export function calculateBollingerBands(closes: number[], period: number = 20, stdDevMult: number = 2.0) {
  if (closes.length < period) {
    const avg = closes.reduce((a, b) => a + b, 0) / (closes.length || 1);
    return { middle: avg, upper: avg * 1.02, lower: avg * 0.98, bandwidth: 4.0 };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMult * stdDev;
  const lower = middle - stdDevMult * stdDev;
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;

  return { middle, upper, lower, bandwidth };
}

/**
 * Calculates Relative Strength Index (RSI - 14 periods) using Wilder's Smoothing
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (!closes || closes.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgGain === 0 && avgLoss === 0) return 50.0;
  if (avgLoss === 0) return 100.0;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(1));
}

/**
 * Calculates Average Directional Index (ADX - 14 periods)
 */
export function calculateADX(candles: Candle[], period: number = 14): number {
  if (!candles || candles.length <= period) return 20.0;

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];

    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);

    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    if (upMove > downMove && upMove > 0) {
      plusDMs.push(upMove);
    } else {
      plusDMs.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDMs.push(downMove);
    } else {
      minusDMs.push(0);
    }
  }

  if (trs.length < period) return 20.0;

  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trs.length; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + trs[i];
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMs[i];
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMs[i];
    }

    const plusDI = smoothTR > 0 ? (100 * smoothPlusDM) / smoothTR : 0;
    const minusDI = smoothTR > 0 ? (100 * smoothMinusDM) / smoothTR : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (100 * Math.abs(plusDI - minusDI)) / diSum : 0;
    dxValues.push(dx);
  }

  if (dxValues.length === 0) return 20.0;
  if (dxValues.length < period) {
    const avgDx = dxValues.reduce((a, b) => a + b, 0) / dxValues.length;
    return Number(avgDx.toFixed(1));
  }

  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return Number(adx.toFixed(1));
}

/**
 * Calculates MACD (12, 26, 9) and identifies Crossovers
 */
export function calculateMACD(closes: number[]): {
  macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  macdLine: number;
  signalLine: number;
  histogram: number;
} {
  if (!closes || closes.length < 26) {
    return { macdSignal: 'NEUTRAL', macdLine: 0, signalLine: 0, histogram: 0 };
  }

  function getEMA(values: number[], period: number): number[] {
    const emas: number[] = [];
    if (values.length < period) return emas;
    const k = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emas.push(ema);

    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
      emas.push(ema);
    }
    return emas;
  }

  const ema12 = getEMA(closes, 12);
  const ema26 = getEMA(closes, 26);

  const macdValues: number[] = [];
  const offset = 26 - 12;
  for (let i = 0; i < ema26.length; i++) {
    const v12 = ema12[i + offset];
    const v26 = ema26[i];
    if (v12 !== undefined && v26 !== undefined) {
      macdValues.push(v12 - v26);
    }
  }

  if (macdValues.length < 9) {
    return { macdSignal: 'NEUTRAL', macdLine: 0, signalLine: 0, histogram: 0 };
  }

  const signalValues = getEMA(macdValues, 9);

  const currMacd = macdValues[macdValues.length - 1];
  const prevMacd = macdValues.length >= 2 ? macdValues[macdValues.length - 2] : currMacd;

  const currSig = signalValues[signalValues.length - 1];
  const prevSig = signalValues.length >= 2 ? signalValues[signalValues.length - 2] : currSig;

  const currHist = currMacd - currSig;

  let macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  if (prevMacd <= prevSig && currMacd > currSig) {
    macdSignal = 'BULLISH_CROSS';
  } else if (prevMacd >= prevSig && currMacd < currSig) {
    macdSignal = 'BEARISH_CROSS';
  } else if (currMacd > currSig) {
    macdSignal = 'BULLISH';
  } else if (currMacd < currSig) {
    macdSignal = 'BEARISH';
  }

  return {
    macdSignal,
    macdLine: Number(currMacd.toFixed(2)),
    signalLine: Number(currSig.toFixed(2)),
    histogram: Number(currHist.toFixed(2))
  };
}

/**
 * Scan stock candles for exact trigger logic
 */
export function analyzeStockCandles(
  stockSymbol: string,
  companyName: string,
  timeframe: Timeframe,
  candles: Candle[],
  strictMode: boolean = false
): StockScanItem | null {
  if (!candles || candles.length < 10) return null;

  const N = candles.length;
  const length = Math.min(20, N);
  const mult = 2.0;
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const sma = new Array<number>(N);
  const upperBb = new Array<number>(N);
  const lowerBb = new Array<number>(N);
  const bbWidth = new Array<number>(N);
  const knnLine = new Array<number>(N);
  const avgLine = new Array<number>(N);

  let ema = closes[0];
  const alpha = 2 / (5 + 1); // span=5 EMA

  for (let i = 0; i < N; i++) {
    if (i === 0) ema = closes[0];
    else ema = closes[i] * alpha + ema * (1 - alpha);
    knnLine[i] = Number(ema.toFixed(2));

    if (i >= length - 1) {
      const slice = closes.slice(i - length + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / length;
      const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / length;
      const stdev = Math.sqrt(variance);

      sma[i] = Number(mean.toFixed(2));
      avgLine[i] = Number(mean.toFixed(2));
      upperBb[i] = Number((mean + mult * stdev).toFixed(2));
      lowerBb[i] = Number((mean - mult * stdev).toFixed(2));
      bbWidth[i] = mean > 0 ? (upperBb[i] - lowerBb[i]) / mean : 0;
    }
  }

  const tfPrefix = timeframe.toUpperCase();
  const scanBars = (tfPrefix === "1M" || tfPrefix === "5M") ? 8 : 15;
  const rawStartIdx = Math.max(length + 2, N - scanBars);

  let todaySessionStartIdx = rawStartIdx;
  for (let i = N - 1; i >= Math.max(0, N - 40); i--) {
    const ts = candles[i].timestamp;
    if (ts === "09:15 AM" || ts === "09:16 AM" || ts === "09:20 AM" || ts === "09:30 AM") {
      todaySessionStartIdx = i;
      break;
    }
  }

  const startIdx = Math.max(rawStartIdx, todaySessionStartIdx);

  let latestTrigger: {
    triggerIndex: number;
    status: string;
    isBullish: boolean;
    timestamp: string;
  } | null = null;

  for (let idx = startIdx; idx < N; idx++) {
    const currW = bbWidth[idx];
    const prev1W = bbWidth[idx - 1] ?? currW;

    const slice20W = bbWidth.slice(Math.max(0, idx - 20), idx);
    const avg20W = slice20W.reduce((a, b) => a + b, 0) / (slice20W.length || 1);

    let bbSidewaysBreakout = false;
    if (tfPrefix === "1M" || tfPrefix === "5M") {
      bbSidewaysBreakout = (currW > prev1W) && (currW >= avg20W * 0.90);
    } else {
      bbSidewaysBreakout = (currW > prev1W) && (currW > avg20W * 1.05);
    }

    const currKnn = knnLine[idx];
    const prevKnn = knnLine[idx - 1] ?? currKnn;
    const currAvg = avgLine[idx];
    const prevAvg = avgLine[idx - 1] ?? currAvg;

    const freshBullCross = (prevKnn <= prevAvg) && (currKnn > currAvg);
    const freshBearCross = (prevKnn >= prevAvg) && (currKnn < currAvg);

    const currClose = closes[idx];
    const upperBB = upperBb[idx];
    const lowerBB = lowerBb[idx];

    if (bbSidewaysBreakout && freshBullCross && (currClose >= upperBB)) {
      latestTrigger = {
        triggerIndex: idx,
        status: `🔥 Fresh ${tfPrefix} BB Expansion Cross`,
        isBullish: true,
        timestamp: candles[idx].timestamp
      };
    } else if (bbSidewaysBreakout && freshBearCross && (currClose <= lowerBB)) {
      latestTrigger = {
        triggerIndex: idx,
        status: `💥 Fresh ${tfPrefix} Bearish Expansion`,
        isBullish: false,
        timestamp: candles[idx].timestamp
      };
    }
  }

  if (strictMode && !latestTrigger) {
    return null;
  }

  const currentCandle = candles[N - 1];
  const lastKnn = knnLine[N - 1] || currentCandle.close;
  const lastAvg = avgLine[N - 1] || currentCandle.close;
  const lastUpper = upperBb[N - 1] || currentCandle.close * 1.02;
  const lastLower = lowerBb[N - 1] || currentCandle.close * 0.98;
  const lastSma = sma[N - 1] || currentCandle.close;

  const referencePrice = candles[0]?.open || currentCandle.close;
  const priceChange = ((currentCandle.close - referencePrice) / (referencePrice || 1)) * 100;

  const triggerIdx = latestTrigger ? latestTrigger.triggerIndex : N - 1;
  const triggerCandle = candles[triggerIdx];
  const triggerSliceVols = volumes.slice(Math.max(0, triggerIdx - 20), triggerIdx);
  const avgVolAtTrigger = triggerSliceVols.length > 0 ? triggerSliceVols.reduce((a, b) => a + b, 0) / triggerSliceVols.length : 10000;
  const triggerVolRatio = avgVolAtTrigger > 0 ? triggerCandle.volume / avgVolAtTrigger : 1;

  let isBullish = false;
  let status = '';
  let knnSignal: 'BULLISH_CROSS' | 'BEARISH_EXPANSION' | 'SQUEEZE_RELEASE' | 'NEUTRAL' = 'NEUTRAL';

  if (latestTrigger) {
    isBullish = latestTrigger.isBullish;
    status = latestTrigger.status;
    knnSignal = isBullish ? 'BULLISH_CROSS' : 'BEARISH_EXPANSION';
  } else {
    isBullish = currentCandle.close >= lastAvg;
    status = isBullish ? `📈 Above AI Line (+${priceChange.toFixed(1)}%)` : `📉 Below AI Line (${priceChange.toFixed(1)}%)`;
    knnSignal = 'NEUTRAL';
  }

  const triggerTimestamp = latestTrigger ? latestTrigger.timestamp : currentCandle.timestamp;
  const currentRsi = calculateRSI(closes, 14);
  const currentAdx = calculateADX(candles, 14);
  const macdRes = calculateMACD(closes);

  return {
    id: `${stockSymbol}-${timeframe}-${Date.now()}`,
    stock: stockSymbol,
    companyName: companyName || stockSymbol,
    currentPrice: Number(currentCandle.close.toFixed(2)),
    aiKnnLine: lastKnn,
    averageLine: lastAvg,
    status,
    timestamp: triggerTimestamp,
    timeframe,
    bbUpper: lastUpper,
    bbLower: lastLower,
    bbMiddle: lastSma,
    bandwidth: Number((((lastUpper - lastLower) / (lastSma || 1)) * 100).toFixed(2)),
    prevBandwidth: Number((((upperBb[N - 2] - lowerBb[N - 2]) / (sma[N - 2] || 1)) * 100).toFixed(2)),
    volume: triggerCandle.volume,
    avgVolume: Math.round(avgVolAtTrigger),
    volumeRatio: Number(triggerVolRatio.toFixed(2)),
    knnSignal,
    priceChangePercent: Number(priceChange.toFixed(2)),
    rsi: currentRsi,
    adx: currentAdx,
    macdSignal: macdRes.macdSignal
  };
}
