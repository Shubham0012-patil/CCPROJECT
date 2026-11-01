-- ============================================================================
-- NEXMONEY: Complete Production Database Schema
-- Subtitle: Personal Finance Management
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. APP_PINS TABLE
CREATE TABLE IF NOT EXISTS public.app_pins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    login_pin_hash TEXT,
    login_pin_length INTEGER,
    pin_hash TEXT,
    pin_length INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_app_pins_updated_at
    BEFORE UPDATE ON public.app_pins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. KHATA PEOPLE TABLE
CREATE TABLE IF NOT EXISTS public.khata_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_khata_people_updated_at
    BEFORE UPDATE ON public.khata_people
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. KHATA TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.khata_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.khata_people(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('GIVEN', 'RECEIVED')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    utr_number TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_khata_transactions_updated_at
    BEFORE UPDATE ON public.khata_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    utr_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. LONG_TERM_LOANS TABLE
CREATE TABLE IF NOT EXISTS public.long_term_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    loan_type TEXT NOT NULL CHECK (loan_type IN ('GIVEN', 'TAKEN')),
    original_amount NUMERIC(14, 2) NOT NULL CHECK (original_amount > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_return_date DATE,
    payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    utr_number TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
    closed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_long_term_loans_updated_at
    BEFORE UPDATE ON public.long_term_loans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. LOAN_REPAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES public.long_term_loans(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    utr_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. GLOBAL UTR REGISTRY
CREATE TABLE IF NOT EXISTS public.global_utr_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    utr_number TEXT NOT NULL,
    source_module TEXT NOT NULL CHECK (source_module IN ('KHATA', 'EXPENSE', 'LOAN', 'REPAYMENT')),
    reference_id UUID,
    amount NUMERIC(14, 2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_utr UNIQUE (user_id, utr_number)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - MANDATORY ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.long_term_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_utr_registry ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- App Pins Policies
DROP POLICY IF EXISTS "app_pins_select_own" ON public.app_pins;
CREATE POLICY "app_pins_select_own" ON public.app_pins FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_pins_insert_own" ON public.app_pins;
CREATE POLICY "app_pins_insert_own" ON public.app_pins FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_pins_update_own" ON public.app_pins;
CREATE POLICY "app_pins_update_own" ON public.app_pins FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_pins_delete_own" ON public.app_pins;
CREATE POLICY "app_pins_delete_own" ON public.app_pins FOR DELETE USING (auth.uid() = user_id);

-- Khata People Policies
DROP POLICY IF EXISTS "khata_people_select_own" ON public.khata_people;
CREATE POLICY "khata_people_select_own" ON public.khata_people FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "khata_people_insert_own" ON public.khata_people;
CREATE POLICY "khata_people_insert_own" ON public.khata_people FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "khata_people_update_own" ON public.khata_people;
CREATE POLICY "khata_people_update_own" ON public.khata_people FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "khata_people_delete_own" ON public.khata_people;
CREATE POLICY "khata_people_delete_own" ON public.khata_people FOR DELETE USING (auth.uid() = user_id);

-- Khata Transactions Policies
DROP POLICY IF EXISTS "khata_transactions_select_own" ON public.khata_transactions;
CREATE POLICY "khata_transactions_select_own" ON public.khata_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "khata_transactions_insert_own" ON public.khata_transactions;
CREATE POLICY "khata_transactions_insert_own" ON public.khata_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "khata_transactions_update_own" ON public.khata_transactions;
CREATE POLICY "khata_transactions_update_own" ON public.khata_transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "khata_transactions_delete_own" ON public.khata_transactions;
CREATE POLICY "khata_transactions_delete_own" ON public.khata_transactions FOR DELETE USING (auth.uid() = user_id);

-- Expenses Policies
DROP POLICY IF EXISTS "expenses_select_own" ON public.expenses;
CREATE POLICY "expenses_select_own" ON public.expenses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_insert_own" ON public.expenses;
CREATE POLICY "expenses_insert_own" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_update_own" ON public.expenses;
CREATE POLICY "expenses_update_own" ON public.expenses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_delete_own" ON public.expenses;
CREATE POLICY "expenses_delete_own" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- Long Term Loans Policies
DROP POLICY IF EXISTS "long_term_loans_select_own" ON public.long_term_loans;
CREATE POLICY "long_term_loans_select_own" ON public.long_term_loans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "long_term_loans_insert_own" ON public.long_term_loans;
CREATE POLICY "long_term_loans_insert_own" ON public.long_term_loans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "long_term_loans_update_own" ON public.long_term_loans;
CREATE POLICY "long_term_loans_update_own" ON public.long_term_loans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "long_term_loans_delete_own" ON public.long_term_loans;
CREATE POLICY "long_term_loans_delete_own" ON public.long_term_loans FOR DELETE USING (auth.uid() = user_id);

-- Loan Repayments Policies
DROP POLICY IF EXISTS "loan_repayments_select_own" ON public.loan_repayments;
CREATE POLICY "loan_repayments_select_own" ON public.loan_repayments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "loan_repayments_insert_own" ON public.loan_repayments;
CREATE POLICY "loan_repayments_insert_own" ON public.loan_repayments FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.long_term_loans WHERE id = loan_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "loan_repayments_update_own" ON public.loan_repayments;
CREATE POLICY "loan_repayments_update_own" ON public.loan_repayments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "loan_repayments_delete_own" ON public.loan_repayments;
CREATE POLICY "loan_repayments_delete_own" ON public.loan_repayments FOR DELETE USING (auth.uid() = user_id);

-- Global UTR Registry Policies
DROP POLICY IF EXISTS "utr_select_own" ON public.global_utr_registry;
CREATE POLICY "utr_select_own" ON public.global_utr_registry FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "utr_insert_own" ON public.global_utr_registry;
CREATE POLICY "utr_insert_own" ON public.global_utr_registry FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "utr_update_own" ON public.global_utr_registry;
CREATE POLICY "utr_update_own" ON public.global_utr_registry FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "utr_delete_own" ON public.global_utr_registry;
CREATE POLICY "utr_delete_own" ON public.global_utr_registry FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SECURE RPC FUNCTIONS (OPERATING EXCLUSIVELY ON auth.uid())
-- ============================================================================

-- 1. SET LOGIN PIN
CREATE OR REPLACE FUNCTION public.set_login_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    IF LENGTH(p_pin) NOT IN (4, 6) OR p_pin !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'PIN must be exactly 4 or 6 numeric digits.';
    END IF;

    INSERT INTO public.app_pins (user_id, login_pin_hash, login_pin_length, updated_at)
    VALUES (v_uid, crypt(p_pin, gen_salt('bf')), LENGTH(p_pin), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        login_pin_hash = crypt(p_pin, gen_salt('bf')),
        login_pin_length = LENGTH(p_pin),
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. VERIFY LOGIN PIN
CREATE OR REPLACE FUNCTION public.verify_login_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
    v_hash TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT login_pin_hash INTO v_hash FROM public.app_pins WHERE user_id = v_uid;
    IF v_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_hash = crypt(p_pin, v_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. HAS LOGIN PIN
CREATE OR REPLACE FUNCTION public.has_login_pin()
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
    v_exists BOOLEAN;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT (login_pin_hash IS NOT NULL) INTO v_exists FROM public.app_pins WHERE user_id = v_uid;
    RETURN COALESCE(v_exists, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SET APP / TRANSACTION PIN
CREATE OR REPLACE FUNCTION public.set_app_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    IF LENGTH(p_pin) NOT IN (4, 6) OR p_pin !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Transaction PIN must be exactly 4 or 6 numeric digits.';
    END IF;

    INSERT INTO public.app_pins (user_id, pin_hash, pin_length, updated_at)
    VALUES (v_uid, crypt(p_pin, gen_salt('bf')), LENGTH(p_pin), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        pin_hash = crypt(p_pin, gen_salt('bf')),
        pin_length = LENGTH(p_pin),
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VERIFY APP / TRANSACTION PIN
CREATE OR REPLACE FUNCTION public.verify_app_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
    v_hash TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT pin_hash INTO v_hash FROM public.app_pins WHERE user_id = v_uid;
    IF v_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_hash = crypt(p_pin, v_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. HAS APP / TRANSACTION PIN
CREATE OR REPLACE FUNCTION public.has_app_pin()
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
    v_exists BOOLEAN;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT (pin_hash IS NOT NULL) INTO v_exists FROM public.app_pins WHERE user_id = v_uid;
    RETURN COALESCE(v_exists, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. ATOMIC REPAYMENT WITH STATUS CALCULATION
CREATE OR REPLACE FUNCTION public.record_loan_repayment_atomic(
    p_loan_id UUID,
    p_amount NUMERIC,
    p_repayment_date DATE,
    p_payment_method TEXT,
    p_utr_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_uid UUID;
    v_original NUMERIC;
    v_total_repaid NUMERIC;
    v_repayment_id UUID;
    v_new_status TEXT;
    v_remaining NUMERIC;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    -- Verify loan ownership
    SELECT original_amount INTO v_original
    FROM public.long_term_loans
    WHERE id = p_loan_id AND user_id = v_uid;

    IF v_original IS NULL THEN
        RAISE EXCEPTION 'Loan not found or does not belong to user.';
    END IF;

    -- If UTR provided, check and register in global_utr_registry
    IF p_utr_number IS NOT NULL AND TRIM(p_utr_number) <> '' THEN
        INSERT INTO public.global_utr_registry (user_id, utr_number, source_module, reference_id, amount, transaction_date, description)
        VALUES (v_uid, TRIM(p_utr_number), 'REPAYMENT', p_loan_id, p_amount, p_repayment_date, p_notes);
    END IF;

    -- Insert Repayment
    INSERT INTO public.loan_repayments (user_id, loan_id, amount, repayment_date, payment_method, utr_number, notes)
    VALUES (v_uid, p_loan_id, p_amount, p_repayment_date, p_payment_method, TRIM(p_utr_number), p_notes)
    RETURNING id INTO v_repayment_id;

    -- Calculate total repaid so far
    SELECT COALESCE(SUM(amount), 0) INTO v_total_repaid
    FROM public.loan_repayments
    WHERE loan_id = p_loan_id AND user_id = v_uid;

    v_remaining := GREATEST(0, v_original - v_total_repaid);

    IF v_remaining <= 0 THEN
        v_new_status := 'CLOSED';
        UPDATE public.long_term_loans
        SET status = 'CLOSED', closed_date = p_repayment_date, updated_at = NOW()
        WHERE id = p_loan_id AND user_id = v_uid;
    ELSE
        v_new_status := 'ACTIVE';
        UPDATE public.long_term_loans
        SET status = 'ACTIVE', closed_date = NULL, updated_at = NOW()
        WHERE id = p_loan_id AND user_id = v_uid;
    END IF;

    RETURN jsonb_build_object(
        'repayment_id', v_repayment_id,
        'total_repaid', v_total_repaid,
        'remaining_amount', v_remaining,
        'status', v_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
