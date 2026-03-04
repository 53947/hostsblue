import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MxRecordsModalProps {
  domain: string;
  domainUuid?: string;
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

export function MxRecordsModal({ domain, domainUuid, onClose }: MxRecordsModalProps) {
  const mxContent = `mail.${domain}`;
  const spfContent = 'v=spf1 include:_spf.hostsblue.com ~all';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[7px] w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Required DNS Records</h2>
            <p className="text-sm text-gray-500 mt-0.5">for email on <span className="font-mono">{domain}</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* MX Record */}
          <div className="bg-gray-50 border border-gray-200 rounded-[7px] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">MX Record</h3>
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Required</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-mono text-gray-900">MX</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Name</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-gray-900">@</span>
                  <CopyButton value="@" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Content</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-gray-900">{mxContent}</span>
                  <CopyButton value={mxContent} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Priority</span>
                <span className="font-mono text-gray-900">10</span>
              </div>
            </div>
          </div>

          {/* SPF Record */}
          <div className="bg-gray-50 border border-gray-200 rounded-[7px] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">SPF Record</h3>
              <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">Recommended</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-mono text-gray-900">TXT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Name</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-gray-900">@</span>
                  <CopyButton value="@" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Content</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-gray-900 text-xs break-all">{spfContent}</span>
                  <CopyButton value={spfContent} />
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <p className="text-sm text-gray-500">
            These records must be added to your domain's DNS settings for email to work properly.
          </p>

          {/* CTA */}
          {domainUuid ? (
            <Link
              to={`/dashboard/domains/${domainUuid}`}
              onClick={onClose}
              className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2.5 rounded-[7px] flex items-center justify-center gap-2 transition-colors w-full"
            >
              <ExternalLink className="w-4 h-4" />
              Go to DNS Settings
            </Link>
          ) : (
            <Link
              to="/dashboard/domains"
              onClick={onClose}
              className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2.5 rounded-[7px] flex items-center justify-center gap-2 transition-colors w-full"
            >
              <ExternalLink className="w-4 h-4" />
              Go to Domains
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
