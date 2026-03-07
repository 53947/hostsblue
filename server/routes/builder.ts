import { Express } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { asyncHandler, successResponse, errorResponse, site404Html, type RouteContext } from './shared.js';
import { WebsiteAIService } from '../services/website-ai.js';
import { AIProviderFactory, testProviderConnection } from '../services/ai-provider.js';
import type { ProviderConfig } from '../services/ai-provider.js';
import { encryptCredential, decryptCredential } from '../services/wpmudev-integration.js';
import { getTemplateById, templates as allTemplates } from '../../shared/templates/index.js';
import { defaultTheme, createDefaultBlock } from '../../shared/block-types.js';
import { renderPage } from '../services/website-renderer.js';
import { z } from 'zod';
import crypto from 'crypto';

export function registerBuilderRoutes(app: Express, ctx: RouteContext) {
  const { db, aiCreditsService, planEnforcement, analyticsAggregation } = ctx;

  // Helper: get platform API key for credits mode
  function getPlatformApiKey(provider: string): string | undefined {
    const envMap: Record<string, string> = {
      deepseek: 'PLATFORM_DEEPSEEK_API_KEY',
      openai: 'PLATFORM_OPENAI_API_KEY',
      anthropic: 'PLATFORM_ANTHROPIC_API_KEY',
      groq: 'PLATFORM_GROQ_API_KEY',
      gemini: 'PLATFORM_GEMINI_API_KEY',
    };
    return process.env[envMap[provider] || ''];
  }

  // Helper: get AI service for current customer (supports credits + BYOK)
  async function getAIService(customerId: number): Promise<{ ai: WebsiteAIService; billingMode: string; provider: string; modelName: string }> {
    const balance = await aiCreditsService.getBalance(customerId);
    const settings = await db.query.aiProviderSettings.findFirst({
      where: and(eq(schema.aiProviderSettings.customerId, customerId), eq(schema.aiProviderSettings.isActive, true)),
    });

    const provider = settings?.provider || 'deepseek';
    const modelName = settings?.modelName || 'deepseek-chat';
    let config: ProviderConfig | null = null;

    if (balance.billingMode === 'credits') {
      // Credits mode: use platform API keys
      const platformKey = getPlatformApiKey(provider);
      if (platformKey) {
        config = { provider: provider as any, apiKey: platformKey, modelName, baseUrl: settings?.baseUrl || undefined };
      }
    } else {
      // BYOK mode: use customer's encrypted API key
      if (settings && settings.apiKey) {
        let apiKey = settings.apiKey;
        try { apiKey = decryptCredential(settings.apiKey); } catch { /* use as-is */ }
        config = { provider: provider as any, apiKey, modelName, baseUrl: settings?.baseUrl || undefined };
      }
    }

    return { ai: new WebsiteAIService(config), billingMode: balance.billingMode, provider, modelName };
  }

  // Helper: verify project ownership
  async function getOwnedProject(uuid: string, customerId: number) {
    return db.query.websiteProjects.findFirst({
      where: and(
        eq(schema.websiteProjects.uuid, uuid),
        eq(schema.websiteProjects.customerId, customerId),
        sql`${schema.websiteProjects.deletedAt} IS NULL`,
      ),
    });
  }

  // ---- Templates list ----
  app.get('/api/v1/website-builder/templates', asyncHandler(async (_req, res) => {
    res.json(successResponse(allTemplates.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category, thumbnail: t.thumbnail }))));
  }));

  // ---- Project CRUD ----
  app.get('/api/v1/website-builder/projects', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const projects = await db.query.websiteProjects.findMany({
      where: and(eq(schema.websiteProjects.customerId, req.user!.userId), sql`${schema.websiteProjects.deletedAt} IS NULL`),
      orderBy: desc(schema.websiteProjects.createdAt),
    });
    // Attach page count
    const result = [];
    for (const p of projects) {
      const pages = await db.query.websitePages.findMany({ where: eq(schema.websitePages.projectId, p.id) });
      result.push({ ...p, pagesCount: pages.length });
    }
    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    // Plan enforcement: check site limit
    const siteCheck = await planEnforcement.checkSiteLimit(req.user!.userId);
    if (!siteCheck.allowed) return res.status(403).json(errorResponse(siteCheck.reason!));

    const { name, template, customDomain, businessType, businessDescription } = req.body;

    // Generate slug from name
    const baseSlug = (name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    const existing = await db.query.websiteProjects.findFirst({ where: eq(schema.websiteProjects.slug, baseSlug) });
    const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const [project] = await db.insert(schema.websiteProjects).values({
      customerId: req.user!.userId,
      name,
      slug,
      template: template || 'blank',
      customDomain,
      businessType,
      businessDescription,
      status: 'draft',
      theme: defaultTheme,
    }).returning();

    // If template selected, populate pages from template
    if (template && template !== 'blank') {
      const tpl = getTemplateById(template);
      if (tpl) {
        await db.update(schema.websiteProjects).set({ theme: tpl.theme }).where(eq(schema.websiteProjects.id, project.id));
        for (let i = 0; i < tpl.pages.length; i++) {
          const page = tpl.pages[i];
          // Replace {businessName} placeholders
          const blocks = JSON.parse(JSON.stringify(page.blocks).replace(/\{businessName\}/g, name || 'My Website'));
          await db.insert(schema.websitePages).values({
            projectId: project.id,
            slug: page.slug,
            title: page.title,
            sortOrder: i,
            isHomePage: page.isHomePage,
            showInNav: page.showInNav,
            blocks,
          });
        }
      }
    }

    res.status(201).json(successResponse(project));
  }));

  app.get('/api/v1/website-builder/projects/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    res.json(successResponse({ ...project, pages }));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { name, theme, globalSeo, businessType, businessDescription } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (theme !== undefined) updates.theme = theme;
    if (globalSeo !== undefined) updates.globalSeo = globalSeo;
    if (businessType !== undefined) updates.businessType = businessType;
    if (businessDescription !== undefined) updates.businessDescription = businessDescription;

    const [updated] = await db.update(schema.websiteProjects).set(updates).where(eq(schema.websiteProjects.id, project.id)).returning();
    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    await db.update(schema.websiteProjects).set({ deletedAt: new Date(), status: 'archived' }).where(eq(schema.websiteProjects.id, project.id));
    res.json(successResponse(null, 'Project deleted'));
  }));

  // ---- Page CRUD ----
  app.get('/api/v1/website-builder/projects/:uuid/pages', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });
    res.json(successResponse(pages));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/pages', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    // Plan enforcement: check page limit
    const pageCheck = await planEnforcement.checkPageLimit(req.user!.userId, project.id);
    if (!pageCheck.allowed) return res.status(403).json(errorResponse(pageCheck.reason!));

    const { slug, title, blocks, isHomePage, showInNav } = req.body;
    const maxSort = await db.query.websitePages.findFirst({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: desc(schema.websitePages.sortOrder),
    });

    const [page] = await db.insert(schema.websitePages).values({
      projectId: project.id,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      isHomePage: isHomePage || false,
      showInNav: showInNav !== false,
      blocks: blocks || [],
    }).returning();

    res.status(201).json(successResponse(page));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/pages/:pageSlug', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));
    res.json(successResponse(page));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/pages/:pageSlug', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));

    const { title, blocks, seo, showInNav } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (blocks !== undefined) updates.blocks = blocks;
    if (seo !== undefined) updates.seo = seo;
    if (showInNav !== undefined) updates.showInNav = showInNav;

    const [updated] = await db.update(schema.websitePages).set(updates).where(eq(schema.websitePages.id, page.id)).returning();
    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid/pages/:pageSlug', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));

    await db.delete(schema.websitePages).where(eq(schema.websitePages.id, page.id));
    res.json(successResponse(null, 'Page deleted'));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/pages/reorder', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { order } = req.body; // array of { slug, sortOrder }
    for (const item of order || []) {
      await db.update(schema.websitePages)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, item.slug)));
    }
    res.json(successResponse(null, 'Pages reordered'));
  }));

  // ---- AI Endpoints ----
  // Helper: log AI usage and deduct credits if applicable
  async function logAiUsageAndDeduct(customerId: number, billingMode: string, provider: string, modelName: string, action: string, usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined, projectId?: number, startTime?: number) {
    if (!usage || (usage.inputTokens === 0 && usage.outputTokens === 0)) return;

    const cost = aiCreditsService.calculateCost(modelName, usage.inputTokens, usage.outputTokens);
    const durationMs = startTime ? Date.now() - startTime : undefined;

    // Log usage
    const [log] = await db.insert(schema.aiUsageLogs).values({
      customerId,
      provider,
      modelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      inputCostCents: cost.inputCostCents,
      outputCostCents: cost.outputCostCents,
      totalCostCents: cost.totalCostCents,
      marginCents: cost.marginCents,
      action,
      projectId: projectId ?? null,
      billingMode,
      durationMs: durationMs ?? null,
      success: true,
    }).returning();

    // Deduct credits if in credits mode
    if (billingMode === 'credits' && cost.totalCostCents > 0) {
      await aiCreditsService.deductCredits({
        customerId,
        amountCents: cost.totalCostCents,
        description: `${action} — ${modelName} (${usage.totalTokens} tokens)`,
        aiUsageLogId: log.id,
        metadata: { provider, modelName, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      });
      // Check auto-top-up
      await aiCreditsService.checkAutoTopup(customerId);
    }
  }

  // ---- Onboarding Chat (Coach Green) ----
  app.post('/api/v1/website-builder/onboarding/chat', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { message, step, context } = req.body;
    const startTime = Date.now();

    const result = await ai.onboardingChat({ message, step: step || 'greeting', context: context || {} });

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'onboarding_chat', result.usage, undefined, startTime);

    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/generate', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    // Check credits before proceeding
    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 5); // estimate ~5 cents
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { businessName, businessType, businessDescription, style, selectedPages } = req.body;
    const startTime = Date.now();

    const result = await ai.generateWebsite({
      businessName: businessName || project.name,
      businessType: businessType || project.businessType || 'business',
      businessDescription: businessDescription || project.businessDescription,
      style,
      selectedPages,
    });

    // Log usage and deduct credits
    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'generate_website', result.usage, project.id, startTime);

    // Save theme to project
    await db.update(schema.websiteProjects).set({
      theme: result.theme,
      aiGenerated: true,
      businessType: businessType || project.businessType,
      businessDescription: businessDescription || project.businessDescription,
      updatedAt: new Date(),
    }).where(eq(schema.websiteProjects.id, project.id));

    // Delete existing pages and replace with generated ones
    await db.delete(schema.websitePages).where(eq(schema.websitePages.projectId, project.id));
    for (let i = 0; i < result.pages.length; i++) {
      const page = result.pages[i];
      await db.insert(schema.websitePages).values({
        projectId: project.id,
        slug: page.slug,
        title: page.title,
        sortOrder: i,
        isHomePage: page.isHomePage,
        showInNav: page.showInNav,
        blocks: page.blocks,
      });
    }

    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/chat', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 2);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const { message, history } = req.body;
    const siteContext = {
      businessName: project.name,
      businessType: project.businessType || 'business',
      pages: pages.map(p => ({ slug: p.slug, title: p.title, blocks: (p.blocks || []) as any[] })),
    };

    const startTime = Date.now();
    const result = await ai.coachChat(message, siteContext, history || []);

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'coach_chat', result.usage, project.id, startTime);

    // Store in AI session
    let session = await db.query.websiteAiSessions.findFirst({
      where: eq(schema.websiteAiSessions.projectId, project.id),
    });

    const newMessages = [
      ...(history || []),
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: result.message, timestamp: new Date().toISOString() },
    ];

    if (session) {
      await db.update(schema.websiteAiSessions).set({ messages: newMessages, updatedAt: new Date() }).where(eq(schema.websiteAiSessions.id, session.id));
    } else {
      await db.insert(schema.websiteAiSessions).values({ projectId: project.id, messages: newMessages });
    }

    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/generate-block', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { type } = req.body;
    const startTime = Date.now();
    const block = await ai.generateBlock(type, { businessName: project.name, businessType: project.businessType || 'business' });

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'generate_block', (block as any).usage, project.id, startTime);

    res.json(successResponse(block));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/rewrite', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { block, instruction } = req.body;
    const startTime = Date.now();
    const result = await ai.rewriteContent(block, instruction);

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'rewrite_content', (result as any).usage, project.id, startTime);

    res.json(successResponse(result));
  }));

  // ---- AI Generate SEO ----
  app.post('/api/v1/website-builder/projects/:uuid/ai/generate-seo', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const startTime = Date.now();
    const result = await ai.generateSeo(
      pages.map(p => ({ slug: p.slug, title: p.title, blocks: (p.blocks || []) as any[] })),
      { businessName: project.name, businessType: project.businessType || 'business' },
    );

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'generate_seo', result.usage, project.id, startTime);

    res.json(successResponse(result));
  }));

  // ---- AI Provider Settings ----
  app.get('/api/v1/ai/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const settings = await db.query.aiProviderSettings.findFirst({
      where: eq(schema.aiProviderSettings.customerId, req.user!.userId),
    });
    if (!settings) return res.json(successResponse(null));
    // Don't send full API key to client
    const masked = settings.apiKey ? `${settings.apiKey.substring(0, 8)}${'*'.repeat(20)}` : '';
    res.json(successResponse({ ...settings, apiKey: masked }));
  }));

  app.put('/api/v1/ai/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { provider, apiKey, modelName, baseUrl } = req.body;

    const existing = await db.query.aiProviderSettings.findFirst({
      where: eq(schema.aiProviderSettings.customerId, req.user!.userId),
    });

    const encryptedKey = apiKey && !apiKey.includes('*') ? encryptCredential(apiKey) : undefined;

    if (existing) {
      const updates: Record<string, any> = { provider, modelName, baseUrl, updatedAt: new Date() };
      if (encryptedKey) updates.apiKey = encryptedKey;
      const [updated] = await db.update(schema.aiProviderSettings).set(updates).where(eq(schema.aiProviderSettings.id, existing.id)).returning();
      res.json(successResponse(updated));
    } else {
      const [created] = await db.insert(schema.aiProviderSettings).values({
        customerId: req.user!.userId,
        provider,
        apiKey: encryptedKey || '',
        modelName,
        baseUrl,
      }).returning();
      res.json(successResponse(created));
    }
  }));

  app.post('/api/v1/ai/settings/test', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { provider, apiKey, modelName, baseUrl } = req.body;
    const result = await testProviderConnection({ provider, apiKey, modelName, baseUrl });
    res.json(successResponse(result));
  }));

  // ---- AI Models ----
  app.get('/api/v1/ai/models', authenticateToken, requireAuth, asyncHandler(async (_req, res) => {
    res.json(successResponse({
      models: aiCreditsService.getAvailableModels(),
      pricing: aiCreditsService.getModelPricing(),
    }));
  }));

  // ---- AI Credits / Billing ----
  app.get('/api/v1/ai/credits/balance', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const balance = await aiCreditsService.getBalance(req.user!.userId);
    res.json(successResponse(balance));
  }));

  app.post('/api/v1/ai/credits/purchase', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { amountCents } = req.body;
    if (!amountCents || amountCents < 500) {
      return res.status(400).json(errorResponse('Minimum purchase is $5.00 (500 cents)'));
    }

    // Create order through the existing pipeline
    const orderNumber = `HB${Date.now().toString(36).toUpperCase()}`;
    const [order] = await db.insert(schema.orders).values({
      customerId: req.user!.userId,
      orderNumber,
      status: 'draft',
      subtotal: amountCents,
      discountAmount: 0,
      taxAmount: 0,
      total: amountCents,
      currency: 'USD',
    }).returning();

    await db.insert(schema.orderItems).values({
      orderId: order.id,
      itemType: 'ai_credits',
      description: `AI Credits: $${(amountCents / 100).toFixed(2)}`,
      unitPrice: amountCents,
      quantity: 1,
      totalPrice: amountCents,
      configuration: { amountCents },
    });

    res.status(201).json(successResponse({ order }));
  }));

  app.get('/api/v1/ai/credits/transactions', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const transactions = await aiCreditsService.getTransactions(req.user!.userId, limit, offset);
    res.json(successResponse(transactions));
  }));

  app.get('/api/v1/ai/credits/usage/daily', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const usage = await aiCreditsService.getDailyUsage(req.user!.userId, days);
    res.json(successResponse(usage));
  }));

  app.get('/api/v1/ai/credits/usage/models', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const breakdown = await aiCreditsService.getModelBreakdown(req.user!.userId, days);
    res.json(successResponse(breakdown));
  }));

  app.put('/api/v1/ai/credits/auto-topup', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { enabled, thresholdCents, amountCents } = req.body;
    const balance = await aiCreditsService.updateAutoTopupSettings(req.user!.userId, {
      enabled: !!enabled,
      thresholdCents,
      amountCents,
    });
    res.json(successResponse(balance));
  }));

  app.put('/api/v1/ai/credits/spending-limit', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { limitCents, period } = req.body;
    const balance = await aiCreditsService.updateSpendingLimit(
      req.user!.userId,
      limitCents === null || limitCents === undefined ? null : parseInt(limitCents),
      period || 'monthly',
    );
    res.json(successResponse(balance));
  }));

  app.put('/api/v1/ai/credits/billing-mode', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { mode } = req.body;
    if (mode !== 'credits' && mode !== 'byok') {
      return res.status(400).json(errorResponse('Mode must be "credits" or "byok"'));
    }
    const balance = await aiCreditsService.updateBillingMode(req.user!.userId, mode);
    res.json(successResponse(balance));
  }));

  // ---- Quick Purchase Credits (in-editor) ----
  app.post('/api/v1/ai/credits/quick-purchase', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { amountCents } = req.body;
    if (!amountCents || amountCents < 100) {
      return res.status(400).json(errorResponse('Minimum purchase is $1.00 (100 cents)'));
    }
    if (amountCents > 10000) {
      return res.status(400).json(errorResponse('Maximum quick-purchase is $100.00'));
    }

    // Create an order for AI credits
    const orderNumber = `HB${Date.now().toString(36).toUpperCase()}`;
    const [order] = await db.insert(schema.orders).values({
      customerId: req.user!.userId,
      orderNumber,
      status: 'pending_payment',
      subtotal: amountCents,
      total: amountCents,
      currency: 'USD',
    }).returning();

    await db.insert(schema.orderItems).values({
      orderId: order.id,
      itemType: 'ai_credits',
      description: `AI Credits - $${(amountCents / 100).toFixed(2)}`,
      unitPrice: amountCents,
      quantity: 1,
      totalPrice: amountCents,
      configuration: { amountCents },
    });

    // Create payment session
    const { getPaymentProvider } = await import('../services/payment/payment-service.js');
    const paymentProvider = getPaymentProvider();
    const baseUrl = process.env.BASE_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;

    const paymentUrl = await paymentProvider.createPaymentSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: amountCents,
      currency: 'USD',
      customerEmail: req.user!.email || '',
      successUrl: `${baseUrl}/checkout/success?order=${order.uuid}`,
      cancelUrl: `${baseUrl}/checkout/cancel?order=${order.uuid}`,
      webhookUrl: `${process.env.APP_URL || baseUrl}/api/v1/webhooks/payment`,
    });

    res.json(successResponse({ paymentUrl, orderUuid: order.uuid }));
  }));

  // ---- Publishing ----
  app.post('/api/v1/website-builder/projects/:uuid/publish', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const slug = project.slug || project.uuid;
    const publishedUrl = `${slug}.sites.hostsblue.com`;

    const [updated] = await db.update(schema.websiteProjects)
      .set({ status: 'published', publishedUrl, publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.websiteProjects.id, project.id))
      .returning();

    res.json(successResponse(updated, 'Project published'));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/preview', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const pageSlug = (req.query.page as string) || 'home';
    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));

    const theme = (project.theme || defaultTheme) as any;
    const html = renderPage((page.blocks || []) as any[], {
      theme,
      businessName: project.name,
      seo: (page.seo || {}) as any,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }));

  // ---- Form Submissions ----
  app.post('/api/v1/sites/:slug/forms', rateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many form submissions' }), asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const { name, email, message, pageSlug, ...extra } = req.body;
    const [submission] = await db.insert(schema.formSubmissions).values({
      projectId: project.id,
      pageSlug: pageSlug || null,
      name: (name || '').slice(0, 200),
      email: (email || '').slice(0, 255),
      message: (message || '').slice(0, 5000),
      data: extra || {},
      ipAddress: (req.ip || req.socket.remoteAddress || '').slice(0, 45),
    }).returning();

    res.status(201).json(successResponse({ id: submission.uuid }, 'Submission received'));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/submissions', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const submissions = await db.query.formSubmissions.findMany({
      where: eq(schema.formSubmissions.projectId, project.id),
      orderBy: desc(schema.formSubmissions.createdAt),
    });
    res.json(successResponse(submissions));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid/submissions/:id', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const subId = parseInt(req.params.id);
    if (isNaN(subId)) return res.status(400).json(errorResponse('Invalid submission ID'));

    await db.delete(schema.formSubmissions).where(
      and(eq(schema.formSubmissions.id, subId), eq(schema.formSubmissions.projectId, project.id)),
    );
    res.json(successResponse(null, 'Submission deleted'));
  }));

  // ---- Builder Plan ----
  app.get('/api/v1/website-builder/plan', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const sub = await db.query.builderSubscriptions.findFirst({
      where: eq(schema.builderSubscriptions.customerId, req.user!.userId),
    });

    const { getPlanLimits } = await import('../../shared/builder-plans.js');
    const plan = sub?.plan || 'starter';
    const limits = getPlanLimits(plan);

    // Count current sites
    const projects = await db.query.websiteProjects.findMany({
      where: and(eq(schema.websiteProjects.customerId, req.user!.userId), sql`${schema.websiteProjects.deletedAt} IS NULL`),
    });

    res.json(successResponse({
      plan,
      status: sub?.status || 'active',
      limits,
      usage: { sites: projects.length },
      expiresAt: sub?.expiresAt,
    }));
  }));

  // ---- Agency Clients ----
  app.get('/api/v1/website-builder/clients', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'client-management');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const clients = await db.query.agencyClients.findMany({
      where: eq(schema.agencyClients.agencyCustomerId, req.user!.userId),
      orderBy: desc(schema.agencyClients.createdAt),
    });
    res.json(successResponse(clients));
  }));

  app.post('/api/v1/website-builder/clients/invite', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'client-management');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const { email } = req.body;
    if (!email) return res.status(400).json(errorResponse('Email is required'));

    // Check for existing invite
    const existing = await db.query.agencyClients.findFirst({
      where: and(
        eq(schema.agencyClients.agencyCustomerId, req.user!.userId),
        eq(schema.agencyClients.clientEmail, email),
      ),
    });
    if (existing) return res.status(409).json(errorResponse('Client already invited'));

    const inviteToken = crypto.randomBytes(32).toString('hex');

    // Check if the email matches an existing customer
    const existingCustomer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    const [client] = await db.insert(schema.agencyClients).values({
      agencyCustomerId: req.user!.userId,
      clientCustomerId: existingCustomer?.id || null,
      clientEmail: email,
      inviteToken,
      inviteStatus: existingCustomer ? 'accepted' : 'pending',
      permissions: ['view', 'edit'],
    }).returning();

    res.status(201).json(successResponse(client));
  }));

  app.delete('/api/v1/website-builder/clients/:id', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json(errorResponse('Invalid ID'));

    await db.delete(schema.agencyClients).where(
      and(eq(schema.agencyClients.id, id), eq(schema.agencyClients.agencyCustomerId, req.user!.userId)),
    );
    res.json(successResponse(null, 'Client removed'));
  }));

  app.post('/api/v1/website-builder/clients/accept-invite', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json(errorResponse('Token is required'));

    const invite = await db.query.agencyClients.findFirst({
      where: and(eq(schema.agencyClients.inviteToken, token), eq(schema.agencyClients.inviteStatus, 'pending')),
    });
    if (!invite) return res.status(404).json(errorResponse('Invalid or expired invitation'));

    const [updated] = await db.update(schema.agencyClients)
      .set({ clientCustomerId: req.user!.userId, inviteStatus: 'accepted', inviteToken: null, updatedAt: new Date() })
      .where(eq(schema.agencyClients.id, invite.id))
      .returning();

    res.json(successResponse(updated));
  }));

  // ---- Store Settings ----
  app.get('/api/v1/website-builder/projects/:uuid/store/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    let settings = await db.query.storeSettings.findFirst({
      where: eq(schema.storeSettings.projectId, project.id),
    });

    if (!settings) {
      [settings] = await db.insert(schema.storeSettings).values({ projectId: project.id }).returning();
    }

    res.json(successResponse(settings));
  }));

  app.put('/api/v1/website-builder/projects/:uuid/store/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'ecommerce');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const { currency, taxRate, shippingOptions, paymentEnabled } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (currency !== undefined) updates.currency = currency;
    if (taxRate !== undefined) updates.taxRate = String(taxRate);
    if (shippingOptions !== undefined) updates.shippingOptions = shippingOptions;
    if (paymentEnabled !== undefined) updates.paymentEnabled = paymentEnabled;

    let settings = await db.query.storeSettings.findFirst({
      where: eq(schema.storeSettings.projectId, project.id),
    });

    if (settings) {
      [settings] = await db.update(schema.storeSettings).set(updates).where(eq(schema.storeSettings.id, settings.id)).returning();
    } else {
      [settings] = await db.insert(schema.storeSettings).values({ projectId: project.id, ...updates }).returning();
    }

    res.json(successResponse(settings));
  }));

  // ---- Store Products ----
  app.get('/api/v1/website-builder/projects/:uuid/store/products', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const products = await db.query.storeProducts.findMany({
      where: eq(schema.storeProducts.projectId, project.id),
      orderBy: desc(schema.storeProducts.createdAt),
    });
    res.json(successResponse(products));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/store/products', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { name, description, price, compareAtPrice, images, variants, inventory, categoryId } = req.body;
    if (!name || price === undefined) return res.status(400).json(errorResponse('Name and price are required'));

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200);

    const [product] = await db.insert(schema.storeProducts).values({
      projectId: project.id,
      name,
      slug,
      description,
      price: parseInt(price),
      compareAtPrice: compareAtPrice ? parseInt(compareAtPrice) : null,
      images: images || [],
      variants: variants || [],
      inventory: inventory ?? null,
      categoryId: categoryId || null,
    }).returning();

    res.status(201).json(successResponse(product));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/store/products/:productUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const product = await db.query.storeProducts.findFirst({
      where: and(eq(schema.storeProducts.uuid, req.params.productUuid), eq(schema.storeProducts.projectId, project.id)),
    });
    if (!product) return res.status(404).json(errorResponse('Product not found'));
    res.json(successResponse(product));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/store/products/:productUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const product = await db.query.storeProducts.findFirst({
      where: and(eq(schema.storeProducts.uuid, req.params.productUuid), eq(schema.storeProducts.projectId, project.id)),
    });
    if (!product) return res.status(404).json(errorResponse('Product not found'));

    const { name, description, price, compareAtPrice, images, variants, inventory, categoryId, isActive } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) { updates.name = name; updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200); }
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseInt(price);
    if (compareAtPrice !== undefined) updates.compareAtPrice = compareAtPrice ? parseInt(compareAtPrice) : null;
    if (images !== undefined) updates.images = images;
    if (variants !== undefined) updates.variants = variants;
    if (inventory !== undefined) updates.inventory = inventory;
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(schema.storeProducts).set(updates).where(eq(schema.storeProducts.id, product.id)).returning();
    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid/store/products/:productUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    await db.delete(schema.storeProducts).where(
      and(eq(schema.storeProducts.uuid, req.params.productUuid), eq(schema.storeProducts.projectId, project.id)),
    );
    res.json(successResponse(null, 'Product deleted'));
  }));

  // ---- Store Categories ----
  app.get('/api/v1/website-builder/projects/:uuid/store/categories', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const categories = await db.query.storeCategories.findMany({
      where: eq(schema.storeCategories.projectId, project.id),
      orderBy: schema.storeCategories.sortOrder,
    });
    res.json(successResponse(categories));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/store/categories', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { name } = req.body;
    if (!name) return res.status(400).json(errorResponse('Name is required'));

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [category] = await db.insert(schema.storeCategories).values({ projectId: project.id, name, slug }).returning();
    res.status(201).json(successResponse(category));
  }));

  // ---- Store Orders ----
  app.get('/api/v1/website-builder/projects/:uuid/store/orders', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const orders = await db.query.storeOrders.findMany({
      where: eq(schema.storeOrders.projectId, project.id),
      orderBy: desc(schema.storeOrders.createdAt),
      with: { items: true },
    });
    res.json(successResponse(orders));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/store/orders/:orderUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const order = await db.query.storeOrders.findFirst({
      where: and(eq(schema.storeOrders.uuid, req.params.orderUuid), eq(schema.storeOrders.projectId, project.id)),
      with: { items: true },
    });
    if (!order) return res.status(404).json(errorResponse('Order not found'));
    res.json(successResponse(order));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/store/orders/:orderUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const order = await db.query.storeOrders.findFirst({
      where: and(eq(schema.storeOrders.uuid, req.params.orderUuid), eq(schema.storeOrders.projectId, project.id)),
    });
    if (!order) return res.status(404).json(errorResponse('Order not found'));

    const { status } = req.body;
    const [updated] = await db.update(schema.storeOrders).set({ status, updatedAt: new Date() }).where(eq(schema.storeOrders.id, order.id)).returning();
    res.json(successResponse(updated));
  }));

  // ---- Public Storefront API ----
  app.get('/api/v1/sites/:slug/store/products', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const category = req.query.category as string;

    let products = await db.query.storeProducts.findMany({
      where: and(eq(schema.storeProducts.projectId, project.id), eq(schema.storeProducts.isActive, true)),
      orderBy: desc(schema.storeProducts.createdAt),
    });

    if (category) {
      const cat = await db.query.storeCategories.findFirst({
        where: and(eq(schema.storeCategories.projectId, project.id), eq(schema.storeCategories.slug, category)),
      });
      if (cat) products = products.filter(p => p.categoryId === cat.id);
    }

    res.json(successResponse(products.slice(0, limit)));
  }));

  app.post('/api/v1/sites/:slug/store/checkout', rateLimiter({ windowMs: 60 * 1000, max: 10 }), asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const { items, customerEmail, customerName, shippingAddress } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json(errorResponse('Items are required'));
    if (!customerEmail) return res.status(400).json(errorResponse('Email is required'));

    const storeConf = await db.query.storeSettings.findFirst({
      where: eq(schema.storeSettings.projectId, project.id),
    });

    let subtotal = 0;
    const orderItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; totalPrice: number; variant: any }> = [];

    for (const item of items) {
      const product = await db.query.storeProducts.findFirst({
        where: and(eq(schema.storeProducts.projectId, project.id), eq(schema.storeProducts.slug, item.slug), eq(schema.storeProducts.isActive, true)),
      });
      if (!product) continue;
      const qty = Math.max(1, Math.min(item.quantity || 1, 99));
      const lineTotal = product.price * qty;
      subtotal += lineTotal;
      orderItems.push({ productId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, totalPrice: lineTotal, variant: item.variant || null });
    }

    if (orderItems.length === 0) return res.status(400).json(errorResponse('No valid products'));

    const taxRate = parseFloat(String(storeConf?.taxRate || '0'));
    const tax = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + tax;
    const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;

    const [order] = await db.insert(schema.storeOrders).values({
      projectId: project.id,
      orderNumber,
      status: 'pending',
      customerEmail,
      customerName,
      shippingAddress,
      subtotal,
      tax,
      shipping: 0,
      total,
    }).returning();

    for (const item of orderItems) {
      await db.insert(schema.storeOrderItems).values({ orderId: order.id, ...item });
    }

    res.status(201).json(successResponse({ order: { uuid: order.uuid, orderNumber, total } }));
  }));

  // ---- Custom Domain Binding ----
  app.patch('/api/v1/website-builder/projects/:uuid/domain', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'custom-domain');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const { domain } = req.body;
    if (!domain || domain.length > 253) return res.status(400).json(errorResponse('Invalid domain'));

    const verifyToken = crypto.randomBytes(16).toString('hex');

    const [updated] = await db.update(schema.websiteProjects)
      .set({
        customDomain: domain,
        settings: { ...(project.settings as any || {}), domainVerifyToken: verifyToken, domainVerified: false },
        updatedAt: new Date(),
      })
      .where(eq(schema.websiteProjects.id, project.id))
      .returning();

    res.json(successResponse({
      domain,
      verifyToken,
      dnsInstructions: `Add a TXT record to ${domain} with value: hostsblue-verify=${verifyToken}`,
    }));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/domain/verify', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const settings = (project.settings || {}) as any;
    const verifyToken = settings.domainVerifyToken;
    const domain = project.customDomain;
    if (!domain || !verifyToken) return res.status(400).json(errorResponse('No domain configured'));

    try {
      const dns = await import('dns');
      const records = await dns.promises.resolveTxt(domain);
      const found = records.flat().some(r => r === `hostsblue-verify=${verifyToken}`);

      if (found) {
        await db.update(schema.websiteProjects)
          .set({ settings: { ...settings, domainVerified: true }, updatedAt: new Date() })
          .where(eq(schema.websiteProjects.id, project.id));
        res.json(successResponse({ verified: true }));
      } else {
        res.json(successResponse({ verified: false, message: 'TXT record not found. It may take up to 48 hours for DNS to propagate.' }));
      }
    } catch {
      res.json(successResponse({ verified: false, message: 'Could not resolve DNS for this domain.' }));
    }
  }));

  // ---- Project Settings (White-Label, etc.) ----
  app.patch('/api/v1/website-builder/projects/:uuid/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const currentSettings = (project.settings || {}) as any;
    const newSettings = { ...currentSettings, ...req.body };

    // White-label requires agency plan
    if (req.body.whiteLabel !== undefined) {
      const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'white-label');
      if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));
    }

    const [updated] = await db.update(schema.websiteProjects)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(schema.websiteProjects.id, project.id))
      .returning();

    res.json(successResponse(updated));
  }));

  // ---- Analytics ----
  app.post('/api/v1/analytics/collect', rateLimiter({ windowMs: 60 * 1000, max: 60, message: 'Too many requests' }), asyncHandler(async (req, res) => {
    const { slug, pageSlug, sessionId, referrer } = req.body;
    if (!slug) return res.status(400).json(errorResponse('Missing slug'));

    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const ua = req.headers['user-agent'] || '';
    let device = 'desktop';
    if (/mobile/i.test(ua)) device = 'mobile';
    else if (/tablet|ipad/i.test(ua)) device = 'tablet';

    let browser = 'other';
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edge/i.test(ua)) browser = 'Edge';

    await db.insert(schema.siteAnalytics).values({
      projectId: project.id,
      pageSlug: (pageSlug || 'home').slice(0, 100),
      sessionId: (sessionId || '').slice(0, 64),
      referrer: (referrer || '').slice(0, 500),
      device,
      browser,
    });

    // Trigger daily aggregation async
    const today = new Date().toISOString().slice(0, 10);
    analyticsAggregation.aggregateDaily(project.id, today).catch(() => {});

    res.json(successResponse(null));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/analytics', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const analytics = await analyticsAggregation.getDailySummary(project.id, days);
    res.json(successResponse(analytics));
  }));

  // ============================================================================
  // CUSTOM DOMAINS (Website Builder)
  // ============================================================================

  // Set custom domain for a project
  app.patch('/api/v1/website-builder/projects/:uuid/domain', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json(errorResponse('Domain is required'));
    }

    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '');
    const verificationToken = `hostsblue-verify-${crypto.randomBytes(16).toString('hex')}`;

    // Check if domain is already claimed
    const existing = await db.query.customDomains.findFirst({
      where: eq(schema.customDomains.domain, cleanDomain),
    });
    if (existing && existing.projectId !== project.id) {
      return res.status(409).json(errorResponse('Domain is already connected to another project'));
    }

    if (existing && existing.projectId === project.id) {
      // Update existing record
      await db.update(schema.customDomains)
        .set({ domain: cleanDomain, verified: false, verifiedAt: null, updatedAt: new Date() })
        .where(eq(schema.customDomains.id, existing.id));
      res.json(successResponse({
        domain: cleanDomain,
        verificationToken: existing.verificationToken,
        verified: false,
        dnsInstructions: {
          type: 'TXT',
          name: '_hostsblue-verify',
          value: existing.verificationToken,
          cname: { name: cleanDomain, value: `${project.slug}.sites.hostsblue.com` },
        },
      }));
    } else {
      // Create new record
      const [record] = await db.insert(schema.customDomains).values({
        projectId: project.id,
        customerId: req.user!.userId,
        domain: cleanDomain,
        verificationToken,
      }).returning();

      // Also update the project's customDomain field
      await db.update(schema.websiteProjects)
        .set({ customDomain: cleanDomain, updatedAt: new Date() })
        .where(eq(schema.websiteProjects.id, project.id));

      res.json(successResponse({
        domain: cleanDomain,
        verificationToken: record.verificationToken,
        verified: false,
        dnsInstructions: {
          type: 'TXT',
          name: '_hostsblue-verify',
          value: record.verificationToken,
          cname: { name: cleanDomain, value: `${project.slug}.sites.hostsblue.com` },
        },
      }));
    }
  }));

  // Verify custom domain DNS
  app.post('/api/v1/website-builder/projects/:uuid/domain/verify', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const domainRecord = await db.query.customDomains.findFirst({
      where: eq(schema.customDomains.projectId, project.id),
    });
    if (!domainRecord) {
      return res.status(404).json(errorResponse('No custom domain configured'));
    }

    // DNS TXT lookup
    try {
      const dns = await import('dns');
      const records = await dns.promises.resolveTxt(`_hostsblue-verify.${domainRecord.domain}`);
      const flat = records.flat();
      const verified = flat.some(r => r === domainRecord.verificationToken);

      if (verified) {
        await db.update(schema.customDomains)
          .set({ verified: true, verifiedAt: new Date(), sslStatus: 'active', updatedAt: new Date() })
          .where(eq(schema.customDomains.id, domainRecord.id));

        res.json(successResponse({ verified: true, domain: domainRecord.domain }));
      } else {
        res.json(successResponse({ verified: false, domain: domainRecord.domain, message: 'TXT record not found. DNS changes may take up to 48 hours to propagate.' }));
      }
    } catch {
      res.json(successResponse({ verified: false, domain: domainRecord.domain, message: 'DNS lookup failed. Ensure the TXT record is set correctly.' }));
    }
  }));

  // Get custom domain status
  app.get('/api/v1/website-builder/projects/:uuid/domain', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const domainRecord = await db.query.customDomains.findFirst({
      where: eq(schema.customDomains.projectId, project.id),
    });

    if (!domainRecord) {
      return res.json(successResponse(null));
    }

    res.json(successResponse({
      domain: domainRecord.domain,
      verified: domainRecord.verified,
      verifiedAt: domainRecord.verifiedAt,
      sslStatus: domainRecord.sslStatus,
      verificationToken: domainRecord.verificationToken,
      dnsInstructions: {
        type: 'TXT',
        name: '_hostsblue-verify',
        value: domainRecord.verificationToken,
        cname: { name: domainRecord.domain, value: `${project.slug}.sites.hostsblue.com` },
      },
    }));
  }));

  // Remove custom domain
  app.delete('/api/v1/website-builder/projects/:uuid/domain', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    await db.delete(schema.customDomains).where(eq(schema.customDomains.projectId, project.id));
    await db.update(schema.websiteProjects)
      .set({ customDomain: null, updatedAt: new Date() })
      .where(eq(schema.websiteProjects.id, project.id));

    res.json(successResponse(null, 'Custom domain removed'));
  }));

  // ---- Published Site Serving ----

  // Sitemap.xml for published sites
  app.get('/sites/:slug/sitemap.xml', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).send('');

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const baseUrl = project.customDomain
      ? `https://${project.customDomain}`
      : `${process.env.APP_URL || 'https://hostsblue.com'}/sites/${project.slug}`;

    const urls = pages.map(p => {
      const loc = p.isHomePage ? baseUrl : `${baseUrl}/${p.slug}`;
      const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : '';
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>weekly</changefreq></url>`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  }));

  // Robots.txt for published sites
  app.get('/sites/:slug/robots.txt', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).send('');

    const baseUrl = project.customDomain
      ? `https://${project.customDomain}`
      : `${process.env.APP_URL || 'https://hostsblue.com'}/sites/${project.slug}`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }));

  app.get('/sites/:slug', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).send(site404Html());

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.isHomePage, true)),
    });
    if (!page) return res.status(404).send(site404Html());

    const allPages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const theme = (project.theme || defaultTheme) as any;
    const html = renderPage((page.blocks || []) as any[], {
      theme,
      businessName: project.name,
      seo: (page.seo || {}) as any,
      siteSlug: project.slug || '',
      pages: allPages.map(p => ({ slug: p.slug, title: p.title, showInNav: p.showInNav })),
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }));

  app.get('/sites/:slug/:pageSlug', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).send(site404Html());

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).send(site404Html());

    const allPages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const theme = (project.theme || defaultTheme) as any;
    const html = renderPage((page.blocks || []) as any[], {
      theme,
      businessName: project.name,
      seo: (page.seo || {}) as any,
      siteSlug: project.slug || '',
      pages: allPages.map(p => ({ slug: p.slug, title: p.title, showInNav: p.showInNav })),
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }));
}
