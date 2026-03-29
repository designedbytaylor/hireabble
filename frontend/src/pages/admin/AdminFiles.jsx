import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import {
  FolderOpen, Upload, Trash2, Download, FileText, Image as ImageIcon,
  Film, FileSpreadsheet, File, RefreshCw, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getFileIcon(contentType) {
  if (contentType?.startsWith('image/')) return ImageIcon;
  if (contentType?.startsWith('video/')) return Film;
  if (contentType?.includes('spreadsheet') || contentType?.includes('csv')) return FileSpreadsheet;
  if (contentType?.includes('pdf') || contentType?.includes('document') || contentType?.includes('text')) return FileText;
  return File;
}

export default function AdminFiles() {
  const { token } = useAdminAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(res.data.files || []);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setUploading(true);
    let uploaded = 0;
    for (const file of selectedFiles) {
      try {
        const form = new FormData();
        form.append('file', file);
        await axios.post(`${API}/admin/files/upload`, form, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        uploaded++;
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${err.response?.data?.detail || 'Unknown error'}`);
      }
    }
    if (uploaded > 0) {
      toast.success(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded`);
      fetchFiles();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId) => {
    setConfirmDelete(null);
    try {
      await axios.delete(`${API}/admin/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('File deleted');
      setFiles(prev => prev.filter(f => f.id !== fileId));
      if (previewFile?.id === fileId) setPreviewFile(null);
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const filtered = search
    ? files.filter(f => f.filename.toLowerCase().includes(search.toLowerCase()))
    : files;

  const images = filtered.filter(f => f.content_type?.startsWith('image/'));
  const others = filtered.filter(f => !f.content_type?.startsWith('image/'));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" /> Files
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{files.length} file{files.length !== 1 ? 's' : ''} stored</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
            {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full sm:w-72 bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">{search ? 'No files match your search' : 'No files uploaded yet'}</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-gray-700">
            <Upload className="w-4 h-4 mr-2" /> Upload your first file
          </Button>
        </div>
      ) : (
        <>
          {/* Images grid */}
          {images.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Images ({images.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {images.map(file => (
                  <div key={file.id} className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500/30 transition-colors">
                    <div
                      className="aspect-square bg-gray-800 cursor-pointer relative"
                      onClick={() => setPreviewFile(file)}
                    >
                      <img
                        src={`${BACKEND}${file.url}`}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-white text-xs font-medium bg-black/60 px-2 py-1 rounded">Preview</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs text-white font-medium truncate" title={file.filename}>{file.filename}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-gray-500">{formatSize(file.size)}</span>
                        <div className="flex gap-1">
                          <a href={`${BACKEND}${file.url}`} download={file.filename} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 p-0.5" title="Download">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={() => setConfirmDelete(file)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other files list */}
          {others.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Documents & Other Files ({others.length})</h2>
              <div className="space-y-2">
                {others.map(file => {
                  const Icon = getFileIcon(file.content_type);
                  return (
                    <div key={file.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{file.filename}</p>
                        <p className="text-xs text-gray-500">{formatSize(file.size)} &middot; {formatDate(file.uploaded_at)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <a href={`${BACKEND}${file.url}`} download={file.filename} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white h-8 px-3 text-xs">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                          </Button>
                        </a>
                        <Button onClick={() => setConfirmDelete(file)} variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 px-3 text-xs">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Image preview modal */}
      {previewFile && (
        <div onClick={() => setPreviewFile(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img src={`${BACKEND}${previewFile.url}`} alt={previewFile.filename} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }} />
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-medium">{previewFile.filename}</span>
              <span className="text-gray-400 text-xs">{formatSize(previewFile.size)}</span>
              <a href={`${BACKEND}${previewFile.url}`} download={previewFile.filename} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 px-3 text-xs">
                  <Download className="w-3 h-3 mr-1.5" /> Download
                </Button>
              </a>
              <Button onClick={() => setPreviewFile(null)} variant="outline" size="sm" className="border-gray-600 text-gray-300 h-7 px-3 text-xs">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={`Delete "${confirmDelete?.filename}"?`}
        description="This file will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
