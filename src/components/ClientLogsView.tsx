import React from 'react';
import { ClientLog } from '../types';
import { Terminal, ShieldCheck, AlertTriangle, Info, CheckCircle2, User } from 'lucide-react';

interface ClientLogsViewProps {
  logs: ClientLog[];
  onRefreshLogs: () => void;
}

export const ClientLogsView: React.FC<ClientLogsViewProps> = ({ logs, onRefreshLogs }) => {
  return (
    <div className="max-w-7xl mx-auto my-6 px-4 sm:px-6 lg:px-8">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">System &amp; Google Sheets Client Audit Logs</h3>
          </div>
          <button
            onClick={onRefreshLogs}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
          >
            Refresh Logs
          </button>
        </div>

        {/* Logs List */}
        <div className="p-4 space-y-2.5 font-mono text-xs max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No logs generated yet.</div>
          ) : (
            logs.map((log) => {
              const isSuccess = log.level === 'SUCCESS';
              const isError = log.level === 'ERROR';
              const isWarning = log.level === 'WARNING';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border flex items-start space-x-3 transition-colors ${
                    isSuccess
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : isError
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : isWarning
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {isError && <AlertTriangle className="w-4 h-4 text-red-600" />}
                    {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-slate-500" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold uppercase">
                        {log.category}
                      </span>
                      {log.user && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold flex items-center gap-1">
                          <User className="w-2.5 h-2.5 text-indigo-600" />
                          {log.user}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="font-semibold text-slate-900 leading-snug">{log.message}</p>
                    {log.details && (
                      <p className="text-[11px] text-slate-600 mt-1 truncate">{log.details}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
