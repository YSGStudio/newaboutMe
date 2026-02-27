import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env.server';

export const createSupabaseServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        nextCookies: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>
      ) {
        nextCookies.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
};
