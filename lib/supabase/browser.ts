'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env.public';

export const createSupabaseBrowser = () =>
  createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
