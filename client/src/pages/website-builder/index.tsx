import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Sparkles, MousePointer, Smartphone, Search, ShoppingCart, Code, BarChart3, Building, Camera, Palette, Home, Store, BookOpen } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    monthly: 4.99,
    features: [
      '1 Website',
      '5 Pages',
      'AI Page Generation',
      'Basic Templates',
      'Mobile Responsive',
      'Free SSL',
      'Custom Domain',
    ],
    popular: false,
    badge: null,
  },
  {
    name: 'Business',
    monthly: 14.99,
    features: [
      '3 Websites',
      'Unlimited Pages',
      'AI Page Generation',
      'Premium Templates',
      'Mobile Responsive',
      'Free SSL',
      'Custom Domain',
      'SEO Tools',
      'Custom Forms',
      'Analytics Dashboard',
    ],
    popular: true,
    badge: null,
  },
  {
    name: 'Professional',
    monthly: 29.99,
    features: [
      '10 Websites',
      'Unlimited Pages',
      'AI Page Generation',
      'All Templates',
      'Mobile Responsive',
      'Free SSL',
      'Custom Domain',
      'Advanced SEO Tools',
      'Custom Forms',
      'Analytics Dashboard',
      'E-Commerce (50 products)',
      'Custom Code Injection',
      'Priority Support',
    ],
    popular: false,
    badge: null,
  },
  {
    name: 'Agency',
    monthly: 79.99,
    features: [
      'Unlimited Websites',
      'Unlimited Pages',
      'AI Page Generation',
      'All Templates',
      'Mobile Responsive',
      'Free SSL',
      'Custom Domains',
      'Advanced SEO Tools',
      'Custom Forms',
      'Analytics Dashboard',
      'E-Commerce (Unlimited)',
      'Custom Code Injection',
      'White-Label Branding',
      'Client Management',
      'Dedicated Support',
    ],
    popular: false,
    badge: 'NEW',
  },
];

const templateCategories = [
  { icon: Building, name: 'Business', count: '24 templates' },
  { icon: Camera, name: 'Portfolio', count: '18 templates' },
  { icon: Palette, name: 'Restaurant', count: '12 templates' },
  { icon: Home, name: 'Real Estate', count: '15 templates' },
  { icon: Store, name: 'E-Commerce', count: '20 templates' },
  { icon: BookOpen, name: 'Blog', count: '16 templates' },
];

const faqs = [
  {
    q: 'How does the AI website builder work?',
    a: 'Simply describe your business or website idea, and our AI generates a fully designed website with content, images, and layout. You can then customize every element using our drag-and-drop editor.',
  },
  {
    q: 'Can I use my own domain name?',
    a: 'Yes. All plans support custom domain names. If you already have a domain with HostsBlue, you can connect it in one click. External domains work too with simple DNS updates.',
  },
  {
    q: 'Do I need coding skills?',
    a: 'Not at all. The drag-and-drop editor makes it easy to build and customize your site visually. Professional and Agency plans also support custom code injection for advanced users.',
  },
  {
    q: 'Can I sell products on my website?',
    a: 'Yes. The Professional plan supports e-commerce with up to 50 products, and the Agency plan supports unlimited products. Both include payment processing, inventory management, and order tracking.',
  },
  {
    q: 'Is my website mobile responsive?',
    a: 'Every website built with our builder is automatically mobile responsive. Templates are designed to look great on phones, tablets, and desktops without any extra work.',
  },
];

export function WebsiteBuilderPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const getPrice = (monthly: number) => {
    if (billing === 'annual') {
      return (monthly * 0.8).toFixed(2);
    }
    return monthly.toFixed(2);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <span className="badge badge-ai mb-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          AI-POWERED
        </span>
        <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 mb-4">
          Build Your Website with AI
        </h1>
        <p className="text-[#4B5563] max-w-2xl mx-auto text-lg">
          Describe your business and let AI create a stunning, professional website in seconds. Customize everything with our intuitive drag-and-drop editor. No coding required.
        </p>
      </div>

      {/* How It Works */}
      <section className="mb-16">
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-10">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              step: '1',
              title: 'Describe Your Business',
              desc: 'Tell our AI about your business, industry, and style preferences. The more detail you provide, the better the result.',
            },
            {
              step: '2',
              title: 'AI Builds Your Site',
              desc: 'In seconds, AI generates a complete website with pages, content, images, and layout tailored to your business.',
            },
            {
              step: '3',
              title: 'Customize & Launch',
              desc: 'Fine-tune every detail with the drag-and-drop editor. When you are happy, publish your site to the world with one click.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#064A6C] text-white flex items-center justify-center mx-auto mb-4 text-lg font-[800]">
                {step}
              </div>
              <h3 className="font-[800] text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-[#4B5563]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-2">
          Choose Your Plan
        </h2>
        <p className="text-[#4B5563] text-center mb-8 max-w-xl mx-auto">
          Start small and scale as you grow. Upgrade or downgrade at any time.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2.5 rounded-[7px] font-medium transition-colors ${
              billing === 'monthly'
                ? 'bg-[#064A6C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2.5 rounded-[7px] font-medium transition-colors ${
              billing === 'annual'
                ? 'bg-[#064A6C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Annual
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-[7px]">
              Save 20%
            </span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-[7px] p-6 flex flex-col relative ${
                plan.popular
                  ? 'border-2 border-[#064A6C] shadow-lg'
                  : 'border border-[#E5E7EB]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#FFD700] text-[#09080E] text-xs font-[800] px-4 py-1 rounded-[7px]">
                    POPULAR
                  </span>
                </div>
              )}
              {plan.badge === 'NEW' && !plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#FFD700] text-[#09080E] text-xs font-[800] px-4 py-1 rounded-[7px]">
                    NEW
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-[800] text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-[800] text-gray-900">
                    ${getPrice(plan.monthly)}
                  </span>
                  <span className="text-gray-500">/mo</span>
                </div>
                {billing === 'annual' && (
                  <p className="text-sm text-gray-400 mt-1">
                    ${(plan.monthly * 0.8 * 12).toFixed(2)} billed annually
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#4B5563]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`block text-center font-medium px-6 py-3 rounded-[7px] transition-colors btn-arrow-hover justify-center ${
                  plan.popular
                    ? 'bg-[#064A6C] hover:bg-[#053A55] text-white'
                    : 'border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C]'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Template Categories */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-2">
          Templates for Every Industry
        </h2>
        <p className="text-[#4B5563] text-center mb-8 max-w-xl mx-auto">
          Start with a professionally designed template or let AI generate one from scratch.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {templateCategories.map(({ icon: Icon, name, count }) => (
            <div key={name} className="bg-white border border-[#E5E7EB] rounded-[7px] p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#064A6C]" />
                </div>
                <div>
                  <h3 className="font-[800] text-gray-900">{name}</h3>
                  <p className="text-sm text-gray-500">{count}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          Powerful Features
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: MousePointer, title: 'Drag & Drop Editor', desc: 'Intuitive visual editor with real-time preview. Move, resize, and style any element without touching code.' },
            { icon: Smartphone, title: 'Mobile Responsive', desc: 'Every site is automatically optimized for phones, tablets, and desktops. Preview and fine-tune for each device.' },
            { icon: Search, title: 'SEO Tools', desc: 'Built-in SEO tools including meta tags, sitemaps, social previews, and search engine optimization guidance.' },
            { icon: ShoppingCart, title: 'E-Commerce', desc: 'Sell products and services with integrated payment processing, inventory management, and order tracking.' },
            { icon: Code, title: 'Custom Code', desc: 'Inject custom HTML, CSS, and JavaScript for advanced customizations. Full control when you need it.' },
            { icon: BarChart3, title: 'Forms & Analytics', desc: 'Collect leads with custom forms and track visitor behavior with integrated analytics dashboards.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <div className="w-10 h-10 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h3 className="font-[800] text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          Frequently Asked Questions
        </h2>
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
    </div>
  );
}
