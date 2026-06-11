export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseConfig() {
  return {
    url: getRequiredEnv('SUPABASE_URL').replace(/\/$/, ''),
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  };
}

export function getAdminToken() {
  return getRequiredEnv('ADMIN_API_TOKEN');
}

export function getDeepSeekConfig() {
  return {
    apiKey: getRequiredEnv('DEEPSEEK_API_KEY'),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  };
}
