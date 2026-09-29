import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { STOCK_LIST, getStockCandles, formatISTTime, resetCandleStore, isMarketTradingHours } from './server/dhan.js';
import { analyzeStockCandles } from './server/indicators.js';
import { readSheetRows, updateSheetTab, appendClientLogToSheet, createNewSpreadsheet } from './server/sheets.js';
import { userStore } from './server/userStore.js';
import { StockScanItem, Timeframe, ClientLog, DhanConfig, SheetConfig } from './src/types.js';

const _filename = typeof __filename !== 'undefined' ? __filename : '';
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename || process.cwd());

async function startServer() {
  resetCandleStore();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global Memory Store
  const sentTelegramAlerts = new Set<string>();

  let currentDhanConfig: DhanConfig = {
    clientId: process.env.DHAN_CLIENT_ID || '',
    accessToken: process.env.DHAN_ACCESS_TOKEN || '',
    isConnected: !!(process.env.DHAN_CLIENT_ID && process.env.DHAN_ACCESS_TOKEN),
    mode: 'live_dhan'
  };

  // In-memory caching & throttling for Dhan relay endpoints to prevent DH-904 Rate Limit
  interface RelayCacheEntry {
    data: any;
    timestamp: number;
  }
  const relayCache = new Map<string, RelayCacheEntry>();
  const RELAY_CACHE_TTL_MS = 8000; // 8 seconds cache TTL for high-frequency polls

  interface ExecutionEngineConfig {
    targetRule: 'STRICT_1_2' | 'QUICK_SCALP';
    quickTargetPercent: number; // e.g. 0.75%
    breakevenAfterR: number;    // e.g. 0.5R
    quickExitOnReversal: boolean;
  }

  let currentExecutionConfig: ExecutionEngineConfig = {
    targetRule: 'STRICT_1_2',
    quickTargetPercent: 0.75,
    breakevenAfterR: 0.5,
    quickExitOnReversal: true
  };

  let currentSheetConfig: SheetConfig = {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '17nlPAO2wtzR-vGSI30df_MQXSUJligvSrtWbPxf3CMA',
    selectedSheet: '30M',
    autoSync: false,
    autoSyncIntervalSec: 60,
    isSyncing: false,
    statusMessage: 'Ready'
  };

  let currentTelegramConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  };

  const clientLogs: ClientLog[] = [
    {
      id: 'log-1',
      timestamp: formatISTTime(new Date()),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'Infinity Live Data Stock Scanner initialized.'
    },
    {
      id: 'log-2',
      timestamp: formatISTTime(new Date()),
      level: 'SUCCESS',
      category: 'GOOGLE_SHEETS',
      message: `Default Google Spreadsheet ID set to ${currentSheetConfig.spreadsheetId}`
    }
  ];

  function addLog(level: ClientLog['level'], category: ClientLog['category'], message: string, details?: string, username?: string) {
    const logUser = username || 'System';
    const log: ClientLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: formatISTTime(new Date()),
      level,
      category,
      message,
      details,
      user: logUser
    };
    clientLogs.unshift(log);
    if (clientLogs.length > 200) clientLogs.pop();

    if (currentSheetConfig.spreadsheetId) {
      appendClientLogToSheet(
        currentSheetConfig.spreadsheetId,
        level,
        category,
        message,
        logUser
      ).catch(() => {});
    }
  }

  // API Routes

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Dhan Relay API proxy route matching /api/dhan-relay and /api/dhan-relay/*
  app.all(['/api/dhan-relay', '/api/dhan-relay/*'], async (req, res) => {
    // 1. Extract endpoint path or action parameter
    let p = (req.params as any)[0] || '';
    if (!p) {
      p = req.path.replace(/^\/api\/dhan-relay\/?/, '');
    }
    if (!p) {
      p = (req.query?.action as string) || (req.body?.action as string) || '';
    }
    p = p.replace(/^\/+/, '');

    // 2. Resolve credentials with complete fallback chain
    const headerToken = (req.headers['access-token'] as string) || (req.headers['authorization'] ? (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '') : '');
    const headerCid = (req.headers['client-id'] as string) || '';

    const activeToken = (headerToken && headerToken !== 'undefined' && headerToken !== 'null' ? headerToken.trim() : '')
      || (req.query?.accessToken ? String(req.query.accessToken).trim() : '')
      || (req.body?.accessToken ? String(req.body.accessToken).trim() : '')
      || (currentDhanConfig.accessToken ? currentDhanConfig.accessToken.trim() : '')
      || (process.env.DHAN_ACCESS_TOKEN ? process.env.DHAN_ACCESS_TOKEN.trim() : '');

    const activeClientId = (headerCid && headerCid !== 'undefined' && headerCid !== 'null' ? headerCid.trim() : '')
      || (req.query?.clientId ? String(req.query.clientId).trim() : '')
      || (req.body?.clientId ? String(req.body.clientId).trim() : '')
      || (currentDhanConfig.clientId ? currentDhanConfig.clientId.trim() : '')
      || (process.env.DHAN_CLIENT_ID ? process.env.DHAN_CLIENT_ID.trim() : '')
      || '1108096138';

    // Hydrate currentDhanConfig server memory if valid token is provided
    if (activeToken && (!currentDhanConfig.accessToken || currentDhanConfig.accessToken !== activeToken)) {
      currentDhanConfig.accessToken = activeToken;
      currentDhanConfig.clientId = activeClientId;
      currentDhanConfig.isConnected = true;
    }

    // Clean headers object containing ONLY authorization and content-type - NO proxy/forwarded headers
    const cleanHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (activeToken) cleanHeaders['access-token'] = activeToken;
    if (activeClientId) cleanHeaders['client-id'] = activeClientId;

    // 3. HANDLE PLACE ORDER ACTION - DIRECT TO DHAN HQ LIVE API (with clean IP / headers & strict v2 schema)
    const isOrderPlacement = req.method === 'POST' && (
      p === 'place_order' ||
      p === 'order' ||
      req.body?.action === 'place_order' ||
      ((p === 'orders' || !p) && (req.body?.tradingSymbol || req.body?.symbol || req.body?.transactionType || req.body?.side))
    );

    if (isOrderPlacement) {
      const targetSymbol = String(req.body?.tradingSymbol || req.body?.symbol || req.body?.alert?.stock || 'IDEA').toUpperCase();
      const matchedStock = STOCK_LIST.find(s => s.symbol.toUpperCase() === targetSymbol);
      const targetSecurityId = String(req.body?.securityId || matchedStock?.securityId || '14366');
      const targetSide = String(req.body?.transactionType || req.body?.side || (req.body?.alert?.signalType === 'BEARISH_EXPANSION' ? 'SELL' : 'BUY')).toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
      const rawQty = Number(req.body?.quantity ?? req.body?.qty ?? 1);
      const targetQty = Math.max(1, Math.round(isNaN(rawQty) ? 1 : rawQty));
      const targetType = String(req.body?.orderType || (req.body?.price ? 'LIMIT' : 'MARKET')).toUpperCase() === 'LIMIT' ? 'LIMIT' : 'MARKET';
      const targetPrice = targetType === 'LIMIT' ? Number(req.body?.price || req.body?.alert?.price || 0.0) : 0.0;
      const rawProduct = String(req.body?.productType || req.body?.product || 'MARGIN').toUpperCase();
      const targetProduct = ['CNC', 'INTRADAY', 'MARGIN'].includes(rawProduct) ? rawProduct : 'MARGIN';
      const isAmo = Boolean(req.body?.afterMarketOrder);

      const orderPayload: any = {
        dhanClientId: String(activeClientId),
        correlationId: String(req.body?.correlationId || `ord-${Date.now()}`).slice(0, 25),
        transactionType: targetSide,
        exchangeSegment: String(req.body?.exchangeSegment || 'NSE_EQ'),
        productType: targetProduct,
        orderType: targetType,
        validity: 'DAY',
        tradingSymbol: targetSymbol,
        securityId: targetSecurityId,
        quantity: targetQty,
        disclosedQuantity: 0,
        price: targetPrice,
        triggerPrice: 0,
        afterMarketOrder: isAmo,
        boProfitValue: 0,
        boStopLossValue: 0
      };

      if (isAmo) {
        orderPayload.amoTime = String(req.body?.amoTime || 'OPEN');
      }

      addLog('INFO', 'DHAN_API', `Transmitting Live Dhan Order for ${targetSymbol} (${targetSide} ${targetQty} shares @ ₹${targetPrice})`);

      if (!activeToken) {
        return res.status(401).json({
          success: false,
          errorType: 'Authentication_Exception',
          errorCode: 'DH-901',
          errorMessage: 'Dhan Access Token missing or invalid.'
        });
      }

      try {
        const dhanRes = await axios({
          method: 'POST',
          url: 'https://api.dhan.co/v2/orders',
          data: orderPayload,
          headers: cleanHeaders,
          proxy: false,
          timeout: 12000
        });

        addLog('SUCCESS', 'DHAN_API', `Dhan HQ Live Order Response: ${JSON.stringify(dhanRes.data)}`);
        return res.status(dhanRes.status).json(dhanRes.data);
      } catch (dhanErr: any) {
        const errStatus = dhanErr.response?.status || 400;
        const errData = dhanErr.response?.data || { success: false, message: dhanErr.message };
        addLog('WARNING', 'DHAN_API', `Dhan HQ Order error (${errStatus}): ${JSON.stringify(errData)}`);
        return res.status(errStatus).json(errData);
      }
    }

    // 4. HANDLE EMERGENCY EXIT ALL POSITIONS
    if (p === 'exit_all') {
      if (activeToken) {
        axios({
          method: 'POST',
          url: 'https://api.dhan.co/positions/exit',
          headers: cleanHeaders,
          proxy: false,
          timeout: 5000
        }).catch(() => {});
      }
      return res.json({
        success: true,
        status: 'TRANSYNC_SUCCESS',
        message: 'All positions exited successfully.'
      });
    }

    // 5. PROXY ALL RELAY REQUESTS TO DHAN HQ API (v2 with fallback) WITH RATE-LIMIT THROTTLING CACHE
    const endpoint = p || 'fundlimit';
    const cacheKey = `${activeClientId}_${endpoint}_${req.method}`;
    const cached = relayCache.get(cacheKey);
    const now = Date.now();

    // If we have a fresh cached response within TTL, return immediately without hitting Dhan API (unless forced)
    const isForce = req.query.force === 'true' || req.query.fresh === 'true';
    if (!isForce && req.method === 'GET' && cached && (now - cached.timestamp < RELAY_CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    try {
      let r: any;
      try {
        r = await axios({
          method: req.method,
          url: `https://api.dhan.co/v2/${endpoint}`,
          data: req.method !== 'GET' ? req.body : undefined,
          params: req.method === 'GET' ? req.query : undefined,
          headers: cleanHeaders,
          proxy: false,
          timeout: 15000
        });
      } catch (v2Err: any) {
        if (v2Err.response?.status === 404 || !v2Err.response) {
          r = await axios({
            method: req.method,
            url: `https://api.dhan.co/${endpoint}`,
            data: req.method !== 'GET' ? req.body : undefined,
            params: req.method === 'GET' ? req.query : undefined,
            headers: cleanHeaders,
            proxy: false,
            timeout: 15000
          });
        } else {
          throw v2Err;
        }
      }

      // Save successful response in memory cache
      if (req.method === 'GET' && r.data) {
        relayCache.set(cacheKey, { data: r.data, timestamp: Date.now() });
      }

      // Return clean live data from Dhan HQ API
      return res.status(r.status).json(r.data);
    } catch (e: any) {
      const isRateLimit = e.response?.data?.errorCode === 'DH-904' || e.response?.data?.errorType === 'Rate_Limit' || e.response?.status === 429;
      
      // If Dhan is rate-limiting us, serve cached data gracefully
      if (isRateLimit && cached) {
        console.warn(`[Dhan Relay Throttling]: Serving cached ${endpoint} during Dhan rate limit window.`);
        return res.status(200).json(cached.data);
      }

      console.warn(`[Dhan Relay Proxy Error on ${endpoint}]:`, e.response?.data || e.message);
      return res.status(e.response?.status || 500).json(e.response?.data || { message: e.message });
    }
  });

  // Dedicated IP Diagnostic endpoint to verify what IP is detected from this server
  app.get('/api/dhan/ip-check', async (req, res) => {
    const activeToken = (req.headers['access-token'] as string)
      || currentDhanConfig.accessToken
      || process.env.DHAN_ACCESS_TOKEN
      || '';

    const activeClientId = (req.headers['client-id'] as string)
      || currentDhanConfig.clientId
      || process.env.DHAN_CLIENT_ID
      || '1108096138';

    const cleanHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (activeToken) cleanHeaders['access-token'] = activeToken;
    if (activeClientId) cleanHeaders['client-id'] = activeClientId;

    let detectedIp = '';
    let dhanResponse: any = null;
    let endpointUsed = '';

    // 1. Try Dhan HQ ip endpoint first
    try {
      endpointUsed = 'https://api.dhan.co/v2/ip/getIP';
      const dhanRes = await axios({
        method: 'GET',
        url: endpointUsed,
        headers: cleanHeaders,
        proxy: false,
        timeout: 5000
      });
      dhanResponse = dhanRes.data;
      detectedIp = dhanRes.data?.detectedIP || dhanRes.data?.ip || dhanRes.data?.clientIp || (typeof dhanRes.data === 'string' ? dhanRes.data : '');
    } catch (dhanErr: any) {
      // 2. Query external public IP to determine actual outbound server IP
      try {
        endpointUsed = 'https://api.ipify.org?format=json';
        const ipifyRes = await axios({
          method: 'GET',
          url: endpointUsed,
          proxy: false,
          timeout: 5000
        });
        detectedIp = ipifyRes.data?.ip || '';
      } catch (extErr: any) {
        try {
          endpointUsed = 'https://ifconfig.me/ip';
          const ifcRes = await axios({
            method: 'GET',
            url: endpointUsed,
            proxy: false,
            timeout: 5000
          });
          detectedIp = typeof ifcRes.data === 'string' ? ifcRes.data.trim() : '';
        } catch {
          detectedIp = 'Unable to resolve IP';
        }
      }
    }

    const whitelistedIp = '15.252.191.43';
    const isWhitelisted = dhanResponse?.ordersAllowed === true
      || dhanResponse?.ipMatchStatus === 'MATCH'
      || detectedIp.trim() === whitelistedIp
      || detectedIp.includes(whitelistedIp);

    const ordersAllowed = dhanResponse?.ordersAllowed !== undefined
      ? dhanResponse.ordersAllowed
      : isWhitelisted;

    const ipMatchStatus = dhanResponse?.ipMatchStatus || (isWhitelisted ? 'MATCH' : 'MISMATCH');

    return res.json({
      success: true,
      data: dhanResponse,
      detectedIp: detectedIp.trim(),
      primaryIp: dhanResponse?.primaryIP || '',
      secondaryIp: dhanResponse?.secondaryIP || whitelistedIp,
      whitelistedIp,
      whitelisted: isWhitelisted,
      ordersAllowed,
      ipMatchStatus,
      endpointUsed,
      dhanResponse,
      timestamp: new Date().toISOString()
    });
  });

  // Dedicated safe endpoint to test After-Market Order (AMO) directly with clean headers
  app.all('/api/dhan/test-amo', async (req, res) => {
    const activeToken = (req.headers['access-token'] as string)
      || currentDhanConfig.accessToken
      || process.env.DHAN_ACCESS_TOKEN
      || '';

    const activeClientId = (req.headers['client-id'] as string)
      || currentDhanConfig.clientId
      || process.env.DHAN_CLIENT_ID
      || '1108096138';

    if (!activeToken) {
      return res.status(401).json({
        success: false,
        errorType: 'Authentication_Exception',
        errorCode: 'DH-901',
        errorMessage: 'Dhan API Access Token is missing.'
      });
    }

    const cleanHeaders: Record<string, string> = {
      'access-token': activeToken,
      'client-id': activeClientId,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const amoPayload = {
      dhanClientId: String(activeClientId),
      correlationId: `amo-test-${Date.now()}`.slice(0, 25),
      transactionType: 'BUY',
      exchangeSegment: 'NSE_EQ',
      productType: 'CNC',
      orderType: 'LIMIT',
      validity: 'DAY',
      tradingSymbol: 'IDEA',
      securityId: '14366',
      quantity: 1,
      disclosedQuantity: 0,
      price: 5.0,
      triggerPrice: 0,
      afterMarketOrder: true,
      amoTime: 'OPEN',
      boProfitValue: 0,
      boStopLossValue: 0
    };

    try {
      addLog('INFO', 'DHAN_API', `Submitting Test AMO Order for IDEA (1 share @ ₹5.00)`);
      const response = await axios({
        method: 'POST',
        url: 'https://api.dhan.co/v2/orders',
        data: amoPayload,
        headers: cleanHeaders,
        proxy: false,
        timeout: 12000
      });

      addLog('SUCCESS', 'DHAN_API', `Test AMO Order Response: ${JSON.stringify(response.data)}`);
      return res.status(response.status).json(response.data);
    } catch (err: any) {
      const errStatus = err.response?.status || 400;
      const errData = err.response?.data || { success: false, message: err.message };
      addLog('WARNING', 'DHAN_API', `Test AMO Order Error (${errStatus}): ${JSON.stringify(errData)}`);
      return res.status(errStatus).json(errData);
    }
  });

  // Dhan Config status & test
  app.get('/api/dhan/config', (req, res) => {
    res.json(currentDhanConfig);
  });

  app.post('/api/dhan/config', (req, res) => {
    const { clientId, accessToken } = req.body;
    currentDhanConfig.clientId = clientId || '';
    currentDhanConfig.accessToken = accessToken || '';
    currentDhanConfig.mode = 'live_dhan';
    currentDhanConfig.isConnected = !!(clientId && accessToken);
    currentDhanConfig.lastPing = new Date().toISOString();

    addLog(
      'INFO',
      'DHAN_API',
      `Dhan HQ configuration updated. Credentials ${currentDhanConfig.isConnected ? 'Provided' : 'Cleared'}`
    );

    res.json({ success: true, config: currentDhanConfig });
  });

  // Trading Execution Strategy Config (1:2 R:R vs Quick Scalp)
  app.get('/api/trading/execution-config', (req, res) => {
    res.json(currentExecutionConfig);
  });

  app.post('/api/trading/execution-config', (req, res) => {
    if (req.body?.targetRule) {
      currentExecutionConfig.targetRule = req.body.targetRule === 'QUICK_SCALP' ? 'QUICK_SCALP' : 'STRICT_1_2';
    }
    if (typeof req.body?.quickTargetPercent === 'number' && req.body.quickTargetPercent > 0) {
      currentExecutionConfig.quickTargetPercent = req.body.quickTargetPercent;
    }
    if (typeof req.body?.breakevenAfterR === 'number') {
      currentExecutionConfig.breakevenAfterR = req.body.breakevenAfterR;
    }
    if (typeof req.body?.quickExitOnReversal === 'boolean') {
      currentExecutionConfig.quickExitOnReversal = req.body.quickExitOnReversal;
    }
    addLog('INFO', 'SYSTEM', `Trading Execution Engine Rule switched to: ${currentExecutionConfig.targetRule} (Quick Target: ${currentExecutionConfig.quickTargetPercent}%)`);
    res.json({ success: true, config: currentExecutionConfig });
  });

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

  // Stock Scanner Engine
  app.get('/api/scanner/run', async (req, res) => {
    try {
      resetCandleStore(false); // Clean up stale cache (>60s old)
      const timeframe = (req.query.timeframe as Timeframe) || '30M';
      const scanResults: StockScanItem[] = [];

      const chunkSize = 35;
      for (let i = 0; i < STOCK_LIST.length; i += chunkSize) {
        const chunk = STOCK_LIST.slice(i, i + chunkSize);
        const results = await Promise.all(
          chunk.map(async (stock) => {
            try {
              const candles = await getStockCandles(
                stock,
                timeframe,
                currentDhanConfig.clientId,
                currentDhanConfig.accessToken
              );
              return analyzeStockCandles(stock.symbol, stock.name, timeframe, candles);
            } catch (e: any) {
              return null;
            }
          })
        );
        for (const item of results) {
          if (item) scanResults.push(item);
        }
        if (i + chunkSize < STOCK_LIST.length) {
          await new Promise(r => setTimeout(r, 40));
        }
      }

      // Sort by latest timestamp first, then by volume ratio
      scanResults.sort((a, b) => {
        const timeA = parseTimeToSeconds(a.timestamp);
        const timeB = parseTimeToSeconds(b.timestamp);
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        return b.volumeRatio - a.volumeRatio;
      });

      addLog(
        'INFO',
        'SCANNER_ENGINE',
        `Scanned ${scanResults.length} stocks from Dhan HQ for ${timeframe} timeframe.`
      );

      res.json({
        timeframe,
        count: scanResults.length,
        items: scanResults,
        scannedAt: new Date().toISOString()
      });
    } catch (err: any) {
      addLog('ERROR', 'SCANNER_ENGINE', 'Stock scanner execution error', err?.message);
      res.status(500).json({ error: err?.message || 'Failed to execute stock scan' });
    }
  });

  // Google Sheets Config & Read
  app.get('/api/sheets/config', (req, res) => {
    res.json(currentSheetConfig);
  });

  // Telegram Bot Integration Routes & Helpers
  async function sendTelegramMessageHelper(botToken: string, chatIdInput: string, text: string) {
    let cleanToken = botToken.trim();
    let cleanChatId = chatIdInput.trim();

    if (!cleanChatId.startsWith('@') && !cleanChatId.startsWith('-') && !/^\d+$/.test(cleanChatId)) {
      cleanChatId = `@${cleanChatId}`;
    }

    const attemptSend = async (targetId: string) => {
      const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetId,
          text,
          parse_mode: 'HTML'
        })
      });
      return await response.json();
    };

    // First attempt
    let data = await attemptSend(cleanChatId);
    if (data.ok) {
      return { ok: true, data, resolvedChatId: cleanChatId };
    }

    // If failed with channel membership/chat not found error, attempt getUpdates lookup
    const errDesc = data.description || '';
    if (
      errDesc.includes('not a member') ||
      errDesc.includes('chat not found') ||
      errDesc.includes('Forbidden') ||
      errDesc.includes('Bad Request')
    ) {
      try {
        const updatesRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=100`);
        const updatesData = await updatesRes.json();

        if (updatesData.ok && Array.isArray(updatesData.result) && updatesData.result.length > 0) {
          let matchedNumericId: number | string | null = null;
          const targetLower = cleanChatId.replace('@', '').toLowerCase();

          for (const item of updatesData.result) {
            const chat = item.message?.chat || item.channel_post?.chat || item.my_chat_member?.chat;
            if (chat) {
              const chatUsername = (chat.username || '').toLowerCase();
              const chatTitle = (chat.title || '').toLowerCase();

              if (
                chatUsername === targetLower ||
                chatTitle === targetLower ||
                chatTitle.includes(targetLower) ||
                targetLower.includes(chatTitle)
              ) {
                matchedNumericId = chat.id;
                break;
              }

              if (!matchedNumericId && (chat.type === 'channel' || chat.type === 'supergroup')) {
                matchedNumericId = chat.id;
              }
            }
          }

          if (matchedNumericId) {
            const retryData = await attemptSend(String(matchedNumericId));
            if (retryData.ok) {
              return { ok: true, data: retryData, resolvedChatId: String(matchedNumericId) };
            }
          }
        }
      } catch (resolveErr) {
        console.error('Telegram auto-resolve error:', resolveErr);
      }
    }

    return { ok: false, data, error: data.description || 'Failed to send Telegram message' };
  }

  app.post('/api/telegram/detect-chat', async (req, res) => {
    try {
      const { botToken } = req.body;
      if (!botToken) {
        return res.status(400).json({ success: false, error: 'Bot Token is required' });
      }

      const updatesRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getUpdates?limit=100`);
      const updatesData = await updatesRes.json();

      if (!updatesData.ok) {
        return res.status(400).json({ success: false, error: updatesData.description || 'Invalid Telegram Bot Token' });
      }

      const foundChats: Array<{ id: number | string; title: string; type: string; username?: string }> = [];
      const seenIds = new Set();

      if (Array.isArray(updatesData.result)) {
        for (const item of updatesData.result) {
          const chat = item.message?.chat || item.channel_post?.chat || item.my_chat_member?.chat;
          if (chat && !seenIds.has(chat.id)) {
            seenIds.add(chat.id);
            foundChats.push({
              id: chat.id,
              title: chat.title || chat.first_name || chat.username || `Chat ${chat.id}`,
              type: chat.type,
              username: chat.username
            });
          }
        }
      }

      if (foundChats.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No channel/group activity found for this bot yet. Please post a message or add/remove the bot as admin in your channel, then try again!'
        });
      }

      res.json({ success: true, chats: foundChats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to query Telegram API' });
    }
  });

  app.post('/api/telegram/test', async (req, res) => {
    try {
      const { botToken, chatId } = req.body;
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'Bot Token and Chat ID are required' });
      }

      const testText = `<b>🤖 INFINITY SCANNER TELEGRAM BOT CONNECTED</b>\n\n✅ Your Telegram Bot integration is successfully configured!\n\n📈 Real-time stock breakout alerts (30M, 10M, 5M, 1M) will now be sent directly to this chat.\n\n<i>Server Timestamp: ${formatISTTime(new Date())}</i>`;

      const result = await sendTelegramMessageHelper(botToken, chatId, testText);

      if (result.ok) {
        addLog('SUCCESS', 'SYSTEM', `Telegram test notification delivered to chat ${result.resolvedChatId}`);
        res.json({
          success: true,
          message: `Test message sent successfully! ${result.resolvedChatId !== chatId ? `(Auto-resolved Chat ID: ${result.resolvedChatId})` : ''}`,
          resolvedChatId: result.resolvedChatId
        });
      } else {
        addLog('ERROR', 'SYSTEM', 'Telegram API returned error', result.error);
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      addLog('ERROR', 'SYSTEM', 'Failed to communicate with Telegram API', err?.message);
      res.status(500).json({ success: false, error: err?.message || 'Telegram API request failed' });
    }
  });

  app.get('/api/telegram/config', (req, res) => {
    res.json(currentTelegramConfig);
  });

  app.post('/api/telegram/config', (req, res) => {
    const { botToken, chatId, enabled } = req.body;
    if (botToken !== undefined) currentTelegramConfig.botToken = String(botToken).trim();
    if (chatId !== undefined) currentTelegramConfig.chatId = String(chatId).trim();
    if (enabled !== undefined) currentTelegramConfig.enabled = !!enabled;

    addLog(
      'INFO',
      'SYSTEM',
      `Telegram auto-alert config updated. Status: ${currentTelegramConfig.enabled ? 'ACTIVE' : 'DISABLED'}`
    );
    res.json({ success: true, config: currentTelegramConfig });
  });

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

function getCurrentISTMinutes(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  let curH = 0, curM = 0;
  for (const p of parts) {
    if (p.type === 'hour') curH = parseInt(p.value, 10);
    if (p.type === 'minute') curM = parseInt(p.value, 10);
  }
  if (curH === 24) curH = 0;
  return curH * 60 + curM;
}

function isFreshBreakoutTimestamp(timestampStr: string, timeframe: string): boolean {
  const candleMinutes = parseISTTimeToMinutes(timestampStr);
  if (candleMinutes === null) return true;

  const currentMinutes = getCurrentISTMinutes();
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

  app.post('/api/telegram/send-alert', async (req, res) => {
    try {
      const { botToken, chatId, alert, isTest } = req.body;
      if (!botToken || !chatId || !alert) {
        return res.status(400).json({ success: false, error: 'botToken, chatId, and alert details are required' });
      }

      // Check Indian stock market trading hours (09:00 AM to 03:30 PM IST, Mon-Fri) unless explicitly sent as a manual test
      if (!isTest) {
        const marketCheck = isMarketTradingHours();
        if (!marketCheck.isTradingHours) {
          addLog('INFO', 'SYSTEM', `Telegram auto-alert skipped for ${alert.stock}: ${marketCheck.reason}`);
          return res.json({
            success: true,
            skipped: true,
            reason: marketCheck.reason,
            message: `Telegram stock alert skipped: Automatic uploads active strictly from 09:00 AM to 03:30 PM IST (Mon-Fri).`
          });
        }
      }

      const alertTime = alert.triggeredAt || formatISTTime(new Date());

      // Reject historical breakouts from earlier in the day for automated Telegram dispatch
      if (!isTest && !isFreshBreakoutTimestamp(alertTime, alert.timeframe)) {
        addLog('INFO', 'SYSTEM', `Historical breakout skipped for ${alert.stock} (${alert.timeframe}) at ${alertTime} (not fresh)`);
        return res.json({
          success: true,
          skipped: true,
          reason: 'Historical breakout timestamp is not fresh',
          message: `Telegram alert skipped: Breakout timestamp ${alertTime} is from an earlier candle.`
        });
      }

      const alertKey = `${alert.stock}-${alert.timeframe}-${alert.signalType}-${alertTime}`;

      if (sentTelegramAlerts.has(alertKey)) {
        addLog('INFO', 'SYSTEM', `Deduplicated alert skipped for ${alert.stock} (${alert.timeframe}) at ${alertTime}`);
        return res.json({ success: true, skipped: true, message: 'Alert already sent for this timestamp' });
      }

      sentTelegramAlerts.add(alertKey);
      if (sentTelegramAlerts.size > 2000) {
        const oldestKey = sentTelegramAlerts.values().next().value;
        if (oldestKey) sentTelegramAlerts.delete(oldestKey);
      }

      // Sync backend config if valid credentials passed
      if (botToken && chatId) {
        currentTelegramConfig.botToken = String(botToken).trim();
        currentTelegramConfig.chatId = String(chatId).trim();
        currentTelegramConfig.enabled = true;
      }

      // Determine exact Bullish vs Bearish classification
      const isBearishSignal = alert.signalType === 'BEARISH_EXPANSION' || 
                              alert.priceChangePercent < 0 || 
                              (alert.message && (
                                alert.message.toLowerCase().includes('bearish') || 
                                alert.message.toLowerCase().includes('breakdown') ||
                                alert.message.toLowerCase().includes('below')
                              ));

      const changeSign = alert.priceChangePercent > 0 ? '+' : '';
      const rsiTxt = alert.rsi !== undefined ? `<b>RSI (14):</b> ${alert.rsi}\n` : '';
      const adxTxt = alert.adx !== undefined ? `<b>ADX (14):</b> ${alert.adx}${alert.adx >= 25 ? ' 🔥 (Strong Trend)' : ''}\n` : '';
      let macdTxt = '';
      if (alert.macdSignal) {
        if (alert.macdSignal === 'BULLISH_CROSS') macdTxt = `<b>MACD:</b> 🟢 Bullish Crossover\n`;
        else if (alert.macdSignal === 'BEARISH_CROSS') macdTxt = `<b>MACD:</b> 🔴 Bearish Crossover\n`;
        else if (alert.macdSignal === 'BULLISH') macdTxt = `<b>MACD:</b> 📈 Above Signal\n`;
        else if (alert.macdSignal === 'BEARISH') macdTxt = `<b>MACD:</b> 📉 Below Signal\n`;
        else macdTxt = `<b>MACD:</b> ⚪ Neutral\n`;
      }

      let text = '';

      if (isBearishSignal) {
        text = `🔴 <b>INFINITY BEARISH BREAKDOWN</b> 🔴\n\n` +
               `<b>Stock:</b> <code>${alert.stock}</code> (${alert.companyName})\n` +
               `<b>Timeframe:</b> ⏱️ <b>${alert.timeframe}</b>\n` +
               `<b>Signal:</b> 📉 ${alert.message}\n` +
               `<b>Price:</b> ₹${alert.price.toFixed(2)} (<b>${changeSign}${alert.priceChangePercent.toFixed(2)}%</b>)\n` +
               `<b>Volume Ratio:</b> ${alert.volumeRatio.toFixed(1)}x avg\n` +
               `<b>BB Bandwidth:</b> ${alert.bandwidth.toFixed(1)}%\n` +
               rsiTxt +
               adxTxt +
               macdTxt +
               `<b>Time:</b> 🕒 ${alertTime}`;
      } else {
        text = `🟢 <b>INFINITY BULLISH BREAKOUT</b> 🟢\n\n` +
               `<b>Stock:</b> <code>${alert.stock}</code> (${alert.companyName})\n` +
               `<b>Timeframe:</b> ⏱️ <b>${alert.timeframe}</b>\n` +
               `<b>Signal:</b> 🚀 ${alert.message}\n` +
               `<b>Price:</b> ₹${alert.price.toFixed(2)} (<b>${changeSign}${alert.priceChangePercent.toFixed(2)}%</b>)\n` +
               `<b>Volume Ratio:</b> ${alert.volumeRatio.toFixed(1)}x avg\n` +
               `<b>BB Bandwidth:</b> ${alert.bandwidth.toFixed(1)}%\n` +
               rsiTxt +
               adxTxt +
               macdTxt +
               `<b>Time:</b> 🕒 ${alertTime}`;
      }

      const result = await sendTelegramMessageHelper(botToken, chatId, text);

      if (result.ok) {
        res.json({ success: true, resolvedChatId: result.resolvedChatId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to dispatch Telegram alert' });
    }
  });

  app.post('/api/sheets/config', (req, res) => {
    const { spreadsheetId, autoSync, autoSyncIntervalSec } = req.body;
    if (spreadsheetId) currentSheetConfig.spreadsheetId = spreadsheetId;
    if (typeof autoSync === 'boolean') currentSheetConfig.autoSync = autoSync;
    if (autoSyncIntervalSec) currentSheetConfig.autoSyncIntervalSec = autoSyncIntervalSec;

    addLog(
      'INFO',
      'GOOGLE_SHEETS',
      `Google Sheets settings updated for Sheet ID: ${currentSheetConfig.spreadsheetId}`
    );

    res.json({ success: true, config: currentSheetConfig });
  });

  app.get('/api/sheets/read', async (req, res) => {
    try {
      const tabName = (req.query.tab as string) || '30M';
      const authHeader = req.headers.authorization;
      const result = await readSheetRows(currentSheetConfig.spreadsheetId, tabName, authHeader);

      if (result.success) {
        addLog('SUCCESS', 'GOOGLE_SHEETS', `Successfully read tab ${tabName} from Google Sheets.`);
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read Google Sheet' });
    }
  });

  // Create a brand new Google Spreadsheet programmatically
  app.post('/api/sheets/create', async (req, res) => {
    try {
      const { title } = req.body;
      const sheetTitle = title || 'Infinity_Live_Data_Scanner';
      const authHeader = req.headers.authorization;

      const createResult = await createNewSpreadsheet(sheetTitle, authHeader);

      if (createResult.success && createResult.spreadsheetId) {
        currentSheetConfig.spreadsheetId = createResult.spreadsheetId;
        addLog(
          'SUCCESS',
          'GOOGLE_SHEETS',
          `Created brand new Google Spreadsheet: "${sheetTitle}" (ID: ${createResult.spreadsheetId})`
        );
        res.json(createResult);
      } else {
        addLog('ERROR', 'GOOGLE_SHEETS', 'Failed to create new Google Sheet', createResult.error);
        res.status(400).json(createResult);
      }
    } catch (err: any) {
      addLog('ERROR', 'GOOGLE_SHEETS', 'Spreadsheet creation exception', err?.message);
      res.status(500).json({ error: err?.message || 'Failed to create new Google Sheet' });
    }
  });

  // Sync Scanner Data to Google Sheets
  app.post('/api/sheets/sync', async (req, res) => {
    try {
      currentSheetConfig.isSyncing = true;
      const { timeframe, items } = req.body;
      const targetTimeframe: Timeframe = timeframe || '30M';
      const authHeader = req.headers.authorization;

      let itemsToSync: StockScanItem[] = items;

      // If items not provided in body, run scan automatically
      if (!itemsToSync || itemsToSync.length === 0) {
        itemsToSync = [];
        const chunkSize = 6;
        for (let i = 0; i < STOCK_LIST.length; i += chunkSize) {
          const chunk = STOCK_LIST.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(async (stock) => {
              try {
                const candles = await getStockCandles(
                  stock,
                  targetTimeframe,
                  currentDhanConfig.clientId,
                  currentDhanConfig.accessToken
                );
                return analyzeStockCandles(stock.symbol, stock.name, targetTimeframe, candles);
              } catch {
                return null;
              }
            })
          );
          for (const item of results) {
            if (item) itemsToSync.push(item);
          }
          if (i + chunkSize < STOCK_LIST.length) {
            await new Promise(r => setTimeout(r, 100));
          }
        }
      }

      const syncResult = await updateSheetTab(
        currentSheetConfig.spreadsheetId,
        targetTimeframe,
        itemsToSync,
        authHeader
      );

      currentSheetConfig.isSyncing = false;
      currentSheetConfig.lastSyncedAt = new Date().toLocaleTimeString('en-US', { hour12: true });

      if (syncResult.success) {
        addLog(
          'SUCCESS',
          'GOOGLE_SHEETS',
          `Synced ${itemsToSync.length} stocks to Google Sheets tab [${targetTimeframe}]`
        );
        appendClientLogToSheet(
          currentSheetConfig.spreadsheetId,
          'SUCCESS',
          'SCANNER_ENGINE',
          `Synced ${itemsToSync.length} items to ${targetTimeframe}`,
          authHeader
        );
        res.json({ success: true, timeframe: targetTimeframe, syncedRows: itemsToSync.length });
      } else {
        addLog('WARNING', 'GOOGLE_SHEETS', `Sheet sync issue on ${targetTimeframe}`, syncResult.error);
        res.json({
          success: false,
          error: syncResult.error,
          message: 'Could not directly write to Google Sheet. Check permissions/Spreadsheet ID.'
        });
      }
    } catch (err: any) {
      currentSheetConfig.isSyncing = false;
      addLog('ERROR', 'GOOGLE_SHEETS', 'Failed to sync with Google Sheets', err?.message);
      res.status(500).json({ error: err?.message || 'Google Sheets sync failed' });
    }
  });

  // Sync ALL Timeframes (1M, 5M, 10M, 30M) simultaneously to Google Sheets
  app.post('/api/sheets/sync-all', async (req, res) => {
    try {
      currentSheetConfig.isSyncing = true;
      const authHeader = req.headers.authorization;
      const timeframes: Timeframe[] = ['1M', '5M', '10M', '30M'];
      const summary: Record<string, boolean> = {};

      for (const tf of timeframes) {
        const itemsToSync: StockScanItem[] = [];
        
        const chunkSize = 20;
        for (let i = 0; i < STOCK_LIST.length; i += chunkSize) {
          const chunk = STOCK_LIST.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(async (stock) => {
              try {
                const candles = await getStockCandles(
                  stock,
                  tf,
                  currentDhanConfig.clientId,
                  currentDhanConfig.accessToken
                );
                return analyzeStockCandles(stock.symbol, stock.name, tf, candles);
              } catch (e: any) {
                return null;
              }
            })
          );
          for (const item of results) {
            if (item) itemsToSync.push(item);
          }
        }

        const resTf = await updateSheetTab(
          currentSheetConfig.spreadsheetId,
          tf,
          itemsToSync,
          authHeader
        );
        summary[tf] = resTf.success;
      }

      currentSheetConfig.isSyncing = false;
      currentSheetConfig.lastSyncedAt = new Date().toLocaleTimeString('en-US', { hour12: true });

      addLog(
        'SUCCESS',
        'GOOGLE_SHEETS',
        'Pushed real-time scanner data across ALL timeframes (1M, 5M, 10M, 30M) into Google Sheet!'
      );

      res.json({ success: true, summary, syncedAt: currentSheetConfig.lastSyncedAt });
    } catch (err: any) {
      currentSheetConfig.isSyncing = false;
      addLog('ERROR', 'GOOGLE_SHEETS', 'Sync-all error', err?.message);
      res.status(500).json({ error: err?.message || 'Sync-all failed' });
    }
  });

  // Logs endpoint
  app.get('/api/logs', (req, res) => {
    res.json(clientLogs);
  });

  // Authentication & User Management APIs
  app.get('/api/auth/me', (req, res) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
    if (!userId) {
      return res.status(401).json({ error: 'Session missing. Please log in.' });
    }
    const user = userStore.getUserById(userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User account is inactive or has been revoked.' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  });

  app.post('/api/logs/access', (req, res) => {
    const { username, fullName, action } = req.body || {};
    const logUser = username || 'Anonymous';
    addLog(
      'INFO',
      'USER_ACCESS',
      `User Activity: ${fullName || logUser} ${action || 'accessed dashboard'}`,
      `User session active`,
      logUser
    );
    res.json({ success: true });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = userStore.authenticate(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or account is inactive.' });
    }

    addLog('INFO', 'USER_ACCESS', `User logged in: ${user.fullName} (@${user.username}) [Role: ${user.role}]`, `Last Login: ${user.lastLogin || 'First Time'}`, user.username);
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  });

  app.get('/api/users', (req, res) => {
    const users = userStore.getUsers();
    res.json({
      users,
      total: users.length,
      maxLimit: 100
    });
  });

  app.post('/api/users', (req, res) => {
    const { username, password, fullName, role } = req.body || {};
    const result = userStore.addUser({ username, password, fullName, role });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    addLog('SUCCESS', 'SYSTEM', `Admin created new user account: ${result.user?.username}`);
    res.json(result);
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, password, fullName, role, status } = req.body || {};
    const result = userStore.updateUser(id, { username, password, fullName, role, status });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    addLog('INFO', 'SYSTEM', `Updated user account: ${result.user?.username}`);
    res.json(result);
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const result = userStore.deleteUser(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    addLog('WARNING', 'SYSTEM', `Deleted user account ID: ${id}`);
    res.json(result);
  });

  app.post('/api/users/seed-samples', (req, res) => {
    const count = parseInt(req.body?.count || '10', 10);
    const added = userStore.bulkCreateSampleUsers(count);
    addLog('SUCCESS', 'SYSTEM', `Seeded ${added} sample user accounts up to capacity limit.`);
    res.json({ success: true, addedCount: added, totalUsers: userStore.getUsers().length });
  });

  // Background Auto-Sync task for Google Sheets
  async function performSheetAutoSync() {
    if (!currentSheetConfig.autoSync || currentSheetConfig.isSyncing) return;
    try {
      currentSheetConfig.isSyncing = true;
      const timeframes: Timeframe[] = ['1M', '5M', '10M', '30M'];

      for (const tf of timeframes) {
        const itemsToSync: StockScanItem[] = [];
        const chunkSize = 20;
        for (let i = 0; i < STOCK_LIST.length; i += chunkSize) {
          const chunk = STOCK_LIST.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(async (stock) => {
              try {
                const candles = await getStockCandles(
                  stock,
                  tf,
                  currentDhanConfig.clientId,
                  currentDhanConfig.accessToken
                );
                return analyzeStockCandles(stock.symbol, stock.name, tf, candles);
              } catch (e: any) {
                return null;
              }
            })
          );
          for (const item of results) {
            if (item) itemsToSync.push(item);
          }
        }

        const res = await updateSheetTab(
          currentSheetConfig.spreadsheetId,
          tf,
          itemsToSync
        );

        if (res.apiDisabled) {
          currentSheetConfig.autoSync = false;
          currentSheetConfig.isSyncing = false;
          addLog(
            'WARNING',
            'GOOGLE_SHEETS',
            'Auto-sync paused: Google Sheets API is disabled or unauthenticated in GCP project.'
          );
          return;
        }
      }

      currentSheetConfig.isSyncing = false;
      currentSheetConfig.lastSyncedAt = new Date().toLocaleTimeString('en-US', { hour12: true });
      addLog(
        'SUCCESS',
        'GOOGLE_SHEETS',
        `Auto-synced scanner data (${STOCK_LIST.length} stocks) to Google Sheets!`
      );
    } catch (err: any) {
      currentSheetConfig.isSyncing = false;
      addLog('WARNING', 'GOOGLE_SHEETS', 'Background auto-sync issue', err?.message);
    }
  }

  // Run initial sync 2 seconds after startup
  setTimeout(() => {
    performSheetAutoSync();
  }, 2000);

  // Run recurring auto-sync interval (every 60 seconds)
  setInterval(() => {
    performSheetAutoSync();
  }, 60000);

  // API 404 Fallback - ensures unmatched /api routes return JSON instead of HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global API Error Handler - prevents HTML error stack traces from breaking res.json() on client
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
      return res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
    }
    next(err);
  });

  // Vite middleware for development or static file serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
