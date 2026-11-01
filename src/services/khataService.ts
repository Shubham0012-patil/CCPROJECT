import { supabase } from '../lib/supabase';
import { KhataPerson, KhataTransaction, KhataType, KhataStatus } from '../types';
import { utrService } from './utrService';

export const khataService = {
  // PEOPLE
  async getPeople(): Promise<{ data: KhataPerson[]; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('khata_people')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: (data || []) as KhataPerson[], error: null };
    } catch (err: unknown) {
      return { data: [], error: (err as Error).message };
    }
  },

  async addPerson(name: string, phone?: string, notes?: string): Promise<{ data: KhataPerson | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('khata_people')
        .insert({
          user_id: user.id,
          name: name.trim(),
          phone: phone?.trim() || null,
          notes: notes?.trim() || null,
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as KhataPerson, error: null };
    } catch (err: unknown) {
      return { data: null, error: (err as Error).message };
    }
  },

  async updatePerson(id: string, name: string, phone?: string, notes?: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('khata_people')
        .update({
          name: name.trim(),
          phone: phone?.trim() || null,
          notes: notes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  async deletePerson(id: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('khata_people')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  // TRANSACTIONS
  async getTransactions(): Promise<{ data: KhataTransaction[]; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('khata_transactions')
        .select(`
          *,
          person:khata_people(*)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: error.message };
      return { data: (data || []) as KhataTransaction[], error: null };
    } catch (err: unknown) {
      return { data: [], error: (err as Error).message };
    }
  },

  async addTransaction(params: {
    person_id: string;
    type: KhataType;
    amount: number;
    transaction_date: string;
    payment_method: string;
    utr_number?: string;
    notes?: string;
    status?: KhataStatus;
  }): Promise<{ data: KhataTransaction | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not authenticated' };

    const utr = params.utr_number?.trim();

    // 1. Check UTR uniqueness in advance
    if (utr) {
      const { exists, error: utrCheckErr } = await utrService.checkUtrExists(utr);
      if (utrCheckErr) return { data: null, error: utrCheckErr };
      if (exists) {
        return { data: null, error: `UTR/Reference "${utr}" has already been used in another transaction.` };
      }
    }

    try {
      const { data, error } = await supabase
        .from('khata_transactions')
        .insert({
          user_id: user.id,
          person_id: params.person_id,
          type: params.type,
          amount: Number(params.amount),
          transaction_date: params.transaction_date,
          payment_method: params.payment_method,
          utr_number: utr || null,
          notes: params.notes?.trim() || null,
          status: params.status || 'PENDING',
        })
        .select(`
          *,
          person:khata_people(*)
        `)
        .single();

      if (error) return { data: null, error: error.message };

      // 2. Register UTR if transaction succeeded
      if (utr && data) {
        const utrRes = await utrService.registerUtr({
          utrNumber: utr,
          sourceModule: 'KHATA',
          referenceId: data.id,
          amount: Number(params.amount),
          transactionDate: params.transaction_date,
          description: `Khata ${params.type} transaction`,
        });

        if (!utrRes.success) {
          // If UTR insert fails, rollback transaction
          await supabase.from('khata_transactions').delete().eq('id', data.id);
          return { data: null, error: utrRes.error };
        }
      }

      return { data: data as KhataTransaction, error: null };
    } catch (err: unknown) {
      return { data: null, error: (err as Error).message };
    }
  },

  async updateTransaction(id: string, params: {
    person_id: string;
    type: KhataType;
    amount: number;
    transaction_date: string;
    payment_method: string;
    utr_number?: string;
    notes?: string;
    status: KhataStatus;
    old_utr_number?: string | null;
  }): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const newUtr = params.utr_number?.trim();
    const oldUtr = params.old_utr_number?.trim();

    // Check UTR if changed
    if (newUtr && newUtr !== oldUtr) {
      const { exists, error: checkErr } = await utrService.checkUtrExists(newUtr, id);
      if (checkErr) return { success: false, error: checkErr };
      if (exists) {
        return { success: false, error: `UTR "${newUtr}" is already in use by another transaction.` };
      }
    }

    try {
      const { error } = await supabase
        .from('khata_transactions')
        .update({
          person_id: params.person_id,
          type: params.type,
          amount: Number(params.amount),
          transaction_date: params.transaction_date,
          payment_method: params.payment_method,
          utr_number: newUtr || null,
          notes: params.notes?.trim() || null,
          status: params.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };

      // Update UTR registry
      await utrService.updateUtr({
        oldUtrNumber: oldUtr,
        newUtrNumber: newUtr,
        sourceModule: 'KHATA',
        referenceId: id,
        amount: Number(params.amount),
        transactionDate: params.transaction_date,
        description: `Khata ${params.type} transaction`,
      });

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  async deleteTransaction(id: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('khata_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };

      // Also clean up any associated UTR entry
      await utrService.deleteUtrByReference(id);

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  async markCompleted(id: string, completed: boolean): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('khata_transactions')
        .update({
          status: completed ? 'COMPLETED' : 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },
};
