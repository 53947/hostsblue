import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { register, isRegisterLoading, registerError } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    register({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
    });
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <span className="text-3xl">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
          <p className="text-gray-500">Start managing your domains and hosting</p>
        </div>

        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {registerError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-[7px] text-red-600 text-sm">
                {(registerError as Error).message}
              </div>
            )}

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-[7px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-[#1844A6] focus:ring-[#1844A6]"
                required
              />
              <span>
                I agree to the{' '}
                <a href="#" className="text-[#1844A6] hover:text-[#133A8A]">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-[#1844A6] hover:text-[#133A8A]">Privacy Policy</a>
              </span>
            </label>

            <button
              type="submit"
              disabled={isRegisterLoading || !acceptTerms}
              className="w-full bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium py-3 rounded-[7px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegisterLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#1844A6] hover:text-[#133A8A] font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
