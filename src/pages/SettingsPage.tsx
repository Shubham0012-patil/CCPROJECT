import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  User,
  KeyRound,
  Database,
  Moon,
  Sun,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Lock,
  LogOut,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';

export const SettingsPage: React.FC = () => {
  const {
    user,
    profile,
    updateProfile,
    pinStatus,
    setLoginPin,
    removeLoginPin,
    setTransactionPin,
    removeTransactionPin,
    signOut,
    isConfigured,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [currency, setCurrency] = useState(profile?.currency || 'INR');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Login PIN form
  const [newLoginPin, setNewLoginPin] = useState('');
  const [confirmLoginPin, setConfirmLoginPin] = useState('');
  const [settingLoginPin, setSettingLoginPin] = useState(false);
  const [loginPinMsg, setLoginPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transaction PIN form
  const [newTxPin, setNewTxPin] = useState('');
  const [confirmTxPin, setConfirmTxPin] = useState('');
  const [settingTxPin, setSettingTxPin] = useState(false);
  const [txPinMsg, setTxPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const { error } = await updateProfile({
        full_name: fullName,
        phone: phone || undefined,
        currency,
      });
      if (error) {
        setProfileMsg({ type: 'error', text: error.message });
      } else {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveLoginPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginPinMsg(null);

    if (newLoginPin.length !== 4 && newLoginPin.length !== 6) {
      setLoginPinMsg({ type: 'error', text: 'Login PIN must be 4 or 6 numeric digits' });
      return;
    }

    if (newLoginPin !== confirmLoginPin) {
      setLoginPinMsg({ type: 'error', text: 'PIN entries do not match' });
      return;
    }

    setSettingLoginPin(true);
    try {
      const res = await setLoginPin(newLoginPin);
      if (!res.success) {
        setLoginPinMsg({ type: 'error', text: res.error || 'Failed to configure Login PIN' });
      } else {
        setLoginPinMsg({ type: 'success', text: 'Login PIN updated securely!' });
        setNewLoginPin('');
        setConfirmLoginPin('');
      }
    } catch (err) {
      setLoginPinMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setSettingLoginPin(false);
    }
  };

  const handleRemoveLoginPin = async () => {
    if (!confirm('Disable Login PIN? You will sign in using your account password.')) return;
    try {
      const res = await removeLoginPin();
      if (!res.success) {
        alert(res.error || 'Failed to remove PIN');
      } else {
        setLoginPinMsg({ type: 'success', text: 'Login PIN disabled' });
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSaveTxPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxPinMsg(null);

    if (newTxPin.length !== 4 && newTxPin.length !== 6) {
      setTxPinMsg({ type: 'error', text: 'Transaction PIN must be 4 or 6 numeric digits' });
      return;
    }

    if (newTxPin !== confirmTxPin) {
      setTxPinMsg({ type: 'error', text: 'Transaction PIN entries do not match' });
      return;
    }

    setSettingTxPin(true);
    try {
      const res = await setTransactionPin(newTxPin);
      if (!res.success) {
        setTxPinMsg({ type: 'error', text: res.error || 'Failed to configure Transaction PIN' });
      } else {
        setTxPinMsg({ type: 'success', text: 'Transaction PIN configured securely!' });
        setNewTxPin('');
        setConfirmTxPin('');
      }
    } catch (err) {
      setTxPinMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setSettingTxPin(false);
    }
  };

  const handleRemoveTxPin = async () => {
    if (!confirm('Disable Transaction PIN? Financial modifications will no longer require PIN authorization.')) return;
    try {
      const res = await removeTransactionPin();
      if (!res.success) {
        alert(res.error || 'Failed to remove Transaction PIN');
      } else {
        setTxPinMsg({ type: 'success', text: 'Transaction PIN disabled' });
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const copySqlSchema = async () => {
    try {
      const resp = await fetch('/supabase/schema.sql');
      let text = '';
      if (resp.ok) text = await resp.text();
      if (!text) text = `-- Run NEXMONEY schema from /supabase/schema.sql`;
      await navigator.clipboard.writeText(text);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    } catch {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Settings & Security
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your profile, PIN security locks, database configuration, and appearance preferences.
        </p>
      </div>

      {/* 1. PROFILE SETTINGS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Personal Profile</h2>
            <p className="text-[11px] text-slate-500">Stored securely in Supabase `profiles` table</p>
          </div>
        </div>

        {profileMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              profileMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200'
            }`}
          >
            {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Email
              </label>
              <input
                type="text"
                disabled
                value={user?.email || ''}
                className="w-full text-xs px-3 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Shubham Kumar"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Reporting Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              id="save-profile-btn"
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. TRANSACTION PIN SETTINGS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Transaction PIN Security</h2>
              <p className="text-[11px] text-slate-500">Required before sensitive operations (Khata, Expenses, Loans)</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              pinStatus.hasAppPin
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
            }`}
          >
            {pinStatus.hasAppPin ? 'Active & Enforced' : 'Not Configured'}
          </span>
        </div>

        {txPinMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              txPinMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200'
            }`}
          >
            {txPinMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{txPinMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveTxPin} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {pinStatus.hasAppPin ? 'New Transaction PIN (4 or 6 Digits)' : 'Set Transaction PIN (4 or 6 Digits)'}
              </label>
              <input
                id="new-tx-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newTxPin}
                onChange={(e) => setNewTxPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Transaction PIN
              </label>
              <input
                id="confirm-tx-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmTxPin}
                onChange={(e) => setConfirmTxPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {pinStatus.hasAppPin ? (
              <button
                type="button"
                onClick={handleRemoveTxPin}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disable Transaction PIN</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">PIN is hashed with pgcrypto / SHA-256</span>
            )}

            <button
              id="save-tx-pin-btn"
              type="submit"
              disabled={settingTxPin || (newTxPin.length !== 4 && newTxPin.length !== 6)}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {settingTxPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{pinStatus.hasAppPin ? 'Update PIN' : 'Activate Transaction PIN'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. LOGIN PIN SETTINGS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick Login PIN</h2>
              <p className="text-[11px] text-slate-500">Fast sign-in alternative on trusted devices</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              pinStatus.hasLoginPin
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {pinStatus.hasLoginPin ? 'Active' : 'Unset'}
          </span>
        </div>

        {loginPinMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              loginPinMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200'
            }`}
          >
            {loginPinMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{loginPinMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveLoginPin} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {pinStatus.hasLoginPin ? 'New Login PIN' : 'Set Login PIN (4 or 6 Digits)'}
              </label>
              <input
                id="new-login-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newLoginPin}
                onChange={(e) => setNewLoginPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Login PIN
              </label>
              <input
                id="confirm-login-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmLoginPin}
                onChange={(e) => setConfirmLoginPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {pinStatus.hasLoginPin ? (
              <button
                type="button"
                onClick={handleRemoveLoginPin}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disable Login PIN</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Optional fast login PIN</span>
            )}

            <button
              id="save-login-pin-btn"
              type="submit"
              disabled={settingLoginPin || (newLoginPin.length !== 4 && newLoginPin.length !== 6)}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {settingLoginPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{pinStatus.hasLoginPin ? 'Update PIN' : 'Save Login PIN'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. DATABASE & SCHEMA CONFIGURATION */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Supabase PostgreSQL Schema</h2>
              <p className="text-[11px] text-slate-500">Production SQL DDL with RLS, triggers & secure PIN hashing RPCs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl hover:bg-emerald-100 transition"
          >
            Connection Settings
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">Complete Schema Script (`schema.sql`)</p>
            <p className="text-[11px] text-slate-500">Run this in your Supabase SQL editor to create all 8 tables and RPCs.</p>
          </div>
          <button
            id="copy-schema-settings-btn"
            type="button"
            onClick={copySqlSchema}
            className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0"
          >
            {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSchema ? 'SQL Copied to Clipboard!' : 'Copy SQL Schema'}</span>
          </button>
        </div>
      </div>

      {/* 5. PREFERENCES & LOGOUT */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
          Preferences & Session
        </h2>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Color Theme</p>
            <p className="text-[11px] text-slate-500">Switch between light and dark UI presentation</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Session Management</p>
            <p className="text-[11px] text-slate-500">Sign out of your NEXMONEY account</p>
          </div>
          <button
            id="settings-logout-btn"
            type="button"
            onClick={() => signOut()}
            className="px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 rounded-xl transition flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <SupabaseConfigModal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} />
    </div>
  );
};
