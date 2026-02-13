/**
 * SwipesBlue Payment Integration Service
 * Handles payment processing via SwipesBlue payment gateway
 */

const SWIPESBLUE_API_URL = process.env.SWIPESBLUE_API_URL || 'https://api.swipesblue.com/v1';
const SWIPESBLUE_API_KEY = process.env.SWIPESBLUE_API_KEY || '';
const SWIPESBLUE_WEBHOOK_SECRET = process.env.SWIPESBLUE_WEBHOOK_SECRET || '';

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

export class SwipesBluePayment {
  private apiUrl: string;
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    this.apiUrl = SWIPESBLUE_API_URL;
    this.apiKey = SWIPESBLUE_API_KEY;
    this.webhookSecret = SWIPESBLUE_WEBHOOK_SECRET;

    if (!this.apiKey) {
      console.warn('SwipesBlue API key not configured - using mock mode');
    }
  }

  /**
   * Create a payment session/checkout
   */
  async createPaymentSession(data: PaymentSessionData): Promise<string> {
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

    try {
      // Mock mode for development
      if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
        console.log('[SwipesBlue Mock] Creating payment session:', payload);
        // Return a mock checkout URL
        return `${process.env.CLIENT_URL}/checkout/mock?order=${data.orderNumber}&mock=true`;
      }

      const response = await fetch(`${this.apiUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SwipesBlue API error: ${error}`);
      }

      const result = await response.json();
      return result.checkout_url;
    } catch (error) {
      console.error('Failed to create payment session:', error);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: paymentId,
        status: 'completed',
        amount: 0,
        currency: 'usd',
        created_at: new Date().toISOString(),
      };
    }

    const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Process a refund
   */
  async processRefund(data: RefundData): Promise<any> {
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: `refund-${Date.now()}`,
        payment_id: data.paymentId,
        amount: data.amount,
        status: 'completed',
        reason: data.reason,
        created_at: new Date().toISOString(),
      };
    }

    const response = await fetch(`${this.apiUrl}/refunds`, {
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
    });

    if (!response.ok) {
      throw new Error(`Refund failed: ${response.statusText}`);
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
      // Implement signature verification based on SwipesBlue's scheme
      // Usually HMAC-SHA256 of the payload using webhook secret
      const crypto = require('crypto');
      
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
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: `cus-${Date.now()}`,
        email: data.email,
        name: data.name,
        created_at: new Date().toISOString(),
      };
    }

    const response = await fetch(`${this.apiUrl}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create customer: ${response.statusText}`);
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
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: paymentMethodId,
        customer: customerId,
        type: 'card',
      };
    }

    const response = await fetch(
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
      throw new Error(`Failed to attach payment method: ${response.statusText}`);
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
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: `sub-${Date.now()}`,
        customer: data.customerId,
        status: 'active',
        items: data.items,
        created_at: new Date().toISOString(),
      };
    }

    const response = await fetch(`${this.apiUrl}/subscriptions`, {
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
    });

    if (!response.ok) {
      throw new Error(`Failed to create subscription: ${response.statusText}`);
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
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: subscriptionId,
        status: atPeriodEnd ? 'active' : 'cancelled',
        cancel_at_period_end: atPeriodEnd,
      };
    }

    const response = await fetch(
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
      throw new Error(`Failed to cancel subscription: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get invoice for order
   */
  async getInvoice(invoiceId: string): Promise<any> {
    if (!this.apiKey || this.apiKey === 'your_swipesblue_api_key') {
      return {
        id: invoiceId,
        amount_due: 0,
        amount_paid: 0,
        status: 'paid',
        lines: [],
      };
    }

    const response = await fetch(`${this.apiUrl}/invoices/${invoiceId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get invoice: ${response.statusText}`);
    }

    return await response.json();
  }
}
