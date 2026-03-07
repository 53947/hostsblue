import { Express } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import { z } from 'zod';

export function registerSSLRoutes(app: Express, ctx: RouteContext) {
  const { db, opensrsSSL } = ctx;

  app.get('/api/v1/ssl/products', asyncHandler(async (req, res) => {
    const products = await opensrsSSL.getProducts();
    res.json(successResponse(products));
  }));

  // Get customer's SSL certificates
  app.get('/api/v1/ssl/certificates', requireAuth, asyncHandler(async (req, res) => {
    const certs = await db.query.sslCertificates.findMany({
      where: eq(schema.sslCertificates.customerId, req.user!.userId),
      orderBy: desc(schema.sslCertificates.createdAt),
    });
    res.json(successResponse(certs));
  }));

  // Get single SSL certificate
  app.get('/api/v1/ssl/certificates/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert) return res.status(404).json(errorResponse('Certificate not found'));

    // Fetch live DCV status from OpenSRS
    let dcvStatus: any = null;
    if (cert.openSrsOrderId && cert.status === 'pending') {
      try {
        dcvStatus = await opensrsSSL.getDcvStatus(cert.openSrsOrderId);
      } catch { /* non-critical */ }
    }

    res.json(successResponse({ ...cert, liveDcvStatus: dcvStatus }));
  }));

  // Order SSL certificate (provisions through OpenSRS)
  app.post('/api/v1/ssl/certificates', requireAuth, asyncHandler(async (req, res) => {
    const orderSslSchema = z.object({
      domainName: z.string().min(1).max(253),
      productType: z.enum(['dv', 'ov', 'ev', 'wildcard', 'san']).default('dv'),
      provider: z.string().default('sectigo'),
      csr: z.string().optional(),
      approverEmail: z.string().email().optional(),
      termYears: z.number().min(1).max(3).default(1),
      domainId: z.number().optional(),
      productId: z.string().optional(),
    });
    const { domainName, productType, provider, csr, approverEmail, termYears, domainId, productId } = orderSslSchema.parse(req.body);

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });
    if (!customer) return res.status(404).json(errorResponse('Customer not found'));

    const orderResult = await opensrsSSL.orderCertificate({
      productType: productType || 'dv',
      provider: provider || 'sectigo',
      domain: domainName,
      period: termYears || 1,
      csr: csr || '',
      approverEmail: approverEmail || customer.email,
      contacts: {
        admin: {
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email,
          phone: customer.phone || '',
        },
      },
    });

    const [cert] = await db.insert(schema.sslCertificates).values({
      customerId: req.user!.userId,
      domainId: domainId || null,
      domainName,
      type: productType || 'dv',
      provider: provider || 'sectigo',
      status: 'pending',
      openSrsOrderId: orderResult.orderId,
      productId: productId || null,
      providerName: provider || 'sectigo',
      validationLevel: productType || 'dv',
      csrPem: csr || null,
      approverEmail: approverEmail || customer.email,
      dcvMethod: 'email',
      dcvStatus: 'pending',
      termYears: termYears || 1,
    }).returning();

    res.status(201).json(successResponse(cert, 'SSL certificate ordered'));
  }));

  // Generate CSR for a certificate
  app.post('/api/v1/ssl/certificates/:uuid/generate-csr', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert) return res.status(404).json(errorResponse('Certificate not found'));

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });

    const { commonName, organization, country, state, locality } = req.body;
    const csrResult = await opensrsSSL.generateCSR({
      domain: commonName || cert.domainName || '',
      organization: organization || customer?.companyName || customer?.firstName || '',
      country: country || customer?.countryCode || 'US',
      state: state || customer?.state || '',
      city: locality || customer?.city || '',
    });

    // Store CSR and encrypted private key
    await db.update(schema.sslCertificates)
      .set({
        csrPem: csrResult.csr,
        privateKeyEncrypted: csrResult.privateKey,
        updatedAt: new Date(),
      })
      .where(eq(schema.sslCertificates.id, cert.id));

    res.json(successResponse({ csr: csrResult.csr }, 'CSR generated'));
  }));

  // Reissue SSL certificate
  app.post('/api/v1/ssl/certificates/:uuid/reissue', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert || !cert.openSrsOrderId) return res.status(404).json(errorResponse('Certificate not found'));

    const { newCsr } = req.body;
    if (!newCsr) return res.status(400).json(errorResponse('New CSR is required'));

    await opensrsSSL.reissueCertificate(cert.openSrsOrderId, newCsr);

    await db.update(schema.sslCertificates)
      .set({ csrPem: newCsr, status: 'pending', dcvStatus: 'pending', updatedAt: new Date() })
      .where(eq(schema.sslCertificates.id, cert.id));

    res.json(successResponse(null, 'Certificate reissue initiated'));
  }));

  // Generate CSR (standalone — not tied to an existing certificate)
  app.post('/api/v1/ssl/generate-csr', requireAuth, asyncHandler(async (req, res) => {
    const generateCsrSchema = z.object({
      domain: z.string().min(1).max(253),
      organization: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().max(2).optional(),
    });
    const data = generateCsrSchema.parse(req.body);

    const csrResult = await opensrsSSL.generateCSR(data);
    res.json(successResponse({ csr: csrResult.csr, privateKeyEncrypted: csrResult.privateKey }, 'CSR generated'));
  }));

  // Resend DCV email
  app.post('/api/v1/ssl/certificates/:uuid/resend-dcv', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert || !cert.openSrsOrderId) return res.status(404).json(errorResponse('Certificate not found'));

    await opensrsSSL.resendDcvEmail(cert.openSrsOrderId);

    res.json(successResponse(null, 'DCV email resent'));
  }));
}
