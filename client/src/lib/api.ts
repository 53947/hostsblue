const API_URL = import.meta.env.VITE_API_URL || '';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  code?: string;
}

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/api/v1${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshToken();
      }
      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;
      if (refreshed) return fetchApi(endpoint, options);
      window.location.href = '/login';
    }
    throw new ApiError(data.error || 'An error occurred', response.status, data.code);
  }
  return data.data;
}

async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ customer: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    fetchApi<{ customer: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => fetchApi<void>('/auth/logout', { method: 'POST' }),
  me: () => fetchApi<any>('/auth/me'),
  forgotPassword: (email: string) =>
    fetchApi<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    fetchApi<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  updateProfile: (data: any) =>
    fetchApi<any>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchApi<void>('/auth/password', { method: 'PATCH', body: JSON.stringify(data) }),
};

export const domainApi = {
  search: (domain: string) => fetchApi<any>(`/domains/search?domain=${encodeURIComponent(domain)}`),
  getTlds: () => fetchApi<any[]>('/domains/tlds'),
  getDomains: () => fetchApi<any[]>('/domains'),
  getDomain: (uuid: string) => fetchApi<any>(`/domains/${uuid}`),
  updateDomain: (uuid: string, data: any) => fetchApi<any>(`/domains/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const hostingApi = {
  getPlans: () => fetchApi<any[]>('/hosting/plans'),
  getAccounts: () => fetchApi<any[]>('/hosting/accounts'),
  getAccount: (uuid: string) => fetchApi<any>(`/hosting/accounts/${uuid}`),
};

export const orderApi = {
  createOrder: (data: any) => fetchApi<{ order: any }>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  getOrders: () => fetchApi<any[]>('/orders'),
  getOrder: (uuid: string) => fetchApi<any>(`/orders/${uuid}`),
  checkout: (uuid: string) => fetchApi<{ paymentUrl: string }>(`/orders/${uuid}/checkout`, { method: 'POST' }),
};

export const dashboardApi = {
  getStats: () => fetchApi<any>('/dashboard/stats'),
};

export const emailApi = {
  getPlans: () => fetchApi<any[]>('/email/plans'),
  getAccounts: () => fetchApi<any[]>('/email/accounts'),
  createAccount: (data: any) => fetchApi<any>('/email/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (id: number) => fetchApi<void>(`/email/accounts/${id}`, { method: 'DELETE' }),
};

export const sslApi = {
  getCertificates: () => fetchApi<any[]>('/ssl/certificates'),
  createCertificate: (data: any) => fetchApi<any>('/ssl/certificates', { method: 'POST', body: JSON.stringify(data) }),
  renewCertificate: (id: number) => fetchApi<any>(`/ssl/certificates/${id}/renew`, { method: 'POST' }),
};

export const sitelockApi = {
  getAccounts: () => fetchApi<any[]>('/sitelock/accounts'),
  triggerScan: (id: number) => fetchApi<any>(`/sitelock/accounts/${id}/scan`, { method: 'POST' }),
};

export const websiteBuilderApi = {
  getProjects: () => fetchApi<any[]>('/website-builder/projects'),
  createProject: (data: any) => fetchApi<any>('/website-builder/projects', { method: 'POST', body: JSON.stringify(data) }),
  publishProject: (id: number) => fetchApi<any>(`/website-builder/projects/${id}/publish`, { method: 'POST' }),
};

export const supportApi = {
  getTickets: () => fetchApi<any[]>('/support/tickets'),
  getTicket: (uuid: string) => fetchApi<any>(`/support/tickets/${uuid}`),
  createTicket: (data: any) => fetchApi<any>('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  addMessage: (ticketUuid: string, body: string) =>
    fetchApi<any>(`/support/tickets/${ticketUuid}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
};

export { ApiError };
