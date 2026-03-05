import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Server, Mail, Shield, Sparkles, Zap, Headphones, Clock, Check, Search, Package, CreditCard, Rocket } from 'lucide-react';
import { DomainSearch } from '@/components/domain-search';
import { AIBuilder } from '@/components/ai-builder';
import { Brandsignature } from '@/components/ui/brandsignature';
import { MetaTags } from '@/components/seo/meta-tags';

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

const services = [
  { icon: Globe, title: 'Domains', desc: 'Register, transfer, and manage 700+ TLDs', link: '/domains/search', linkText: 'Search Domains →' },
  { icon: Server, title: 'Hosting', desc: 'WordPress & cloud hosting with 99.9% uptime', link: '/hosting', linkText: 'View Plans →' },
  { icon: Mail, title: 'Email', desc: 'Professional email on your domain', link: '/email', linkText: 'Email Plans →' },
  { icon: Sparkles, title: 'Website Builder', desc: 'AI builds your site in minutes', link: '/website-builder', linkText: 'Build My Site →' },
  { icon: Shield, title: 'Security', desc: 'SSL certificates & malware protection', link: '/security', linkText: 'Learn More →' },
];

const milestones = [
  { icon: Search, title: 'Search', desc: 'Find your perfect domain in seconds' },
  { icon: Package, title: 'Bundle', desc: 'Add hosting, email, and security — everything you need' },
  { icon: Sparkles, title: 'Build', desc: 'Let AI design your site or build it yourself' },
  { icon: CreditCard, title: 'Checkout', desc: '__swipesblue__' },
  { icon: Rocket, title: 'Launch', desc: 'Go live instantly. Grow from your dashboard.' },
];

const trustSignals = [
  { icon: Zap, title: '99.9% Uptime', desc: 'Enterprise-grade infrastructure with guaranteed reliability.' },
  { icon: Shield, title: 'Secure by Default', desc: 'Free SSL, DDoS protection, and daily backups on every plan.' },
  { icon: Headphones, title: '24/7 Support', desc: 'Expert support team available around the clock.' },
  { icon: Clock, title: 'Instant Activation', desc: 'Domains and hosting activated instantly after purchase.' },
];

const ecosystemBrandKeys = ['hostsblue', 'swipesblue', 'businessblueprint', 'scansblue', 'triadblue'] as const;

/* ------------------------------------------------------------------ */
/*  How It Works — animated milestones                                 */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative max-w-5xl mx-auto">
      <style>{`
        @keyframes milestone-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes draw-line {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        .milestone-node {
          opacity: 0;
        }
        .milestone-node.milestone-visible {
          animation: milestone-fade-in 0.5s ease-out forwards;
        }
        .connecting-line path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
        }
        .connecting-line.line-visible path {
          animation: draw-line 1.5s ease-out forwards;
        }
      `}</style>

      {/* Desktop connecting line (horizontal) */}
      <svg
        className={`connecting-line hidden md:block absolute top-6 left-[10%] right-[10%] h-[2px] overflow-visible ${visible ? 'line-visible' : ''}`}
        style={{ width: '80%' }}
        preserveAspectRatio="none"
      >
        <path
          d="M0,1 L1000,1"
          stroke="#064A6C"
          strokeWidth="2"
          strokeOpacity="0.2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Mobile connecting line (vertical) */}
      <svg
        className={`connecting-line md:hidden absolute left-6 top-[48px] bottom-[48px] w-[2px] overflow-visible ${visible ? 'line-visible' : ''}`}
        style={{ height: 'calc(100% - 96px)' }}
        preserveAspectRatio="none"
      >
        <path
          d="M1,0 L1,1000"
          stroke="#064A6C"
          strokeWidth="2"
          strokeOpacity="0.2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Desktop: horizontal row / Mobile: vertical stack */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-4">
        {milestones.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className={`milestone-node flex md:flex-col items-center md:items-center text-left md:text-center relative gap-4 md:gap-0 ${visible ? 'milestone-visible' : ''}`}
            style={{ animationDelay: visible ? `${i * 400}ms` : '0ms' }}
          >
            <div className="w-12 h-12 bg-white border-2 border-[#064A6C] rounded-full flex items-center justify-center flex-shrink-0 relative z-10 md:mx-auto md:mb-4">
              <Icon className="w-5 h-5 text-[#064A6C]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#09080E] mb-1">{title}</h3>
              {desc === '__swipesblue__' ? (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Pay securely through <Brandsignature brand="swipesblue" size={12} />
                </p>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HomePage                                                           */
/* ------------------------------------------------------------------ */

export function HomePage() {
  return (
    <div>
      <MetaTags title="hostsblue — Domains, Hosting & Website Builder" description="Register domains, launch managed hosting, deploy cloud servers, and build AI-powered websites — all from one platform." />

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <Section>
            <div className="flex flex-col items-center text-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-[800] text-[#09080E] tracking-wide">
                Domains.&nbsp; Hosting.&nbsp; Email.&nbsp; Security.
              </h1>
              <p className="text-lg text-[#4B5563] mt-4 mb-8 max-w-[480px] leading-relaxed">
                Everything your business needs online — registered, hosted, and protected in one place.
              </p>
            </div>
          </Section>

          <Section delay={0.15}>
            <DomainSearch variant="hero" />
          </Section>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 2 — SERVICE PILLARS                                  */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
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
          <HowItWorks />
        </Section>
      </section>

      <hr className="section-divider" />

      {/* ============================================================ */}
      {/* SECTION 4 — HOSTING PLANS PREVIEW                            */}
      {/* ============================================================ */}
      <section className="py-20">
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
      {/* SECTION 5 — AI WEBSITE BUILDER (INLINE)                      */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Section>
          <div className="text-center mb-8">
            <span className="badge badge-ai mb-4 inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              AI-POWERED
            </span>
            <h2 className="text-3xl font-[800] text-[#09080E] mb-3">Build Your Website with AI</h2>
            <p className="text-[#4B5563] max-w-lg mx-auto">
              Describe your business and our AI builds a fully designed website in minutes. Start right here — your work saves automatically.
            </p>
          </div>
          <AIBuilder />
        </Section>
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
          <div className="bg-white border border-[#E5E7EB] rounded-[7px] px-8 py-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4B5563] mb-3">PART OF THE <Brandsignature brand="triadblue" showTld={false} size={12} /> ECOSYSTEM</p>
            <div className="mb-10">
              <Brandsignature brand="triadblue" showTld={true} size={20} />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
              {ecosystemBrandKeys.map((key) => (
                <Brandsignature key={key} brand={key} size={16} />
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
