import { Express } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, domainSearchSchema, type RouteContext } from './shared.js';

export function registerDomainRoutes(app: Express, ctx: RouteContext) {
  const { db, openSRS } = ctx;

  // Search domain availability
  app.get('/api/v1/domains/search', asyncHandler(async (req, res) => {
    const { domain } = domainSearchSchema.parse(req.query);

    const TLD_CATALOG: Record<string, number> = {
      '.com': 2071, '.net': 2357, '.org': 1427, '.io': 4857, '.co': 5000,
      '.dev': 2429, '.app': 3000, '.ai': 31714, '.tech': 8429, '.cloud': 3857,
      '.digital': 6143, '.software': 6143,
      '.biz': 3000, '.company': 3000, '.agency': 4429, '.solutions': 5000,
      '.services': 5857, '.consulting': 7571, '.group': 3857,
      '.llc': 6286, '.ventures': 8571, '.enterprises': 5429,
      '.design': 8429, '.studio': 6000, '.media': 6571, '.art': 4429,
      '.photography': 5571, '.video': 5571,
      '.shop': 5714, '.store': 7429, '.market': 6429, '.sale': 5857,
      '.deals': 6143,
      '.site': 4714, '.website': 3571, '.online': 4714,
      '.page': 2143, '.blog': 4429, '.info': 3857,
      '.us': 1571, '.uk': 1250, '.ca': 2286, '.eu': 1429, '.de': 1250,
      '.xyz': 2429, '.me': 3286, '.tv': 6286, '.cc': 2571, '.pro': 4000,
      '.live': 5143, '.world': 6143, '.space': 4286, '.life': 5571,
      '.today': 4143, '.zone': 5857, '.one': 3714,
      '.club': 2857, '.email': 4429, '.network': 5571, '.team': 5571,
      '.link': 1857, '.click': 2143, '.news': 5143, '.city': 4143,
      '.fun': 5000, '.business': 2857, '.social': 6143, '.ninja': 5000,
    };

    const TLD_PRIORITY: string[] = [
      '.com', '.net', '.org', '.io', '.co', '.dev', '.app', '.ai',
      '.tech', '.cloud', '.me', '.xyz', '.pro', '.us', '.uk', '.info', '.biz',
    ];

    let tldPricing: Record<string, number> = {};
    try {
      const allTlds = Object.keys(TLD_CATALOG);
      const dbTlds = await db.query.tldPricing.findMany({
        where: eq(schema.tldPricing.isActive, true),
      });
      if (dbTlds.length > 0) {
        dbTlds.forEach(t => { tldPricing[t.tld] = t.registrationPrice; });
        allTlds.forEach(tld => { if (!tldPricing[tld]) tldPricing[tld] = TLD_CATALOG[tld]; });
      } else {
        tldPricing = { ...TLD_CATALOG };
      }
    } catch {
      tldPricing = { ...TLD_CATALOG };
    }

    const results = await openSRS.checkAvailability(domain, Object.keys(tldPricing));

    const searchedTld = '.' + (domain.split('.').slice(1).join('.') || 'com');
    const sorted = results.sort((a: any, b: any) => {
      if (a.tld === searchedTld && b.tld !== searchedTld) return -1;
      if (b.tld === searchedTld && a.tld !== searchedTld) return 1;
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      if (a.available && b.available) {
        const aPri = TLD_PRIORITY.indexOf(a.tld);
        const bPri = TLD_PRIORITY.indexOf(b.tld);
        const aIsPriority = aPri !== -1;
        const bIsPriority = bPri !== -1;
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        if (aIsPriority && bIsPriority) return aPri - bPri;
        return (tldPricing[a.tld] || 9999) - (tldPricing[b.tld] || 9999);
      }
      return 0;
    });

    res.json(successResponse({
      query: domain,
      results: sorted.map((r: any) => ({
        domain: r.domain,
        available: r.available,
        price: r.available ? (tldPricing[r.tld] || null) : null,
        tld: r.tld,
      })),
    }));
  }));

  app.get('/api/v1/domains/tlds', asyncHandler(async (req, res) => {
    const tlds = await db.query.tldPricing.findMany({
      where: eq(schema.tldPricing.isActive, true),
      orderBy: [
        desc(schema.tldPricing.isFeatured),
        schema.tldPricing.tld,
      ],
    });
    res.json(successResponse(tlds));
  }));

  app.get('/api/v1/domains', requireAuth, asyncHandler(async (req, res) => {
    const domains = await db.query.domains.findMany({
      where: and(
        eq(schema.domains.customerId, req.user!.userId),
        sql`${schema.domains.deletedAt} IS NULL`
      ),
      with: { ownerContact: true },
      orderBy: desc(schema.domains.createdAt),
    });
    res.json(successResponse(domains));
  }));

  app.get('/api/v1/domains/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
        sql`${schema.domains.deletedAt} IS NULL`
      ),
      with: {
        ownerContact: true,
        adminContact: true,
        techContact: true,
        billingContact: true,
        dnsRecords: true,
      },
    });
    if (!domain) {
      return res.status(404).json(errorResponse('Domain not found'));
    }
    res.json(successResponse(domain));
  }));

  app.patch('/api/v1/domains/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const { nameservers, privacyEnabled, autoRenew } = req.body;
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) {
      return res.status(404).json(errorResponse('Domain not found'));
    }
    if (nameservers) {
      await openSRS.updateNameservers(domain.domainName, nameservers);
    }
    const [updated] = await db.update(schema.domains)
      .set({
        ...(nameservers && { nameservers }),
        ...(privacyEnabled !== undefined && { privacyEnabled }),
        ...(autoRenew !== undefined && { autoRenew }),
        updatedAt: new Date(),
      })
      .where(eq(schema.domains.id, domain.id))
      .returning();
    res.json(successResponse(updated));
  }));

  // DNS MANAGEMENT

  app.get('/api/v1/domains/:uuid/dns', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));
    const records = await db.query.dnsRecords.findMany({
      where: eq(schema.dnsRecords.domainId, domain.id),
      orderBy: [schema.dnsRecords.type, schema.dnsRecords.name],
    });
    res.json(successResponse(records));
  }));

  app.post('/api/v1/domains/:uuid/dns', requireAuth, asyncHandler(async (req, res) => {
    const { type, name, content, ttl, priority } = req.body;
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const [record] = await db.insert(schema.dnsRecords).values({
      domainId: domain.id,
      type,
      name: name || '@',
      content,
      ttl: ttl || 3600,
      priority: priority || null,
    }).returning();

    if (domain.useHostsBlueNameservers) {
      try {
        await openSRS.updateDnsRecords(domain.domainName, [{ type, name: name || '@', content, ttl: ttl || 3600, priority }]);
        await db.update(schema.dnsRecords)
          .set({ syncedToOpensrs: true, lastSyncAt: new Date() })
          .where(eq(schema.dnsRecords.id, record.id));
      } catch (err: any) {
        await db.update(schema.dnsRecords)
          .set({ syncError: err.message })
          .where(eq(schema.dnsRecords.id, record.id));
      }
    }

    res.status(201).json(successResponse(record));
  }));

  app.patch('/api/v1/domains/:uuid/dns/:recordId', requireAuth, asyncHandler(async (req, res) => {
    const { content, ttl, priority } = req.body;
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const recordId = parseInt(req.params.recordId);
    const existing = await db.query.dnsRecords.findFirst({
      where: and(eq(schema.dnsRecords.id, recordId), eq(schema.dnsRecords.domainId, domain.id)),
    });
    if (!existing) return res.status(404).json(errorResponse('DNS record not found'));

    const [updated] = await db.update(schema.dnsRecords)
      .set({
        ...(content !== undefined && { content }),
        ...(ttl !== undefined && { ttl }),
        ...(priority !== undefined && { priority }),
        syncedToOpensrs: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.dnsRecords.id, recordId))
      .returning();

    if (domain.useHostsBlueNameservers) {
      try {
        const allRecords = await db.query.dnsRecords.findMany({
          where: and(eq(schema.dnsRecords.domainId, domain.id), eq(schema.dnsRecords.isActive, true)),
        });
        await openSRS.updateDnsRecords(domain.domainName, allRecords.map(r => ({
          type: r.type, name: r.name, content: r.content, ttl: r.ttl, priority: r.priority ?? undefined,
        })));
        await db.update(schema.dnsRecords)
          .set({ syncedToOpensrs: true, lastSyncAt: new Date(), syncError: null })
          .where(eq(schema.dnsRecords.id, recordId));
      } catch (err: any) {
        await db.update(schema.dnsRecords)
          .set({ syncError: err.message })
          .where(eq(schema.dnsRecords.id, recordId));
      }
    }

    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/domains/:uuid/dns/:recordId', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const recordId = parseInt(req.params.recordId);
    const existing = await db.query.dnsRecords.findFirst({
      where: and(eq(schema.dnsRecords.id, recordId), eq(schema.dnsRecords.domainId, domain.id)),
    });
    if (!existing) return res.status(404).json(errorResponse('DNS record not found'));

    await db.delete(schema.dnsRecords).where(eq(schema.dnsRecords.id, recordId));

    if (domain.useHostsBlueNameservers) {
      try {
        const remaining = await db.query.dnsRecords.findMany({
          where: and(eq(schema.dnsRecords.domainId, domain.id), eq(schema.dnsRecords.isActive, true)),
        });
        await openSRS.updateDnsRecords(domain.domainName, remaining.map(r => ({
          type: r.type, name: r.name, content: r.content, ttl: r.ttl, priority: r.priority ?? undefined,
        })));
      } catch (err: any) {
        console.error(`DNS sync error after delete for ${domain.domainName}:`, err);
      }
    }

    res.json(successResponse(null, 'DNS record deleted'));
  }));

  app.post('/api/v1/domains/:uuid/dns/sync', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const remoteRecords = await openSRS.getDnsRecords(domain.domainName);

    res.json(successResponse({
      localRecords: await db.query.dnsRecords.findMany({
        where: eq(schema.dnsRecords.domainId, domain.id),
      }),
      remoteRecords,
    }));
  }));
}
