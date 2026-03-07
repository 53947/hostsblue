import { Express } from 'express';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import crypto from 'crypto';

export function registerWebhookRoutes(app: Express, ctx: RouteContext) {
  const { db, sitelockService, resend } = ctx;

  app.post('/api/v1/webhooks/opensrs', asyncHandler(async (req, res) => {
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const idempotencyKey = req.body.id ? `opensrs-${req.body.id}` : `opensrs-${crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}`;

    // Check idempotency — skip if already processed
    const existing = await db.query.webhookEvents.findFirst({
      where: and(
        eq(schema.webhookEvents.idempotencyKey, idempotencyKey),
        eq(schema.webhookEvents.status, 'processed'),
      ),
    });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const [webhookEvent] = await db.insert(schema.webhookEvents).values({
      source: 'opensrs',
      eventType: req.body.action || req.body.type || 'unknown',
      payload: req.body,
      headers: safeHeaders,
      idempotencyKey,
    }).returning();

    const action = req.body.action || req.body.type || '';
    const data = req.body.attributes || req.body.data || req.body;

    switch (action) {
      case 'TRANSFER_COMPLETED':
      case 'transfer_completed': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'active',
              transferStatus: 'completed',
              registrationDate: new Date(),
              expiryDate: data.expiry_date ? new Date(data.expiry_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              isTransfer: true,
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_transfer_completed',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain transfer completed for ${domainName}`,
            });

            // Notify customer via email
            if (resend) {
              const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, domain.customerId) });
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: `Domain Transfer Complete: ${domainName}`,
                    html: `<p>Your domain transfer for <strong>${domainName}</strong> has been completed successfully. You can now manage it from your <a href="${process.env.CLIENT_URL}/dashboard/domains">hostsblue dashboard</a>.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'TRANSFER_FAILED':
      case 'transfer_failed': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'pending',
              transferStatus: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_transfer_failed',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain transfer failed for ${domainName}: ${data.reason || 'Unknown reason'}`,
            });

            if (resend) {
              const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, domain.customerId) });
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: `Domain Transfer Failed: ${domainName}`,
                    html: `<p>The transfer for <strong>${domainName}</strong> has failed. Reason: ${data.reason || 'Please contact support for details.'}. Visit your <a href="${process.env.CLIENT_URL}/dashboard/domains">hostsblue dashboard</a> to retry.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'DOMAIN_RENEWED':
      case 'domain_renewed':
      case 'auto_renewed': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'active',
              expiryDate: data.new_expiry_date ? new Date(data.new_expiry_date) : undefined,
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_renewed',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain ${domainName} auto-renewed`,
            });
          }
        }
        break;
      }

      case 'DOMAIN_EXPIRED':
      case 'domain_expired': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_expired',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain ${domainName} has expired`,
            });
          }
        }
        break;
      }

      case 'ABOUT_TO_EXPIRE':
      case 'about_to_expire': {
        const domainName = data.domain || data.domain_name;
        if (domainName && resend) {
          const domain = await db.query.domains.findFirst({
            where: eq(schema.domains.domainName, domainName),
          });
          if (domain) {
            const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, domain.customerId) });
            if (customer) {
              try {
                await resend.emails.send({
                  from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                  to: customer.email,
                  subject: `Domain Expiring Soon: ${domainName}`,
                  html: `<p>Your domain <strong>${domainName}</strong> is about to expire on ${domain.expiryDate ? new Date(domain.expiryDate).toLocaleDateString() : 'soon'}. <a href="${process.env.CLIENT_URL}/dashboard/domains">Renew now</a> to avoid losing it.</p>`,
                });
              } catch { /* non-critical */ }
            }
          }
        }
        break;
      }
    }

    // Mark webhook as processed
    await db.update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookEvent.id));

    res.json({ received: true });
  }));

  // OpenSRS Email webhook (mailbox events)
  app.post('/api/v1/webhooks/opensrs-email', asyncHandler(async (req, res) => {
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const idempotencyKey = req.body.id ? `opensrs-email-${req.body.id}` : `opensrs-email-${crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}`;

    const existing = await db.query.webhookEvents.findFirst({
      where: and(
        eq(schema.webhookEvents.idempotencyKey, idempotencyKey),
        eq(schema.webhookEvents.status, 'processed'),
      ),
    });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const [webhookEvent] = await db.insert(schema.webhookEvents).values({
      source: 'opensrs-email',
      eventType: req.body.event || req.body.type || 'unknown',
      payload: req.body,
      headers: safeHeaders,
      idempotencyKey,
    }).returning();

    const event = req.body.event || req.body.type || '';
    const data = req.body.data || req.body;

    switch (event) {
      case 'mailbox.suspended':
      case 'mailbox.disabled': {
        const email = data.email || data.mailbox;
        if (email) {
          const [account] = await db.update(schema.emailAccounts)
            .set({ status: 'suspended', updatedAt: new Date() })
            .where(eq(schema.emailAccounts.email, email))
            .returning();
          if (account) {
            await db.insert(schema.auditLogs).values({
              customerId: account.customerId,
              action: 'email_mailbox_suspended',
              entityType: 'email_account',
              entityId: String(account.id),
              description: `Mailbox ${email} suspended via webhook`,
            });
          }
        }
        break;
      }

      case 'mailbox.quota_exceeded': {
        const email = data.email || data.mailbox;
        if (email) {
          await db.update(schema.emailAccounts)
            .set({ storageUsedMB: data.storage_used_mb || 0, updatedAt: new Date() })
            .where(eq(schema.emailAccounts.email, email));
        }
        break;
      }

      case 'domain.deleted': {
        const mailDomain = data.domain;
        if (mailDomain) {
          await db.update(schema.emailAccounts)
            .set({ status: 'suspended', deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.emailAccounts.mailDomain, mailDomain));
          await db.insert(schema.auditLogs).values({
            action: 'email_domain_deleted',
            entityType: 'email_domain',
            description: `Mail domain ${mailDomain} deleted via webhook — all mailboxes suspended`,
          });
        }
        break;
      }
    }

    await db.update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookEvent.id));

    res.json({ received: true });
  }));

  // SiteLock webhook (scan results, malware detection, firewall events)
  app.post('/api/v1/webhooks/sitelock', asyncHandler(async (req, res) => {
    // Verify signature
    const signature = req.headers['x-sitelock-signature'] as string;
    if (signature && !sitelockService.verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const idempotencyKey = req.body.id ? `sitelock-${req.body.id}` : `sitelock-${crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}`;

    const existing = await db.query.webhookEvents.findFirst({
      where: and(
        eq(schema.webhookEvents.idempotencyKey, idempotencyKey),
        eq(schema.webhookEvents.status, 'processed'),
      ),
    });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const [webhookEvent] = await db.insert(schema.webhookEvents).values({
      source: 'sitelock',
      eventType: req.body.event || req.body.type || 'unknown',
      payload: req.body,
      headers: safeHeaders,
      idempotencyKey,
    }).returning();

    const event = req.body.event || req.body.type || '';
    const data = req.body.data || req.body;
    const accountId = data.account_id || data.accountId;

    // Helper to get SiteLock account and customer for notifications
    const getAccountAndCustomer = async (slAccountId: string) => {
      const account = await db.query.sitelockAccounts.findFirst({
        where: eq(schema.sitelockAccounts.sitelockAccountId, slAccountId),
      });
      if (!account) return { account: null, customer: null };
      const customer = await db.query.customers.findFirst({
        where: eq(schema.customers.id, account.customerId),
      });
      return { account, customer };
    };

    switch (event) {
      case 'scan.completed': {
        if (accountId) {
          const [updated] = await db.update(schema.sitelockAccounts)
            .set({
              lastScanAt: new Date(),
              lastScanResult: data.results || data,
              malwareFound: data.malware_found || false,
              riskLevel: data.risk_level || 'low',
              updatedAt: new Date(),
            })
            .where(eq(schema.sitelockAccounts.sitelockAccountId, accountId))
            .returning();
          if (updated) {
            await db.insert(schema.auditLogs).values({
              customerId: updated.customerId,
              action: 'sitelock_scan_completed',
              entityType: 'sitelock_account',
              entityId: String(updated.id),
              description: `SiteLock scan completed — risk level: ${data.risk_level || 'low'}`,
            });
          }
        }
        break;
      }

      case 'malware.detected': {
        if (accountId) {
          const [updated] = await db.update(schema.sitelockAccounts)
            .set({
              malwareFound: true,
              riskLevel: data.risk_level || 'high',
              lastScanResult: data,
              updatedAt: new Date(),
            })
            .where(eq(schema.sitelockAccounts.sitelockAccountId, accountId))
            .returning();

          if (updated) {
            await db.insert(schema.auditLogs).values({
              customerId: updated.customerId,
              action: 'sitelock_malware_detected',
              entityType: 'sitelock_account',
              entityId: String(updated.id),
              description: `Malware detected — ${data.malware_count || 'multiple'} threat(s) found`,
            });

            // Alert customer via email
            if (resend) {
              const { customer } = await getAccountAndCustomer(accountId);
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: 'Security Alert: Malware Detected on Your Site',
                    html: `<p><strong>Malware has been detected</strong> on your website. We recommend taking immediate action. Visit your <a href="${process.env.CLIENT_URL}/dashboard/security">hostsblue security dashboard</a> for details and remediation options.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'malware.cleaned':
      case 'malware.removed': {
        if (accountId) {
          const [updated] = await db.update(schema.sitelockAccounts)
            .set({
              malwareFound: false,
              riskLevel: 'low',
              updatedAt: new Date(),
            })
            .where(eq(schema.sitelockAccounts.sitelockAccountId, accountId))
            .returning();

          if (updated) {
            await db.insert(schema.auditLogs).values({
              customerId: updated.customerId,
              action: 'sitelock_malware_removed',
              entityType: 'sitelock_account',
              entityId: String(updated.id),
              description: 'Malware successfully removed',
            });

            if (resend) {
              const { customer } = await getAccountAndCustomer(accountId);
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: 'Malware Removed from Your Site',
                    html: `<p>The malware detected on your website has been <strong>successfully removed</strong>. Your site is now clean. Visit your <a href="${process.env.CLIENT_URL}/dashboard/security">hostsblue security dashboard</a> for details.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'firewall.event': {
        await db.insert(schema.auditLogs).values({
          action: 'sitelock_firewall_event',
          entityType: 'sitelock_account',
          description: `Firewall event for account ${accountId}: ${data.description || 'unknown'}`,
        });
        break;
      }
    }

    await db.update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookEvent.id));

    res.json({ received: true });
  }));
}
