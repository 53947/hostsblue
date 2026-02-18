import { useState } from 'react';
import { Settings, Key, Bell, Building2, Eye, EyeOff } from 'lucide-react';

export function AdminSettingsPage() {
  const [companyName, setCompanyName] = useState('hostsblue');
  const [supportEmail, setSupportEmail] = useState('support@hostsblue.com');

  const [showOpenSRS, setShowOpenSRS] = useState(false);
  const [showWPMUDEV, setShowWPMUDEV] = useState(false);
  const [showSwipesBlue, setShowSwipesBlue] = useState(false);

  const [orderNotifications, setOrderNotifications] = useState(true);
  const [supportNotifications, setSupportNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Settings</h1>
        <p className="text-[#4B5563]">Manage admin dashboard configuration</p>
      </div>

      {/* General Settings */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">General</h2>
            <p className="text-sm text-[#4B5563]">Company and contact information</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-[7px] p-3 text-[#09080E] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div className="mt-4">
          <button className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-4 py-2 rounded-[7px] transition-colors text-sm">
            Save Changes
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">API Keys</h2>
            <p className="text-sm text-[#4B5563]">Manage integrations and service credentials</p>
          </div>
        </div>
        <div className="space-y-4 max-w-2xl">
          {/* OpenSRS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OpenSRS API Key</label>
            <div className="relative">
              <input
                type={showOpenSRS ? 'text' : 'password'}
                value="sk-opensrs-xxxxxxxxxxxxxxxx"
                readOnly
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
                value="sk-wpmudev-xxxxxxxxxxxxxxxx"
                readOnly
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
            <label className="block text-sm font-medium text-gray-700 mb-1">SwipesBlue API Key</label>
            <div className="relative">
              <input
                type={showSwipesBlue ? 'text' : 'password'}
                value="sk-swipesblue-xxxxxxxxxxxxxxxx"
                readOnly
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
      </div>

      {/* Notifications */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#064A6C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#09080E]">Notifications</h2>
            <p className="text-sm text-[#4B5563]">Configure admin notification preferences</p>
          </div>
        </div>
        <div className="space-y-4 max-w-2xl">
          <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[#09080E]">New Order Notifications</p>
              <p className="text-xs text-[#4B5563]">Get notified when a new order is placed</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={orderNotifications}
                onChange={(e) => setOrderNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#064A6C] rounded-full peer peer-checked:bg-[#064A6C] transition-colors cursor-pointer"
                onClick={() => setOrderNotifications(!orderNotifications)}
              >
                <div
                  className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${
                    orderNotifications ? 'translate-x-5' : ''
                  }`}
                />
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[#09080E]">Support Ticket Notifications</p>
              <p className="text-xs text-[#4B5563]">Get notified when a new support ticket is created</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={supportNotifications}
                onChange={(e) => setSupportNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#064A6C] rounded-full peer peer-checked:bg-[#064A6C] transition-colors cursor-pointer"
                onClick={() => setSupportNotifications(!supportNotifications)}
              >
                <div
                  className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${
                    supportNotifications ? 'translate-x-5' : ''
                  }`}
                />
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[#09080E]">Security Alerts</p>
              <p className="text-xs text-[#4B5563]">Be notified about suspicious activity or login attempts</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={securityAlerts}
                onChange={(e) => setSecurityAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#064A6C] rounded-full peer peer-checked:bg-[#064A6C] transition-colors cursor-pointer"
                onClick={() => setSecurityAlerts(!securityAlerts)}
              >
                <div
                  className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${
                    securityAlerts ? 'translate-x-5' : ''
                  }`}
                />
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[#09080E]">Weekly Reports</p>
              <p className="text-xs text-[#4B5563]">Receive a weekly summary of activity and revenue</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={weeklyReports}
                onChange={(e) => setWeeklyReports(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#064A6C] rounded-full peer peer-checked:bg-[#064A6C] transition-colors cursor-pointer"
                onClick={() => setWeeklyReports(!weeklyReports)}
              >
                <div
                  className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${
                    weeklyReports ? 'translate-x-5' : ''
                  }`}
                />
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
