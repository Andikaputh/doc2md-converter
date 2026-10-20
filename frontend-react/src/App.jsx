import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for single document mode
  const [markdown, setMarkdown] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // State for batch document mode (Modal)
  const [batchResults, setBatchResults] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState(null);
  const [expandedBatchItems, setExpandedBatchItems] = useState({});
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [markdownTemplate, setMarkdownTemplate] = useState('standard');
  
  // Drag-and-drop & UI feedback
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [addLlmContext, setAddLlmContext] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const resultRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeBlobUrlsRef = useRef([]);

  // Cleanup on unmount: abort active fetch requests and revoke blob URLs
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      activeBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      activeBlobUrlsRef.current = [];
    };
  }, []);

  // Word and token count estimation function
  const getStats = (text) => {
    if (!text) return { words: 0, tokens: 0 };
    const words = text.trim().split(/\s+/).length;
    return {
      words: words,
      tokens: Math.ceil(words * 1.3) // LLM token rule of thumb
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

    // Validate maximum file size (10MB limit per file)
    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setErrorMessage(`File too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size per file is 10MB.`);
      return;
    }

    // Cancel any previous in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setMarkdown('');
    setBatchResults([]);
    setExpandedBatchItems({});
    setProgress(0);

    const totalFiles = files.length;

    try {
      if (totalFiles === 1) {
        // ==========================================
        // SINGLE FILE MODE (Direct Live Preview)
        // ==========================================
        const file = files[0];
        setProgress(30);
        setProgressText(`Uploading & extracting ${file.name}...`);

        const singleFormData = new FormData();
        singleFormData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/convert`, {
          method: 'POST',
          body: singleFormData,
          signal: abortControllerRef.current.signal
        });

        const data = await response.json().catch(() => ({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }));

        if (response.ok && data.success) {
          setProgress(100);
          setProgressText('Extraction completed!');
          setOriginalFilename(data.filename || file.name);

          let finalContent = data.markdown_content || data.content || '';
          if (addLlmContext) {
            const date = new Date().toISOString().split('T')[0];
            finalContent = `> **Document Context for LLM**\n> Filename: \`${data.filename || file.name}\`\n> Extracted on: \`${date}\`\n\n---\n\n${finalContent}`;
          }

          setMarkdown(finalContent);
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          setErrorMessage(`Extraction failed: ${data.error || data.detail || 'Unknown server error'}`);
          setProgress(0);
          setProgressText('');
        }
      } else {
        // ==========================================
        // BATCH MODE: Sequential Per-File Processing
        // ==========================================
        // Runs sequentially one file at a time to prevent RAM spikes on Render Free Tier (<400MB)
        // and eliminate HTTP connection timeouts.
        setProgressText(`Starting batch extraction (0 of ${totalFiles})...`);
        const accumulatedResults = [];

        for (let i = 0; i < totalFiles; i++) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          const file = files[i];
          const fileNum = i + 1;
          setProgressText(`Extracting file ${fileNum} of ${totalFiles}: ${file.name}...`);

          let itemResult;
          try {
            const singleFormData = new FormData();
            singleFormData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/convert`, {
              method: 'POST',
              body: singleFormData,
              signal: abortControllerRef.current.signal
            });

            const data = await response.json().catch(() => ({
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`
            }));

            if (response.ok && data.success) {
              let finalContent = data.content || data.markdown_content || '';
              if (addLlmContext) {
                const date = new Date().toISOString().split('T')[0];
                finalContent = `> **Document Context for LLM**\n> Filename: \`${data.filename || file.name}\`\n> Extracted on: \`${date}\`\n\n---\n\n${finalContent}`;
              }

              itemResult = {
                success: true,
                filename: data.filename || file.name,
                content: finalContent
              };
            } else {
              itemResult = {
                success: false,
                filename: file.name,
                error: data.error || data.detail || 'Extraction failed'
              };
            }
          } catch (err) {
            if (err.name === 'AbortError') {
              break;
            }
            itemResult = {
              success: false,
              filename: file.name,
              error: err.message || 'Connection lost / Network error'
            };
          }

          // Store results incrementally in state so failed files don't lose previous results
          accumulatedResults.push(itemResult);
          setBatchResults([...accumulatedResults]);

          // Dynamic percentage update (e.g. 1 of 5 = 20%, 2 of 5 = 40%)
          const currentPercent = Math.round((fileNum / totalFiles) * 100);
          setProgress(currentPercent);
          setProgressText(`Completed ${fileNum} of ${totalFiles} (${itemResult.success ? 'Success' : 'Error'}: ${file.name})`);
        }

        // Finalize batch execution
        if (!abortControllerRef.current?.signal.aborted && accumulatedResults.length > 0) {
          setProgress(100);
          setProgressText(`Batch extraction completed (${accumulatedResults.filter(r => r.success).length}/${totalFiles} successful).`);
          setShowBatchModal(true);
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setProgress(0);
        setProgressText('');
        setErrorMessage(`Connection lost: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Single Mode Helpers ---
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    saveAs(blob, `${baseName}.md`);
  };

  // --- Batch Mode Helpers ---
  const copyBatchItem = (content, index) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedBatchIndex(index);
      setTimeout(() => setCopiedBatchIndex(null), 2000);
    });
  };

  const downloadBatchItem = (content, filename) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
    saveAs(blob, `${baseName}.md`);
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
      const baseName = res.filename.substring(0, res.filename.lastIndexOf('.')) || res.filename;
      if (res.success) {
        zip.file(`${baseName}.md`, res.content);
      } else {
        zip.file(`ERROR_${res.filename}.txt`, `Failed: ${res.error}`);
      }
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'extracted_markdowns.zip');
  };

  const getMergedContent = () => {
    let mergedDocs = batchResults
      .filter(res => res.success)
      .map(res => {
        let content = res.content;
        
        // Template formatting
        if (markdownTemplate === 'qa') {
          content = `### Source: ${res.filename}\n\n**Q: What is the summary / core point of this document?**\nA:\n${content}\n\n**Q: Follow-up questions & action items?**\nA:\n- `;
        } else if (markdownTemplate === 'summary') {
          content = `## Executive Summary: ${res.filename}\n> *Automatic summary based on source document.*\n\n${content}`;
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
    const blob = new Blob([merged], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, 'merged_documents.md');
  };

  // Safe reset: cancel active network operations, revoke blob URLs, and clear memory
  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    activeBlobUrlsRef.current = [];

    setFiles([]);
    setMarkdown('');
    setErrorMessage(null);
    setOriginalFilename('');
    setBatchResults([]);
    setShowBatchModal(false);
    setExpandedBatchItems({});
    setProgress(0);
    setProgressText('');
    setIsLoading(false);
    setIsCopied(false);
    setIsCopiedAll(false);
    setCopiedBatchIndex(null);

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="layout-grid">
      <header>
        <h1>Document Extraction</h1>
        <p>Transform complex files into clean, LLM-ready markdown. Powered by MarkItDown & React.</p>
        
        {/* Privacy Badge */}
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
                        e.preventDefault();
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
          
          {/* LLM Context Toggle */}
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

          <div className="toolbar" style={{ justifyContent: 'center', marginTop: '1rem', width: '100%', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="primary" onClick={handleConvert} disabled={isLoading || files.length === 0}>
              {isLoading ? 'Extracting...' : (files.length > 1 ? `Extract Batch (${files.length} files)` : 'Extract Markdown')}
            </button>
            
            {/* Safe Reset / Cancel Buttons */}
            {isLoading && (
              <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: '#e53e3e', border: '1px solid #feb2b2' }}>
                Cancel
              </button>
            )}

            {(files.length > 0 || markdown || batchResults.length > 0) && !isLoading && (
              <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                Reset
              </button>
            )}

            {batchResults.length > 0 && !showBatchModal && !isLoading && (
              <button onClick={() => setShowBatchModal(true)} style={{ backgroundColor: 'var(--surface-code)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                View Batch Results ({batchResults.length})
              </button>
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
      
      {/* --- LIVE PREVIEW (SINGLE FILE) --- */}
      {markdown && !isLoading && files.length <= 1 && (
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
              <pre>{markdown}</pre>
            </div>

            <div className="rendered-markdown">
              <h3 className="preview-title">Live Preview</h3>
              <div className="markdown-body"><ReactMarkdown>{markdown}</ReactMarkdown></div>
            </div>
          </div>
        </section>
      )}

      {/* --- POP-UP MODAL (BATCH PREVIEW) --- */}
      {showBatchModal && (
        <div ref={resultRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-page)', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>
                  Batch Results ({batchResults.length} files)
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {batchResults.filter(r => r.success).length} succeeded, {batchResults.filter(r => !r.success).length} failed
                </span>
              </div>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {batchResults.map((res, index) => (
                <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', backgroundColor: res.success ? 'transparent' : '#fdf2f2' }}>
                  
                  {/* --- Card Header --- */}
                  <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      {res.success && (
                        <button onClick={() => toggleBatchItem(index)} style={{ background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg style={{ transform: expandedBatchItems[index] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      )}
                      
                      <div style={{ overflow: 'hidden' }}>
                        <h4 style={{ margin: '0 0 0.25rem 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {res.filename}
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: res.success ? 'var(--text-muted)' : '#9b2c2c', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {res.success ? (
                            <>
                              <span>{(res.content.length / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span style={{color: 'var(--accent)', fontWeight: 500}}>~{getStats(res.content).tokens} tokens</span>
                            </>
                          ) : (
                            <span>Error: {res.error}</span>
                          )}
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

                  {/* --- Dropdown Preview --- */}
                  {res.success && expandedBatchItems[index] && (
                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', backgroundColor: 'var(--surface-code)' }}>
                      <div className="markdown-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        <ReactMarkdown>{res.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                </div>
              ))}
            </div>
            
            {/* Custom AI Prompt Input */}
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

            {/* Markdown Template Selector */}
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

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              
              {/* Merge & Copy Controls */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={copyAllMerged} style={{ backgroundColor: 'var(--surface-code)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  {isCopiedAll ? '✅ All Copied!' : '📋 Copy All (Merged)'}
                </button>
                <button onClick={downloadAllMerged} style={{ backgroundColor: 'var(--surface-code)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  📄 Save as Single .md
                </button>
              </div>

              {/* Close & ZIP Controls */}
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
