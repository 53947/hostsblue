/**
 * SwipesBlue Payment Integration Service
 * Handles payment processing via SwipesBlue payment gateway
 */

import crypto from 'crypto';

const SWIPESBLUE_API_URL = process.env.SWIPESBLUE_API_URL || 'https://api.swipesblue.com/v1';
const SWIPESBLUE_API_KEY = process.env.SWIPESBLUE_API_KEY || '';
const SWIPESBLUE_WEBHOOK_SECRET = process.env.SWIPESBLUE_WEBHOOK_SECRET || '';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

export class PaymentError extends Error {
  retryable: boolean;
  userMessage: string;

  constructor(message: string, retryable: boolean = false, userMessage?: string) {
    super(message);
    this.name = 'PaymentError';
    this.retryable = retryable;
    this.userMessage = userMessage || 'An error occurred processing your payment. Please try again.';
  }
}

interface PaymentSessionData {
  orderId: number;
  orderNumber: string;
  amount: number;
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  metadata?: Record<string, any>;
}

interface RefundData {
  paymentId: string;
  amount: number;
  reason?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SwipesBluePayment {
  private apiUrl: string;
  private apiKey: string;
  private webhookSecret: string;
  private isMockMode: boolean;

  constructor() {
    this.apiUrl = SWIPESBLUE_API_URL;
    this.apiKey = SWIPESBLUE_API_KEY;
    this.webhookSecret = SWIPESBLUE_WEBHOOK_SECRET;

    this.isMockMode = !this.apiKey || this.apiKey === 'test' || this.apiKey === 'your_swipesblue_api_key';

    if (this.isMockMode) {
      console.warn('SwipesBlue API key not configured - using mock mode');
    }
  }

  /**
   * Make an API request with retry logic for 5xx/network errors
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = MAX_RETRIES
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Only retry on 5xx server errors
        if (response.status >= 500 && attempt < retries) {
          console.warn(
            `[SwipesBlue] Server error ${response.status}, retrying (attempt ${attempt + 1}/${retries})...`
          );
          await delay(RETRY_DELAYS[attempt]);
          continue;
        }

        return response;
      } catch (error) {
        // Retry on network errors
        if (attempt < retries) {
          console.warn(
            `[SwipesBlue] Network error, retrying (attempt ${attempt + 1}/${retries}):`,
            (error as Error).message
          );
          await delay(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new PaymentError(
          `Network error after ${retries} retries: ${(error as Error).message}`,
          true,
          'Unable to connect to payment provider. Please try again later.'
        );
      }
    }

    // Should not reach here, but TypeScript needs this
    throw new PaymentError('Max retries exceeded', true);
  }

  /**
   * Create a payment session/checkout
   */
  async createPaymentSession(data: PaymentSessionData, idempotencyKey?: string): Promise<string> {
    const payload = {
      amount: data.amount,
      currency: data.currency.toLowerCase(),
      reference: data.orderNumber,
      metadata: {
        order_id: data.orderId,
        order_number: data.orderNumber,
        ...data.metadata,
      },
      customer: {
        email: data.customerEmail,
      },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      webhook_url: data.webhookUrl,
    };

    // Mock mode for development
    if (this.isMockMode) {
      console.log('[SwipesBlue Mock] Creating payment session:', payload);
      return `${process.env.CLIENT_URL}/checkout/mock?order=${data.orderNumber}&mock=true`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/checkout/sessions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new PaymentError(
        `SwipesBlue API error (${response.status}): ${errorText}`,
        response.status >= 500,
        'Payment session creation failed. Please try again.'
      );
    }

    const result = await response.json();
    return result.checkout_url;
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    if (this.isMockMode) {
      return {
        id: paymentId,
        status: 'completed',
        amount: 0,
        currency: 'usd',
        created_at: new Date().toISOString(),
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Failed to get payment status: ${response.statusText}`,
        response.status >= 500
      );
    }

    return await response.json();
  }

  /**
   * Process a refund
   */
  async processRefund(data: RefundData): Promise<any> {
    if (this.isMockMode) {
      return {
        id: `refund-${Date.now()}`,
        payment_id: data.paymentId,
        amount: data.amount,
        status: 'completed',
        reason: data.reason,
        created_at: new Date().toISOString(),
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/refunds`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: data.paymentId,
          amount: data.amount,
          reason: data.reason,
        }),
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Refund failed: ${response.statusText}`,
        response.status >= 500,
        'Unable to process refund. Please contact support.'
      );
    }

    return await response.json();
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    // Mock mode - always accept
    if (!this.webhookSecret || this.webhookSecret === 'your_webhook_secret') {
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Use timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Create a customer in SwipesBlue
   */
  async createCustomer(data: {
    email: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    if (this.isMockMode) {
      return {
        id: `cus-${Date.now()}`,
        email: data.email,
        name: data.name,
        created_at: new Date().toISOString(),
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/customers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Failed to create customer: ${response.statusText}`,
        response.status >= 500
      );
    }

    return await response.json();
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<any> {
    if (this.isMockMode) {
      return {
        id: paymentMethodId,
        customer: customerId,
        type: 'card',
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/customers/${customerId}/payment_methods`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method: paymentMethodId,
        }),
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Failed to attach payment method: ${response.statusText}`,
        response.status >= 500
      );
    }

    return await response.json();
  }

  /**
   * Create subscription (for recurring billing)
   */
  async createSubscription(data: {
    customerId: string;
    items: Array<{
      priceId: string;
      quantity?: number;
    }>;
    metadata?: Record<string, any>;
  }): Promise<any> {
    if (this.isMockMode) {
      return {
        id: `sub-${Date.now()}`,
        customer: data.customerId,
        status: 'active',
        items: data.items,
        created_at: new Date().toISOString(),
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: data.customerId,
          items: data.items.map(item => ({
            price: item.priceId,
            quantity: item.quantity || 1,
          })),
          metadata: data.metadata,
        }),
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Failed to create subscription: ${response.statusText}`,
        response.status >= 500
      );
    }

    return await response.json();
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<any> {
    if (this.isMockMode) {
      return {
        id: subscriptionId,
        status: atPeriodEnd ? 'active' : 'cancelled',
        cancel_at_period_end: atPeriodEnd,
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/subscriptions/${subscriptionId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancel_at_period_end: atPeriodEnd,
        }),
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Failed to cancel subscription: ${response.statusText}`,
        response.status >= 500
      );
    }

    return await response.json();
  }

  /**
   * Get invoice for order
   */
  async getInvoice(invoiceId: string): Promise<any> {
    if (this.isMockMode) {
      return {
        id: invoiceId,
        amount_due: 0,
        amount_paid: 0,
        status: 'paid',
        lines: [],
      };
    }

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new PaymentError(
        `Failed to get invoice: ${response.statusText}`,
        response.status >= 500
      );
    }

    return await response.json();
  }
}
