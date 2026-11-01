import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users2,
  Receipt,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { khataService } from '../services/khataService';
import { expenseService } from '../services/expenseService';
import { loanService } from '../services/loanService';
import { KhataTransaction, Expense, LongTermLoan } from '../types';

export const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [khataTxs, setKhataTxs] = useState<KhataTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<LongTermLoan[]>([]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [kRes, eRes, lRes] = await Promise.all([
        khataService.getTransactions(),
        expenseService.getExpenses(),
        loanService.getLoans(),
      ]);

      setKhataTxs(kRes.data);
      setExpenses(eRes.data);
      setLoans(lRes.data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Currency Formatter
  const formatCur = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // 1. KHATA INDEPENDENT CALCULATIONS
  let khataGiven = 0;
  let khataReceived = 0;
  let khataPendingCount = 0;
  khataTxs.forEach((t) => {
    if (t.type === 'GIVEN') khataGiven += Number(t.amount);
    if (t.type === 'RECEIVED') khataReceived += Number(t.amount);
    if (t.status === 'PENDING') khataPendingCount++;
  });
  const khataNetBalance = khataGiven - khataReceived;

  // 2. EXPENSES INDEPENDENT CALCULATIONS
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
  const currentYearStr = todayStr.substring(0, 4); // YYYY

  let expensesToday = 0;
  let expensesThisMonth = 0;
  let expensesThisYear = 0;

  expenses.forEach((e) => {
    const amt = Number(e.amount);
    if (e.expense_date === todayStr) expensesToday += amt;
    if (e.expense_date.startsWith(currentMonthStr)) expensesThisMonth += amt;
    if (e.expense_date.startsWith(currentYearStr)) expensesThisYear += amt;
  });

  // 3. LOANS INDEPENDENT CALCULATIONS
  let loansGivenTotal = 0;
  let loansGivenOutstanding = 0;
  let loansTakenTotal = 0;
  let loansTakenOutstanding = 0;
  let activeLoansCount = 0;

  loans.forEach((l) => {
    const orig = Number(l.original_amount);
    const rem = Number(l.remaining_amount ?? orig);
    if (l.status === 'ACTIVE') activeLoansCount++;

    if (l.loan_type === 'GIVEN') {
      loansGivenTotal += orig;
      loansGivenOutstanding += rem;
    } else {
      loansTakenTotal += orig;
      loansTakenOutstanding += rem;
    }
  });

  // Combined Recent Activity for display (purely chronological, no cross-mixing of math)
  interface ActivityItem {
    id: string;
    module: 'KHATA' | 'EXPENSE' | 'LOAN';
    title: string;
    subtitle: string;
    amount: number;
    date: string;
    badgeColor: string;
    type?: string;
  }

  const activities: ActivityItem[] = [
    ...khataTxs.map((k) => ({
      id: `khata-${k.id}`,
      module: 'KHATA' as const,
      title: `${k.type === 'GIVEN' ? 'Given to' : 'Received from'} ${k.person?.name || 'Contact'}`,
      subtitle: `Khata Ledger • ${k.status} • ${k.payment_method}`,
      amount: Number(k.amount),
      date: k.transaction_date,
      badgeColor: k.type === 'GIVEN' ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
      type: k.type,
    })),
    ...expenses.map((e) => ({
      id: `exp-${e.id}`,
      module: 'EXPENSE' as const,
      title: `${e.category}`,
      subtitle: `Personal Expense • ${e.payment_method}`,
      amount: Number(e.amount),
      date: e.expense_date,
      badgeColor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
    })),
    ...loans.map((l) => ({
      id: `loan-${l.id}`,
      module: 'LOAN' as const,
      title: `Loan ${l.loan_type === 'GIVEN' ? 'to' : 'from'} ${l.person_name}`,
      subtitle: `Long-Term Loan • ${l.status} • ${l.progress_pct || 0}% repaid`,
      amount: Number(l.original_amount),
      date: l.start_date,
      badgeColor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
      type: l.loan_type,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome header & Quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 dark:from-slate-900 dark:via-blue-950/60 dark:to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Welcome, {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            NEXMONEY Personal Finance Dashboard. Every module is independently tracked and strictly isolated.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-dashboard-btn"
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition backdrop-blur-xs disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/khata"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Record</span>
          </Link>
        </div>
      </div>

      {/* THREE INDEPENDENT FINANCIAL MODULE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. KHATA CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:border-blue-300 dark:hover:border-blue-800 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Module 01
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Khata Ledger</h2>
              </div>
            </div>
            <Link to="/khata" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              View &rarr;
            </Link>
          </div>

          <div className="pt-2 pb-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Net Khata Balance</p>
            <p className={`text-2xl font-black mt-0.5 ${khataNetBalance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCur(khataNetBalance)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Given
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(khataGiven)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" /> Received
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(khataReceived)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Pending settlement records:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{khataPendingCount}</span>
          </div>
        </div>

        {/* 2. EXPENSES CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:border-amber-300 dark:hover:border-amber-800 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Module 02
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Personal Expenses</h2>
              </div>
            </div>
            <Link to="/expenses" className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">
              View &rarr;
            </Link>
          </div>

          <div className="pt-2 pb-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">This Month&apos;s Spending</p>
            <p className="text-2xl font-black mt-0.5 text-amber-600 dark:text-amber-400">
              {formatCur(expensesThisMonth)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> Today
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(expensesToday)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-amber-500" /> This Year
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(expensesThisYear)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Total Expense Entries:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{expenses.length}</span>
          </div>
        </div>

        {/* 3. LONG-TERM LOANS CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:border-emerald-300 dark:hover:border-emerald-800 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Module 03
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Long-Term Loans</h2>
              </div>
            </div>
            <Link to="/loans" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              View &rarr;
            </Link>
          </div>

          <div className="pt-2 pb-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding Given</p>
            <p className="text-2xl font-black mt-0.5 text-emerald-600 dark:text-emerald-400">
              {formatCur(loansGivenOutstanding)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Outstanding Taken
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(loansTakenOutstanding)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Active Loans
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{activeLoansCount}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Total Loan Contracts:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{loans.length}</span>
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY & EMPTY STATE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Financial Activity</h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Chronological log across isolated modules
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Clean Slate — No Activity Yet</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              You have no transactions, expenses, or loans recorded yet. Add your first record to begin managing your money.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                to="/khata"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
              >
                + Khata Record
              </Link>
              <Link
                to="/expenses"
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition"
              >
                + Add Expense
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Module</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {activities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${act.badgeColor}`}>
                        {act.module}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{act.title}</p>
                      <p className="text-[11px] text-slate-400">{act.subtitle}</p>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {act.date}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCur(act.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
