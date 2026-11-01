import { supabase } from '../lib/supabase';
import { GlobalUtrRecord, UtrSourceModule } from '../types';

export const utrService = {
  /**
   * Check if UTR is already used by the current user.
   * If excludeReferenceId is provided (e.g. on update of the same record), it will ignore that record.
   */
  async checkUtrExists(utrNumber: string, excludeReferenceId?: string): Promise<{ exists: boolean; existingRecord?: GlobalUtrRecord; error: string | null }> {
    const trimmed = utrNumber.trim();
    if (!trimmed) return { exists: false, error: null };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { exists: false, error: 'User not authenticated' };
    }

    try {
      let query = supabase
        .from('global_utr_registry')
        .select('*')
        .eq('user_id', user.id)
        .eq('utr_number', trimmed);

      if (excludeReferenceId) {
        query = query.neq('reference_id', excludeReferenceId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return { exists: false, error: error.message };
      }

      if (data) {
        return { exists: true, existingRecord: data as GlobalUtrRecord, error: null };
      }

      return { exists: false, error: null };
    } catch (err: unknown) {
      return { exists: false, error: (err as Error).message };
    }
  },

  /**
   * Register a UTR number into the global registry.
   * Database UNIQUE(user_id, utr_number) will reject duplicates.
   */
  async registerUtr(params: {
    utrNumber: string;
    sourceModule: UtrSourceModule;
    referenceId: string;
    amount: number;
    transactionDate: string;
    description?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    const trimmed = params.utrNumber.trim();
    if (!trimmed) return { success: true, error: null };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('global_utr_registry')
        .insert({
          user_id: user.id,
          utr_number: trimmed,
          source_module: params.sourceModule,
          reference_id: params.referenceId,
          amount: params.amount,
          transaction_date: params.transactionDate,
          description: params.description || null,
        });

      if (error) {
        if (error.code === '23505' || error.message?.toLowerCase().includes('unique') || error.message?.includes('duplicate')) {
          return {
            success: false,
            error: `UTR/Ref "${trimmed}" is already used in another transaction! Each UTR must be unique.`,
          };
        }
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Remove a UTR record when a transaction is deleted.
   */
  async deleteUtrByReference(referenceId: string): Promise<{ success: boolean; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { error } = await supabase
        .from('global_utr_registry')
        .delete()
        .eq('user_id', user.id)
        .eq('reference_id', referenceId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Update UTR for an existing reference.
   */
  async updateUtr(params: {
    oldUtrNumber?: string | null;
    newUtrNumber?: string | null;
    sourceModule: UtrSourceModule;
    referenceId: string;
    amount: number;
    transactionDate: string;
    description?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    const oldTrimmed = params.oldUtrNumber?.trim();
    const newTrimmed = params.newUtrNumber?.trim();

    if (oldTrimmed === newTrimmed) {
      return { success: true, error: null };
    }

    // Delete old if exists
    if (oldTrimmed) {
      await this.deleteUtrByReference(params.referenceId);
    }

    // Insert new if provided
    if (newTrimmed) {
      return await this.registerUtr({
        utrNumber: newTrimmed,
        sourceModule: params.sourceModule,
        referenceId: params.referenceId,
        amount: params.amount,
        transactionDate: params.transactionDate,
        description: params.description,
      });
    }

    return { success: true, error: null };
  },
};
