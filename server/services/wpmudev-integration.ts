/**
 * WPMUDEV Hosting Integration Service
 * Handles WordPress site provisioning and management via WPMUDEV API
 */

import crypto from 'crypto';

const WPMUDEV_API_URL = process.env.WPMUDEV_API_URL || 'https://premium.wpmudev.org/api';
const WPMUDEV_API_KEY = process.env.WPMUDEV_API_KEY || '';
const CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || '';

export class WPMUDevError extends Error {
  code: string;
  retryable: boolean;

  constructor(message: string, code: string, retryable: boolean = false) {
    super(message);
    this.name = 'WPMUDevError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Encrypt a credential string using AES-256-GCM
 */
function encryptCredential(plaintext: string): string {
  if (!CREDENTIAL_ENCRYPTION_KEY) {
    console.warn('CREDENTIAL_ENCRYPTION_KEY not set - storing credentials in base64 only (NOT SECURE)');
    return Buffer.from(plaintext).toString('base64');
  }

  const key = Buffer.from(CREDENTIAL_ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new WPMUDevError(
      'CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (64 hex characters)',
      'ENCRYPTION_CONFIG_ERROR'
    );
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a credential string encrypted with AES-256-GCM
 */
export function decryptCredential(encrypted: string): string {
  if (!CREDENTIAL_ENCRYPTION_KEY) {
    // Fallback: assume base64 if no key configured
    return Buffer.from(encrypted, 'base64').toString('utf8');
  }

  const key = Buffer.from(CREDENTIAL_ENCRYPTION_KEY, 'hex');
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new WPMUDevError('Invalid encrypted credential format', 'DECRYPTION_ERROR');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

interface SiteProvisioningData {
  siteName: string;
  domain: string;
  planId: string;
  adminEmail: string;
  adminUsername?: string;
  adminPassword?: string;
  options?: {
    installPlugins?: string[];
    theme?: string;
    multisite?: boolean;
    ssl?: boolean;
  };
}

interface SiteStats {
  storageUsed: number;
  bandwidthUsed: number;
  visitors: number;
  lastBackup: Date;
}

export class WPMUDevIntegration {
  private apiUrl: string;
  private apiKey: string;
  private isMockMode: boolean;

  constructor() {
    this.apiUrl = WPMUDEV_API_URL;
    this.apiKey = WPMUDEV_API_KEY;

    this.isMockMode = !this.apiKey || this.apiKey === 'test' || this.apiKey === 'your_wpmudev_api_key';

    if (this.isMockMode) {
      console.warn('WPMUDEV API key not configured - using mock mode');
    }
  }

  /**
   * Make authenticated request to WPMUDEV API
   */
  private async apiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;

    // Mock mode for development
    if (this.isMockMode) {
      return this.mockResponse(endpoint, method, body);
    }

    // Request timeout via AbortController (15s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
        throw new WPMUDevError(
          `WPMUDEV API error (${response.status}): ${errorText}`,
          `WPMUDEV_HTTP_${response.status}`,
          retryable
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof WPMUDevError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new WPMUDevError(
          'WPMUDEV API request timed out',
          'WPMUDEV_TIMEOUT',
          true
        );
      }
      throw new WPMUDevError(
        `WPMUDEV API request failed: ${(error as Error).message}`,
        'WPMUDEV_NETWORK_ERROR',
        true
      );
    }
  }

  /**
   * Get available hosting plans
   */
  async getPlans(): Promise<any[]> {
    const response = await this.apiRequest('/hosting/v1/plans');
    return response.plans || [];
  }

  /**
   * Provision a new WordPress site
   */
  async provisionSite(data: SiteProvisioningData): Promise<any> {
    const generatedPassword = data.adminPassword || this.generatePassword();

    const payload = {
      name: data.siteName,
      domain: data.domain,
      plan_id: data.planId,
      admin_email: data.adminEmail,
      admin_username: data.adminUsername || this.generateUsername(data.adminEmail),
      admin_password: generatedPassword,
      ...data.options,
    };

    const response = await this.apiRequest('/hosting/v1/sites', 'POST', payload);

    // Encrypt the password before returning
    const encryptedPassword = encryptCredential(generatedPassword);

    return {
      success: true,
      siteId: response.id,
      blogId: response.blog_id,
      hostingId: response.hosting_id,
      domain: response.domain,
      sftp: {
        host: response.sftp?.host,
        username: response.sftp?.username,
        port: response.sftp?.port || 22,
      },
      wpAdmin: {
        url: `https://${response.domain}/wp-admin`,
        username: payload.admin_username,
        encryptedPassword,
      },
      tempUrl: response.temp_url,
    };
  }

  /**
   * Get site details
   */
  async getSite(siteId: string): Promise<any> {
    const response = await this.apiRequest(`/hosting/v1/sites/${siteId}`);

    return {
      id: response.id,
      blogId: response.blog_id,
      name: response.name,
      domain: response.domain,
      status: response.status,
      plan: response.plan,
      createdAt: response.created_at,
      sftp: response.sftp,
      stats: response.stats,
    };
  }

  /**
   * Update site settings
   */
  async updateSite(
    siteId: string,
    updates: {
      name?: string;
      domain?: string;
      planId?: string;
      phpVersion?: string;
    }
  ): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}`,
      'PUT',
      updates
    );

    return {
      success: true,
      site: response,
    };
  }

  /**
   * Delete a site
   */
  async deleteSite(siteId: string): Promise<any> {
    await this.apiRequest(`/hosting/v1/sites/${siteId}`, 'DELETE');

    return {
      success: true,
      message: 'Site deleted successfully',
    };
  }

  /**
   * Get site stats
   */
  async getSiteStats(siteId: string): Promise<SiteStats> {
    const response = await this.apiRequest(`/hosting/v1/sites/${siteId}/stats`);

    return {
      storageUsed: response.storage_used || 0,
      bandwidthUsed: response.bandwidth_used || 0,
      visitors: response.visitors || 0,
      lastBackup: response.last_backup ? new Date(response.last_backup) : new Date(),
    };
  }

  /**
   * Request SSL certificate
   */
  async provisionSSL(siteId: string, domain: string): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/ssl`,
      'POST',
      { domain }
    );

    return {
      success: true,
      certificateId: response.certificate_id,
      status: response.status,
      expiresAt: response.expires_at,
    };
  }

  /**
   * Get SSL status
   */
  async getSSLStatus(siteId: string): Promise<any> {
    const response = await this.apiRequest(`/hosting/v1/sites/${siteId}/ssl`);

    return {
      active: response.active,
      certificateId: response.certificate_id,
      domain: response.domain,
      issuedAt: response.issued_at,
      expiresAt: response.expires_at,
      issuer: response.issuer,
    };
  }

  /**
   * Create a backup
   */
  async createBackup(siteId: string): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/backups`,
      'POST'
    );

    return {
      success: true,
      backupId: response.id,
      status: response.status,
      createdAt: response.created_at,
    };
  }

  /**
   * List backups
   */
  async listBackups(siteId: string): Promise<any[]> {
    const response = await this.apiRequest(`/hosting/v1/sites/${siteId}/backups`);
    return response.backups || [];
  }

  /**
   * Restore from backup
   */
  async restoreBackup(siteId: string, backupId: string): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/backups/${backupId}/restore`,
      'POST'
    );

    return {
      success: true,
      restoreId: response.restore_id,
      status: response.status,
    };
  }

  /**
   * Get SFTP credentials
   */
  async getSftpCredentials(siteId: string): Promise<any> {
    const response = await this.apiRequest(`/hosting/v1/sites/${siteId}/sftp`);

    return {
      host: response.host,
      port: response.port || 22,
      username: response.username,
      password: response.password,
    };
  }

  /**
   * Reset SFTP password
   */
  async resetSftpPassword(siteId: string): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/sftp/reset`,
      'POST'
    );

    return {
      success: true,
      username: response.username,
      password: response.password,
    };
  }

  /**
   * Get database credentials
   */
  async getDatabaseCredentials(siteId: string): Promise<any> {
    const response = await this.apiRequest(`/hosting/v1/sites/${siteId}/database`);

    return {
      host: response.host,
      port: response.port || 3306,
      database: response.database,
      username: response.username,
      password: response.password,
    };
  }

  /**
   * Clear cache
   */
  async clearCache(siteId: string): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/cache`,
      'DELETE'
    );

    return {
      success: true,
      message: response.message,
    };
  }

  /**
   * Toggle staging mode
   */
  async toggleStaging(siteId: string, enable: boolean): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/staging`,
      enable ? 'POST' : 'DELETE',
      enable ? {} : undefined
    );

    return {
      success: true,
      enabled: enable,
      stagingUrl: response.staging_url,
    };
  }

  /**
   * Sync staging to production
   */
  async syncStagingToProduction(siteId: string): Promise<any> {
    const response = await this.apiRequest(
      `/hosting/v1/sites/${siteId}/staging/sync`,
      'POST',
      { direction: 'to_production' }
    );

    return {
      success: true,
      syncId: response.sync_id,
      status: response.status,
    };
  }

  /**
   * Generate a random username
   */
  private generateUsername(email: string): string {
    const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const random = crypto.randomBytes(3).toString('hex');
    return `${base}_${random}`;
  }

  /**
   * Generate a secure random password using crypto.randomBytes
   */
  private generatePassword(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  /**
   * Mock response for development
   */
  private mockResponse(endpoint: string, method: string, body?: any): any {
    console.log(`[WPMUDEV Mock] ${method} ${endpoint}`, body);

    const mockSiteId = `mock-site-${Date.now()}`;
    const mockBlogId = Math.floor(Math.random() * 1000000);
    const mockHostingId = `mock-hosting-${Date.now()}`;

    if (endpoint === '/hosting/v1/plans') {
      return {
        plans: [
          {
            id: 'starter',
            name: 'Starter',
            price: 999,
            storage: 5,
            bandwidth: 25000,
          },
          {
            id: 'pro',
            name: 'Pro',
            price: 2499,
            storage: 20,
            bandwidth: 100000,
          },
        ],
      };
    }

    if (endpoint.includes('/sites') && method === 'POST') {
      return {
        id: mockSiteId,
        blog_id: mockBlogId,
        hosting_id: mockHostingId,
        name: body?.name,
        domain: body?.domain || `${mockSiteId}.temp.hostsblue.com`,
        status: 'provisioning',
        temp_url: `https://${mockSiteId}.temp.hostsblue.com`,
        sftp: {
          host: `sftp.hostsblue.com`,
          username: `user_${mockBlogId}`,
          port: 22,
        },
      };
    }

    if (endpoint.includes('/sites/') && method === 'GET') {
      return {
        id: mockSiteId,
        blog_id: mockBlogId,
        name: 'My WordPress Site',
        domain: 'example.com',
        status: 'active',
        plan: { id: 'pro', name: 'Pro' },
        created_at: new Date().toISOString(),
        sftp: {
          host: 'sftp.hostsblue.com',
          username: `user_${mockBlogId}`,
          port: 22,
        },
        stats: {
          storage_used: 1024,
          bandwidth_used: 5120,
        },
      };
    }

    if (endpoint.includes('/ssl') && method === 'POST') {
      return {
        certificate_id: `cert-${Date.now()}`,
        status: 'provisioning',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (endpoint.includes('/backups') && method === 'POST') {
      return {
        id: `backup-${Date.now()}`,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      };
    }

    return { success: true };
  }
}
