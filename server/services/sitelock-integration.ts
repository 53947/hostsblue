/**
 * SiteLock Integration Service
 * Handles website security scanning, malware removal, WAF, and trust seal management
 *
 * API: REST over HTTPS (SiteLock Partner API)
 * Auth: Partner ID + API Key
 * Credentials will be configured when SiteLock partnership is established
 */

const SITELOCK_API_URL = process.env.SITELOCK_API_URL || 'https://api.sitelock.com/v1';
const SITELOCK_PARTNER_ID = process.env.SITELOCK_PARTNER_ID || '';
const SITELOCK_PARTNER_KEY = process.env.SITELOCK_PARTNER_KEY || '';

export class SiteLockError extends Error {
  code: string;
  retryable: boolean;
  details?: any;

  constructor(message: string, code: string, retryable: boolean = false, details?: any) {
    super(message);
    this.name = 'SiteLockError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export class SiteLockIntegration {
  private apiUrl: string;
  private partnerId: string;
  private partnerKey: string;
  private isMockMode: boolean;

  constructor() {
    this.apiUrl = SITELOCK_API_URL;
    this.partnerId = SITELOCK_PARTNER_ID;
    this.partnerKey = SITELOCK_PARTNER_KEY;

    this.isMockMode = !this.partnerKey || this.partnerKey === 'test' || this.partnerKey === 'your_partner_api_key';

    if (this.isMockMode) {
      console.warn('SiteLock credentials not configured - using mock mode');
    }
  }

  /**
   * Make authenticated request to SiteLock Partner API
   */
  private async apiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    if (this.isMockMode) {
      return this.mockResponse(endpoint, method, body);
    }

    const url = `${this.apiUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'X-Partner-Id': this.partnerId,
          'X-Partner-Key': this.partnerKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = response.status >= 500;
        throw new SiteLockError(
          `SiteLock API error (${response.status}): ${errorText}`,
          `SITELOCK_HTTP_${response.status}`,
          retryable,
          { status: response.status, body: errorText }
        );
      }

      const text = await response.text();
      if (!text) return {};
      return JSON.parse(text);
    } catch (error) {
      if (error instanceof SiteLockError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new SiteLockError('SiteLock API request timed out', 'SITELOCK_TIMEOUT', true);
      }
      throw new SiteLockError(
        `SiteLock API request failed: ${(error as Error).message}`,
        'SITELOCK_NETWORK_ERROR',
        true,
        { originalError: (error as Error).message }
      );
    }
  }

  // ===========================================================================
  // ACCOUNT PROVISIONING
  // ===========================================================================

  async createAccount(data: {
    domain: string;
    planSlug: string;
    contactEmail: string;
    contactName: string;
  }): Promise<{ accountId: string; status: string }> {
    const response = await this.apiRequest('/accounts', 'POST', {
      domain: data.domain,
      plan: data.planSlug,
      contact_email: data.contactEmail,
      contact_name: data.contactName,
    });
    return {
      accountId: response.account_id || response.id,
      status: response.status || 'active',
    };
  }

  async getAccount(accountId: string): Promise<any> {
    return this.apiRequest(`/accounts/${accountId}`);
  }

  async cancelAccount(accountId: string): Promise<any> {
    return this.apiRequest(`/accounts/${accountId}`, 'DELETE');
  }

  async upgradeAccount(accountId: string, newPlanSlug: string): Promise<any> {
    return this.apiRequest(`/accounts/${accountId}/upgrade`, 'POST', {
      plan: newPlanSlug,
    });
  }

  // ===========================================================================
  // SCANNING
  // ===========================================================================

  async initiateScan(accountId: string, scanType: 'malware' | 'vulnerability' | 'full'): Promise<{ scanId: string }> {
    const response = await this.apiRequest(`/accounts/${accountId}/scans`, 'POST', {
      type: scanType,
    });
    return { scanId: response.scan_id || response.id };
  }

  async getScanResults(accountId: string, scanId?: string): Promise<{
    lastScanAt: Date;
    malwareFound: boolean;
    malwareCount: number;
    vulnerabilitiesFound: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    details: any[];
  }> {
    const endpoint = scanId
      ? `/accounts/${accountId}/scans/${scanId}`
      : `/accounts/${accountId}/scans/latest`;
    const response = await this.apiRequest(endpoint);
    return {
      lastScanAt: new Date(response.completed_at || response.last_scan_at || Date.now()),
      malwareFound: response.malware_found || false,
      malwareCount: response.malware_count || 0,
      vulnerabilitiesFound: response.vulnerabilities_found || 0,
      riskLevel: response.risk_level || 'low',
      details: response.details || [],
    };
  }

  // ===========================================================================
  // TRUST SEAL
  // ===========================================================================

  async getTrustSeal(accountId: string): Promise<{
    sealHtml: string;
    sealImageUrl: string;
    verified: boolean;
    verifiedDate: Date;
  }> {
    const response = await this.apiRequest(`/accounts/${accountId}/seal`);
    return {
      sealHtml: response.seal_html || response.html || '',
      sealImageUrl: response.seal_image_url || response.image_url || '',
      verified: response.verified || false,
      verifiedDate: new Date(response.verified_date || Date.now()),
    };
  }

  // ===========================================================================
  // FIREWALL (WAF)
  // ===========================================================================

  async getFirewallStatus(accountId: string): Promise<{
    enabled: boolean;
    blockedRequests24h: number;
    rules: any[];
  }> {
    const response = await this.apiRequest(`/accounts/${accountId}/firewall`);
    return {
      enabled: response.enabled || false,
      blockedRequests24h: response.blocked_requests_24h || 0,
      rules: response.rules || [],
    };
  }

  async toggleFirewall(accountId: string, enabled: boolean): Promise<any> {
    return this.apiRequest(`/accounts/${accountId}/firewall`, 'PUT', { enabled });
  }

  // ===========================================================================
  // MALWARE REMOVAL
  // ===========================================================================

  async requestMalwareRemoval(accountId: string): Promise<{ ticketId: string }> {
    const response = await this.apiRequest(`/accounts/${accountId}/malware-removal`, 'POST');
    return { ticketId: response.ticket_id || response.id };
  }

  async getMalwareRemovalStatus(accountId: string, ticketId: string): Promise<any> {
    return this.apiRequest(`/accounts/${accountId}/malware-removal/${ticketId}`);
  }

  // ===========================================================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ===========================================================================

  verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!this.partnerKey || this.partnerKey === 'your_partner_api_key') {
      return true;
    }

    try {
      const crypto = require('crypto');
      const expected = crypto
        .createHmac('sha256', this.partnerKey)
        .update(JSON.stringify(payload))
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // MOCK RESPONSES
  // ===========================================================================

  private mockResponse(endpoint: string, method: string, body?: any): any {
    console.log(`[SiteLock Mock] ${method} ${endpoint}`, body);

    // Create account
    if (endpoint === '/accounts' && method === 'POST') {
      return {
        account_id: `mock-sl-${Date.now()}`,
        id: `mock-sl-${Date.now()}`,
        domain: body?.domain,
        plan: body?.plan,
        status: 'active',
        created_at: new Date().toISOString(),
      };
    }

    // Get account
    if (endpoint.match(/^\/accounts\/[^/]+$/) && method === 'GET') {
      const accountId = endpoint.split('/')[2];
      return {
        account_id: accountId,
        domain: 'example.com',
        plan: 'professional',
        status: 'active',
        trust_seal_enabled: true,
        firewall_enabled: true,
        malware_found: false,
        risk_level: 'low',
        last_scan_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Cancel account
    if (endpoint.match(/^\/accounts\/[^/]+$/) && method === 'DELETE') {
      return { success: true, status: 'cancelled' };
    }

    // Upgrade account
    if (endpoint.match(/\/upgrade$/) && method === 'POST') {
      return { success: true, plan: body?.plan, status: 'active' };
    }

    // Initiate scan
    if (endpoint.match(/\/scans$/) && method === 'POST') {
      return {
        scan_id: `mock-scan-${Date.now()}`,
        id: `mock-scan-${Date.now()}`,
        type: body?.type || 'full',
        status: 'in_progress',
        started_at: new Date().toISOString(),
      };
    }

    // Get scan results
    if (endpoint.match(/\/scans/)) {
      return {
        completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        last_scan_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        malware_found: false,
        malware_count: 0,
        vulnerabilities_found: 2,
        risk_level: 'low',
        details: [
          { type: 'vulnerability', severity: 'low', description: 'jQuery version outdated', path: '/js/jquery.min.js' },
          { type: 'vulnerability', severity: 'low', description: 'Missing X-Frame-Options header', path: '/' },
        ],
      };
    }

    // Trust seal
    if (endpoint.match(/\/seal$/)) {
      const accountId = endpoint.split('/')[2];
      return {
        seal_html: `<a href="https://www.sitelock.com/verify.php?site=${accountId}" target="_blank"><img src="https://shield.sitelock.com/shield/${accountId}" alt="SiteLock Verified" /></a>`,
        seal_image_url: `https://shield.sitelock.com/shield/${accountId}`,
        verified: true,
        verified_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Firewall GET
    if (endpoint.match(/\/firewall$/) && method === 'GET') {
      return {
        enabled: true,
        blocked_requests_24h: 147,
        rules: [
          { id: 'sql-injection', name: 'SQL Injection Protection', enabled: true },
          { id: 'xss', name: 'Cross-Site Scripting Protection', enabled: true },
          { id: 'rfi', name: 'Remote File Inclusion Protection', enabled: true },
          { id: 'rate-limit', name: 'Rate Limiting', enabled: true },
        ],
      };
    }

    // Firewall PUT
    if (endpoint.match(/\/firewall$/) && method === 'PUT') {
      return { success: true, enabled: body?.enabled ?? true };
    }

    // Malware removal POST
    if (endpoint.match(/\/malware-removal$/) && method === 'POST') {
      return {
        ticket_id: `mock-ticket-${Date.now()}`,
        id: `mock-ticket-${Date.now()}`,
        status: 'submitted',
        created_at: new Date().toISOString(),
      };
    }

    // Malware removal status
    if (endpoint.match(/\/malware-removal\//)) {
      return {
        status: 'completed',
        files_cleaned: 3,
        completed_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      };
    }

    return { success: true };
  }
}
