/**
 * Payment Service — Factory / Router
 * Routes payment calls to the active provider (SwipesBlue or Stripe).
 * Reads from DB (platform_settings) first, falls back to ACTIVE_PAYMENT_PROVIDER env var.
 * Switching is instant — call setActiveProvider() and it takes effect immediately.
 */

import type { PaymentProvider } from './payment-provider.js';
import { SwipesBlueProvider } from './swipesblue-provider.js';
import { StripeProvider } from './stripe-provider.js';

export type PaymentProviderName = 'swipesblue' | 'stripe';

const providers: Record<PaymentProviderName, () => PaymentProvider> = {
  swipesblue: () => new SwipesBlueProvider(),
  stripe: () => new StripeProvider(),
};

let cachedProvider: PaymentProvider | null = null;
let cachedProviderName: PaymentProviderName | null = null;

// In-memory override set by setActiveProvider() — read from DB on startup
let dbProviderOverride: PaymentProviderName | null = null;

/**
 * Load the active payment provider from the database.
 * Called once on server startup and whenever the admin switches providers.
 */
export async function loadActiveProviderFromDB(): Promise<void> {
  try {
    const { db } = await import('../../index.js');
    const { platformSettings } = await import('../../../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(platformSettings).where(eq(platformSettings.key, 'active_payment_provider'));
    if (rows.length > 0) {
      const val = rows[0].value.toLowerCase();
      if (val === 'stripe' || val === 'swipesblue') {
        dbProviderOverride = val;
      }
    }
  } catch {
    // DB not ready yet or table doesn't exist — use env fallback
  }
}

/**
 * Switch the active payment provider at runtime.
 * Persists to DB and clears the cached instance so the next call uses the new provider.
 */
export async function setActiveProvider(name: PaymentProviderName): Promise<void> {
  const { db } = await import('../../index.js');
  const { platformSettings } = await import('../../../shared/schema.js');
  const { eq } = await import('drizzle-orm');

  // Upsert into platform_settings
  const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, 'active_payment_provider'));
  if (existing.length > 0) {
    await db.update(platformSettings)
      .set({ value: name, updatedAt: new Date() })
      .where(eq(platformSettings.key, 'active_payment_provider'));
  } else {
    await db.insert(platformSettings).values({
      key: 'active_payment_provider',
      value: name,
      section: 'payment',
    });
  }

  // Update in-memory state and clear cache
  dbProviderOverride = name;
  cachedProvider = null;
  cachedProviderName = null;
}

export function getActiveProviderName(): PaymentProviderName {
  // DB override takes priority
  if (dbProviderOverride) return dbProviderOverride;
  // Fall back to env
  const env = (process.env.ACTIVE_PAYMENT_PROVIDER || 'swipesblue').toLowerCase();
  if (env === 'stripe' || env === 'swipesblue') return env;
  return 'swipesblue';
}

export function getPaymentProvider(name?: PaymentProviderName): PaymentProvider {
  const providerName = name || getActiveProviderName();

  // Return cached instance if same provider
  if (cachedProvider && cachedProviderName === providerName) {
    return cachedProvider;
  }

  const factory = providers[providerName];
  if (!factory) {
    throw new Error(`Unknown payment provider: ${providerName}`);
  }

  cachedProvider = factory();
  cachedProviderName = providerName;
  return cachedProvider;
}

/**
 * Get a provider by name without caching (for webhook verification, where both
 * providers might receive webhooks).
 */
export function getProviderByName(name: PaymentProviderName): PaymentProvider {
  const factory = providers[name];
  if (!factory) throw new Error(`Unknown payment provider: ${name}`);
  return factory();
}

export type { PaymentProvider } from './payment-provider.js';
