import React, { useState } from 'react';
import { GeneratedAsset, GenerationBatch } from '../types';
import { Download, Film, Loader2, Play, AlertCircle, Maximize2, X, RefreshCw, Send, Clock, Image as ImageIcon } from 'lucide-react';

interface ResultGalleryProps {
  history: GenerationBatch[];
  onOpenVideoModal: (batchId: string, assetId: string) => void;
  onRegenerate: (assetId: string, feedback: string) => void;
}

// Individual card component
const ResultCard: React.FC<{ 
  asset: GeneratedAsset, 
  batchId: string,
  onOpenVideoModal: (batchId: string, assetId: string) => void,
  onRegenerate: (assetId: string, feedback: string) => void,
  onImageClick: (url: string, type: 'image' | 'video', videoUrl?: string) => void
}> = ({ asset, batchId, onOpenVideoModal, onRegenerate, onImageClick }) => {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);

  const handleRegenerateSubmit = () => {
    if (!feedbackText.trim()) return;
    onRegenerate(asset.id, feedbackText);
    setShowFeedbackInput(false);
    setFeedbackText('');
  };

  const handleVideoDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!asset.videoUrl) return;
    
    try {
      setIsDownloadingVideo(true);
      const response = await fetch(asset.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `luxefit-video-${asset.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed", err);
      alert("下载失败，请重试");
    } finally {
      setIsDownloadingVideo(false);
    }
  };

  return (
    <div className="group relative bg-luxury-charcoal rounded-xl overflow-hidden border border-gray-800 hover:border-gold-500/30 transition-all duration-300 flex flex-col h-full">
      
      {/* Visual Section */}
      <div 
        className={`relative w-full ${getAspectRatioClass(asset.aspectRatio)} bg-black overflow-hidden`}
      >
        {asset.isImageLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-20 bg-luxury-charcoal">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
            <span className="text-xs text-gold-100/70 tracking-widest uppercase">
              {asset.imageUrl ? '重新生成中...' : '4K 渲染中...'}
            </span>
          </div>
        ) : asset.imageUrl ? (
          <div 
            className="w-full h-full relative cursor-pointer"
            // ALWAYS open image on click, never video. Video is accessed via button.
            onClick={() => onImageClick(asset.imageUrl!, 'image')}
          >
            <img 
              src={asset.imageUrl} 
              alt="Generated Try-On" 
              className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${asset.isVideoLoading ? 'opacity-50' : ''}`} 
            />
            
            {/* Video Loading Overlay */}
            {asset.isVideoLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                 <Loader2 className="w-8 h-8 text-gold-400 animate-spin mb-2" />
                 <span className="text-xs text-white">视频生成中...</span>
               </div>
            )}

            {/* Visual indicator that video exists (small badge), but doesn't block click-to-zoom */}
            {asset.videoUrl && !asset.isVideoLoading && (
              <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                 <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-gold-400 font-medium flex items-center gap-1">
                    <Film size={10} />
                    Video Ready
                 </div>
              </div>
            )}
            
            {/* Hover Actions */}
            <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={(e) => e.stopPropagation()}>
               <button 
                onClick={() => onImageClick(asset.imageUrl!, 'image')}
                className="p-2 bg-black/60 hover:bg-gold-500 text-white rounded-full backdrop-blur-sm transition-colors"
                title="查看高清大图"
              >
                <Maximize2 size={16} />
              </button>
              <a 
                href={asset.imageUrl} 
                download={`luxefit-image-${asset.id}.png`}
                className="p-2 bg-black/60 hover:bg-gold-500 text-white rounded-full backdrop-blur-sm transition-colors"
                title="下载 4K 图片"
              >
                <Download size={16} />
              </a>
            </div>
          </div>
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
              <span className="text-xs text-red-300">生成失败</span>
              {asset.error && <p className="text-[10px] text-gray-500 mt-1">{asset.error}</p>}
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
              onClick={() => setShowFeedbackInput(!showFeedbackInput)}
              className={`p-1.5 rounded-md transition-colors ${showFeedbackInput ? 'bg-gold-500/20 text-gold-400' : 'text-gray-500 hover:text-gold-400 hover:bg-white/5'}`}
              title="重绘此图"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* Feedback Input Mode */}
        {showFeedbackInput ? (
          <div className="animate-fade-in space-y-2">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="描述需要修改的地方..."
              className="w-full text-xs bg-black/40 border border-gray-700 rounded-lg p-2 text-gray-200 placeholder-gray-600 focus:border-gold-500 focus:outline-none resize-none h-16"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setShowFeedbackInput(false)}
                className="flex-1 py-1.5 text-xs text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleRegenerateSubmit}
                disabled={!feedbackText.trim()}
                className="flex-1 py-1.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Send size={12} />
                确认
              </button>
            </div>
          </div>
        ) : (
          /* Normal Action Buttons */
          !asset.isImageLoading && asset.imageUrl && (
            <div className="mt-2">
               {asset.videoUrl ? (
                 <div className="flex gap-2">
                   <button 
                     onClick={() => onImageClick(asset.imageUrl!, 'video', asset.videoUrl)}
                     className="flex-1 flex items-center justify-center gap-2 h-9 bg-gold-600 hover:bg-gold-500 text-black text-xs font-bold rounded-lg transition-colors"
                   >
                     <Play size={12} fill="currentColor" />
                     播放视频
                   </button>
                   <button 
                     onClick={handleVideoDownload}
                     disabled={isDownloadingVideo}
                     className="w-9 h-9 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                     title="下载视频"
                   >
                     {isDownloadingVideo ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                   </button>
                 </div>
               ) : (
                 <button
                   onClick={() => onOpenVideoModal(batchId, asset.id)}
                   disabled={asset.isVideoLoading}
                   className="w-full flex items-center justify-center gap-2 h-9 bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-gray-500 text-gray-200 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Film size={14} />
                   {asset.isVideoLoading ? '生成视频中...' : '生成视频'}
                 </button>
               )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export const ResultGallery: React.FC<ResultGalleryProps> = ({ history, onOpenVideoModal, onRegenerate }) => {
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    url: string;
    type: 'image' | 'video';
    videoUrl?: string;
  }>({ isOpen: false, url: '', type: 'image' });

  const handleImageClick = (url: string, type: 'image' | 'video', videoUrl?: string) => {
    setLightbox({ isOpen: true, url, type, videoUrl });
  };

  if (!history || history.length === 0) return null;

  return (
    <>
      <div className="space-y-12 animate-fade-in">
        {history.map((batch, index) => (
          <div key={batch.id} className="space-y-4">
             {/* Batch Header */}
             <div className="flex items-center gap-3 border-b border-gray-800 pb-2">
                <Clock size={16} className="text-gold-500" />
                <h3 className="text-lg font-serif text-white">
                  {index === 0 ? "最新生成" : "历史记录"} 
                  <span className="text-sm font-sans text-gray-500 ml-3">
                    {new Date(batch.timestamp).toLocaleString()}
                  </span>
                </h3>
             </div>

             {/* Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {batch.assets.map((asset) => (
                <ResultCard 
                  key={asset.id} 
                  batchId={batch.id}
                  asset={asset} 
                  onOpenVideoModal={onOpenVideoModal}
                  onRegenerate={onRegenerate}
                  onImageClick={handleImageClick}
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
          onClick={() => setLightbox({ ...lightbox, isOpen: false })}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-[110]"
            onClick={() => setLightbox({ ...lightbox, isOpen: false })}
          >
            <X size={32} />
          </button>

          <div 
             className="relative max-w-full max-h-full flex items-center justify-center" 
             onClick={(e) => e.stopPropagation()}
          >
            {lightbox.type === 'video' && lightbox.videoUrl ? (
               <video 
                 src={lightbox.videoUrl} 
                 controls 
                 autoPlay 
                 className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl border border-gray-800"
               >
                 您的浏览器不支持视频播放。
               </video>
            ) : (
              <img 
                src={lightbox.url} 
                alt="Full Preview" 
                className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl rounded-sm"
              />
            )}
          </div>
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