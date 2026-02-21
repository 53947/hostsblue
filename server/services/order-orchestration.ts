/**
 * Order Orchestration Service
 * Coordinates domain registration and hosting provisioning after payment
 * Handles success, failure, and refund scenarios
 */

import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Resend } from 'resend';
import * as schema from '../../shared/schema.js';
import { OpenSRSIntegration } from './opensrs-integration.js';
import { WPMUDevIntegration } from './wpmudev-integration.js';
import { OpenSRSEmailIntegration } from './opensrs-email-integration.js';
import { OpenSRSSSLIntegration } from './opensrs-ssl-integration.js';
import { SiteLockIntegration } from './sitelock-integration.js';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class OrderOrchestrator {
  private db: NodePgDatabase<typeof schema>;
  private openSRS: OpenSRSIntegration;
  private wpmudev: WPMUDevIntegration;
  private opensrsEmail: OpenSRSEmailIntegration;
  private opensrsSSL: OpenSRSSSLIntegration;
  private sitelock: SiteLockIntegration;

  constructor(
    db: NodePgDatabase<typeof schema>,
    openSRS: OpenSRSIntegration,
    wpmudev: WPMUDevIntegration,
    opensrsEmail: OpenSRSEmailIntegration,
    opensrsSSL: OpenSRSSSLIntegration,
    sitelockService: SiteLockIntegration
  ) {
    this.db = db;
    this.openSRS = openSRS;
    this.wpmudev = wpmudev;
    this.opensrsEmail = opensrsEmail;
    this.opensrsSSL = opensrsSSL;
    this.sitelock = sitelockService;
  }

  /**
   * Handle successful payment webhook
   * This is the main orchestration flow
   */
  async handlePaymentSuccess(
    orderId: number | string,
    paymentData: any
  ): Promise<void> {
    const numericOrderId = typeof orderId === 'string' ? parseInt(orderId) : orderId;

    console.log(`[Orchestrator] Processing payment success for order ${orderId}`);

    // Start a transaction for data consistency
    await this.db.transaction(async (tx) => {
      // 1. Get order with items
      const order = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, numericOrderId),
        with: {
          items: true,
          customer: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status === 'completed') {
        console.log(`[Orchestrator] Order ${orderId} already completed`);
        return;
      }

      // 2. Update order status
      await tx.update(schema.orders)
        .set({
          status: 'processing',
          paymentStatus: 'completed',
          paidAt: new Date(),
          paymentReference: paymentData.payment_id || paymentData.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, numericOrderId));

      // 3. Record payment
      await tx.insert(schema.payments).values({
        orderId: numericOrderId,
        customerId: order.customerId,
        amount: order.total,
        currency: order.currency,
        status: 'completed',
        gateway: 'swipesblue',
        gatewayTransactionId: paymentData.payment_id || paymentData.id,
        gatewayResponse: paymentData,
        processedAt: new Date(),
      });

      // 4. Process each order item
      const results = await Promise.allSettled(
        order.items.map((item: schema.OrderItem) => this.processOrderItem(tx, item, order.customer as schema.Customer))
      );

      // 5. Check for failures
      const failures = results
        .map((r: PromiseSettledResult<any>, i: number) => ({ result: r, item: order.items[i] }))
        .filter(({ result }: { result: PromiseSettledResult<any> }) => result.status === 'rejected');

      if (failures.length > 0) {
        console.error(`[Orchestrator] Some items failed for order ${orderId}:`, failures);

        // Update order to partial failure or failed
        await tx.update(schema.orders)
          .set({
            status: failures.length === order.items.length ? 'failed' : 'partial_failure',
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, numericOrderId));

        // Log failures for admin notification
        for (const { item, result } of failures) {
          await tx.insert(schema.auditLogs).values({
            customerId: order.customerId,
            action: 'order_item.failed',
            entityType: 'order_item',
            entityId: String(item.id),
            description: `Order item ${item.id} failed to provision`,
            metadata: {
              orderId: numericOrderId,
              error: result.status === 'rejected' ? result.reason : null,
            },
          });
        }
      } else {
        // All items successful
        await tx.update(schema.orders)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, numericOrderId));

        // Send confirmation email (async, don't wait)
        this.sendOrderConfirmation(order).catch(err => {
          console.error(`[Orchestrator] Failed to send confirmation email for order ${order.id}:`, err);
        });
      }

      // 6. Log success
      await tx.insert(schema.auditLogs).values({
        customerId: order.customerId,
        action: 'order.payment_success',
        entityType: 'order',
        entityId: String(order.id),
        description: `Payment received and order processed`,
        metadata: {
          amount: order.total,
          paymentId: paymentData.payment_id || paymentData.id,
          failures: failures.length,
        },
      });
    });

    console.log(`[Orchestrator] Completed processing order ${orderId}`);
  }

  /**
   * Process a single order item
   */
  private async processOrderItem(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<{ success: boolean; data?: any }> {
    console.log(`[Orchestrator] Processing item ${item.id} (${item.itemType})`);

    // Update item status to processing
    await tx.update(schema.orderItems)
      .set({ status: 'processing' })
      .where(eq(schema.orderItems.id, item.id));

    try {
      let result: any;

      switch (item.itemType) {
        case 'domain_registration':
          result = await this.provisionDomain(tx, item, customer);
          break;

        case 'domain_transfer':
          result = await this.initiateDomainTransfer(tx, item, customer);
          break;

        case 'hosting_plan':
          result = await this.provisionHosting(tx, item, customer);
          break;

        case 'privacy_protection':
          result = await this.enablePrivacy(tx, item);
          break;

        case 'domain_renewal':
          result = await this.renewDomainItem(tx, item, customer);
          break;

        case 'email_service':
          result = await this.provisionEmail(tx, item, customer);
          break;

        case 'ssl_certificate':
          result = await this.orderSSL(tx, item, customer);
          break;

        case 'sitelock':
          result = await this.provisionSiteLock(tx, item, customer);
          break;

        default:
          throw new Error(`Unknown item type: ${item.itemType}`);
      }

      // Mark item as completed
      await tx.update(schema.orderItems)
        .set({
          status: 'completed',
          fulfilledAt: new Date(),
          externalReference: result?.externalId,
        })
        .where(eq(schema.orderItems.id, item.id));

      return { success: true, data: result };
    } catch (error: any) {
      console.error(`[Orchestrator] Failed to process item ${item.id}:`, error);

      // Update item with error
      await tx.update(schema.orderItems)
        .set({
          status: 'failed',
          errorMessage: error.message,
          retryCount: (item.retryCount ?? 0) + 1,
        })
        .where(eq(schema.orderItems.id, item.id));

      throw error;
    }
  }

  /**
   * Provision a new domain registration
   */
  private async provisionDomain(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;
    const domainName = `${config.domain}${config.tld}`;

    // Get or create contact - throw error if customer profile is incomplete
    let contact = await tx.query.domainContacts.findFirst({
      where: eq(schema.domainContacts.customerId, customer.id),
    });

    if (!contact) {
      // Validate that customer has the required contact fields
      if (!customer.firstName || !customer.lastName) {
        throw new Error('Customer profile incomplete: first name and last name are required for domain registration');
      }
      if (!customer.phone) {
        throw new Error('Customer profile incomplete: phone number is required for domain registration');
      }
      if (!customer.address1) {
        throw new Error('Customer profile incomplete: address is required for domain registration');
      }
      if (!customer.city) {
        throw new Error('Customer profile incomplete: city is required for domain registration');
      }
      if (!customer.state) {
        throw new Error('Customer profile incomplete: state/province is required for domain registration');
      }
      if (!customer.postalCode) {
        throw new Error('Customer profile incomplete: postal code is required for domain registration');
      }

      // Create contact from customer info (all fields verified above)
      const [newContact] = await tx.insert(schema.domainContacts).values({
        customerId: customer.id,
        contactType: 'owner',
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        address1: customer.address1,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        countryCode: customer.countryCode || 'US',
      }).returning();
      contact = newContact;
    }

    // Register with OpenSRS
    const registrationResult = await this.openSRS.registerDomain({
      domain: domainName,
      period: Math.ceil((item.termMonths ?? 12) / 12),
      contacts: {
        owner: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          organization: contact.companyName || undefined,
          email: contact.email,
          phone: contact.phone,
          address1: contact.address1,
          address2: contact.address2 || undefined,
          city: contact.city,
          state: contact.state,
          postalCode: contact.postalCode,
          country: contact.countryCode,
        },
      },
      nameservers: [
        process.env.HOSTSBLUE_NS1 || 'ns1.hostsblue.com',
        process.env.HOSTSBLUE_NS2 || 'ns2.hostsblue.com',
      ],
      privacy: config.privacy || false,
    });

    if (!registrationResult.success) {
      throw new Error(`Domain registration failed: ${registrationResult.message}`);
    }

    // Create domain record
    const [domain] = await tx.insert(schema.domains).values({
      customerId: customer.id,
      domainName,
      tld: config.tld,
      status: 'active',
      registrationDate: new Date(),
      expiryDate: new Date(Date.now() + (item.termMonths ?? 12) * 30 * 24 * 60 * 60 * 1000),
      registrationPeriodYears: Math.ceil((item.termMonths ?? 12) / 12),
      autoRenew: true,
      privacyEnabled: config.privacy || false,
      ownerContactId: contact.id,
      nameservers: [
        process.env.HOSTSBLUE_NS1 || 'ns1.hostsblue.com',
        process.env.HOSTSBLUE_NS2 || 'ns2.hostsblue.com',
      ],
      useHostsBlueNameservers: true,
      opensrsOrderId: registrationResult.orderId,
      opensrsDomainId: registrationResult.domainId,
    }).returning();

    // Update order item with domain reference
    await tx.update(schema.orderItems)
      .set({ domainId: domain.id })
      .where(eq(schema.orderItems.id, item.id));

    return {
      externalId: registrationResult.domainId,
      domainId: domain.id,
    };
  }

  /**
   * Initiate domain transfer
   */
  private async initiateDomainTransfer(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;
    const domainName = `${config.domain}${config.tld}`;

    // Get contact
    const contact = await tx.query.domainContacts.findFirst({
      where: eq(schema.domainContacts.customerId, customer.id),
    });

    if (!contact) {
      throw new Error('Domain contact required for transfer');
    }

    // Initiate transfer with OpenSRS
    const transferResult = await this.openSRS.transferDomain(
      domainName,
      config.authCode,
      {
        owner: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          organization: contact.companyName || undefined,
          email: contact.email,
          phone: contact.phone,
          address1: contact.address1,
          city: contact.city,
          state: contact.state,
          postalCode: contact.postalCode,
          country: contact.countryCode,
        },
      }
    );

    if (!transferResult.success) {
      throw new Error(`Domain transfer failed: ${transferResult.message}`);
    }

    // Create domain record with pending_transfer status
    const [domain] = await tx.insert(schema.domains).values({
      customerId: customer.id,
      domainName,
      tld: config.tld,
      status: 'pending_transfer',
      isTransfer: true,
      transferAuthCode: config.authCode,
      transferStatus: transferResult.status,
      autoRenew: true,
      ownerContactId: contact.id,
      opensrsOrderId: transferResult.transferId,
    }).returning();

    await tx.update(schema.orderItems)
      .set({ domainId: domain.id })
      .where(eq(schema.orderItems.id, item.id));

    return {
      externalId: transferResult.transferId,
      domainId: domain.id,
    };
  }

  /**
   * Provision WordPress hosting
   */
  private async provisionHosting(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;
    const plan = await tx.query.hostingPlans.findFirst({
      where: eq(schema.hostingPlans.id, config.planId),
    });

    if (!plan) {
      throw new Error('Hosting plan not found');
    }

    // Create hosting account record first
    const [hosting] = await tx.insert(schema.hostingAccounts).values({
      customerId: customer.id,
      planId: plan.id,
      siteName: config.siteName || `${customer.firstName}'s Site`,
      primaryDomain: config.domain || null,
      status: 'provisioning',
      billingCycle: (item.termMonths ?? 12) >= 12 ? 'yearly' : 'monthly',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + (item.termMonths ?? 12) * 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
    }).returning();

    // Provision with WPMUDEV
    const provisionResult = await this.wpmudev.provisionSite({
      siteName: hosting.siteName,
      domain: config.domain || `${hosting.uuid}.temp.hostsblue.com`,
      planId: plan.wpmudevPlanId || plan.slug,
      adminEmail: customer.email,
      options: {
        ssl: true,
        ...config.options,
      },
    });

    // Update hosting record with provisioned details
    await tx.update(schema.hostingAccounts)
      .set({
        status: 'active',
        wpmudevSiteId: provisionResult.siteId,
        wpmudevBlogId: provisionResult.blogId,
        wpmudevHostingId: provisionResult.hostingId,
        wpAdminUsername: provisionResult.wpAdmin.username,
        wpAdminPasswordEncrypted: provisionResult.wpAdmin.encryptedPassword,
        sftpUsername: provisionResult.sftp.username,
        sftpHost: provisionResult.sftp.host,
        primaryDomain: provisionResult.domain,
      })
      .where(eq(schema.hostingAccounts.id, hosting.id));

    // Update order item
    await tx.update(schema.orderItems)
      .set({ hostingAccountId: hosting.id })
      .where(eq(schema.orderItems.id, item.id));

    return {
      externalId: provisionResult.siteId,
      hostingId: hosting.id,
    };
  }

  /**
   * Enable WHOIS privacy for a domain
   */
  private async enablePrivacy(tx: any, item: schema.OrderItem): Promise<any> {
    // This would be called after domain registration
    // For now, privacy is handled during registration
    return { success: true };
  }

  /**
   * Renew a domain registration
   */
  private async renewDomainItem(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;
    const domainName = config.domainName || `${config.domain}${config.tld}`;
    const years = Math.ceil((item.termMonths ?? 12) / 12);

    const renewResult = await this.openSRS.renewDomain(domainName, years);

    if (!renewResult.success) {
      throw new Error(`Domain renewal failed for ${domainName}`);
    }

    // Update existing domain record if we have a reference
    if (config.domainId) {
      await tx.update(schema.domains)
        .set({
          expiryDate: renewResult.newExpiryDate ? new Date(renewResult.newExpiryDate) : undefined,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(schema.domains.id, config.domainId));
    }

    return { externalId: renewResult.orderId };
  }

  /**
   * Provision email service
   */
  private async provisionEmail(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;
    const domain = config.domain;
    const username = config.username || 'admin';
    const planId = config.planId;

    // Create email domain in OpenSRS
    await this.opensrsEmail.createMailDomain(domain);

    // Create the mailbox
    const mailboxResult = await this.opensrsEmail.createMailbox(
      domain,
      username,
      config.password || crypto.randomBytes(16).toString('base64url'),
      {
        storageQuotaMB: config.storageQuotaMB,
        firstName: customer.firstName || undefined,
        lastName: customer.lastName || undefined,
      }
    );

    // Create email account record
    const [emailAccount] = await tx.insert(schema.emailAccounts).values({
      customerId: customer.id,
      planId: planId || 1,
      domainId: config.domainId || null,
      email: `${username}@${domain}`,
      status: 'active',
      openSrsMailboxId: mailboxResult.email || `${username}@${domain}`,
      mailDomain: domain,
      username,
      subscriptionEndDate: new Date(Date.now() + (item.termMonths ?? 12) * 30 * 24 * 60 * 60 * 1000),
    }).returning();

    return { externalId: emailAccount.uuid };
  }

  /**
   * Order SSL certificate
   */
  private async orderSSL(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;

    const orderResult = await this.opensrsSSL.orderCertificate({
      productType: config.productType || 'dv',
      provider: config.provider || 'sectigo',
      domain: config.domain,
      period: config.termYears || 1,
      csr: config.csr || '',
      approverEmail: config.approverEmail || customer.email,
      contacts: {
        admin: {
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email,
          phone: customer.phone || '',
        },
      },
    });

    // Create SSL certificate record
    const [cert] = await tx.insert(schema.sslCertificates).values({
      customerId: customer.id,
      domainId: config.domainId || null,
      domainName: config.domain,
      type: config.productType || 'dv',
      provider: config.provider || 'sectigo',
      status: 'pending',
      openSrsOrderId: orderResult.orderId,
      productId: config.productId,
      providerName: config.provider || 'sectigo',
      validationLevel: config.productType || 'dv',
      csrPem: config.csr,
      privateKeyEncrypted: config.privateKeyEncrypted,
      approverEmail: config.approverEmail || customer.email,
      dcvMethod: 'email',
      dcvStatus: 'pending',
      termYears: config.termYears || 1,
      totalPrice: item.totalPrice,
    }).returning();

    return { externalId: orderResult.orderId };
  }

  /**
   * Provision SiteLock account
   */
  private async provisionSiteLock(
    tx: any,
    item: schema.OrderItem,
    customer: schema.Customer
  ): Promise<any> {
    const config = item.configuration as Record<string, any>;

    const result = await this.sitelock.createAccount({
      domain: config.domain,
      planSlug: config.planSlug || 'basic',
      contactEmail: customer.email,
      contactName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email,
    });

    // Create SiteLock account record
    const [slAccount] = await tx.insert(schema.sitelockAccounts).values({
      customerId: customer.id,
      domainId: config.domainId || null,
      plan: config.planSlug || 'basic',
      status: 'active',
      sitelockAccountId: result.accountId,
      sitelockPlanId: config.planSlug || 'basic',
      contactEmail: customer.email,
      subscriptionEndDate: new Date(Date.now() + (item.termMonths ?? 12) * 30 * 24 * 60 * 60 * 1000),
    }).returning();

    return { externalId: result.accountId };
  }

  /**
   * Handle payment failure webhook
   */
  async handlePaymentFailure(
    orderId: number | string,
    paymentData: any
  ): Promise<void> {
    const numericOrderId = typeof orderId === 'string' ? parseInt(orderId) : orderId;

    console.log(`[Orchestrator] Processing payment failure for order ${orderId}`);

    await this.db.transaction(async (tx) => {
      // Update order status
      await tx.update(schema.orders)
        .set({
          status: 'failed',
          paymentStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, numericOrderId));

      // Record failed payment
      const order = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, numericOrderId),
      });

      if (order) {
        await tx.insert(schema.payments).values({
          orderId: numericOrderId,
          customerId: order.customerId,
          amount: order.total,
          currency: order.currency,
          status: 'failed',
          gateway: 'swipesblue',
          gatewayResponse: paymentData,
          failedAt: new Date(),
          failureReason: paymentData.failure_message || 'Payment declined',
        });

        // Log failure
        await tx.insert(schema.auditLogs).values({
          customerId: order.customerId,
          action: 'order.payment_failed',
          entityType: 'order',
          entityId: String(order.id),
          description: 'Payment failed',
          metadata: {
            reason: paymentData.failure_message || 'Unknown',
          },
        });
      }
    });
  }

  /**
   * Handle payment refund webhook
   */
  async handlePaymentRefund(
    orderId: number | string,
    refundData: any
  ): Promise<void> {
    const numericOrderId = typeof orderId === 'string' ? parseInt(orderId) : orderId;

    console.log(`[Orchestrator] Processing refund for order ${orderId}`);

    await this.db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, numericOrderId),
        with: {
          items: true,
        },
      });

      if (!order) return;

      // Update order status
      await tx.update(schema.orders)
        .set({
          status: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, numericOrderId));

      // Update payments
      await tx.update(schema.payments)
        .set({
          status: 'refunded',
          refundedAmount: refundData.amount,
          refundReason: refundData.reason,
          refundedAt: new Date(),
        })
        .where(eq(schema.payments.orderId, numericOrderId));

      // Note: We don't cancel the domains/hosting immediately
      // A separate process should handle service cancellation based on refund policy

      // Log refund
      await tx.insert(schema.auditLogs).values({
        customerId: order.customerId,
        action: 'order.refunded',
        entityType: 'order',
        entityId: String(order.id),
        description: 'Order refunded',
        metadata: {
          amount: refundData.amount,
          reason: refundData.reason,
        },
      });
    });
  }

  /**
   * Send order confirmation email using Resend SDK
   */
  private async sendOrderConfirmation(order: any): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`[Orchestrator] Resend API key not configured, skipping confirmation email for order ${order.id}`);
      return;
    }

    try {
      const customerName = [order.customer?.firstName, order.customer?.lastName]
        .filter(Boolean)
        .join(' ') || 'Customer';

      const itemsHtml = order.items
        .map((item: any) => `<li>${item.description} - $${(item.totalPrice / 100).toFixed(2)}</li>`)
        .join('');

      const resendClient = getResend();
      if (!resendClient) return;
      await resendClient.emails.send({
        from: FROM_EMAIL,
        to: order.customer?.email || order.billingEmail,
        subject: `Order Confirmation - ${order.orderNumber}`,
        html: `
          <h1>Thank you for your order, ${customerName}!</h1>
          <p>Your order <strong>${order.orderNumber}</strong> has been completed successfully.</p>
          <h2>Order Summary</h2>
          <ul>${itemsHtml}</ul>
          <p><strong>Total: $${(order.total / 100).toFixed(2)} ${order.currency}</strong></p>
          <p>You can view your order details in your <a href="${process.env.CLIENT_URL}/dashboard/orders">hostsblue dashboard</a>.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br/>The hostsblue Team</p>
        `,
      });

      console.log(`[Orchestrator] Sent confirmation email for order ${order.id}`);
    } catch (error) {
      console.error(`[Orchestrator] Failed to send confirmation email for order ${order.id}:`, error);
    }
  }

  /**
   * Retry failed order items with exponential backoff
   */
  async retryFailedItems(orderId: number): Promise<void> {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const failedItems = order.items.filter(
      (item: schema.OrderItem) => item.status === 'failed' && (item.retryCount ?? 0) < 3
    );

    if (failedItems.length === 0) {
      console.log(`[Orchestrator] No failed items to retry for order ${orderId}`);
      return;
    }

    console.log(`[Orchestrator] Retrying ${failedItems.length} items for order ${orderId}`);

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < failedItems.length; i++) {
        const item = failedItems[i];

        // Exponential backoff delay between retries
        if (i > 0) {
          const backoffMs = Math.pow(2, item.retryCount ?? 0) * 1000; // 1s, 2s, 4s based on retry count
          console.log(`[Orchestrator] Waiting ${backoffMs}ms before retry for item ${item.id}`);
          await delay(backoffMs);
        }

        try {
          await this.processOrderItem(tx, item, order.customer as schema.Customer);
        } catch (error) {
          console.error(`[Orchestrator] Retry failed for item ${item.id}:`, error);
        }
      }

      // Check if all items are now complete
      const updatedOrder = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
        with: { items: true },
      });

      const allCompleted = updatedOrder?.items.every(
        (item: schema.OrderItem) => item.status === 'completed'
      );

      if (allCompleted) {
        await tx.update(schema.orders)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(schema.orders.id, orderId));
      }
    });
  }
}
