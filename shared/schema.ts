import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  integer, 
  boolean, 
  timestamp, 
  jsonb,
  decimal,
  pgEnum,
  index,
  uniqueIndex,
  uuid as pgUuid,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// ============================================================================
// ENUMS
// ============================================================================

export const domainStatusEnum = pgEnum('domain_status', [
  'pending',           // Awaiting payment
  'active',            // Registered and active
  'expired',           // Registration expired
  'suspended',         // Suspended for violation
  'pending_transfer',  // Transfer in progress
  'pending_renewal',   // Renewal in progress
  'grace_period',      // Grace period after expiry
]);

export const hostingStatusEnum = pgEnum('hosting_status', [
  'pending',           // Awaiting payment
  'provisioning',      // Site being created
  'active',            // Site live
  'suspended',         // Payment issue or violation
  'cancelled',         // Cancelled by user
  'expired',           // Subscription expired
]);

export const orderStatusEnum = pgEnum('order_status', [
  'draft',             // Cart items, not submitted
  'pending_payment',   // Awaiting payment
  'payment_received',  // Payment confirmed, processing
  'processing',        // Fulfilling with partners
  'completed',         // All items provisioned
  'partial_failure',   // Some items failed
  'failed',            // All items failed
  'cancelled',         // Cancelled by user
  'refunded',          // Refunded
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'disputed',
]);

export const orderItemTypeEnum = pgEnum('order_item_type', [
  'domain_registration',
  'domain_transfer',
  'domain_renewal',
  'hosting_plan',
  'hosting_addon',
  'privacy_protection',
  'email_service',
  'ssl_certificate',
  'sitelock',
  'website_builder',
]);

export const tldCategoryEnum = pgEnum('tld_category', [
  'generic',           // .com, .net, .org
  'country',           // .us, .uk, .ca
  'premium',           // Premium TLDs
  'new',               // New gTLDs
  'special',           // Special purpose
]);

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  
  // Profile
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  companyName: varchar('company_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  
  // Default contact info for domain registrations
  address1: varchar('address1', { length: 255 }),
  address2: varchar('address2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  countryCode: varchar('country_code', { length: 2 }).default('US'),
  
  // Billing
  defaultPaymentMethodId: integer('default_payment_method_id'),
  
  // Account status
  isActive: boolean('is_active').default(true).notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  
  // Password reset
  resetToken: varchar('reset_token', { length: 255 }),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: index('customers_email_idx').on(table.email),
  uuidIdx: uniqueIndex('customers_uuid_idx').on(table.uuid),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  domains: many(domains),
  hostingAccounts: many(hostingAccounts),
  orders: many(orders),
  contacts: many(domainContacts),
}));

// ============================================================================
// DOMAIN CONTACTS (WHOIS data per domain)
// ============================================================================

export const domainContacts = pgTable('domain_contacts', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  
  // Contact type
  contactType: varchar('contact_type', { length: 20 }).notNull(), // owner, admin, tech, billing
  
  // Contact details
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  fax: varchar('fax', { length: 50 }),
  
  // Address
  address1: varchar('address1', { length: 255 }).notNull(),
  address2: varchar('address2', { length: 255 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  countryCode: varchar('country_code', { length: 2 }).notNull(),
  
  // Privacy
  isPrivate: boolean('is_private').default(false).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('domain_contacts_customer_idx').on(table.customerId),
}));

export const domainContactsRelations = relations(domainContacts, ({ one }) => ({
  customer: one(customers, {
    fields: [domainContacts.customerId],
    references: [customers.id],
  }),
}));

// ============================================================================
// TLD PRICING
// ============================================================================

export const tldPricing = pgTable('tld_pricing', {
  id: serial('id').primaryKey(),
  tld: varchar('tld', { length: 20 }).notNull().unique(), // .com, .net, etc
  category: tldCategoryEnum('category').default('generic').notNull(),
  
  // Pricing (in cents for precision)
  registrationPrice: integer('registration_price').notNull(), // HostsBlue retail price
  renewalPrice: integer('renewal_price').notNull(),
  transferPrice: integer('transfer_price').notNull(),
  restorePrice: integer('restore_price'), // Redemption fee
  
  // Cost from OpenSRS
  costPrice: integer('cost_price').notNull(),
  
  // Domain settings
  minRegistrationYears: integer('min_registration_years').default(1).notNull(),
  maxRegistrationYears: integer('max_registration_years').default(10).notNull(),
  requiresEppCode: boolean('requires_epp_code').default(true).notNull(),
  supportsPrivacy: boolean('supports_privacy').default(true).notNull(),
  privacyPrice: integer('privacy_price').default(0),
  
  // Features
  supportsDnssec: boolean('supports_dnssec').default(true).notNull(),
  supportsIdn: boolean('supports_idn').default(false).notNull(),
  
  // Grace periods (in days)
  addGracePeriodDays: integer('add_grace_period_days').default(5),
  renewGracePeriodDays: integer('renew_grace_period_days').default(30),
  autoRenewGracePeriodDays: integer('auto_renew_grace_period_days').default(30),
  redemptionGracePeriodDays: integer('redemption_grace_period_days').default(30),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  
  // Metadata
  description: text('description'),
  requirements: jsonb('requirements').default({}),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tldIdx: uniqueIndex('tld_pricing_tld_idx').on(table.tld),
  categoryIdx: index('tld_pricing_category_idx').on(table.category),
}));

// ============================================================================
// DOMAINS
// ============================================================================

export const domains = pgTable('domains', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  
  // Domain info
  domainName: varchar('domain_name', { length: 253 }).notNull(),
  tld: varchar('tld', { length: 20 }).notNull(),
  
  // Status
  status: domainStatusEnum('status').default('pending').notNull(),
  
  // Registration details
  registrationDate: timestamp('registration_date'),
  expiryDate: timestamp('expiry_date'),
  registrationPeriodYears: integer('registration_period_years').default(1),
  
  // Auto-renewal
  autoRenew: boolean('auto_renew').default(true).notNull(),
  autoRenewAttempts: integer('auto_renew_attempts').default(0),
  lastAutoRenewAttempt: timestamp('last_auto_renew_attempt'),
  
  // WHOIS Privacy
  privacyEnabled: boolean('privacy_enabled').default(false).notNull(),
  privacyExpiryDate: timestamp('privacy_expiry_date'),
  
  // Contact references
  ownerContactId: integer('owner_contact_id').references(() => domainContacts.id, { onDelete: 'set null' }),
  adminContactId: integer('admin_contact_id').references(() => domainContacts.id, { onDelete: 'set null' }),
  techContactId: integer('tech_contact_id').references(() => domainContacts.id, { onDelete: 'set null' }),
  billingContactId: integer('billing_contact_id').references(() => domainContacts.id, { onDelete: 'set null' }),
  
  // Nameservers
  nameservers: jsonb('nameservers').default([]),
  useHostsBlueNameservers: boolean('use_hostsblue_nameservers').default(true).notNull(),
  
  // DNS Zone (if using our nameservers)
  dnsZoneId: integer('dns_zone_id'),
  
  // External references
  opensrsOrderId: varchar('opensrs_order_id', { length: 100 }),
  opensrsDomainId: varchar('opensrs_domain_id', { length: 100 }),
  
  // Transfer specific
  isTransfer: boolean('is_transfer').default(false).notNull(),
  transferAuthCode: varchar('transfer_auth_code', { length: 100 }),
  transferStatus: varchar('transfer_status', { length: 50 }),
  previousRegistrar: varchar('previous_registrar', { length: 100 }),
  
  // EPP codes
  eppCode: varchar('epp_code', { length: 100 }),
  eppCodeRequestedAt: timestamp('epp_code_requested_at'),
  
  // Lock status
  transferLock: boolean('transfer_lock').default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete
}, (table) => ({
  customerIdx: index('domains_customer_idx').on(table.customerId),
  domainIdx: uniqueIndex('domains_domain_idx').on(table.domainName),
  statusIdx: index('domains_status_idx').on(table.status),
  expiryIdx: index('domains_expiry_idx').on(table.expiryDate),
  opensrsIdx: index('domains_opensrs_idx').on(table.opensrsDomainId),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  customer: one(customers, {
    fields: [domains.customerId],
    references: [customers.id],
  }),
  ownerContact: one(domainContacts, {
    fields: [domains.ownerContactId],
    references: [domainContacts.id],
    relationName: 'ownerContact',
  }),
  adminContact: one(domainContacts, {
    fields: [domains.adminContactId],
    references: [domainContacts.id],
    relationName: 'adminContact',
  }),
  techContact: one(domainContacts, {
    fields: [domains.techContactId],
    references: [domainContacts.id],
    relationName: 'techContact',
  }),
  billingContact: one(domainContacts, {
    fields: [domains.billingContactId],
    references: [domainContacts.id],
    relationName: 'billingContact',
  }),
  orderItems: many(orderItems),
  dnsRecords: many(dnsRecords),
}));

// ============================================================================
// DNS RECORDS
// ============================================================================

export const dnsRecords = pgTable('dns_records', {
  id: serial('id').primaryKey(),
  domainId: integer('domain_id').references(() => domains.id).notNull(),
  
  // Record data
  type: varchar('type', { length: 10 }).notNull(), // A, AAAA, CNAME, MX, TXT, NS, SRV, CAA
  name: varchar('name', { length: 255 }).notNull(), // @, www, subdomain
  content: text('content').notNull(),
  ttl: integer('ttl').default(3600).notNull(),
  priority: integer('priority'), // For MX, SRV
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  
  // External sync
  syncedToOpensrs: boolean('synced_to_opensrs').default(false).notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  syncError: text('sync_error'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  domainIdx: index('dns_records_domain_idx').on(table.domainId),
  typeIdx: index('dns_records_type_idx').on(table.type),
}));

export const dnsRecordsRelations = relations(dnsRecords, ({ one }) => ({
  domain: one(domains, {
    fields: [dnsRecords.domainId],
    references: [domains.id],
  }),
}));

// ============================================================================
// HOSTING PLANS
// ============================================================================

export const hostingPlans = pgTable('hosting_plans', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Tier
  tier: varchar('tier', { length: 20 }).notNull(), // starter, pro, business, enterprise
  sortOrder: integer('sort_order').default(0),
  
  // Pricing (monthly, in cents)
  monthlyPrice: integer('monthly_price').notNull(),
  yearlyPrice: integer('yearly_price').notNull(), // Usually 10 months
  setupFee: integer('setup_fee').default(0),
  
  // Cost from WPMUDEV
  monthlyCost: integer('monthly_cost').notNull(),
  
  // Features
  features: jsonb('features').default({}).notNull(),
  // {
  //   storageGB: 10,
  //   bandwidthGB: 100,
  //   sites: 1,
  //   visitors: 25000,
  //   ssl: true,
  //   cdn: true,
  //   backups: "daily",
  //   staging: false,
  //   whiteLabel: false,
  //   support: "email"
  // }
  
  // WPMUDEV plan reference
  wpmudevPlanId: varchar('wpmudev_plan_id', { length: 50 }),
  
  // Limits
  maxSites: integer('max_sites').default(1),
  maxStorageGB: integer('max_storage_gb'),
  maxVisitors: integer('max_visitors'),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isPopular: boolean('is_popular').default(false).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('hosting_plans_slug_idx').on(table.slug),
  tierIdx: index('hosting_plans_tier_idx').on(table.tier),
}));

export const hostingPlansRelations = relations(hostingPlans, ({ many }) => ({
  accounts: many(hostingAccounts),
}));

// ============================================================================
// HOSTING ACCOUNTS
// ============================================================================

export const hostingAccounts = pgTable('hosting_accounts', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  planId: integer('plan_id').references(() => hostingPlans.id).notNull(),
  
  // Site info
  siteName: varchar('site_name', { length: 100 }).notNull(),
  primaryDomain: varchar('primary_domain', { length: 253 }),
  
  // Status
  status: hostingStatusEnum('status').default('pending').notNull(),
  
  // Subscription
  billingCycle: varchar('billing_cycle', { length: 10 }).default('monthly').notNull(), // monthly, yearly
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  
  // WPMUDEV integration
  wpmudevSiteId: varchar('wpmudev_site_id', { length: 100 }),
  wpmudevBlogId: integer('wpmudev_blog_id'),
  wpmudevHostingId: varchar('wpmudev_hosting_id', { length: 100 }),
  
  // Access credentials (encrypted)
  wpAdminUsername: varchar('wp_admin_username', { length: 100 }),
  wpAdminPasswordEncrypted: text('wp_admin_password_encrypted'),
  sftpUsername: varchar('sftp_username', { length: 100 }),
  sftpHost: varchar('sftp_host', { length: 255 }),
  
  // SSL
  sslStatus: varchar('ssl_status', { length: 20 }).default('pending'), // pending, active, expired, error
  sslCertificateId: varchar('ssl_certificate_id', { length: 100 }),
  sslExpiryDate: timestamp('ssl_expiry_date'),
  
  // Stats (updated periodically)
  storageUsedMB: integer('storage_used_mb').default(0),
  bandwidthUsedMB: integer('bandwidth_used_mb').default(0),
  lastStatsUpdate: timestamp('last_stats_update'),
  
  // Backup settings
  backupFrequency: varchar('backup_frequency', { length: 20 }).default('daily'),
  lastBackupAt: timestamp('last_backup_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  customerIdx: index('hosting_customer_idx').on(table.customerId),
  planIdx: index('hosting_plan_idx').on(table.planId),
  statusIdx: index('hosting_status_idx').on(table.status),
  wpmudevIdx: index('hosting_wpmudev_idx').on(table.wpmudevSiteId),
  domainIdx: index('hosting_domain_idx').on(table.primaryDomain),
}));

export const hostingAccountsRelations = relations(hostingAccounts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [hostingAccounts.customerId],
    references: [customers.id],
  }),
  plan: one(hostingPlans, {
    fields: [hostingAccounts.planId],
    references: [hostingPlans.id],
  }),
  orderItems: many(orderItems),
}));

// ============================================================================
// ORDERS
// ============================================================================

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  
  // Order info
  orderNumber: varchar('order_number', { length: 20 }).notNull().unique(),
  status: orderStatusEnum('status').default('draft').notNull(),
  
  // Pricing
  subtotal: integer('subtotal').notNull(), // in cents
  discountAmount: integer('discount_amount').default(0),
  taxAmount: integer('tax_amount').default(0),
  total: integer('total').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  
  // Promotions
  couponCode: varchar('coupon_code', { length: 50 }),
  
  // Payment
  paymentStatus: paymentStatusEnum('payment_status'),
  paymentMethod: varchar('payment_method', { length: 50 }), // swipesblue, stripe, etc
  paymentReference: varchar('payment_reference', { length: 255 }), // External payment ID
  paidAt: timestamp('paid_at'),
  
  // Billing address snapshot
  billingEmail: varchar('billing_email', { length: 255 }),
  billingName: varchar('billing_name', { length: 255 }),
  billingAddress: jsonb('billing_address'),
  
  // Notes
  customerNote: text('customer_note'),
  adminNote: text('admin_note'),
  
  // IP Address for fraud detection
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  customerIdx: index('orders_customer_idx').on(table.customerId),
  statusIdx: index('orders_status_idx').on(table.status),
  orderNumberIdx: uniqueIndex('orders_number_idx').on(table.orderNumber),
  paymentIdx: index('orders_payment_idx').on(table.paymentReference),
  createdIdx: index('orders_created_idx').on(table.createdAt),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  payments: many(payments),
}));

// ============================================================================
// ORDER ITEMS
// ============================================================================

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  
  // Item type
  itemType: orderItemTypeEnum('item_type').notNull(),
  
  // Reference to provisioned item
  domainId: integer('domain_id').references(() => domains.id),
  hostingAccountId: integer('hosting_account_id').references(() => hostingAccounts.id),
  
  // Description
  description: varchar('description', { length: 255 }).notNull(),
  
  // Term
  termMonths: integer('term_months').default(12),
  
  // Pricing
  unitPrice: integer('unit_price').notNull(), // in cents
  quantity: integer('quantity').default(1).notNull(),
  totalPrice: integer('total_price').notNull(),
  
  // Configuration
  configuration: jsonb('configuration').default({}), // Domain name, plan slug, etc
  
  // Fulfillment
  status: varchar('fulfillment_status', { length: 20 }).default('pending').notNull(),
  // pending, processing, completed, failed
  
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  
  // External references
  externalReference: varchar('external_reference', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  fulfilledAt: timestamp('fulfilled_at'),
}, (table) => ({
  orderIdx: index('order_items_order_idx').on(table.orderId),
  domainIdx: index('order_items_domain_idx').on(table.domainId),
  hostingIdx: index('order_items_hosting_idx').on(table.hostingAccountId),
  statusIdx: index('order_items_status_idx').on(table.status),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  domain: one(domains, {
    fields: [orderItems.domainId],
    references: [domains.id],
  }),
  hostingAccount: one(hostingAccounts, {
    fields: [orderItems.hostingAccountId],
    references: [hostingAccounts.id],
  }),
}));

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  
  // Payment details
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  
  // Gateway
  gateway: varchar('gateway', { length: 50 }).default('swipesblue').notNull(),
  gatewayTransactionId: varchar('gateway_transaction_id', { length: 255 }),
  gatewayResponse: jsonb('gateway_response'),
  
  // Payment method
  paymentMethodType: varchar('payment_method_type', { length: 50 }), // card, bank_transfer, etc
  paymentMethodLast4: varchar('payment_method_last4', { length: 4 }),
  paymentMethodBrand: varchar('payment_method_brand', { length: 50 }), // visa, mastercard
  
  // Refund info
  refundedAmount: integer('refunded_amount').default(0),
  refundReason: text('refund_reason'),
  refundedAt: timestamp('refunded_at'),
  
  // Metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  failedAt: timestamp('failed_at'),
  failureReason: text('failure_reason'),
}, (table) => ({
  orderIdx: index('payments_order_idx').on(table.orderId),
  customerIdx: index('payments_customer_idx').on(table.customerId),
  gatewayIdx: index('payments_gateway_idx').on(table.gatewayTransactionId),
  statusIdx: index('payments_status_idx').on(table.status),
  createdIdx: index('payments_created_idx').on(table.createdAt),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}));

// ============================================================================
// AUDIT LOG
// ============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  
  // Who
  customerId: integer('customer_id').references(() => customers.id),
  adminId: integer('admin_id'), // If admin action
  
  // What
  action: varchar('action', { length: 100 }).notNull(), // domain.register, hosting.provision, etc
  entityType: varchar('entity_type', { length: 50 }).notNull(), // domain, hosting, order, customer
  entityId: varchar('entity_id', { length: 100 }), // UUID or ID
  
  // Details
  description: text('description'),
  metadata: jsonb('metadata').default({}),
  
  // Change tracking
  previousValues: jsonb('previous_values'),
  newValues: jsonb('new_values'),
  
  // Request context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('audit_customer_idx').on(table.customerId),
  actionIdx: index('audit_action_idx').on(table.action),
  entityIdx: index('audit_entity_idx').on(table.entityType, table.entityId),
  createdIdx: index('audit_created_idx').on(table.createdAt),
}));

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  
  // Source
  source: varchar('source', { length: 50 }).notNull(), // swipesblue, opensrs, wpmudev
  eventType: varchar('event_type', { length: 100 }).notNull(),
  
  // Payload
  payload: jsonb('payload').notNull(),
  headers: jsonb('headers'),
  
  // Processing
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  // pending, processing, completed, failed, retrying
  
  // Delivery tracking
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  retryCount: integer('retry_count').default(0),
  lastError: text('last_error'),
  
  // Idempotency
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
}, (table) => ({
  sourceIdx: index('webhook_source_idx').on(table.source),
  statusIdx: index('webhook_status_idx').on(table.status),
  idempotencyIdx: uniqueIndex('webhook_idempotency_idx').on(table.idempotencyKey),
  createdIdx: index('webhook_created_idx').on(table.receivedAt),
}));

// ============================================================================
// CART SESSIONS (for anonymous cart persistence)
// ============================================================================

export const cartSessions = pgTable('cart_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id),
  
  // Cart items
  items: jsonb('items').default([]).notNull(),
  
  // Totals (calculated)
  subtotal: integer('subtotal').default(0),
  total: integer('total').default(0),
  
  // Metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  sessionIdx: uniqueIndex('cart_session_idx').on(table.sessionId),
  customerIdx: index('cart_customer_idx').on(table.customerId),
}));

// ============================================================================
// EMAIL PLANS
// ============================================================================

export const emailPlans = pgTable('email_plans', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  monthlyPrice: integer('monthly_price').notNull(),
  yearlyPrice: integer('yearly_price').notNull(),
  storageGB: integer('storage_gb').notNull(),
  maxAccounts: integer('max_accounts').default(1),
  features: jsonb('features').default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailPlansRelations = relations(emailPlans, ({ many }) => ({
  accounts: many(emailAccounts),
}));

// ============================================================================
// EMAIL ACCOUNTS
// ============================================================================

export const emailAccounts = pgTable('email_accounts', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  planId: integer('plan_id').references(() => emailPlans.id).notNull(),
  domainId: integer('domain_id').references(() => domains.id),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  storageUsedMB: integer('storage_used_mb').default(0),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  subscriptionEndDate: timestamp('subscription_end_date'),

  // OpenSRS Hosted Email integration
  openSrsMailboxId: varchar('opensrs_mailbox_id', { length: 100 }),
  mailDomain: varchar('mail_domain', { length: 253 }),
  username: varchar('username', { length: 100 }),
  forwardingAddress: varchar('forwarding_address', { length: 255 }),
  spamFilterLevel: varchar('spam_filter_level', { length: 20 }).default('medium'),
  autoResponderEnabled: boolean('auto_responder_enabled').default(false),
  lastLoginAt: timestamp('last_login_at'),
  messagesCount: integer('messages_count').default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  customerIdx: index('email_accounts_customer_idx').on(table.customerId),
  emailIdx: uniqueIndex('email_accounts_email_idx').on(table.email),
}));

export const emailAccountsRelations = relations(emailAccounts, ({ one }) => ({
  customer: one(customers, { fields: [emailAccounts.customerId], references: [customers.id] }),
  plan: one(emailPlans, { fields: [emailAccounts.planId], references: [emailPlans.id] }),
  domain: one(domains, { fields: [emailAccounts.domainId], references: [domains.id] }),
}));

// ============================================================================
// SSL CERTIFICATES
// ============================================================================

export const sslCertificates = pgTable('ssl_certificates', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  domainId: integer('domain_id').references(() => domains.id),
  type: varchar('type', { length: 20 }).notNull(), // dv, ov, ev, wildcard, san
  provider: varchar('provider', { length: 50 }).default('letsencrypt'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  issuedAt: timestamp('issued_at'),
  expiresAt: timestamp('expires_at'),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  domainName: varchar('domain_name', { length: 253 }),

  // OpenSRS Trust Services integration
  openSrsOrderId: varchar('opensrs_order_id', { length: 100 }),
  productId: varchar('product_id', { length: 50 }),
  providerName: varchar('provider_name', { length: 50 }),
  validationLevel: varchar('validation_level', { length: 20 }),
  csrPem: text('csr_pem'),
  privateKeyEncrypted: text('private_key_encrypted'),
  certificatePem: text('certificate_pem'),
  intermediatePem: text('intermediate_pem'),
  approverEmail: varchar('approver_email', { length: 255 }),
  dcvMethod: varchar('dcv_method', { length: 20 }),
  dcvStatus: varchar('dcv_status', { length: 20 }),
  monthlyPrice: integer('monthly_price'),
  totalPrice: integer('total_price'),
  termYears: integer('term_years'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('ssl_customer_idx').on(table.customerId),
  domainIdx: index('ssl_domain_idx').on(table.domainId),
  openSrsIdx: index('ssl_opensrs_idx').on(table.openSrsOrderId),
}));

export const sslCertificatesRelations = relations(sslCertificates, ({ one }) => ({
  customer: one(customers, { fields: [sslCertificates.customerId], references: [customers.id] }),
  domain: one(domains, { fields: [sslCertificates.domainId], references: [domains.id] }),
}));

// ============================================================================
// SITELOCK ACCOUNTS
// ============================================================================

export const sitelockAccounts = pgTable('sitelock_accounts', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  domainId: integer('domain_id').references(() => domains.id),
  plan: varchar('plan', { length: 50 }).notNull(), // basic, professional, enterprise
  status: varchar('status', { length: 20 }).default('active').notNull(),
  lastScanAt: timestamp('last_scan_at'),
  lastScanResult: jsonb('last_scan_result'),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  subscriptionEndDate: timestamp('subscription_end_date'),

  // SiteLock partner integration
  sitelockAccountId: varchar('sitelock_account_id', { length: 100 }),
  sitelockPlanId: varchar('sitelock_plan_id', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  trustSealEnabled: boolean('trust_seal_enabled').default(false),
  firewallEnabled: boolean('firewall_enabled').default(false),
  malwareFound: boolean('malware_found').default(false),
  riskLevel: varchar('risk_level', { length: 20 }).default('low'),
  monthlyPrice: integer('monthly_price'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  customerIdx: index('sitelock_customer_idx').on(table.customerId),
  sitelockIdx: index('sitelock_account_id_idx').on(table.sitelockAccountId),
}));

export const sitelockAccountsRelations = relations(sitelockAccounts, ({ one }) => ({
  customer: one(customers, { fields: [sitelockAccounts.customerId], references: [customers.id] }),
  domain: one(domains, { fields: [sitelockAccounts.domainId], references: [domains.id] }),
}));

// ============================================================================
// WEBSITE PROJECTS
// ============================================================================

export const websiteProjects = pgTable('website_projects', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  template: varchar('template', { length: 50 }),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, published, archived
  publishedUrl: varchar('published_url', { length: 255 }),
  customDomain: varchar('custom_domain', { length: 253 }),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  customerIdx: index('website_projects_customer_idx').on(table.customerId),
}));

export const websiteProjectsRelations = relations(websiteProjects, ({ one }) => ({
  customer: one(customers, { fields: [websiteProjects.customerId], references: [customers.id] }),
}));

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  uuid: pgUuid('uuid').defaultRandom().notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // billing, technical, domains, hosting, general
  priority: varchar('priority', { length: 20 }).default('normal').notNull(), // low, normal, high, urgent
  status: varchar('status', { length: 20 }).default('open').notNull(), // open, in_progress, waiting, resolved, closed
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('tickets_customer_idx').on(table.customerId),
  statusIdx: index('tickets_status_idx').on(table.status),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  customer: one(customers, { fields: [supportTickets.customerId], references: [customers.id] }),
  messages: many(ticketMessages),
}));

// ============================================================================
// TICKET MESSAGES
// ============================================================================

export const ticketMessages = pgTable('ticket_messages', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => supportTickets.id).notNull(),
  senderId: integer('sender_id').references(() => customers.id),
  senderType: varchar('sender_type', { length: 20 }).default('customer').notNull(), // customer, agent, system
  body: text('body').notNull(),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ticketIdx: index('ticket_messages_ticket_idx').on(table.ticketId),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [ticketMessages.ticketId], references: [supportTickets.id] }),
  sender: one(customers, { fields: [ticketMessages.senderId], references: [customers.id] }),
}));

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);
export const insertDomainSchema = createInsertSchema(domains);
export const selectDomainSchema = createSelectSchema(domains);
export const insertHostingPlanSchema = createInsertSchema(hostingPlans);
export const selectHostingPlanSchema = createSelectSchema(hostingPlans);
export const insertHostingAccountSchema = createInsertSchema(hostingAccounts);
export const selectHostingAccountSchema = createSelectSchema(hostingAccounts);
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export const insertOrderItemSchema = createInsertSchema(orderItems);
export const selectOrderItemSchema = createSelectSchema(orderItems);
export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);
export const insertEmailPlanSchema = createInsertSchema(emailPlans);
export const selectEmailPlanSchema = createSelectSchema(emailPlans);
export const insertEmailAccountSchema = createInsertSchema(emailAccounts);
export const selectEmailAccountSchema = createSelectSchema(emailAccounts);
export const insertSslCertificateSchema = createInsertSchema(sslCertificates);
export const selectSslCertificateSchema = createSelectSchema(sslCertificates);
export const insertSitelockAccountSchema = createInsertSchema(sitelockAccounts);
export const selectSitelockAccountSchema = createSelectSchema(sitelockAccounts);
export const insertWebsiteProjectSchema = createInsertSchema(websiteProjects);
export const selectWebsiteProjectSchema = createSelectSchema(websiteProjects);
export const insertSupportTicketSchema = createInsertSchema(supportTickets);
export const selectSupportTicketSchema = createSelectSchema(supportTickets);
export const insertTicketMessageSchema = createInsertSchema(ticketMessages);
export const selectTicketMessageSchema = createSelectSchema(ticketMessages);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Customer types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

// Domain types
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DomainContact = typeof domainContacts.$inferSelect;
export type NewDomainContact = typeof domainContacts.$inferInsert;
export type TldPricing = typeof tldPricing.$inferSelect;
export type NewTldPricing = typeof tldPricing.$inferInsert;

// DNS types
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type NewDnsRecord = typeof dnsRecords.$inferInsert;

// Hosting types
export type HostingPlan = typeof hostingPlans.$inferSelect;
export type NewHostingPlan = typeof hostingPlans.$inferInsert;
export type HostingAccount = typeof hostingAccounts.$inferSelect;
export type NewHostingAccount = typeof hostingAccounts.$inferInsert;

// Order types
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// Payment types
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// Other types
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type CartSession = typeof cartSessions.$inferSelect;
export type NewCartSession = typeof cartSessions.$inferInsert;

// Email types
export type EmailPlan = typeof emailPlans.$inferSelect;
export type NewEmailPlan = typeof emailPlans.$inferInsert;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type NewEmailAccount = typeof emailAccounts.$inferInsert;

// SSL types
export type SslCertificate = typeof sslCertificates.$inferSelect;
export type NewSslCertificate = typeof sslCertificates.$inferInsert;

// SiteLock types
export type SitelockAccount = typeof sitelockAccounts.$inferSelect;
export type NewSitelockAccount = typeof sitelockAccounts.$inferInsert;

// Website builder types
export type WebsiteProject = typeof websiteProjects.$inferSelect;
export type NewWebsiteProject = typeof websiteProjects.$inferInsert;

// Support types
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
