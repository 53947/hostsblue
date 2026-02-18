import { useState } from 'react';
import { Headphones } from 'lucide-react';

const priorityFilters = ['All', 'Urgent', 'High', 'Medium', 'Low'];

const priorityColors: Record<string, string> = {
  Urgent: 'bg-red-100 text-[#DC2626]',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-[#4B5563]',
};

export function AdminSupportPage() {
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Support Tickets</h1>
        <p className="text-[#4B5563]">Manage customer support requests</p>
      </div>

      {/* Priority Filters */}
      <div className="flex items-center gap-2">
        {priorityFilters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-[7px] text-sm font-medium transition-colors border ${
              activeFilter === filter
                ? filter === 'All'
                  ? 'bg-[#064A6C] text-white border-[#064A6C]'
                  : filter === 'Urgent'
                  ? 'bg-red-50 text-[#DC2626] border-red-200'
                  : filter === 'High'
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : filter === 'Medium'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  : 'bg-gray-50 text-[#4B5563] border-gray-200'
                : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-gray-50'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Support Tickets Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="px-6 py-3 font-medium">Ticket #</th>
                <th className="px-6 py-3 font-medium">Subject</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Priority</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <Headphones className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[#09080E] mb-1">No support tickets</h3>
                  <p className="text-[#4B5563] text-sm">
                    Support tickets will appear here when customers submit requests
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Priority Badge Legend */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-4">
        <h3 className="text-sm font-medium text-[#09080E] mb-3">Priority Levels</h3>
        <div className="flex items-center gap-4">
          {Object.entries(priorityColors).map(([label, classes]) => (
            <span key={label} className={`px-3 py-1 rounded-full text-xs font-medium ${classes}`}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
