import React, { useEffect, useState, useMemo } from 'react';
import {
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  Loader2,
  Calendar,
  Percent,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../services/loanService';
import { LongTermLoan, LoanRepayment, LoanType } from '../types';
import { TransactionPinModal } from '../components/TransactionPinModal';
import { pdfService } from '../services/pdfService';

export const LoansPage: React.FC = () => {
  const { user, profile, pinStatus } = useAuth();

  const [loans, setLoans] = useState<LongTermLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GIVEN' | 'TAKEN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  // Expanded loan ID for viewing repayment history
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [repaymentsMap, setRepaymentsMap] = useState<Record<string, LoanRepayment[]>>({});
  const [repaymentsLoading, setRepaymentsLoading] = useState<Record<string, boolean>>({});

  // Loan Add/Edit Modal
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LongTermLoan | null>(null);
  const [loanForm, setLoanForm] = useState({
    person_name: '',
    loan_type: 'GIVEN' as LoanType,
    original_amount: '',
    interest_rate: '0',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  // Repayment Modal
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [repayLoan, setRepayLoan] = useState<LongTermLoan | null>(null);
  const [repayForm, setRepayForm] = useState({
    repayment_amount: '',
    repayment_date: new Date().toISOString().split('T')[0],
    payment_method: 'UPI',
    utr_number: '',
    notes: '',
  });

  // PIN Verification Modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pinActionTitle, setPinActionTitle] = useState('Authorize Loan Operation');

  const loadLoans = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loanService.getLoans();
      if (res.error) setError(res.error);
      setLoans(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
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

  // Toggle Repayments expansion and fetch repayments if not loaded yet
  const toggleRepayments = async (loanId: string) => {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null);
      return;
    }
    setExpandedLoanId(loanId);
    if (!repaymentsMap[loanId]) {
      setRepaymentsLoading((prev) => ({ ...prev, [loanId]: true }));
      const res = await loanService.getRepayments(loanId);
      setRepaymentsMap((prev) => ({ ...prev, [loanId]: res.data }));
      setRepaymentsLoading((prev) => ({ ...prev, [loanId]: false }));
    }
  };

  // Open Loan Modal
  const openAddLoanModal = () => {
    setEditingLoan(null);
    setLoanForm({
      person_name: '',
      loan_type: 'GIVEN',
      original_amount: '',
      interest_rate: '0',
      start_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
    });
    setIsLoanModalOpen(true);
  };

  const openEditLoanModal = (l: LongTermLoan) => {
    setEditingLoan(l);
    setLoanForm({
      person_name: l.person_name,
      loan_type: l.loan_type,
      original_amount: String(l.original_amount),
      interest_rate: String(l.interest_rate || 0),
      start_date: l.start_date,
      due_date: l.due_date || '',
      notes: l.notes || '',
    });
    setIsLoanModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.person_name.trim() || !loanForm.original_amount || Number(loanForm.original_amount) <= 0) {
      alert('Please fill all required fields');
      return;
    }

    requestProtectedAction(async () => {
      try {
        if (editingLoan) {
          const res = await loanService.updateLoan(editingLoan.id, {
            person_name: loanForm.person_name,
            loan_type: loanForm.loan_type,
            original_amount: Number(loanForm.original_amount),
            interest_rate: Number(loanForm.interest_rate) || 0,
            start_date: loanForm.start_date,
            due_date: loanForm.due_date || undefined,
            notes: loanForm.notes.trim() || undefined,
          });
          if (!res.success) throw new Error(res.error || 'Failed to update loan');
        } else {
          const res = await loanService.addLoan({
            person_name: loanForm.person_name,
            loan_type: loanForm.loan_type,
            original_amount: Number(loanForm.original_amount),
            interest_rate: Number(loanForm.interest_rate) || 0,
            start_date: loanForm.start_date,
            due_date: loanForm.due_date || undefined,
            notes: loanForm.notes.trim() || undefined,
          });
          if (res.error) throw new Error(res.error);
        }
        setIsLoanModalOpen(false);
        await loadLoans();
      } catch (err) {
        alert((err as Error).message);
      }
    }, editingLoan ? 'Update Loan Contract' : 'Create Loan Contract');
  };

  const handleDeleteLoan = (loan: LongTermLoan) => {
    if (!confirm(`Are you sure you want to delete this loan for ${loan.person_name}? All repayments will also be deleted.`)) return;

    requestProtectedAction(async () => {
      const res = await loanService.deleteLoan(loan.id);
      if (!res.success) {
        alert(res.error || 'Failed to delete');
      } else {
        await loadLoans();
      }
    }, 'Delete Loan Contract');
  };

  // Open Repayment Modal
  const openRepayModal = (l: LongTermLoan) => {
    setRepayLoan(l);
    setRepayForm({
      repayment_amount: '',
      repayment_date: new Date().toISOString().split('T')[0],
      payment_method: 'UPI',
      utr_number: '',
      notes: '',
    });
    setIsRepayModalOpen(true);
  };

  const handleSaveRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    const amountNum = Number(repayForm.repayment_amount);
    if (!amountNum || amountNum <= 0) {
      alert('Enter a valid repayment amount');
      return;
    }

    const currentRemaining = Number(repayLoan.remaining_amount ?? repayLoan.original_amount);
    if (amountNum > currentRemaining) {
      if (!confirm(`The repayment amount (${amountNum}) exceeds the remaining balance (${currentRemaining}). Proceed anyway?`)) {
        return;
      }
    }

    requestProtectedAction(async () => {
      try {
        const res = await loanService.addRepayment({
          loan_id: repayLoan.id,
          amount: amountNum,
          repayment_date: repayForm.repayment_date,
          payment_method: repayForm.payment_method,
          utr_number: repayForm.utr_number.trim() || undefined,
          notes: repayForm.notes.trim() || undefined,
        });

        if (res.error) throw new Error(res.error);

        setIsRepayModalOpen(false);
        // Refresh repayments for this loan
        const repRes = await loanService.getRepayments(repayLoan.id);
        setRepaymentsMap((prev) => ({ ...prev, [repayLoan.id]: repRes.data }));
        await loadLoans();
      } catch (err) {
        alert((err as Error).message);
      }
    }, `Record Repayment for ${repayLoan.person_name}`);
  };

  const handleDeleteRepayment = (rep: LoanRepayment) => {
    if (!confirm('Are you sure you want to delete this repayment record? The loan balance will be recalculated.')) return;

    requestProtectedAction(async () => {
      const res = await loanService.deleteRepayment(rep.id, rep.loan_id);
      if (!res.success) {
        alert(res.error || 'Failed to delete repayment');
      } else {
        const repRes = await loanService.getRepayments(rep.loan_id);
        setRepaymentsMap((prev) => ({ ...prev, [rep.loan_id]: repRes.data }));
        await loadLoans();
      }
    }, 'Delete Repayment');
  };

  // METRICS
  const { totalGiven, outstandingGiven, totalTaken, outstandingTaken, activeCount, closedCount } = useMemo(() => {
    let tg = 0;
    let og = 0;
    let tt = 0;
    let ot = 0;
    let act = 0;
    let cls = 0;

    loans.forEach((l) => {
      const orig = Number(l.original_amount);
      const rem = Number(l.remaining_amount ?? orig);

      if (l.status === 'ACTIVE') act++;
      if (l.status === 'CLOSED') cls++;

      if (l.loan_type === 'GIVEN') {
        tg += orig;
        og += rem;
      } else {
        tt += orig;
        ot += rem;
      }
    });

    return {
      totalGiven: tg,
      outstandingGiven: og,
      totalTaken: tt,
      outstandingTaken: ot,
      activeCount: act,
      closedCount: cls,
    };
  }, [loans]);

  // FILTERED LOANS
  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const matchSearch =
        l.person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = typeFilter === 'ALL' || l.loan_type === typeFilter;
      const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [loans, searchTerm, typeFilter, statusFilter]);

  const formatCur = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExportPdf = () => {
    pdfService.generateLoanReport(filteredLoans, profile);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Long-Term Loans
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Structured loans given and taken with atomic repayment tracking and automatic loan closure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-loans-pdf-btn"
            type="button"
            onClick={handleExportPdf}
            disabled={filteredLoans.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Statement</span>
          </button>
          <button
            id="add-loan-btn"
            type="button"
            onClick={openAddLoanModal}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Loan Contract</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> Given Outstanding
          </p>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCur(outstandingGiven)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Total lent: {formatCur(totalGiven)}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" /> Taken Outstanding
          </p>
          <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatCur(outstandingTaken)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Total borrowed: {formatCur(totalTaken)}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> Active Loans
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {activeCount}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Currently ongoing</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Closed Loans
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {closedCount}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">100% Repaid</span>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search borrower/lender name or notes..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'GIVEN' | 'TAKEN')}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="GIVEN">Given as Loan</option>
            <option value="TAKEN">Taken as Loan</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'CLOSED')}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed (Paid Off)</option>
          </select>
        </div>
      </div>

      {/* LOANS LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
            <span className="text-xs text-slate-500">Loading loan records...</span>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
            <Landmark className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No long-term loans</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              Track structured loans with interest rates, due dates, and progressive repayments.
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={openAddLoanModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md"
              >
                + Create First Loan
              </button>
            </div>
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const isExpanded = expandedLoanId === loan.id;
            const repayments = repaymentsMap[loan.id] || [];
            const isRepLoading = repaymentsLoading[loan.id];
            const original = Number(loan.original_amount);
            const remaining = Number(loan.remaining_amount ?? original);
            const totalRepaid = Number(loan.total_repaid ?? original - remaining);
            const progress = Number(loan.progress_pct ?? Math.min(100, Math.round((totalRepaid / original) * 100)));

            return (
              <div
                key={loan.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition"
              >
                {/* Main Loan Card Banner */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          loan.loan_type === 'GIVEN'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {loan.loan_type === 'GIVEN' ? 'LOAN GIVEN' : 'LOAN TAKEN'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          loan.status === 'CLOSED'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {loan.status}
                      </span>
                      {Number(loan.interest_rate) > 0 && (
                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-0.5">
                          <Percent className="w-3 h-3" /> {loan.interest_rate}% p.a.
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {loan.person_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Started {loan.start_date} {loan.due_date ? `• Due by ${loan.due_date}` : ''}
                      {loan.notes ? ` • ${loan.notes}` : ''}
                    </p>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-3 gap-4 border-y lg:border-y-0 lg:border-x border-slate-100 dark:border-slate-800 py-3 lg:py-0 lg:px-6">
                    <div>
                      <p className="text-[11px] text-slate-400">Original Amount</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {formatCur(original)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Total Repaid</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatCur(totalRepaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Remaining Balance</p>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                        {formatCur(remaining)}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Progress */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 min-w-[200px]">
                    <div className="w-full space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>Repayment Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            loan.status === 'CLOSED' ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end pt-1">
                      {loan.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => openRepayModal(loan)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Repay</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRepayments(loan.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1"
                        title="View repayments history"
                      >
                        <History className="w-3.5 h-3.5" />
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditLoanModal(loan)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit loan contract"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLoan(loan)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Delete loan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPANDED REPAYMENTS LEDGER */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <History className="w-4 h-4 text-emerald-500" />
                        <span>Repayment History for {loan.person_name}</span>
                      </h4>
                      {loan.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => openRepayModal(loan)}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          + Record Another Repayment
                        </button>
                      )}
                    </div>

                    {isRepLoading ? (
                      <div className="py-4 text-center text-xs text-slate-400">Loading repayment log...</div>
                    ) : repayments.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No repayments recorded yet against this loan contract.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-2">Date</th>
                              <th className="pb-2 text-right">Repaid Amount</th>
                              <th className="pb-2">Method</th>
                              <th className="pb-2">UTR Number</th>
                              <th className="pb-2">Notes</th>
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs">
                            {repayments.map((rep) => (
                              <tr key={rep.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/60">
                                <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                                  {rep.repayment_date}
                                </td>
                                <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCur(Number(rep.repayment_amount))}
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {rep.payment_method}
                                </td>
                                <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                                  {rep.utr_number || '-'}
                                </td>
                                <td className="py-2.5 text-slate-500 truncate max-w-xs">
                                  {rep.notes || '-'}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRepayment(rep)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                                    title="Delete this repayment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* LOAN ADD/EDIT MODAL */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingLoan ? 'Edit Loan Contract' : 'Create New Long-Term Loan'}
            </h3>
            <form onSubmit={handleSaveLoan} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact / Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={loanForm.person_name}
                  onChange={(e) => setLoanForm({ ...loanForm, person_name: e.target.value })}
                  placeholder="e.g. Vikram Sharma"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Loan Direction *
                  </label>
                  <select
                    value={loanForm.loan_type}
                    onChange={(e) => setLoanForm({ ...loanForm, loan_type: e.target.value as LoanType })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="GIVEN">Given (You Lent)</option>
                    <option value="TAKEN">Taken (You Borrowed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Principal Amount (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={loanForm.original_amount}
                    onChange={(e) => setLoanForm({ ...loanForm, original_amount: e.target.value })}
                    placeholder="100000"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest % (p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={loanForm.interest_rate}
                    onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={loanForm.start_date}
                    onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={loanForm.due_date}
                    onChange={(e) => setLoanForm({ ...loanForm, due_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Terms / Notes
                </label>
                <textarea
                  rows={2}
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  placeholder="e.g. Monthly installment agreement, car loan..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="save-loan-contract-btn"
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  Save Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPAYMENT MODAL */}
      {isRepayModalOpen && repayLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Record Loan Repayment
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Repayment for {repayLoan.person_name} • Current Remaining: {formatCur(Number(repayLoan.remaining_amount ?? repayLoan.original_amount))}
            </p>

            <form onSubmit={handleSaveRepayment} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Repayment Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={repayForm.repayment_amount}
                    onChange={(e) => setRepayForm({ ...repayForm, repayment_amount: e.target.value })}
                    placeholder="25000"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Repayment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={repayForm.repayment_date}
                    onChange={(e) => setRepayForm({ ...repayForm, repayment_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={repayForm.payment_method}
                    onChange={(e) => setRepayForm({ ...repayForm, payment_method: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    UTR / Reference
                  </label>
                  <input
                    type="text"
                    value={repayForm.utr_number}
                    onChange={(e) => setRepayForm({ ...repayForm, utr_number: e.target.value })}
                    placeholder="Optional UTR"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={repayForm.notes}
                  onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })}
                  placeholder="e.g. 1st installment paid via GPay"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="confirm-repayment-btn"
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  Record Repayment
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
