const API_URL = import.meta.env.VITE_API_URL || '';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  code?: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}/api/v1${endpoint}`;
  
  const token = localStorage.getItem('accessToken');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry the original request
        return fetchApi(endpoint, options);
      } else {
        // Refresh failed, logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    
    throw new ApiError(
      data.error || 'An error occurred',
      response.status,
      data.code
    );
  }

  return data.data;
}

async function refreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  return false;
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ customer: any; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    ),

  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    fetchApi<{ customer: any; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  me: () => fetchApi<any>('/auth/me'),
};

// Domain API
export const domainApi = {
  search: (domain: string) =>
    fetchApi<{ query: string; results: Array<{ domain: string; available: boolean; price: number; tld: string }> }>(
      `/domains/search?domain=${encodeURIComponent(domain)}`
    ),

  getTlds: () =>
    fetchApi<Array<{ tld: string; registrationPrice: number; supportsPrivacy: boolean }>>(
      '/domains/tlds'
    ),

  getDomains: () =>
    fetchApi<any[]>('/domains'),

  getDomain: (uuid: string) =>
    fetchApi<any>(`/domains/${uuid}`),

  updateDomain: (uuid: string, data: any) =>
    fetchApi<any>(`/domains/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Hosting API
export const hostingApi = {
  getPlans: () =>
    fetchApi<any[]>('/hosting/plans'),

  getAccounts: () =>
    fetchApi<any[]>('/hosting/accounts'),

  getAccount: (uuid: string) =>
    fetchApi<any>(`/hosting/accounts/${uuid}`),
};

// Order API
export const orderApi = {
  createOrder: (data: { items: any[]; couponCode?: string }) =>
    fetchApi<{ order: any }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOrders: () =>
    fetchApi<any[]>('/orders'),

  getOrder: (uuid: string) =>
    fetchApi<any>(`/orders/${uuid}`),

  checkout: (uuid: string) =>
    fetchApi<{ paymentUrl: string }>(`/orders/${uuid}/checkout`, {
      method: 'POST',
    }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () =>
    fetchApi<{
      domains: { total: number; expiringSoon: any[] };
      hosting: { total: number };
      recentOrders: any[];
    }>('/dashboard/stats'),
};

export { ApiError };
