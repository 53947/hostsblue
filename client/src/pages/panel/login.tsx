import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Eye, EyeOff, Send } from 'lucide-react';
import { Brandsignature } from '@/components/ui/brandsignature';
import { authApi } from '@/lib/api';

export function PanelLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (magicLinkMode) {
        await authApi.requestMagicLink(email);
        setMagicLinkSent(true);
      } else {
        const result = await authApi.login(email, password);
        if (!result.customer.isAdmin) {
          setError('Admin access required. This login is for panel administrators only.');
          return;
        }
        navigate('/panel');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center justify-center gap-2">
              <Brandsignature brand="hostsblue" showTld={false} size={30} />
            </Link>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-8">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-[#064A6C]" />
            </div>
            <h2 className="text-xl font-bold text-[#09080E] mb-2">Check your email</h2>
            <p className="text-[#4B5563] text-sm mb-6">
              We sent a login link to <strong>{email}</strong>. Click the link in the email to sign in.
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setMagicLinkMode(false); }}
              className="text-[#064A6C] hover:text-[#053C58] text-sm font-medium"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4">
            <Brandsignature brand="hostsblue" showTld={false} size={30} />
          </Link>
          <p className="text-lg font-semibold text-[#064A6C]">Panel</p>
          <p className="text-[#4B5563] text-sm mt-1">Sign in to access the admin panel</p>
        </div>

        {/* Form */}
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-[7px] text-[#DC2626] text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="panel-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="panel-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-[#E5E7EB] rounded-[7px] text-[#09080E] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  placeholder="admin@hostsblue.com"
                  required
                />
              </div>
            </div>

            {!magicLinkMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="panel-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="panel-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border border-[#E5E7EB] rounded-[7px] text-[#09080E] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#064A6C] hover:bg-[#053C58] text-white font-medium py-3 rounded-[7px] transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {magicLinkMode ? 'Sending link...' : 'Signing in...'}
                </>
              ) : (
                magicLinkMode ? 'Send Login Link' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setMagicLinkMode(!magicLinkMode); setError(''); }}
              className="text-[#064A6C] hover:text-[#053C58] text-sm font-medium"
            >
              {magicLinkMode ? 'Sign in with password' : 'Email me a login link'}
            </button>
          </div>
        </div>

        <p className="text-center text-[#4B5563] text-sm mt-6 flex items-center justify-center gap-1.5">
          Back to <Brandsignature brand="hostsblue" size={14} linkTo="/" />
        </p>
      </div>
    </div>
  );
}
