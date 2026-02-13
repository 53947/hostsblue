/**
 * WPMUDEV Hosting Integration Service
 * Handles WordPress site provisioning and management via WPMUDEV API
 */

const WPMUDEV_API_URL = process.env.WPMUDEV_API_URL || 'https://premium.wpmudev.org/api';
const WPMUDEV_API_KEY = process.env.WPMUDEV_API_KEY || '';

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

  constructor() {
    this.apiUrl = WPMUDEV_API_URL;
    this.apiKey = WPMUDEV_API_KEY;

    if (!this.apiKey) {
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
    if (!this.apiKey || this.apiKey === 'your_wpmudev_api_key') {
      return this.mockResponse(endpoint, method, body);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WPMUDEV API error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('WPMUDEV API request failed:', error);
      throw error;
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
    const payload = {
      name: data.siteName,
      domain: data.domain,
      plan_id: data.planId,
      admin_email: data.adminEmail,
      admin_username: data.adminUsername || this.generateUsername(data.adminEmail),
      admin_password: data.adminPassword || this.generatePassword(),
      ...data.options,
    };

    const response = await this.apiRequest('/hosting/v1/sites', 'POST', payload);

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
        password: payload.admin_password,
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
    const random = Math.random().toString(36).substring(2, 6);
    return `${base}_${random}`;
  }

  /**
   * Generate a secure random password
   */
  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
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
