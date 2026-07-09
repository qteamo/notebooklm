import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';

export default function UploadZone({
  onUpload,
  disabled,
  dropText,
  formatsText,
}: {
  onUpload: (files: FileList) => void;
  disabled?: boolean;
  dropText: string;
  formatsText: string;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      onUpload(e.dataTransfer.files);
    },
    [onUpload, disabled],
  );

  const handleClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        if (e.target.files && e.target.files.length > 0) {
          onUpload(e.target.files);
        }
      } catch (err) {
        console.error('File upload error:', err);
      }
      e.target.value = '';
    },
    [onUpload],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
        dragging
          ? 'border-brand-400 bg-brand-500/5 drop-active'
          : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
      } ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.docx,.md,.txt"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
      <p className="text-sm text-slate-400 mb-1">{dropText}</p>
      <p className="text-xs text-slate-600">{formatsText}</p>
    </div>
  );
}
