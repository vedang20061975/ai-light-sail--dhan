import React, { useState } from 'react';
import { SheetConfig } from '../types';
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Play, Clock } from 'lucide-react';

interface GoogleSheetsModalProps {
  sheetConfig: SheetConfig;
  onSaveConfig: (newConfig: Partial<SheetConfig>) => void;
  onSyncAllTabs: () => void;
  onTestReadTab: (tabName: string) => void;
  onCreateNewSheet: (title: string) => Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; error?: string }>;
  onClose: () => void;
  readStatus?: { success?: boolean; rowsCount?: number; message?: string };
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  sheetConfig,
  onSaveConfig,
  onSyncAllTabs,
  onTestReadTab,
  onCreateNewSheet,
  onClose,
  readStatus,
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState(sheetConfig.spreadsheetId);
  const [autoSync, setAutoSync] = useState(sheetConfig.autoSync);
  const [autoSyncIntervalSec, setAutoSyncIntervalSec] = useState(sheetConfig.autoSyncIntervalSec);
  const [selectedTestTab, setSelectedTestTab] = useState('30M');

  // Create new sheet state
  const [newSheetTitle, setNewSheetTitle] = useState('TRENDFLUX_Scanner');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ success?: boolean; text?: string; url?: string }>({});

  const handleCreateSheet = async () => {
    setIsCreatingSheet(true);
    setCreateMsg({});
    try {
      const res = await onCreateNewSheet(newSheetTitle);
      if (res.success && res.spreadsheetId) {
        setSpreadsheetId(res.spreadsheetId);
        setCreateMsg({
          success: true,
          text: `Created new Google Sheet "${newSheetTitle}"!`,
          url: res.spreadsheetUrl
        });
      } else {
        setCreateMsg({
          success: false,
          text: res.error || 'Failed to create sheet'
        });
      }
    } catch (err: any) {
      setCreateMsg({
        success: false,
        text: err?.message || 'Error creating sheet'
      });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      spreadsheetId,
      autoSync,
      autoSyncIntervalSec,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-5 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-900 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header & Prominent Close Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0 relative pr-24">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Google Sheets Integration</h3>
              <p className="text-xs text-slate-500">
                Sync live scanner stock results directly to <span className="text-emerald-700 font-mono font-bold">TRENDFLUX</span> Google Sheet
              </p>
            </div>
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

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 py-4 space-y-4 flex-1">
          
          {/* Create New Sheet Card */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-2">
            <span className="text-xs font-bold text-emerald-900 block">
              ✨ Create A Brand New Google Sheet (With Custom Name)
            </span>
            <p className="text-[11px] text-slate-700">
              Create a fresh sheet with tabs: <span className="font-mono text-emerald-800 font-bold">30M, 10M, 5M, 1M, Client_Logs</span>
            </p>
            <div className="flex space-x-2 pt-1">
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder="e.g. Stock_Scanner_Live_Data"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
              />
              <button
                type="button"
                onClick={handleCreateSheet}
                disabled={isCreatingSheet}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shrink-0 transition-colors disabled:opacity-50 flex items-center space-x-1 shadow-2xs"
              >
                {isCreatingSheet && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Create Sheet</span>
              </button>
            </div>

            {createMsg.text && (
              <div className="mt-2 text-xs p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                {createMsg.success ? (
                  <div className="text-emerald-800 font-medium space-y-1">
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{createMsg.text}</span>
                    </div>
                    {createMsg.url && (
                      <a
                        href={createMsg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:underline pt-0.5 font-semibold"
                      >
                        <span>Open New Sheet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-amber-800 flex items-start space-x-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div className="text-[11px] leading-relaxed break-words">
                        <span>{createMsg.text}</span>
                      </div>
                    </div>
                    {createMsg.text?.includes('console.developers.google.com') && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-2">
                        <p className="font-medium text-amber-900">
                          To auto-create NEW sheets, enable the Google Sheets API in your Google Cloud Console:
                        </p>
                        <a
                          href="https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=763068758825"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 font-bold text-emerald-800 hover:text-emerald-900 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300 shadow-2xs"
                        >
                          <span>Click here to enable Google Sheets API in GCP</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <p className="text-[10px] text-slate-600">
                          Or enter an existing Google Sheet ID below to sync immediately.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Active Google Spreadsheet ID
              </label>
              <button
                type="button"
                onClick={() => setSpreadsheetId('17n1PA02wtzR-vGSI30df_MQXSUJligvSrtWbPxf3CMA')}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline"
              >
                Use Preset Default Sheet ID
              </button>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="17n1PA02wtzR-vGSI30df_MQXSUJligvSrtWbPxf3CMA"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
              />
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 flex items-center justify-center border border-slate-300"
                title="Open Google Sheet"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Extracted from URL: <span className="font-mono text-slate-700">docs.google.com/spreadsheets/d/<b>17n1PA02...</b></span>
            </p>
          </div>

          {/* Auto-Sync Configuration */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-900">Automatic Background Sync</span>
              </div>
              <button
                onClick={() => setAutoSync(!autoSync)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoSync ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoSync ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {autoSync && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-600">Sync Interval:</span>
                <select
                  value={autoSyncIntervalSec}
                  onChange={(e) => setAutoSyncIntervalSec(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 text-xs focus:outline-none"
                >
                  <option value={30}>Every 30 Seconds</option>
                  <option value={60}>Every 1 Minute</option>
                  <option value={300}>Every 5 Minutes</option>
                </select>
              </div>
            )}
          </div>

          {/* Test Tab Read */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold block mb-2 text-slate-800">
              Verify Google Sheet Read Access:
            </span>
            <div className="flex items-center space-x-2">
              {['30M', '10M', '5M', '1M', 'Client_Logs'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setSelectedTestTab(tab);
                    onTestReadTab(tab);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                    selectedTestTab === tab
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {readStatus && (
              <div className="mt-3 text-xs p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                {readStatus.success ? (
                  <div className="flex items-center space-x-1.5 text-emerald-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Read successful! Tab [{selectedTestTab}] contains {readStatus.rowsCount} rows.</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>{readStatus.message || 'Sheet read pending / authorization ready.'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-200 gap-2 shrink-0">
          <button
            onClick={onSyncAllTabs}
            disabled={sheetConfig.isSyncing}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Sync All Tabs (1M, 5M, 10M, 30M) Now</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              Save Settings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
