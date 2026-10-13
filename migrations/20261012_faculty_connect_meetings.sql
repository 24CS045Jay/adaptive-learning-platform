-- ==============================================================================
-- MIGRATION: 20261012_faculty_connect_meetings.sql
-- EduSense AI — Real Microsoft Teams Meeting Integration Schema
-- Creates persistent tables for Faculty Connect office hours and student bookings.
-- Safe and non-destructive: uses IF NOT EXISTS and preserves existing tables.
-- ==============================================================================

-- 1. MEETING SLOTS TABLE (Faculty office hour sessions & group meetings)
CREATE TABLE IF NOT EXISTS public.meeting_slots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    faculty_id TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    faculty_email TEXT,
    department_id TEXT NOT NULL DEFAULT 'CE',
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    subject_id TEXT,
    topic TEXT NOT NULL,
    description TEXT DEFAULT '',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    capacity INTEGER NOT NULL DEFAULT 1,
    booked_count INTEGER NOT NULL DEFAULT 0,
    location_type TEXT NOT NULL DEFAULT 'teams',
    audience_type TEXT NOT NULL DEFAULT 'department' CHECK (audience_type IN ('department', 'specific_students', 'all')),
    invited_student_ids JSONB DEFAULT '[]'::jsonb,
    teams_meeting_id TEXT,
    teams_join_url TEXT,
    teams_organizer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MEETING BOOKINGS TABLE (Student session requests & confirmed 1-on-1/group bookings)
CREATE TABLE IF NOT EXISTS public.meeting_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slot_id TEXT NOT NULL REFERENCES public.meeting_slots(id) ON DELETE CASCADE,
    faculty_id TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    department_id TEXT NOT NULL DEFAULT 'CE',
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    topic TEXT NOT NULL,
    doubt_description TEXT DEFAULT '',
    meeting_type TEXT NOT NULL DEFAULT 'one_on_one' CHECK (meeting_type IN ('one_on_one', 'group')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled', 'completed', 'no_show')),
    teams_join_url TEXT,
    teams_meeting_id TEXT,
    teams_provider TEXT DEFAULT 'microsoft_teams',
    teams_is_live BOOLEAN DEFAULT true,
    faculty_notes TEXT DEFAULT '',
    rejection_reason TEXT DEFAULT '',
    cancellation_reason TEXT DEFAULT '',
    idempotency_key TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. INDEXES FOR HIGH-PERFORMANCE SCHEDULING & CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_meeting_slots_faculty ON public.meeting_slots(faculty_id);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_department ON public.meeting_slots(department_id);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_status_start ON public.meeting_slots(status, start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_subject ON public.meeting_slots(subject_code);

CREATE INDEX IF NOT EXISTS idx_meeting_bookings_slot ON public.meeting_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_student ON public.meeting_bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_faculty ON public.meeting_bookings(faculty_id);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_status ON public.meeting_bookings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_idempotency ON public.meeting_bookings(idempotency_key);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.meeting_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_bookings ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES (Matches application standard access policies)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public access policy" ON public.meeting_slots;
    CREATE POLICY "Public access policy" ON public.meeting_slots FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access policy" ON public.meeting_bookings;
    CREATE POLICY "Public access policy" ON public.meeting_bookings FOR ALL USING (true) WITH CHECK (true);
END $$;
