import { useState } from 'react';
import { CreditCard, Server, Globe, Mail, Headphones, HelpCircle, ChevronDown, ChevronUp, Send } from 'lucide-react';

const faqs = [
  {
    question: 'How do I register a domain?',
    answer: 'Use our domain search to find your perfect domain name. Once you find an available domain, add it to your cart and complete the checkout process. Your domain will be activated instantly.',
  },
  {
    question: 'Can I transfer my existing domain to HostsBlue?',
    answer: 'Yes! You can transfer domains from any registrar to HostsBlue. Go to your dashboard, select "Transfer Domain," enter your domain name and authorization code, and we will handle the rest. Transfers typically complete within 5-7 days.',
  },
  {
    question: 'What hosting plan should I choose?',
    answer: 'For a single website, our Starter plan is a great choice. If you manage multiple sites or need staging environments, the Pro plan offers the best value. For agencies and businesses with high traffic, the Business plan provides maximum resources and white-label options.',
  },
  {
    question: 'Do you offer a money-back guarantee?',
    answer: 'Yes, all hosting plans come with a 30-day money-back guarantee. If you are not satisfied, contact our support team within 30 days for a full refund.',
  },
  {
    question: 'How does billing work?',
    answer: 'You can choose monthly or yearly billing. Yearly plans offer significant savings. All payments are processed securely through SwipesBlue. Your services renew automatically, and you will receive email reminders before each renewal.',
  },
  {
    question: 'Is SSL included with hosting plans?',
    answer: 'Yes, all hosting plans include a free Domain Validated (DV) SSL certificate. For higher levels of validation (OV or EV), you can purchase upgraded SSL certificates from our Security page.',
  },
  {
    question: 'How do I set up email for my domain?',
    answer: 'Once you have a domain registered with HostsBlue, choose an email plan and we will configure the DNS records automatically. You will be able to access your email through webmail, mobile apps, or desktop clients.',
  },
];

const categories = [
  { icon: CreditCard, title: 'Billing', desc: 'Payments, invoices, refunds' },
  { icon: Server, title: 'Technical', desc: 'Hosting, performance, errors' },
  { icon: Globe, title: 'Domains', desc: 'Registration, transfers, DNS' },
  { icon: Mail, title: 'Email', desc: 'Setup, delivery, spam' },
  { icon: Headphones, title: 'Hosting', desc: 'WordPress, backups, staging' },
  { icon: HelpCircle, title: 'General', desc: 'Account, getting started' },
];

export function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Support Center</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Find answers to common questions or reach out to our support team for help.
        </p>
      </div>

      {/* Category Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Browse by Category</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {categories.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#1844A6]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* FAQ Section */}
      <section className="py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-[7px] overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-5 pb-5">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* Contact Form */}
      <section className="py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Contact Support</h2>
        <p className="text-gray-500 text-center mb-8">Can't find what you're looking for? Send us a message.</p>
        <div className="max-w-xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-[7px] p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Visual only - no submission
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="support-name">Name</label>
                  <input
                    id="support-name"
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="support-email">Email</label>
                  <input
                    id="support-email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="support-subject">Subject</label>
                <input
                  id="support-subject"
                  type="text"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="support-message">Message</label>
                <textarea
                  id="support-message"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent resize-none"
                  placeholder="Describe your issue or question..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium py-3 rounded-[7px] transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
