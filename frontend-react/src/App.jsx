import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    if (!file) {
      alert('No file selected. Please choose a document first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsLoading(true);
    setMarkdown('');

    try {
      const response = await fetch('https://doc2md-api-d1ox.onrender.com/api/convert', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setOriginalFilename(data.filename);
        setMarkdown(data.markdown_content);
      } else {
        alert(`Extraction failed: ${data.detail}`);
      }
    } catch (error) {
      alert(`Network error: ${error.message}`);
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

  // Keyboard shortcut listener untuk menyalin
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
      
      <main>
        <div 
          className={`upload-section ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Teks bantuan untuk area Drag & Drop */}
          <div className="drag-drop-text" style={{ marginBottom: '15px', fontWeight: 'bold' }}>
            {file ? `File terpilih: ${file.name}` : "Tarik & lepas file ke sini, atau klik tombol di bawah"}
          </div>

          <input 
            type="file" 
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.json" 
            onChange={handleFileChange}
          />
          <button className="primary" onClick={handleConvert} disabled={isLoading || !file}>
            {/* SVG icon tetap sama... */}
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            {isLoading ? 'Extracting...' : 'Extract Markdown'}
          </button>
        </div>
        
        {isLoading && <div className="loading-text">Processing document... This might take a moment.</div>}
      </main>
      
      {markdown && !isLoading && (
        <section className="result-section">
          <h2>Parsed Markdown</h2>
          <div className="toolbar">
            <button onClick={handleCopy}>
              {isCopied ? (
                <>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Copied to clipboard
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
        </section>
      )}
    </div>
  );
}

export default App;