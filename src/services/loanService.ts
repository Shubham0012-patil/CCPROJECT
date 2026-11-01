import { supabase } from '../lib/supabase';
import { LongTermLoan, LoanRepayment, LoanType } from '../types';
import { utrService } from './utrService';

export const loanService = {
  async getLoans(): Promise<{ data: LongTermLoan[]; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('long_term_loans')
        .select(`
          *,
          repayments:loan_repayments(*)
        `)
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: error.message };

      // Compute total_repaid, remaining_amount, and progress_pct for each loan
      const processed: LongTermLoan[] = (data || []).map((item: LongTermLoan) => {
        const repaymentsList = item.repayments || [];
        // Sort repayments descending by date
        repaymentsList.sort((a, b) => new Date(b.repayment_date).getTime() - new Date(a.repayment_date).getTime());

        const totalRepaid = repaymentsList.reduce((sum, r) => sum + Number(r.amount), 0);
        const original = Number(item.original_amount);
        const remaining = Math.max(0, original - totalRepaid);
        const progress = original > 0 ? Math.min(100, Math.round((totalRepaid / original) * 100)) : 0;

        return {
          ...item,
          repayments: repaymentsList,
          total_repaid: totalRepaid,
          remaining_amount: remaining,
          progress_pct: progress,
        };
      });

      return { data: processed, error: null };
    } catch (err: unknown) {
      return { data: [], error: (err as Error).message };
    }
  },

  async addLoan(params: {
    person_name: string;
    loan_type: LoanType;
    original_amount: number;
    interest_rate?: number;
    start_date: string;
    due_date?: string;
    expected_return_date?: string;
    payment_method?: string;
    utr_number?: string;
    notes?: string;
  }): Promise<{ data: LongTermLoan | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const utr = params.utr_number?.trim();

    if (utr) {
      const { exists, error: checkErr } = await utrService.checkUtrExists(utr);
      if (checkErr) return { data: null, error: checkErr };
      if (exists) {
        return { data: null, error: `UTR/Reference "${utr}" has already been used in another transaction.` };
      }
    }

    try {
      const { data, error } = await supabase
        .from('long_term_loans')
        .insert({
          user_id: user.id,
          person_name: params.person_name.trim(),
          loan_type: params.loan_type,
          original_amount: Number(params.original_amount),
          interest_rate: params.interest_rate || 0,
          start_date: params.start_date,
          due_date: params.due_date || params.expected_return_date || null,
          expected_return_date: params.due_date || params.expected_return_date || null,
          payment_method: params.payment_method || 'UPI',
          utr_number: utr || null,
          notes: params.notes?.trim() || null,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      if (utr && data) {
        const utrRes = await utrService.registerUtr({
          utrNumber: utr,
          sourceModule: 'LOAN',
          referenceId: data.id,
          amount: Number(params.original_amount),
          transactionDate: params.start_date,
          description: `Loan ${params.loan_type} to/from ${params.person_name}`,
        });

        if (!utrRes.success) {
          await supabase.from('long_term_loans').delete().eq('id', data.id);
          return { data: null, error: utrRes.error };
        }
      }

      return {
        data: {
          ...data,
          repayments: [],
          total_repaid: 0,
          remaining_amount: Number(params.original_amount),
          progress_pct: 0,
        } as LongTermLoan,
        error: null,
      };
    } catch (err: unknown) {
      return { data: null, error: (err as Error).message };
    }
  },

  async updateLoan(id: string, params: {
    person_name: string;
    loan_type: LoanType;
    original_amount: number;
    interest_rate?: number;
    start_date: string;
    due_date?: string;
    expected_return_date?: string;
    payment_method?: string;
    utr_number?: string;
    notes?: string;
    old_utr_number?: string | null;
  }): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const newUtr = params.utr_number?.trim();
    const oldUtr = params.old_utr_number?.trim();

    if (newUtr && newUtr !== oldUtr) {
      const { exists, error: checkErr } = await utrService.checkUtrExists(newUtr, id);
      if (checkErr) return { success: false, error: checkErr };
      if (exists) {
        return { success: false, error: `UTR "${newUtr}" is already used.` };
      }
    }

    try {
      const { error } = await supabase
        .from('long_term_loans')
        .update({
          person_name: params.person_name.trim(),
          loan_type: params.loan_type,
          original_amount: Number(params.original_amount),
          interest_rate: params.interest_rate || 0,
          start_date: params.start_date,
          due_date: params.due_date || params.expected_return_date || null,
          expected_return_date: params.due_date || params.expected_return_date || null,
          payment_method: params.payment_method || 'UPI',
          utr_number: newUtr || null,
          notes: params.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };

      await utrService.updateUtr({
        oldUtrNumber: oldUtr,
        newUtrNumber: newUtr,
        sourceModule: 'LOAN',
        referenceId: id,
        amount: Number(params.original_amount),
        transactionDate: params.start_date,
        description: `Loan ${params.loan_type} to/from ${params.person_name}`,
      });

      // Recalculate status if original amount changed
      await this.syncLoanStatus(id);

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  async deleteLoan(id: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // Find all repayments to clean up their UTRs
      const { data: repayments } = await supabase
        .from('loan_repayments')
        .select('id')
        .eq('loan_id', id)
        .eq('user_id', user.id);

      if (repayments) {
        for (const rep of repayments) {
          await utrService.deleteUtrByReference(rep.id);
        }
      }

      // Delete loan
      const { error } = await supabase
        .from('long_term_loans')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };

      await utrService.deleteUtrByReference(id);
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Add a repayment to a loan.
   * Uses atomic RPC if available, or client transaction logic with exact status update.
   */
  async addRepayment(params: {
    loan_id: string;
    amount: number;
    repayment_date: string;
    payment_method: string;
    utr_number?: string;
    notes?: string;
  }): Promise<{ data: LoanRepayment | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const utr = params.utr_number?.trim();

    if (utr) {
      const { exists, error: checkErr } = await utrService.checkUtrExists(utr);
      if (checkErr) return { data: null, error: checkErr };
      if (exists) {
        return { data: null, error: `UTR/Reference "${utr}" has already been used in another transaction.` };
      }
    }

    try {
      // 1. Try atomic PostgreSQL RPC function if created
      const { data: rpcData, error: rpcErr } = await supabase.rpc('record_loan_repayment_atomic', {
        p_loan_id: params.loan_id,
        p_amount: Number(params.amount),
        p_repayment_date: params.repayment_date,
        p_payment_method: params.payment_method,
        p_utr_number: utr || null,
        p_notes: params.notes?.trim() || null,
      });

      if (!rpcErr && rpcData?.repayment_id) {
        return {
          data: {
            id: rpcData.repayment_id,
            user_id: user.id,
            loan_id: params.loan_id,
            amount: Number(params.amount),
            repayment_date: params.repayment_date,
            payment_method: params.payment_method,
            utr_number: utr || null,
            notes: params.notes?.trim() || null,
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }

      // 2. Direct client fallback with transactional consistency
      const { data: repData, error: repError } = await supabase
        .from('loan_repayments')
        .insert({
          user_id: user.id,
          loan_id: params.loan_id,
          amount: Number(params.amount),
          repayment_date: params.repayment_date,
          payment_method: params.payment_method,
          utr_number: utr || null,
          notes: params.notes?.trim() || null,
        })
        .select()
        .single();

      if (repError) return { data: null, error: repError.message };

      if (utr && repData) {
        await utrService.registerUtr({
          utrNumber: utr,
          sourceModule: 'REPAYMENT',
          referenceId: repData.id,
          amount: Number(params.amount),
          transactionDate: params.repayment_date,
          description: `Loan Repayment for loan ${params.loan_id}`,
        });
      }

      // Synchronize parent loan status
      await this.syncLoanStatus(params.loan_id);

      return { data: repData as LoanRepayment, error: null };
    } catch (err: unknown) {
      return { data: null, error: (err as Error).message };
    }
  },

  async deleteRepayment(repaymentId: string, loanId: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('loan_repayments')
        .delete()
        .eq('id', repaymentId)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };

      await utrService.deleteUtrByReference(repaymentId);
      await this.syncLoanStatus(loanId);

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Synchronize loan status and closed_date based on total repayments
   */
  async syncLoanStatus(loanId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data: loan } = await supabase
        .from('long_term_loans')
        .select('original_amount')
        .eq('id', loanId)
        .eq('user_id', user.id)
        .single();

      if (!loan) return;

      const { data: reps } = await supabase
        .from('loan_repayments')
        .select('amount, repayment_date')
        .eq('loan_id', loanId)
        .eq('user_id', user.id)
        .order('repayment_date', { ascending: false });

      const totalRepaid = (reps || []).reduce((sum, r) => sum + Number(r.amount), 0);
      const original = Number(loan.original_amount);

      if (totalRepaid >= original && original > 0) {
        const latestDate = reps && reps.length > 0 ? reps[0].repayment_date : new Date().toISOString().split('T')[0];
        await supabase
          .from('long_term_loans')
          .update({
            status: 'CLOSED',
            closed_date: latestDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loanId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('long_term_loans')
          .update({
            status: 'ACTIVE',
            closed_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loanId)
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error syncing loan status:', err);
    }
  },

  async getRepayments(loanId: string): Promise<{ data: LoanRepayment[]; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('loan_repayments')
        .select('*')
        .eq('loan_id', loanId)
        .eq('user_id', user.id)
        .order('repayment_date', { ascending: false });

      if (error) return { data: [], error: error.message };
      return { data: (data || []) as LoanRepayment[], error: null };
    } catch (err: unknown) {
      return { data: [], error: (err as Error).message };
    }
  },
};
