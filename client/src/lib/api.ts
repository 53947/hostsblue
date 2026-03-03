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

async function fetchApi<T>(endpoint: string, options: RequestInit & { skipAuthRedirect?: boolean } = {}): Promise<T> {
  const url = `${API_URL}/api/v1${endpoint}`;
  const { skipAuthRedirect, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...fetchOptions, headers, credentials: 'include' });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshToken();
      }
      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;
      if (refreshed) return fetchApi(endpoint, options);
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
  me: () => fetchApi<any>('/auth/me', { skipAuthRedirect: true }),
  forgotPassword: (email: string) =>
    fetchApi<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    fetchApi<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  updateProfile: (data: any) =>
    fetchApi<any>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchApi<void>('/auth/password', { method: 'PATCH', body: JSON.stringify(data) }),
  requestMagicLink: (email: string) =>
    fetchApi<void>('/auth/magic-link/request', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyMagicLink: (token: string) =>
    fetchApi<{ customer: any }>(`/auth/magic-link/verify?token=${encodeURIComponent(token)}`),
};

export const domainApi = {
  search: (domain: string) => fetchApi<any>(`/domains/search?domain=${encodeURIComponent(domain)}`),
  getTlds: () => fetchApi<any[]>('/domains/tlds'),
  getDomains: () => fetchApi<any[]>('/domains'),
  getDomain: (uuid: string) => fetchApi<any>(`/domains/${uuid}`),
  updateDomain: (uuid: string, data: any) => fetchApi<any>(`/domains/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
  // DNS management
  getDnsRecords: (uuid: string) => fetchApi<any[]>(`/domains/${uuid}/dns`),
  createDnsRecord: (uuid: string, data: { type: string; name: string; content: string; ttl?: number; priority?: number }) =>
    fetchApi<any>(`/domains/${uuid}/dns`, { method: 'POST', body: JSON.stringify(data) }),
  updateDnsRecord: (uuid: string, recordId: string, data: { content?: string; ttl?: number; priority?: number }) =>
    fetchApi<any>(`/domains/${uuid}/dns/${recordId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDnsRecord: (uuid: string, recordId: string) =>
    fetchApi<void>(`/domains/${uuid}/dns/${recordId}`, { method: 'DELETE' }),
  syncDns: (uuid: string) =>
    fetchApi<any>(`/domains/${uuid}/dns/sync`, { method: 'POST' }),
};

export const hostingApi = {
  getPlans: () => fetchApi<any[]>('/hosting/plans'),
  getAccounts: () => fetchApi<any[]>('/hosting/accounts'),
  getAccount: (uuid: string) => fetchApi<any>(`/hosting/accounts/${uuid}`),
  createBackup: (uuid: string) =>
    fetchApi<any>(`/hosting/accounts/${uuid}/backup`, { method: 'POST' }),
  getBackups: (uuid: string) => fetchApi<any[]>(`/hosting/accounts/${uuid}/backups`),
  restoreBackup: (uuid: string, backupId: string) =>
    fetchApi<any>(`/hosting/accounts/${uuid}/restore/${backupId}`, { method: 'POST' }),
  clearCache: (uuid: string) =>
    fetchApi<any>(`/hosting/accounts/${uuid}/cache`, { method: 'DELETE' }),
  createStaging: (uuid: string, enabled: boolean) =>
    fetchApi<any>(`/hosting/accounts/${uuid}/staging`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  getStats: (uuid: string) => fetchApi<any>(`/hosting/accounts/${uuid}/stats`),
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
  getAccount: (uuid: string) => fetchApi<any>(`/email/accounts/${uuid}`),
  createAccount: (data: any) => fetchApi<any>('/email/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (uuid: string, data: any) =>
    fetchApi<any>(`/email/accounts/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (uuid: string) => fetchApi<void>(`/email/accounts/${uuid}`, { method: 'DELETE' }),
};

export const sslApi = {
  getProducts: () => fetchApi<any[]>('/ssl/products'),
  getCertificates: () => fetchApi<any[]>('/ssl/certificates'),
  getCertificate: (uuid: string) => fetchApi<any>(`/ssl/certificates/${uuid}`),
  createCertificate: (data: any) => fetchApi<any>('/ssl/certificates', { method: 'POST', body: JSON.stringify(data) }),
  generateCsr: (uuid: string, data?: { commonName?: string; organization?: string; country?: string; state?: string; locality?: string }) =>
    fetchApi<any>(`/ssl/certificates/${uuid}/generate-csr`, { method: 'POST', body: JSON.stringify(data || {}) }),
  generateStandaloneCsr: (data: { domain: string; organization?: string; city?: string; state?: string; country?: string }) =>
    fetchApi<any>('/ssl/generate-csr', { method: 'POST', body: JSON.stringify(data) }),
  reissueCertificate: (uuid: string, newCsr: string) =>
    fetchApi<any>(`/ssl/certificates/${uuid}/reissue`, { method: 'POST', body: JSON.stringify({ newCsr }) }),
  resendDcv: (uuid: string) =>
    fetchApi<any>(`/ssl/certificates/${uuid}/resend-dcv`, { method: 'POST' }),
};

export const sitelockApi = {
  getPlans: () => fetchApi<any[]>('/sitelock/plans'),
  getAccounts: () => fetchApi<any[]>('/sitelock/accounts'),
  getAccount: (uuid: string) => fetchApi<any>(`/sitelock/accounts/${uuid}`),
  triggerScan: (uuid: string) =>
    fetchApi<any>(`/sitelock/accounts/${uuid}/scan`, { method: 'POST' }),
  getSeal: (uuid: string) => fetchApi<any>(`/sitelock/accounts/${uuid}/seal`),
  getFirewall: (uuid: string) => fetchApi<any>(`/sitelock/accounts/${uuid}/firewall`),
  toggleFirewall: (uuid: string, enabled: boolean) =>
    fetchApi<any>(`/sitelock/accounts/${uuid}/firewall`, { method: 'POST', body: JSON.stringify({ enabled }) }),
};

export const websiteBuilderApi = {
  // Templates
  getTemplates: () => fetchApi<any[]>('/website-builder/templates'),
  // Projects
  getProjects: () => fetchApi<any[]>('/website-builder/projects'),
  createProject: (data: any) => fetchApi<any>('/website-builder/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}`),
  updateProject: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}`, { method: 'DELETE' }),
  publishProject: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/publish`, { method: 'POST' }),
  // Pages
  getPages: (uuid: string) => fetchApi<any[]>(`/website-builder/projects/${uuid}/pages`),
  createPage: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/pages`, { method: 'POST', body: JSON.stringify(data) }),
  getPage: (uuid: string, pageSlug: string) => fetchApi<any>(`/website-builder/projects/${uuid}/pages/${pageSlug}`),
  savePage: (uuid: string, pageSlug: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/pages/${pageSlug}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePage: (uuid: string, pageSlug: string) => fetchApi<any>(`/website-builder/projects/${uuid}/pages/${pageSlug}`, { method: 'DELETE' }),
  reorderPages: (uuid: string, order: any[]) => fetchApi<any>(`/website-builder/projects/${uuid}/pages/reorder`, { method: 'PATCH', body: JSON.stringify({ order }) }),
  // AI
  onboardingChat: (data: { message: string; step: string; context: any }) =>
    fetchApi<any>('/website-builder/onboarding/chat', { method: 'POST', body: JSON.stringify(data) }),
  aiGenerate: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/ai/generate`, { method: 'POST', body: JSON.stringify(data) }),
  aiChat: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/ai/chat`, { method: 'POST', body: JSON.stringify(data) }),
  aiGenerateBlock: (uuid: string, type: string) => fetchApi<any>(`/website-builder/projects/${uuid}/ai/generate-block`, { method: 'POST', body: JSON.stringify({ type }) }),
  aiRewrite: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/ai/rewrite`, { method: 'POST', body: JSON.stringify(data) }),
  aiGenerateSeo: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/ai/generate-seo`, { method: 'POST', body: JSON.stringify(data) }),
  // Form submissions
  getSubmissions: (uuid: string) => fetchApi<any[]>(`/website-builder/projects/${uuid}/submissions`),
  deleteSubmission: (uuid: string, id: number) => fetchApi<void>(`/website-builder/projects/${uuid}/submissions/${id}`, { method: 'DELETE' }),
  // Plan
  getPlan: () => fetchApi<any>('/website-builder/plan'),
  // Analytics
  getAnalytics: (uuid: string, days = 30) => fetchApi<any>(`/website-builder/projects/${uuid}/analytics?days=${days}`),
  // Domain
  getDomain: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/domain`),
  setDomain: (uuid: string, domain: string) => fetchApi<any>(`/website-builder/projects/${uuid}/domain`, { method: 'PATCH', body: JSON.stringify({ domain }) }),
  verifyDomain: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/domain/verify`, { method: 'POST' }),
  removeDomain: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/domain`, { method: 'DELETE' }),
  // Settings
  updateSettings: (uuid: string, settings: any) => fetchApi<any>(`/website-builder/projects/${uuid}/settings`, { method: 'PATCH', body: JSON.stringify(settings) }),
};

export const storeApi = {
  getSettings: (uuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/store/settings`),
  updateSettings: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/store/settings`, { method: 'PUT', body: JSON.stringify(data) }),
  getProducts: (uuid: string) => fetchApi<any[]>(`/website-builder/projects/${uuid}/store/products`),
  createProduct: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/store/products`, { method: 'POST', body: JSON.stringify(data) }),
  getProduct: (uuid: string, productUuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/store/products/${productUuid}`),
  updateProduct: (uuid: string, productUuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/store/products/${productUuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (uuid: string, productUuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/store/products/${productUuid}`, { method: 'DELETE' }),
  getCategories: (uuid: string) => fetchApi<any[]>(`/website-builder/projects/${uuid}/store/categories`),
  createCategory: (uuid: string, data: any) => fetchApi<any>(`/website-builder/projects/${uuid}/store/categories`, { method: 'POST', body: JSON.stringify(data) }),
  getOrders: (uuid: string) => fetchApi<any[]>(`/website-builder/projects/${uuid}/store/orders`),
  getOrder: (uuid: string, orderUuid: string) => fetchApi<any>(`/website-builder/projects/${uuid}/store/orders/${orderUuid}`),
  updateOrderStatus: (uuid: string, orderUuid: string, status: string) => fetchApi<any>(`/website-builder/projects/${uuid}/store/orders/${orderUuid}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const aiSettingsApi = {
  get: () => fetchApi<any>('/ai/settings'),
  save: (data: any) => fetchApi<any>('/ai/settings', { method: 'PUT', body: JSON.stringify(data) }),
  test: (data: any) => fetchApi<any>('/ai/settings/test', { method: 'POST', body: JSON.stringify(data) }),
  getModels: () => fetchApi<any>('/ai/models'),
};

export const aiCreditsApi = {
  getBalance: () => fetchApi<any>('/ai/credits/balance'),
  purchase: (amountCents: number) =>
    fetchApi<any>('/ai/credits/purchase', { method: 'POST', body: JSON.stringify({ amountCents }) }),
  quickPurchase: (amountCents: number) =>
    fetchApi<any>('/ai/credits/quick-purchase', { method: 'POST', body: JSON.stringify({ amountCents }) }),
  getTransactions: (limit = 20, offset = 0) =>
    fetchApi<any[]>(`/ai/credits/transactions?limit=${limit}&offset=${offset}`),
  getDailyUsage: (days = 30) =>
    fetchApi<any[]>(`/ai/credits/usage/daily?days=${days}`),
  getModelBreakdown: (days = 30) =>
    fetchApi<any[]>(`/ai/credits/usage/models?days=${days}`),
  updateAutoTopup: (data: { enabled: boolean; thresholdCents?: number; amountCents?: number }) =>
    fetchApi<any>('/ai/credits/auto-topup', { method: 'PUT', body: JSON.stringify(data) }),
  updateSpendingLimit: (data: { limitCents: number | null; period?: string }) =>
    fetchApi<any>('/ai/credits/spending-limit', { method: 'PUT', body: JSON.stringify(data) }),
  updateBillingMode: (mode: 'credits' | 'byok') =>
    fetchApi<any>('/ai/credits/billing-mode', { method: 'PUT', body: JSON.stringify({ mode }) }),
};

export const cloudHostingApi = {
  getOptions: () => fetchApi<any>('/hosting/cloud/options'),
  getServers: () => fetchApi<any[]>('/hosting/cloud/servers'),
  getServer: (uuid: string) => fetchApi<any>(`/hosting/cloud/servers/${uuid}`),
  createServer: (data: { planSlug: string; name: string; datacenter: string; os: string }) =>
    fetchApi<any>('/hosting/cloud/servers', { method: 'POST', body: JSON.stringify(data) }),
  powerAction: (uuid: string, action: 'on' | 'off' | 'reboot') =>
    fetchApi<any>(`/hosting/cloud/servers/${uuid}/power`, { method: 'POST', body: JSON.stringify({ action }) }),
  terminateServer: (uuid: string) =>
    fetchApi<any>(`/hosting/cloud/servers/${uuid}`, { method: 'DELETE' }),
  resizeServer: (uuid: string, planSlug: string) =>
    fetchApi<any>(`/hosting/cloud/servers/${uuid}/resize`, { method: 'PUT', body: JSON.stringify({ planSlug }) }),
  getSnapshots: (uuid: string) => fetchApi<any[]>(`/hosting/cloud/servers/${uuid}/snapshots`),
  createSnapshot: (uuid: string, name: string) =>
    fetchApi<any>(`/hosting/cloud/servers/${uuid}/snapshots`, { method: 'POST', body: JSON.stringify({ name }) }),
  revertSnapshot: (uuid: string, snapId: number) =>
    fetchApi<any>(`/hosting/cloud/servers/${uuid}/snapshots/${snapId}`, { method: 'PUT' }),
};

export const supportApi = {
  getTickets: () => fetchApi<any[]>('/support/tickets'),
  getTicket: (uuid: string) => fetchApi<any>(`/support/tickets/${uuid}`),
  createTicket: (data: any) => fetchApi<any>('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  addMessage: (ticketUuid: string, body: string) =>
    fetchApi<any>(`/support/tickets/${ticketUuid}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
};

export const widgetTokenApi = {
  create: (data: { label?: string; allowedOrigins?: string[] }) =>
    fetchApi<any>('/widget-tokens', { method: 'POST', body: JSON.stringify(data) }),
  list: () => fetchApi<any[]>('/widget-tokens'),
  revoke: (id: number) => fetchApi<void>(`/widget-tokens/${id}`, { method: 'DELETE' }),
};

export const coachGreenApi = {
  chat: (data: { message: string; context?: string; sessionId?: number }) =>
    fetchApi<any>('/coach-green/chat', { method: 'POST', body: JSON.stringify(data) }),
  suggestions: () => fetchApi<any[]>('/coach-green/suggestions'),
};

// Panel (admin) API — uses /api/panel prefix
async function fetchPanel<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/api/panel${endpoint}`;
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
      if (refreshed) return fetchPanel(endpoint, options);
    }
    throw new ApiError(data.error || 'An error occurred', response.status, data.code);
  }
  return data.data;
}

export const panelApi = {
  // Stats & Overview
  getStats: () => fetchPanel<any>('/stats'),

  // Customers
  getCustomers: (params?: { search?: string; status?: string; sort?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/customers?${qs.toString()}`);
  },
  getCustomer: (id: number) => fetchPanel<any>(`/customers/${id}`),
  updateCustomer: (id: number, data: any) =>
    fetchPanel<any>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  suspendCustomer: (id: number) =>
    fetchPanel<any>(`/customers/${id}/suspend`, { method: 'POST' }),
  activateCustomer: (id: number) =>
    fetchPanel<any>(`/customers/${id}/activate`, { method: 'POST' }),
  deleteCustomer: (id: number) =>
    fetchPanel<any>(`/customers/${id}`, { method: 'DELETE' }),
  getCustomerNotes: (id: number) => fetchPanel<any[]>(`/customers/${id}/notes`),
  addCustomerNote: (id: number, content: string) =>
    fetchPanel<any>(`/customers/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
  getCustomerDomains: (id: number) => fetchPanel<any[]>(`/customers/${id}/domains`),
  getCustomerHosting: (id: number) => fetchPanel<any[]>(`/customers/${id}/hosting`),
  getCustomerEmail: (id: number) => fetchPanel<any[]>(`/customers/${id}/email`),
  getCustomerSsl: (id: number) => fetchPanel<any[]>(`/customers/${id}/ssl`),
  getCustomerProjects: (id: number) => fetchPanel<any[]>(`/customers/${id}/projects`),
  getCustomerTickets: (id: number) => fetchPanel<any[]>(`/customers/${id}/tickets`),

  // Orders
  getOrders: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/orders?${qs.toString()}`);
  },
  getOrder: (id: number) => fetchPanel<any>(`/orders/${id}`),
  updateOrder: (id: number, data: any) =>
    fetchPanel<any>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  refundOrder: (id: number, amount: number, reason?: string) =>
    fetchPanel<any>(`/orders/${id}/refund`, { method: 'POST', body: JSON.stringify({ amount, reason }) }),

  // Domains
  getDomains: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/domains?${qs.toString()}`);
  },
  suspendDomain: (id: number) => fetchPanel<any>(`/domains/${id}/suspend`, { method: 'POST' }),
  activateDomain: (id: number) => fetchPanel<any>(`/domains/${id}/activate`, { method: 'POST' }),

  // Hosting
  getHosting: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/hosting?${qs.toString()}`);
  },
  suspendHosting: (id: number) => fetchPanel<any>(`/hosting/${id}/suspend`, { method: 'POST' }),
  activateHosting: (id: number) => fetchPanel<any>(`/hosting/${id}/activate`, { method: 'POST' }),

  // Email
  getEmail: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/email?${qs.toString()}`);
  },
  suspendEmail: (id: number) => fetchPanel<any>(`/email/${id}/suspend`, { method: 'POST' }),
  activateEmail: (id: number) => fetchPanel<any>(`/email/${id}/activate`, { method: 'POST' }),

  // SSL
  getSsl: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/ssl?${qs.toString()}`);
  },

  // Website Builder
  getBuilder: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/builder?${qs.toString()}`);
  },
  suspendProject: (id: number) => fetchPanel<any>(`/builder/${id}/suspend`, { method: 'POST' }),
  activateProject: (id: number) => fetchPanel<any>(`/builder/${id}/activate`, { method: 'POST' }),

  // Tickets
  getTickets: (params?: { search?: string; status?: string; priority?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.priority) qs.set('priority', params.priority);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return fetchPanel<any>(`/tickets?${qs.toString()}`);
  },
  getTicket: (id: number) => fetchPanel<any>(`/tickets/${id}`),
  addTicketMessage: (id: number, body: string, isInternal = false) =>
    fetchPanel<any>(`/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body, isInternal }) }),
  updateTicket: (id: number, data: any) =>
    fetchPanel<any>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  closeTicket: (id: number) =>
    fetchPanel<any>(`/tickets/${id}/close`, { method: 'POST' }),

  // Revenue
  getRevenue: (period = '30d') => fetchPanel<any>(`/revenue?period=${period}`),

  // Settings
  getSettings: () => fetchPanel<any>('/settings'),
  updateSettings: (section: string, data: Record<string, string>) =>
    fetchPanel<any>(`/settings/${section}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateTemplate: (slug: string, data: any) =>
    fetchPanel<any>(`/settings/templates/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Search
  search: (q: string) => fetchPanel<any>(`/search?q=${encodeURIComponent(q)}`),

  // Payment provider
  getPaymentProvider: () => fetchApi<any>('/admin/settings/payment-provider'),
  switchPaymentProvider: (provider: string) =>
    fetchApi<any>('/admin/settings/payment-provider', { method: 'PATCH', body: JSON.stringify({ provider }) }),
};

export { ApiError };
