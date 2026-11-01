export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppPins {
  user_id: string;
  login_pin_hash?: string | null;
  login_pin_length?: number | null;
  pin_hash?: string | null;
  pin_length?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PinStatus {
  hasLoginPin: boolean;
  hasAppPin: boolean;
  loginPinLength?: number;
  appPinLength?: number;
}

export interface KhataPerson {
  id: string;
  user_id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type KhataType = 'GIVEN' | 'RECEIVED';
export type KhataStatus = 'PENDING' | 'COMPLETED';

export interface KhataTransaction {
  id: string;
  user_id: string;
  person_id: string;
  type: KhataType;
  amount: number;
  transaction_date: string;
  payment_method: string;
  utr_number?: string | null;
  notes?: string | null;
  status: KhataStatus;
  created_at: string;
  updated_at: string;
  person?: KhataPerson;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  expense_date: string;
  payment_method: string;
  utr_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'ACTIVE' | 'CLOSED';

export interface LongTermLoan {
  id: string;
  user_id: string;
  person_name: string;
  loan_type: LoanType;
  original_amount: number;
  interest_rate?: number | null;
  start_date: string;
  due_date?: string | null;
  expected_return_date?: string | null;
  payment_method: string;
  utr_number?: string | null;
  notes?: string | null;
  status: LoanStatus;
  closed_date?: string | null;
  created_at: string;
  updated_at: string;
  repayments?: LoanRepayment[];
  total_repaid?: number;
  remaining_amount?: number;
  progress_pct?: number;
}

export interface LoanRepayment {
  id: string;
  user_id: string;
  loan_id: string;
  amount: number;
  repayment_date: string;
  payment_method: string;
  utr_number?: string | null;
  notes?: string | null;
  created_at: string;
}

export type UtrSourceModule = 'KHATA' | 'EXPENSE' | 'LOAN' | 'REPAYMENT';

export interface GlobalUtrRecord {
  id: string;
  user_id: string;
  utr_number: string;
  source_module: UtrSourceModule;
  reference_id?: string | null;
  amount: number;
  transaction_date: string;
  description?: string | null;
  created_at: string;
}

export interface DashboardStats {
  khata: {
    totalGiven: number;
    totalReceived: number;
    pendingGiven: number;
    pendingReceived: number;
    netBalance: number; // Given - Received
    totalTransactions: number;
  };
  expenses: {
    today: number;
    thisMonth: number;
    thisYear: number;
    total: number;
    categoryBreakdown: { category: string; amount: number; percentage: number }[];
  };
  loans: {
    totalGiven: number;
    totalTaken: number;
    activeCount: number;
    closedCount: number;
    totalOutstandingGiven: number;
    totalOutstandingTaken: number;
  };
}
