import React, { useEffect, useState, useMemo } from 'react';
import {
  Users2,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Phone,
  UserPlus,
  FileText,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { khataService } from '../services/khataService';
import { KhataPerson, KhataTransaction, KhataType, KhataStatus } from '../types';
import { TransactionPinModal } from '../components/TransactionPinModal';
import { pdfService } from '../services/pdfService';

export const KhataPage: React.FC = () => {
  const { user, profile, pinStatus } = useAuth();

  const [people, setPeople] = useState<KhataPerson[]>([]);
  const [transactions, setTransactions] = useState<KhataTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GIVEN' | 'RECEIVED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('ALL');

  // Modals
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<KhataPerson | null>(null);
  const [personForm, setPersonForm] = useState({ name: '', phone: '', notes: '' });

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<KhataTransaction | null>(null);
  const [txForm, setTxForm] = useState<{
    person_id: string;
    type: KhataType;
    amount: string;
    transaction_date: string;
    payment_method: string;
    utr_number: string;
    notes: string;
    status: KhataStatus;
  }>({
    person_id: '',
    type: 'GIVEN',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'UPI',
    utr_number: '',
    notes: '',
    status: 'PENDING',
  });

  // PIN verification modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [pinActionTitle, setPinActionTitle] = useState('Authorize Financial Change');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [peopleRes, txRes] = await Promise.all([
        khataService.getPeople(),
        khataService.getTransactions(),
      ]);

      if (peopleRes.error) setError(peopleRes.error);
      if (txRes.error) setError(txRes.error);

      setPeople(peopleRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Request action with PIN protection if Transaction PIN is configured
  const requestProtectedAction = (action: () => Promise<void>, title: string) => {
    if (pinStatus.hasAppPin) {
      setPinActionTitle(title);
      setPendingAction(() => action);
      setPinModalOpen(true);
    } else {
      // Execute directly
      action();
    }
  };

  // PERSON HANDLERS
  const openAddPersonModal = () => {
    setEditingPerson(null);
    setPersonForm({ name: '', phone: '', notes: '' });
    setIsPersonModalOpen(true);
  };

  const openEditPersonModal = (p: KhataPerson) => {
    setEditingPerson(p);
    setPersonForm({ name: p.name, phone: p.phone || '', notes: p.notes || '' });
    setIsPersonModalOpen(true);
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personForm.name.trim()) return;

    requestProtectedAction(async () => {
      try {
        if (editingPerson) {
          const res = await khataService.updatePerson(editingPerson.id, personForm.name, personForm.phone, personForm.notes);
          if (!res.success) throw new Error(res.error || 'Failed to update contact');
        } else {
          const res = await khataService.addPerson(personForm.name, personForm.phone, personForm.notes);
          if (res.error) throw new Error(res.error);
        }
        setIsPersonModalOpen(false);
        await loadData();
      } catch (err) {
        alert((err as Error).message);
      }
    }, editingPerson ? 'Update Khata Contact' : 'Add Khata Contact');
  };

  const handleDeletePerson = (p: KhataPerson) => {
    if (!confirm(`Are you sure you want to delete ${p.name}? All their transactions will also be permanently deleted.`)) return;

    requestProtectedAction(async () => {
      const res = await khataService.deletePerson(p.id);
      if (!res.success) {
        alert(res.error || 'Failed to delete contact');
      } else {
        await loadData();
      }
    }, `Delete ${p.name}`);
  };

  // TRANSACTION HANDLERS
  const openAddTxModal = (presetPersonId?: string) => {
    setEditingTx(null);
    setTxForm({
      person_id: presetPersonId || (people[0]?.id || ''),
      type: 'GIVEN',
      amount: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: 'UPI',
      utr_number: '',
      notes: '',
      status: 'PENDING',
    });
    setIsTxModalOpen(true);
  };

  const openEditTxModal = (tx: KhataTransaction) => {
    setEditingTx(tx);
    setTxForm({
      person_id: tx.person_id,
      type: tx.type,
      amount: String(tx.amount),
      transaction_date: tx.transaction_date,
      payment_method: tx.payment_method,
      utr_number: tx.utr_number || '',
      notes: tx.notes || '',
      status: tx.status,
    });
    setIsTxModalOpen(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.person_id || !txForm.amount || Number(txForm.amount) <= 0) {
      alert('Please fill all required fields with valid amounts.');
      return;
    }

    requestProtectedAction(async () => {
      try {
        if (editingTx) {
          const res = await khataService.updateTransaction(editingTx.id, {
            person_id: txForm.person_id,
            type: txForm.type,
            amount: Number(txForm.amount),
            transaction_date: txForm.transaction_date,
            payment_method: txForm.payment_method,
            utr_number: txForm.utr_number.trim() || undefined,
            notes: txForm.notes.trim() || undefined,
            status: txForm.status,
            old_utr_number: editingTx.utr_number,
          });
          if (!res.success) throw new Error(res.error || 'Failed to update transaction');
        } else {
          const res = await khataService.addTransaction({
            person_id: txForm.person_id,
            type: txForm.type,
            amount: Number(txForm.amount),
            transaction_date: txForm.transaction_date,
            payment_method: txForm.payment_method,
            utr_number: txForm.utr_number.trim() || undefined,
            notes: txForm.notes.trim() || undefined,
            status: txForm.status,
          });
          if (res.error) throw new Error(res.error);
        }
        setIsTxModalOpen(false);
        await loadData();
      } catch (err) {
        alert((err as Error).message);
      }
    }, editingTx ? 'Update Transaction' : 'Record Transaction');
  };

  const handleDeleteTx = (tx: KhataTransaction) => {
    if (!confirm('Are you sure you want to delete this Khata transaction?')) return;

    requestProtectedAction(async () => {
      const res = await khataService.deleteTransaction(tx.id);
      if (!res.success) {
        alert(res.error || 'Failed to delete transaction');
      } else {
        await loadData();
      }
    }, 'Delete Khata Transaction');
  };

  const handleToggleCompleted = (tx: KhataTransaction) => {
    const newCompleted = tx.status !== 'COMPLETED';
    requestProtectedAction(async () => {
      const res = await khataService.markCompleted(tx.id, newCompleted);
      if (!res.success) {
        alert(res.error || 'Failed to update status');
      } else {
        await loadData();
      }
    }, `Mark as ${newCompleted ? 'Completed' : 'Pending'}`);
  };

  // FILTERED TRANSACTIONS
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch =
        (tx.person?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.utr_number || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = typeFilter === 'ALL' || tx.type === typeFilter;
      const matchStatus = statusFilter === 'ALL' || tx.status === statusFilter;
      const matchPerson = selectedPersonId === 'ALL' || tx.person_id === selectedPersonId;

      return matchSearch && matchType && matchStatus && matchPerson;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, selectedPersonId]);

  // KHATA SUMMARY CALCULATION
  const { totalGiven, totalReceived, pendingCount, netBalance } = useMemo(() => {
    let given = 0;
    let received = 0;
    let pending = 0;

    filteredTxs.forEach((t) => {
      if (t.type === 'GIVEN') given += Number(t.amount);
      if (t.type === 'RECEIVED') received += Number(t.amount);
      if (t.status === 'PENDING') pending++;
    });

    return {
      totalGiven: given,
      totalReceived: received,
      pendingCount: pending,
      netBalance: given - received,
    };
  }, [filteredTxs]);

  const formatCur = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExportPdf = () => {
    const selectedPerson = people.find((p) => p.id === selectedPersonId);
    pdfService.generateKhataReport(filteredTxs, profile, selectedPerson?.name);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Khata Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track money given and received with contacts. Completely isolated from personal expenses & loans.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="export-khata-pdf-btn"
            type="button"
            onClick={handleExportPdf}
            disabled={filteredTxs.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            id="add-person-btn"
            type="button"
            onClick={openAddPersonModal}
            className="px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
          <button
            id="add-khata-tx-btn"
            type="button"
            onClick={() => openAddTxModal()}
            disabled={people.length === 0}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Transaction</span>
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
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Net Balance</p>
          <p className={`text-xl sm:text-2xl font-black mt-1 ${netBalance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCur(netBalance)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {netBalance >= 0 ? 'You are owed' : 'You owe overall'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Total Given
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCur(totalGiven)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Money lent/given</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" /> Total Received
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCur(totalReceived)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Money collected</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending Settlements
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {pendingCount}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Unsettled transactions</span>
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
            placeholder="Search by contact name, notes, or UTR number..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Contacts ({people.length})</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'GIVEN' | 'RECEIVED')}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="GIVEN">Given</option>
            <option value="RECEIVED">Received</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'COMPLETED')}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* CONTACTS QUICK STRIP */}
      {people.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedPersonId('ALL')}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              selectedPersonId === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            All Ledgers
          </button>
          {people.map((p) => {
            const isSelected = selectedPersonId === p.id;
            return (
              <div
                key={p.id}
                className={`group shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPersonId(p.id)}
                  className="focus:outline-none flex items-center gap-1"
                >
                  <span>{p.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditPersonModal(p)}
                  className="opacity-60 hover:opacity-100 p-0.5"
                  title="Edit contact"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePerson(p)}
                  className="opacity-60 hover:opacity-100 p-0.5 text-rose-300 hover:text-rose-500"
                  title="Delete contact"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TRANSACTIONS TABLE / LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading Khata transactions...</span>
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Khata records yet</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {people.length === 0
                ? 'Create your first contact person to start logging money given and received.'
                : 'No transactions match your current filters. Click "New Transaction" to add one.'}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {people.length === 0 ? (
                <button
                  type="button"
                  onClick={openAddPersonModal}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                >
                  + Add First Contact
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAddTxModal()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
                >
                  + Record Transaction
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method & UTR</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div>{tx.person?.name || 'Unknown'}</div>
                      {tx.notes && <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">{tx.notes}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          tx.type === 'GIVEN'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {tx.type === 'GIVEN' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCur(Number(tx.amount))}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {tx.transaction_date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div>{tx.payment_method}</div>
                      {tx.utr_number && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                          UTR: {tx.utr_number}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleCompleted(tx)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                        title="Click to toggle status"
                      >
                        {tx.status === 'COMPLETED' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> Pending
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTxModal(tx)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Edit transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTx(tx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Delete transaction"
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

      {/* CONTACT MODAL */}
      {isPersonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingPerson ? 'Edit Contact Person' : 'Add New Contact Person'}
            </h3>
            <form onSubmit={handleSavePerson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={personForm.name}
                  onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={personForm.phone}
                  onChange={(e) => setPersonForm({ ...personForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={personForm.notes}
                  onChange={(e) => setPersonForm({ ...personForm, notes: e.target.value })}
                  placeholder="e.g. Colleague, roommate..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPersonModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION MODAL */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingTx ? 'Edit Khata Transaction' : 'Record New Khata Transaction'}
            </h3>
            <form onSubmit={handleSaveTx} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Person *
                </label>
                <select
                  required
                  value={txForm.person_id}
                  onChange={(e) => setTxForm({ ...txForm, person_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Type *
                  </label>
                  <select
                    value={txForm.type}
                    onChange={(e) => setTxForm({ ...txForm, type: e.target.value as KhataType })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="GIVEN">Given (You Gave)</option>
                    <option value="RECEIVED">Received (You Got)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    placeholder="5000"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={txForm.transaction_date}
                    onChange={(e) => setTxForm({ ...txForm, transaction_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={txForm.payment_method}
                    onChange={(e) => setTxForm({ ...txForm, payment_method: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer (IMPS/NEFT)</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  UTR / Reference Number (Enforced Unique per User)
                </label>
                <input
                  type="text"
                  value={txForm.utr_number}
                  onChange={(e) => setTxForm({ ...txForm, utr_number: e.target.value })}
                  placeholder="e.g. 423589218942"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={txForm.status}
                    onChange={(e) => setTxForm({ ...txForm, status: e.target.value as KhataStatus })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={txForm.notes}
                    onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                    placeholder="Optional details"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="save-khata-tx-btn"
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Save Record
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
          if (pendingAction) {
            await pendingAction();
          }
        }}
        actionTitle={pinActionTitle}
      />
    </div>
  );
};
