import { X } from 'lucide-react';

export default function BlogPostEditor({ post, onChange, onSave, onClose }) {
  if (!post) return null;

  const wordCount = post.content ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;

  const update = (field, value) => onChange({ ...post, [field]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Edit Post</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={post.title || ''}
              onChange={e => update('title', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Slug</label>
            <input
              type="text"
              value={post.slug || ''}
              onChange={e => update('slug', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Meta Title</label>
            <input
              type="text"
              value={post.meta_title || ''}
              onChange={e => update('meta_title', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Meta Description</label>
            <input
              type="text"
              value={post.meta_description || ''}
              onChange={e => update('meta_description', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-400">Content</label>
              <span className="text-xs text-gray-500">{wordCount} words</span>
            </div>
            <textarea
              rows={20}
              value={post.content || ''}
              onChange={e => update('content', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full resize-y font-mono"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(false)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg"
          >
            Save Draft
          </button>
          <button
            onClick={() => onSave(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
