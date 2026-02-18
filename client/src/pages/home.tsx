import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Server, Mail, Shield, Palette, Zap, Headphones, Clock, Check, Sparkles } from 'lucide-react';
import { DomainSearch } from '@/components/domain-search';

/* ------------------------------------------------------------------ */
/*  Scroll-reveal hook + animated Section wrapper                      */
/* ------------------------------------------------------------------ */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function Section({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const tlds = [
  { ext: '.com', price: '$12.99' },
  { ext: '.net', price: '$14.99' },
  { ext: '.org', price: '$12.99' },
  { ext: '.io', price: '$39.99' },
  { ext: '.co', price: '$29.99' },
  { ext: '.dev', price: '$16.99' },
];

const services = [
  { icon: Globe, title: 'Domains', desc: 'Register and manage with WHOIS privacy included.', link: '/domains/search', linkText: 'Search Domains' },
  { icon: Server, title: 'Hosting', desc: 'Fast WordPress hosting with daily backups.', link: '/hosting', linkText: 'View Plans' },
  { icon: Mail, title: 'Email', desc: 'Professional email for your business domain.', link: '/email', linkText: 'Email Plans' },
  { icon: Shield, title: 'Security', desc: 'SSL certificates and malware protection.', link: '/security', linkText: 'Learn More' },
  { icon: Palette, title: 'Website Builder', desc: 'Drag-and-drop builder for beautiful sites.', link: '/website-builder', linkText: 'Coming Soon' },
];

const steps = [
  { num: '1', title: 'Search Domain', desc: 'Find available domains instantly.' },
  { num: '2', title: 'Choose Services', desc: 'Add hosting, email, and security.' },
  { num: '3', title: 'Configure', desc: 'Customize your preferences.' },
  { num: '4', title: 'Checkout', desc: 'Pay securely via swipesblue.' },
  { num: '5', title: 'Launch', desc: 'Go live. Manage from one dashboard.' },
];

const trustSignals = [
  { icon: Zap, title: '99.9% Uptime', desc: 'Enterprise-grade infrastructure with guaranteed reliability.' },
  { icon: Shield, title: 'Secure by Default', desc: 'Free SSL, DDoS protection, and daily backups on every plan.' },
  { icon: Headphones, title: '24/7 Support', desc: 'Expert support team available around the clock.' },
  { icon: Clock, title: 'Instant Activation', desc: 'Domains and hosting activated instantly after purchase.' },
];

const ecosystemBrands = [
  { first: 'hosts', firstColor: '#008060', second: 'blue', secondColor: '#0000FF', icon: '/hostsblue_web_browser_favicon.png' },
  { first: 'swipes', firstColor: '#374151', second: 'blue', secondColor: '#0000FF', icon: '/swipesblue_favicon_wbg.png' },
  { first: 'business', firstColor: '#FF6B00', second: 'blueprint', secondColor: '#0000FF', icon: '/businessblueprint_icon.png' },
  { first: 'scans', firstColor: '#A00028', second: 'blue', secondColor: '#0000FF', icon: '/scansblue_favicon.png' },
];

/* ------------------------------------------------------------------ */
/*  HomePage                                                           */
/* ------------------------------------------------------------------ */

export function HomePage() {
  return (
    <div>

      {/* ============================================================ */}
      {/* SECTION 1 — HERO                                             */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,74,108,0.04) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          <Section>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-[800] text-[#09080E] mb-5 tracking-wide">
              Domains.&nbsp; Hosting.&nbsp; Email.&nbsp; Security.
            </h1>
            <p className="text-lg text-gray-500 mb-12 max-w-xl mx-auto leading-relaxed">
              Everything your business needs online — registered, hosted, and protected in one place.
            </p>
          </Section>

          {/* Domain Search Component */}
          <Section delay={0.15}>
            <DomainSearch variant="hero" />
          </Section>

          {/* TLD Price Chips */}
          <Section delay={0.25}>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
              {tlds.map(({ ext, price }) => (
                <span key={ext} className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{ext}</span> {price}
                </span>
              ))}
            </div>
          </Section>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 2 — SERVICE PILLARS                                  */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Section>
          <div className="text-center mb-14">
            <h2 className="text-3xl font-[800] text-[#09080E] mb-4">Everything You Need to Succeed Online</h2>
            <p className="text-gray-500 max-w-xl mx-auto">From domain registration to website security — all the tools your business needs.</p>
          </div>
        </Section>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {services.map(({ icon: Icon, title, desc, link, linkText }, i) => (
            <Section key={title} delay={i * 0.08}>
              <div className="card card-hover h-full">
                <Icon className="w-5 h-5 text-[#064A6C] mb-4" />
                <h3 className="text-base font-semibold text-[#09080E] mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{desc}</p>
                <Link to={link} className="text-[#064A6C] text-sm font-medium btn-arrow-hover">
                  {linkText}
                </Link>
              </div>
            </Section>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 3 — HOW IT WORKS                                     */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Section>
          <div className="text-center mb-14">
            <h2 className="text-3xl font-[800] text-[#09080E] mb-4">How It Works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Get your business online in five simple steps.</p>
          </div>
        </Section>

        <Section delay={0.1}>
          <div className="relative max-w-5xl mx-auto">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px bg-[#064A6C] opacity-20" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4">
              {steps.map(({ num, title, desc }) => (
                <div key={num} className="text-center relative">
                  <div className="w-12 h-12 bg-[#064A6C] text-white rounded-full flex items-center justify-center text-lg font-[800] mx-auto mb-4 relative z-10">
                    {num}
                  </div>
                  <h3 className="text-sm font-semibold text-[#09080E] mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 4 — HOSTING PLANS PREVIEW                            */}
      {/* ============================================================ */}
      <section className="bg-[#F9FAFB] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-[800] text-[#09080E] mb-4">WordPress Hosting</h2>
              <p className="text-gray-500">Choose the perfect plan. All plans include free migration.</p>
            </div>
          </Section>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <Section delay={0}>
              <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6 h-full flex flex-col">
                <h3 className="text-lg font-semibold text-[#4B5563] mb-2">Starter</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-[800] text-[#09080E]">$9.99</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['1 WordPress Site', '10GB SSD Storage', '25K Monthly Visits', 'Free SSL'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/hosting" className="block text-center py-3 rounded-[7px] font-medium border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C] transition-colors">
                  Get Started
                </Link>
              </div>
            </Section>

            {/* Growth — Most Popular */}
            <Section delay={0.1}>
              <div className="bg-white border-2 border-[#064A6C] rounded-[7px] p-6 relative h-full flex flex-col shadow-sm">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#FFD700] text-[#09080E] text-xs font-medium px-3 py-1 rounded-full">Most Popular</span>
                </div>
                <h3 className="text-lg font-semibold text-[#064A6C] mb-2">Growth</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-[800] text-[#09080E]">$24.99</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['5 WordPress Sites', '50GB SSD Storage', '100K Monthly Visits', 'Free SSL + CDN', 'Staging Environment'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/hosting" className="block text-center py-3 rounded-[7px] font-medium bg-[#064A6C] hover:bg-[#053A55] text-white transition-colors">
                  Get Started
                </Link>
              </div>
            </Section>

            {/* Business */}
            <Section delay={0.2}>
              <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6 h-full flex flex-col">
                <h3 className="text-lg font-semibold text-[#4B5563] mb-2">Business</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-[800] text-[#09080E]">$49.99</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {['20 WordPress Sites', '200GB SSD Storage', '500K Monthly Visits', 'Priority Support', 'White Label'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/hosting" className="block text-center py-3 rounded-[7px] font-medium border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C] transition-colors">
                  Get Started
                </Link>
              </div>
            </Section>
          </div>

          <Section delay={0.3}>
            <div className="text-center mt-10">
              <Link to="/hosting" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
                View all plans &amp; compare
              </Link>
            </div>
          </Section>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 5 — AI WEBSITE BUILDER SHOWCASE                      */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — Copy */}
          <Section>
            <div>
              <span className="badge badge-ai mb-4 inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                AI-POWERED
              </span>
              <h2 className="text-3xl font-[800] text-[#09080E] mb-4">Build Your Website with AI</h2>
              <p className="text-gray-500 mb-8 leading-relaxed max-w-md">
                Describe your business and let our AI create a fully designed, content-rich website in minutes. No coding, no templates, no guesswork.
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  'AI setup in under 5 minutes',
                  'Writes all your content',
                  'Picks matching images & colors',
                  'Live preview as it builds',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link to="/website-builder" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-semibold px-8 py-3 rounded-[7px] transition-all btn-arrow-hover">
                Try AI Builder
              </Link>
            </div>
          </Section>

          {/* Right — CSS-only browser mock */}
          <Section delay={0.15}>
            <div className="rounded-[7px] border border-[#E5E7EB] shadow-lg overflow-hidden bg-white">
              {/* Browser chrome */}
              <div className="bg-[#F3F4F6] border-b border-[#E5E7EB] px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#DC2626] opacity-70" />
                  <span className="w-3 h-3 rounded-full bg-[#FFD700] opacity-70" />
                  <span className="w-3 h-3 rounded-full bg-[#10B981] opacity-70" />
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-white rounded-[4px] border border-[#E5E7EB] px-3 py-1 text-xs text-gray-400 text-center">
                    mywebsite.com
                  </div>
                </div>
              </div>

              {/* Mock website content */}
              <div className="p-0">
                {/* Mini nav */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-[#064A6C]" />
                    <div className="w-16 h-2 bg-[#09080E] rounded-full opacity-60" />
                  </div>
                  <div className="flex gap-3">
                    <div className="w-10 h-2 bg-gray-300 rounded-full" />
                    <div className="w-10 h-2 bg-gray-300 rounded-full" />
                    <div className="w-10 h-2 bg-gray-300 rounded-full" />
                  </div>
                </div>

                {/* Mini hero with gradient */}
                <div
                  className="px-5 py-10 text-center"
                  style={{ background: 'linear-gradient(135deg, #064A6C 0%, #1844A6 100%)' }}
                >
                  <div className="w-40 h-3 bg-white rounded-full mx-auto mb-3 opacity-90" />
                  <div className="w-56 h-2 bg-white rounded-full mx-auto mb-5 opacity-50" />
                  <div className="w-24 h-6 bg-white rounded-[4px] mx-auto opacity-90" />
                </div>

                {/* Mini content blocks */}
                <div className="grid grid-cols-3 gap-3 p-5">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="rounded-[4px] border border-[#E5E7EB] p-3">
                      <div className="w-6 h-6 rounded bg-[#F3F4F6] mb-2" />
                      <div className="w-full h-2 bg-gray-200 rounded-full mb-1.5" />
                      <div className="w-3/4 h-2 bg-gray-100 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 6 — TRUST SIGNALS                                    */}
      {/* ============================================================ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Section>
          <div className="text-center mb-14">
            <h2 className="text-3xl font-[800] text-[#09080E] mb-4">Why hostsblue</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Trusted by businesses worldwide for reliable, secure web services.</p>
          </div>
        </Section>

        <Section delay={0.1}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {trustSignals.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <Icon className="w-6 h-6 text-[#064A6C] mx-auto mb-3" />
                <h3 className="text-base font-semibold text-[#09080E] mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 7 — ECOSYSTEM BANNER                                 */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Section>
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[7px] px-8 py-14 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.15em] mb-4">Part of the TRIADBLUE ecosystem</p>
            <h2 className="text-2xl md:text-3xl font-[800] text-[#09080E] mb-3">One Ecosystem, Infinite Possibilities</h2>
            <p className="text-gray-500 max-w-lg mx-auto mb-10">hostsblue works seamlessly with the entire TRIADBLUE family of platforms.</p>

            <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
              {ecosystemBrands.map(({ first, firstColor, second, secondColor, icon }) => (
                <div key={first + second} className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                  <img src={icon} alt="" className="w-5 h-5" />
                  <span className="text-lg font-[800]">
                    <span style={{ color: firstColor }}>{first}</span>
                    <span style={{ color: secondColor }}>{second}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-semibold px-8 py-3 rounded-[7px] transition-all btn-arrow-hover justify-center">
                Create Account
              </Link>
              <Link to="/domains/search" className="border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-[7px] hover:border-[#064A6C] hover:text-[#064A6C] transition-colors">
                Search Domains
              </Link>
            </div>
          </div>
        </Section>
      </section>
    </div>
  );
}
