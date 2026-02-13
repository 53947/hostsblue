/**
 * Order Orchestration Service
 * Coordinates domain registration and hosting provisioning after payment
 * Handles success, failure, and refund scenarios
 */

import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema.js';
import { OpenSRSIntegration } from './openrs-integration.js';
import { WPMUDevIntegration } from './wpmudev-integration.js';

export class OrderOrchestrator {
  private db: NodePgDatabase<typeof schema>;
  private openSRS: OpenSRSIntegration;
  private wpmudev: WPMUDevIntegration;

  constructor(
    db: NodePgDatabase<typeof schema>,
    openSRS: OpenSRSIntegration,
    wpmudev: WPMUDevIntegration
  ) {
    this.db = db;
    this.openSRS = openSRS;
    this.wpmudev = wpmudev;
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
        order.items.map(item => this.processOrderItem(tx, item, order.customer))
      );

      // 5. Check for failures
      const failures = results
        .map((r, i) => ({ result: r, item: order.items[i] }))
        .filter(({ result }) => result.status === 'rejected');

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
        this.sendOrderConfirmation(order);
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
      .set({ status: 'processing', updatedAt: new Date() })
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
          retryCount: item.retryCount + 1,
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
    const config = item.configuration;
    const domainName = `${config.domain}${config.tld}`;

    // Get or create contact
    let contact = await tx.query.domainContacts.findFirst({
      where: eq(schema.domainContacts.customerId, customer.id),
    });

    if (!contact) {
      // Create contact from customer info
      const [newContact] = await tx.insert(schema.domainContacts).values({
        customerId: customer.id,
        contactType: 'owner',
        firstName: customer.firstName || 'Unknown',
        lastName: customer.lastName || 'User',
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone || '+1.5555555555',
        address1: customer.address1 || '123 Main St',
        city: customer.city || 'New York',
        state: customer.state || 'NY',
        postalCode: customer.postalCode || '10001',
        countryCode: customer.countryCode || 'US',
      }).returning();
      contact = newContact;
    }

    // Register with OpenSRS
    const registrationResult = await this.openSRS.registerDomain({
      domain: domainName,
      period: Math.ceil(item.termMonths / 12),
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
      nameservers: ['ns1.hostsblue.com', 'ns2.hostsblue.com'],
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
      expiryDate: new Date(Date.now() + item.termMonths * 30 * 24 * 60 * 60 * 1000),
      registrationPeriodYears: Math.ceil(item.termMonths / 12),
      autoRenew: true,
      privacyEnabled: config.privacy || false,
      ownerContactId: contact.id,
      nameservers: ['ns1.hostsblue.com', 'ns2.hostsblue.com'],
      useHostsBlueNameservers: true,
      openrsOrderId: registrationResult.orderId,
      openrsDomainId: registrationResult.domainId,
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
    const config = item.configuration;
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
      openrsOrderId: transferResult.transferId,
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
    const config = item.configuration;
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
      billingCycle: item.termMonths >= 12 ? 'yearly' : 'monthly',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + item.termMonths * 30 * 24 * 60 * 60 * 1000),
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
        wpAdminPasswordEncrypted: provisionResult.wpAdmin.password, // Should be encrypted
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
   * Send order confirmation email
   */
  private async sendOrderConfirmation(order: any): Promise<void> {
    // TODO: Implement with Resend
    console.log(`[Orchestrator] Would send confirmation email for order ${order.id}`);
  }

  /**
   * Retry failed order items
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
      item => item.status === 'failed' && item.retryCount < 3
    );

    if (failedItems.length === 0) {
      console.log(`[Orchestrator] No failed items to retry for order ${orderId}`);
      return;
    }

    console.log(`[Orchestrator] Retrying ${failedItems.length} items for order ${orderId}`);

    await this.db.transaction(async (tx) => {
      for (const item of failedItems) {
        try {
          await this.processOrderItem(tx, item, order.customer);
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
        item => item.status === 'completed'
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
