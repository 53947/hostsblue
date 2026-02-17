import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { websiteBuilderApi } from '@/lib/api';
import { Palette, Plus, Loader2, ExternalLink, Edit, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

export function WebsiteBuilderPage() {
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['website-builder', 'projects'],
    queryFn: websiteBuilderApi.getProjects,
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => websiteBuilderApi.publishProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-builder', 'projects'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Builder</h1>
          <p className="text-gray-500">Build and manage your website projects</p>
        </div>
        <button
          onClick={() => alert('Create project functionality coming soon')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Projects List */}
      {projects && projects.length > 0 ? (
        <div className="grid gap-4">
          {projects.map((project: any) => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Palette className="w-5 h-5 text-[#1844A6]" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">{project.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className={`badge badge-${
                        project.status === 'published' ? 'success' :
                        project.status === 'draft' ? 'warning' : 'neutral'
                      } text-xs`}>
                        {project.status}
                      </span>
                      {project.domain && <span>{project.domain}</span>}
                      {project.updatedAt && (
                        <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert('Edit project functionality coming soon')}
                    className="btn-outline text-sm flex items-center gap-2"
                    title="Edit project"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  {project.domain && project.status === 'published' && (
                    <a
                      href={`https://${project.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline text-sm flex items-center gap-2"
                      title="Preview site"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Preview
                    </a>
                  )}
                  {project.status === 'draft' && (
                    <button
                      onClick={() => publishMutation.mutate(project.id)}
                      disabled={publishMutation.isPending}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <Upload className={`w-4 h-4 ${publishMutation.isPending ? 'animate-spin' : ''}`} />
                      Publish
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No website projects yet</h3>
          <p className="text-gray-500 mb-6">Create your first website with our drag-and-drop builder</p>
          <button
            onClick={() => alert('Create project functionality coming soon')}
            className="btn-primary"
          >
            Create a Website
          </button>
        </div>
      )}
    </div>
  );
}
