import React, { useEffect, useState, useMemo } from 'react';
import {
  FileBarChart2,
  Calendar,
  Filter,
  Download,
  Receipt,
  Users2,
  Landmark,
  PieChart as PieIcon,
  BarChart3,
  Loader2,
  AlertCircle,
  Cloud,
  UploadCloud,
  CheckCircle2,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { khataService } from '../services/khataService';
import { expenseService } from '../services/expenseService';
import { loanService } from '../services/loanService';
import { KhataTransaction, Expense, LongTermLoan, UploadProgressState } from '../types';
import { pdfService } from '../services/pdfService';
import { cloudStorageService } from '../services/cloudStorageService';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const ReportsPage: React.FC = () => {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [khataTxs, setKhataTxs] = useState<KhataTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<LongTermLoan[]>([]);

  // Filters
  const [moduleFilter, setModuleFilter] = useState<'ALL' | 'KHATA' | 'EXPENSES' | 'LOANS'>('ALL');
  const [dateRange, setDateRange] = useState<'THIS_MONTH' | 'THIS_YEAR' | 'ALL' | 'CUSTOM'>('THIS_MONTH');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [k, e, l] = await Promise.all([
        khataService.getTransactions(),
        expenseService.getExpenses(),
        loanService.getLoans(),
      ]);

      setKhataTxs(k.data);
      setExpenses(e.data);
      setLoans(l.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user]);

  // Date filtering logic
  const now = new Date();
  const currentYearStr = String(now.getFullYear());
  const currentMonthStr = `${currentYearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const isDateIncluded = (dateStr: string) => {
    if (dateRange === 'ALL') return true;
    if (dateRange === 'THIS_MONTH') return dateStr.startsWith(currentMonthStr);
    if (dateRange === 'THIS_YEAR') return dateStr.startsWith(currentYearStr);
    if (dateRange === 'CUSTOM') {
      if (customStart && dateStr < customStart) return false;
      if (customEnd && dateStr > customEnd) return false;
      return true;
    }
    return true;
  };

  const filteredKhata = useMemo(() => {
    return khataTxs.filter((t) => isDateIncluded(t.transaction_date));
  }, [khataTxs, dateRange, customStart, customEnd, currentMonthStr, currentYearStr]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => isDateIncluded(e.expense_date));
  }, [expenses, dateRange, customStart, customEnd, currentMonthStr, currentYearStr]);

  const filteredLoans = useMemo(() => {
    return loans.filter((l) => isDateIncluded(l.start_date));
  }, [loans, dateRange, customStart, customEnd, currentMonthStr, currentYearStr]);

  // Khata independent totals
  const { khataGiven, khataReceived, khataNet } = useMemo(() => {
    let g = 0;
    let r = 0;
    filteredKhata.forEach((t) => {
      if (t.type === 'GIVEN') g += Number(t.amount);
      if (t.type === 'RECEIVED') r += Number(t.amount);
    });
    return { khataGiven: g, khataReceived: r, khataNet: g - r };
  }, [filteredKhata]);

  // Expenses totals & category breakdown
  const { totalExpense, expenseCategoryData } = useMemo(() => {
    let sum = 0;
    const catMap: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const amt = Number(e.amount);
      sum += amt;
      catMap[e.category] = (catMap[e.category] || 0) + amt;
    });

    const categoryArray = Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    return { totalExpense: sum, expenseCategoryData: categoryArray };
  }, [filteredExpenses]);

  // Loans totals
  const { loansGiven, loansTaken, loansOutstanding } = useMemo(() => {
    let lg = 0;
    let lt = 0;
    let out = 0;
    filteredLoans.forEach((l) => {
      const orig = Number(l.original_amount);
      const rem = Number(l.remaining_amount ?? orig);
      if (l.loan_type === 'GIVEN') lg += orig;
      if (l.loan_type === 'TAKEN') lt += orig;
      out += rem;
    });
    return { loansGiven: lg, loansTaken: lt, loansOutstanding: out };
  }, [filteredLoans]);

  // Monthly Expenses Trend Chart Data
  const monthlyExpenseChartData = useMemo(() => {
    const monthsMap: Record<string, number> = {};
    expenses.forEach((e) => {
      const mKey = e.expense_date.substring(0, 7);
      monthsMap[mKey] = (monthsMap[mKey] || 0) + Number(e.amount);
    });
    return Object.entries(monthsMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, amount]) => ({
        month,
        amount,
      }));
  }, [expenses]);

  const formatCur = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cloud Storage States
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    stage: 'idle',
    percent: 0,
    message: '',
  });
  const [cloudSuccessMsg, setCloudSuccessMsg] = useState<string | null>(null);

  const handleExportPdf = () => {
    if (moduleFilter === 'KHATA') {
      pdfService.generateKhataReport(filteredKhata, profile);
    } else if (moduleFilter === 'EXPENSES') {
      pdfService.generateExpenseReport(filteredExpenses, profile, dateRange);
    } else if (moduleFilter === 'LOANS') {
      pdfService.generateLoanReport(filteredLoans, profile);
    } else {
      // Default: Export Expenses or Khata depending on volume
      if (filteredExpenses.length > 0) {
        pdfService.generateExpenseReport(filteredExpenses, profile, `Comprehensive Analytics (${dateRange})`);
      } else {
        pdfService.generateKhataReport(filteredKhata, profile);
      }
    }
  };

  const handleSaveToCloud = async () => {
    setSavingToCloud(true);
    setShowProgressModal(true);
    setCloudSuccessMsg(null);

    let doc;
    let fileName = '';
    let category = 'REPORT';
    const dateSlug = new Date().toISOString().split('T')[0];

    if (moduleFilter === 'KHATA') {
      doc = pdfService.buildKhataDoc(filteredKhata, profile);
      fileName = `NEXMONEY_Khata_Report_${dateSlug}.pdf`;
      category = 'KHATA';
    } else if (moduleFilter === 'EXPENSES') {
      doc = pdfService.buildExpenseDoc(filteredExpenses, profile, dateRange);
      fileName = `NEXMONEY_Expense_Statement_${dateSlug}.pdf`;
      category = 'EXPENSE';
    } else if (moduleFilter === 'LOANS') {
      doc = pdfService.buildLoanDoc(filteredLoans, profile);
      fileName = `NEXMONEY_Loan_Statement_${dateSlug}.pdf`;
      category = 'LOAN';
    } else {
      if (filteredExpenses.length > 0) {
        doc = pdfService.buildExpenseDoc(filteredExpenses, profile, `Comprehensive Analytics (${dateRange})`);
        fileName = `NEXMONEY_Financial_Statement_${dateSlug}.pdf`;
      } else {
        doc = pdfService.buildKhataDoc(filteredKhata, profile);
        fileName = `NEXMONEY_Khata_Report_${dateSlug}.pdf`;
      }
    }

    try {
      const res = await cloudStorageService.savePdfToCloud(doc, fileName, category, (p) => {
        setUploadProgress(p);
      });

      if (res.data) {
        setCloudSuccessMsg(`File "${fileName}" encrypted with AES-256-GCM and saved to private AWS S3!`);
        setTimeout(() => {
          setShowProgressModal(false);
          setUploadProgress({ stage: 'idle', percent: 0, message: '' });
        }, 1600);
      } else {
        alert(res.error || 'Cloud upload failed');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingToCloud(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Reports & Statement Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Auditable statements with isolated module metrics, encrypted AWS S3 archiving, and PDF export.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* SAVE TO CLOUD BUTTON */}
          <button
            id="save-to-cloud-btn"
            type="button"
            onClick={handleSaveToCloud}
            disabled={savingToCloud}
            className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {savingToCloud ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Cloud className="w-4 h-4 text-blue-500" />
            )}
            <span>Save to Cloud</span>
          </button>

          {/* EXPORT PDF BUTTON */}
          <button
            id="download-statement-btn"
            type="button"
            onClick={handleExportPdf}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Export Statement PDF</span>
          </button>
        </div>
      </div>

      {cloudSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{cloudSuccessMsg}</span>
          </div>
          <a
            href="/cloud-storage"
            className="font-bold underline hover:text-emerald-800 dark:hover:text-emerald-200"
          >
            View in Cloud Storage &rarr;
          </a>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
          {(['ALL', 'KHATA', 'EXPENSES', 'LOANS'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModuleFilter(m)}
              className={`px-3 py-1.5 rounded-lg transition ${
                moduleFilter === m
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {m === 'ALL' ? 'All Modules' : m === 'KHATA' ? 'Khata Ledger' : m === 'EXPENSES' ? 'Expenses' : 'Loans'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            {(['THIS_MONTH', 'THIS_YEAR', 'ALL', 'CUSTOM'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDateRange(d)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  dateRange === d
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {d === 'THIS_MONTH' ? 'Month' : d === 'THIS_YEAR' ? 'Year' : d === 'ALL' ? 'All Time' : 'Custom'}
              </button>
            ))}
          </div>

          {dateRange === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* THREE EXPLICIT ISOLATED MODULE SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Module 1: Khata */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Users2 className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Module 1: Khata Ledger</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Given</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(khataGiven)}</p>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Received</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{formatCur(khataReceived)}</p>
            </div>
          </div>
          <div className="pt-1 flex justify-between text-xs font-semibold">
            <span className="text-slate-500">Net Khata Position:</span>
            <span className={khataNet >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}>
              {formatCur(khataNet)}
            </span>
          </div>
        </div>

        {/* Module 2: Expenses */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Module 2: Personal Expenses</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <p className="text-[11px] text-slate-400">Total Filtered Spending</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{formatCur(totalExpense)}</p>
          </div>
          <div className="pt-1 flex justify-between text-xs font-semibold">
            <span className="text-slate-500">Recorded Entries:</span>
            <span className="text-slate-800 dark:text-slate-200">{filteredExpenses.length} transactions</span>
          </div>
        </div>

        {/* Module 3: Loans */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Module 3: Long-Term Loans</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Given</p>
              <p className="font-bold text-emerald-600 mt-0.5">{formatCur(loansGiven)}</p>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Taken</p>
              <p className="font-bold text-rose-600 mt-0.5">{formatCur(loansTaken)}</p>
            </div>
          </div>
          <div className="pt-1 flex justify-between text-xs font-semibold">
            <span className="text-slate-500">Total Outstanding Balance:</span>
            <span className="text-slate-800 dark:text-slate-200">{formatCur(loansOutstanding)}</span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Expense Distribution */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Expenses by Category (Filtered)
            </h3>
          </div>

          {expenseCategoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No expense entries recorded for this time period.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => entry.name}
                  >
                    {expenseCategoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCur(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Expense Trend */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Monthly Spending Trends (Last 6 Months)
            </h3>
          </div>

          {monthlyExpenseChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No historical spending data available yet.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyExpenseChartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip formatter={(value) => formatCur(Number(value))} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD TO CLOUD PROGRESS MODAL */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              {uploadProgress.stage === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : uploadProgress.stage === 'error' ? (
                <AlertCircle className="w-6 h-6 text-rose-500" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {uploadProgress.stage === 'completed'
                  ? 'Saved to Cloud S3 Successfully'
                  : uploadProgress.stage === 'error'
                  ? 'Cloud Upload Error'
                  : 'Saving Statement to Cloud S3'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {uploadProgress.message}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 transition-all duration-300 rounded-full ${
                  uploadProgress.stage === 'error'
                    ? 'bg-rose-500'
                    : uploadProgress.stage === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>

            {/* Stepper items */}
            <div className="space-y-1.5 text-left text-xs font-medium">
              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 15 ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'text-slate-400'}`}>
                <span>1. Generating Statement PDF</span>
                {uploadProgress.percent >= 15 && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 35 ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'text-slate-400'}`}>
                <span>2. Dividing into 1MB Blocks</span>
                {uploadProgress.percent >= 35 && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 55 ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'text-slate-400'}`}>
                <span>3. AES-256-GCM Encryption</span>
                {uploadProgress.percent >= 55 && <Check className="w-3.5 h-3.5 text-amber-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 75 ? 'text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20' : 'text-slate-400'}`}>
                <span>4. Uploading to Private AWS S3</span>
                {uploadProgress.percent >= 75 && <Check className="w-3.5 h-3.5 text-sky-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 90 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'text-slate-400'}`}>
                <span>5. Checksum & Metadata Verification</span>
                {uploadProgress.percent >= 90 && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
            </div>

            {uploadProgress.stage === 'error' && (
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
