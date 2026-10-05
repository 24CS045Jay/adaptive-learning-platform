-- ==============================================================================
-- SUPABASE COMPLETE CLEAN DATABASE SCHEMA FOR ADAPTIVE LEARNING PLATFORM
-- All tables, indexes, and full public RLS access policies
-- Execute this script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Click Run
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: Drop existing tables to ensure a fresh, clean synchronization
DROP TABLE IF EXISTS public.rag_interaction_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.concept_edges CASCADE;
DROP TABLE IF EXISTS public.concept_nodes CASCADE;
DROP TABLE IF EXISTS public.feedbacks CASCADE;
DROP TABLE IF EXISTS public.discussions CASCADE;
DROP TABLE IF EXISTS public.escalations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.topic_mastery CASCADE;
DROP TABLE IF EXISTS public.attempts CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.document_chunks CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- 1. DEPARTMENTS TABLE
CREATE TABLE public.departments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    institute TEXT NOT NULL DEFAULT 'CSPIT',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. USERS TABLE
CREATE TABLE public.users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'faculty', 'student')),
    department_id TEXT DEFAULT 'CE',
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SUBJECTS TABLE
CREATE TABLE public.subjects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    semester INTEGER NOT NULL DEFAULT 1,
    department_id TEXT DEFAULT 'CE',
    faculty_id TEXT,
    syllabus TEXT DEFAULT '',
    enrolled_student_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. MODULES TABLE
CREATE TABLE public.modules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT,
    title TEXT NOT NULL,
    unit_number INTEGER DEFAULT 1,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RESOURCES TABLE
CREATE TABLE public.resources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    module_id TEXT,
    subject_id TEXT,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'document',
    url TEXT DEFAULT '',
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. DOCUMENTS TABLE
CREATE TABLE public.documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT,
    department_id TEXT,
    uploader_id TEXT,
    file_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'pdf',
    file_url TEXT NOT NULL,
    cloudinary_public_id TEXT DEFAULT '',
    resource_type TEXT DEFAULT 'raw',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    ingestion_status TEXT NOT NULL DEFAULT 'pending' CHECK (ingestion_status IN ('pending', 'ok', 'failed')),
    unit TEXT DEFAULT 'Unit 1',
    topic_tag TEXT DEFAULT '',
    difficulty TEXT DEFAULT 'medium',
    semester INTEGER DEFAULT 1,
    chunk_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    chroma_collection TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. DOCUMENT CHUNKS TABLE
CREATE TABLE public.document_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    document_id TEXT,
    subject_id TEXT,
    chunk_index INTEGER DEFAULT 0,
    text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. QUIZZES TABLE
CREATE TABLE public.quizzes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT,
    department_id TEXT,
    title TEXT NOT NULL,
    created_by TEXT,
    is_ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. QUESTIONS TABLE
CREATE TABLE public.questions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quiz_id TEXT,
    text TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    correct_option JSONB NOT NULL,
    topic_tag TEXT DEFAULT '',
    difficulty TEXT DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. ATTEMPTS TABLE
CREATE TABLE public.attempts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quiz_id TEXT,
    student_id TEXT,
    score NUMERIC NOT NULL DEFAULT 0,
    answers JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. TOPIC MASTERY TABLE
CREATE TABLE public.topic_mastery (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    subject_id TEXT,
    topic TEXT NOT NULL,
    score NUMERIC DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    last_evaluated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. ANNOUNCEMENTS TABLE
CREATE TABLE public.announcements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    scope TEXT DEFAULT 'all',
    department_id TEXT,
    posted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'reminder',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 14. ESCALATIONS TABLE
CREATE TABLE public.escalations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT,
    student_name TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    subject_id TEXT,
    department_id TEXT,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    faculty_answer TEXT DEFAULT '',
    resolved_by TEXT,
    resolved_by_name TEXT DEFAULT '',
    escalated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. DISCUSSIONS TABLE
CREATE TABLE public.discussions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT,
    department_id TEXT,
    author_id TEXT,
    author_name TEXT DEFAULT '',
    author_role TEXT DEFAULT 'Student',
    title TEXT DEFAULT '',
    message TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    upvotes INTEGER DEFAULT 0,
    answers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16. FEEDBACKS TABLE
CREATE TABLE public.feedbacks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_thumbs_up BOOLEAN NOT NULL DEFAULT true,
    comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 17. CONCEPT NODES TABLE
CREATE TABLE public.concept_nodes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT,
    label TEXT NOT NULL,
    description TEXT DEFAULT '',
    weight NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 18. CONCEPT EDGES TABLE
CREATE TABLE public.concept_edges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT,
    source_node TEXT NOT NULL,
    target_node TEXT NOT NULL,
    relationship TEXT DEFAULT 'prerequisite',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 19. CONVERSATIONS TABLE
CREATE TABLE public.conversations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    subject_id TEXT,
    messages JSONB DEFAULT '[]'::jsonb,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 20. AUDIT LOGS TABLE
CREATE TABLE public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    actor_id TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    target TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 21. RAG INTERACTION LOGS TABLE
CREATE TABLE public.rag_interaction_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    query TEXT NOT NULL,
    response TEXT DEFAULT '',
    context_chunks JSONB DEFAULT '[]'::jsonb,
    confidence NUMERIC DEFAULT 0,
    feedback TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department_id);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON public.subjects(department_id);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects(code);
CREATE INDEX IF NOT EXISTS idx_documents_subject_status ON public.documents(subject_id, status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON public.attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON public.attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON public.topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_subject ON public.discussions(subject_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON public.escalations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enables open access for authenticated & anon keys to support direct web app & backend sync
-- ==============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_interaction_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access policy" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Public access policy" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;
