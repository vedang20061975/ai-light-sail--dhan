import React, { useState } from 'react';
import { Lock, Unlock, ShieldCheck, Key, FileSpreadsheet, X, Check, AlertCircle, ShieldAlert, LogIn } from 'lucide-react';
import { DhanConfig, SheetConfig, UserAccount } from '../types';

interface AdminLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  targetName?: string;
  adminPin: string;
  onChangePin: (newPin: string) => void;
  dhanConfig: DhanConfig;
  sheetConfig: SheetConfig;
  currentUser?: UserAccount | null;
  onOpenLoginModal?: () => void;
}

export const AdminLockModal: React.FC<AdminLockModalProps> = ({
  isOpen,
  onClose,
  onUnlockSuccess,
  targetName = 'Settings',
  adminPin,
  onChangePin,
  dhanConfig,
  sheetConfig,
  currentUser,
  onOpenLoginModal,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [error, setError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  // Guard for Non-Admin Users: Strictly Inaccessible
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-900 my-auto max-h-[92vh] flex flex-col">
          
          {/* Close Button */}
          <button
            onClick={onClose}
            type="button"
            title="Close Modal"
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-rose-500 text-slate-700 hover:text-white border border-slate-300 hover:border-rose-600 shadow-md transition-all flex items-center gap-1.5 font-bold text-xs z-30 cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Close</span>
          </button>

          {/* Modal Header */}
          <div className="flex items-center space-x-3.5 mb-5">
            <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shadow-sm flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Access Restricted</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetName} is locked for standard users
              </p>
            </div>
          </div>

          {/* Access Denied Warning Box */}
          <div className="bg-rose-50/80 border border-rose-200/90 rounded-xl p-4 mb-5 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-rose-900">
              <Lock className="w-4 h-4 text-rose-600" />
              <span>Admin Rights Required</span>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">
              Opening protected data, live API credentials, Google Sheets integration, or system logs is strictly restricted. Only an authorized <strong>Admin account</strong> has access rights to view or modify these protected items.
            </p>
          </div>

          {/* Current User Status */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs mb-6 flex items-center justify-between">
            <span className="text-slate-500">Your Current Session:</span>
            <span className="font-semibold text-slate-800 flex items-center space-x-1">
              <span>{currentUser?.fullName || 'User'}</span>
              <span className="px-1.5 py-0.2 uppercase text-[10px] font-bold rounded bg-slate-200 text-slate-600">
                {currentUser?.role || 'user'}
              </span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenLoginModal) onOpenLoginModal();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center space-x-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sign In as Admin</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.trim() === adminPin) {
      setError('');
      setEnteredPin('');
      onUnlockSuccess();
    } else {
      setError('Incorrect Admin PIN. Default PIN is 1234');
    }
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.length < 4) {
      setError('PIN must be at least 4 digits/characters');
      return;
    }
    onChangePin(newPinInput.trim());
    setPinChangeSuccess(true);
    setIsChangingPin(false);
    setNewPinInput('');
    setTimeout(() => setPinChangeSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-900 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header & Prominent Close Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0 relative pr-24 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Protected Admin Settings</h3>
              <p className="text-xs text-slate-500">
                {targetName} configuration is locked to protect live feeds
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

        {/* Security Alert Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold mb-1">Published Application Security</p>
            <p className="text-amber-800/90 leading-relaxed">
              API credentials and Google Sheet IDs are locked so visitors using the public link cannot modify or break the app setup.
            </p>
          </div>
        </div>

        {/* Current Connection Status Summary (Read-Only) */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 mb-5 space-y-2.5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Backend Status (Read-Only)
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
            <span className="flex items-center text-slate-700 font-medium">
              <Key className="w-3.5 h-3.5 text-slate-400 mr-2" />
              Dhan HQ Feed:
            </span>
            <span className={`font-semibold px-2 py-0.5 rounded border ${
              dhanConfig.isConnected
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {dhanConfig.isConnected ? 'Live HQ Active' : 'Disconnected'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <span className="flex items-center text-slate-700 font-medium">
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 mr-2" />
              Google Sheet:
            </span>
            <span className="font-mono text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded truncate max-w-[160px]">
              {sheetConfig.spreadsheetId.slice(0, 10)}...
            </span>
          </div>
        </div>

        {/* PIN Entry Form */}
        {!isChangingPin ? (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Enter Admin PIN to Unlock {targetName}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setError('');
                  }}
                  placeholder="Default PIN: 1234"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Default PIN is <span className="font-mono font-bold text-slate-700">1234</span>
              </p>
            </div>

            {error && (
              <div className="flex items-center space-x-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {pinChangeSuccess && (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>Admin PIN updated successfully!</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setIsChangingPin(true)}
                className="text-xs text-slate-500 hover:text-amber-700 underline font-medium"
              >
                Set Custom PIN
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  View Only
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center space-x-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock Settings</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Change PIN Form */
          <form onSubmit={handleSaveNewPin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Set New Admin Security PIN
              </label>
              <input
                type="text"
                value={newPinInput}
                onChange={(e) => {
                  setNewPinInput(e.target.value);
                  setError('');
                }}
                placeholder="Enter new 4-digit PIN"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(false);
                  setError('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md"
              >
                Save New PIN
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
