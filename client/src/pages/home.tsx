import { Link } from 'react-router-dom';
import { Globe, Server, Shield, Zap, ArrowRight, CheckCircle } from 'lucide-react';

export function HomePage() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-purple opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-gradient">Your Digital Presence</span>
              <br />
              <span className="text-white">Starts Here</span>
            </h1>
            <p className="text-xl text-zinc-400 mb-8">
              Professional domain registration and WordPress hosting with 
              white-label solutions for agencies and businesses.
            </p>
            
            {/* Domain Search */}
            <div className="max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search for your domain..."
                  className="flex-1 input text-lg"
                />
                <Link to="/domains/search" className="btn-primary text-lg whitespace-nowrap">
                  Search Domains
                </Link>
              </div>
              <p className="text-sm text-zinc-500 mt-3">
                Popular: <span className="text-zinc-400">.com $12.99</span> · <span className="text-zinc-400">.net $14.99</span> · <span className="text-zinc-400">.io $39.99</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything You Need to Succeed Online
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            From domain registration to fully managed WordPress hosting, 
            we provide all the tools you need.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="card card-hover">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Domain Registration</h3>
            <p className="text-zinc-400 mb-4">
              Search and register domains with competitive pricing. 
              Full WHOIS privacy protection included.
            </p>
            <Link to="/domains/search" className="text-purple-400 flex items-center gap-1 hover:gap-2 transition-all">
              Search Domains <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="card card-hover">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
              <Server className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">WordPress Hosting</h3>
            <p className="text-zinc-400 mb-4">
              Blazing fast, secure WordPress hosting with automatic updates, 
              daily backups, and expert support.
            </p>
            <Link to="/hosting" className="text-purple-400 flex items-center gap-1 hover:gap-2 transition-all">
              View Plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="card card-hover">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Enterprise Security</h3>
            <p className="text-zinc-400 mb-4">
              Free SSL certificates, DDoS protection, and advanced security 
              features to keep your site safe.
            </p>
            <span className="text-purple-400 flex items-center gap-1">
              Learn More <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </section>

      {/* Hosting Plans Preview */}
      <section className="bg-[var(--bg-secondary)] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              WordPress Hosting Plans
            </h2>
            <p className="text-zinc-400">
              Choose the perfect plan for your needs. All plans include free migration.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="card">
              <h3 className="text-lg font-semibold text-zinc-300 mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">$9</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 1 WordPress Site
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 10GB SSD Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 25K Monthly Visits
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> Free SSL
                </li>
              </ul>
              <button className="btn-outline w-full">Get Started</button>
            </div>

            {/* Pro */}
            <div className="card border-purple-500/50 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <h3 className="text-lg font-semibold text-purple-400 mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">$24</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 5 WordPress Sites
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 50GB SSD Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 100K Monthly Visits
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> Free SSL + CDN
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> Staging Environment
                </li>
              </ul>
              <Link to="/hosting" className="btn-primary w-full block text-center">
                Get Started
              </Link>
            </div>

            {/* Business */}
            <div className="card">
              <h3 className="text-lg font-semibold text-zinc-300 mb-2">Business</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">$59</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 20 WordPress Sites
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 200GB SSD Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> 500K Monthly Visits
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> Priority Support
                </li>
                <li className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle className="w-4 h-4 text-green-400" /> White Label
                </li>
              </ul>
              <button className="btn-outline w-full">Get Started</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="gradient-purple rounded-2xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Join thousands of businesses who trust HostsBlue for their domain 
            and hosting needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-white text-purple-600 font-semibold px-8 py-3 rounded-lg hover:bg-zinc-100 transition-colors">
              Create Account
            </Link>
            <Link to="/domains/search" className="bg-purple-700/50 text-white font-semibold px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors border border-white/20">
              Search Domains
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
