import { Link } from 'react-router-dom';
import { Globe, CreditCard, Briefcase, ScanLine, Shield, Zap, Eye, Heart } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 mb-4">About HostsBlue</h1>
        <p className="text-lg text-[#4B5563]">
          We are building the next generation of web infrastructure tools, making it simple for businesses of every size to establish and grow their online presence.
        </p>
      </div>

      <hr className="section-divider" />

      {/* Our Story */}
      <section className="py-12 max-w-3xl mx-auto">
        <h2 className="text-2xl font-[800] text-gray-900 mb-6">Our Story</h2>
        <div className="space-y-4 text-[#4B5563] leading-relaxed">
          <p>
            HostsBlue was founded on a simple belief: managing your web presence should not be complicated. Too many businesses struggle with fragmented tools, confusing interfaces, and unreliable services just to get online.
          </p>
          <p>
            We set out to create a unified platform where domain registration, hosting, email, and security all work together seamlessly. Every product we build is designed with simplicity, reliability, and performance at its core.
          </p>
          <p>
            From individual creators launching their first website to agencies managing hundreds of client domains, HostsBlue provides the tools and support needed to succeed online. Our team is dedicated to removing the barriers between great ideas and the web presence they deserve.
          </p>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Mission & Values */}
      <section className="py-12">
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <h2 className="text-2xl font-[800] text-gray-900 mb-4">Our Mission</h2>
          <p className="text-xl text-[#4B5563] leading-relaxed">
            To make professional web services accessible, reliable, and simple for businesses of every size, so anyone can build a strong digital presence without the complexity.
          </p>
        </div>

        <h3 className="text-xl font-[800] text-gray-900 mb-8 text-center">What We Stand For</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Eye,
              title: 'Simplicity First',
              desc: 'We believe powerful tools do not have to be complicated. Every feature we build aims to reduce friction, not add it.',
            },
            {
              icon: Shield,
              title: 'Reliability Always',
              desc: 'Your website and email are critical to your business. We invest in infrastructure that delivers 99.9% uptime consistently.',
            },
            {
              icon: Zap,
              title: 'Transparent Pricing',
              desc: 'No hidden fees, no surprise renewals at inflated rates. What you see is what you pay, today and at renewal.',
            },
            {
              icon: Heart,
              title: 'Customer Obsessed',
              desc: 'Our support team is available 24/7 because your success is our success. Real people, real answers, real fast.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <div className="w-10 h-10 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h4 className="text-lg font-[800] text-gray-900 mb-2">{title}</h4>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* TriadBlue Ecosystem */}
      <section className="py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-[800] text-gray-900 mb-4">The TRIADBLUE Ecosystem</h2>
          <p className="text-[#4B5563] max-w-2xl mx-auto">
            HostsBlue is part of the TRIADBLUE family of platforms, each designed to solve a specific business challenge while working seamlessly together.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Globe,
              first: 'hosts',
              firstColor: '#008060',
              second: 'blue',
              secondColor: '#0000FF',
              tagline: 'Domains, hosting, email, and security',
              active: true,
            },
            {
              icon: CreditCard,
              first: 'swipes',
              firstColor: '#374151',
              second: 'blue',
              secondColor: '#0000FF',
              tagline: 'Payment processing and invoicing',
              active: false,
            },
            {
              icon: Briefcase,
              first: 'business',
              firstColor: '#FF6B00',
              second: 'blueprint',
              secondColor: '#0000FF',
              tagline: 'Business planning and strategy tools',
              active: false,
            },
            {
              icon: ScanLine,
              first: 'scans',
              firstColor: '#A00028',
              second: 'blue',
              secondColor: '#0000FF',
              tagline: 'Document scanning and management',
              active: false,
            },
          ].map(({ icon: Icon, first, firstColor, second, secondColor, tagline, active }) => (
            <div
              key={first + second}
              className={`bg-white border rounded-[7px] p-6 text-center ${
                active ? 'border-[#064A6C] shadow-sm' : 'border-[#E5E7EB]'
              }`}
            >
              <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-[#064A6C]" />
              </div>
              <p className="text-lg font-[800] mb-1">
                <span style={{ color: firstColor }}>{first}</span>
                <span style={{ color: secondColor }}>{second}</span>
              </p>
              <p className="text-sm text-gray-500">{tagline}</p>
              {active && (
                <span className="inline-block mt-3 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-[7px]">
                  You are here
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* CTA */}
      <section className="py-12 text-center">
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[7px] p-12">
          <h2 className="text-2xl font-[800] text-gray-900 mb-4">Ready to Get Started?</h2>
          <p className="text-[#4B5563] mb-8 max-w-lg mx-auto">
            Join thousands of businesses that trust HostsBlue for their web presence. Create your account and start building today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-[#064A6C] hover:bg-[#053A55] text-white font-semibold px-8 py-3 rounded-[7px] transition-all btn-arrow-hover justify-center"
            >
              Create Account
            </Link>
            <Link
              to="/pricing"
              className="border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C] font-semibold px-8 py-3 rounded-[7px] transition-colors btn-arrow-hover justify-center"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
