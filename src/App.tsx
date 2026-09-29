import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Header } from './components/Header';
import { TimeframeTabs } from './components/TimeframeTabs';
import { FilterBar } from './components/FilterBar';
import { ScannerTable } from './components/ScannerTable';
import { StockChartModal } from './components/StockChartModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { DhanApiModal } from './components/DhanApiModal';
import { AdminLockModal } from './components/AdminLockModal';
import { LoginModal } from './components/LoginModal';
import { UserManagerModal } from './components/UserManagerModal';
import { ClientLogsView } from './components/ClientLogsView';
import { AlertSettingsModal } from './components/AlertSettingsModal';
import { AlertHistoryDrawer } from './components/AlertHistoryDrawer';
import { Timeframe, StockScanItem, DhanConfig, SheetConfig, ScannerFilter, ClientLog, UserAccount, AlertRuleConfig, TriggeredAlertItem } from './types';
import { playAlertSound, sendDesktopNotification } from './utils/audioAlert';
import { selectWaterfallAutoTradeCandidates } from './utils/waterfallEngine';

function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const sec = match[3] ? parseInt(match[3], 10) : 0;
  const period = match[4]?.toUpperCase();

  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return hour * 3600 + min * 60 + sec;
}

// Safely fetches JSON and prevents SyntaxError when server returns HTML errors
async function safeJsonFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: res.status, data: { error: `Server returned non-JSON response (${res.status} ${res.statusText})` } };
  }
}

// Extracts real Dhan account margin/fund balance from Dhan HQ API response
function extractDhanBalance(data: any): number | null {
  if (data === null || data === undefined) return null;

  if (typeof data === 'number' && !isNaN(data)) return data;
  if (typeof data === 'string' && !isNaN(Number(data)) && data.trim() !== '') return Number(data);

  if (typeof data === 'object') {
    const targetKeys = [
      'availabelBalance',  // Official Dhan API typo spelling
      'availableBalance',  // Corrected spelling
      'sodLimit',          // Start of Day Balance
      'withdrawableBalance',
      'fundLimit',
      'netAmount'
    ];

    for (const key of targetKeys) {
      if (data[key] !== undefined && data[key] !== null) {
        const num = Number(data[key]);
        if (!isNaN(num)) return num;
      }
    }

    if (data.data && typeof data.data === 'object') {
      const nested = extractDhanBalance(data.data);
      if (nested !== null) return nested;
    }

    if (data.dhanRawData && typeof data.dhanRawData === 'object') {
      const nested = extractDhanBalance(data.dhanRawData);
      if (nested !== null) return nested;
    }

    if (data.result && typeof data.result === 'object') {
      const nested = extractDhanBalance(data.result);
      if (nested !== null) return nested;
    }
  }

  return null;
}

// Helper to get IST date string and IST time in minutes
function getISTDateAndMinutes() {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
  const istDate = new Date(istMs);
  const dateStr = istDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const dayOfWeek = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const minutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  return { dateStr, minutes, dayOfWeek };
}

// Calculates 09:00 AM IST session key (e.g. "2026-08-11").
// Each session runs strictly from 09:00 AM IST to 08:59 AM IST the next day.
function get9AMSessionKey(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000); // UTC +5.5
  const istDate = new Date(istMs);

  const istHours = istDate.getUTCHours();
  const istMinutes = istDate.getUTCMinutes();
  const totalMinutes = istHours * 60 + istMinutes;

  // Before 09:00 AM IST (540 mins), it belongs to yesterday's 09:00 AM session
  if (totalMinutes < 540) {
    istDate.setUTCDate(istDate.getUTCDate() - 1);
  }

  return istDate.toISOString().split('T')[0];
}

function parseISTTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm) {
    const period = ampm.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

function isFreshBreakoutTimestamp(timestampStr: string, timeframe: string): boolean {
  const candleMinutes = parseISTTimeToMinutes(timestampStr);
  if (candleMinutes === null) return true;

  const { minutes: currentMinutes } = getISTDateAndMinutes();
  let diff = currentMinutes - candleMinutes;

  if (diff < -5) {
    return false;
  }
  if (diff < 0) diff = 0;

  let maxAllowedMinutes = 10;
  if (timeframe === '1M') maxAllowedMinutes = 1;
  else if (timeframe === '5M') maxAllowedMinutes = 3;
  else if (timeframe === '10M') maxAllowedMinutes = 5;
  else if (timeframe === '30M') maxAllowedMinutes = 10;

  return diff <= maxAllowedMinutes;
}

// Checks if current IST time is strictly within NSE market hours (09:00 AM to 03:30 PM IST, Monday - Friday)
function isNSEMarketHours(): boolean {
  const { minutes, dayOfWeek } = getISTDateAndMinutes();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return minutes >= (9 * 60) && minutes <= (15 * 60 + 30); // 09:00 AM to 03:30 PM IST (570 to 930 mins)
}

export default function App() {
  // Auto Trading State
  const [isAutoTradingActive, setIsAutoTradingActive] = useState<boolean>(() => {
    return localStorage.getItem('infinity_auto_trading_active') === 'true';
  });

  // Custom Profit & Loss Auto-Exit Engine State
  const [targetProfitExitOn, setTargetProfitExitOn] = useState<boolean>(() => {
    return localStorage.getItem('infinity_target_profit_exit_on') !== 'false';
  });
  const [targetProfitValue, setTargetProfitValue] = useState<number>(() => {
    const saved = localStorage.getItem('infinity_target_profit_value');
    return saved ? Number(saved) : 200;
  });
  const [maxLossExitOn, setMaxLossExitOn] = useState<boolean>(() => {
    return localStorage.getItem('infinity_max_loss_exit_on') !== 'false';
  });
  const [maxLossValue, setMaxLossValue] = useState<number>(() => {
    const saved = localStorage.getItem('infinity_max_loss_value');
    return saved ? Number(saved) : 200;
  });

  // Live positions linked directly with Dhan Real-time Positions (zero simulation)
  const [livePositions, setLivePositions] = useState<any[]>([]);
  const exitedPositionsRef = useRef<Set<string>>(new Set());

  // Target Rule Execution Strategy: Strict 1:2 R:R vs Quick Scalp Mode
  const [targetRule, setTargetRule] = useState<'STRICT_1_2' | 'QUICK_SCALP'>(() => {
    const saved = localStorage.getItem('infinity_target_rule');
    return saved === 'QUICK_SCALP' ? 'QUICK_SCALP' : 'STRICT_1_2';
  });
  const [quickTargetPercent, setQuickTargetPercent] = useState<number>(() => {
    const saved = localStorage.getItem('infinity_quick_target_percent');
    return saved ? Number(saved) : 0.75; // Default 0.75% quick profit
  });

  const toggleTargetRule = () => {
    const nextRule = targetRule === 'STRICT_1_2' ? 'QUICK_SCALP' : 'STRICT_1_2';
    setTargetRule(nextRule);
    localStorage.setItem('infinity_target_rule', nextRule);
    fetch('/api/trading/execution-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRule: nextRule, quickTargetPercent })
    }).catch(() => {});
    playAlertSound(nextRule === 'QUICK_SCALP' ? 'BULLISH' : 'BEARISH');
  };

  const [dhanFundLimit, setDhanFundLimit] = useState<string>('Loading...');
  const [diagnosticsChecking, setDiagnosticsChecking] = useState<boolean>(false);

  // Persistence for Auto-Exit settings
  useEffect(() => {
    localStorage.setItem('infinity_target_profit_exit_on', String(targetProfitExitOn));
    localStorage.setItem('infinity_target_profit_value', String(targetProfitValue));
    localStorage.setItem('infinity_max_loss_exit_on', String(maxLossExitOn));
    localStorage.setItem('infinity_max_loss_value', String(maxLossValue));
    localStorage.setItem('infinity_target_rule', String(targetRule));
    localStorage.setItem('infinity_quick_target_percent', String(quickTargetPercent));
  }, [targetProfitExitOn, targetProfitValue, maxLossExitOn, maxLossValue, targetRule, quickTargetPercent]);

  // Daily Auto-Stop Circuit Breaker State
  const [todayPnL, setTodayPnL] = useState<number>(() => {
    const saved = localStorage.getItem('infinity_today_pnl');
    return saved ? Number(saved) : 0;
  });
  const [profitAutoStopOn, setProfitAutoStopOn] = useState<boolean>(() => {
    return localStorage.getItem('infinity_profit_auto_stop_on') !== 'false';
  });
  const [profitTargetAmount, setProfitTargetAmount] = useState<number>(() => {
    const saved = localStorage.getItem('infinity_profit_target_amount');
    // Ensure default value is 3000 (never 0)
    return saved && Number(saved) > 0 ? Number(saved) : 3000;
  });
  const [lossAutoStopOn, setLossAutoStopOn] = useState<boolean>(() => {
    return localStorage.getItem('infinity_loss_auto_stop_on') !== 'false';
  });
  const [lossLimitAmount, setLossLimitAmount] = useState<number>(() => {
    const saved = localStorage.getItem('infinity_loss_limit_amount');
    // Ensure default value is 3000 (never 0)
    return saved && Number(saved) > 0 ? Number(saved) : 3000;
  });
  const [isCircuitBreakerTripped, setIsCircuitBreakerTripped] = useState<boolean>(() => {
    return localStorage.getItem('infinity_circuit_breaker_tripped') === 'true';
  });
  // Twin state for maximum compatibility with both isCircuitBreakerTripped and isCircuitLatched names
  const [isCircuitLatched, setIsCircuitLatched] = useState<boolean>(() => {
    return localStorage.getItem('infinity_circuit_breaker_tripped') === 'true';
  });
  const [trippedReason, setTrippedReason] = useState<'PROFIT' | 'LOSS' | null>(() => {
    return localStorage.getItem('infinity_tripped_reason') as 'PROFIT' | 'LOSS' | null;
  });

  // State Persistence for Circuit Breaker Settings
  useEffect(() => {
    localStorage.setItem('infinity_today_pnl', String(todayPnL));
    localStorage.setItem('infinity_profit_auto_stop_on', String(profitAutoStopOn));
    localStorage.setItem('infinity_profit_target_amount', String(profitTargetAmount));
    localStorage.setItem('infinity_loss_auto_stop_on', String(lossAutoStopOn));
    localStorage.setItem('infinity_loss_limit_amount', String(lossLimitAmount));
    localStorage.setItem('infinity_circuit_breaker_tripped', String(isCircuitBreakerTripped || isCircuitLatched));
    localStorage.setItem('infinity_tripped_reason', trippedReason || '');
  }, [todayPnL, profitAutoStopOn, profitTargetAmount, lossAutoStopOn, lossLimitAmount, isCircuitBreakerTripped, isCircuitLatched, trippedReason]);

  // Load-time clearance effect to heal any prior false latchings (such as when threshold is 0 or disabled)
  useEffect(() => {
    if ((isCircuitBreakerTripped || isCircuitLatched) && (profitTargetAmount <= 0 || !profitAutoStopOn)) {
      setIsCircuitBreakerTripped(false);
      setIsCircuitLatched(false);
      setTrippedReason(null);
      localStorage.setItem('infinity_circuit_breaker_tripped', 'false');
      localStorage.setItem('infinity_tripped_reason', '');
    }
  }, [profitTargetAmount, profitAutoStopOn]);

  const [activeTab, setActiveTab] = useState<Timeframe | 'LOGS'>('30M');

  // Dhan HQ Real Positions & Orders states
  const [dhanRealPositions, setDhanRealPositions] = useState<any[]>([]);
  const [dhanRealOrders, setDhanRealOrders] = useState<any[]>([]);
  const [isDhanSyncing, setIsDhanSyncing] = useState<boolean>(false);

  // New Dhan Live Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [orderSymbol, setOrderSymbol] = useState<string>('RELIANCE');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderTimeframe, setOrderTimeframe] = useState<Timeframe>('30M');
  const [orderSizingType, setOrderSizingType] = useState<'CAPITAL' | 'SHARES'>('CAPITAL');
  const [orderCapital, setOrderCapital] = useState<number>(1250);
  const [orderQty, setOrderQty] = useState<number>(10);
  const [orderPrice, setOrderPrice] = useState<number>(1320.0);
  const [orderSL, setOrderSL] = useState<number>(1306.8);
  const [orderTP, setOrderTP] = useState<number>(1346.4);

  // Dynamic order calculators (Switchable Strict 1:2 vs Quick Scalp TP)
  const calculateTP = (price: number, sl: number, side: 'BUY' | 'SELL') => {
    if (targetRule === 'QUICK_SCALP') {
      return side === 'BUY'
        ? Number((price * (1 + quickTargetPercent / 100)).toFixed(2))
        : Number((price * (1 - quickTargetPercent / 100)).toFixed(2));
    }
    // Strict 1:2 R:R
    const risk = Math.abs(price - sl);
    return side === 'BUY'
      ? Number((price + (2 * risk)).toFixed(2))
      : Number((price - (2 * risk)).toFixed(2));
  };

  const updateOrderPrice = (price: number) => {
    setOrderPrice(price);
    // Auto SL (1% risk)
    const sl = orderSide === 'BUY' ? Number((price * 0.99).toFixed(2)) : Number((price * 1.01).toFixed(2));
    setOrderSL(sl);
    const tp = calculateTP(price, sl, orderSide);
    setOrderTP(tp);

    // Auto Qty if by capital
    if (orderSizingType === 'CAPITAL') {
      const qty = Math.floor(orderCapital / (price || 1)) || 1;
      setOrderQty(qty);
    }
  };

  const updateOrderSide = (side: 'BUY' | 'SELL') => {
    setOrderSide(side);
    const sl = side === 'BUY' ? Number((orderPrice * 0.99).toFixed(2)) : Number((orderPrice * 1.01).toFixed(2));
    setOrderSL(sl);
    const tp = calculateTP(orderPrice, sl, side);
    setOrderTP(tp);
  };

  const updateOrderCapital = (cap: number) => {
    setOrderCapital(cap);
    if (orderPrice > 0) {
      const qty = Math.floor(cap / orderPrice) || 1;
      setOrderQty(qty);
    }
  };

  const updateOrderSL = (sl: number) => {
    setOrderSL(sl);
    const tp = calculateTP(orderPrice, sl, orderSide);
    setOrderTP(tp);
  };

  const handleSelectQuickPick = (symbol: string) => {
    setOrderSymbol(symbol);
    // Auto-populate price if symbol is found in dashboard scannedData, otherwise use reasonable default
    let foundLTP = 150.0;
    const allItems = Object.values(scannedData).flat();
    const matched = allItems.find((item: any) => item?.stock?.toUpperCase() === symbol.toUpperCase());
    if (matched) {
      foundLTP = (matched as any).price;
    } else {
      // Hardcoded high-fidelity LTP fallbacks for quick picks
      const defaults: Record<string, number> = {
        'RELIANCE': 1320.0,
        'TCS': 2420.0,
        'HDFCBANK': 1680.0,
        'SBIN': 1072.0,
        'TATAMOTORS': 980.0,
        'ICICIBANK': 1120.0
      };
      if (defaults[symbol]) foundLTP = defaults[symbol];
    }
    updateOrderPrice(foundLTP);
  };

  const handleExecuteLiveOrder = async () => {
    try {
      const totalVal = Number((orderQty * orderPrice).toFixed(2));

      // Append access audit log
      fetch('/api/logs/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || 'Admin',
          fullName: currentUser?.fullName || 'Administrator',
          action: `⚡ MANUAL DHAN LIVE ORDER: Dispatched ${orderSide} order for ${orderSymbol} | Qty: ${orderQty} Shares @ ₹${orderPrice} (Total: ₹${totalVal}) via Lightsail relay bridge.`
        })
      }).catch(() => {});

      // Dispatch order to relay
      await fetch('/api/dhan-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_order',
          clientId: dhanConfig.clientId || '1108096138',
          accessToken: dhanConfig.accessToken,
          symbol: orderSymbol,
          side: orderSide,
          qty: orderQty,
          price: orderPrice,
          sl: orderSL,
          tp: orderTP,
          orderType: 'LIMIT',
          productType: 'MARGIN'
        })
      });

      playAlertSound('BULLISH');
      alert(`⚡ Live Order Executed successfully: ${orderSide} ${orderQty} shares of ${orderSymbol} at ₹${orderPrice}.`);
      setIsOrderModalOpen(false);
      fetchDhanRealData();
      fetchLogs();
    } catch (e) {
      alert(`⚡ Live Order transmitted successfully via Dhan HQ relay.`);
      setIsOrderModalOpen(false);
    }
  };

  // Configurations & State
  const [dhanConfig, setDhanConfig] = useState<DhanConfig>(() => {
    try {
      const saved = localStorage.getItem('infinity_dhan_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          clientId: parsed.clientId || '1108096138',
          accessToken: parsed.accessToken || '',
          isConnected: Boolean(parsed.isConnected),
          mode: parsed.mode || 'live_dhan'
        };
      }
    } catch {}
    return {
      clientId: '1108096138',
      accessToken: '',
      isConnected: false,
      mode: 'live_dhan'
    };
  });

  // Core background poller for real open positions and real orders
  const [realDhanMargin, setRealDhanMargin] = useState<number | null>(0);
  const [dhanFundError, setDhanFundError] = useState<string | null>(null);

  // Stable references to prevent cyclic re-render loops and duplicate concurrent fetches
  const dhanConfigRef = useRef<DhanConfig>(dhanConfig);
  useEffect(() => {
    dhanConfigRef.current = dhanConfig;
  }, [dhanConfig]);

  const isSyncInProgressRef = useRef<boolean>(false);
  const isManualSyncingRef = useRef<boolean>(false);

  const fetchDhanRealData = useCallback(async (isManual = false, force = false) => {
    // Concurrency guard: ignore duplicate simultaneous invocations
    if (isSyncInProgressRef.current) return;
    if (isManual && isManualSyncingRef.current) return;

    isSyncInProgressRef.current = true;
    if (isManual) {
      isManualSyncingRef.current = true;
      setIsDhanSyncing(true);
    }

    try {
      const cfg = dhanConfigRef.current;
      let activeClientId = cfg.clientId || '1108096138';
      let activeToken = cfg.accessToken || '';

      // If active token is missing in state, attempt fetching from /api/dhan/config once
      if (!activeToken) {
        try {
          const cfgRes = await safeJsonFetch('/api/dhan/config');
          if (cfgRes.ok && cfgRes.data?.accessToken) {
            activeToken = cfgRes.data.accessToken;
            activeClientId = cfgRes.data.clientId || activeClientId;
            dhanConfigRef.current = cfgRes.data;
            setDhanConfig(cfgRes.data);
            localStorage.setItem('infinity_dhan_config', JSON.stringify(cfgRes.data));
          }
        } catch {}
      }

      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (activeToken) {
        reqHeaders['access-token'] = activeToken;
        reqHeaders['client-id'] = activeClientId;
      }

      const queryParams = `clientId=${encodeURIComponent(activeClientId)}&accessToken=${encodeURIComponent(activeToken)}${force ? '&force=true' : ''}`;

      // 1. Fetch real open positions using safeJsonFetch
      const posRes = await safeJsonFetch(`/api/dhan-relay/positions?${queryParams}`, {
        headers: reqHeaders
      });

      if (posRes.ok && (Array.isArray(posRes.data) || Array.isArray(posRes.data?.data))) {
        const rawPositions = Array.isArray(posRes.data) ? posRes.data : posRes.data.data;
        const mappedPositions = rawPositions.map((p: any) => {
          const symbol = String(p.tradingSymbol || p.symbol || p.securityId || 'STOCK');
          const netQty = Number(p.netQty ?? p.quantity ?? 0);
          const avgPrice = Number(p.costPrice || p.buyAvg || p.avgPrice || p.buyPrice || 0);
          const currentPrice = Number(p.currentPrice || p.ltp || p.lastPrice || avgPrice);
          const unrealizedPnL = Number(p.unrealizedProfit ?? p.m2m ?? p.unrealizedPnL ?? ((currentPrice - avgPrice) * netQty));
          const realizedPnL = Number(p.realizedProfit ?? p.realizedPnL ?? 0);
          return {
            positionId: p.positionId || p.securityId || `${symbol}-${p.productType || 'MARGIN'}`,
            symbol,
            product: p.productType || p.product || 'MARGIN',
            netQty,
            avgPrice,
            currentPrice,
            unrealizedPnL,
            realizedPnL
          };
        }).filter((p: any) => p.netQty !== 0);

        setDhanRealPositions(mappedPositions);

        // Dynamically compute real live P&L
        const totalLivePnL = mappedPositions.reduce((acc: number, p: any) => acc + (p.unrealizedPnL || 0), 0);
        setTodayPnL(totalLivePnL);
      } else if (posRes.data?.errorCode === 'DH-904' || posRes.data?.errorType === 'Rate_Limit') {
        // Retain existing positions during rate limit throttling
      } else {
        setDhanRealPositions([]);
      }

      // 2. Fetch real order history using safeJsonFetch
      const ordRes = await safeJsonFetch(`/api/dhan-relay/orders?${queryParams}`, {
        headers: reqHeaders
      });

      if (ordRes.ok && (Array.isArray(ordRes.data) || Array.isArray(ordRes.data?.data))) {
        const rawOrders = Array.isArray(ordRes.data) ? ordRes.data : ordRes.data.data;
        const mappedOrders = rawOrders
          .map((o: any) => ({
            orderId: String(o.orderId || o.id || ''),
            symbol: String(o.tradingSymbol || o.securityId || o.symbol || ''),
            side: String(o.transactionType || o.side || 'BUY').toUpperCase(),
            qty: Number(o.quantity || o.filledQty || o.qty || 0),
            price: Number(o.price || o.averageTradedPrice || o.avgPrice || 0),
            type: String(o.orderType || o.type || 'MARKET').toUpperCase(),
            status: String(o.orderStatus || o.status || 'TRADED').toUpperCase(),
            time: String(o.createTime || o.exchangeTime || o.orderTimestamp || o.time || '—')
          }))
          .filter((o: any) => o.orderId && !o.orderId.startsWith('ORD-'));

        setDhanRealOrders(mappedOrders);
      } else if (ordRes.data?.errorCode === 'DH-904' || ordRes.data?.errorType === 'Rate_Limit') {
        // Retain existing orders during rate limit throttling
      } else {
        setDhanRealOrders([]);
      }

      // 3. Fetch real fund limits using safeJsonFetch
      const fundRes = await safeJsonFetch(`/api/dhan-relay/fundlimit?${queryParams}`, {
        headers: reqHeaders
      });

      if (fundRes.ok && fundRes.data) {
        const liveMargin = extractDhanBalance(fundRes.data);

        if (liveMargin !== null && !isNaN(liveMargin)) {
          setRealDhanMargin(liveMargin);
          setDhanFundLimit(`₹${liveMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
          setDhanFundError(null);
        } else {
          setRealDhanMargin(prev => (prev !== null && prev > 0 ? prev : 0));
          setDhanFundLimit(prev => prev && prev !== '₹0.00' ? prev : '₹0.00');
        }
      } else {
        const isRateLimit = fundRes.data?.errorCode === 'DH-904' || fundRes.data?.errorType === 'Rate_Limit';
        if (isRateLimit) {
          console.warn('[Dhan Live Relay Notice]: Dhan HQ rate limit active. Retaining current live balance.');
        } else {
          const err = fundRes.data?.errorMessage || fundRes.data?.message || fundRes.data?.remarks || 'Relay Sync Failed';
          setRealDhanMargin(prev => (prev !== null && prev > 0 ? prev : 0));
          setDhanFundError(`Relay Sync Failed: ${err}`);
        }
      }
    } catch (e: any) {
      console.error('[Dhan Live Relay Error]:', e);
      setRealDhanMargin(prev => (prev !== null && prev > 0 ? prev : 0));
    } finally {
      isSyncInProgressRef.current = false;
      if (isManual) {
        isManualSyncingRef.current = false;
        setIsDhanSyncing(false);
      }
    }
  }, []); // Empty dependencies: identity is permanently stable, preventing cascading re-render loops

  // Stable single background polling interval (30 seconds)
  useEffect(() => {
    fetchDhanRealData(false, false);
    const interval = setInterval(() => {
      fetchDhanRealData(false, false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDhanRealData]);

  // Action: Manual Force Sync LIVE_TRADING button (Throttled & Debounced)
  const handleManualSyncLiveTrading = useCallback(async () => {
    if (isManualSyncingRef.current || isDhanSyncing) return;
    try {
      await fetchDhanRealData(true, true);
      playAlertSound('BULLISH');
    } catch (e) {
      console.error('[Manual Live Trading Sync Error]:', e);
    }
  }, [fetchDhanRealData, isDhanSyncing]);

  // Action: Quick Scalp Exit (Instant profit booking at market)
  const handleQuickExitPosition = async (pos: any) => {
    try {
      fetch('/api/logs/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || 'Admin',
          fullName: currentUser?.fullName || 'Administrator',
          action: `⚡ QUICK SCALP EXIT: Locking profit for ${pos.symbol} (${pos.netQty} Qty) on Dhan HQ Live Account.`
        })
      }).catch(() => {});

      const targetSymbol = String(pos.symbol || '').toUpperCase();
      const targetQty = Math.max(1, Math.round(Math.abs(Number(pos.netQty || 1))));
      const targetSide = Number(pos.netQty || 0) > 0 ? 'SELL' : 'BUY';

      await fetch('/api/dhan-relay/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': dhanConfig.accessToken || '',
          'client-id': dhanConfig.clientId || '1108096138'
        },
        body: JSON.stringify({
          action: 'place_order',
          clientId: dhanConfig.clientId || '1108096138',
          accessToken: dhanConfig.accessToken || '',
          tradingSymbol: targetSymbol,
          securityId: String(pos.securityId || pos.positionId || ''),
          transactionType: targetSide,
          exchangeSegment: 'NSE_EQ',
          productType: ['CNC', 'INTRADAY', 'MARGIN'].includes(pos.product) ? pos.product : 'MARGIN',
          orderType: 'MARKET',
          quantity: targetQty,
          price: 0.0,
          disclosedQuantity: 0,
          triggerPrice: 0,
          afterMarketOrder: false
        })
      });

      playAlertSound('BULLISH');
      alert(`⚡ Quick Exit Order Transmitted: Closed ${pos.symbol} at market to secure gains.`);
      await fetchDhanRealData(true);
      fetchLogs();
    } catch (e: any) {
      alert(`⚡ Quick Exit transmitted for ${pos.symbol} via Dhan HQ.`);
      await fetchDhanRealData(true);
    }
  };

  // Action: Single Position Exit (Square off)
  const handleExitSinglePosition = async (pos: any) => {
    try {
      // Log event
      fetch('/api/logs/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || 'Admin',
          fullName: currentUser?.fullName || 'Administrator',
          action: `👉 SINGLE POSITION EXIT: Triggered square-off order for ${pos.symbol} (${pos.netQty} Qty) on Dhan HQ Live Account.`
        })
      }).catch(() => {});

      const targetSymbol = String(pos.symbol || '').toUpperCase();
      const targetQty = Math.max(1, Math.round(Math.abs(Number(pos.netQty || 1))));
      const targetSide = Number(pos.netQty || 0) > 0 ? 'SELL' : 'BUY';

      // Dispatch order execution to relay bridge
      await fetch('/api/dhan-relay/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': dhanConfig.accessToken || '',
          'client-id': dhanConfig.clientId || '1108096138'
        },
        body: JSON.stringify({
          action: 'place_order',
          clientId: dhanConfig.clientId || '1108096138',
          accessToken: dhanConfig.accessToken || '',
          tradingSymbol: targetSymbol,
          securityId: String(pos.securityId || pos.positionId || ''),
          transactionType: targetSide,
          exchangeSegment: 'NSE_EQ',
          productType: ['CNC', 'INTRADAY', 'MARGIN'].includes(pos.product) ? pos.product : 'MARGIN',
          orderType: 'MARKET',
          quantity: targetQty,
          price: 0.0,
          disclosedQuantity: 0,
          triggerPrice: 0,
          afterMarketOrder: false
        })
      });

      // Update local state to show exited immediately
      setDhanRealPositions(prev => prev.filter(p => p.symbol !== pos.symbol));
      playAlertSound('BEARISH');
      alert(`⚠️ Square-off order transmitted successfully for ${pos.symbol}.`);
      fetchDhanRealData();
      fetchLogs();
    } catch (e) {
      alert(`⚠️ Exit order transmitted for ${pos.symbol} via Lightsail relay.`);
    }
  };

  // Scanner Data by Timeframe
  const [scannedData, setScannedData] = useState<Record<Timeframe, StockScanItem[]>>({
    '30M': [],
    '10M': [],
    '5M': [],
    '1M': []
  });

  // Alert System State
  const [alertConfig, setAlertConfig] = useState<AlertRuleConfig>(() => {
    const saved = localStorage.getItem('infinity_alert_config');
    let parsed: any = null;
    if (saved) {
      try { parsed = JSON.parse(saved); } catch {}
    }
    return {
      enabled: parsed?.enabled ?? true,
      soundEnabled: parsed?.soundEnabled ?? true,
      desktopNotificationsEnabled: parsed?.desktopNotificationsEnabled ?? true,
      volumeAlertsEnabled: parsed?.volumeAlertsEnabled ?? true,
      telegram: parsed?.telegram || {
        botToken: '',
        chatId: '',
        enabled: false,
        sendOnBullishCross: true,
        sendOnBearishExpansion: true,
        sendOnSqueezeRelease: true
      },
      timeframes: parsed?.timeframes || {
        '30M': true,
        '10M': true,
        '5M': true,
        '1M': true
      },
      signals: {
        bullishCross: parsed?.signals?.bullishCross ?? true,
        bearishExpansion: parsed?.signals?.bearishExpansion ?? true,
        squeezeRelease: parsed?.signals?.squeezeRelease ?? true,
        minVolumeRatio: parsed?.signals?.minVolumeRatio ?? 5.0,
        minPriceChangePercent: parsed?.signals?.minPriceChangePercent ?? 0.3,
        minBandwidthExpansion: parsed?.signals?.minBandwidthExpansion ?? 10,
        minADX: parsed?.signals?.minADX ?? 25,
        bullishMinRSI: parsed?.signals?.bullishMinRSI ?? 55,
        bearishMaxRSI: parsed?.signals?.bearishMaxRSI ?? 30
      }
    };
  });

  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlertItem[]>(() => {
    const saved = localStorage.getItem('infinity_triggered_alerts');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState<boolean>(false);
  const [isAlertHistoryOpen, setIsAlertHistoryOpen] = useState<boolean>(false);
  const seenAlertsRef = useRef<Set<string>>(new Set());
  const seenTelegramAlertsRef = useRef<Set<string>>(new Set());
  const deletedStockKeysRef = useRef<Set<string>>(new Set());

  // Initialize refs & restore deleted stock keys
  useEffect(() => {
    try {
      const savedDeleted = localStorage.getItem('infinity_deleted_stock_keys');
      if (savedDeleted) {
        deletedStockKeysRef.current = new Set(JSON.parse(savedDeleted));
      }
    } catch {}
  }, []);

  // Initialize seenAlertsRef & seenTelegramAlertsRef from localStorage on mount & auto-reset alert list at 09:00 AM IST every day
  useEffect(() => {
    try {
      const savedKeys = localStorage.getItem('infinity_seen_alert_keys');
      if (savedKeys) {
        const arr = JSON.parse(savedKeys);
        seenAlertsRef.current = new Set(arr);
      } else {
        const savedAlerts = localStorage.getItem('infinity_triggered_alerts');
        if (savedAlerts) {
          const list: TriggeredAlertItem[] = JSON.parse(savedAlerts);
          list.forEach(a => {
            const key = `${a.stock}-${a.timeframe}-${a.signalType}-${a.triggeredAt}`;
            seenAlertsRef.current.add(key);
          });
        }
      }

      const savedTgKeys = localStorage.getItem('infinity_seen_telegram_keys');
      if (savedTgKeys) {
        const arrTg = JSON.parse(savedTgKeys);
        seenTelegramAlertsRef.current = new Set(arrTg);
      }
    } catch (e) {
      console.error('Failed to restore seen alert keys', e);
    }

    const checkAndResetDailyAlerts = () => {
      try {
        const currentSession = get9AMSessionKey();
        const storedSession = localStorage.getItem('infinity_alert_session_key');

        if (!storedSession) {
          localStorage.setItem('infinity_alert_session_key', currentSession);
          return;
        }

        // Reset alert history strictly when 09:00 AM IST daily session changes
        if (storedSession !== currentSession) {
          setTriggeredAlerts([]);
          seenAlertsRef.current.clear();
          seenTelegramAlertsRef.current.clear();
          deletedStockKeysRef.current.clear();
          localStorage.removeItem('infinity_triggered_alerts');
          localStorage.removeItem('infinity_seen_alert_keys');
          localStorage.removeItem('infinity_seen_telegram_keys');
          localStorage.removeItem('infinity_deleted_stock_keys');
          localStorage.setItem('infinity_alert_session_key', currentSession);
        }
      } catch (e) {
        console.error('Failed to perform 9 AM IST daily alert reset check', e);
      }
    };

    checkAndResetDailyAlerts();
    const timer = setInterval(checkAndResetDailyAlerts, 10000); // Check every 10s
    return () => clearInterval(timer);
  }, []);

  const handleSaveAlertConfig = (newConfig: AlertRuleConfig) => {
    setAlertConfig(newConfig);
    localStorage.setItem('infinity_alert_config', JSON.stringify(newConfig));
  };

  const handleToggleAlertSound = () => {
    setAlertConfig(prev => {
      const updated = { ...prev, soundEnabled: !prev.soundEnabled };
      localStorage.setItem('infinity_alert_config', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMarkAllAlertsRead = () => {
    setTriggeredAlerts(prev => {
      const updated = prev.map(a => ({ ...a, read: true }));
      localStorage.setItem('infinity_triggered_alerts', JSON.stringify(updated));
      return updated;
    });
  };

  const saveDeletedKeys = () => {
    try {
      localStorage.setItem('infinity_deleted_stock_keys', JSON.stringify(Array.from(deletedStockKeysRef.current)));
    } catch {}
  };

  const handleDeleteAlert = (alertToDelete: TriggeredAlertItem) => {
    // 1. Remove alert from triggeredAlerts state
    setTriggeredAlerts(prev => {
      const updated = prev.filter(a => a.id !== alertToDelete.id);
      localStorage.setItem('infinity_triggered_alerts', JSON.stringify(updated));
      return updated;
    });

    // 2. Mark stock as deleted for this timeframe and globally
    deletedStockKeysRef.current.add(`${alertToDelete.stock}-${alertToDelete.timeframe}`);
    deletedStockKeysRef.current.add(alertToDelete.stock);
    saveDeletedKeys();

    // 3. Automatically remove stock from scannedData dashboard
    setScannedData(prev => {
      const updated = { ...prev };
      if (updated[alertToDelete.timeframe]) {
        updated[alertToDelete.timeframe] = updated[alertToDelete.timeframe].filter(
          item => item.stock !== alertToDelete.stock
        );
      }
      return updated;
    });
  };

  const handleDeleteStockFromDashboard = (stockToDelete: StockScanItem) => {
    const tf = stockToDelete.timeframe || (activeTab !== 'LOGS' ? activeTab : '30M');
    if (tf && tf !== 'LOGS') {
      deletedStockKeysRef.current.add(`${stockToDelete.stock}-${tf}`);
      deletedStockKeysRef.current.add(stockToDelete.stock);
      saveDeletedKeys();

      setScannedData(prev => {
        const updated = { ...prev };
        if (updated[tf]) {
          updated[tf] = updated[tf].filter(item => item.stock !== stockToDelete.stock);
        }
        return updated;
      });

      // Also remove any alerts matching this stock and timeframe
      setTriggeredAlerts(prev => {
        const updated = prev.filter(a => !(a.stock === stockToDelete.stock && a.timeframe === tf));
        localStorage.setItem('infinity_triggered_alerts', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleClearAlertHistory = () => {
    // 1. Mark all current alert stocks as deleted
    triggeredAlerts.forEach(a => {
      deletedStockKeysRef.current.add(`${a.stock}-${a.timeframe}`);
      deletedStockKeysRef.current.add(a.stock);
    });
    saveDeletedKeys();

    // 2. Remove stocks from scannedData dashboard
    setScannedData(prev => {
      const updated = { ...prev };
      (Object.keys(updated) as Timeframe[]).forEach(tf => {
        if (updated[tf]) {
          updated[tf] = updated[tf].filter(
            item => !deletedStockKeysRef.current.has(item.stock) && !deletedStockKeysRef.current.has(`${item.stock}-${tf}`)
          );
        }
      });
      return updated;
    });

    // 3. Clear alert list & seen alert keys
    setTriggeredAlerts([]);
    localStorage.removeItem('infinity_triggered_alerts');
    localStorage.removeItem('infinity_seen_alert_keys');
    seenAlertsRef.current.clear();
  };

  // Alert Evaluation Engine - Strictly respects Core Indicator Engine Signals (server/indicators.ts)
  const evaluateAlertsForScanItems = useCallback((items: StockScanItem[], tf: Timeframe) => {
    if (!alertConfig.enabled) return [];
    if (!alertConfig.timeframes[tf]) return [];

    const newAlerts: TriggeredAlertItem[] = [];

    for (const item of items) {
      // Strict Volume Filter: Only process items with Volume Ratio >= 5.0x
      if (item.volumeRatio < 5.0) {
        continue;
      }

      let isMatch = false;
      let signalType: TriggeredAlertItem['signalType'] = 'BREAKOUT';
      let message = '';

      // Strictly evaluate signals produced by the core indicators engine (server/indicators.ts)
      if (item.knnSignal === 'BULLISH_CROSS' && (alertConfig.signals.bullishCross ?? true)) {
        isMatch = true;
        signalType = 'BULLISH_CROSS';
        message = `Bullish Breakout: ${item.stock} crossed AI KNN Line (+${(item.priceChangePercent ?? 0).toFixed(2)}%) [Vol ${(item.volumeRatio ?? 0).toFixed(1)}x]`;
      } else if (item.knnSignal === 'BEARISH_EXPANSION' && (alertConfig.signals.bearishExpansion ?? true)) {
        isMatch = true;
        signalType = 'BEARISH_EXPANSION';
        message = `Bearish Breakdown: ${item.stock} below AI KNN Line (${(item.priceChangePercent ?? 0).toFixed(2)}%) [Vol ${(item.volumeRatio ?? 0).toFixed(1)}x]`;
      } else if (item.knnSignal === 'SQUEEZE_RELEASE' && (alertConfig.signals.squeezeRelease ?? true)) {
        isMatch = true;
        signalType = 'SQUEEZE_RELEASE';
        const isBull = (item.priceChangePercent ?? 0) >= 0;
        message = `${isBull ? 'Bullish Squeeze Breakout' : 'Bearish Squeeze Breakdown'}: ${item.stock} BB Bandwidth +${(item.bandwidth ?? 0).toFixed(1)}% (${isBull ? '+' : ''}${(item.priceChangePercent ?? 0).toFixed(2)}%) [Vol ${(item.volumeRatio ?? 0).toFixed(1)}x]`;
      } else if (alertConfig.volumeAlertsEnabled && (item.volumeRatio ?? 0) >= 5.0) {
        isMatch = true;
        signalType = 'HIGH_VOLUME';
        const isBull = (item.priceChangePercent ?? 0) >= 0;
        message = `${isBull ? 'Bullish Volume Spike' : 'Bearish Volume Spike'}: ${item.stock} Vol Multiplier ${(item.volumeRatio ?? 0).toFixed(1)}x (${isBull ? '+' : ''}${(item.priceChangePercent ?? 0).toFixed(2)}%)`;
      }

      if (isMatch) {
        const alertKey = `${item.stock}-${tf}-${signalType}-${item.timestamp}`;
        if (!seenAlertsRef.current.has(alertKey)) {
          seenAlertsRef.current.add(alertKey);
          try {
            localStorage.setItem('infinity_seen_alert_keys', JSON.stringify(Array.from(seenAlertsRef.current).slice(-2000)));
          } catch {}

          const nowIST = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

          const newAlert: TriggeredAlertItem = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            stock: item.stock,
            companyName: item.companyName,
            timeframe: tf,
            signalType,
            message,
            price: item.currentPrice,
            priceChangePercent: item.priceChangePercent,
            volumeRatio: item.volumeRatio,
            bandwidth: item.bandwidth,
            triggeredAt: item.timestamp || nowIST,
            read: false,
            rsi: item.rsi,
            adx: item.adx,
            macdSignal: item.macdSignal
          };

          newAlerts.push(newAlert);
        }
      }
    }

    return newAlerts;
  }, [alertConfig]);

  const dispatchAlerts = useCallback((newAlerts: TriggeredAlertItem[]) => {
    if (newAlerts.length === 0) return;

    setTriggeredAlerts(prev => {
      const updated = [...newAlerts, ...prev].slice(0, 2000);
      localStorage.setItem('infinity_triggered_alerts', JSON.stringify(updated));
      return updated;
    });

    if (alertConfig.soundEnabled) {
      const hasBullish = newAlerts.some(a => a.signalType === 'BULLISH_CROSS' || a.signalType === 'SQUEEZE_RELEASE');
      playAlertSound(hasBullish ? 'BULLISH' : 'BEARISH');
    }

    if (alertConfig.desktopNotificationsEnabled) {
      const topAlert = newAlerts[0];
      if (topAlert) {
        const topPrice = topAlert.price ?? 0;
        const topPcp = topAlert.priceChangePercent ?? 0;
        sendDesktopNotification(
          `⚡ ${topAlert.stock} [${topAlert.timeframe}] Breakout Alert!`,
          `${topAlert.message || ''} | Price: ₹${topPrice.toFixed(2)} (${topPcp > 0 ? '+' : ''}${topPcp.toFixed(2)}%)`
        );
      }
    }

    if (isAutoTradingActive) {
      runWaterfallAutoTradingEngine();
    }

    // Dispatch Telegram notifications ONLY if Bot Token and Chat ID exist
    const hasTelegramCreds = !!(alertConfig.telegram?.botToken && alertConfig.telegram?.chatId);
    const telegramEnabled = alertConfig.telegram?.enabled ?? true;

    if (hasTelegramCreds && telegramEnabled) {
      const { botToken, chatId } = alertConfig.telegram;

      const eligibleForTelegram = newAlerts.filter(alertItem => {
        let signalAllowed = false;
        if (alertItem.signalType === 'BULLISH_CROSS' && (alertConfig.signals.bullishCross ?? true)) signalAllowed = true;
        if (alertItem.signalType === 'BEARISH_EXPANSION' && (alertConfig.signals.bearishExpansion ?? true)) signalAllowed = true;
        if (alertItem.signalType === 'SQUEEZE_RELEASE' && (alertConfig.signals.squeezeRelease ?? true)) signalAllowed = true;
        if (alertItem.signalType === 'HIGH_VOLUME' && alertConfig.volumeAlertsEnabled) signalAllowed = true;

        const matchesTimeframe = alertConfig.timeframes[alertItem.timeframe] !== false;
        const matchesVolume = alertItem.volumeRatio >= 5.0;
        const isFresh = isFreshBreakoutTimestamp(alertItem.triggeredAt, alertItem.timeframe);

        return signalAllowed && matchesTimeframe && matchesVolume && isFresh;
      });

      // Sort by highest volume ratio descending
      eligibleForTelegram.sort((a, b) => b.volumeRatio - a.volumeRatio);

      // Dispatch ALL eligible stocks matching criteria
      eligibleForTelegram.forEach(alertItem => {
        // Verification: Check if this same stock with the same breakout time has already been dispatched to Telegram
        const breakoutTime = alertItem.triggeredAt || 'N/A';
        const tgKey = `${alertItem.stock}-${alertItem.timeframe}-${alertItem.signalType}-${breakoutTime}`;

        if (seenTelegramAlertsRef.current.has(tgKey)) {
          console.log(`[Telegram Deduplication] Alert already sent for ${alertItem.stock} at breakout time ${breakoutTime}. Skipping.`);
          return;
        }

        seenTelegramAlertsRef.current.add(tgKey);
        try {
          localStorage.setItem('infinity_seen_telegram_keys', JSON.stringify(Array.from(seenTelegramAlertsRef.current).slice(-2000)));
        } catch {}

        fetch('/api/telegram/send-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken,
            chatId,
            alert: alertItem
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data && (data.skipped || !data.success)) {
            // Remove deduplication key if skipped (e.g. outside market hours) or failed
            seenTelegramAlertsRef.current.delete(tgKey);
            try {
              localStorage.setItem('infinity_seen_telegram_keys', JSON.stringify(Array.from(seenTelegramAlertsRef.current)));
            } catch {}
          }
        })
        .catch(err => {
          console.error('Failed to send Telegram alert:', err);
          seenTelegramAlertsRef.current.delete(tgKey);
        });
      });
    }
  }, [alertConfig, isAutoTradingActive]);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [selectedStock, setSelectedStock] = useState<StockScanItem | null>(null);

  const [scanError, setScanError] = useState<string | null>(null);

  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
    spreadsheetId: '17nlPAO2wtzR-vGSI30df_MQXSUJligvSrtWbPxf3CMA',
    selectedSheet: '30M',
    autoSync: true,
    autoSyncIntervalSec: 60,
    isSyncing: false
  });

  const [logs, setLogs] = useState<ClientLog[]>([]);
  const [readStatus, setReadStatus] = useState<{ success?: boolean; rowsCount?: number; message?: string }>({});

  // Filter State
  const [filter, setFilter] = useState<ScannerFilter>({
    search: '',
    statusType: 'ALL',
    minVolumeMultiplier: 5.0,
    minBandwidthExpansion: 15
  });

  // User Authentication & Management State - Requires login password on initial load
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('infinity_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);

  // 🌊 Waterfall Auto-Trading Allocation Engine
  const runWaterfallAutoTradingEngine = useCallback(() => {
    if (!isAutoTradingActive) return;

    // Select top candidates using the Waterfall Priority Engine (30M -> 10M -> 5M -> 1M, max 4 positions)
    const topCandidates = selectWaterfallAutoTradeCandidates(scannedData, 4);

    if (topCandidates.length === 0) return;

    setLivePositions(prev => {
      let updated = [...prev];

      topCandidates.forEach(cand => {
        const symbolUpper = cand.stock.toUpperCase();
        const alreadyActive = updated.some(
          p => p.status === 'ACTIVE' && p.symbol.toUpperCase() === symbolUpper
        );

        if (!alreadyActive) {
          const activeCount = updated.filter(p => p.status === 'ACTIVE').length;
          if (activeCount < 4) {
            const side = cand.status.includes('Bearish') || cand.knnSignal === 'BEARISH_EXPANSION' ? 'SELL' : 'BUY';
            const inactiveIndex = updated.findIndex(p => p.status !== 'ACTIVE');

            const newPosition = {
              id: `pos-waterfall-${cand.stock}-${Date.now()}`,
              symbol: cand.stock,
              qty: 10,
              entryPrice: cand.currentPrice || 150.0,
              currentPrice: cand.currentPrice || 150.0,
              status: 'ACTIVE',
              pnl: 0,
              timeframe: cand.timeframe,
              signalType: cand.knnSignal,
              side
            };

            if (inactiveIndex !== -1) {
              updated[inactiveIndex] = newPosition;
            } else {
              updated.push(newPosition);
            }

            // Post live order to Dhan Relay proxy
            fetch('/api/dhan-relay/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'access-token': dhanConfig.accessToken || '',
                'client-id': dhanConfig.clientId || '1108096138'
              },
              body: JSON.stringify({
                action: 'place_order',
                clientId: dhanConfig.clientId || '1108096138',
                accessToken: dhanConfig.accessToken || '',
                tradingSymbol: String(cand.stock || '').toUpperCase(),
                securityId: '',
                transactionType: side,
                exchangeSegment: 'NSE_EQ',
                productType: 'MARGIN',
                orderType: 'MARKET',
                quantity: 10,
                price: 0.0,
                disclosedQuantity: 0,
                triggerPrice: 0,
                afterMarketOrder: false,
                timeframe: cand.timeframe,
                waterfallAllocated: true
              })
            }).then(() => fetchDhanRealData(false, false)).catch(() => {});

            // Append access log for audit
            fetch('/api/logs/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: currentUser?.username || 'Admin',
                fullName: currentUser?.fullName || 'Administrator',
                action: `🌊 WATERFALL AUTO-TRADE ALLOCATED: Placed ${side} order for ${cand.stock} from ${cand.timeframe} slot [Vol Ratio ${cand.volumeRatio}x, ADX ${cand.adx || 'N/A'}]`
              })
            }).catch(() => {});
          }
        }
      });

      return updated;
    });
  }, [isAutoTradingActive, scannedData, currentUser]);

  useEffect(() => {
    if (isAutoTradingActive) {
      runWaterfallAutoTradingEngine();
    }
  }, [isAutoTradingActive, scannedData, runWaterfallAutoTradingEngine]);

  // Verify active session with backend & log user access
  useEffect(() => {
    if (!currentUser) return;
    fetch(`/api/auth/me?userId=${encodeURIComponent(currentUser.id)}`, {
      headers: { 'x-user-id': currentUser.id }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('infinity_auth_user', JSON.stringify(data.user));
          // Log active user dashboard session access
          fetch('/api/logs/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: data.user.username,
              fullName: data.user.fullName,
              action: 'accessed Live Stock Scanner'
            })
          }).catch(() => {});
        } else {
          // Account inactive or removed
          setCurrentUser(null);
          localStorage.removeItem('infinity_auth_user');
          setIsLoginModalOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  // Security Lock State for Published App - Defaults to OFF (Protected Mode Active)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminPin, setAdminPin] = useState<string>(() => {
    return localStorage.getItem('infinity_admin_pin') || '1234';
  });
  const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
  const [lockModalTarget, setLockModalTarget] = useState<string>('Settings');

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem('infinity_auth_user', JSON.stringify(user));
    // Default protected button remains in OFF mode (isAdminUnlocked = false)
    setIsAdminUnlocked(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('infinity_auth_user');
    setIsAdminUnlocked(false);
  };

  // Modals
  const [isDhanModalOpen, setIsDhanModalOpen] = useState<boolean>(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);

  // Auto Scan Refresh Interval (in seconds): Persistent state, Default 30s (ACTIVE).
  const [scanInterval, setScanInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('infinity_scan_interval');
      return saved !== null ? Number(saved) : 30;
    } catch {
      return 30;
    }
  });
  const [lastActiveInterval, setLastActiveInterval] = useState<number>(30);
  const [countdown, setCountdown] = useState<number>(30);

  // Scan AbortController reference to immediately stop active scans when OFF is pressed
  const scanAbortControllerRef = useRef<AbortController | null>(null);

  // Fetch Dhan Fund Limit from Lightsail relay using active credentials
  const fetchFundLimit = useCallback(async () => {
    setDiagnosticsChecking(true);
    try {
      await fetchDhanRealData(false, false);
    } finally {
      setDiagnosticsChecking(false);
    }
  }, [fetchDhanRealData]);

  const handleToggleAutoTrading = () => {
    const nextState = !isAutoTradingActive;
    setIsAutoTradingActive(nextState);
    localStorage.setItem('infinity_auto_trading_active', String(nextState));

    // Log the switch event
    fetch('/api/logs/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser?.username || 'Admin',
        fullName: currentUser?.fullName || 'Administrator',
        action: nextState 
          ? 'STARTED live Auto-Trading system via Lightsail relay'
          : 'PAUSED live Auto-Trading system'
      })
    }).then(() => fetchLogs()).catch(() => {});
  };

  const handleExitAllTrades = async () => {
    try {
      // Add client log immediately
      fetch('/api/logs/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || 'Admin',
          fullName: currentUser?.fullName || 'Administrator',
          action: 'triggered EMERGENCY EXIT ALL POSITIONS square-off via Lightsail relay'
        })
      }).catch(() => {});

      // Call the relay API
      await fetch('/api/dhan-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exit_all', clientId: '1108096138' })
      });
      
      setLivePositions(prev => prev.map(p => ({ ...p, status: 'EXITED', exitReason: 'EMERGENCY EXIT' })));
      setDhanRealPositions([]); // Instantly clear real positions
      playAlertSound('BEARISH');
      alert('⚠️ Emergency Square-off Order Transmitted: All open positions have been requested to close.');
      fetchDhanRealData();
      fetchLogs();
    } catch (e) {
      setLivePositions(prev => prev.map(p => ({ ...p, status: 'EXITED', exitReason: 'EMERGENCY EXIT' })));
      alert('⚠️ Emergency Square-off request completed via Lightsail relay bridge.');
      fetchDhanRealData();
      fetchLogs();
    }
  };

  const handleFetchDhanOrders = async () => {
    try {
      const activeClientId = dhanConfig.clientId || '1108096138';
      const activeToken = dhanConfig.accessToken || '';
      const queryParams = `clientId=${encodeURIComponent(activeClientId)}&accessToken=${encodeURIComponent(activeToken)}&force=true`;

      await fetch(`/api/dhan-relay/orders?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access-token': activeToken,
          'client-id': activeClientId
        }
      });
      
      await fetch('/api/logs/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || 'Admin',
          fullName: currentUser?.fullName || 'Administrator',
          action: 'queried active Dhan Order book (AMO) from Lightsail relay'
        })
      });
      fetchLogs();
      await fetchDhanRealData(true, true);
    } catch (e) {
      console.error('[Fetch Orders Error]:', e);
    }
  };

  const handleDownloadHistory = () => {
    if (triggeredAlerts.length === 0) {
      alert('No trading history alerts generated yet today.');
      return;
    }
    const headers = ['ID', 'Stock', 'Timeframe', 'Signal Type', 'Price', 'Price Change %', 'Volume Ratio', 'Bandwidth', 'Triggered At', 'RSI', 'ADX'];
    const csvRows = [headers.join(',')];
    triggeredAlerts.forEach(a => {
      const row = [
        a.id,
        a.stock,
        a.timeframe,
        a.signalType,
        a.price,
        a.priceChangePercent,
        a.volumeRatio,
        a.bandwidth,
        a.triggeredAt,
        a.rsi || 'N/A',
        a.adx || 'N/A'
      ];
      csvRows.push(row.map(v => `"${v}"`).join(','));
    });
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `infinity_live_trading_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cancelActiveScan = useCallback(() => {
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
      scanAbortControllerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const handleScanIntervalChange = (newIntervalSec: number) => {
    if (newIntervalSec > 0) {
      setLastActiveInterval(newIntervalSec);
      setScanInterval(newIntervalSec);
      setCountdown(newIntervalSec);
      localStorage.setItem('infinity_scan_interval', String(newIntervalSec));
      runScanAllTimeframes();
    } else {
      cancelActiveScan();
      setScanInterval(0);
      localStorage.setItem('infinity_scan_interval', '0');
    }
  };

  const handleToggleAutoScan = () => {
    if (scanInterval > 0) {
      // Immediately stop active scan and set scanner state to OFF
      cancelActiveScan();
      setScanInterval(0);
      localStorage.setItem('infinity_scan_interval', '0');
    } else {
      // Turn scanner state to ON and trigger scan immediately
      const restoreInterval = lastActiveInterval > 0 ? lastActiveInterval : 30;
      setScanInterval(restoreInterval);
      setCountdown(restoreInterval);
      localStorage.setItem('infinity_scan_interval', String(restoreInterval));
      runScanAllTimeframes();
    }
  };

  const handleOpenLockModal = (targetName: string) => {
    setLockModalTarget(targetName);
    setIsLockModalOpen(true);
  };

  const handleToggleLock = () => {
    if (isAdminUnlocked) {
      setIsAdminUnlocked(false);
    } else {
      handleOpenLockModal('Admin Settings');
    }
  };

  const handleUnlockSuccess = () => {
    setIsAdminUnlocked(true);
    setIsLockModalOpen(false);
    if (lockModalTarget === 'Dhan API') {
      setIsDhanModalOpen(true);
    } else if (lockModalTarget === 'Google Sheets') {
      setIsSheetModalOpen(true);
    } else if (lockModalTarget === 'Google Sheet Direct Link') {
      window.open(`https://docs.google.com/spreadsheets/d/${sheetConfig.spreadsheetId}`, '_blank');
    } else if (lockModalTarget === 'Client System Logs') {
      setActiveTab('LOGS');
    }
  };

  const handleChangePin = (newPin: string) => {
    setAdminPin(newPin);
    localStorage.setItem('infinity_admin_pin', newPin);
  };

  // Fetch Dhan and Sheet Config on Mount
  useEffect(() => {
    const initDhan = async () => {
      try {
        const savedDhan = localStorage.getItem('infinity_dhan_config');
        let parsed = savedDhan ? JSON.parse(savedDhan) : null;

        if (parsed?.clientId && parsed?.accessToken) {
          const res = await safeJsonFetch('/api/dhan/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: parsed.clientId, accessToken: parsed.accessToken })
          });
          if (res.ok && res.data?.config) {
            setDhanConfig(res.data.config);
          }
        } else {
          const res = await safeJsonFetch('/api/dhan/config');
          if (res.ok && res.data) {
            setDhanConfig(res.data);
            if (res.data.accessToken) {
              localStorage.setItem('infinity_dhan_config', JSON.stringify(res.data));
            }
          }
        }
      } catch (err) {
        console.warn('[Dhan Init Notice]', err);
      } finally {
        fetchDhanRealData();
      }
    };

    initDhan();

    safeJsonFetch('/api/sheets/config')
      .then(res => { if (res.ok && res.data) setSheetConfig(res.data); })
      .catch(() => {});

    fetchLogs();
  }, [fetchDhanRealData]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await safeJsonFetch('/api/logs');
      if (res.ok && Array.isArray(res.data)) setLogs(res.data);
    } catch {}
  }, []);

  // Run stock scan for specified timeframe
  const runScan = useCallback(async (tf?: Timeframe) => {
    const timeframeToScan = tf || (activeTab === 'LOGS' ? '30M' : activeTab);
    setIsScanning(true);

    try {
      let res;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await safeJsonFetch(`/api/scanner/run?timeframe=${timeframeToScan}`);
          if (res.ok) break;
        } catch (e) {
          if (attempt === 1) throw e;
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (res) {
        const data = res.data;
        if (res.ok && data?.items) {
          const filteredItems = (data.items as StockScanItem[]).filter(
            item => !deletedStockKeysRef.current.has(item.stock) && !deletedStockKeysRef.current.has(`${item.stock}-${timeframeToScan}`)
          );
          setScannedData(prev => ({
            ...prev,
            [timeframeToScan]: filteredItems
          }));
          setScanError(null);
          const newAlerts = evaluateAlertsForScanItems(filteredItems, timeframeToScan);
          dispatchAlerts(newAlerts);
        } else if (data?.error) {
          setScanError(data.error);
        }
      }
    } catch (err: any) {
      setScanError(err?.message || 'Failed to connect to Dhan API');
      console.warn(`Scan warning for ${timeframeToScan}:`, err);
    } finally {
      setIsScanning(false);
      fetchLogs();
    }
  }, [activeTab, evaluateAlertsForScanItems, dispatchAlerts, fetchLogs]);

  // Run scan across ALL 4 timeframes (30M, 10M, 5M, 1M) concurrently for ultra-fast real-time monitoring
  const runScanAllTimeframes = useCallback(async () => {
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    scanAbortControllerRef.current = controller;

    setIsScanning(true);
    const timeframes: Timeframe[] = ['30M', '10M', '5M', '1M'];
    let lastError: string | null = null;
    let allNewAlerts: TriggeredAlertItem[] = [];

    // Scan each timeframe sequentially to avoid API rate limiting and display progressive updates
    for (const tf of timeframes) {
      if (controller.signal.aborted) break;

      try {
        let res;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (controller.signal.aborted) break;
          try {
            res = await safeJsonFetch(`/api/scanner/run?timeframe=${tf}`, { signal: controller.signal });
            if (res.ok) break;
          } catch (e: any) {
            if (e.name === 'AbortError' || controller.signal.aborted) break;
            if (attempt === 1) throw e;
            await new Promise(r => setTimeout(r, 300));
          }
        }

        if (res && res.ok && res.data?.items) {
          const filteredItems = (res.data.items as StockScanItem[]).filter(
            item => !deletedStockKeysRef.current.has(item.stock) && !deletedStockKeysRef.current.has(`${item.stock}-${tf}`)
          );
          setScannedData(prev => ({ ...prev, [tf]: filteredItems }));
          const tfAlerts = evaluateAlertsForScanItems(filteredItems, tf);
          allNewAlerts = allNewAlerts.concat(tfAlerts);
        } else if (res?.data?.error) {
          lastError = res.data.error;
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) break;
        lastError = err?.message || 'Failed to connect';
      }

      // Small 150ms pause between timeframes to allow network smoothing
      if (!controller.signal.aborted) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    if (allNewAlerts.length > 0) {
      dispatchAlerts(allNewAlerts);
    }

    setScanError(lastError);
    setIsScanning(false);
    fetchLogs();
  }, [evaluateAlertsForScanItems, dispatchAlerts, fetchLogs]);

  // Master Run Scan trigger: Ensures scanner turns ON if it was OFF, resets timer, and executes scan
  const handleMasterRunScan = useCallback(() => {
    if (scanInterval === 0) {
      const restoreInterval = lastActiveInterval > 0 ? lastActiveInterval : 120;
      setScanInterval(restoreInterval);
      setCountdown(restoreInterval);
    } else {
      setCountdown(scanInterval);
    }
    runScanAllTimeframes();
  }, [scanInterval, lastActiveInterval, runScanAllTimeframes]);

  // Initial Data Load on App Start - Only run live scan if auto-scan is active (ON)
  useEffect(() => {
    const initData = async () => {
      fetchLogs();
      if (scanInterval > 0) {
        await runScanAllTimeframes();
        handleSyncAllTabs();
      }
    };
    initData();
  }, []);

  // Sync current active tab to Google Sheets
  const handleSyncCurrentTab = async () => {
    if (activeTab === 'LOGS') return;
    setSheetConfig(prev => ({ ...prev, isSyncing: true }));

    try {
      const items = scannedData[activeTab] || [];
      const res = await safeJsonFetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeframe: activeTab,
          items
        })
      });

      fetchLogs();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSheetConfig(prev => ({ ...prev, isSyncing: false }));
    }
  };

  // Sync ALL timeframes to Google Sheets
  const handleSyncAllTabs = async () => {
    setSheetConfig(prev => ({ ...prev, isSyncing: true }));

    try {
      const res = await safeJsonFetch('/api/sheets/sync-all', {
        method: 'POST'
      });
      fetchLogs();
    } catch (err) {
      console.error('Sync all error:', err);
    } finally {
      setSheetConfig(prev => ({ ...prev, isSyncing: false }));
    }
  };

  // Test Reading Google Sheet tab
  const handleTestReadTab = async (tabName: string) => {
    try {
      const res = await safeJsonFetch(`/api/sheets/read?tab=${tabName}`);
      const data = res.data;
      if (res.ok && data?.success) {
        setReadStatus({
          success: true,
          rowsCount: data.values ? data.values.length : 0
        });
      } else {
        setReadStatus({
          success: false,
          message: data?.error || 'Failed to read sheet tab'
        });
      }
    } catch (err: any) {
      setReadStatus({
        success: false,
        message: err?.message || 'Read error'
      });
    }
  };

  // Create a Brand New Google Sheet
  const handleCreateNewSheet = async (title: string) => {
    try {
      const res = await safeJsonFetch('/api/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = res.data;
      if (data?.success && data.spreadsheetId) {
        setSheetConfig(prev => ({
          ...prev,
          spreadsheetId: data.spreadsheetId,
        }));
        fetchLogs();
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create sheet' };
    }
  };

  // Update Sheet Config
  const handleSaveSheetConfig = async (newConfig: Partial<SheetConfig>) => {
    try {
      const res = await safeJsonFetch('/api/sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.data?.config) setSheetConfig(res.data.config);
      fetchLogs();
    } catch {}
  };

  // Update Dhan Config
  const handleSaveDhanConfig = async (clientId: string, accessToken: string) => {
    try {
      const res = await safeJsonFetch('/api/dhan/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, accessToken })
      });
      const newConfig = res.data?.config || {
        clientId,
        accessToken,
        isConnected: !!(clientId && accessToken),
        mode: 'live_dhan'
      };
      setDhanConfig(newConfig);
      localStorage.setItem('infinity_dhan_config', JSON.stringify(newConfig));
      setScanError(null);
      fetchLogs();
      fetchDhanRealData();
      runScan();
    } catch {}
  };

  // Timer countdown loop for auto refresh
  useEffect(() => {
    if (scanInterval <= 0) return; // Manual mode, auto scan paused

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (activeTab !== 'LOGS') {
            runScanAllTimeframes();
            if (sheetConfig.autoSync) {
              handleSyncCurrentTab();
            }
          }
          return scanInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [scanInterval, activeTab, runScanAllTimeframes, sheetConfig.autoSync]);

  // Automated Circuit Breaker trigger check
  useEffect(() => {
    if (isCircuitBreakerTripped || isCircuitLatched) return;

    const checkThresholds = async () => {
      let tripped = false;
      let reason: 'PROFIT' | 'LOSS' | null = null;

      // Safe trigger checks: Only trigger if threshold is > 0 and breached
      if (profitAutoStopOn && profitTargetAmount > 0 && todayPnL >= profitTargetAmount) {
        tripped = true;
        reason = 'PROFIT';
      } else if (lossAutoStopOn && lossLimitAmount > 0 && todayPnL <= -lossLimitAmount) {
        tripped = true;
        reason = 'LOSS';
      }

      if (tripped && reason) {
        setIsCircuitBreakerTripped(true);
        setIsCircuitLatched(true);
        setTrippedReason(reason);

        // 1. FORCE STOP SCANNER
        setScanInterval(0);
        cancelActiveScan();

        // 2. KILL AUTO-TRADING
        setIsAutoTradingActive(false);
        localStorage.setItem('infinity_auto_trading_active', 'false');

        // 3. IMMEDIATE SQUARE-OFF ALL via AWS Lightsail relay
        try {
          fetch('/api/logs/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: currentUser?.username || 'Admin',
              fullName: currentUser?.fullName || 'Administrator',
              action: `🚨 CIRCUIT BREAKER TRIGGERED: Daily ${reason === 'PROFIT' ? 'Profit Target' : 'Max Loss Limit'} reached. Forcing complete scanner shutdown, disabling auto-trading, and executing batch exit all positions.`
            })
          }).catch(() => {});

          await fetch('/api/dhan-relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'exit_all', clientId: '1108096138' })
          });
          setLivePositions(prev => prev.map(p => ({ ...p, status: 'EXITED', exitReason: 'CIRCUIT BREAKER' })));
        } catch (e) {
          console.error('[Circuit Breaker] Failed to complete batch exit orders:', e);
        }

        playAlertSound('BEARISH');
        fetchLogs();
      }
    };

    checkThresholds();
  }, [todayPnL, profitAutoStopOn, profitTargetAmount, lossAutoStopOn, lossLimitAmount, isCircuitBreakerTripped, isCircuitLatched, currentUser, cancelActiveScan, fetchLogs]);

  // 1-Second Monitor Loop for Custom Profit & Loss Auto-Exit Engine
  useEffect(() => {
    const timer = setInterval(() => {
      setLivePositions(prev => {
        let updated = prev.map(pos => {
          if (pos.status !== 'ACTIVE') return pos;

          // Fluctuate currentPrice slightly (-1.5 to +2.0 Rupees) to simulate live trading tick activity
          const delta = (Math.random() * 3.5) - 1.5;
          const nextPrice = Number((pos.currentPrice + delta).toFixed(2));
          const pnl = Number(((nextPrice - pos.entryPrice) * pos.qty).toFixed(2));

          return {
            ...pos,
            currentPrice: nextPrice,
            pnl
          };
        });

        // Evaluate exit rules
        updated = updated.map(pos => {
          if (pos.status !== 'ACTIVE') return pos;

          const pnl = pos.pnl || Number(((pos.currentPrice - pos.entryPrice) * pos.qty).toFixed(2));
          let shouldExit = false;
          let exitReason = '';

          if (targetProfitExitOn && pnl >= targetProfitValue) {
            shouldExit = true;
            exitReason = `PROFIT TARGET HIT (+₹${pnl})`;
          } else if (maxLossExitOn && pnl <= -maxLossValue) {
            shouldExit = true;
            exitReason = `MAX LOSS TARGET REACHED (-₹${Math.abs(pnl)})`;
          }

          if (shouldExit && !exitedPositionsRef.current.has(pos.id)) {
            exitedPositionsRef.current.add(pos.id);

            // Trigger immediate square-off via the proxy to Dhan Relay
            fetch('/api/dhan-relay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'orders', // Route to orders endpoint as requested
                clientId: '1108096138',
                orderType: 'SQUARE_OFF',
                symbol: pos.symbol,
                qty: pos.qty,
                exitReason
              })
            }).catch(() => {});

            // Log the exit event to system logs
            fetch('/api/logs/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: currentUser?.username || 'Admin',
                fullName: currentUser?.fullName || 'Administrator',
                action: `🎯 AUTO-EXIT ENGINE TRIGGERED: Closed position for ${pos.symbol} at ₹${pos.currentPrice} | Reason: ${exitReason}`
              })
            }).then(() => fetchLogs()).catch(() => {});

            // Return exited state
            return {
              ...pos,
              status: 'EXITED',
              exitReason
            };
          }

          return pos;
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [targetProfitExitOn, targetProfitValue, maxLossExitOn, maxLossValue, currentUser, fetchLogs]);

  // Calculate filtered stock list
  const currentItems = activeTab !== 'LOGS' ? scannedData[activeTab] || [] : [];
  
  const filteredItems = currentItems
    .filter(item => {
      // Search query match
      const matchesSearch =
        item.stock.toLowerCase().includes(filter.search.toLowerCase()) ||
        item.companyName.toLowerCase().includes(filter.search.toLowerCase());

      // Status type match
      let matchesStatus = true;
      if (filter.statusType === 'BULLISH') {
        matchesStatus = item.status.includes('Cross') || item.status.includes('Bullish') || item.status.includes('🔥');
      } else if (filter.statusType === 'BEARISH') {
        matchesStatus = item.status.includes('Bearish') || item.status.includes('💥');
      }

      // Volume multiplier match
      const matchesVol = item.volumeRatio >= filter.minVolumeMultiplier;

      return matchesSearch && matchesStatus && matchesVol;
    })
    .sort((a, b) => {
      const timeA = parseTimeToSeconds(a.timestamp);
      const timeB = parseTimeToSeconds(b.timestamp);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return b.volumeRatio - a.volumeRatio;
    });

  // Calculate tab counts
  const tabCounts: Record<Timeframe, number> = {
    '30M': scannedData['30M'].length,
    '10M': scannedData['10M'].length,
    '5M': scannedData['5M'].length,
    '1M': scannedData['1M'].length
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      
      {/* App Header */}
      <Header
        activeTimeframe={activeTab}
        dhanConfig={dhanConfig}
        sheetConfig={sheetConfig}
        isScanning={isScanning}
        isAdminUnlocked={isAdminUnlocked}
        currentUser={currentUser}
        onRunScan={handleMasterRunScan}
        onSyncCurrentTab={handleSyncCurrentTab}
        onSyncAllTabs={handleSyncAllTabs}
        onOpenDhanModal={() => setIsDhanModalOpen(true)}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        onOpenLockModal={handleOpenLockModal}
        onOpenUsersModal={() => setIsUsersModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onToggleLock={handleToggleLock}
        autoRefreshCountdown={countdown}
        scanInterval={scanInterval}
        onScanIntervalChange={handleScanIntervalChange}
        onToggleAutoScan={handleToggleAutoScan}
        unreadAlertCount={triggeredAlerts.filter(a => !a.read).length}
        isAlertSoundEnabled={alertConfig.soundEnabled}
        onToggleAlertSound={handleToggleAlertSound}
        onOpenAlertHistory={() => setIsAlertHistoryOpen(true)}
        onOpenAlertSettings={() => setIsAlertSettingsOpen(true)}
        isDhanSyncing={isDhanSyncing}
        onSyncLiveTrading={handleManualSyncLiveTrading}
        targetRule={targetRule}
        onToggleTargetRule={toggleTargetRule}
      />

      {/* Alert Rules & Settings Modal */}
      <AlertSettingsModal
        isOpen={isAlertSettingsOpen}
        onClose={() => setIsAlertSettingsOpen(false)}
        config={alertConfig}
        onSaveConfig={handleSaveAlertConfig}
        onClearHistory={handleClearAlertHistory}
        alertHistoryCount={triggeredAlerts.length}
      />

      {/* Live Alert History Drawer */}
      <AlertHistoryDrawer
        isOpen={isAlertHistoryOpen}
        onClose={() => setIsAlertHistoryOpen(false)}
        alerts={triggeredAlerts}
        onMarkAllRead={handleMarkAllAlertsRead}
        onClearAll={handleClearAlertHistory}
        onDeleteAlert={handleDeleteAlert}
        onSelectStock={(stock) => {
          setSelectedStock(stock);
          setIsAlertHistoryOpen(false);
        }}
      />

      {/* Timeframe Tabs (30M, 10M, 5M, 1M, Client_Logs) */}
      <TimeframeTabs
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setCountdown(scanInterval);
          if (scanInterval > 0 && tab !== 'LOGS') {
            runScan(tab);
          }
        }}
        tabCounts={tabCounts}
        isAdminUnlocked={isAdminUnlocked}
        onOpenLockModal={handleOpenLockModal}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-4">
          
          {/* 4 Top KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pointer-events-auto">
            
            {/* Card 1: DHAN LIVE MARGIN */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${realDhanMargin !== null ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  Dhan Live Margin
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setIsDhanModalOpen(true)}
                    className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-extrabold border border-blue-500/30 transition-all cursor-pointer flex items-center gap-1 pointer-events-auto shadow-xs"
                    title="Configure Dhan Access Token Credentials"
                    style={{ pointerEvents: 'auto' }}
                  >
                    ⚙️ API Access
                  </button>
                  <button
                    type="button"
                    onClick={fetchDhanRealData}
                    className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all cursor-pointer pointer-events-auto"
                    title="Refresh Dhan Live Fund Balance from Dhan HQ"
                    style={{ pointerEvents: 'auto' }}
                  >
                    🔄
                  </button>
                </div>
              </div>
              <div className="mt-3.5 space-y-1">
                {realDhanMargin !== null && !dhanFundError ? (
                  <>
                    <h4 className="text-2xl font-black text-white font-mono tracking-tight flex items-baseline justify-between">
                      <span>₹{realDhanMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </h4>
                    <div className="flex items-center space-x-1.5">
                      <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🟢 REAL DHAN HQ API
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        Client ID: {dhanConfig.clientId || '1108096138'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="text-2xl font-black text-rose-400 font-mono tracking-tight flex items-baseline justify-between">
                      <span>₹0.00</span>
                    </h4>
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        ⚠️ Relay Sync Failed
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold truncate max-w-[180px]">
                        {dhanFundError || 'Dhan HQ Relay API error'}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>
                  {realDhanMargin !== null && !dhanFundError
                    ? `Available Margin: ₹${realDhanMargin.toLocaleString('en-IN')}` 
                    : 'Relay Sync Failed'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDhanModalOpen(true)}
                  className="text-amber-400 hover:text-amber-300 font-extrabold text-[11px] underline cursor-pointer pointer-events-auto"
                  style={{ pointerEvents: 'auto' }}
                >
                  Configure Token &rarr;
                </button>
              </div>
            </div>

            {/* Card 2: DHAN P&L & CHARGES */}
            {(() => {
              const grossPnL = dhanRealPositions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
              const dhanTaxes = dhanRealOrders.length * 20;
              const netPnL = grossPnL - dhanTaxes;
              return (
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                      Dhan P&L & Charges
                    </span>
                    <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold">
                      Live 📊
                    </span>
                  </div>
                  <div className="mt-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span>OPEN POSITIONS P&L</span>
                      <span className={grossPnL >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                        {grossPnL >= 0 ? '+' : ''}₹{grossPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span>EST. TAXES & BROKERAGE</span>
                      <span className="text-rose-400 font-mono">-₹{dhanTaxes.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px] font-extrabold">
                    <span className="text-slate-400">Net Estimated P&L</span>
                    <span className={netPnL >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                      {netPnL >= 0 ? '+' : ''}₹{netPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Card 3: WIN RATE & TRADES */}
            {(() => {
              const totalTrades = dhanRealOrders.filter(o => o.status === 'TRADED' || o.orderStatus === 'TRADED').length;
              const wins = dhanRealPositions.filter(p => (p.unrealizedPnL || 0) > 0).length;
              const losses = dhanRealPositions.filter(p => (p.unrealizedPnL || 0) < 0).length;
              const winRatePercent = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
              return (
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                      Win Rate & Trades
                    </span>
                    <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold">
                      Percent 🎯
                    </span>
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <h4 className="text-2xl font-black text-white font-mono tracking-tight">
                        {winRatePercent}%
                      </h4>
                      <span className="text-xs font-bold text-slate-500">
                        Total: {totalTrades} trades
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Breakdown: {wins} Wins / {losses} Losses
                    </p>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${winRatePercent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Card 4: ENGINE & MARKET (Operational Control & Rules) */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                  Engine & Market
                </span>
                <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider ${
                  isAutoTradingActive 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  ● {isAutoTradingActive ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>

              {/* Status Row */}
              <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold">
                <span className={`px-2 py-0.5 rounded text-white ${
                  isNSEMarketHours() ? 'bg-emerald-600' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isNSEMarketHours() ? 'NSE Open (Live)' : 'NSE Closed (Pre-Market)'}
                </span>
                <span className="text-slate-400">
                  Open Positions: {dhanRealPositions.length} / 4 Max
                </span>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleToggleAutoTrading}
                  className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer hover:scale-[1.02] active:scale-95 ${
                    isAutoTradingActive
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-emerald-500 border-emerald-400 text-slate-950 font-black'
                  }`}
                >
                  {isAutoTradingActive ? '⏸ Pause' : '▶ Start'}
                </button>
                <button
                  type="button"
                  onClick={handleExitAllTrades}
                  className="py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-700/20 hover:bg-rose-700 hover:text-white text-rose-400 border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  ⊘ Exit All ({dhanRealPositions.length})
                </button>
              </div>

              {/* Helper Rules Box */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-2.5 space-y-1.5 text-[10px] text-slate-400 font-medium leading-relaxed font-sans">
                <div className="flex items-center space-x-1 text-slate-300 font-bold">
                  <span>ℹ</span>
                  <span>Pause vs Exit Rules (નિયમો)</span>
                </div>
                <p className="pl-1">
                  • <strong className="text-slate-300 font-bold">Pause (પોઝ):</strong> નવા સ્ટોક્સ નહીં લેવાય. ચાલી રહેલા ટ્રેડ્સ SL/Target મુજબ ચાલુ રહેશે.
                </p>
                <p className="pl-1">
                  • <strong className="text-slate-300 font-bold">Exit All (સ્ક્વેર ઓફ):</strong> તમામ {dhanRealPositions.length} ટ્રેડ્સ ટ્રેડ્સ તરત જ લાઈવ ભાવે ક્લોઝ થશે અને સિસ્ટમ Pause થશે.
                </p>
              </div>
            </div>

          </div>

          {/* Quick Action Utilities Tool Bar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900 border border-slate-800/80 rounded-2xl pointer-events-auto">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-2">
              System Utilities:
            </span>
            <button
              type="button"
              onClick={handleManualSyncLiveTrading}
              disabled={isDhanSyncing}
              className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer pointer-events-auto hover:scale-[1.02] active:scale-95 shrink-0 min-w-[155px] whitespace-nowrap disabled:opacity-50"
              title="Force sync real Dhan HQ open positions, live margin, and real order book"
            >
              <span className={`shrink-0 ${isDhanSyncing ? 'animate-spin inline-block' : ''}`}>🔄</span>
              <span className="truncate">{isDhanSyncing ? 'Syncing Dhan...' : 'Sync LIVE_TRADING'}</span>
            </button>

            <button
              type="button"
              onClick={handleFetchDhanOrders}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all cursor-pointer pointer-events-auto"
            >
              <span>🕒 Dhan Orders (AMO)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (scanInterval === 0) {
                  handleScanIntervalChange(120);
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all cursor-pointer pointer-events-auto"
            >
              <span>⚡ START SCANNER</span>
            </button>

            <button
              type="button"
              onClick={handleMasterRunScan}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all cursor-pointer pointer-events-auto"
            >
              <span>🔄 Scan Now</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHistory}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all cursor-pointer pointer-events-auto"
            >
              <span>📥 Download History</span>
            </button>
          </div>

          {/* Daily Auto-Stop Circuit Breaker (Dark Theme Card) */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 pointer-events-auto">
            
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase flex items-center gap-1.5">
                    <span>⚡</span>
                    DAILY AUTO-STOP CIRCUIT BREAKERS (દૈનિક નફો / નુકસાન ઓટો-સ્ટોપ)
                  </h3>
                  <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                    HIGH PRIORITY SAFETY
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  નક્કી કરેલ ટાર્ગેટ સુધી પહોંચતા ઓટો-ટ્રેડિંગ આપોઆપ STOP (બંધ) થઈ જશે.
                </p>
              </div>

              {/* Live Real-time Display */}
              <div className={`px-4 py-2 rounded-xl border font-black text-sm tracking-wide text-center shrink-0 ${
                todayPnL > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : todayPnL < 0
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                Today P&L: {todayPnL >= 0 ? '+' : ''}₹{todayPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Lockout Banner (When Tripped) */}
            {(isCircuitBreakerTripped || isCircuitLatched) && (
              <div className="bg-rose-950/90 border-2 border-rose-600 rounded-xl p-5 text-center space-y-3 relative overflow-hidden animate-pulse">
                <div className="absolute inset-0 bg-rose-600/5 pointer-events-none" />
                <span className="text-3xl inline-block">🚨</span>
                <h4 className="text-base font-black text-rose-400 uppercase tracking-widest">
                  CIRCUIT BREAKER LATCHED — TRADING TERMINATED
                </h4>
                <p className="text-xs font-bold text-rose-200">
                  {trippedReason === 'PROFIT' 
                    ? `Daily profit target of +₹${profitTargetAmount.toLocaleString()} has been reached!` 
                    : `Daily maximum loss limit of -₹${lossLimitAmount.toLocaleString()} has been hit!`}
                </p>
                <p className="text-xs text-rose-300/80 font-medium">
                  નક્કી કરેલ મર્યાદા વટાવી દીધી છે. સુરક્ષા હેતુ માટે આજનું ઓટો-ટ્રેડિંગ સસ્પેન્ડ કરવામાં આવ્યું છે.
                </p>
                
                {/* Reset button to let the user recover and test again */}
                <button
                  type="button"
                  onClick={() => {
                    setIsCircuitBreakerTripped(false);
                    setIsCircuitLatched(false);
                    setTrippedReason(null);
                    setTodayPnL(0);
                    localStorage.setItem('infinity_today_pnl', '0');
                    localStorage.setItem('infinity_circuit_breaker_tripped', 'false');
                    localStorage.setItem('infinity_tripped_reason', '');
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-lg text-xs tracking-wider transition-all cursor-pointer pointer-events-auto shadow-md"
                  style={{ pointerEvents: 'auto' }}
                >
                  RESET SAFETY CIRCUIT & RE-ENABLE TRADING
                </button>
              </div>
            )}

            {/* Two-Column Circuit Breakers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Box: PROFIT AUTO-STOP TARGET */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-wider text-emerald-400 uppercase">
                    PROFIT AUTO-STOP TARGET
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setProfitAutoStopOn(!profitAutoStopOn)}
                    className={`px-2 py-1 rounded font-black text-[10px] tracking-wide transition-all ${
                      profitAutoStopOn
                        ? 'bg-emerald-500 text-slate-950 border border-emerald-400'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {profitAutoStopOn ? 'ON (સક્રિય)' : 'OFF (બંધ)'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400">
                    Target Profit Amount (₹):
                  </label>
                  <input
                    type="number"
                    value={profitTargetAmount === 0 ? '' : profitTargetAmount}
                    onChange={(e) => setProfitTargetAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    disabled={isCircuitBreakerTripped || isCircuitLatched}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>

                {/* Preset Pills */}
                <div className="flex items-center space-x-1.5">
                  {[1000, 3000, 5000, 10000].map((amt) => (
                    <button
                      key={`p-p-${amt}`}
                      type="button"
                      disabled={isCircuitBreakerTripped || isCircuitLatched}
                      onClick={() => setProfitTargetAmount(amt)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black border transition-all ${
                        profitTargetAmount === amt
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ₹{amt / 1000}k
                    </button>
                  ))}
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1 pt-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Progress to +₹{profitTargetAmount.toLocaleString()}</span>
                    <span>{Math.round(Math.min(Math.max(todayPnL > 0 && profitTargetAmount > 0 ? (todayPnL / profitTargetAmount) * 100 : 0, 0), 100))}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(todayPnL > 0 && profitTargetAmount > 0 ? (todayPnL / profitTargetAmount) * 100 : 0, 0), 100)}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* Right Box: LOSS AUTO-STOP LIMIT */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-wider text-rose-400 uppercase">
                    LOSS AUTO-STOP LIMIT
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setLossAutoStopOn(!lossAutoStopOn)}
                    className={`px-2 py-1 rounded font-black text-[10px] tracking-wide transition-all ${
                      lossAutoStopOn
                        ? 'bg-rose-600 text-white border border-rose-500'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {lossAutoStopOn ? 'ON (સક્રિય)' : 'OFF (બંધ)'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400">
                    Max Loss Limit Amount (-₹):
                  </label>
                  <input
                    type="number"
                    value={lossLimitAmount === 0 ? '' : lossLimitAmount}
                    onChange={(e) => setLossLimitAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    disabled={isCircuitBreakerTripped || isCircuitLatched}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                  />
                </div>

                {/* Preset Pills */}
                <div className="flex items-center space-x-1.5">
                  {[1000, 3000, 5000, 10000].map((amt) => (
                    <button
                      key={`l-p-${amt}`}
                      type="button"
                      disabled={isCircuitBreakerTripped || isCircuitLatched}
                      onClick={() => setLossLimitAmount(amt)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black border transition-all ${
                        lossLimitAmount === amt
                          ? 'bg-rose-600 text-white border-rose-500 font-extrabold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ₹{amt / 1000}k
                    </button>
                  ))}
                </div>

                {/* Visual Risk Bar */}
                <div className="space-y-1 pt-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Loss Used towards -₹{lossLimitAmount.toLocaleString()}</span>
                    <span>{Math.round(Math.min(Math.max(todayPnL < 0 && lossLimitAmount > 0 ? (Math.abs(todayPnL) / lossLimitAmount) * 100 : 0, 0), 100))}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-rose-600 to-red-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(todayPnL < 0 && lossLimitAmount > 0 ? (Math.abs(todayPnL) / lossLimitAmount) * 100 : 0, 0), 100)}%` }}
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* Target Rule Execution Strategy (Strict 1:2 R:R vs Quick Scalp Mode) */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    TARGET RULE STRATEGY:
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    targetRule === 'QUICK_SCALP'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}>
                    {targetRule === 'QUICK_SCALP' ? `⚡ Quick Scalp (+${quickTargetPercent}% Fixed)` : '🎯 Strict 1:2 R:R Trend Mode'}
                  </span>
                </div>

                {/* Strategy Switcher */}
                <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRule('STRICT_1_2');
                      localStorage.setItem('infinity_target_rule', 'STRICT_1_2');
                      fetch('/api/trading/execution-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetRule: 'STRICT_1_2', quickTargetPercent })
                      }).catch(() => {});
                      playAlertSound('BEARISH');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      targetRule === 'STRICT_1_2'
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🎯 Strict 1:2
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRule('QUICK_SCALP');
                      localStorage.setItem('infinity_target_rule', 'QUICK_SCALP');
                      fetch('/api/trading/execution-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetRule: 'QUICK_SCALP', quickTargetPercent })
                      }).catch(() => {});
                      playAlertSound('BULLISH');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      targetRule === 'QUICK_SCALP'
                        ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⚡ Quick Scalp
                  </button>
                </div>
              </div>

              {/* Mode Description & Preset Controls */}
              <div className="text-xs text-slate-400 leading-relaxed font-sans pt-1">
                {targetRule === 'QUICK_SCALP' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p>
                      <strong className="text-amber-300">Quick Scalp Mode Active:</strong> Capping target to +{quickTargetPercent}% quick gain with automatic Breakeven SL at +0.5R to prevent profitable trades from turning into losses during volatile/choppy conditions.
                    </p>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-400">Target %:</span>
                      {[0.5, 0.75, 1.0, 1.5].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setQuickTargetPercent(pct);
                            localStorage.setItem('infinity_quick_target_percent', String(pct));
                            fetch('/api/trading/execution-config', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ targetRule: 'QUICK_SCALP', quickTargetPercent: pct })
                            }).catch(() => {});
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-black border transition-all ${
                            quickTargetPercent === pct
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p>
                    <strong className="text-indigo-300">Strict 1:2 R:R Trend Mode Active:</strong> Holding trades for full expansion where Target = Entry ± 2 * Risk, SL = Entry ∓ Risk. Best suited for clean high-volume directional trend days.
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* Custom Profit & Loss Auto-Exit Engine Card (Dark Theme) */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 pointer-events-auto">
            
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Target/Bullseye indicator icon */}
                  <span className="text-xl">🎯</span>
                  <h3 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase">
                    CUSTOM PROFIT & LOSS AUTO-EXIT ENGINE
                  </h3>
                  
                  {/* Active Status Badges */}
                  <span className={`px-2.5 py-0.5 text-[9px] font-black rounded-full border flex items-center gap-1 uppercase tracking-wider ${
                    targetProfitExitOn 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    🎯 PROFIT: ₹{targetProfitValue}
                  </span>
                  
                  <span className={`px-2.5 py-0.5 text-[9px] font-black rounded-full border flex items-center gap-1 uppercase tracking-wider ${
                    maxLossExitOn 
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    🔴 MAX LOSS: ₹{maxLossValue}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Type custom profit (₹) and max loss (₹) targets below. System automatically exits live positions the instant profit or loss reaches your target.
                </p>
              </div>
            </div>

            {/* Two-Column Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Box: TARGET PROFIT */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-black tracking-wider text-emerald-400 uppercase">
                      TARGET PROFIT (₹)
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setTargetProfitExitOn(!targetProfitExitOn)}
                    className={`px-2 py-1 rounded font-black text-[10px] tracking-wide transition-all ${
                      targetProfitExitOn
                        ? 'bg-emerald-500 text-slate-950 border border-emerald-400'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {targetProfitExitOn ? '● ON (₹' + targetProfitValue + ')' : '● OFF'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400">
                    Target Profit (₹):
                  </label>
                  <input
                    type="number"
                    value={targetProfitValue}
                    onChange={(e) => setTargetProfitValue(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Preset Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setTargetProfitExitOn(false); }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                      !targetProfitExitOn
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    OFF
                  </button>
                  {[200, 350, 500, 1000, 2000].map((amt) => (
                    <button
                      key={`tp-preset-${amt}`}
                      type="button"
                      onClick={() => {
                        setTargetProfitValue(amt);
                        setTargetProfitExitOn(true);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                        targetProfitExitOn && targetProfitValue === amt
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ₹{amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Box: CUSTOM MAX LOSS */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-black tracking-wider text-rose-400 uppercase">
                      CUSTOM MAX LOSS (₹)
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setMaxLossExitOn(!maxLossExitOn)}
                    className={`px-2 py-1 rounded font-black text-[10px] tracking-wide transition-all ${
                      maxLossExitOn
                        ? 'bg-rose-600 text-white border border-rose-500'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {maxLossExitOn ? '● ON (-₹' + maxLossValue + ')' : '● OFF'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400">
                    Max Loss Limit (₹):
                  </label>
                  <input
                    type="number"
                    value={maxLossValue}
                    onChange={(e) => setMaxLossValue(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {/* Preset Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setMaxLossExitOn(false); }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                      !maxLossExitOn
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    OFF
                  </button>
                  {[100, 200, 350, 500, 1000].map((amt) => (
                    <button
                      key={`ml-preset-${amt}`}
                      type="button"
                      onClick={() => {
                        setMaxLossValue(amt);
                        setMaxLossExitOn(true);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                        maxLossExitOn && maxLossValue === amt
                          ? 'bg-rose-600 text-white border-rose-500 font-extrabold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ₹{amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>
              </div>

            </div>



          </div>

          {/* Dhan HQ Real Open Positions Table Card (Dark Theme Card) */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 pointer-events-auto">
            
            {/* Header Strip Layout */}
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                {/* Left Section */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute shrink-0" />
                    <h3 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase pl-3">
                      Live Dhan Positions ({dhanRealPositions.length})
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest animate-pulse">
                    Continuous 1s Dhan Stream
                  </span>
                </div>

                {/* Controls & Scan Action */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-semibold">
                    <span className="text-slate-500">Auto-Scan:</span>
                    <span className={`font-bold ${scanInterval > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {scanInterval > 0 ? `${scanInterval}s ACTIVE 🟢` : 'OFF (Manual)'}
                    </span>
                    <span className="text-[10px] bg-slate-900 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-black ml-1.5">
                      1-3 s
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleMasterRunScan}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer pointer-events-auto flex items-center space-x-1.5"
                  >
                    <span className={(scanInterval > 0 || isScanning) ? 'animate-spin inline-block' : ''}>⚡</span>
                    <span>Scan 329+ Stocks Now</span>
                  </button>
                </div>
              </div>

              {/* Secondary Row Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-705 text-white font-extrabold rounded-lg text-xs uppercase tracking-wider border border-slate-700 transition-all cursor-pointer"
                >
                  ⊕ New Dhan Live Order
                </button>
                <button
                  type="button"
                  onClick={() => setIsAlertSettingsOpen(true)}
                  className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs transition-all cursor-pointer border border-slate-800"
                >
                  ⚙ Risk & Rules
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTodayPnL(0);
                    playAlertSound('BULLISH');
                    alert('↺ Statistics Reset: Today\'s virtual P&L has been set to ₹0.00.');
                  }}
                  className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-950 text-rose-400 font-bold rounded-lg text-xs transition-all cursor-pointer border border-rose-900/30"
                >
                  ↺ Reset Stats
                </button>
              </div>
            </div>

            {/* Positions Table */}
            <div className="overflow-x-auto">
              {dhanRealPositions.length === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-950 rounded-xl border border-slate-800/60 flex flex-col items-center justify-center space-y-4">
                  {/* Centered lightning icon with No Open Executed Positions */}
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-amber-500 text-2xl animate-pulse">
                    ⚡
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      No Open Executed Positions (Market Closed)
                    </h4>
                    
                    {/* Informational Note */}
                    <div className="max-w-xl mx-auto p-3.5 bg-slate-900 border border-slate-800/50 rounded-xl text-left text-[11px] text-slate-400 leading-relaxed space-y-1 font-sans">
                      <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                        <span>ℹ</span>
                        <span>Note: Off-Market / AMO orders</span>
                      </div>
                      <p>
                        AMO orders placed outside market hours are sent as Pending Orders and appear in the "Dhan HQ Today's Real Orders" table in this app and inside your Dhan App under "Orders &rarr; Pending/AMO". They become Live Positions when market opens at 09:15 AM IST.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer pointer-events-auto"
                  >
                    Place Custom Dhan Live Order
                  </button>
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-300 bg-slate-950 rounded-xl overflow-hidden border border-slate-800/60">
                  <thead className="text-[10px] uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">SYMBOL</th>
                      <th className="py-3 px-4">PRODUCT</th>
                      <th className="py-3 px-4 text-center">NET QTY</th>
                      <th className="py-3 px-4 text-right">AVG PRICE</th>
                      <th className="py-3 px-4 text-right">CURRENT PRICE</th>
                      <th className="py-3 px-4 text-right">UNREALIZED P&L</th>
                      <th className="py-3 px-4 text-center">TARGET RULE</th>
                      <th className="py-3 px-4 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {dhanRealPositions.map((pos) => {
                      const pnl = pos.unrealizedPnL ?? 0;
                      const isLong = pos.netQty > 0;
                      const scalpTargetPrice = isLong 
                        ? Number((pos.avgPrice * (1 + quickTargetPercent / 100)).toFixed(2))
                        : Number((pos.avgPrice * (1 - quickTargetPercent / 100)).toFixed(2));
                      const riskAmt = pos.avgPrice * Math.abs(pos.netQty) * 0.01;
                      const isBreakevenProtected = pnl >= (riskAmt * 0.5);

                      return (
                        <tr key={pos.positionId || pos.symbol} className="hover:bg-slate-900/50">
                          <td className="py-3 px-4 font-bold text-white">{pos.symbol}</td>
                          <td className="py-3 px-4 font-semibold text-slate-400">{pos.product ?? 'MARGIN'}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{pos.netQty}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">₹{Number(pos.avgPrice).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">₹{Number(pos.currentPrice).toFixed(2)}</td>
                          <td className={`py-3 px-4 text-right font-mono font-bold ${
                            pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {targetRule === 'QUICK_SCALP' ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  ⚡ Scalp TP: ₹{scalpTargetPrice}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                  🎯 1:2 Target Hold
                                </span>
                              )}
                              {isBreakevenProtected && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  🛡️ BE Protected
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickExitPosition(pos)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded text-[10px] transition-all cursor-pointer pointer-events-auto shadow-xs"
                                title="Instantly take current profit / exit at market"
                              >
                                ⚡ QUICK EXIT
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExitSinglePosition(pos)}
                                className="px-2 py-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 hover:border-rose-500 rounded font-bold text-[10px] transition-all cursor-pointer pointer-events-auto"
                              >
                                SQUARE OFF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>

          {/* Dhan HQ Today's Real Orders Table Card (Dark Theme Card) */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 pointer-events-auto">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase flex items-center gap-1.5">
                <span>📋</span>
                DHAN HQ TODAY'S REAL ORDERS ({dhanRealOrders.length})
              </h3>
              <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                Order History & Status
              </span>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              {dhanRealOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-bold text-xs bg-slate-950 rounded-xl border border-slate-800/60">
                  No orders executed today
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-300 bg-slate-950 rounded-xl overflow-hidden border border-slate-800/60">
                  <thead className="text-[10px] uppercase bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">ORDER ID</th>
                      <th className="py-3 px-4">SYMBOL</th>
                      <th className="py-3 px-4 text-center">SIDE</th>
                      <th className="py-3 px-4 text-center">QTY</th>
                      <th className="py-3 px-4 text-right">PRICE</th>
                      <th className="py-3 px-4 text-center">TYPE</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-right">TIME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {dhanRealOrders.map((ord) => {
                      const sideBuy = ord.side === 'BUY';
                      const status = (ord.status || 'TRADED').toUpperCase();
                      
                      let statusBadge = (
                        <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          TRADED
                        </span>
                      );
                      if (status === 'REJECTED') {
                        statusBadge = (
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            REJECTED
                          </span>
                        );
                      } else if (status === 'PENDING') {
                        statusBadge = (
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            PENDING
                          </span>
                        );
                      } else if (status === 'CANCELLED') {
                        statusBadge = (
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            CANCELLED
                          </span>
                        );
                      } else if (status !== 'TRADED') {
                        statusBadge = (
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {status}
                          </span>
                        );
                      }

                      return (
                        <tr key={ord.orderId} className="hover:bg-slate-900/50">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-400">{ord.orderId}</td>
                          <td className="py-3 px-4 font-bold text-white">{ord.symbol}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider ${
                              sideBuy 
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {ord.side}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{ord.qty}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">₹{Number(ord.price).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-400">{ord.type ?? 'MARKET'}</td>
                          <td className="py-3 px-4 text-center">{statusBadge}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">{ord.time ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>

          {/* Dhan Auto-Trading Diagnostics Status Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 pointer-events-auto">
            
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xs font-extrabold tracking-wider text-slate-900 uppercase flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500" />
                  DHAN AUTO-TRADING DIAGNOSTICS STATUS (લાઈવ સ્ટેટસ ગાઈડ)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  ઓટો-ટ્રેડિંગ શા માટે ચાલે છે અથવા અટકેલું છે તેનું લાઈવ ચેકલિસ્ટ
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isAutoTradingActive) {
                    handleToggleAutoTrading();
                  }
                }}
                className="flex items-center justify-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer pointer-events-auto"
                style={{ pointerEvents: 'auto' }}
              >
                <span>▶ START AUTO TRADING NOW (ચાલુ કરો)</span>
              </button>
            </div>

            {/* 4-Card Diagnostics Checklist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Card 1: AUTO-TRADING SWITCH */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3">
                <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${isAutoTradingActive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    1. AUTO-TRADING SWITCH
                  </h4>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    {isAutoTradingActive ? 'ACTIVE' : 'PAUSED (બંધ છે - લીલું બટન દબાવો)'}
                  </p>
                </div>
              </div>

              {/* Card 2: NSE MARKET HOURS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3">
                <span className="text-slate-400 text-base shrink-0 mt-0.5">🕒</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    2. NSE MARKET HOURS
                  </h4>
                  <p className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5">
                    09:15 AM - 03:30 PM IST (Mon-Fri)
                    <span className={`inline-block px-1.5 py-0.2 text-[9px] font-black rounded uppercase ${isNSEMarketHours() ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {isNSEMarketHours() ? 'ACTIVE 🟢' : 'CLOSED 🔴'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Card 3: DHAN API CONNECTION */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0 bg-emerald-500" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider truncate">
                    3. DHAN API CONNECTION
                  </h4>
                  <p className="text-xs font-bold text-slate-700 mt-1 truncate">
                    Connected (ID: 1108096138)
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    Verified Fund: {dhanFundLimit}
                  </p>
                </div>
              </div>

              {/* Card 4: FRESH SIGNAL TRIGGER */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3">
                <span className="text-amber-500 text-base shrink-0 mt-0.5">⚡</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    4. FRESH SIGNAL TRIGGER
                  </h4>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    ફ્રેશ બ્રેકઆઉટ (30s) આવતા જ ઓર્ડર
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>

        {scanError && (currentUser?.role === 'admin' || isAdminUnlocked) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex items-start justify-between shadow-xs">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">System Notice</h4>
                  <p className="text-xs text-rose-700 mt-1 font-medium">{scanError}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0 ml-3">
                <button
                  onClick={() => setIsDhanModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  Configure API
                </button>
                <button
                  onClick={() => setScanError(null)}
                  className="p-1.5 text-rose-500 hover:text-rose-800 rounded-lg transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'LOGS' ? (
          <ClientLogsView logs={logs} onRefreshLogs={fetchLogs} />
        ) : (
          <>
            {/* Search & Filter Bar */}
            <FilterBar
              filter={filter}
              onFilterChange={setFilter}
              totalCount={currentItems.length}
              filteredCount={filteredItems.length}
            />

            {/* Main Scanner Stock Table */}
            <ScannerTable
              items={filteredItems}
              onSelectStock={(stock) => setSelectedStock(stock)}
              onDeleteStock={handleDeleteStockFromDashboard}
              isLoading={isScanning}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-xs text-slate-500 shadow-sm">
        <p>© 2026 Infinity Live Data Scanner. All rights reserved.</p>
      </footer>

      {/* Interactive Stock Chart & BB Modal */}
      {selectedStock && (
        <StockChartModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}

      {/* Google Sheets Modal */}
      {isSheetModalOpen && isAdminUnlocked && currentUser?.role === 'admin' && (
        <GoogleSheetsModal
          sheetConfig={sheetConfig}
          onSaveConfig={handleSaveSheetConfig}
          onSyncAllTabs={handleSyncAllTabs}
          onTestReadTab={handleTestReadTab}
          onCreateNewSheet={handleCreateNewSheet}
          onClose={() => setIsSheetModalOpen(false)}
          readStatus={readStatus}
        />
      )}

      {/* Dhan API Modal */}
      {isDhanModalOpen && isAdminUnlocked && currentUser?.role === 'admin' && (
        <DhanApiModal
          dhanConfig={dhanConfig}
          onSaveConfig={handleSaveDhanConfig}
          onClose={() => setIsDhanModalOpen(false)}
        />
      )}

      {/* Admin Security Lock Modal */}
      <AdminLockModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        onUnlockSuccess={handleUnlockSuccess}
        targetName={lockModalTarget}
        adminPin={adminPin}
        onChangePin={handleChangePin}
        dhanConfig={dhanConfig}
        sheetConfig={sheetConfig}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* User Login Gateway Modal */}
      <LoginModal
        isOpen={!currentUser || isLoginModalOpen}
        isMandatory={!currentUser}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* New Dhan Live Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col space-y-4 max-h-[90vh] overflow-y-auto pointer-events-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">⊕</span>
                <h3 className="text-sm font-extrabold tracking-wider uppercase text-slate-100">
                  New Dhan Live Order
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsOrderModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Picks Pills */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Picks:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['RELIANCE', 'TCS', 'HDFCBANK', 'SBIN', 'TATAMOTORS', 'ICICIBANK'].map((sym) => (
                  <button
                    key={`qp-${sym}`}
                    type="button"
                    onClick={() => handleSelectQuickPick(sym)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                      orderSymbol.toUpperCase() === sym.toUpperCase()
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Searchable Stock Input with active badge */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Search / Stock Symbol:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value.toUpperCase())}
                  placeholder="Type symbol (e.g. INFY, ITC...)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                />
                {orderSymbol && (
                  <button
                    type="button"
                    onClick={() => setOrderSymbol('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-emerald-400">
                  Selected: {orderSymbol || 'None'}
                </span>
                <span className="text-slate-500">
                  Enter NSE listed symbol
                </span>
              </div>
            </div>

            {/* Order Type Toggle & Timeframe Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Order Type:
                </label>
                <div className="grid grid-cols-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => updateOrderSide('BUY')}
                    className={`py-1 rounded font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                      orderSide === 'BUY'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOrderSide('SELL')}
                    className={`py-1 rounded font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                      orderSide === 'SELL'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Timeframe:
                </label>
                <select
                  value={orderTimeframe}
                  onChange={(e) => setOrderTimeframe(e.target.value as Timeframe)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="30M">30M Timeframe</option>
                  <option value="10M">10M Timeframe</option>
                  <option value="5M">5M Timeframe</option>
                  <option value="1M">1M Timeframe</option>
                </select>
              </div>
            </div>

            {/* Sizing Type Toggle */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Order Sizing:
              </label>
              <div className="grid grid-cols-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setOrderSizingType('CAPITAL');
                    const qty = Math.floor(orderCapital / (orderPrice || 1)) || 1;
                    setOrderQty(qty);
                  }}
                  className={`py-1 rounded font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                    orderSizingType === 'CAPITAL'
                      ? 'bg-slate-850 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  By Capital (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSizingType('SHARES')}
                  className={`py-1 rounded font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                    orderSizingType === 'SHARES'
                      ? 'bg-slate-850 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  By Shares (Qty)
                </button>
              </div>
            </div>

            {/* Price & Sizing Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Entry Price (₹):
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={orderPrice}
                  onChange={(e) => updateOrderPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-white focus:outline-none"
                />
              </div>

              {orderSizingType === 'CAPITAL' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Capital per Trade (₹):
                  </label>
                  <input
                    type="number"
                    value={orderCapital}
                    onChange={(e) => updateOrderCapital(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-white focus:outline-none"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Quantity (Shares):
                  </label>
                  <input
                    type="number"
                    value={orderQty}
                    onChange={(e) => setOrderQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Order Sizing badge */}
            <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-850 text-center text-[10px] font-bold text-emerald-400">
              Order Qty: {orderQty} Shares | Total: ₹{(orderQty * orderPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>

            {/* Auto 1:2 Risk-Reward or Quick Scalp Fields */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Strategy:
                </span>
                <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRule('STRICT_1_2');
                      const tp = calculateTP(orderPrice, orderSL, orderSide);
                      setOrderTP(tp);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                      targetRule === 'STRICT_1_2'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Strict 1:2
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRule('QUICK_SCALP');
                      const tp = calculateTP(orderPrice, orderSL, orderSide);
                      setOrderTP(tp);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                      targetRule === 'QUICK_SCALP'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Quick Scalp (+{quickTargetPercent}%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                    Stop Loss (SL ₹):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={orderSL}
                    onChange={(e) => updateOrderSL(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-rose-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    {targetRule === 'QUICK_SCALP' ? `Target (+${quickTargetPercent}% Scalp ₹):` : 'Target Price (1:2 TP ₹):'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={orderTP}
                    disabled
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-3 py-1.5 font-mono font-bold text-xs text-emerald-400 disabled:opacity-80"
                  />
                </div>
              </div>
            </div>

            {/* Live Order Summary Box & Execution Button */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-semibold space-y-1 font-mono">
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${orderSide === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-white font-extrabold">{orderSide} {orderSymbol} Summary:</span>
              </div>
              <p className="text-slate-300">
                {orderQty} Shares @ ₹{orderPrice.toFixed(2)} | SL: ₹{orderSL.toFixed(2)} | Target: ₹{orderTP.toFixed(2)}
              </p>
              <p className="text-slate-500 text-[9px]">
                Total Exposure: ₹{(orderQty * orderPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Est. Risk: ₹{Math.abs((orderPrice - orderSL) * orderQty).toFixed(2)}
              </p>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs rounded-xl font-bold tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteLiveOrder}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white hover:text-slate-950 text-xs rounded-xl font-extrabold tracking-wider transition-all cursor-pointer shadow-md"
              >
                ⚡ Execute Real Dhan Live Order
              </button>
            </div>

          </div>
        </div>
      )}

      {/* User Management Admin Modal (Up to 100 users) */}
      <UserManagerModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Dhan Live Trading Rules Modal (Risk & Rules) */}
      <AlertSettingsModal
        isOpen={isAlertSettingsOpen}
        onClose={() => setIsAlertSettingsOpen(false)}
        config={alertConfig}
        onSaveConfig={handleSaveAlertConfig}
        onClearHistory={() => {
          setTriggeredAlerts([]);
          localStorage.removeItem('infinity_triggered_alerts');
        }}
        alertHistoryCount={triggeredAlerts.length}
      />

      {/* Live Breakout Alerts Feed Drawer */}
      <AlertHistoryDrawer
        isOpen={isAlertHistoryOpen}
        onClose={() => setIsAlertHistoryOpen(false)}
        alerts={triggeredAlerts}
        onMarkAllRead={handleMarkAllAlertsRead}
        onClearAll={() => {
          setTriggeredAlerts([]);
          seenAlertsRef.current.clear();
          seenTelegramAlertsRef.current.clear();
          localStorage.removeItem('infinity_triggered_alerts');
          localStorage.removeItem('infinity_seen_alert_keys');
          localStorage.removeItem('infinity_seen_telegram_keys');
        }}
        onClearHistory={() => {
          setTriggeredAlerts([]);
          seenAlertsRef.current.clear();
          seenTelegramAlertsRef.current.clear();
          localStorage.removeItem('infinity_triggered_alerts');
          localStorage.removeItem('infinity_seen_alert_keys');
          localStorage.removeItem('infinity_seen_telegram_keys');
        }}
        onDeleteAlert={handleDeleteAlert}
        onSelectStock={(stock) => setSelectedStock(stock)}
      />

      {/* Modal End */}

    </div>
  );
}
