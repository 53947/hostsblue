// ============================================================================
// CLOUD HOSTING PROVISIONER — orchestrates server lifecycle
// ============================================================================

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { KamateraService } from './kamatera-integration.js';
import { CLOUD_HOSTING_PLANS, type CloudPlanSlug } from '../../shared/hosting-plans.js';
import crypto from 'crypto';

export class HostingProvisioner {
  private kamatera: KamateraService;

  constructor(private db: PostgresJsDatabase<typeof schema>) {
    this.kamatera = new KamateraService();
  }

  async provisionServer(params: {
    customerId: number;
    orderId?: number;
    planSlug: CloudPlanSlug;
    name: string;
    datacenter: string;
    os: string;
  }): Promise<{ uuid: string; serverId: number }> {
    const plan = CLOUD_HOSTING_PLANS[params.planSlug];
    if (!plan) throw new Error('Invalid hosting plan');

    // Check customer server limit (max 20 active servers)
    const existing = await this.db
      .select({ id: schema.cloudServers.id })
      .from(schema.cloudServers)
      .where(
        and(
          eq(schema.cloudServers.customerId, params.customerId),
          eq(schema.cloudServers.status, 'active')
        )
      );
    if (existing.length >= 20) {
      throw new Error('Maximum server limit reached. Contact support for higher limits.');
    }

    const password = this.generatePassword();
    const serverUuid = crypto.randomUUID();

    // Create DB record first
    const [server] = await this.db.insert(schema.cloudServers).values({
      uuid: serverUuid,
      customerId: params.customerId,
      orderId: params.orderId || null,
      name: params.name,
      planSlug: params.planSlug,
      cpu: plan.cpu,
      ramMB: plan.ramMB,
      diskGB: plan.diskGB,
      datacenter: params.datacenter,
      os: params.os,
      status: 'provisioning',
      monthlyPrice: plan.monthlyPrice,
      billingCycle: 'monthly',
    }).returning();

    try {
      // Call Kamatera to create the server
      const { commandId } = await this.kamatera.createServer({
        name: `hb-${serverUuid.slice(0, 8)}`,
        datacenter: params.datacenter,
        image: params.os,
        cpu: plan.cpu,
        ramMB: plan.ramMB,
        diskSizeGB: plan.diskGB,
        billingCycle: 'monthly',
        password,
      });

      // Store command ID for polling
      await this.db.update(schema.cloudServers)
        .set({ provisionCommandId: commandId })
        .where(eq(schema.cloudServers.id, server.id));

      // Start polling for completion in background
      this.pollProvisionStatus(server.id, commandId, params.customerId, password);

      // Audit log
      await this.db.insert(schema.auditLogs).values({
        customerId: params.customerId,
        action: 'cloud_server_provision_started',
        entityType: 'cloud_server',
        entityId: String(server.id),
        description: `Provisioning ${plan.name} server in ${params.datacenter}`,
      });

      return { uuid: serverUuid, serverId: server.id };
    } catch (err: any) {
      // Mark as failed if Kamatera call fails
      await this.db.update(schema.cloudServers)
        .set({ status: 'failed' })
        .where(eq(schema.cloudServers.id, server.id));

      await this.db.insert(schema.auditLogs).values({
        customerId: params.customerId,
        action: 'cloud_server_provision_failed',
        entityType: 'cloud_server',
        entityId: String(server.id),
        description: `Provisioning failed: ${err.message}`,
      });

      throw new Error('Server provisioning failed. Our team has been notified.');
    }
  }

  private async pollProvisionStatus(
    serverId: number,
    commandId: string,
    customerId: number,
    password: string
  ): Promise<void> {
    const maxAttempts = 60; // 10 minutes at 10s intervals
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const status = await this.kamatera.getCommandStatus(commandId);

        if (status.status === 'complete') {
          // Get server details to find IP
          const log = status.log || '';
          const ipMatch = log.match(/(\d+\.\d+\.\d+\.\d+)/);
          const ip = ipMatch ? ipMatch[1] : null;

          await this.db.update(schema.cloudServers)
            .set({
              status: 'active',
              ipv4: ip,
              providerServerId: status.description || commandId,
              updatedAt: new Date(),
            })
            .where(eq(schema.cloudServers.id, serverId));

          await this.db.insert(schema.auditLogs).values({
            customerId,
            action: 'cloud_server_active',
            entityType: 'cloud_server',
            entityId: String(serverId),
            description: `Server provisioned successfully. IP: ${ip || 'pending'}`,
          });
          return;
        }

        if (status.status === 'error' || status.status === 'cancelled') {
          await this.db.update(schema.cloudServers)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(schema.cloudServers.id, serverId));

          await this.db.insert(schema.auditLogs).values({
            customerId,
            action: 'cloud_server_provision_failed',
            entityType: 'cloud_server',
            entityId: String(serverId),
            description: 'Provisioning command failed',
          });
          return;
        }

        // Still pending — continue polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        } else {
          // Timed out
          await this.db.update(schema.cloudServers)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(schema.cloudServers.id, serverId));
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(poll, 15000);
        }
      }
    };

    // Start polling after 30s (server creation takes time)
    setTimeout(poll, 30000);
  }

  async powerAction(serverId: number, customerId: number, action: 'on' | 'off' | 'reboot'): Promise<void> {
    const server = await this.getOwnedServer(serverId, customerId);
    if (!server.providerServerId) throw new Error('Server not yet provisioned');

    switch (action) {
      case 'on':
        await this.kamatera.powerOn(server.providerServerId);
        await this.db.update(schema.cloudServers)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(schema.cloudServers.id, serverId));
        break;
      case 'off':
        await this.kamatera.powerOff(server.providerServerId);
        await this.db.update(schema.cloudServers)
          .set({ status: 'stopped', updatedAt: new Date() })
          .where(eq(schema.cloudServers.id, serverId));
        break;
      case 'reboot':
        await this.kamatera.reboot(server.providerServerId);
        break;
    }

    await this.db.insert(schema.auditLogs).values({
      customerId,
      action: `cloud_server_power_${action}`,
      entityType: 'cloud_server',
      entityId: String(serverId),
      description: `Power ${action} on server ${server.name}`,
    });
  }

  async terminateServer(serverId: number, customerId: number): Promise<void> {
    const server = await this.getOwnedServer(serverId, customerId);

    if (server.providerServerId) {
      try {
        await this.kamatera.terminateServer(server.providerServerId);
      } catch {
        // Log but don't block — provider may already be terminated
      }
    }

    await this.db.update(schema.cloudServers)
      .set({ status: 'terminated', terminatedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.cloudServers.id, serverId));

    await this.db.insert(schema.auditLogs).values({
      customerId,
      action: 'cloud_server_terminated',
      entityType: 'cloud_server',
      entityId: String(serverId),
      description: `Server ${server.name} terminated`,
    });
  }

  async resizeServer(serverId: number, customerId: number, newPlan: CloudPlanSlug): Promise<void> {
    const server = await this.getOwnedServer(serverId, customerId);
    if (!server.providerServerId) throw new Error('Server not yet provisioned');
    if (server.status !== 'stopped') throw new Error('Server must be stopped before resizing');

    const plan = CLOUD_HOSTING_PLANS[newPlan];
    if (!plan) throw new Error('Invalid plan');

    await this.kamatera.resizeCpu(server.providerServerId, plan.cpu);
    await this.kamatera.resizeRam(server.providerServerId, plan.ramMB);

    await this.db.update(schema.cloudServers)
      .set({
        planSlug: newPlan,
        cpu: plan.cpu,
        ramMB: plan.ramMB,
        diskGB: plan.diskGB,
        monthlyPrice: plan.monthlyPrice,
        updatedAt: new Date(),
      })
      .where(eq(schema.cloudServers.id, serverId));

    await this.db.insert(schema.auditLogs).values({
      customerId,
      action: 'cloud_server_resized',
      entityType: 'cloud_server',
      entityId: String(serverId),
      description: `Resized to ${plan.name} plan`,
    });
  }

  async listSnapshots(serverId: number, customerId: number) {
    const server = await this.getOwnedServer(serverId, customerId);
    return this.db
      .select()
      .from(schema.cloudSnapshots)
      .where(eq(schema.cloudSnapshots.serverId, serverId));
  }

  async createSnapshot(serverId: number, customerId: number, name: string) {
    const server = await this.getOwnedServer(serverId, customerId);
    if (!server.providerServerId) throw new Error('Server not yet provisioned');

    await this.kamatera.createSnapshot(server.providerServerId, name);

    const [snapshot] = await this.db.insert(schema.cloudSnapshots).values({
      serverId,
      name,
      status: 'creating',
    }).returning();

    return snapshot;
  }

  async revertSnapshot(serverId: number, customerId: number, snapshotId: number) {
    const server = await this.getOwnedServer(serverId, customerId);
    if (!server.providerServerId) throw new Error('Server not yet provisioned');

    const [snapshot] = await this.db
      .select()
      .from(schema.cloudSnapshots)
      .where(
        and(
          eq(schema.cloudSnapshots.id, snapshotId),
          eq(schema.cloudSnapshots.serverId, serverId)
        )
      );
    if (!snapshot) throw new Error('Snapshot not found');
    if (!snapshot.providerSnapshotId) throw new Error('Snapshot not yet ready');

    await this.kamatera.revertSnapshot(server.providerServerId, snapshot.providerSnapshotId);

    await this.db.update(schema.cloudSnapshots)
      .set({ status: 'reverting' })
      .where(eq(schema.cloudSnapshots.id, snapshotId));
  }

  async getCommandStatus(commandId: string) {
    return this.kamatera.getCommandStatus(commandId);
  }

  private async getOwnedServer(serverId: number, customerId: number) {
    const [server] = await this.db
      .select()
      .from(schema.cloudServers)
      .where(
        and(
          eq(schema.cloudServers.id, serverId),
          eq(schema.cloudServers.customerId, customerId)
        )
      );
    if (!server) throw new Error('Server not found');
    return server;
  }

  private generatePassword(): string {
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = lower + upper + digits + '!@#$%';

    // Guarantee at least one of each required class
    const bytes = crypto.randomBytes(20);
    const required = [
      lower[bytes[0] % lower.length],
      upper[bytes[1] % upper.length],
      digits[bytes[2] % digits.length],
    ];

    // Fill remaining 13 chars from full set
    const rest: string[] = [];
    for (let i = 3; i < 16; i++) {
      rest.push(all[bytes[i] % all.length]);
    }

    // Shuffle all 16 chars together
    const chars = [...required, ...rest];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = bytes[(i + 3) % bytes.length] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
