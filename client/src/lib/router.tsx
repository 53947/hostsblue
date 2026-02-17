import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/root-layout';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';

// Pages
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import { DashboardPage } from '@/pages/dashboard/dashboard';
import { DomainsPage } from '@/pages/dashboard/domains';
import { DomainDetailPage } from '@/pages/dashboard/domain-detail';
import { HostingPage } from '@/pages/dashboard/hosting';
import { HostingDetailPage } from '@/pages/dashboard/hosting-detail';
import { OrdersPage } from '@/pages/dashboard/orders';
import { EmailPage } from '@/pages/dashboard/email';
import { SslPage } from '@/pages/dashboard/ssl';
import { SitelockPage } from '@/pages/dashboard/sitelock';
import { WebsiteBuilderPage } from '@/pages/dashboard/website-builder';
import { BillingPage } from '@/pages/dashboard/billing';
import { SupportPage } from '@/pages/dashboard/support';
import { SettingsPage } from '@/pages/dashboard/settings';
import { CheckoutPage } from '@/pages/checkout/checkout';
import { CheckoutSuccessPage } from '@/pages/checkout/success';
import { CheckoutCancelPage } from '@/pages/checkout/cancel';
import { DomainSearchPage } from '@/pages/domains/search';
import { HostingPlansPage } from '@/pages/hosting/plans';
import { EmailPlansPage } from '@/pages/email/plans';
import { WebsiteBuilderPage as PublicWebsiteBuilderPage } from '@/pages/website-builder/index';
import { SecurityPage } from '@/pages/security/index';
import { PricingPage } from '@/pages/pricing/index';
import { AboutPage } from '@/pages/about/index';
import { SupportPage as PublicSupportPage } from '@/pages/support/index';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'domains/search', element: <DomainSearchPage /> },
      { path: 'hosting', element: <HostingPlansPage /> },
      { path: 'email', element: <EmailPlansPage /> },
      { path: 'website-builder', element: <PublicWebsiteBuilderPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'support', element: <PublicSupportPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'checkout/success', element: <CheckoutSuccessPage /> },
      { path: 'checkout/cancel', element: <CheckoutCancelPage /> },
    ],
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'domains', element: <DomainsPage /> },
      { path: 'domains/:uuid', element: <DomainDetailPage /> },
      { path: 'hosting', element: <HostingPage /> },
      { path: 'hosting/:uuid', element: <HostingDetailPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'email', element: <EmailPage /> },
      { path: 'ssl', element: <SslPage /> },
      { path: 'sitelock', element: <SitelockPage /> },
      { path: 'website-builder', element: <WebsiteBuilderPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
