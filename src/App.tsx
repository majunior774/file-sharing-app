import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import type { FileRecord, ShareMeta } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://goon-valiant-fetal.ngrok-free.dev/api';

function buildTree(files: FileRecord[]) {
  const tree: Record<string, any> = {};
  files.forEach((file) => {
    const parts = file.relativePath.split('/');
    let node = tree;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (!node[part]) node[part] = { _files: [], _children: {} };
      if (i === parts.length - 1) {
        node[part]._files.push(file);
      }
      node = node[part]._children;
    }
  });
  return tree;
}

function TreeView({ files, onSelect }: { files: FileRecord[]; onSelect: (file: FileRecord) => void }) {
  const tree = useMemo(() => buildTree(files), [files]);

  const renderNode = (node: any, name: string) => {
    const children = Object.entries(node._children || {});
    const filesInside: FileRecord[] = node._files;
    return (
      <li key={name}>
        <strong>{name}</strong>
        <ul>
          {filesInside.map((file) => (
            <li key={file.storedName}>
              <button className="button" style={{ width: '100%' }} onClick={() => onSelect(file)}>
                {file.relativePath} ({(file.size / 1024).toFixed(1)} KB)
              </button>
            </li>
          ))}
          {children.map(([childName, childNode]) => renderNode(childNode, childName))}
        </ul>
      </li>
    );
  };

  return (
    <div className="tree">
      <ul>{Object.entries(tree).map(([name, node]) => renderNode(node, name))}</ul>
    </div>
  );
}

function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [shareLink, setShareLink] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const fileRecords = useMemo(() => {
    return files.map((file) => ({
      originalName: file.name,
      storedName: file.name,
      size: file.size,
      mimeType: file.type,
      relativePath: (file as any).webkitRelativePath || file.name,
      url: ''
    }));
  }, [files]);

  const previewFiles = files.length > 0;

  const onSelectFile = async (file: File) => {
    const mimeType = file.type;
    if (mimeType.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  useEffect(() => {
    if (selectedFile) {
      const file = files.find((item) => item.name === selectedFile.originalName);
      if (!file) return;
      onSelectFile(file).then((url) => {
        if (url) setPreviewUrl(url);
      });
    }
  }, [selectedFile, files]);

  const handleUpload = async () => {
    if (!files.length) {
      setError('Pick at least one file to upload.');
      return;
    }
    setError('');
    setStatus('Uploading...');
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      if (!resp.ok) {
        const body = await resp.json();
        setError(body.error || 'Upload failed');
        setStatus('');
        return;
      }
      const data = await resp.json();
      const frontendShareUrl = `${window.location.origin}/share/${data.shareId}`;
      setShareLink(frontendShareUrl);
      setStatus('Upload complete!');
    } catch (err) {
      setError('Unable to upload files.');
      setStatus('');
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>File Sharing App</h1>
          <p>Upload files, get a shareable link, and let others preview and download.</p>
        </div>
      </div>

      <div className="card">
        {error && <div className="alert">{error}</div>}
        <div className="input-group">
          <label htmlFor="fileInput">Choose files or folders</label>
          <input
            id="fileInput"
            type="file"
            multiple
            onChange={(event) => {
              setFiles(Array.from(event.target.files || []));
              setShareLink('');
              setPreviewUrl('');
              setSelectedFile(null);
            }}
          />
        </div>

        <div className="grid">
          <div className="card">
            <h3>File structure preview</h3>
            {previewFiles ? (
              <TreeView files={fileRecords} onSelect={(file) => setSelectedFile(file)} />
            ) : (
              <p>Select files or a folder to preview the structure here.</p>
            )}
          </div>

          <div className="card">
            <h3>Selected file preview</h3>
            {selectedFile ? (
              <div className="preview-box">
                <p>{selectedFile.relativePath}</p>
                {previewUrl ? (
                  selectedFile.mimeType.startsWith('image/') ? (
                    <img src={previewUrl} alt={selectedFile.originalName} />
                  ) : selectedFile.mimeType.startsWith('video/') ? (
                    <video controls src={previewUrl} />
                  ) : selectedFile.mimeType.startsWith('audio/') ? (
                    <audio controls src={previewUrl} />
                  ) : (
                    <p>No preview available for this file type.</p>
                  )
                ) : (
                  <p>No preview available.</p>
                )}
              </div>
            ) : (
              <p>Select a file from the structure to preview it here.</p>
            )}
          </div>
        </div>

        <div className="input-group">
          <button className="button" onClick={handleUpload}>Upload and Create Link</button>
          {status && <p>{status}</p>}
        </div>

        {shareLink && (
          <div className="link-box">
            <h4>Shareable link</h4>
            <code>{shareLink}</code>
            <p>Send this URL to your downloader.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SharePage() {
  const { shareId } = useParams();
  const [share, setShare] = useState<ShareMeta | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<FileRecord | null>(null);

  useEffect(() => {
    if (!shareId) return;
    fetch(`${API_BASE}/share/${shareId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Unable to load share');
        }
        return res.json();
      })
      .then((data: ShareMeta) => {
        setShare(data);
        setSelected(data.files[0] || null);
      })
      .catch((err: Error) => setError(err.message));
  }, [shareId]);

  const previewUrl = useMemo(() => {
    if (!selected || !shareId) return '';
    return `${API_BASE.replace('/api', '')}/api/download/${shareId}/${selected.storedName}`;
  }, [selected, shareId]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Download shared files</h1>
        </div>
        <Link className="button" to="/">Upload your own</Link>
      </div>

      {error && <div className="alert">{error}</div>}
      {!error && !share && <p>Loading share data...</p>}

      {share && (
        <div className="card">
          <div className="input-group">
            <p>Share ID: <strong>{share.shareId}</strong></p>
            <p>Uploaded: {new Date(share.createdAt).toLocaleString()}</p>
          </div>

          <div className="grid">
            <div className="card">
              <h3>File structure</h3>
              <TreeView files={share.files} onSelect={(file) => setSelected(file)} />
            </div>

            <div className="card">
              <h3>Preview & download</h3>
              {selected ? (
                <div className="preview-box">
                  <p>{selected.relativePath}</p>
                  {selected.mimeType.startsWith('image/') ? (
                    <img src={previewUrl} alt={selected.originalName} />
                  ) : selected.mimeType.startsWith('video/') ? (
                    <video controls src={previewUrl} />
                  ) : selected.mimeType.startsWith('audio/') ? (
                    <audio controls src={previewUrl} />
                  ) : (
                    <p>No live preview available for this file type.</p>
                  )}
                  <div style={{ marginTop: 16 }}>
                    <a className="button" href={previewUrl} download={selected.originalName}>Download file</a>
                  </div>
                </div>
              ) : (
                <p>Select a file from the tree to preview it.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/share/:shareId" element={<SharePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
