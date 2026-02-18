import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';

const filterTabs = ['All', 'Pending', 'Completed', 'Failed'];

export function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState('All');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Orders</h1>
        <p className="text-[#4B5563]">View and manage customer orders</p>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-1 inline-flex gap-1">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-[7px] text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#064A6C] text-white'
                : 'text-[#4B5563] hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="px-6 py-3 font-medium">Order #</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Items</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[#09080E] mb-1">No orders yet</h3>
                  <p className="text-[#4B5563] text-sm">
                    Orders will appear here when customers make purchases
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
