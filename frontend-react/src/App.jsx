import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './index.css';

function App() {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State untuk mode tunggal
  const [markdown, setMarkdown] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // State untuk mode batch (Pop-up)
  const [batchResults, setBatchResults] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files).slice(0, 10));
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files).slice(0, 10));
    }
  };

  const handleConvert = async () => {
    setErrorMessage(null);
    if (files.length === 0) return setErrorMessage('Select documents first before extracting.');

    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 100 * 1024 * 1024) return setErrorMessage('Total file size is too large. Maximum 100MB.');

    setIsLoading(true);
    setMarkdown('');
    setBatchResults([]);

    try {
      if (files.length === 1) {
        // --- MODE TUNGGAL (LIVE PREVIEW) ---
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
        // --- MODE BATCH (POP-UP PREVIEW) ---
        const batchFormData = new FormData();
        files.forEach(file => batchFormData.append('files', file));

        const response = await fetch('https://doc2md-api-d1ox.onrender.com/api/convert/batch', {
          method: 'POST',
          body: batchFormData
        });
        
        const data = await response.json();
        if (response.ok) {
          setBatchResults(data.results);
          setShowBatchModal(true);
        } else {
          setErrorMessage(`Batch extraction failed: ${data.detail || 'Unknown error'}`);
        }
      }
    } catch (err) {
      setErrorMessage(`Connection lost: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Fungsi Mode Tunggal ---
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    saveAs(blob, `${baseName}.md`);
  };

  // --- Fungsi Mode Batch ---
  const copyBatchItem = (content, index) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedBatchIndex(index);
      setTimeout(() => setCopiedBatchIndex(null), 2000);
    });
  };

  const downloadBatchItem = (content, filename) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    saveAs(blob, filename);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    batchResults.forEach(res => {
      if (res.success) zip.file(res.filename, res.content);
      else zip.file(`ERROR_${res.filename}.txt`, `Failed: ${res.error}`);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'extracted_markdowns.zip');
  };

  const handleReset = () => {
    setFiles([]); setMarkdown(''); setErrorMessage(null); setOriginalFilename('');
    setBatchResults([]); setShowBatchModal(false);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

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
        <div className={`upload-section ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="drag-drop-text">
            {files.length > 0 ? (
              <span className="file-selected">
                {files.length === 1 ? <span>Selected file: <strong>{files[0].name}</strong></span> : <span>Selected <strong>{files.length}</strong> files ready for batch processing</span>}
              </span>
            ) : "Drag & drop your documents here, or use the button below (Max 10 files)"}
          </div>

          <input type="file" multiple accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.json" onChange={handleFileChange} />
          
          <div className="toolbar" style={{ justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
            <button className="primary" onClick={handleConvert} disabled={isLoading || files.length === 0}>
              {isLoading ? 'Extracting...' : (files.length > 1 ? 'Preview Batch Extraction' : 'Extract Markdown')}
            </button>
            {(files.length > 0 || markdown) && !isLoading && (
              <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Reset</button>
            )}
          </div>
        </div>
        
        {isLoading && <div className="loading-text" style={{ textAlign: 'center' }}>Processing {files.length > 1 ? 'documents' : 'document'}... This might take a moment.</div>}
      </main>
      
      {/* --- LIVE PREVIEW (TUNGGAL) --- */}
      {markdown && !isLoading && files.length === 1 && (
        <section className="result-section">
          <h2>Extraction Result</h2>
          <div className="preview-container">
            <div className="raw-markdown">
              <div className="toolbar">
                <button onClick={handleCopy}>{isCopied ? 'Copied' : 'Copy Source'}</button>
                <button onClick={handleDownload}>Save as .md</button>
              </div>
              <pre>{markdown}</pre>
            </div>
            <div className="rendered-markdown">
              <h3 className="preview-title">Live Preview</h3>
              <div className="markdown-body"><ReactMarkdown>{markdown}</ReactMarkdown></div>
            </div>
          </div>
        </section>
      )}

      {/* --- POP-UP MODAL (BATCH) --- */}
      {showBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-page)', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>Batch Results ({batchResults.length} files)</h2>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {batchResults.map((res, index) => (
                <div key={index} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: res.success ? 'transparent' : '#fdf2f2' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ margin: '0 0 0.25rem 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{res.filename}</h4>
                    <span style={{ fontSize: '0.8rem', color: res.success ? 'var(--text-muted)' : '#9b2c2c' }}>
                      {res.success ? `${(res.content.length / 1024).toFixed(1)} KB extracted` : `Error: ${res.error}`}
                    </span>
                  </div>
                  
                  {res.success && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => copyBatchItem(res.content, index)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                        {copiedBatchIndex === index ? 'Copied!' : 'Copy'}
                      </button>
                      <button onClick={() => downloadBatchItem(res.content, res.filename)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        ↓ .md
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <button onClick={() => setShowBatchModal(false)} style={{ backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Close</button>
              <button onClick={downloadAllAsZip} className="primary">Download All as .ZIP</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;