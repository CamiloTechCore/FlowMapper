// VITE_API_URL preserves the existing project's .env configuration.
export const GAS_URL = (import.meta.env.VITE_GAS_URL || import.meta.env.VITE_API_URL || '').trim();
