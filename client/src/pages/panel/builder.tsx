import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Eye, Ban, Trash2, Loader2, Palette, Globe, ExternalLink } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';
async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${endpoint}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.data;
}

const statusColors: Record<string, string> = {
  published: 'bg-[#10B981] text-white',
  draft: 'bg-[#FFD700] text-[#09080E]',
  suspended: 'bg-[#DC2626] text-white',
};

export function PanelBuilderPage() {
  const queryClient = useQueryClient();
  const [openActions, setOpenActions] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['panel', 'builder-projects'],
    queryFn: () => adminFetch<any[]>('/admin/builder/projects'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (uuid: string) =>
      adminFetch(`/admin/builder/projects/${uuid}/unpublish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'builder-projects'] });
      setOpenActions(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const publishedCount = projects?.filter((p: any) => p.status === 'published').length || 0;
  const draftCount = projects?.filter((p: any) => p.status === 'draft').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Website Builder</h1>
        <p className="text-[#4B5563]">All customer website builder projects</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Projects', value: projects?.length || 0 },
          { label: 'Published', value: publishedCount },
          { label: 'Drafts', value: draftCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-[7px] p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* Projects Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className="px-6 py-3 font-medium">Project</th>
              <th className="px-6 py-3 font-medium">Customer</th>
              <th className="px-6 py-3 font-medium">Template</th>
              <th className="px-6 py-3 font-medium">Pages</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Updated</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects && projects.length > 0 ? projects.map((project: any) => (
              <tr key={project.uuid} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-[#09080E]">{project.name}</div>
                      {project.slug && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Globe className="w-3 h-3" />{project.slug}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-[#09080E]">{project.customerEmail || `#${project.customerId}`}</td>
                <td className="px-6 py-3 text-sm text-[#4B5563]">{project.templateSlug || '—'}</td>
                <td className="px-6 py-3 text-sm text-[#4B5563]">{project.pageCount || 0}</td>
                <td className="px-6 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[project.status] || 'bg-gray-100 text-gray-500'}`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-[#4B5563]">
                  {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-3 relative">
                  <button
                    onClick={() => setOpenActions(openActions === project.uuid ? null : project.uuid)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreHorizontal className="w-4 h-4 text-[#4B5563]" />
                  </button>
                  {openActions === project.uuid && (
                    <div className="absolute right-6 top-10 bg-white border border-[#E5E7EB] rounded-[7px] shadow-lg py-1 z-10 w-44">
                      {project.status === 'published' && project.slug && (
                        <a
                          href={`/sites/${project.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" /> View Live
                        </a>
                      )}
                      {project.status === 'published' && (
                        <button
                          onClick={() => unpublishMutation.mutate(project.uuid)}
                          className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Ban className="w-4 h-4" /> Unpublish
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No builder projects yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
