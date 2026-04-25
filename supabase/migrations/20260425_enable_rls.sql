-- Enable Row Level Security on all public tables.
-- All app DB access goes through supabaseAdmin (service role), which bypasses RLS.
-- This blocks direct PostgREST access via the anon key.

ALTER TABLE public.teacher_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_feeds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_title_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_rubrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_report_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_report_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_report_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_reflections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_parent_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters              ENABLE ROW LEVEL SECURITY;
