const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://zevento-api.onrender.com';

// In browser, route through our Next.js proxy to avoid CORS issues
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/proxy';
  }
  return API_BASE;
}

export async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('web_token') : null;
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('web_token');
      window.location.href = '/login';
    }
    throw new Error('Please login to continue');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `Error ${res.status}`);
  }
  return res.json();
}
