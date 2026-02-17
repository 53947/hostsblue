import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Settings, Loader2, Save, User, Lock, Bell } from 'lucide-react';

export function SettingsPage() {
  const { customer } = useAuth();

  const [firstName, setFirstName] = useState(customer?.firstName || '');
  const [lastName, setLastName] = useState(customer?.lastName || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [company, setCompany] = useState(customer?.company || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address1, setAddress1] = useState(customer?.address1 || '');
  const [address2, setAddress2] = useState(customer?.address2 || '');
  const [city, setCity] = useState(customer?.city || '');
  const [state, setState] = useState(customer?.state || '');
  const [zip, setZip] = useState(customer?.zip || '');
  const [country, setCountry] = useState(customer?.country || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [renewalReminders, setRenewalReminders] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const profileMutation = useMutation({
    mutationFn: (data: any) => authApi.updateProfile(data),
    onSuccess: () => {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 3000);
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({
      firstName,
      lastName,
      email,
      company,
      phone,
      address1,
      address2,
      city,
      state,
      zip,
      country,
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account settings and preferences</p>
      </div>

      {/* Profile Section */}
      <form onSubmit={handleProfileSubmit} className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-[#1844A6]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Address Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Address</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
              <input
                type="text"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                type="text"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                placeholder="Apartment, suite, etc. (optional)"
                className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / Postal Code</label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {profileMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {profileMutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
          {profileSaved && (
            <span className="text-green-600 text-sm">Profile saved successfully!</span>
          )}
          {profileMutation.error && (
            <span className="text-red-500 text-sm">Failed to save profile. Please try again.</span>
          )}
        </div>
      </form>

      {/* Password Section */}
      <form onSubmit={handlePasswordSubmit} className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#1844A6]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4 max-w-lg">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {passwordMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
          </button>
          {passwordChanged && (
            <span className="text-green-600 text-sm">Password changed successfully!</span>
          )}
          {passwordMutation.error && (
            <span className="text-red-500 text-sm">Failed to change password. Please check your current password.</span>
          )}
        </div>
      </form>

      {/* Notification Preferences */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#1844A6]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Email Notifications</p>
              <p className="text-xs text-gray-500">Receive notifications about your account via email</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1844A6] rounded-full peer peer-checked:bg-[#1844A6] transition-colors cursor-pointer" onClick={() => setEmailNotifications(!emailNotifications)}>
                <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${emailNotifications ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Renewal Reminders</p>
              <p className="text-xs text-gray-500">Get reminded before domains and services expire</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={renewalReminders}
                onChange={(e) => setRenewalReminders(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1844A6] rounded-full peer peer-checked:bg-[#1844A6] transition-colors cursor-pointer" onClick={() => setRenewalReminders(!renewalReminders)}>
                <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${renewalReminders ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Security Alerts</p>
              <p className="text-xs text-gray-500">Be notified about security events and login activity</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={securityAlerts}
                onChange={(e) => setSecurityAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1844A6] rounded-full peer peer-checked:bg-[#1844A6] transition-colors cursor-pointer" onClick={() => setSecurityAlerts(!securityAlerts)}>
                <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${securityAlerts ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Marketing Emails</p>
              <p className="text-xs text-gray-500">Receive promotions, tips, and product updates</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={marketingEmails}
                onChange={(e) => setMarketingEmails(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1844A6] rounded-full peer peer-checked:bg-[#1844A6] transition-colors cursor-pointer" onClick={() => setMarketingEmails(!marketingEmails)}>
                <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${marketingEmails ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
