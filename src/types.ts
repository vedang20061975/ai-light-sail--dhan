export type Timeframe = '1M' | '5M' | '10M' | '30M';

export interface StockScanItem {
  id: string;
  stock: string;
  companyName: string;
  currentPrice: number;
  aiKnnLine: number;
  averageLine: number;
  status: string;
  timestamp: string;
  timeframe: Timeframe;
  // Technical indicator metrics
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  bandwidth: number; // Current bandwidth %
  prevBandwidth: number; // Bandwidth before expansion (contraction state)
  volume: number;
  avgVolume: number;
  volumeRatio: number; // Volume / AvgVolume
  knnSignal: 'BULLISH_CROSS' | 'BEARISH_EXPANSION' | 'SQUEEZE_RELEASE' | 'NEUTRAL';
  priceChangePercent: number;
  rsi: number; // Relative Strength Index (14)
  adx: number; // Average Directional Index (14)
  macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface DhanConfig {
  clientId: string;
  accessToken: string;
  isConnected: boolean;
  mode: 'live_dhan';
  lastPing?: string;
}

export interface SheetConfig {
  spreadsheetId: string;
  selectedSheet: string;
  autoSync: boolean;
  autoSyncIntervalSec: number;
  lastSyncedAt?: string;
  isSyncing: boolean;
  statusMessage?: string;
}

export interface ScannerFilter {
  search: string;
  statusType: 'ALL' | 'BULLISH' | 'BEARISH';
  minVolumeMultiplier: number;
  minBandwidthExpansion: number;
}

export interface ClientLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  category: 'DHAN_API' | 'GOOGLE_SHEETS' | 'SCANNER_ENGINE' | 'SYSTEM' | 'USER_ACCESS';
  message: string;
  details?: string;
  user?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string; // Plaintext or hashed password for admin management
  fullName: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserAccount | null;
  token?: string;
}

export interface UserListResponse {
  success?: boolean;
  users: UserAccount[];
  total: number;
  maxLimit: number;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  sendOnBullishCross: boolean;
  sendOnBearishExpansion: boolean;
  sendOnSqueezeRelease: boolean;
}

export interface AlertRuleConfig {
  enabled: boolean;
  soundEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  volumeAlertsEnabled: boolean;
  telegram: TelegramConfig;
  timeframes: Record<Timeframe, boolean>;
  signals: {
    bullishCross: boolean;
    bearishExpansion: boolean;
    squeezeRelease: boolean;
    minVolumeRatio: number;
    minPriceChangePercent: number;
    minBandwidthExpansion: number;
    minADX?: number;
    bullishMinRSI?: number;
    bearishMaxRSI?: number;
  };
  // Dhan Live Trading Rules Engine Configurations
  dhanLiveOrderEngine?: boolean;
  strictlyOnlyNSEHours?: boolean;
  freshnessWindow?: {
    '30M': string;
    '10M': string;
    '5M': string;
    '1M': string;
  };
  accountAllocationCapital?: number;
  capitalPerTrade?: number;
  riskRewardRatio?: string;
  maxOpenPositions?: number;
  useTechnicalBBMdleSL?: boolean;
  quickProfitAutoExit?: number | 'OFF';
  quickMaxLossAutoExit?: number | 'OFF';
  enableSlippageEngine?: boolean;
  bidAskSpreadPercent?: number;
  brokerSlippagePercent?: number;
  autoDeductDhanTaxes?: boolean;
}

export interface TriggeredAlertItem {
  id: string;
  stock: string;
  companyName: string;
  timeframe: Timeframe;
  signalType: 'BULLISH_CROSS' | 'BEARISH_EXPANSION' | 'SQUEEZE_RELEASE' | 'HIGH_VOLUME' | 'BREAKOUT';
  message: string;
  price: number;
  priceChangePercent: number;
  volumeRatio: number;
  bandwidth: number;
  triggeredAt: string;
  read: boolean;
  rsi?: number;
  adx?: number;
  macdSignal?: string;
}

