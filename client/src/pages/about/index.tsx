import { Link } from 'react-router-dom';
import { Globe, CreditCard, BarChart3, LinkIcon, ArrowRight } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About HostsBlue</h1>
        <p className="text-lg text-gray-500">
          We are building the next generation of web infrastructure tools, making it simple for businesses of every size to establish and grow their online presence.
        </p>
      </div>

      <hr className="section-divider" />

      {/* Our Story */}
      <section className="py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Story</h2>
        <div className="space-y-4 text-gray-600 leading-relaxed">
          <p>
            HostsBlue was founded on a simple belief: managing your web presence should not be complicated. Too many businesses struggle with fragmented tools, confusing interfaces, and unreliable services just to get online.
          </p>
          <p>
            We set out to create a unified platform where domain registration, hosting, email, and security all work together seamlessly. Every product we build is designed with simplicity, reliability, and performance at its core.
          </p>
          <p>
            From individual creators launching their first website to agencies managing hundreds of client domains, HostsBlue provides the tools and support needed to succeed online.
          </p>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Mission */}
      <section className="py-16 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Mission</h2>
        <p className="text-xl text-gray-500 leading-relaxed">
          To make professional web services accessible, reliable, and simple for businesses of every size, so anyone can build a strong digital presence without the complexity.
        </p>
      </section>

      <hr className="section-divider" />

      {/* Values */}
      <section className="py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">What We Stand For</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              title: 'Simplicity First',
              desc: 'We believe powerful tools do not have to be complicated. Every feature we build aims to reduce friction, not add it.',
            },
            {
              title: 'Reliability Always',
              desc: 'Your website and email are critical to your business. We invest in infrastructure that delivers 99.9% uptime consistently.',
            },
            {
              title: 'Transparent Pricing',
              desc: 'No hidden fees, no surprise renewals at inflated rates. What you see is what you pay, today and at renewal.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-[7px] p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* TriadBlue Ecosystem */}
      <section className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The TriadBlue Ecosystem</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            HostsBlue is part of the TriadBlue family of platforms, each designed to solve a specific business challenge while working seamlessly together.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Globe,
              name: 'hostsblue',
              tagline: 'Domains, hosting, email, and security',
              active: true,
            },
            {
              icon: CreditCard,
              name: 'swipesblue',
              tagline: 'Payment processing and invoicing',
              active: false,
            },
            {
              icon: BarChart3,
              name: 'ranksblue',
              tagline: 'SEO tools and analytics',
              active: false,
            },
            {
              icon: LinkIcon,
              name: 'linksblue',
              tagline: 'Link management and shortening',
              active: false,
            },
          ].map(({ icon: Icon, name, tagline, active }) => (
            <div key={name} className={`bg-white border rounded-[7px] p-6 text-center ${active ? 'border-[#1844A6] shadow-sm' : 'border-gray-200'}`}>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-[#1844A6]" />
              </div>
              <p className="text-lg font-bold mb-1">
                <span className="text-gray-900">{name.replace('blue', '')}</span>
                <span className="text-[#0000FF]">blue</span>
              </p>
              <p className="text-sm text-gray-500">{tagline}</p>
              {active && (
                <span className="inline-block mt-3 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">You are here</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
        <p className="text-gray-500 mb-8 max-w-lg mx-auto">
          Join thousands of businesses that trust HostsBlue for their web presence.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="bg-[#1844A6] hover:bg-[#133A8A] text-white font-semibold px-8 py-3 rounded-[7px] transition-colors">
            Create Account
          </Link>
          <Link to="/pricing" className="border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-[7px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            View Pricing <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
