import { useState } from 'react';
import { Key, Mail, Building2, CreditCard, Eye, EyeOff, Pencil } from 'lucide-react';

const emailTemplates = [
  { name: 'Welcome Email', description: 'Sent when a new customer registers', lastEdited: 'Jan 15, 2026' },
  { name: 'Password Reset', description: 'Sent when a customer requests password reset', lastEdited: 'Dec 20, 2025' },
  { name: 'Domain Renewal Reminder', description: 'Sent 30 days before domain expiry', lastEdited: 'Nov 8, 2025' },
  { name: 'Invoice / Payment Receipt', description: 'Sent after successful payment', lastEdited: 'Jan 3, 2026' },
  { name: 'Support Ticket Reply', description: 'Sent when staff replies to a ticket', lastEdited: 'Feb 1, 2026' },
];

export function PanelSettingsPage() {
  const [showOpenSRS, setShowOpenSRS] = useState(false);
  const [showWPMUDEV, setShowWPMUDEV] = useState(false);
  const [showSwipesBlue, setShowSwipesBlue] = useState(false);

  const [companyName, setCompanyName] = useState('hostsblue');
  const [supportEmail, setSupportEmail] = useState('support@hostsblue.com');
  const [supportPhone, setSupportPhone] = useState('+1 (800) 555-0199');

  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Settings</h1>
        <p className="text-[#4B5563]">Manage panel configuration and integrations</p>
      </div>

      {/* API Keys */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">API Keys</h2>
            <p className="text-sm text-[#4B5563]">Manage integration credentials</p>
          </div>
        </div>
        <div className="space-y-4 max-w-2xl">
          {/* OpenSRS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OpenSRS API Key</label>
            <div className="relative">
              <input
                type={showOpenSRS ? 'text' : 'password'}
                defaultValue="sk-opensrs-4f8a2b1c9d3e7f6a0b5c8d2e"
                className="w-full border border-[#E5E7EB] rounded-[7px] p-3 pr-12 text-[#09080E] bg-[#F9FAFB] text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowOpenSRS(!showOpenSRS)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showOpenSRS ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* WPMUDEV */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WPMUDEV API Key</label>
            <div className="relative">
              <input
                type={showWPMUDEV ? 'text' : 'password'}
                defaultValue="sk-wpmudev-7c3d9e1f2a4b6c8d0e5f7a9b"
                className="w-full border border-[#E5E7EB] rounded-[7px] p-3 pr-12 text-[#09080E] bg-[#F9FAFB] text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowWPMUDEV(!showWPMUDEV)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showWPMUDEV ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* SwipesBlue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">swipesblue API Key</label>
            <div className="relative">
              <input
                type={showSwipesBlue ? 'text' : 'password'}
                defaultValue="sk-swipesblue-2e8f1a3c5d7b9e0f4a6c8d2e"
                className="w-full border border-[#E5E7EB] rounded-[7px] p-3 pr-12 text-[#09080E] bg-[#F9FAFB] text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSwipesBlue(!showSwipesBlue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSwipesBlue ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm">
            Save API Keys
          </button>
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">Email Templates</h2>
            <p className="text-sm text-[#4B5563]">Manage system email templates</p>
          </div>
        </div>
        <div className="space-y-3 max-w-2xl">
          {emailTemplates.map((template) => (
            <div
              key={template.name}
              className="flex items-center justify-between p-3 border border-[#E5E7EB] rounded-[7px] hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-[#09080E]">{template.name}</p>
                <p className="text-xs text-[#4B5563]">{template.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#4B5563]">Edited {template.lastEdited}</span>
                <button className="p-1.5 border border-[#E5E7EB] rounded-[7px] hover:bg-gray-100 transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-[#4B5563]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Info */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">Platform Info</h2>
            <p className="text-sm text-[#4B5563]">Company and contact information</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
            <input
              type="tel"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-4">
          <button className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm">
            Save Changes
          </button>
        </div>
      </div>

      {/* Billing Settings */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">Billing Settings</h2>
            <p className="text-sm text-[#4B5563]">Configure billing and payment defaults</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              min="0"
              max="100"
              step="0.1"
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            >
              <option value="Due on Receipt">Due on Receipt</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm">
            Save Billing Settings
          </button>
        </div>
      </div>
    </div>
  );
}
