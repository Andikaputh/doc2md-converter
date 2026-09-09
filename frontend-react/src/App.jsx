import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  // 1. Ubah state 'file' tunggal menjadi Array 'files'
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // State baru untuk menandakan apakah proses terakhir adalah batch (ZIP)
  const [isBatchSuccess, setIsBatchSuccess] = useState(false); 

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      // Mengambil maksimal 10 file
      setFiles(Array.from(e.target.files).slice(0, 10));
      setIsBatchSuccess(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files).slice(0, 10));
      setIsBatchSuccess(false);
    }
  };

  const handleConvert = async () => {
    setErrorMessage(null);

    if (files.length === 0) {
      setErrorMessage('Select documents first before extracting.');
      return;
    }

    // 2. Validasi ukuran total semua file (Maksimal 100MB untuk batch)
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 100 * 1024 * 1024) {
      setErrorMessage('Total file size is too large. Maximum total size is 100MB.');
      return;
    }

    setIsLoading(true);
    setMarkdown('');
    setIsBatchSuccess(false);

    try {
      if (files.length === 1) {
        // ==========================================
        // CABANG 1: PROSES FILE TUNGGAL (LIVE PREVIEW)
        // ==========================================
        const singleFormData = new FormData();
        singleFormData.append('file', files[0]);

        const response = await fetch('https://doc2md-api-d1ox.onrender.com/api/convert', {
          method: 'POST',
          body: singleFormData
        });

        const data = await response.json();

        if (response.ok) {
          setOriginalFilename(data.filename);
          setMarkdown(data.markdown_content);
        } else {
          setErrorMessage(`Extraction failed: ${data.detail}`);
        }

      } else {
        // ==========================================
        // CABANG 2: PROSES MASAL (DOWNLOAD ZIP)
        // ==========================================
        const batchFormData = new FormData();
        files.forEach(file => {
          batchFormData.append('files', file); // Kunci 'files' sesuai backend
        });

        const response = await fetch('https://doc2md-api-d1ox.onrender.com/api/convert/batch', {
          method: 'POST',
          body: batchFormData
        });

        if (response.ok) {
          // Tangani unduhan ZIP dari memory buffer
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'extracted_markdowns.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setIsBatchSuccess(true);
        } else {
          // Tangani error JSON jika gagal
          const errorData = await response.json();
          setErrorMessage(`Batch extraction failed: ${errorData.detail || 'Unknown error'}`);
        }
      }
    } catch (err) {
      setErrorMessage(`Connection lost: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    const downloadFilename = `${baseName}.md`;

    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFiles([]);
    setMarkdown('');
    setErrorMessage(null);
    setOriginalFilename('');
    setIsBatchSuccess(false);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && markdown) {
        const selection = window.getSelection().toString();
        if (!selection) {
          e.preventDefault();
          handleCopy();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [markdown]);

  return (
    <div className="layout-grid">
      <header>
        <h1>Document Extraction</h1>
        <p>Transform complex files into clean, LLM-ready markdown. Powered by MarkItDown & React.</p>
      </header>
      
      {errorMessage && (
        <div className="error-banner">
          <span>{errorMessage}</span>
          <button className="error-close" onClick={() => setErrorMessage('')}>&times;</button>
        </div>
      )}

      <main>
        <div 
          className={`upload-section ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drag-drop-text">
            {files.length > 0 ? (
              <span className="file-selected">
                {files.length === 1 
                  ? <span>Selected file: <strong>{files[0].name}</strong></span> 
                  : <span>Selected <strong>{files.length}</strong> files ready for batch processing</span>}
              </span>
            ) : (
              "Drag & drop your documents here, or use the button below (Max 10 files)"
            )}
          </div>

          <input 
            type="file" 
            multiple // 3. Atribut krusial agar browser izinkan seleksi banyak file
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.json" 
            onChange={handleFileChange}
          />
          
          <div className="toolbar" style={{ justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
            <button className="primary" onClick={handleConvert} disabled={isLoading || files.length === 0}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              {isLoading ? 'Extracting...' : (files.length > 1 ? 'Extract All to ZIP' : 'Extract Markdown')}
            </button>

            {(files.length > 0 || markdown || isBatchSuccess) && !isLoading && (
              <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                Reset
              </button>
            )}
          </div>
        </div>
        
        {isLoading && <div className="loading-text" style={{ textAlign: 'center' }}>Processing {files.length > 1 ? 'documents' : 'document'}... This might take a moment.</div>}

        {/* 4. Notifikasi sukses khusus untuk Batch Processing */}
        {isBatchSuccess && !isLoading && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Batch Extraction Complete! 🎉</h3>
            <p>Your ZIP file containing {files.length} markdown documents has been downloaded.</p>
          </div>
        )}
      </main>
      
      {/* 5. Live Preview hanya tampil jika bukan proses batch */}
      {markdown && !isLoading && !isBatchSuccess && (
        <section className="result-section">
          <h2>Extraction Result</h2>
          <div className="preview-container">
            
            <div className="raw-markdown">
              <div className="toolbar">
                <button onClick={handleCopy}>
                  {isCopied ? (
                    <>
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copy Source <span className="shortcut-hint">(Cmd/Ctrl + C)</span>
                    </>
                  )}
                </button>
                <button onClick={handleDownload}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Save as .md
                </button>
              </div>
              <pre>{markdown}</pre>
            </div>

            <div className="rendered-markdown">
              <h3 className="preview-title">Live Preview</h3>
              <div className="markdown-body">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            </div>

          </div>
        </section>
      )}
    </div>
  );
}

export default App;