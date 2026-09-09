import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]); // Menangkap file yang dijatuhkan
    }
  };

  const handleConvert = async () => {
    setErrorMessage(null); // Bersihkan error lama

    if (!file) {
      setErrorMessage('Select documents first before extracting.');
      return;
    }

    // Validasi frontend untuk file > 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File is too large. Maximum file size is 10MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsLoading(true);
    setMarkdown('');

    try {
      // Pastikan URL mengarah ke URL produksi Vercel/Render milikmu
      const response = await fetch('https://doc2md-api-d1ox.onrender.com/api/convert', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setOriginalFilename(data.filename);
        setMarkdown(data.markdown_content);
      } else {
        setErrorMessage(`Extraction failed: ${data.detail}`);
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
    setFile(null);
    setMarkdown('');
    setErrorMessage(null);
    setOriginalFilename('');
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
      
      {/* Banner Error dipindah ke luar kotak area drag & drop agar lebih tegas */}
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
            {file ? (
              <span className="file-selected">Selected file: <strong>{file.name}</strong></span>
            ) : (
              "Drag & drop your document here, or use the button below"
            )}
          </div>

          <input 
            type="file" 
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.json" 
            onChange={handleFileChange}
          />
          
          {/* Tombol Extract dan Reset disejajarkan menggunakan class toolbar */}
          <div className="toolbar" style={{ justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
            <button className="primary" onClick={handleConvert} disabled={isLoading || !file}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              {isLoading ? 'Extracting...' : 'Extract Markdown'}
            </button>

            {/* Tombol Reset muncul jika ada file yang dipilih atau hasil render yang tampil */}
            {(file || markdown) && !isLoading && (
              <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                Reset
              </button>
            )}
          </div>
        </div>
        
        {isLoading && <div className="loading-text" style={{ textAlign: 'center' }}>Processing document... This might take a moment.</div>}
      </main>
      
      {markdown && !isLoading && (
        <section className="result-section">
          <h2>Extraction Result</h2>
          <div className="preview-container">
            
            {/* Bagian Kiri: Raw Markdown */}
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

            {/* Bagian Kanan: Visual Preview */}
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