import React, { useState, useRef, useEffect } from 'react';
import { GeneratedAsset, GenerationBatch, AppMode, ImageResolution, Region } from '../types';
import { Download, Loader2, AlertCircle, Maximize2, X, RefreshCw, Send, Clock, CheckCircle, SlidersHorizontal, ArrowRight, ImagePlus, Trash2, Scan, MousePointer2 } from 'lucide-react';

interface ResultGalleryProps {
  history: GenerationBatch[];
  onRegenerate: (assetId: string, feedback: string) => void;
  onVerifyIntent: (assetId: string, feedback: string, files: string[], region?: Region) => void;
  onDownloadHighRes: (assetId: string, resolution: ImageResolution) => void; 
}

// Individual card component
const ResultCard: React.FC<{ 
  asset: GeneratedAsset, 
  onRegenerate: (assetId: string, feedback: string) => void,
  onVerifyIntent: (assetId: string, feedback: string, files: string[], region?: Region) => void,
  onDownloadHighRes: (assetId: string, resolution: ImageResolution) => void,
  onImageClick: (url: string) => void
}> = ({ asset, onRegenerate, onVerifyIntent, onDownloadHighRes, onImageClick }) => {
  
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  
  // Local state for feedback images
  const [feedbackImages, setFeedbackImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Region Selection State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<Region | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFeedbackImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFeedbackImage = (index: number) => {
    setFeedbackImages(prev => prev.filter((_, i) => i !== index));
  };

  // Step 1: User types feedback and clicks "Verify"
  const handleVerifyClick = () => {
    if (!feedbackText.trim() && feedbackImages.length === 0 && !selection) return;
    onVerifyIntent(asset.id, feedbackText, feedbackImages, selection || undefined);
  };

  // Step 2: User confirms the AI interpretation
  const handleConfirmRegenerate = () => {
    onRegenerate(asset.id, feedbackText);
    setShowFeedbackInput(false);
    setFeedbackText('');
    setFeedbackImages([]);
    setSelection(null);
    setIsSelecting(false);
  };

  const handleDownload = (res: ImageResolution) => {
    if (res === '4K' && asset.resolution !== '4K') {
      onDownloadHighRes(asset.id, '4K');
      setShowDownloadOptions(false);
      return;
    }
    const link = document.createElement('a');
    link.href = asset.imageUrl!;
    link.download = `luxefit-${asset.id}-${res}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadOptions(false);
  };

  // Selection Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelecting || !imageContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStartPos({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = imageContainerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);
    const x = Math.min(currentX, startPos.x);
    const y = Math.min(currentY, startPos.y);

    setSelection({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleSelectionMode = () => {
    setIsSelecting(!isSelecting);
    if (isSelecting) {
      setSelection(null); // Clear on exit? or keep? let's clear for now to restart
    }
  };

  return (
    <div className="group relative bg-luxury-charcoal rounded-xl overflow-hidden border border-gray-800 hover:border-gold-500/30 transition-all duration-300 flex flex-col h-full">
      
      {/* Visual Section */}
      <div 
        ref={imageContainerRef}
        className={`relative w-full ${getAspectRatioClass(asset.aspectRatio)} bg-black overflow-hidden select-none`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {asset.isImageLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-20 bg-luxury-charcoal">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
            <span className="text-xs text-gold-100/70 tracking-widest uppercase">
              {asset.imageUrl ? 'AI 正在调整...' : '渲染中 (2K)'}
            </span>
          </div>
        ) : asset.imageUrl ? (
          <div 
            className={`w-full h-full relative ${isSelecting ? 'cursor-crosshair' : 'cursor-pointer'}`}
            onClick={!isSelecting ? () => onImageClick(asset.imageUrl!) : undefined}
          >
            <img 
              src={asset.imageUrl} 
              alt="Generated Result" 
              className={`w-full h-full object-cover transition-transform duration-700 ${!isSelecting && 'group-hover:scale-105'}`} 
            />
            
            {/* Selection Overlay */}
            {selection && (
              <div 
                className="absolute border-2 border-gold-400 bg-gold-400/20 z-10"
                style={{
                  left: `${selection.x}%`,
                  top: `${selection.y}%`,
                  width: `${selection.width}%`,
                  height: `${selection.height}%`
                }}
              >
                <div className="absolute -top-6 left-0 bg-gold-400 text-black text-[10px] px-1 font-bold rounded-t">
                  修改区域
                </div>
              </div>
            )}

            {/* Hover Actions (Hide during selection to prevent interference) */}
            {!isSelecting && (
              <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={(e) => e.stopPropagation()}>
                 <button 
                  onClick={() => onImageClick(asset.imageUrl!)}
                  className="p-2 bg-black/60 hover:bg-gold-500 text-white rounded-full backdrop-blur-sm transition-colors"
                  title="查看大图"
                >
                  <Maximize2 size={16} />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                    className="p-2 bg-black/60 hover:bg-gold-500 text-white rounded-full backdrop-blur-sm transition-colors"
                    title="下载图片"
                  >
                    <Download size={16} />
                  </button>
                  {showDownloadOptions && (
                    <div className="absolute right-0 top-10 w-32 bg-luxury-charcoal border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden">
                      <button onClick={() => handleDownload('2K')} className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-gold-600 hover:text-black">
                        下载 2K (原图)
                      </button>
                      <button onClick={() => handleDownload('4K')} className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-gold-600 hover:text-black">
                        下载 4K (超清)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {asset.resolution === '4K' && (
               <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-gold-600 text-black text-[10px] font-bold rounded">4K</div>
            )}
            
            {/* Selecting Hint Overlay */}
            {isSelecting && !selection && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <p className="text-white bg-black/50 px-2 py-1 rounded text-xs">请框选需要修改的区域</p>
               </div>
            )}
          </div>
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
              <span className="text-xs text-red-300">生成失败</span>
              {asset.error && <p className="text-[10px] text-gray-500 mt-1 max-w-[80%]">{asset.error}</p>}
              <button 
                 onClick={() => setShowFeedbackInput(true)}
                 className="mt-2 text-xs text-gold-400 underline hover:text-gold-300"
              >
                尝试重绘
              </button>
            </div>
        )}
      </div>

      {/* Control Section */}
      <div className="p-4 bg-luxury-charcoal border-t border-gray-800 space-y-3 flex-1 flex flex-col justify-end">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide truncate pr-2" title={asset.imagePrompt}>
            {asset.imagePrompt.split(':')[0]}
          </span>
          
          {!asset.isImageLoading && (
            <button 
              onClick={() => {
                setShowFeedbackInput(!showFeedbackInput);
                setIsSelecting(false); // Reset selection mode if toggling panel
              }}
              className={`p-1.5 rounded-md transition-colors ${showFeedbackInput ? 'bg-gold-500/20 text-gold-400' : 'text-gray-500 hover:text-gold-400 hover:bg-white/5'}`}
              title="调整"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* Feedback Input Mode */}
        {showFeedbackInput && (
          <div className="animate-fade-in space-y-2 bg-black/20 p-2 rounded-lg border border-gray-800 relative">
            {asset.isVerifyingFeedback ? (
               <div className="flex items-center justify-center py-4 text-gold-400 gap-2 text-xs">
                 <Loader2 size={14} className="animate-spin"/>
                 AI 正在比对并确认...
               </div>
            ) : asset.feedbackInterpretation ? (
              // Verification UI
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-gold-500/10 p-2 rounded border border-gold-500/20">
                   <CheckCircle size={14} className="text-gold-500 mt-0.5 shrink-0" />
                   <p className="text-xs text-gray-200 leading-relaxed">{asset.feedbackInterpretation}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={() => onVerifyIntent(asset.id, "", [], undefined)} // Clear verification state
                    className="flex-1 py-1 text-[10px] text-gray-400 hover:bg-white/10 rounded"
                  >
                    修改
                  </button>
                  <button 
                    onClick={handleConfirmRegenerate}
                    className="flex-1 py-1.5 bg-gold-600 text-black text-xs font-bold rounded hover:bg-gold-500"
                  >
                    确认并生成
                  </button>
                </div>
              </div>
            ) : (
              // Input UI
              <>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="请输入修改意见..."
                  className="w-full text-xs bg-black/40 border border-gray-700 rounded-lg p-2 text-gray-200 placeholder-gray-600 focus:border-gold-500 focus:outline-none resize-none h-16"
                />
                
                {/* Tools Bar */}
                <div className="flex items-center gap-2 border-t border-gray-700/50 pt-2">
                   {/* Selection Tool */}
                   <button
                     onClick={toggleSelectionMode}
                     className={`p-1.5 rounded transition-colors flex items-center gap-1 text-[10px] ${isSelecting ? 'bg-gold-600 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                     title="框选修改区域"
                   >
                     <Scan size={14} />
                     {isSelecting ? '正在框选' : '框选区域'}
                   </button>
                   {selection && (
                     <span className="text-[10px] text-gold-400">
                       已选: {Math.round(selection.width)}% x {Math.round(selection.height)}%
                     </span>
                   )}
                </div>
                
                {/* Image Upload Area for Feedback */}
                <div className="flex gap-2 overflow-x-auto py-1">
                   {feedbackImages.map((img, idx) => (
                     <div key={idx} className="relative w-10 h-10 shrink-0 border border-gray-700 rounded overflow-hidden group/img">
                        <img src={img} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeFeedbackImage(idx)}
                          className="absolute inset-0 bg-black/60 items-center justify-center hidden group-hover/img:flex"
                        >
                          <Trash2 size={10} className="text-red-400" />
                        </button>
                     </div>
                   ))}
                   <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 shrink-0 border border-dashed border-gray-600 rounded flex items-center justify-center hover:border-gold-500 hover:text-gold-400 text-gray-500 transition-colors"
                      title="上传参考图供对比"
                   >
                     <ImagePlus size={14} />
                   </button>
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      multiple 
                      onChange={handleFileSelect}
                   />
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                        setShowFeedbackInput(false);
                        setIsSelecting(false);
                    }}
                    className="flex-1 py-1.5 text-xs text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleVerifyClick}
                    disabled={!feedbackText.trim() && feedbackImages.length === 0 && !selection}
                    className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowRight size={12} />
                    确认意图
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ResultGallery: React.FC<ResultGalleryProps> = ({ history, onRegenerate, onVerifyIntent, onDownloadHighRes }) => {
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    url: string;
  }>({ isOpen: false, url: '' });

  if (!history || history.length === 0) return null;

  return (
    <>
      <div className="space-y-12 animate-fade-in">
        {history.map((batch, index) => (
          <div key={batch.id} className="space-y-4">
             {/* Batch Header */}
             <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-gold-500" />
                  <h3 className="text-lg font-serif text-white">
                    {index === 0 ? "最新生成" : "历史记录"} 
                    <span className="text-sm font-sans text-gray-500 ml-3">
                      {new Date(batch.timestamp).toLocaleString()}
                    </span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700">
                       {batch.mode === 'try-on' ? '模特试戴' : '场景展示'}
                    </span>
                  </h3>
                </div>
             </div>

             {/* Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {batch.assets.map((asset) => (
                <ResultCard 
                  key={asset.id} 
                  asset={asset} 
                  onRegenerate={onRegenerate}
                  onVerifyIntent={onVerifyIntent}
                  onDownloadHighRes={onDownloadHighRes}
                  onImageClick={(url) => setLightbox({ isOpen: true, url })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightbox.isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightbox({ isOpen: false, url: '' })}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-[110]"
            onClick={() => setLightbox({ isOpen: false, url: '' })}
          >
            <X size={32} />
          </button>

          <img 
            src={lightbox.url} 
            alt="Full Preview" 
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl rounded-sm"
          />
        </div>
      )}
    </>
  );
};

const getAspectRatioClass = (ratio: string) => {
  switch (ratio) {
    case '3:4': return 'aspect-[3/4]';
    case '9:16': return 'aspect-[9/16]';
    case '1:1': return 'aspect-square';
    default: return 'aspect-[3/4]';
  }
};
