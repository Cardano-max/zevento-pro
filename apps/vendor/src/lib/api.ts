const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_role');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error ${res.status}`);
  }

  return res.json();
}

export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_role');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error ${res.status}`);
  }

  return res.json();
}
