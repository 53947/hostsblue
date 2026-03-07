import { Express } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import { CLOUD_HOSTING_PLANS, DATACENTERS, OS_IMAGES } from '../../shared/hosting-plans.js';
import { z } from 'zod';

export function registerHostingRoutes(app: Express, ctx: RouteContext) {
  const { db, wpmudev, hostingProvisioner } = ctx;

  // Get hosting plans
  app.get('/api/v1/hosting/plans', asyncHandler(async (req, res) => {
    const plans = await db.query.hostingPlans.findMany({
      where: eq(schema.hostingPlans.isActive, true),
      orderBy: schema.hostingPlans.sortOrder,
    });
    
    res.json(successResponse(plans));
  }));
  
  // Get customer's hosting accounts
  app.get('/api/v1/hosting/accounts', requireAuth, asyncHandler(async (req, res) => {
    const accounts = await db.query.hostingAccounts.findMany({
      where: and(
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
      with: {
        plan: true,
      },
      orderBy: desc(schema.hostingAccounts.createdAt),
    });
    
    res.json(successResponse(accounts));
  }));
  
  // Get single hosting account
  app.get('/api/v1/hosting/accounts/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
      with: {
        plan: true,
      },
    });
    
    if (!account) {
      return res.status(404).json(errorResponse('Hosting account not found'));
    }

    res.json(successResponse(account));
  }));

  // Trigger hosting backup
  app.post('/api/v1/hosting/accounts/:uuid/backup', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (account.wpmudevSiteId) {
      await wpmudev.createBackup(account.wpmudevSiteId);
    }

    await db.update(schema.hostingAccounts)
      .set({ lastBackupAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.hostingAccounts.id, account.id));

    res.json(successResponse(null, 'Backup initiated'));
  }));

  // List hosting backups
  app.get('/api/v1/hosting/accounts/:uuid/backups', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    let backups: any[] = [];
    if (account.wpmudevSiteId) {
      backups = await wpmudev.listBackups(account.wpmudevSiteId);
    }

    res.json(successResponse(backups));
  }));

  // Restore from backup
  app.post('/api/v1/hosting/accounts/:uuid/restore/:backupId', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (!account.wpmudevSiteId) {
      return res.status(400).json(errorResponse('Hosting account not provisioned'));
    }

    await wpmudev.restoreBackup(account.wpmudevSiteId, req.params.backupId);

    await db.insert(schema.auditLogs).values({
      customerId: req.user!.userId,
      action: 'hosting_backup_restored',
      entityType: 'hosting_account',
      entityId: String(account.id),
      description: `Restored backup ${req.params.backupId} for ${account.primaryDomain}`,
      ipAddress: req.ip,
    });

    res.json(successResponse(null, 'Backup restore initiated'));
  }));

  // Clear hosting cache
  app.delete('/api/v1/hosting/accounts/:uuid/cache', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (account.wpmudevSiteId) {
      await wpmudev.clearCache(account.wpmudevSiteId);
    }

    res.json(successResponse(null, 'Cache cleared'));
  }));

  // Toggle staging environment
  app.post('/api/v1/hosting/accounts/:uuid/staging', requireAuth, asyncHandler(async (req, res) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (!account.wpmudevSiteId) {
      return res.status(400).json(errorResponse('Hosting account not provisioned'));
    }

    await wpmudev.toggleStaging(account.wpmudevSiteId, enabled);

    res.json(successResponse({ enabled }, `Staging ${enabled ? 'enabled' : 'disabled'}`));
  }));

  // Get hosting usage stats
  app.get('/api/v1/hosting/accounts/:uuid/stats', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
      with: { plan: true },
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    let liveStats: any = null;
    if (account.wpmudevSiteId) {
      liveStats = await wpmudev.getSiteStats(account.wpmudevSiteId);
    }

    res.json(successResponse({
      storageUsedMB: account.storageUsedMB,
      bandwidthUsedMB: account.bandwidthUsedMB,
      lastStatsUpdate: account.lastStatsUpdate,
      plan: account.plan,
      liveStats,
    }));
  }));

  // ============================================================================
  // CLOUD HOSTING ROUTES
  // ============================================================================

  // Get cloud hosting options (public)
  app.get('/api/v1/hosting/cloud/options', asyncHandler(async (req, res) => {
    res.json(successResponse({
      plans: Object.entries(CLOUD_HOSTING_PLANS).map(([slug, plan]) => ({
        slug,
        ...plan,
      })),
      datacenters: DATACENTERS,
      images: OS_IMAGES,
    }));
  }));

  // List customer's cloud servers
  app.get('/api/v1/hosting/cloud/servers', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const servers = await db
      .select({
        id: schema.cloudServers.id,
        uuid: schema.cloudServers.uuid,
        name: schema.cloudServers.name,
        planSlug: schema.cloudServers.planSlug,
        cpu: schema.cloudServers.cpu,
        ramMB: schema.cloudServers.ramMB,
        diskGB: schema.cloudServers.diskGB,
        datacenter: schema.cloudServers.datacenter,
        os: schema.cloudServers.os,
        ipv4: schema.cloudServers.ipv4,
        status: schema.cloudServers.status,
        monthlyPrice: schema.cloudServers.monthlyPrice,
        createdAt: schema.cloudServers.createdAt,
      })
      .from(schema.cloudServers)
      .where(eq(schema.cloudServers.customerId, customerId))
      .orderBy(desc(schema.cloudServers.createdAt));

    res.json(successResponse(servers));
  }));

  // Get cloud server details
  app.get('/api/v1/hosting/cloud/servers/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    // Strip provider-internal fields
    const { providerServerId, provider, provisionCommandId, ...safeServer } = server;
    res.json(successResponse(safeServer));
  }));

  // Provision new cloud server
  app.post('/api/v1/hosting/cloud/servers', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const body = z.object({
      planSlug: z.enum(['cloud-developer', 'cloud-startup', 'cloud-scale', 'cloud-enterprise'] as const),
      name: z.string().min(1).max(63),
      datacenter: z.string().min(2),
      os: z.string().min(1),
    }).parse(req.body);

    const result = await hostingProvisioner.provisionServer({
      customerId,
      planSlug: body.planSlug,
      name: body.name,
      datacenter: body.datacenter,
      os: body.os,
    });

    res.status(201).json(successResponse(result, 'Server provisioning started'));
  }));

  // Power control (on/off/reboot)
  app.post('/api/v1/hosting/cloud/servers/:uuid/power', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const { action } = z.object({ action: z.enum(['on', 'off', 'reboot']) }).parse(req.body);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.powerAction(server.id, customerId, action);
    res.json(successResponse(null, `Power ${action} initiated`));
  }));

  // Terminate cloud server
  app.delete('/api/v1/hosting/cloud/servers/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.terminateServer(server.id, customerId);
    res.json(successResponse(null, 'Server terminated'));
  }));

  // Resize cloud server
  app.put('/api/v1/hosting/cloud/servers/:uuid/resize', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const { planSlug } = z.object({
      planSlug: z.enum(['cloud-developer', 'cloud-startup', 'cloud-scale', 'cloud-enterprise'] as const),
    }).parse(req.body);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.resizeServer(server.id, customerId, planSlug);
    res.json(successResponse(null, 'Server resize initiated'));
  }));

  // List snapshots for a cloud server
  app.get('/api/v1/hosting/cloud/servers/:uuid/snapshots', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    const snapshots = await hostingProvisioner.listSnapshots(server.id, customerId);
    res.json(successResponse(snapshots));
  }));

  // Create snapshot
  app.post('/api/v1/hosting/cloud/servers/:uuid/snapshots', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    const snapshot = await hostingProvisioner.createSnapshot(server.id, customerId, name);
    res.status(201).json(successResponse(snapshot, 'Snapshot creation started'));
  }));

  // Revert snapshot
  app.put('/api/v1/hosting/cloud/servers/:uuid/snapshots/:snapId', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const snapId = parseInt(req.params.snapId);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.revertSnapshot(server.id, customerId, snapId);
    res.json(successResponse(null, 'Snapshot revert initiated'));
  }));

  // Admin: list all cloud servers
  app.get('/api/v1/admin/cloud/servers', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const servers = await db
      .select({
        id: schema.cloudServers.id,
        uuid: schema.cloudServers.uuid,
        name: schema.cloudServers.name,
        planSlug: schema.cloudServers.planSlug,
        cpu: schema.cloudServers.cpu,
        ramMB: schema.cloudServers.ramMB,
        diskGB: schema.cloudServers.diskGB,
        datacenter: schema.cloudServers.datacenter,
        ipv4: schema.cloudServers.ipv4,
        status: schema.cloudServers.status,
        monthlyPrice: schema.cloudServers.monthlyPrice,
        createdAt: schema.cloudServers.createdAt,
        customerId: schema.cloudServers.customerId,
        customerEmail: schema.customers.email,
      })
      .from(schema.cloudServers)
      .leftJoin(schema.customers, eq(schema.cloudServers.customerId, schema.customers.id))
      .orderBy(desc(schema.cloudServers.createdAt));

    res.json(successResponse(servers));
  }));

  // Admin — cloud server power action
  app.post('/api/v1/admin/cloud/servers/:uuid/power', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const { uuid } = req.params;
    const { action } = req.body;
    if (!['on', 'off', 'reboot'].includes(action)) {
      return res.status(400).json(errorResponse('Invalid action'));
    }

    const [server] = await db.select().from(schema.cloudServers).where(eq(schema.cloudServers.uuid, uuid));
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.powerAction(server.id, server.customerId, action);

    await db.insert(schema.auditLogs).values({
      customerId: user.id,
      action: `admin_cloud_power_${action}`,
      entityType: 'cloud_server',
      entityId: String(server.id),
      description: `Admin power ${action} on ${server.name}`,
    });

    res.json(successResponse({ message: `Power ${action} initiated` }));
  }));

  // Admin — cloud server terminate
  app.delete('/api/v1/admin/cloud/servers/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const { uuid } = req.params;
    const [server] = await db.select().from(schema.cloudServers).where(eq(schema.cloudServers.uuid, uuid));
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.terminateServer(server.id, server.customerId);

    await db.insert(schema.auditLogs).values({
      customerId: user.id,
      action: 'admin_cloud_terminate',
      entityType: 'cloud_server',
      entityId: String(server.id),
      description: `Admin terminated server ${server.name}`,
    });

    res.json(successResponse({ message: 'Server terminated' }));
  }));
}
