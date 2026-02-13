/**
 * OpenSRS Domain Integration Service
 * Handles domain registration, transfers, and management via OpenSRS API
 */

const OPENRS_API_URL = process.env.OPENRS_API_URL || 'https://admin.test.hostedemail.com/api';
const OPENRS_API_KEY = process.env.OPENRS_API_KEY || '';
const OPENRS_USERNAME = process.env.OPENRS_USERNAME || '';

interface DomainAvailabilityResult {
  domain: string;
  tld: string;
  available: boolean;
  price?: number;
  premium?: boolean;
  reason?: string;
}

interface RegistrationData {
  domain: string;
  period: number;
  contacts: {
    owner: ContactData;
    admin?: ContactData;
    tech?: ContactData;
    billing?: ContactData;
  };
  nameservers?: string[];
  privacy?: boolean;
}

interface ContactData {
  firstName: string;
  lastName: string;
  organization?: string;
  email: string;
  phone: string;
  fax?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export class OpenSRSIntegration {
  private apiUrl: string;
  private apiKey: string;
  private username: string;

  constructor() {
    this.apiUrl = OPENRS_API_URL;
    this.apiKey = OPENRS_API_KEY;
    this.username = OPENRS_USERNAME;

    if (!this.apiKey || !this.username) {
      console.warn('OpenSRS credentials not configured - using mock mode');
    }
  }

  /**
   * Make authenticated request to OpenSRS API
   */
  private async apiRequest(
    action: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    // In production, implement proper OpenSRS authentication
    // This uses the OpenSRS XML/JSON API with signature-based auth
    
    const payload = {
      action,
      credentials: {
        username: this.username,
        api_key: this.apiKey,
      },
      ...params,
    };

    try {
      // Mock mode for development
      if (!this.apiKey || this.apiKey === 'your_opensrs_api_key') {
        return this.mockResponse(action, params);
      }

      const response = await fetch(`${this.apiUrl}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenSRS-Username': this.username,
          'X-OpenSRS-Signature': this.generateSignature(action, params),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenSRS API error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('OpenSRS API request failed:', error);
      throw error;
    }
  }

  /**
   * Generate API signature for OpenSRS authentication
   */
  private generateSignature(action: string, params: any): string {
    // OpenSRS uses a signature-based auth
    // Implement according to OpenSRS documentation
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = `${this.username}:${this.apiKey}:${action}:${timestamp}`;
    
    // In production, use proper HMAC-SHA256
    return `mock-signature-${timestamp}`;
  }

  /**
   * Check domain availability
   */
  async checkAvailability(
    domain: string,
    tlds: string[]
  ): Promise<DomainAvailabilityResult[]> {
    const results: DomainAvailabilityResult[] = [];

    try {
      // Clean domain (remove protocol, www, etc)
      const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0];

      // If no TLDs provided, default to .com
      const searchTlds = tlds.length > 0 ? tlds : ['.com'];

      const response = await this.apiRequest('lookup', {
        domains: searchTlds.map(tld => `${cleanDomain}${tld}`),
      });

      if (response.results) {
        for (const result of response.results) {
          results.push({
            domain: result.domain,
            tld: result.tld,
            available: result.available,
            premium: result.premium || false,
            reason: result.reason,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Domain availability check failed:', error);
      
      // Return mock results in development
      return searchTlds.map(tld => ({
        domain: `${domain}${tld}`,
        tld,
        available: Math.random() > 0.5, // Random for mock
      }));
    }
  }

  /**
   * Register a new domain
   */
  async registerDomain(data: RegistrationData): Promise<any> {
    const params = {
      domain: data.domain,
      period: data.period,
      contacts: data.contacts,
      nameservers: data.nameservers || [
        'ns1.hostsblue.com',
        'ns2.hostsblue.com',
      ],
      privacy: data.privacy || false,
    };

    const response = await this.apiRequest('register', params);

    return {
      success: response.success,
      orderId: response.order_id,
      domainId: response.domain_id,
      expiryDate: response.expiry_date,
      message: response.message,
    };
  }

  /**
   * Transfer a domain
   */
  async transferDomain(
    domain: string,
    authCode: string,
    contacts: RegistrationData['contacts']
  ): Promise<any> {
    const response = await this.apiRequest('transfer', {
      domain,
      auth_code: authCode,
      contacts,
    });

    return {
      success: response.success,
      transferId: response.transfer_id,
      status: response.status,
      message: response.message,
    };
  }

  /**
   * Renew a domain
   */
  async renewDomain(domain: string, years: number): Promise<any> {
    const response = await this.apiRequest('renew', {
      domain,
      period: years,
    });

    return {
      success: response.success,
      orderId: response.order_id,
      newExpiryDate: response.expiry_date,
    };
  }

  /**
   * Get domain info
   */
  async getDomainInfo(domain: string): Promise<any> {
    const response = await this.apiRequest('get', {
      domain,
      type: 'all',
    });

    return {
      domain: response.domain,
      status: response.status,
      expiryDate: response.expiry_date,
      nameservers: response.nameservers,
      contacts: response.contacts,
      privacy: response.privacy_enabled,
      locked: response.transfer_lock,
    };
  }

  /**
   * Update nameservers
   */
  async updateNameservers(
    domain: string,
    nameservers: string[]
  ): Promise<any> {
    const response = await this.apiRequest('update_nameservers', {
      domain,
      nameservers,
    });

    return {
      success: response.success,
      nameservers: response.nameservers,
    };
  }

  /**
   * Get/Request EPP code
   */
  async getEppCode(domain: string): Promise<string> {
    const response = await this.apiRequest('get_epp', {
      domain,
    });

    return response.epp_code;
  }

  /**
   * Toggle transfer lock
   */
  async setTransferLock(domain: string, locked: boolean): Promise<any> {
    const response = await this.apiRequest('set_lock', {
      domain,
      locked,
    });

    return {
      success: response.success,
      locked: response.locked,
    };
  }

  /**
   * Toggle WHOIS privacy
   */
  async setPrivacy(domain: string, enabled: boolean): Promise<any> {
    const response = await this.apiRequest('set_privacy', {
      domain,
      enabled,
    });

    return {
      success: response.success,
      privacy: response.privacy_enabled,
    };
  }

  /**
   * Update DNS records (if using OpenSRS nameservers)
   */
  async updateDnsRecords(
    domain: string,
    records: Array<{
      type: string;
      name: string;
      content: string;
      ttl?: number;
      priority?: number;
    }>
  ): Promise<any> {
    const response = await this.apiRequest('update_dns', {
      domain,
      records,
    });

    return {
      success: response.success,
      records: response.records,
    };
  }

  /**
   * Get DNS records
   */
  async getDnsRecords(domain: string): Promise<any[]> {
    const response = await this.apiRequest('get_dns', {
      domain,
    });

    return response.records || [];
  }

  /**
   * Mock response for development
   */
  private mockResponse(action: string, params: any): any {
    console.log(`[OpenSRS Mock] ${action}`, params);

    const mocks: Record<string, any> = {
      lookup: {
        results: params.domains?.map((d: string) => ({
          domain: d,
          tld: d.includes('.') ? '.' + d.split('.').pop() : '.com',
          available: Math.random() > 0.7,
        })),
      },
      register: {
        success: true,
        order_id: `mock-order-${Date.now()}`,
        domain_id: `mock-domain-${Date.now()}`,
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Domain registered successfully',
      },
      transfer: {
        success: true,
        transfer_id: `mock-transfer-${Date.now()}`,
        status: 'pending',
        message: 'Transfer initiated',
      },
      renew: {
        success: true,
        order_id: `mock-order-${Date.now()}`,
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      get: {
        domain: params.domain,
        status: 'active',
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        nameservers: ['ns1.hostsblue.com', 'ns2.hostsblue.com'],
        privacy_enabled: false,
        transfer_lock: true,
      },
      update_nameservers: {
        success: true,
        nameservers: params.nameservers,
      },
      get_epp: {
        epp_code: `MOCK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      },
    };

    return mocks[action] || { success: true };
  }
}
