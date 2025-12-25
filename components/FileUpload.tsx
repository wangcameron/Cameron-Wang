import React, { useCallback } from 'react';
import { Upload, X, Plus } from 'lucide-react';
import { UploadedFile } from '../types';

interface FileUploadProps {
  label: string;
  subLabel?: string;
  value: UploadedFile | UploadedFile[] | null;
  onChange: (file: any) => void; // Using any to handle both single and array types based on usage
  accept?: string;
  multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  subLabel, 
  value, 
  onChange, 
  accept = "image/*", 
  multiple = false 
}) => {
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles: UploadedFile[] = [];
      let processedCount = 0;

      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newFiles.push({
            file,
            previewUrl: URL.createObjectURL(file),
            base64: reader.result as string,
          });
          processedCount++;
          
          if (processedCount === files.length) {
            if (multiple) {
              // Append to existing files if array, or create new array
              const currentFiles = Array.isArray(value) ? value : [];
              onChange([...currentFiles, ...newFiles]);
            } else {
              // Single file mode
              onChange(newFiles[0]);
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }, [onChange, multiple, value]);

  const handleClear = useCallback((e: React.MouseEvent, index?: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (multiple && Array.isArray(value)) {
      const newFiles = [...value];
      if (typeof index === 'number') {
        newFiles.splice(index, 1);
        onChange(newFiles);
      }
    } else {
      onChange(null);
    }
  }, [onChange, multiple, value]);

  const isValueEmpty = !value || (Array.isArray(value) && value.length === 0);

  return (
    <div className="flex flex-col space-y-2">
      <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
        {label}
        {subLabel && <span className="text-xs text-gray-500 font-normal">({subLabel})</span>}
      </span>
      
      <div className={`
        relative group cursor-pointer
        border-2 border-dashed rounded-xl transition-all duration-200
        ${!isValueEmpty ? 'border-gold-500/50 bg-luxury-charcoal' : 'border-gray-700 hover:border-gray-500 hover:bg-white/5'}
        min-h-[12rem] flex flex-col items-center justify-center overflow-hidden p-2
      `}>
        <input 
          type="file" 
          accept={accept} 
          multiple={multiple}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        {!isValueEmpty ? (
          multiple && Array.isArray(value) ? (
            <div className="grid grid-cols-2 gap-2 w-full h-full relative z-20 pointer-events-none">
               {/* Display Grid for Multiple Files */}
               {value.map((file, idx) => (
                 <div key={idx} className="relative aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-700">
                    <img src={file.previewUrl} alt={`preview ${idx}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={(e) => {
                        // We need to re-enable pointer events for this button since container has pointer-events-none
                        // But actually input covers it. We need a way to click delete.
                        // The input covers everything. To support delete, we need the input to NOT cover the delete buttons.
                        // Simplified approach: Render delete buttons with higher z-index and pointer-events-auto
                        handleClear(e, idx);
                      }}
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-full pointer-events-auto z-30"
                    >
                      <X size={12} />
                    </button>
                 </div>
               ))}
               {/* Add More Placeholder (visual only, clicking anywhere triggers input) */}
               <div className="flex items-center justify-center aspect-square bg-white/5 rounded-lg border border-gray-700">
                 <Plus className="text-gray-500" />
               </div>
            </div>
          ) : (
            // Single File Display
            <>
              <img 
                src={(value as UploadedFile).previewUrl} 
                alt="Preview" 
                className="absolute inset-0 w-full h-full object-contain p-2 z-0"
              />
              <div className="absolute top-2 right-2 z-20">
                <button 
                  onClick={(e) => handleClear(e)}
                  className="bg-black/50 hover:bg-red-500/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </>
          )
        ) : (
          <div className="flex flex-col items-center text-gray-500 space-y-3 p-4 text-center">
            <div className="p-3 rounded-full bg-white/5">
              <Upload size={24} className="text-gray-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-300">
                {multiple ? "点击上传多张图片" : "点击或拖拽上传图片"}
              </p>
              <p className="text-xs text-gray-500">支持 JPG, PNG 格式</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};