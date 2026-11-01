import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, hashPinClient } from '../lib/supabase';
import { Profile, PinStatus } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  pinStatus: PinStatus;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; needsEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPinStatus: () => Promise<void>;
  setLoginPin: (pin: string) => Promise<{ success: boolean; error: string | null }>;
  verifyLoginPin: (pin: string) => Promise<{ success: boolean; error: string | null }>;
  setTransactionPin: (pin: string) => Promise<{ success: boolean; error: string | null }>;
  verifyTransactionPin: (pin: string) => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus>({
    hasLoginPin: false,
    hasAppPin: false,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch or ensure profile exists for the user
  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch note:', error.message);
      }

      if (data) {
        setProfile(data as Profile);
      } else {
        // Fallback: If DB trigger hasn't created profile or table was newly made, insert profile
        const newProfile: Profile = {
          id: currentUser.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
        };
        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (!insertErr && inserted) {
          setProfile(inserted as Profile);
        } else {
          setProfile(newProfile);
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }, []);

  // Fetch PIN status
  const fetchPinStatus = useCallback(async (currentUser: User) => {
    try {
      // First attempt RPC if defined
      let hasLogin = false;
      let hasApp = false;
      let loginLen: number | undefined;
      let appLen: number | undefined;

      try {
        const { data: loginData, error: rpcErr1 } = await supabase.rpc('has_login_pin');
        if (!rpcErr1 && typeof loginData === 'boolean') {
          hasLogin = loginData;
        } else {
          throw new Error('RPC has_login_pin not available');
        }

        const { data: appData, error: rpcErr2 } = await supabase.rpc('has_app_pin');
        if (!rpcErr2 && typeof appData === 'boolean') {
          hasApp = appData;
        } else {
          throw new Error('RPC has_app_pin not available');
        }
      } catch {
        // Direct query with RLS boundary (auth.uid() = user_id)
        const { data, error } = await supabase
          .from('app_pins')
          .select('login_pin_hash, login_pin_length, pin_hash, pin_length')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (!error && data) {
          hasLogin = Boolean(data.login_pin_hash);
          hasApp = Boolean(data.pin_hash);
          loginLen = data.login_pin_length || undefined;
          appLen = data.pin_length || undefined;
        }
      }

      setPinStatus({
        hasLoginPin: hasLogin,
        hasAppPin: hasApp,
        loginPinLength: loginLen,
        appPinLength: appLen,
      });
    } catch (err) {
      console.error('Error fetching PIN status:', err);
    }
  }, []);

  // Load session on startup and setup subscription
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Supabase session fetch error:', error);
        }

        if (isMounted) {
          if (initialSession?.user) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfile(initialSession.user);
            await fetchPinStatus(initialSession.user);
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      const newUser = newSession?.user || null;
      setUser(newUser);

      if (newUser) {
        await fetchProfile(newUser);
        await fetchPinStatus(newUser);
      } else {
        // Cleared session
        setProfile(null);
        setPinStatus({ hasLoginPin: false, hasAppPin: false });
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfile, fetchPinStatus]);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) return { error };

      // Check if session was granted or confirmation email is required
      const needsEmailVerification = !data.session;
      return { error: null, needsEmailVerification };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      // Clear React state and local cache completely
      setUser(null);
      setSession(null);
      setProfile(null);
      setPinStatus({ hasLoginPin: false, hasAppPin: false });
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  const refreshPinStatus = async () => {
    if (user) {
      await fetchPinStatus(user);
    }
  };

  /**
   * SET LOGIN PIN
   * Operates against authenticated user.
   */
  const setLoginPin = async (pin: string): Promise<{ success: boolean; error: string | null }> => {
    // 1. Verify Supabase session and user exist
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Your session has expired. Please log in again.' };
    }

    const currentUid = userData.user.id;
    if (!currentUid) {
      return { success: false, error: 'Unauthorized: User not authenticated.' };
    }

    if (pin.length !== 4 && pin.length !== 6) {
      return { success: false, error: 'Login PIN must be exactly 4 or 6 digits.' };
    }

    try {
      // Try secure RPC first
      const { error: rpcError } = await supabase.rpc('set_login_pin', { p_pin: pin });
      if (!rpcError) {
        await refreshPinStatus();
        return { success: true, error: null };
      }

      // Fallback if RPC not installed in DB: Hash with SHA-256 and insert/update app_pins table
      const hashedPin = await hashPinClient(pin, `login_${currentUid}`);
      const { error: tableError } = await supabase
        .from('app_pins')
        .upsert(
          {
            user_id: currentUid,
            login_pin_hash: hashedPin,
            login_pin_length: pin.length,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (tableError) {
        return { success: false, error: tableError.message };
      }

      await refreshPinStatus();
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Failed to set Login PIN' };
    }
  };

  /**
   * VERIFY LOGIN PIN
   */
  const verifyLoginPin = async (pin: string): Promise<{ success: boolean; error: string | null }> => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return { success: false, error: 'Your session has expired. Please log in again.' };
    }

    const currentUid = userData.user.id;

    try {
      // Try RPC
      const { data, error: rpcError } = await supabase.rpc('verify_login_pin', { p_pin: pin });
      if (!rpcError && typeof data === 'boolean') {
        return { success: data, error: data ? null : 'Incorrect Login PIN' };
      }

      // Fallback: compare with hashed PIN in app_pins
      const { data: pinRow, error: fetchErr } = await supabase
        .from('app_pins')
        .select('login_pin_hash')
        .eq('user_id', currentUid)
        .single();

      if (fetchErr || !pinRow?.login_pin_hash) {
        return { success: false, error: 'Login PIN has not been set yet.' };
      }

      const clientHashed = await hashPinClient(pin, `login_${currentUid}`);
      const matches = pinRow.login_pin_hash === clientHashed;
      return { success: matches, error: matches ? null : 'Incorrect Login PIN' };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Verification failed' };
    }
  };

  /**
   * SET TRANSACTION PIN (App PIN)
   * CRITICAL AUTH TEST REQUIREMENT:
   * Opening Settings -> Security PIN -> Transaction PIN -> Save
   * MUST NEVER produce: "null value in column user_id of relation app_pins violates not-null constraint"
   * Before RPC: verify authenticated user/session exists. If no user: show "Your session has expired. Please log in again."
   */
  const setTransactionPin = async (pin: string): Promise<{ success: boolean; error: string | null }> => {
    // 1. Verify Supabase session exists
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      return { success: false, error: 'Your session has expired. Please log in again.' };
    }

    // 2. Verify authenticated user exists
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user || !userData.user.id) {
      return { success: false, error: 'Your session has expired. Please log in again.' };
    }

    const currentUid = userData.user.id;

    if (pin.length !== 4 && pin.length !== 6) {
      return { success: false, error: 'Transaction PIN must be exactly 4 or 6 digits.' };
    }

    try {
      // Try secure RPC first
      const { error: rpcError } = await supabase.rpc('set_app_pin', { p_pin: pin });
      if (!rpcError) {
        await refreshPinStatus();
        return { success: true, error: null };
      }

      // Fallback: Hash with SHA-256 and insert/update app_pins with user_id guaranteed not null
      const hashedPin = await hashPinClient(pin, `app_${currentUid}`);
      const { error: tableError } = await supabase
        .from('app_pins')
        .upsert(
          {
            user_id: currentUid,
            pin_hash: hashedPin,
            pin_length: pin.length,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (tableError) {
        return { success: false, error: tableError.message };
      }

      await refreshPinStatus();
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Failed to set Transaction PIN' };
    }
  };

  /**
   * VERIFY TRANSACTION PIN
   */
  const verifyTransactionPin = async (pin: string): Promise<{ success: boolean; error: string | null }> => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user || !userData.user.id) {
      return { success: false, error: 'Your session has expired. Please log in again.' };
    }

    const currentUid = userData.user.id;

    try {
      // Try RPC
      const { data, error: rpcError } = await supabase.rpc('verify_app_pin', { p_pin: pin });
      if (!rpcError && typeof data === 'boolean') {
        return { success: data, error: data ? null : 'Incorrect Transaction PIN' };
      }

      // Fallback query
      const { data: pinRow, error: fetchErr } = await supabase
        .from('app_pins')
        .select('pin_hash')
        .eq('user_id', currentUid)
        .single();

      if (fetchErr || !pinRow?.pin_hash) {
        return { success: false, error: 'Transaction PIN is not configured yet. Please set it in Settings.' };
      }

      const clientHashed = await hashPinClient(pin, `app_${currentUid}`);
      const matches = pinRow.pin_hash === clientHashed;
      return { success: matches, error: matches ? null : 'Incorrect Transaction PIN' };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'PIN verification failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        pinStatus,
        loading,
        isConfigured: isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        refreshPinStatus,
        setLoginPin,
        verifyLoginPin,
        setTransactionPin,
        verifyTransactionPin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
