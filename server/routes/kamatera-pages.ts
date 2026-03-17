import { Express } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { createKamateraAuth } from '../middleware/kamatera-auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';

export function registerKamateraPageRoutes(app: Express, ctx: RouteContext) {
  const { db } = ctx;
  const kamateraAuth = createKamateraAuth(db);

  // Billing Profile — payment methods, billing address, invoice history
  app.get('/api/v1/kamatera/billing/profile', kamateraAuth, asyncHandler(async (req, res) => {
    const customer = (req as any).kamateraUser;

    // Get recent orders as invoice history (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.customerId, customer.id),
      ),
      orderBy: desc(schema.orders.createdAt),
      with: { items: true, payments: true },
    });

    // Filter to last 12 months in JS (more compatible)
    const invoices = orders.filter(o => o.createdAt && new Date(o.createdAt) >= twelveMonthsAgo);

    res.json(successResponse({
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName,
        phone: customer.phone,
        address1: customer.address1,
        address2: customer.address2,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        countryCode: customer.countryCode,
      },
      invoices,
    }));
  }));

  // Update billing address
  app.put('/api/v1/kamatera/billing/profile', kamateraAuth, asyncHandler(async (req, res) => {
    const customer = (req as any).kamateraUser;
    const { firstName, lastName, companyName, phone, address1, address2, city, state, postalCode, countryCode } = req.body;

    const [updated] = await db.update(schema.customers)
      .set({
        firstName: firstName ?? customer.firstName,
        lastName: lastName ?? customer.lastName,
        companyName: companyName ?? customer.companyName,
        phone: phone ?? customer.phone,
        address1: address1 ?? customer.address1,
        address2: address2 ?? customer.address2,
        city: city ?? customer.city,
        state: state ?? customer.state,
        postalCode: postalCode ?? customer.postalCode,
        countryCode: countryCode ?? customer.countryCode,
      })
      .where(eq(schema.customers.id, customer.id))
      .returning();

    res.json(successResponse(updated, 'Billing address updated'));
  }));

  // Support Tickets — list all tickets for customer
  app.get('/api/v1/kamatera/support/tickets', kamateraAuth, asyncHandler(async (req, res) => {
    const customer = (req as any).kamateraUser;

    const tickets = await db.query.supportTickets.findMany({
      where: eq(schema.supportTickets.customerId, customer.id),
      orderBy: desc(schema.supportTickets.updatedAt),
    });

    res.json(successResponse(tickets));
  }));

  // Create Ticket
  app.post('/api/v1/kamatera/support/tickets', kamateraAuth, asyncHandler(async (req, res) => {
    const customer = (req as any).kamateraUser;
    const { subject, category, priority, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json(errorResponse('Subject and description are required'));
    }
    if (description.length < 20) {
      return res.status(400).json(errorResponse('Description must be at least 20 characters'));
    }

    const [ticket] = await db.insert(schema.supportTickets).values({
      customerId: customer.id,
      subject,
      category: category || 'general',
      priority: priority || 'normal',
      status: 'open',
    }).returning();

    // Create initial message from the description
    await db.insert(schema.ticketMessages).values({
      ticketId: ticket.id,
      senderId: customer.id,
      senderType: 'customer',
      body: description,
    });

    res.status(201).json(successResponse(ticket, 'Ticket created successfully'));
  }));

  // Help Center — returns structured help content
  app.get('/api/v1/kamatera/help', kamateraAuth, asyncHandler(async (req, res) => {
    const customer = (req as any).kamateraUser;

    res.json(successResponse({
      customerEmail: customer.email,
      sections: helpSections,
    }));
  }));
}

const helpSections = [
  {
    title: 'Getting Started',
    items: [
      { question: 'How do I set up my cloud server?', answer: 'After purchasing a cloud hosting plan, your server is automatically provisioned. You can access your server details from the Kamatera cloud management panel. Initial setup typically takes 2-5 minutes.' },
      { question: 'How do I connect to my server via SSH?', answer: 'Use the SSH credentials provided in your server details. Open your terminal and run: ssh root@your-server-ip. You can also use an SSH client like PuTTY on Windows.' },
      { question: 'What operating systems are available?', answer: 'We offer a wide range of OS images including Ubuntu, CentOS, Debian, Windows Server, and more. You can select your preferred OS during server creation.' },
    ],
  },
  {
    title: 'Domains',
    items: [
      { question: 'How do I register a new domain?', answer: 'Navigate to the Domains section, search for your desired domain name, and follow the registration process. We support hundreds of TLDs including .com, .net, .org, and many more.' },
      { question: 'How do I transfer a domain to hostsblue?', answer: 'Go to Domains > Transfer, enter your domain name and authorization code from your current registrar. The transfer typically completes within 5-7 days.' },
      { question: 'How do I update my DNS records?', answer: 'Go to your domain management page, click on DNS Management, and add or edit records. Changes typically propagate within 24-48 hours.' },
    ],
  },
  {
    title: 'Hosting',
    items: [
      { question: 'What hosting plans are available?', answer: 'We offer shared hosting, VPS, and cloud hosting plans. Each plan includes SSD storage, free SSL, daily backups, and 24/7 monitoring. Visit our hosting page to compare plans.' },
      { question: 'How do I upgrade my hosting plan?', answer: 'Go to your hosting dashboard, select your account, and click Upgrade. You\'ll only be charged the prorated difference for the remainder of your billing cycle.' },
      { question: 'How do I access my hosting control panel?', answer: 'Your hosting control panel credentials are available in your hosting account details. Click "Open Control Panel" to access it directly from your dashboard.' },
    ],
  },
  {
    title: 'Email',
    items: [
      { question: 'How do I set up email for my domain?', answer: 'Go to Email in your dashboard, select your domain, and choose an email plan. We\'ll configure the MX records automatically. You can then create email accounts and access webmail.' },
      { question: 'How do I configure email on my phone or desktop?', answer: 'Use the following settings — Incoming: IMAP, mail.yourdomain.com, port 993 (SSL). Outgoing: SMTP, mail.yourdomain.com, port 465 (SSL). Use your full email address as the username.' },
      { question: 'What is the email storage limit?', answer: 'Storage limits depend on your email plan. Basic plans include 5GB per mailbox, Professional plans include 25GB, and Business plans include 50GB.' },
    ],
  },
  {
    title: 'SSL Certificates',
    items: [
      { question: 'Do I get a free SSL certificate?', answer: 'Yes, all hosting plans include a free SSL certificate that auto-renews. For additional domains or wildcard certificates, premium SSL options are available.' },
      { question: 'How do I install an SSL certificate?', answer: 'For hosted sites, SSL is configured automatically. For external certificates, go to SSL in your dashboard, upload your certificate files, and our system will install them.' },
      { question: 'My SSL certificate shows a warning. What do I do?', answer: 'This usually means the certificate needs renewal or there\'s a mixed content issue. Check that all resources on your site load over HTTPS. Contact support if the issue persists.' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { question: 'What payment methods do you accept?', answer: 'We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor.' },
      { question: 'How do I update my payment method?', answer: 'Go to Billing Profile to update your payment method. Your new card will be used for all future charges and subscription renewals.' },
      { question: 'How do I view my invoices?', answer: 'All invoices are available in your Billing Profile page. You can view and download invoices for the last 12 months.' },
      { question: 'What is your refund policy?', answer: 'We offer a 30-day money-back guarantee on most services. Refund requests can be submitted through a support ticket. Domain registrations are non-refundable.' },
    ],
  },
  {
    title: 'Support',
    items: [
      { question: 'How do I contact support?', answer: 'Create a support ticket from the My Tickets page. Our team typically responds within 2-4 hours during business hours. For urgent issues, mark your ticket as high priority.' },
      { question: 'What are your support hours?', answer: 'Our support team is available 24/7 for critical infrastructure issues. General support is available Monday-Friday, 9 AM - 6 PM EST.' },
      { question: 'How do I check the status of my ticket?', answer: 'Visit the My Tickets page to see all your tickets and their current status. You\'ll also receive email notifications when your ticket is updated.' },
    ],
  },
];
