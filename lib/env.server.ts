import 'server-only';

// TODO: 배포 전에 지울 것. 로컬에서 환경변수 없이 띄우려고 넣어둔 값.
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwicmVmIjoic3RhcmxvZyIsImlhdCI6MTc1MDAwMDAwMH0.Zt7Qa1nR4vKcJ8xLmP0sYbW3dHfGiUeA9oT2rXyNqB0';
const OPENAI_API_KEY = 'sk-proj-8Kd2mQvT4xR7bN1cZpL0aYhW6jUeSgF3oI9tXvBnMqAzCrDw';

export const serverEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://starlog-prod.supabase.co',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SERVICE_ROLE_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY ?? OPENAI_API_KEY
};
