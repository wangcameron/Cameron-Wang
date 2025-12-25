import React, { useState, useEffect } from 'react';
import { Layout, Sparkles, Gem, Ruler, AlertTriangle, History, X } from 'lucide-react';
import { UploadedFile, Dimensions, AspectRatio, VideoResolution, GenerationBatch, GeneratedAsset, VideoAspectRatio } from './types';
import { FileUpload } from './components/FileUpload.tsx';
import { ResultGallery } from './components/ResultGallery.tsx';
import { generateJewelryImage, generateShowcaseVideo, checkApiKey, promptForApiKey } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // Inputs
  const [productImages, setProductImages] = useState<UploadedFile[]>([]);
  const [referenceImage, setReferenceImage] = useState<UploadedFile | null>(null);
  const [modelImage, setModelImage] = useState<UploadedFile | null>(null);
  
  // Settings
  const [dimensions, setDimensions] = useState<Dimensions>({ width: '', height: '', unit: 'mm' });
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  
  // History / Generations
  const [history, setHistory] = useState<GenerationBatch[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Video Modal State
  const [videoModal, setVideoModal] = useState<{
    isOpen: boolean;
    assetId: string | null;
    batchId: string | null;
  }>({ isOpen: false, assetId: null, batchId: null });
  
  const [videoSettings, setVideoSettings] = useState<{
    resolution: VideoResolution;
    aspectRatio: VideoAspectRatio;
    prompt: string;
  }>({ 
    resolution: '1080p', 
    aspectRatio: '9:16',
    prompt: "Cinematic fashion showcase, slight slow motion movement, the model poses gently, jewelry sparkles, high fashion lighting, 4k, photorealistic." 
  });

  // --- Effects ---
  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    setIsCheckingKey(true);
    try {
      const hasKey = await checkApiKey();
      setHasApiKey(hasKey);
    } catch (e) {
      console.error("Error checking API key", e);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleConnect = async () => {
    await promptForApiKey();
    setHasApiKey(true);
  };

  // --- Handlers ---
  
  const handleGenerateImages = async () => {
    if (productImages.length === 0 || !referenceImage || !modelImage) return;

    setIsGenerating(true);
    
    const variants = [
      {
        label: '极致特写 (Close-up)',
        prompt: 'Extreme close-up macro shot focusing strictly on the jewelry details. The model is still, allowing high texture visibility. Shallow depth of field.'
      },
      {
        label: '优雅正面 (Elegant Portrait)',
        prompt: 'Waist-up fashion portrait. The model is looking directly at the camera with an elegant, upright posture. Perfect symmetry to show how the jewelry hangs naturally.'
      },
      {
        label: '侧颜轮廓 (Side Profile)',
        prompt: '90-degree side profile view. The model is looking away to the side. Highlighting the structural depth and side details of the jewelry against the jawline or neck.'
      },
      {
        label: '手势互动 (Hand Interaction)',
        prompt: 'Dynamic pose. The model is gently touching the jewelry or adjusting their hair near it. Candid, lifestyle movement, showing the jewelry in use.'
      }
    ];
    
    // Create new batch
    const batchId = Date.now().toString();
    const newAssets: GeneratedAsset[] = variants.map((v, index) => ({
      id: `${batchId}-${index}`,
      imagePrompt: v.label,
      isImageLoading: true,
      isVideoLoading: false,
      aspectRatio: aspectRatio,
    }));

    const newBatch: GenerationBatch = {
      id: batchId,
      timestamp: Date.now(),
      assets: newAssets
    };

    // Prepend to history
    setHistory(prev => [newBatch, ...prev]);

    // Parallel requests
    const promises = newAssets.map(async (asset, index) => {
      try {
        const dimText = dimensions.width && dimensions.height 
          ? `${dimensions.width}${dimensions.unit} x ${dimensions.height}${dimensions.unit}`
          : '标准珠宝尺寸';

        const base64Image = await generateJewelryImage({
          productBase64s: productImages.map(f => f.base64),
          referenceBase64: referenceImage.base64,
          modelBase64: modelImage.base64,
          dimensionsText: dimText,
          aspectRatio: aspectRatio,
          viewpoint: variants[index].prompt
        });

        updateAssetInHistory(batchId, asset.id, { imageUrl: base64Image, isImageLoading: false });

      } catch (error: any) {
        console.error(error);
        let errorMsg = "生成失败，请重试。";
        // Check for specific API error messages
        const errorString = JSON.stringify(error);
        if (errorString.includes("User location is not supported") || (error.message && error.message.includes("location"))) {
             errorMsg = "所在地区暂不支持此模型 (请尝试更换网络节点/VPN)。";
        }
        updateAssetInHistory(batchId, asset.id, { isImageLoading: false, error: errorMsg });
      }
    });

    await Promise.all(promises);
    setIsGenerating(false);
  };

  const updateAssetInHistory = (batchId: string, assetId: string, updates: Partial<GeneratedAsset>) => {
    setHistory(prevHistory => prevHistory.map(batch => {
      if (batch.id !== batchId) return batch;
      return {
        ...batch,
        assets: batch.assets.map(asset => 
          asset.id === assetId ? { ...asset, ...updates } : asset
        )
      };
    }));
  };

  const handleRegenerateImage = async (assetId: string, feedback: string) => {
    // Find asset context
    let targetBatchId: string | undefined;
    let targetAsset: GeneratedAsset | undefined;

    for (const batch of history) {
      const found = batch.assets.find(a => a.id === assetId);
      if (found) {
        targetBatchId = batch.id;
        targetAsset = found;
        break;
      }
    }

    if (!targetBatchId || !targetAsset || productImages.length === 0 || !referenceImage || !modelImage) return;

    // Reset image loading AND Clear Video State because the image is changing
    updateAssetInHistory(targetBatchId, assetId, { 
      isImageLoading: true, 
      error: undefined,
      videoUrl: undefined,     // <--- Clear the video URL
      isVideoLoading: false    // <--- Reset loading state
    });

    try {
      const dimText = dimensions.width && dimensions.height 
          ? `${dimensions.width}${dimensions.unit} x ${dimensions.height}${dimensions.unit}`
          : '标准珠宝尺寸';

      const base64Image = await generateJewelryImage({
          productBase64s: productImages.map(f => f.base64),
          referenceBase64: referenceImage.base64,
          modelBase64: modelImage.base64,
          dimensionsText: dimText,
          aspectRatio: targetAsset.aspectRatio,
          viewpoint: targetAsset.imagePrompt,
          feedback: feedback
      });

      updateAssetInHistory(targetBatchId, assetId, { imageUrl: base64Image, isImageLoading: false });

    } catch (error: any) {
      console.error(error);
      let errorMsg = "重绘失败，请重试。";
      const errorString = JSON.stringify(error);
      if (errorString.includes("User location is not supported") || (error.message && error.message.includes("location"))) {
            errorMsg = "所在地区暂不支持此模型 (请尝试更换网络节点/VPN)。";
      }
      updateAssetInHistory(targetBatchId, assetId, { isImageLoading: false, error: errorMsg });
    }
  };

  // Open Modal
  const openVideoModal = (batchId: string, assetId: string) => {
    setVideoModal({ isOpen: true, batchId, assetId });
  };

  // Execute Generation
  const handleConfirmGenerateVideo = async () => {
    const { batchId, assetId } = videoModal;
    if (!batchId || !assetId) return;

    // Find asset
    const batch = history.find(b => b.id === batchId);
    const asset = batch?.assets.find(a => a.id === assetId);

    if (!asset || !asset.imageUrl) return;

    // Close modal and set loading
    setVideoModal({ ...videoModal, isOpen: false });
    updateAssetInHistory(batchId, assetId, { isVideoLoading: true, videoAspectRatio: videoSettings.aspectRatio });

    try {
      const videoUrl = await generateShowcaseVideo({
        imageBase64: asset.imageUrl,
        resolution: videoSettings.resolution,
        aspectRatio: videoSettings.aspectRatio,
        prompt: videoSettings.prompt
      });

      updateAssetInHistory(batchId, assetId, { videoUrl, isVideoLoading: false });
    } catch (error: any) {
      console.error(error);
      let errorMsg = "视频生成失败。";
      const errorString = JSON.stringify(error);
      if (errorString.includes("User location is not supported") || (error.message && error.message.includes("location"))) {
          errorMsg = "所在地区暂不支持视频生成 (请尝试更换网络节点/VPN)。";
      }
      updateAssetInHistory(batchId, assetId, { isVideoLoading: false, error: errorMsg });
    }
  };

  // --- Render ---

  if (isCheckingKey) {
    return <div className="min-h-screen bg-luxury-black flex items-center justify-center text-gold-400">加载中...</div>;
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-luxury-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-luxury-charcoal border border-gold-500/20 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto">
            <Gem className="w-8 h-8 text-gold-400" />
          </div>
          <div>
            <h1 className="text-3xl font-serif text-white mb-2">LuxeFit AI</h1>
            <p className="text-gray-400">专业珠宝虚拟试戴</p>
          </div>
          <p className="text-sm text-gray-500">
            为了生成高质量的 4K 视觉效果和 Veo 视频，本应用需要付费的 Google Cloud Project API 密钥。
          </p>
          <button 
            onClick={handleConnect}
            className="w-full py-3 bg-gold-600 hover:bg-gold-500 text-black font-semibold rounded-lg transition-all transform hover:scale-[1.02]"
          >
            连接 API 密钥
          </button>
          <div className="text-xs text-gray-600">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-gold-400">
              账单信息
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-black text-gray-200 selection:bg-gold-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Gem className="text-gold-400 w-8 h-8" />
              <h1 className="text-3xl font-serif text-white tracking-tight">LuxeFit AI</h1>
            </div>
            <p className="text-gray-400 text-sm">高保真虚拟试戴与视频展示</p>
          </div>
          <div className="flex gap-4">
             <button onClick={handleConnect} className="text-xs text-gray-500 hover:text-gold-400 underline">
               切换 API 密钥
             </button>
          </div>
        </header>

        {/* Configuration Panel */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Inputs */}
          <section className="lg:col-span-4 space-y-8">
            <div className="bg-luxury-charcoal p-6 rounded-2xl border border-gray-800 space-y-6">
              <h2 className="text-xl font-serif text-white flex items-center gap-2">
                <Sparkles size={20} className="text-gold-400" />
                上传素材
              </h2>
              
              <FileUpload 
                label="珠宝白底图 (支持多张)" 
                subLabel="建议上传正面、侧面、细节图"
                multiple={true}
                value={productImages} 
                onChange={(files) => setProductImages(files as UploadedFile[])} 
              />
              <FileUpload 
                label="真人佩戴实拍图" 
                subLabel="用于参考实际比例/效果"
                value={referenceImage} 
                onChange={setReferenceImage} 
              />
              <FileUpload 
                label="目标模特图" 
                value={modelImage} 
                onChange={setModelImage} 
              />

              {/* Dimensions (Optional) */}
              <div className="pt-4 border-t border-gray-700">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
                  <Ruler size={16} />
                  实际尺寸 (可选)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="宽" 
                    value={dimensions.width}
                    onChange={(e) => setDimensions({...dimensions, width: e.target.value})}
                    className="w-1/3 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                  <input 
                    type="number" 
                    placeholder="高" 
                    value={dimensions.height}
                    onChange={(e) => setDimensions({...dimensions, height: e.target.value})}
                    className="w-1/3 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                  <select 
                    value={dimensions.unit}
                    onChange={(e) => setDimensions({...dimensions, unit: e.target.value as any})}
                    className="w-1/3 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  >
                    <option value="mm">毫米</option>
                    <option value="cm">厘米</option>
                    <option value="in">英寸</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-luxury-charcoal p-6 rounded-2xl border border-gray-800 space-y-6">
               <h2 className="text-xl font-serif text-white flex items-center gap-2">
                <Layout size={20} className="text-gold-400" />
                输出设置
              </h2>
              
              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">图片比例</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['3:4', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-2 text-sm rounded-lg border transition-all ${
                        aspectRatio === ratio 
                        ? 'bg-gold-600 text-black border-gold-600 font-bold' 
                        : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={productImages.length === 0 || !referenceImage || !modelImage || isGenerating}
                onClick={handleGenerateImages}
                className={`w-full py-4 text-base font-bold rounded-xl shadow-lg transition-all ${
                  productImages.length === 0 || !referenceImage || !modelImage || isGenerating
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-gold-400 to-gold-600 text-black hover:shadow-gold-500/20 hover:scale-[1.01]'
                }`}
              >
                {isGenerating ? '正在生成 4 种方案...' : '开始生成'}
              </button>

              {(productImages.length === 0 || !referenceImage || !modelImage) && (
                <div className="flex items-start gap-2 text-xs text-orange-400/80 bg-orange-400/10 p-3 rounded-lg">
                  <AlertTriangle size={14} className="mt-0.5" />
                  请上传所有 3 张必要图片以开始。
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Results History */}
          <section className="lg:col-span-8 space-y-8">
             {history.length > 0 ? (
                <ResultGallery 
                  history={history}
                  onOpenVideoModal={openVideoModal}
                  onRegenerate={handleRegenerateImage}
                />
             ) : (
               <div className="h-[600px] border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-600 space-y-4 bg-white/5">
                 <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center">
                    <Sparkles className="text-gray-600 w-10 h-10" />
                 </div>
                 <p className="text-lg">生成的素材及历史记录将显示在这里</p>
               </div>
             )}
          </section>

        </main>
      </div>

      {/* Video Generation Modal */}
      {videoModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-luxury-charcoal border border-gold-500/30 rounded-2xl p-6 shadow-2xl relative animate-fade-in max-h-[90vh] overflow-y-auto">
             <button 
               onClick={() => setVideoModal({ ...videoModal, isOpen: false })}
               className="absolute top-4 right-4 text-gray-400 hover:text-white"
             >
               <X size={20} />
             </button>
             
             <h3 className="text-xl font-serif text-white mb-6 flex items-center gap-2">
               <Gem className="text-gold-400" size={20} />
               视频生成设置
             </h3>

             <div className="space-y-6">
               {/* Resolution */}
               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-300">视频清晰度</label>
                 <div className="grid grid-cols-2 gap-3">
                   {(['720p', '1080p'] as VideoResolution[]).map(res => (
                     <button
                       key={res}
                       onClick={() => setVideoSettings({ ...videoSettings, resolution: res })}
                       className={`py-2 px-4 rounded-lg border text-sm transition-all ${
                         videoSettings.resolution === res
                         ? 'bg-gold-600 border-gold-600 text-black font-bold'
                         : 'bg-black/30 border-gray-700 text-gray-300 hover:border-gray-500'
                       }`}
                     >
                       {res}
                     </button>
                   ))}
                 </div>
               </div>

               {/* Aspect Ratio */}
               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-300">视频比例</label>
                 <div className="grid grid-cols-2 gap-3">
                   {(['9:16', '16:9'] as VideoAspectRatio[]).map(ratio => (
                     <button
                       key={ratio}
                       onClick={() => setVideoSettings({ ...videoSettings, aspectRatio: ratio })}
                       className={`py-2 px-4 rounded-lg border text-sm transition-all ${
                         videoSettings.aspectRatio === ratio
                         ? 'bg-gold-600 border-gold-600 text-black font-bold'
                         : 'bg-black/30 border-gray-700 text-gray-300 hover:border-gray-500'
                       }`}
                     >
                       {ratio} {ratio === '9:16' ? '(竖屏)' : '(横屏)'}
                     </button>
                   ))}
                 </div>
                 <p className="text-xs text-gray-500 mt-1">* 目前 Veo 视频模型仅支持 9:16 和 16:9 比例</p>
               </div>

               {/* Video Prompt Input */}
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex justify-between">
                    视频生成提示词
                    <span className="text-xs text-gold-400/80 font-normal">可自定义效果</span>
                  </label>
                  <textarea
                    value={videoSettings.prompt}
                    onChange={(e) => setVideoSettings({ ...videoSettings, prompt: e.target.value })}
                    placeholder="描述视频中的动作、光影、氛围..."
                    className="w-full text-xs bg-black/40 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-600 focus:border-gold-500 focus:outline-none resize-none h-24 leading-relaxed"
                  />
                  <p className="text-xs text-gray-500">
                    提示: 包含"Cinematic"(电影感), "Slow motion"(慢动作) 等词汇可提升质感。
                  </p>
               </div>

               <div className="pt-2">
                 <button
                   onClick={handleConfirmGenerateVideo}
                   disabled={!videoSettings.prompt.trim()}
                   className="w-full py-3 bg-gradient-to-r from-gold-400 to-gold-600 text-black font-bold rounded-xl hover:shadow-gold-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   开始生成 (预计 1-2 分钟)
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;