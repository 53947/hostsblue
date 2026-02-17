import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Server, Mail, Shield, Palette, ArrowRight, CheckCircle, Search, Zap, Headphones, Clock } from 'lucide-react';

export function HomePage() {
  const [domainQuery, setDomainQuery] = useState('');

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
          Your Digital Presence<br />Starts Here
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Professional domain registration, WordPress hosting, email, and security solutions for businesses of every size.
        </p>

        {/* Domain Search Bar */}
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (domainQuery.trim()) {
                window.location.href = `/domains/search?q=${encodeURIComponent(domainQuery.trim())}`;
              }
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={domainQuery}
                onChange={(e) => setDomainQuery(e.target.value)}
                placeholder="Search for your perfect domain..."
                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-[7px] text-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="bg-[#1844A6] hover:bg-[#133A8A] text-white font-semibold px-8 py-4 rounded-[7px] text-lg transition-colors whitespace-nowrap"
            >
              Search Domains
            </button>
          </form>
          <p className="text-sm text-gray-500 mt-3">
            Popular: <span className="text-gray-700">.com $12.99</span> · <span className="text-gray-700">.net $14.99</span> · <span className="text-gray-700">.io $39.99</span>
          </p>
        </div>
      </section>

      <hr className="section-divider" />

      {/* 5 Service Pillar Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Succeed Online
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            From domain registration to website security, we provide all the tools your business needs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
          {[
            {
              icon: Globe,
              title: 'Domains',
              desc: 'Register and manage domains with WHOIS privacy included.',
              link: '/domains/search',
              linkText: 'Search Domains',
            },
            {
              icon: Server,
              title: 'Hosting',
              desc: 'Fast, secure WordPress hosting with daily backups.',
              link: '/hosting',
              linkText: 'View Plans',
            },
            {
              icon: Mail,
              title: 'Email',
              desc: 'Professional email hosting for your business domain.',
              link: '/email',
              linkText: 'Email Plans',
            },
            {
              icon: Shield,
              title: 'Security',
              desc: 'SSL certificates and malware protection for your site.',
              link: '/security',
              linkText: 'Learn More',
            },
            {
              icon: Palette,
              title: 'Website Builder',
              desc: 'Drag-and-drop builder for beautiful websites.',
              link: '/website-builder',
              linkText: 'Coming Soon',
            },
          ].map(({ icon: Icon, title, desc, link, linkText }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-[#1844A6]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 mb-4">{desc}</p>
              <Link to={link} className="text-[#1844A6] text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
                {linkText} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Get your business online in three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              step: '1',
              title: 'Search & Register',
              desc: 'Find your perfect domain name and register it in seconds with instant activation.',
            },
            {
              step: '2',
              title: 'Choose Your Services',
              desc: 'Add hosting, email, SSL, and any other services your business needs.',
            },
            {
              step: '3',
              title: 'Launch & Grow',
              desc: 'Go live with your website and email. Manage everything from one simple dashboard.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-14 h-14 bg-[#1844A6] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {step}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* Hosting Plans Preview */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              WordPress Hosting Plans
            </h2>
            <p className="text-gray-500">
              Choose the perfect plan for your needs. All plans include free migration.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white border border-gray-200 rounded-[7px] p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$9</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 1 WordPress Site
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 10GB SSD Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 25K Monthly Visits
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Free SSL
                </li>
              </ul>
              <Link to="/hosting" className="block text-center py-3 rounded-[7px] font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                Get Started
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-white border border-[#1844A6] rounded-[7px] p-6 shadow-md relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#1844A6] text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#1844A6] mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$24</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 5 WordPress Sites
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 50GB SSD Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 100K Monthly Visits
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Free SSL + CDN
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Staging Environment
                </li>
              </ul>
              <Link to="/hosting" className="block text-center py-3 rounded-[7px] font-medium bg-[#1844A6] hover:bg-[#133A8A] text-white transition-colors">
                Get Started
              </Link>
            </div>

            {/* Business */}
            <div className="bg-white border border-gray-200 rounded-[7px] p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Business</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$59</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 20 WordPress Sites
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 200GB SSD Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 500K Monthly Visits
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Priority Support
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /> White Label
                </li>
              </ul>
              <Link to="/hosting" className="block text-center py-3 rounded-[7px] font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Why HostsBlue - Trust Signals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why HostsBlue
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Trusted by businesses worldwide for reliable, secure web services.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {[
            {
              icon: Zap,
              title: '99.9% Uptime',
              desc: 'Enterprise-grade infrastructure with guaranteed reliability.',
            },
            {
              icon: Shield,
              title: 'Secure by Default',
              desc: 'Free SSL, DDoS protection, and daily backups on every plan.',
            },
            {
              icon: Headphones,
              title: '24/7 Support',
              desc: 'Expert support team available around the clock to help you.',
            },
            {
              icon: Clock,
              title: 'Instant Activation',
              desc: 'Domains and hosting activated instantly after purchase.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-[#1844A6]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* Ecosystem Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gray-50 border border-gray-200 rounded-[7px] p-12 text-center">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Part of the TriadBlue Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            One Ecosystem, Infinite Possibilities
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto mb-8">
            HostsBlue works seamlessly with the entire TriadBlue family of platforms.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 mb-8">
            <div className="text-xl font-bold">
              <span className="text-gray-900">hosts</span><span className="text-[#0000FF]">blue</span>
            </div>
            <div className="text-xl font-bold">
              <span className="text-gray-900">swipes</span><span className="text-[#0000FF]">blue</span>
            </div>
            <div className="text-xl font-bold">
              <span className="text-gray-900">ranks</span><span className="text-[#0000FF]">blue</span>
            </div>
            <div className="text-xl font-bold">
              <span className="text-gray-900">links</span><span className="text-[#0000FF]">blue</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-[#1844A6] hover:bg-[#133A8A] text-white font-semibold px-8 py-3 rounded-[7px] transition-colors">
              Create Account
            </Link>
            <Link to="/domains/search" className="border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-[7px] hover:bg-gray-50 transition-colors">
              Search Domains
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
