import { useState, useEffect, useCallback } from 'react';

export interface CartItem {
  id: string;
  type: 'domain_registration' | 'domain_transfer' | 'hosting_plan' | 'email_service' | 'ssl_certificate' | 'sitelock' | 'website_builder' | 'privacy_protection';
  name: string;
  description: string;
  price: number; // in cents
  termMonths: number;
  configuration: Record<string, any>;
}

const CART_STORAGE_KEY = 'hostsblue_cart';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function loadCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems(prev => [...prev, { ...item, id: generateId() }]);
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const itemCount = items.length;

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  return {
    items,
    itemCount,
    subtotal,
    isOpen,
    addItem,
    removeItem,
    clearCart,
    openCart,
    closeCart,
  };
}
