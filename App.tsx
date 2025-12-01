import React, { useState, useEffect } from 'react';
import { extractInvoiceData } from './services/geminiService';
import { AppState, ExtractionResult } from './types';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { ScanSearch, KeyRound, RefreshCcw, AlertTriangle, FileText, FileSpreadsheet } from 'lucide-react';

const App: React.FC = () => {
  // Try to get key from local storage first to be helpful
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(!localStorage.getItem('gemini_api_key'));
  
  const [state, setState] = useState<AppState>({
    apiKey: '',
    file: null,
    previewUrl: null,
    isProcessing: false,
    result: null,
    error: null,
  });

  const handleKeySave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey);
      setShowKeyInput(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setState(prev => ({ ...prev, file, previewUrl, isProcessing: true, error: null, result: null }));

    try {
      const result = await extractInvoiceData(file, apiKey);
      setState(prev => ({ ...prev, isProcessing: false, result }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: err.message || "Failed to process invoice. Please try again." 
      }));
    }
  };

  const handleReset = () => {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    setState(prev => ({
      ...prev,
      file: null,
      previewUrl: null,
      result: null,
      error: null,
      isProcessing: false
    }));
  };

  const renderFilePreview = (file: File | null, url: string | null, isSidebar = false) => {
    if (!file || !url) return null;

    if (file.type.startsWith('image/')) {
      return (
        <img 
          src={url} 
          alt="Invoice Preview" 
          className={`max-w-full object-contain shadow-md ${isSidebar ? 'h-auto opacity-90 hover:opacity-100' : 'max-h-full'}`} 
        />
      );
    }
    
    if (file.type === 'application/pdf') {
      return (
        <iframe 
          src={url} 
          className={`w-full bg-slate-100 shadow-md ${isSidebar ? 'min-h-[600px] border-none' : 'h-full border-none'}`}
          title="PDF Preview"
        />
      );
    }

    // Excel or others
    return (
      <div className={`flex flex-col items-center justify-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800 ${isSidebar ? 'p-12' : 'p-8'}`}>
        <FileSpreadsheet size={isSidebar ? 48 : 64} className="mb-4 text-emerald-500" />
        <p className="text-lg font-medium text-slate-300 break-all text-center">{file.name}</p>
        <p className="text-sm">Preview not available for this format</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-md shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <ScanSearch size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 leading-tight">InvoiceAI</h1>
              <p className="text-xs text-slate-400 font-medium">Commercial Invoice Extraction System</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700"
          >
            <KeyRound size={16} />
            <span className="hidden sm:inline">{apiKey ? 'Update API Key' : 'Set API Key'}</span>
          </button>
        </div>
      </header>

      {/* API Key Modal/Input Area */}
      {showKeyInput && (
        <div className="bg-slate-800 border-b border-slate-700 text-white p-6 shadow-lg relative z-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-semibold mb-2">Configure Gemini API</h2>
            <p className="text-slate-300 text-sm mb-4">
              Enter your Google Gemini API key to enable document processing. 
              The key is stored locally in your browser.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API Key here..."
                className="flex-1 px-4 py-2 rounded-lg bg-slate-950 text-slate-100 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={handleKeySave}
                disabled={!apiKey}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Key
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Need a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-blue-400">Get one from Google AI Studio</a>
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Error State */}
        {state.error && (
          <div className="mb-6 bg-red-900/30 border border-red-800 text-red-200 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5 text-red-400" size={20} />
            <div>
              <h3 className="font-bold text-red-300">Processing Error</h3>
              <p>{state.error}</p>
              <button onClick={() => setState(s => ({...s, error: null}))} className="text-sm underline mt-2 hover:text-white">Dismiss</button>
            </div>
          </div>
        )}

        {/* Empty State / Upload */}
        {!state.result && (
          <div className="max-w-3xl mx-auto">
            {!state.isProcessing && !state.previewUrl && (
              <div className="mb-8 text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-100">Upload Invoice</h2>
                <p className="text-slate-400">
                  Upload a commercial invoice (PDF, Excel, JPG, PNG). <br/>
                  The system will automatically identify POs, quantities, and values.
                </p>
              </div>
            )}
            
            {!state.previewUrl ? (
              <FileUpload onFileSelect={handleFileSelect} isLoading={state.isProcessing} />
            ) : (
              <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                 <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <FileText size={18} />
                      {state.file?.name}
                    </h3>
                    {!state.isProcessing && (
                      <button onClick={handleReset} className="text-sm text-slate-400 hover:text-red-400 font-medium">
                        Change File
                      </button>
                    )}
                 </div>
                 
                 <div className="flex flex-col md:flex-row h-[600px]">
                    {/* Preview Area */}
                    <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
                       {renderFilePreview(state.file, state.previewUrl, false)}
                       
                       {state.isProcessing && (
                         <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-blue-400 font-semibold animate-pulse">Extracting Data...</p>
                            <p className="text-xs text-slate-400 mt-2">Running layout analysis & PO identification</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Results Dashboard */}
        {state.result && (
          <div className="space-y-6">
             <div className="flex justify-between items-end">
                <div>
                   <h2 className="text-2xl font-bold text-slate-100">Extraction Results</h2>
                   <p className="text-slate-400">Review the extracted data below.</p>
                </div>
                <button 
                  onClick={handleReset}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                >
                  <RefreshCcw size={16} />
                  Process Another
                </button>
             </div>
             
             <div className="flex flex-col xl:flex-row gap-6">
                {/* Left: Dashboard */}
                <div className="flex-1 min-w-0">
                  <Dashboard result={state.result} />
                </div>
                
                {/* Right: Original Document Reference (Sticky) */}
                <div className="xl:w-[450px] shrink-0">
                  <div className="sticky top-24 bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
                    <div className="p-3 bg-slate-900 border-b border-slate-800 font-semibold text-sm text-slate-300">
                      Original Document
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-950 p-2 text-center min-h-[400px] flex items-center justify-center">
                       {renderFilePreview(state.file, state.previewUrl, true)}
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;