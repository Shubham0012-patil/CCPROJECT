import { supabase } from '../lib/supabase';
import { Expense } from '../types';
import { utrService } from './utrService';

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Housing & Rent',
  'Utilities & Bills',
  'Transportation',
  'Healthcare & Medical',
  'Education',
  'Entertainment & Leisure',
  'Travel & Vacation',
  'Insurance',
  'Investments & Savings',
  'Personal Care',
  'Gifts & Donations',
  'Other',
] as const;

export const expenseService = {
  async getExpenses(): Promise<{ data: Expense[]; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: error.message };
      return { data: (data || []) as Expense[], error: null };
    } catch (err: unknown) {
      return { data: [], error: (err as Error).message };
    }
  },

  async addExpense(params: {
    amount: number;
    category: string;
    expense_date: string;
    payment_method: string;
    utr_number?: string;
    notes?: string;
  }): Promise<{ data: Expense | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const utr = params.utr_number?.trim();

    // Check UTR uniqueness in advance
    if (utr) {
      const { exists, error: utrCheckErr } = await utrService.checkUtrExists(utr);
      if (utrCheckErr) return { data: null, error: utrCheckErr };
      if (exists) {
        return { data: null, error: `UTR/Reference "${utr}" has already been used in another transaction.` };
      }
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          amount: Number(params.amount),
          category: params.category,
          expense_date: params.expense_date,
          payment_method: params.payment_method,
          utr_number: utr || null,
          notes: params.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      // Register in global UTR registry
      if (utr && data) {
        const utrRes = await utrService.registerUtr({
          utrNumber: utr,
          sourceModule: 'EXPENSE',
          referenceId: data.id,
          amount: Number(params.amount),
          transactionDate: params.expense_date,
          description: `Expense: ${params.category}`,
        });

        if (!utrRes.success) {
          await supabase.from('expenses').delete().eq('id', data.id);
          return { data: null, error: utrRes.error };
        }
      }

      return { data: data as Expense, error: null };
    } catch (err: unknown) {
      return { data: null, error: (err as Error).message };
    }
  },

  async updateExpense(id: string, params: {
    amount: number;
    category: string;
    expense_date: string;
    payment_method: string;
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
        return { success: false, error: `UTR "${newUtr}" is already in use by another transaction.` };
      }
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: Number(params.amount),
          category: params.category,
          expense_date: params.expense_date,
          payment_method: params.payment_method,
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
        sourceModule: 'EXPENSE',
        referenceId: id,
        amount: Number(params.amount),
        transactionDate: params.expense_date,
        description: `Expense: ${params.category}`,
      });

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  async deleteExpense(id: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('expenses')
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
};
