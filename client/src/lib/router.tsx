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
import { CheckoutPage } from '@/pages/checkout/checkout';
import { CheckoutSuccessPage } from '@/pages/checkout/success';
import { CheckoutCancelPage } from '@/pages/checkout/cancel';
import { DomainSearchPage } from '@/pages/domains/search';
import { HostingPlansPage } from '@/pages/hosting/plans';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'domains/search', element: <DomainSearchPage /> },
      { path: 'hosting', element: <HostingPlansPage /> },
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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
