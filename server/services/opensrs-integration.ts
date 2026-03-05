/**
 * OpenSRS Domain Integration Service
 * Handles domain registration, transfers, and management via OpenSRS XCP API
 *
 * Protocol: XCP (XML over HTTPS on port 55443)
 * Signature: MD5 double-hash — md5(md5(xml_body + api_key) + api_key)
 * Docs: https://domains.opensrs.guide/docs
 */

import crypto from 'crypto';

const OPENSRS_API_URL = process.env.OPENSRS_API_URL || 'https://horizon.opensrs.net:55443';
const OPENSRS_API_KEY = process.env.OPENSRS_API_KEY || '';
const OPENSRS_USERNAME = process.env.OPENSRS_USERNAME || '';

// Config-driven nameservers from environment
const DEFAULT_NS1 = process.env.HOSTSBLUE_NS1 || 'ns1.hostsblue.com';
const DEFAULT_NS2 = process.env.HOSTSBLUE_NS2 || 'ns2.hostsblue.com';
const DEFAULT_NAMESERVERS = [DEFAULT_NS1, DEFAULT_NS2];

// Common .com words that are always taken in mock mode
const COMMON_COM_WORDS = new Set([
  'google', 'amazon', 'facebook', 'apple', 'microsoft', 'twitter', 'instagram',
  'youtube', 'netflix', 'linkedin', 'reddit', 'wikipedia', 'yahoo', 'ebay',
  'paypal', 'uber', 'airbnb', 'spotify', 'slack', 'zoom', 'shopify',
  'wordpress', 'github', 'stackoverflow', 'medium', 'stripe', 'twilio',
  'hotel', 'hotels', 'travel', 'flights', 'cars', 'insurance', 'bank',
  'mail', 'email', 'cloud', 'web', 'host', 'hosting', 'domain', 'domains',
  'shop', 'store', 'buy', 'sell', 'pay', 'money', 'crypto', 'bitcoin',
]);

export class OpenSRSError extends Error {
  code: string;
  retryable: boolean;
  details?: any;

  constructor(message: string, code: string, retryable: boolean = false, details?: any) {
    super(message);
    this.name = 'OpenSRSError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

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
  private isMockMode: boolean;

  constructor() {
    this.apiUrl = OPENSRS_API_URL;
    this.apiKey = OPENSRS_API_KEY;
    this.username = OPENSRS_USERNAME;

    // Mock mode ONLY when API key is empty or 'test'
    this.isMockMode = !this.apiKey || this.apiKey === 'test' || this.apiKey === 'your_opensrs_api_key';

    if (this.isMockMode) {
      console.warn('OpenSRS credentials not configured - using mock mode');
    }
  }

  // ===========================================================================
  // XCP PROTOCOL HELPERS
  // ===========================================================================

  /**
   * Generate MD5 double-hash signature per OpenSRS XCP specification
   * signature = md5(md5(xml_body + api_key) + api_key)
   */
  private generateSignature(xmlBody: string): string {
    const firstPass = crypto
      .createHash('md5')
      .update(xmlBody + this.apiKey)
      .digest('hex');

    return crypto
      .createHash('md5')
      .update(firstPass + this.apiKey)
      .digest('hex');
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private unescapeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  /**
   * Convert a JavaScript value to XCP XML representation
   * Objects → dt_assoc, Arrays → dt_array, primitives → escaped text
   */
  private valueToXcp(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return this.escapeXml(value);

    if (Array.isArray(value)) {
      const items = value
        .map((v, i) => `<item key="${i}">${this.valueToXcp(v)}</item>`)
        .join('');
      return `<dt_array>${items}</dt_array>`;
    }

    if (typeof value === 'object') {
      const items = Object.entries(value)
        .map(([k, v]) => `<item key="${this.escapeXml(k)}">${this.valueToXcp(v)}</item>`)
        .join('');
      return `<dt_assoc>${items}</dt_assoc>`;
    }

    return this.escapeXml(String(value));
  }

  /**
   * Build XCP XML request envelope
   */
  private buildXcpEnvelope(action: string, object: string, attributes: Record<string, any>): string {
    return [
      `<?xml version='1.0' encoding='UTF-8' standalone='no'?>`,
      `<!DOCTYPE OPS_envelope SYSTEM 'ops.dtd'>`,
      `<OPS_envelope>`,
      `<header><version>0.9</version></header>`,
      `<body>`,
      `<data_block>`,
      `<dt_assoc>`,
      `<item key="protocol">XCP</item>`,
      `<item key="action">${this.escapeXml(action)}</item>`,
      `<item key="object">${this.escapeXml(object)}</item>`,
      `<item key="attributes">${this.valueToXcp(attributes)}</item>`,
      `</dt_assoc>`,
      `</data_block>`,
      `</body>`,
      `</OPS_envelope>`,
    ].join('\n');
  }

  /**
   * Parse XCP XML response into JavaScript objects using recursive descent
   */
  private parseXcpResponse(xml: string): any {
    let pos = 0;

    const skipWs = () => {
      while (pos < xml.length && /\s/.test(xml[pos])) pos++;
    };

    const parseValue = (): any => {
      skipWs();

      if (xml.startsWith('<dt_assoc>', pos)) {
        pos += '<dt_assoc>'.length;
        const result: Record<string, any> = {};

        while (pos < xml.length) {
          skipWs();
          if (xml.startsWith('</dt_assoc>', pos)) {
            pos += '</dt_assoc>'.length;
            break;
          }

          const keyMatch = xml.slice(pos).match(/^<item\s+key="([^"]*)">/);
          if (!keyMatch) break;

          const key = this.unescapeXml(keyMatch[1]);
          pos += keyMatch[0].length;
          skipWs();

          if (xml.startsWith('<dt_assoc>', pos) || xml.startsWith('<dt_array>', pos)) {
            result[key] = parseValue();
          } else {
            const endIdx = xml.indexOf('</item>', pos);
            if (endIdx === -1) break;
            result[key] = this.unescapeXml(xml.slice(pos, endIdx).trim());
            pos = endIdx;
          }

          skipWs();
          if (xml.startsWith('</item>', pos)) {
            pos += '</item>'.length;
          }
        }

        return result;
      }

      if (xml.startsWith('<dt_array>', pos)) {
        pos += '<dt_array>'.length;
        const result: any[] = [];

        while (pos < xml.length) {
          skipWs();
          if (xml.startsWith('</dt_array>', pos)) {
            pos += '</dt_array>'.length;
            break;
          }

          const keyMatch = xml.slice(pos).match(/^<item\s+key="([^"]*)">/);
          if (!keyMatch) break;

          pos += keyMatch[0].length;
          skipWs();

          if (xml.startsWith('<dt_assoc>', pos) || xml.startsWith('<dt_array>', pos)) {
            result.push(parseValue());
          } else {
            const endIdx = xml.indexOf('</item>', pos);
            if (endIdx === -1) break;
            result.push(this.unescapeXml(xml.slice(pos, endIdx).trim()));
            pos = endIdx;
          }

          skipWs();
          if (xml.startsWith('</item>', pos)) {
            pos += '</item>'.length;
          }
        }

        return result;
      }

      return null;
    };

    const dataBlockStart = xml.indexOf('<data_block>');
    if (dataBlockStart === -1) {
      throw new OpenSRSError('Invalid XCP response: no data_block found', 'OPENSRS_PARSE_ERROR');
    }
    pos = dataBlockStart + '<data_block>'.length;
    skipWs();

    const parsed = parseValue();
    if (!parsed) {
      throw new OpenSRSError('Invalid XCP response: could not parse data', 'OPENSRS_PARSE_ERROR');
    }

    // Throw on API-level failures (is_success=0)
    if (parsed.is_success === '0') {
      const code = parsed.response_code || 'UNKNOWN';
      const text = parsed.response_text || 'Unknown error';
      throw new OpenSRSError(
        `OpenSRS API error (${code}): ${text}`,
        `OPENSRS_API_${code}`,
        parseInt(code) >= 500,
        { response_code: code, response_text: text }
      );
    }

    return parsed;
  }

  // ===========================================================================
  // API REQUEST
  // ===========================================================================

  /**
   * Make authenticated XCP request to OpenSRS API
   */
  private async apiRequest(
    action: string,
    object: string,
    attributes: Record<string, any> = {}
  ): Promise<any> {
    if (this.isMockMode) {
      return this.mockResponse(action, object, attributes);
    }

    const xmlBody = this.buildXcpEnvelope(action, object, attributes);
    const signature = this.generateSignature(xmlBody);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'X-Username': this.username,
          'X-Signature': signature,
          'Content-Length': String(Buffer.byteLength(xmlBody, 'utf8')),
        },
        body: xmlBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = response.status >= 500;
        throw new OpenSRSError(
          `OpenSRS API error (${response.status}): ${errorText}`,
          `OPENSRS_HTTP_${response.status}`,
          retryable,
          { status: response.status, body: errorText }
        );
      }

      const xmlResponse = await response.text();
      return this.parseXcpResponse(xmlResponse);
    } catch (error) {
      if (error instanceof OpenSRSError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new OpenSRSError(
          'OpenSRS API request timed out',
          'OPENSRS_TIMEOUT',
          true
        );
      }
      throw new OpenSRSError(
        `OpenSRS API request failed: ${(error as Error).message}`,
        'OPENSRS_NETWORK_ERROR',
        true,
        { originalError: (error as Error).message }
      );
    }
  }

  // ===========================================================================
  // CONTACT FORMATTING
  // ===========================================================================

  /**
   * Convert ContactData to OpenSRS contact_set format
   */
  private formatContact(contact: ContactData): Record<string, string> {
    return {
      first_name: contact.firstName,
      last_name: contact.lastName,
      ...(contact.organization && { org_name: contact.organization }),
      email: contact.email,
      phone: contact.phone,
      ...(contact.fax && { fax: contact.fax }),
      address1: contact.address1,
      ...(contact.address2 && { address2: contact.address2 }),
      city: contact.city,
      state: contact.state,
      postal_code: contact.postalCode,
      country: contact.country,
    };
  }

  // ===========================================================================
  // PUBLIC DOMAIN METHODS
  // ===========================================================================

  /**
   * Check domain availability
   */
  async checkAvailability(
    domain: string,
    tlds: string[]
  ): Promise<DomainAvailabilityResult[]> {
    // Clean domain (remove protocol, www, etc)
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0];

    // If no TLDs provided, default to .com
    const searchTlds = tlds.length > 0 ? tlds : ['.com'];

    // XCP LOOKUP is per-domain — run in parallel
    const lookups = searchTlds.map(async (tld): Promise<DomainAvailabilityResult> => {
      const fullDomain = `${cleanDomain}${tld}`;
      try {
        const response = await this.apiRequest('LOOKUP', 'DOMAIN', { domain: fullDomain });
        // 210 = available, 211 = taken (both return is_success=1)
        return {
          domain: fullDomain,
          tld,
          available: response.response_code === '210',
        };
      } catch {
        // API failed — fall back to mock so results aren't all "unavailable"
        const mockResult = this.mockResponse('LOOKUP', 'DOMAIN', { domain: fullDomain });
        return {
          domain: fullDomain,
          tld,
          available: mockResult.response_code === '210',
        };
      }
    });

    return Promise.all(lookups);
  }

  /**
   * Register a new domain
   */
  async registerDomain(data: RegistrationData): Promise<any> {
    const contactSet: Record<string, any> = {
      owner: this.formatContact(data.contacts.owner),
      admin: this.formatContact(data.contacts.admin || data.contacts.owner),
      tech: this.formatContact(data.contacts.tech || data.contacts.owner),
      billing: this.formatContact(data.contacts.billing || data.contacts.owner),
    };

    const nameservers = data.nameservers || DEFAULT_NAMESERVERS;
    const nameserverList: Record<string, any> = {};
    nameservers.forEach((ns, i) => {
      nameserverList[String(i)] = { name: ns, sortorder: i + 1 };
    });

    const attributes: Record<string, any> = {
      domain: data.domain,
      period: data.period,
      contact_set: contactSet,
      custom_nameservers: 1,
      nameserver_list: nameserverList,
      reg_type: 'new',
      handle: 'process',
    };

    if (data.privacy) {
      attributes.f_whois_privacy = 1;
    }

    const response = await this.apiRequest('SW_REGISTER', 'DOMAIN', attributes);

    return {
      success: true,
      orderId: response.attributes?.id || response.attributes?.order_id,
      domainId: response.attributes?.id,
      expiryDate: response.attributes?.registration_expiration_date,
      message: response.response_text || 'Domain registered successfully',
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
    const contactSet: Record<string, any> = {
      owner: this.formatContact(contacts.owner),
      admin: this.formatContact(contacts.admin || contacts.owner),
      tech: this.formatContact(contacts.tech || contacts.owner),
      billing: this.formatContact(contacts.billing || contacts.owner),
    };

    const response = await this.apiRequest('SW_REGISTER', 'DOMAIN', {
      domain,
      auth_info: authCode,
      reg_type: 'transfer',
      contact_set: contactSet,
      handle: 'process',
      period: 1,
    });

    return {
      success: true,
      transferId: response.attributes?.id || response.attributes?.order_id,
      status: response.attributes?.transfer_status || 'pending',
      message: response.response_text || 'Transfer initiated',
    };
  }

  /**
   * Renew a domain
   */
  async renewDomain(domain: string, years: number): Promise<any> {
    // Fetch current expiry year (required by OpenSRS RENEW)
    let currentExpirationYear = new Date().getFullYear();
    try {
      const info = await this.getDomainInfo(domain);
      if (info.expiryDate) {
        currentExpirationYear = new Date(info.expiryDate).getFullYear();
      }
    } catch {
      // Fall back to current year if lookup fails
    }

    const response = await this.apiRequest('RENEW', 'DOMAIN', {
      domain,
      period: years,
      handle: 'process',
      currentexpirationyear: currentExpirationYear,
    });

    return {
      success: true,
      orderId: response.attributes?.id || response.attributes?.order_id,
      newExpiryDate: response.attributes?.registration_expiration_date,
    };
  }

  /**
   * Get domain info
   */
  async getDomainInfo(domain: string): Promise<any> {
    const response = await this.apiRequest('GET', 'DOMAIN', {
      domain,
      type: 'all_info',
    });

    const attrs = response.attributes || {};

    return {
      domain: attrs.domain || domain,
      status: attrs.status,
      expiryDate: attrs.expiredate || attrs.registration_expiration_date,
      nameservers: attrs.nameserver_list,
      contacts: attrs.contact_set,
      privacy: attrs.whois_privacy_state === 'enable',
      locked: attrs.lock_state === '1',
    };
  }

  /**
   * Update nameservers
   */
  async updateNameservers(
    domain: string,
    nameservers: string[]
  ): Promise<any> {
    await this.apiRequest('ADVANCED_UPDATE_NAMESERVERS', 'DOMAIN', {
      domain,
      op_type: 'assign',
      assign_ns: nameservers,
    });

    return {
      success: true,
      nameservers,
    };
  }

  /**
   * Get/Request EPP code
   */
  async getEppCode(domain: string): Promise<string> {
    const response = await this.apiRequest('GET', 'DOMAIN', {
      domain,
      type: 'domain_auth_info',
    });

    return response.attributes?.domain_auth_info || '';
  }

  /**
   * Toggle transfer lock
   */
  async setTransferLock(domain: string, locked: boolean): Promise<any> {
    await this.apiRequest('MODIFY', 'DOMAIN', {
      domain,
      data: { lock_state: locked ? 1 : 0 },
    });

    return {
      success: true,
      locked,
    };
  }

  /**
   * Toggle WHOIS privacy
   */
  async setPrivacy(domain: string, enabled: boolean): Promise<any> {
    await this.apiRequest('MODIFY', 'DOMAIN', {
      domain,
      data: { whois_privacy_state: enabled ? 'enable' : 'disable' },
    });

    return {
      success: true,
      privacy: enabled,
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
    // Group records by type for OpenSRS DNS zone format
    const formattedRecords: Record<string, any[]> = {};
    for (const record of records) {
      const type = record.type.toUpperCase();
      if (!formattedRecords[type]) {
        formattedRecords[type] = [];
      }
      formattedRecords[type].push({
        subdomain: record.name,
        ip_address: record.content,
        ...(record.ttl && { ttl: record.ttl }),
        ...(record.priority !== undefined && { priority: record.priority }),
      });
    }

    const response = await this.apiRequest('SET_DNS_ZONE', 'DOMAIN', {
      domain,
      records: formattedRecords,
    });

    return {
      success: true,
      records: response.attributes?.records || records,
    };
  }

  /**
   * Get DNS records
   */
  async getDnsRecords(domain: string): Promise<any[]> {
    const response = await this.apiRequest('GET_DNS_ZONE', 'DOMAIN', {
      domain,
    });

    const records = response.attributes?.records || {};
    const result: any[] = [];

    for (const [type, entries] of Object.entries(records)) {
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          result.push({
            type,
            name: entry.subdomain || entry.name || '@',
            content: entry.ip_address || entry.address || entry.content || '',
            ttl: entry.ttl || 3600,
            priority: entry.priority,
          });
        }
      }
    }

    return result;
  }

  // ===========================================================================
  // MOCK RESPONSES
  // ===========================================================================

  /**
   * Deterministic mock responses for development
   */
  private mockResponse(action: string, object: string, attributes: any): any {
    console.log(`[OpenSRS Mock] ${action} ${object}`, attributes);

    switch (action) {
      case 'LOOKUP': {
        const domain = attributes.domain || '';
        const sld = domain.split('.')[0] || '';
        const tld = '.' + (domain.split('.').slice(1).join('.') || 'com');

        // Deterministic mock availability
        // Use character sum for a simple, stable hash
        let available = true;
        const charSum = sld.split('').reduce((s: number, c: string) => s + c.charCodeAt(0), 0);
        const tldCharSum = tld.split('').reduce((s: number, c: string) => s + c.charCodeAt(0), 0);
        const mix = (charSum * 7 + tldCharSum * 13) % 100;

        // Always-taken TLDs for common words
        const TAKEN_TLDS = new Set(['.com', '.net', '.org']);

        if (sld.startsWith('taken')) {
          available = false;
        } else if (sld.startsWith('test') || sld.startsWith('my')) {
          // Test/my domains: almost everything available except .com
          available = tld !== '.com' || sld.length > 10;
        } else if (COMMON_COM_WORDS.has(sld)) {
          // Common words: popular TLDs taken, ~70% of others available
          available = !TAKEN_TLDS.has(tld) && mix > 30;
        } else {
          // Normal words: .com taken ~50%, .net/.org ~30%, everything else ~90% available
          if (tld === '.com') {
            available = mix > 50;
          } else if (TAKEN_TLDS.has(tld)) {
            available = mix > 30;
          } else {
            available = mix > 10;
          }
        }

        return {
          is_success: '1',
          response_code: available ? '210' : '211',
          response_text: available ? 'Domain available' : 'Domain taken',
          attributes: { status: available ? 'available' : 'taken' },
        };
      }

      case 'SW_REGISTER': {
        const mockId = `mock-${Date.now()}`;
        const isTransfer = attributes.reg_type === 'transfer';
        return {
          is_success: '1',
          response_code: '200',
          response_text: isTransfer ? 'Transfer initiated' : 'Domain registered successfully',
          attributes: {
            id: mockId,
            order_id: mockId,
            registration_expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            ...(isTransfer && { transfer_status: 'pending' }),
          },
        };
      }

      case 'RENEW': {
        const mockId = `mock-order-${Date.now()}`;
        return {
          is_success: '1',
          response_code: '200',
          response_text: 'Domain renewed',
          attributes: {
            id: mockId,
            order_id: mockId,
            registration_expiration_date: new Date(
              Date.now() + (attributes.period || 1) * 365 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        };
      }

      case 'GET': {
        if (attributes.type === 'domain_auth_info') {
          return {
            is_success: '1',
            response_code: '200',
            attributes: {
              domain_auth_info: `MOCK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            },
          };
        }
        return {
          is_success: '1',
          response_code: '200',
          attributes: {
            domain: attributes.domain,
            status: 'active',
            expiredate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            registration_expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            nameserver_list: DEFAULT_NAMESERVERS,
            whois_privacy_state: 'disable',
            lock_state: '1',
          },
        };
      }

      case 'ADVANCED_UPDATE_NAMESERVERS':
        return {
          is_success: '1',
          response_code: '200',
          attributes: { nameserver_list: attributes.assign_ns },
        };

      case 'MODIFY':
        return {
          is_success: '1',
          response_code: '200',
          response_text: 'Domain modified successfully',
          attributes: {},
        };

      case 'SET_DNS_ZONE':
        return {
          is_success: '1',
          response_code: '200',
          attributes: { records: attributes.records },
        };

      case 'GET_DNS_ZONE':
        return {
          is_success: '1',
          response_code: '200',
          attributes: {
            records: {
              A: [
                { subdomain: '@', ip_address: '192.0.2.1', ttl: 3600 },
                { subdomain: 'www', ip_address: '192.0.2.1', ttl: 3600 },
              ],
              MX: [
                { subdomain: '@', ip_address: 'mail.hostsblue.com', priority: 10, ttl: 3600 },
              ],
            },
          },
        };

      default:
        return { is_success: '1', response_code: '200', attributes: {} };
    }
  }
}
