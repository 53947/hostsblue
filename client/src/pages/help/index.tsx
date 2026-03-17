import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  HelpCircle, Loader2, ChevronDown, Plus,
  Rocket, Globe, Server, Mail, Shield, CreditCard, Headphones,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchKamatera<T>(endpoint: string, data: string): Promise<T> {
  const url = `${API_URL}/api/v1/kamatera${endpoint}?data=${encodeURIComponent(data)}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

const sectionIcons: Record<string, React.ReactNode> = {
  'Getting Started': <Rocket className="w-5 h-5" />,
  'Domains': <Globe className="w-5 h-5" />,
  'Hosting': <Server className="w-5 h-5" />,
  'Email': <Mail className="w-5 h-5" />,
  'SSL Certificates': <Shield className="w-5 h-5" />,
  'Billing': <CreditCard className="w-5 h-5" />,
  'Support': <Headphones className="w-5 h-5" />,
};

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 px-1 text-left group"
      >
        <span className="text-sm font-medium text-gray-900 group-hover:text-[#064A6C] transition-colors">
          {question}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-4 px-1">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export function HelpCenterPage() {
  const [searchParams] = useSearchParams();
  const data = searchParams.get('data') || '';

  const { data: helpData, isLoading, error } = useQuery({
    queryKey: ['kamatera', 'help', data],
    queryFn: () => fetchKamatera<any>('/help', data),
    enabled: !!data,
  });

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-[7px] p-8 text-center max-w-md">
          <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">This page must be accessed from your cloud management panel.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-[7px] p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Help Center</h2>
          <p className="text-gray-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const sections = helpData?.sections || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[#09080E] mb-3">Help Center</h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Find answers to common questions about your hosting, domains, and cloud services
          </p>
        </div>

        {/* Create Ticket CTA */}
        <div className="bg-[#064A6C] rounded-[7px] p-6 mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Can't find what you're looking for?</h2>
            <p className="text-white/70 text-sm mt-1">Our support team is ready to help you with any issue</p>
          </div>
          <Link
            to={`/support/tickets/new?data=${encodeURIComponent(data)}`}
            className="bg-white text-[#064A6C] font-medium text-sm px-5 py-2.5 rounded-[7px] hover:bg-gray-50 transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create a Ticket
          </Link>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          {sections.map((section: any) => (
            <div key={section.title} className="bg-white border border-gray-200 rounded-[7px] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#064A6C]/10 rounded-lg flex items-center justify-center text-[#064A6C]">
                  {sectionIcons[section.title] || <HelpCircle className="w-5 h-5" />}
                </div>
                <h2 className="text-lg font-semibold text-[#09080E]">{section.title}</h2>
              </div>
              <div>
                {section.items?.map((item: any, idx: number) => (
                  <AccordionItem key={idx} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-10">
          <p className="text-gray-500 text-sm mb-3">Still need help?</p>
          <Link
            to={`/support/tickets/new?data=${encodeURIComponent(data)}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Headphones className="w-4 h-4" />
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
