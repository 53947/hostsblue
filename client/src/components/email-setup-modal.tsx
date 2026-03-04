import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface EmailSetupModalProps {
  email: string;
  domain: string;
  onClose: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-[#064A6C] rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-gray-900">{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export function EmailSetupModal({ email, domain, onClose }: EmailSetupModalProps) {
  const mailServer = `mail.${domain}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[7px] w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Client Setup</h2>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* IMAP */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              Incoming Mail (IMAP)
              <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">Recommended</span>
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-[7px] px-4">
              <SettingRow label="Server" value={mailServer} />
              <SettingRow label="Port" value="993" />
              <SettingRow label="Security" value="SSL/TLS" />
              <SettingRow label="Username" value={email} />
            </div>
          </div>

          {/* POP3 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Incoming Mail (POP3)</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-[7px] px-4">
              <SettingRow label="Server" value={mailServer} />
              <SettingRow label="Port" value="995" />
              <SettingRow label="Security" value="SSL/TLS" />
              <SettingRow label="Username" value={email} />
            </div>
          </div>

          {/* SMTP */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Outgoing Mail (SMTP)</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-[7px] px-4">
              <SettingRow label="Server" value={mailServer} />
              <SettingRow label="Port" value="587" />
              <SettingRow label="Security" value="STARTTLS" />
              <SettingRow label="Username" value={email} />
            </div>
          </div>

          {/* Password note */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-[7px]">
            <p className="text-sm text-blue-700">
              <strong>Password:</strong> Use your email account password set during account creation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
