import { Link } from 'react-router-dom';
import { Palette, Layers, Zap, Globe } from 'lucide-react';

export function WebsiteBuilderPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 mb-4">Coming Soon</span>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Website Builder</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">Build beautiful, responsive websites without any coding. Drag-and-drop simplicity with professional results.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
        {[
          { icon: Palette, title: 'Drag & Drop', desc: 'Visual builder with intuitive controls' },
          { icon: Layers, title: 'Templates', desc: 'Professional templates for every industry' },
          { icon: Zap, title: 'Fast Loading', desc: 'Optimized for speed and performance' },
          { icon: Globe, title: 'Custom Domain', desc: 'Connect your own domain name' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-[7px] p-6 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Icon className="w-6 h-6 text-[#1844A6]" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
      <div className="text-center mt-12">
        <Link to="/register" className="bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium px-8 py-3 rounded-[7px] transition-colors inline-flex items-center gap-2">
          Get Notified When Available
        </Link>
      </div>
    </div>
  );
}
