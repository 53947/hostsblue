import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Send, Globe, Server, Mail, Shield, CreditCard, Rocket } from 'lucide-react';

const categories = [
  { icon: Rocket, title: 'Getting Started', desc: 'Account setup, first steps, tutorials', link: '#' },
  { icon: Globe, title: 'Domains', desc: 'Registration, transfers, DNS management', link: '/domains/search' },
  { icon: Server, title: 'Hosting', desc: 'WordPress, performance, backups, staging', link: '/hosting' },
  { icon: Mail, title: 'Email', desc: 'Setup, delivery, spam filtering, migration', link: '/email' },
  { icon: Shield, title: 'Security', desc: 'SSL certificates, SiteLock, malware', link: '/security' },
  { icon: CreditCard, title: 'Billing', desc: 'Payments, invoices, refunds, renewals', link: '#' },
];

const faqs = [
  {
    q: 'How do I register a domain?',
    a: 'Use our domain search to find your perfect domain name. Once you find an available domain, add it to your cart and complete the checkout process. Your domain will be activated instantly.',
  },
  {
    q: 'Can I transfer my existing domain to HostsBlue?',
    a: 'Yes. You can transfer domains from any registrar to HostsBlue. Go to your dashboard, select "Transfer Domain," enter your domain name and authorization code, and we will handle the rest. Transfers typically complete within 5-7 days.',
  },
  {
    q: 'What hosting plan should I choose?',
    a: 'For a single website, our Starter plan is a great choice. If you manage multiple sites or need staging environments, the Growth plan offers the best value. For agencies and businesses with high traffic, the Business or Enterprise plans provide maximum resources.',
  },
  {
    q: 'Do you offer a money-back guarantee?',
    a: 'Yes, all hosting plans come with a 30-day money-back guarantee. If you are not satisfied, contact our support team within 30 days for a full refund.',
  },
  {
    q: 'How does billing work?',
    a: 'You can choose monthly or annual billing. Annual plans save you 20%. All payments are processed securely. Your services renew automatically, and you will receive email reminders before each renewal.',
  },
  {
    q: 'Is SSL included with hosting plans?',
    a: 'Yes, all hosting plans include a free Domain Validated (DV) SSL certificate. For higher levels of validation (OV or EV), you can purchase upgraded SSL certificates from our Security page.',
  },
  {
    q: 'How do I set up email for my domain?',
    a: 'Once you have a domain registered with HostsBlue, choose an email plan and we will configure the DNS records automatically. You will be able to access your email through webmail, mobile apps, or desktop clients.',
  },
  {
    q: 'How do I contact support?',
    a: 'You can reach our support team 24/7 via the contact form below, by emailing support@hostsblue.com, or through live chat in your dashboard. We typically respond within 1 hour during business hours.',
  },
];

export function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 mb-4">How Can We Help?</h1>
        <p className="text-[#4B5563] max-w-2xl mx-auto text-lg">
          Find answers to common questions, browse by category, or reach out to our support team directly.
        </p>
      </div>

      {/* Category Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-[800] text-gray-900 mb-8 text-center">Browse by Category</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {categories.map(({ icon: Icon, title, desc, link }) => (
            <Link
              key={title}
              to={link}
              className="bg-white border border-[#E5E7EB] rounded-[7px] p-6 hover:shadow-md hover:border-[#064A6C] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#064A6C]" />
                </div>
                <div>
                  <h3 className="font-[800] text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* FAQ */}
      <section className="py-12">
        <h2 className="text-2xl font-[800] text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-gray-900 pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                    openFaq === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === index && (
                <div className="px-5 pb-5">
                  <p className="text-[#4B5563] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* Contact Section */}
      <section className="py-12">
        <h2 className="text-2xl font-[800] text-gray-900 mb-2 text-center">Contact Support</h2>
        <p className="text-[#4B5563] text-center mb-8">Can not find what you are looking for? Send us a message and we will get back to you.</p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Contact Info */}
          <div className="space-y-6">
            <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <h3 className="font-[800] text-gray-900 mb-3">Email Us</h3>
              <p className="text-sm text-[#4B5563] mb-2">For general inquiries and support:</p>
              <a href="mailto:support@hostsblue.com" className="text-[#064A6C] font-medium text-sm">
                support@hostsblue.com
              </a>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <h3 className="font-[800] text-gray-900 mb-3">Live Chat</h3>
              <p className="text-sm text-[#4B5563] mb-2">Available 24/7 in your dashboard:</p>
              <Link to="/login" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
                Log in to Chat
              </Link>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <h3 className="font-[800] text-gray-900 mb-3">Response Time</h3>
              <p className="text-sm text-[#4B5563]">
                We typically respond within 1 hour during business hours and within 4 hours outside business hours.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
            <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#4B5563] mb-1.5" htmlFor="support-name">Name</label>
                    <input
                      id="support-name"
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4B5563] mb-1.5" htmlFor="support-email">Email</label>
                    <input
                      id="support-email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#4B5563] mb-1.5" htmlFor="support-subject">Subject</label>
                  <input
                    id="support-subject"
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                    placeholder="How can we help?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#4B5563] mb-1.5" htmlFor="support-message">Message</label>
                  <textarea
                    id="support-message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent resize-none"
                    placeholder="Describe your issue or question..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#064A6C] hover:bg-[#053A55] text-white font-medium py-3 rounded-[7px] transition-colors btn-arrow-hover flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
