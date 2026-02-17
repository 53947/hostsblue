import { Outlet } from 'react-router-dom';
import { Header } from './header';
import { Footer } from './footer';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
