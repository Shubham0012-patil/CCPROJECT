import React, { useEffect, useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  Loader2,
  PieChart as PieChartIcon,
  Calendar,
  Clock,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { expenseService, EXPENSE_CATEGORIES } from '../services/expenseService';
import { Expense } from '../types';
import { TransactionPinModal } from '../components/TransactionPinModal';
import { pdfService } from '../services/pdfService';

export const ExpensesPage: React.FC = () => {
  const { user, profile, pinStatus } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [datePeriod, setDatePeriod] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR'>('THIS_MONTH');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    category: EXPENSE_CATEGORIES[0] as string,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'UPI',
    utr_number: '',
    notes: '',
  });

  // PIN verification
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pinActionTitle, setPinActionTitle] = useState('Authorize Expense Modification');

  const loadExpenses = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await expenseService.getExpenses();
      if (res.error) setError(res.error);
      setExpenses(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [user]);

  const requestProtectedAction = (action: () => Promise<void>, title: string) => {
    if (pinStatus.hasAppPin) {
      setPinActionTitle(title);
      setPendingAction(() => action);
      setPinModalOpen(true);
    } else {
      action();
    }
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setFormData({
      amount: '',
      category: EXPENSE_CATEGORIES[0],
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'UPI',
      utr_number: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (e: Expense) => {
    setEditingExpense(e);
    setFormData({
      amount: String(e.amount),
      category: e.category,
      expense_date: e.expense_date,
      payment_method: e.payment_method,
      utr_number: e.utr_number || '',
      notes: e.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert('Please provide a valid amount');
      return;
    }

    requestProtectedAction(async () => {
      try {
        if (editingExpense) {
          const res = await expenseService.updateExpense(editingExpense.id, {
            amount: Number(formData.amount),
            category: formData.category,
            expense_date: formData.expense_date,
            payment_method: formData.payment_method,
            utr_number: formData.utr_number.trim() || undefined,
            notes: formData.notes.trim() || undefined,
            old_utr_number: editingExpense.utr_number,
          });
          if (!res.success) throw new Error(res.error || 'Failed to update expense');
        } else {
          const res = await expenseService.addExpense({
            amount: Number(formData.amount),
            category: formData.category,
            expense_date: formData.expense_date,
            payment_method: formData.payment_method,
            utr_number: formData.utr_number.trim() || undefined,
            notes: formData.notes.trim() || undefined,
          });
          if (res.error) throw new Error(res.error);
        }
        setIsModalOpen(false);
        await loadExpenses();
      } catch (err) {
        alert((err as Error).message);
      }
    }, editingExpense ? 'Update Expense' : 'Add Expense');
  };

  const handleDeleteExpense = (exp: Expense) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;

    requestProtectedAction(async () => {
      const res = await expenseService.deleteExpense(exp.id);
      if (!res.success) {
        alert(res.error || 'Failed to delete');
      } else {
        await loadExpenses();
      }
    }, 'Delete Expense Record');
  };

  // Metrics computation across all expenses
  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);
  const yearStr = todayStr.substring(0, 4);

  const { todayTotal, monthTotal, yearTotal } = useMemo(() => {
    let t = 0;
    let m = 0;
    let y = 0;

    expenses.forEach((e) => {
      const amt = Number(e.amount);
      if (e.expense_date === todayStr) t += amt;
      if (e.expense_date.startsWith(monthStr)) m += amt;
      if (e.expense_date.startsWith(yearStr)) y += amt;
    });

    return { todayTotal: t, monthTotal: m, yearTotal: y };
  }, [expenses, todayStr, monthStr, yearStr]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch =
        e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.utr_number || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = selectedCategory === 'ALL' || e.category === selectedCategory;

      let matchPeriod = true;
      if (datePeriod === 'TODAY') matchPeriod = e.expense_date === todayStr;
      if (datePeriod === 'THIS_MONTH') matchPeriod = e.expense_date.startsWith(monthStr);
      if (datePeriod === 'THIS_YEAR') matchPeriod = e.expense_date.startsWith(yearStr);

      return matchSearch && matchCat && matchPeriod;
    });
  }, [expenses, searchTerm, selectedCategory, datePeriod, todayStr, monthStr, yearStr]);

  // Category breakdown for filtered list
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    filteredExpenses.forEach((e) => {
      const amt = Number(e.amount);
      map[e.category] = (map[e.category] || 0) + amt;
      total += amt;
    });

    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const filteredSum = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredExpenses]);

  const formatCur = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExportPdf = () => {
    const label =
      datePeriod === 'TODAY'
        ? `Today (${todayStr})`
        : datePeriod === 'THIS_MONTH'
        ? `This Month (${monthStr})`
        : datePeriod === 'THIS_YEAR'
        ? `This Year (${yearStr})`
        : 'All Time';
    pdfService.generateExpenseReport(filteredExpenses, profile, label);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Personal Expenses
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Categorized daily spending tracking. Isolated from Khata loans and credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-expense-pdf-btn"
            type="button"
            onClick={handleExportPdf}
            disabled={filteredExpenses.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Statement</span>
          </button>
          <button
            id="add-expense-btn"
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> Today
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCur(todayTotal)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Today&apos;s expenses</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" /> This Month
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatCur(monthTotal)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Month to date</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-indigo-500" /> This Year
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCur(yearTotal)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Year to date</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <PieChartIcon className="w-3.5 h-3.5 text-emerald-500" /> Filtered Total
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCur(filteredSum)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">{filteredExpenses.length} entries</span>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search category, notes, or UTR..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Period buttons */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            {(['TODAY', 'THIS_MONTH', 'THIS_YEAR', 'ALL'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDatePeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  datePeriod === p
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {p === 'TODAY' ? 'Today' : p === 'THIS_MONTH' ? 'Month' : p === 'THIS_YEAR' ? 'Year' : 'All'}
              </button>
            ))}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN VISUAL CHIPS */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <PieChartIcon className="w-4 h-4 text-amber-500" />
            <span>Category Spending Breakdown</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {categoryBreakdown.map((item) => (
              <div key={item.category} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[90px]" title={item.category}>
                    {item.category}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{item.percentage}%</span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{formatCur(item.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPENSES LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading expenses...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No expenses recorded</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              Track where your money goes. Add your groceries, bills, or dining expenses.
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-md"
              >
                + Add First Expense
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">UTR / Ref</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {formatCur(Number(exp.amount))}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {exp.expense_date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {exp.payment_method}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {exp.utr_number || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {exp.notes || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Edit expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Delete expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingExpense ? 'Edit Expense Record' : 'Record Personal Expense'}
            </h3>
            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="1500"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method *
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="CASH">Cash</option>
                  <option value="NET_BANKING">Net Banking</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  UTR / Reference Number (Enforced Unique per User)
                </label>
                <input
                  type="text"
                  value={formData.utr_number}
                  onChange={(e) => setFormData({ ...formData, utr_number: e.target.value })}
                  placeholder="Optional UTR"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Dinner with team"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="save-expense-btn"
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION PIN MODAL */}
      <TransactionPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={async () => {
          if (pendingAction) await pendingAction();
        }}
        actionTitle={pinActionTitle}
      />
    </div>
  );
};
