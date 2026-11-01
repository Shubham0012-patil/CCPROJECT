import React, { useState } from 'react';
import { ShieldCheck, X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TransactionPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  actionTitle?: string;
  actionDescription?: string;
}

export const TransactionPinModal: React.FC<TransactionPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionTitle = 'Authorize Transaction',
  actionDescription = 'Enter your 4 or 6-digit Transaction PIN to confirm this financial operation.',
}) => {
  const { pinStatus, verifyTransactionPin } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4 && pin.length !== 6) {
      setError('Transaction PIN must be 4 or 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verifyTransactionPin(pin);
      if (!res.success) {
        setError(res.error || 'Incorrect Transaction PIN');
        setLoading(false);
        return;
      }

      setPin('');
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Authorization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="transaction-pin-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{actionTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">NEXMONEY Security Verification</p>
            </div>
          </div>
          <button
            id="close-pin-modal-btn"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!pinStatus.hasAppPin ? (
          <div className="py-5 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Transaction PIN Not Configured</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              You must set a 4 or 6-digit Transaction PIN in Settings before performing financial operations.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <a
                href="/settings"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Go to Settings
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {actionDescription}
            </p>

            {error && (
              <div className="p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="tx-pin-input" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Enter Security PIN
              </label>
              <input
                id="tx-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
                className="w-full text-center tracking-[0.6em] text-2xl font-bold py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 text-center">
                Enter your {pinStatus.appPinLength ? `${pinStatus.appPinLength}-digit` : '4 or 6-digit'} Transaction PIN
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                id="cancel-pin-btn"
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                id="verify-pin-submit-btn"
                type="submit"
                disabled={loading || (pin.length !== 4 && pin.length !== 6)}
                className="flex-1 py-2.5 px-4 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{loading ? 'Verifying...' : 'Authorize'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
