import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useRef } from 'react';
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
  const [expandedBatchItems, setExpandedBatchItems] = useState({});
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [markdownTemplate, setMarkdownTemplate] = useState('standard');
  
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [addLlmContext, setAddLlmContext] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const resultRef = useRef(null);

  // Word and token count estimation function
  const getStats = (text) => {
    if (!text) return { words: 0, tokens: 0 };
    const words = text.trim().split(/\s+/).length;
    return {
      words: words,
      tokens: Math.ceil(words * 1.3) // Rumus standar LLM
    };
  };

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

  const removeFile = (indexToRemove) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleConvert = async () => {
    setErrorMessage(null);

    if (files.length === 0) {
      setErrorMessage('Select documents first before extracting.');
      return;
    }

    // Mengembalikan fitur validasimu: Cek jika ADA file yang lebih dari 10MB
    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setErrorMessage(`File terlalu besar: ${oversizedFiles.map(f => f.name).join(', ')}. Maksimal ukuran per file adalah 10MB.`);
      return;
    }

    setIsLoading(true);
    setMarkdown('');
    setBatchResults([]); // Reset hasil batch
    setExpandedBatchItems({});
    setProgress(10);
    setProgressText('Uploading files to server...');

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) {
          setProgressText('Extracting documents... (This might take a moment)');
          return prev; // Berhenti di 85% sampai server selesai merespons
        }
        return prev + 15; // Naik perlahan
      });
    }, 1000);

    try {
      if (files.length === 1) {
        // --- MODE 1 FILE (LIVE PREVIEW) ---
        const singleFormData = new FormData();
        singleFormData.append('file', files[0]);

        const response = await fetch('http://localhost:8000/api/convert', { // Ganti URL localhost/produksi sesuai kebutuhan
          method: 'POST',
          body: singleFormData
        });

        const data = await response.json();
        clearInterval(progressInterval); // Hentikan timer otomatis
        setProgress(100);
        setProgressText('Finalizing results...');

        if (response.ok) {
          setOriginalFilename(data.filename);
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          
          // Suntikkan Metadata jika fitur aktif
          let finalContent = data.markdown_content;
          if (addLlmContext) {
            const date = new Date().toISOString().split('T')[0];
            finalContent = `> **Document Context for LLM**\n> Filename: \`${data.filename}\`\n> Extracted on: \`${date}\`\n\n---\n\n${finalContent}`;
          }
          
          setMarkdown(finalContent);
        } else {
          setErrorMessage(`Extraction failed: ${data.detail}`);
        }
      } else {
        // --- MODE BANYAK FILE (MODAL BATCH) ---
        const batchFormData = new FormData();
        files.forEach(f => batchFormData.append('files', f));

        const response = await fetch('http://localhost:8000/api/convert/batch', {
          method: 'POST',
          body: batchFormData
        });
        
        const data = await response.json();
        clearInterval(progressInterval); // Hentikan timer otomatis
        setProgress(100);
        setProgressText('Finalizing results...');
        
        if (response.ok) {
          // Inject Metadata into all files in the batch
          const processedResults = data.results.map(res => {
            if (res.success && addLlmContext) {
              const date = new Date().toISOString().split('T')[0];
              res.content = `> **Document Context for LLM**\n> Filename: \`${res.filename}\`\n> Extracted on: \`${date}\`\n\n---\n\n${res.content}`;
            }
            return res;
          });
          
          setBatchResults(processedResults);
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          setShowBatchModal(true);
        } else {
          setErrorMessage(`Batch extraction failed: ${data.detail || 'Unknown error'}`);
        }
      }
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setErrorMessage(`Connection lost: ${err.message}`);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setIsLoading(false), 500);
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

  const toggleBatchItem = (index) => {
    setExpandedBatchItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
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

  const getMergedContent = () => {
    let mergedDocs = batchResults
      .filter(res => res.success)
      .map(res => {
        let content = res.content;
        
        // Modifikasi isi berdasarkan template yang dipilih
        if (markdownTemplate === 'qa') {
          content = `### Source: ${res.filename}\n\n**Q: Apa poin inti atau ringkasan dari dokumen ini?**\nA:\n${content}\n\n**Q: Apa potensi pertanyaan/tindak lanjut dari dokumen ini?**\nA:\n- `;
        } else if (markdownTemplate === 'summary') {
          content = `## Executive Summary: ${res.filename}\n> *Ringkasan otomatis berdasarkan dokumen sumber.*\n\n${content}`;
        }
        
        return `\n\n# ==========================================\n# 📄 DOCUMENT: ${res.filename}\n# ==========================================\n\n${content}`;
      })
      .join('\n\n');
      
    if (customPrompt.trim()) {
      mergedDocs = `### INSTRUCTIONS ###\n${customPrompt.trim()}\n\n### KNOWLEDGE BASE ###${mergedDocs}`;
    }
    
    return mergedDocs;
  };

  const copyAllMerged = () => {
    const merged = getMergedContent();
    navigator.clipboard.writeText(merged).then(() => {
      setIsCopiedAll(true);
      setTimeout(() => setIsCopiedAll(false), 2000);
    });
  };

  const downloadAllMerged = () => {
    const merged = getMergedContent();
    const blob = new Blob([merged], { type: 'text/markdown' });
    saveAs(blob, 'merged_documents.md');
  };

  const handleReset = () => {
    setFiles([]); setMarkdown(''); setErrorMessage(null); setOriginalFilename('');
    setBatchResults([]); setShowBatchModal(false);
    setExpandedBatchItems({});
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="layout-grid">
      <header>
        <h1>Document Extraction</h1>
        <p>Transform complex files into clean, LLM-ready markdown. Powered by MarkItDown & React.</p>
        
        {/* Lencana Privasi */}
        <div className="privacy-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          100% Private. Processed in-memory & instantly deleted.
        </div>
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
            {files.length === 0 && "Drag & drop your documents here, or use the button below (Max 10 files)"}
            
            {files.length > 0 && (
              <div className="file-chip-container">
                {files.map((f, index) => (
                  <div key={index} className="file-chip">
                    <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); // Mencegah klik men-trigger upload window
                        e.stopPropagation(); 
                        removeFile(index); 
                      }} 
                      title="Remove file"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input type="file" multiple accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.json" onChange={handleFileChange} />
          
          {/* Checkbox Konteks LLM (Hanya muncul jika ada file yang dipilih) */}
          {files.length > 0 && (
            <label className="llm-toggle">
              <input 
                type="checkbox" 
                checked={addLlmContext} 
                onChange={(e) => setAddLlmContext(e.target.checked)} 
              />
              Inject LLM Context (Filename & Date)
            </label>
          )}

          <div className="toolbar" style={{ justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
            <button className="primary" onClick={handleConvert} disabled={isLoading || files.length === 0}>
              {isLoading ? 'Extracting...' : (files.length > 1 ? 'Preview Batch Extraction' : 'Extract Markdown')}
            </button>
            {(files.length > 0 || markdown) && !isLoading && (
              <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Reset</button>
            )}
          </div>
        </div>
        
        {isLoading && (
          <div className="progress-wrapper">
            <div className="progress-text">
              <span>{progressText}</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </main>
      
      {/* --- LIVE PREVIEW (TUNGGAL) --- */}
      {markdown && !isLoading && files.length === 1 && (
        <section className="result-section" ref={resultRef}>
          <h2>Extraction Result</h2>
          <div className="preview-container">
            <div className="raw-markdown">
              <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span><strong style={{color: 'var(--text-main)'}}>{getStats(markdown).words}</strong> words</span>
                  <span><strong style={{color: 'var(--accent)'}}>~{getStats(markdown).tokens}</strong> tokens</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleCopy}>{isCopied ? 'Copied' : 'Copy Source'}</button>
                  <button onClick={handleDownload}>Save as .md</button>
                </div>
              </div>
              <pre>{markdown}</pre> {/* <--- Penambahan <pre> yang sempat hilang */}
            </div> {/* <--- Penambahan penutup </div> untuk raw-markdown */}

            <div className="rendered-markdown">
              <h3 className="preview-title">Live Preview</h3>
              <div className="markdown-body"><ReactMarkdown>{markdown}</ReactMarkdown></div>
            </div>
          </div>
        </section>
      )}

      {/* --- POP-UP MODAL (BATCH) --- */}
      {showBatchModal && (
        <div ref={resultRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-page)', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>Batch Results ({batchResults.length} files)</h2>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {batchResults.map((res, index) => (
                <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', backgroundColor: res.success ? 'transparent' : '#fdf2f2' }}>
                  
                  {/* --- BAGIAN ATAS: Header Kotak (Selalu Tampil) --- */}
                  <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      {/* Tombol Panah Dropdown (Hanya muncul jika sukses) */}
                      {res.success && (
                        <button onClick={() => toggleBatchItem(index)} style={{ background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg style={{ transform: expandedBatchItems[index] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      )}
                      
                      <div style={{ overflow: 'hidden' }}>
                        <h4 style={{ margin: '0 0 0.25rem 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{res.filename}</h4>
                        <span style={{ fontSize: '0.8rem', color: res.success ? 'var(--text-muted)' : '#9b2c2c', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {res.success ? (
                            <>
                              <span>{(res.content.length / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span style={{color: 'var(--accent)', fontWeight: 500}}>~{getStats(res.content).tokens} tokens</span>
                            </>
                          ) : `Error: ${res.error}`}
                        </span>
                      </div>
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

                  {/* --- BAGIAN BAWAH: Dropdown Preview (Disembunyikan) --- */}
                  {res.success && expandedBatchItems[index] && (
                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', backgroundColor: 'var(--surface-code)' }}>
                      {/* Menggunakan ReactMarkdown agar desainnya sama rapinya dengan Live Preview utama */}
                      <div className="markdown-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        <ReactMarkdown>{res.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                </div>
              ))}
            </div>
            
            {/* Input Custom Prompt LLM */}
            <div style={{ marginTop: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--surface-code)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                ⚡ Add AI Instructions (Optional)
              </label>
              <textarea 
                placeholder="e.g., 'Summarize the key financial metrics from these reports...'"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                style={{ width: '100%', minHeight: '60px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-page)', color: 'var(--text-main)', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                This instruction will be pinned to the top of your merged document when copied.
              </p>
            </div>

            {/* Pilihan Template Markdown */}
            <div style={{ marginBottom: '1.5rem', backgroundColor: 'var(--surface-code)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                🎨 Output Structure Template
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { id: 'standard', label: 'Standard Raw' },
                  { id: 'summary', label: 'Executive Summary' },
                  { id: 'qa', label: 'Q&A Format' }
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setMarkdownTemplate(tpl.id)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontSize: '0.8rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: markdownTemplate === tpl.id ? 'var(--accent)' : 'var(--bg-page)',
                      color: markdownTemplate === tpl.id ? '#fff' : 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: markdownTemplate === tpl.id ? 'bold' : 'normal'
                    }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              
              {/* Tombol Merge Baru di Sebelah Kiri */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={copyAllMerged} style={{ backgroundColor: 'var(--surface-code)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  {isCopiedAll ? '✅ All Copied!' : '📋 Copy All (Merged)'}
                </button>
                <button onClick={downloadAllMerged} style={{ backgroundColor: 'var(--surface-code)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  📄 Save as Single .md
                </button>
              </div>

              {/* Tombol Lama di Sebelah Kanan */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowBatchModal(false)} style={{ backgroundColor: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer' }}>Close</button>
                <button onClick={downloadAllAsZip} className="primary">Download .ZIP</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;