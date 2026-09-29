import React, { useState } from 'react';
import { DhanConfig } from '../types';
import { X, Key, Zap, ShieldAlert, Globe, CheckCircle2 } from 'lucide-react';

interface DhanApiModalProps {
  dhanConfig: DhanConfig;
  onSaveConfig: (clientId: string, accessToken: string) => void;
  onClose: () => void;
}

export const DhanApiModal: React.FC<DhanApiModalProps> = ({
  dhanConfig,
  onSaveConfig,
  onClose,
}) => {
  const [clientId, setClientId] = useState(dhanConfig.clientId || '1108096138');
  const [accessToken, setAccessToken] = useState(dhanConfig.accessToken);
  const [testAmoLoading, setTestAmoLoading] = useState(false);
  const [testAmoResult, setTestAmoResult] = useState<string | null>(null);
  const [ipCheckLoading, setIpCheckLoading] = useState(false);
  const [ipCheckResult, setIpCheckResult] = useState<{
    detectedIp: string;
    whitelisted: boolean;
    whitelistedIp: string;
    source?: string;
    dhanResponse?: any;
  } | null>(null);

  const handleCheckIp = async () => {
    setIpCheckLoading(true);
    try {
      const res = await fetch('/api/dhan/ip-check', {
        headers: {
          'access-token': accessToken || dhanConfig.accessToken,
          'client-id': clientId || dhanConfig.clientId || '1108096138'
        }
      });
      const data = await res.json();
      setIpCheckResult(data);
    } catch (e: any) {
      setIpCheckResult({
        detectedIp: `Error: ${e.message}`,
        whitelisted: false,
        whitelistedIp: '15.252.191.43'
      });
    } finally {
      setIpCheckLoading(false);
    }
  };

  const handleTestAmo = async () => {
    setTestAmoLoading(true);
    setTestAmoResult(null);
    try {
      const res = await fetch('/api/dhan/test-amo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || dhanConfig.accessToken,
          'client-id': clientId || dhanConfig.clientId || '1108096138'
        }
      });
      const data = await res.json();
      if (res.ok) {
        setTestAmoResult(`SUCCESS: Order ID ${data.orderId || data.id || 'Submitted'} | Status: ${data.orderStatus || 'SUCCESS'}`);
      } else {
        setTestAmoResult(`Error (${data.errorCode || res.status}): ${data.errorMessage || data.message || JSON.stringify(data)}`);
      }
    } catch (e: any) {
      setTestAmoResult(`Error: ${e.message}`);
    } finally {
      setTestAmoLoading(false);
    }
  };

  const handleSave = () => {
    onSaveConfig(clientId, accessToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-900 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header & High-visibility Close Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0 relative pr-24">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Dhan HQ Market API Setup</h3>
              <p className="text-xs text-slate-500">
                Direct live connection to Dhan HQ API
              </p>
            </div>
          </div>

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

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 py-4 space-y-4 flex-1">
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start space-x-3">
            <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Live Dhan API Required:</span> Simulation mode is completely disabled. All stock scan metrics and intraday candles are retrieved directly from Dhan HQ API. If connection fails or credentials are missing, an error will be displayed.
            </div>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dhan Client ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. 100029384"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dhan Access Token <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Generate your token in Dhan Web App → Profile → API Access
              </p>
            </div>

            {/* IP Whitelist Verification Diagnostic */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dhan IP Whitelist Check</span>
                  </span>
                  <p className="text-[10px] text-slate-500">Query outbound IP detected by Dhan API / relay</p>
                </div>
                <button
                  type="button"
                  disabled={ipCheckLoading}
                  onClick={handleCheckIp}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition-colors border border-blue-500 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {ipCheckLoading ? 'Checking...' : '🔍 Verify IP with Dhan'}
                </button>
              </div>

              {ipCheckResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-[11px] font-mono leading-tight space-y-1.5 ${
                  ipCheckResult.whitelisted
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border border-amber-300'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Dhan Detected IP: {ipCheckResult.detectedIp || 'Resolving...'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      ipCheckResult.whitelisted ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {ipCheckResult.whitelisted ? '✓ WHITELISTED' : '⚠ MATCH STATUS: ' + (ipCheckResult.dhanResponse?.ipMatchStatus || 'CHECK')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-700 pt-1 border-t border-slate-200/60">
                    <div>
                      Primary IP: <span className="font-bold text-slate-900">{ipCheckResult.dhanResponse?.primaryIP || 'Not set'}</span>
                    </div>
                    <div>
                      Secondary IP: <span className="font-bold text-slate-900">{ipCheckResult.dhanResponse?.secondaryIP || ipCheckResult.whitelistedIp || '15.252.191.43'}</span>
                    </div>
                    <div>
                      Orders Allowed: <span className={`font-bold ${ipCheckResult.dhanResponse?.ordersAllowed ? 'text-emerald-700' : 'text-amber-700'}`}>{ipCheckResult.dhanResponse?.ordersAllowed ? 'YES (Live Ready)' : 'NO / Check Whitelist'}</span>
                    </div>
                    <div>
                      Match Status: <span className="font-bold">{ipCheckResult.dhanResponse?.ipMatchStatus || (ipCheckResult.whitelisted ? 'MATCH' : 'MISMATCH')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Minimal AMO Order on Lightsail Static IP */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Test Static IP AMO Order</span>
                  <p className="text-[10px] text-slate-500">Executes 1 share IDEA LIMIT AMO buy order with clean headers</p>
                </div>
                <button
                  type="button"
                  disabled={testAmoLoading}
                  onClick={handleTestAmo}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] rounded-lg transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
                >
                  {testAmoLoading ? 'Testing...' : '⚡ Test AMO Order'}
                </button>
              </div>

              {testAmoResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-[11px] font-mono leading-tight ${
                  testAmoResult.startsWith('SUCCESS')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}>
                  {testAmoResult}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            Save Credentials
          </button>
        </div>

      </div>
    </div>
  );
};
