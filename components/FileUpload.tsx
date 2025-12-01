import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndPass(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndPass(e.target.files[0]);
    }
  };

  const validateAndPass = (file: File) => {
    if (isLoading) return;
    
    const validTypes = [
        'image/jpeg', 
        'image/png', 
        'image/webp', 
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        'application/vnd.ms-excel',
        'text/csv'
    ];

    if (!file.type.startsWith('image/') && !validTypes.includes(file.type)) {
        alert("Please upload a supported file (PDF, Excel, JPG, PNG).");
        return;
    }
    onFileSelect(file);
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div 
      className={`relative w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center p-6 text-center
        ${dragActive ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={!isLoading ? onButtonClick : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.csv"
        disabled={isLoading}
      />
      
      <div className="w-16 h-16 bg-slate-800 text-blue-400 rounded-full flex items-center justify-center mb-4">
        {isLoading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        ) : (
          <Upload size={32} />
        )}
      </div>

      <h3 className="text-lg font-semibold text-slate-100 mb-1">
        {isLoading ? "Analyzing Document..." : "Upload Commercial Invoice"}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        Drag and drop your invoice here, or click to browse. 
        <br/><span className="text-xs text-slate-500 mt-2 block">Supports PDF, Excel, JPG, PNG</span>
      </p>
    </div>
  );
};

export default FileUpload;