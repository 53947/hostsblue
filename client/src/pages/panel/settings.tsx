import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { panelApi } from '@/lib/api';
import {
  Key, Mail, Building2, CreditCard, Eye, EyeOff, Save, ChevronDown, ChevronUp,
  Loader2, Check, X,
} from 'lucide-react';

interface Template {
  id: number;
  slug: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
  isRequired: boolean;
  updatedAt: string;
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#10B981] mt-2">
      <Check className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}

export function PanelSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['panel-settings'],
    queryFn: () => panelApi.getSettings(),
  });

  // API Keys state
  const [apiKeyVisibility, setApiKeyVisibility] = useState<Record<string, boolean>>({});
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [apiKeysSuccess, setApiKeysSuccess] = useState('');

  // Platform state
  const [companyName, setCompanyName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [platformSuccess, setPlatformSuccess] = useState('');

  // Billing state
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [billingSuccess, setBillingSuccess] = useState('');

  // Template state
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateSuccess, setTemplateSuccess] = useState('');

  // Load settings from API data
  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;

    // API keys
    if (s.api_keys) {
      setApiKeyValues(s.api_keys);
    }

    // Platform
    if (s.platform) {
      setCompanyName(s.platform.company_name || '');
      setSupportEmail(s.platform.support_email || '');
      setSupportPhone(s.platform.support_phone || '');
    }

    // Billing
    if (s.billing) {
      setCurrency(s.billing.currency || 'USD');
      setTaxRate(s.billing.tax_rate || '0');
      setPaymentTerms(s.billing.payment_terms || 'Net 30');
    }
  }, [data?.settings]);

  // Mutations
  const settingsMutation = useMutation({
    mutationFn: ({ section, values }: { section: string; values: Record<string, string> }) =>
      panelApi.updateSettings(section, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-settings'] });
    },
  });

  const templateMutation = useMutation({
    mutationFn: ({ slug, values }: { slug: string; values: any }) =>
      panelApi.updateTemplate(slug, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-settings'] });
    },
  });

  function clearSuccessAfterDelay(setter: (v: string) => void) {
    setTimeout(() => setter(''), 3000);
  }

  function handleSaveApiKeys() {
    settingsMutation.mutate(
      { section: 'api_keys', values: apiKeyValues },
      {
        onSuccess: () => {
          setApiKeysSuccess('API keys saved successfully');
          clearSuccessAfterDelay(setApiKeysSuccess);
        },
      },
    );
  }

  function handleSavePlatform() {
    settingsMutation.mutate(
      {
        section: 'platform',
        values: {
          company_name: companyName,
          support_email: supportEmail,
          support_phone: supportPhone,
        },
      },
      {
        onSuccess: () => {
          setPlatformSuccess('Platform settings saved successfully');
          clearSuccessAfterDelay(setPlatformSuccess);
        },
      },
    );
  }

  function handleSaveBilling() {
    settingsMutation.mutate(
      {
        section: 'billing',
        values: {
          currency,
          tax_rate: taxRate,
          payment_terms: paymentTerms,
        },
      },
      {
        onSuccess: () => {
          setBillingSuccess('Billing settings saved successfully');
          clearSuccessAfterDelay(setBillingSuccess);
        },
      },
    );
  }

  function handleSaveTemplate(slug: string) {
    templateMutation.mutate(
      { slug, values: { subject: templateSubject, body: templateBody } },
      {
        onSuccess: () => {
          setEditingTemplate(null);
          setTemplateSuccess(slug);
          clearSuccessAfterDelay(() => setTemplateSuccess(''));
        },
      },
    );
  }

  function handleToggleTemplateActive(template: Template) {
    templateMutation.mutate({
      slug: template.slug,
      values: { isActive: !template.isActive },
    });
  }

  function toggleApiKeyVisibility(key: string) {
    setApiKeyVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function maskValue(value: string): string {
    if (!value || value.length <= 8) return '********';
    return value.slice(0, 4) + '****' + value.slice(-4);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const templates: Template[] = data?.templates ?? [];
  const apiKeys = data?.settings?.api_keys ?? {};
  const apiKeyEntries = Object.entries(apiKeys) as [string, string][];

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
          {apiKeyEntries.map(([key, value]) => {
            const isVisible = apiKeyVisibility[key] ?? false;
            const label = key
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={isVisible ? (apiKeyValues[key] ?? value) : maskValue(apiKeyValues[key] ?? value)}
                    onChange={(e) =>
                      setApiKeyValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    readOnly={!isVisible}
                    className="w-full border border-[#E5E7EB] rounded-[7px] p-3 pr-12 text-[#09080E] bg-[#F9FAFB] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => toggleApiKeyVisibility(key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            );
          })}
          {apiKeyEntries.length === 0 && (
            <p className="text-sm text-[#4B5563]">No API keys configured.</p>
          )}
        </div>
        {apiKeyEntries.length > 0 && (
          <div className="mt-4">
            <button
              onClick={handleSaveApiKeys}
              disabled={settingsMutation.isPending}
              className="bg-[#064A6C] hover:bg-[#053C58] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {settingsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save API Keys
            </button>
            {apiKeysSuccess && <SuccessMessage message={apiKeysSuccess} />}
          </div>
        )}
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
          {templates.map((template) => {
            const isEditing = editingTemplate === template.slug;
            return (
              <div
                key={template.slug}
                className="border border-[#E5E7EB] rounded-[7px] overflow-hidden"
              >
                {/* Template header row */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#09080E]">{template.name}</p>
                    <p className="text-xs text-[#4B5563] truncate">{template.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {templateSuccess === template.slug && (
                      <span className="text-xs text-[#10B981] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}
                    {/* Active toggle */}
                    {!template.isRequired && (
                      <button
                        onClick={() => handleToggleTemplateActive(template)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          template.isActive ? 'bg-[#064A6C]' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            template.isActive ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    )}
                    {/* Edit toggle */}
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingTemplate(null);
                        } else {
                          setEditingTemplate(template.slug);
                          setTemplateSubject(template.subject);
                          setTemplateBody(template.body);
                        }
                      }}
                      className="p-1.5 border border-[#E5E7EB] rounded-[7px] hover:bg-gray-100 transition-colors"
                    >
                      {isEditing ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#4B5563]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#4B5563]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded editor */}
                {isEditing && (
                  <div className="border-t border-[#E5E7EB] p-4 bg-[#F9FAFB] space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <input
                        type="text"
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        className="w-full border border-[#E5E7EB] rounded-[7px] p-2.5 text-[#09080E] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                      <textarea
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                        rows={8}
                        className="w-full border border-[#E5E7EB] rounded-[7px] p-2.5 text-[#09080E] text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent resize-y"
                      />
                    </div>
                    {template.variables.length > 0 && (
                      <div>
                        <p className="text-xs text-[#4B5563] mb-1">Available variables:</p>
                        <div className="flex flex-wrap gap-1">
                          {template.variables.map((v) => (
                            <span
                              key={v}
                              className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono text-[#4B5563]"
                            >
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveTemplate(template.slug)}
                        disabled={templateMutation.isPending}
                        className="bg-[#064A6C] hover:bg-[#053C58] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        {templateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save Template
                      </button>
                      <button
                        onClick={() => setEditingTemplate(null)}
                        className="text-[#4B5563] hover:text-[#09080E] font-medium px-4 py-2 rounded-[7px] transition-colors text-sm flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {templates.length === 0 && (
            <p className="text-sm text-[#4B5563]">No email templates found.</p>
          )}
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
          <button
            onClick={handleSavePlatform}
            disabled={settingsMutation.isPending}
            className="bg-[#064A6C] hover:bg-[#053C58] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {settingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
          {platformSuccess && <SuccessMessage message={platformSuccess} />}
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
          <button
            onClick={handleSaveBilling}
            disabled={settingsMutation.isPending}
            className="bg-[#064A6C] hover:bg-[#053C58] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {settingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Billing Settings
          </button>
          {billingSuccess && <SuccessMessage message={billingSuccess} />}
        </div>
      </div>
    </div>
  );
}
