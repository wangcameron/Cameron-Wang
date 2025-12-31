import React, { useState, useEffect } from 'react';
import { Layout, Sparkles, Gem, Ruler, AlertTriangle, Layers, Shirt, Image as ImageIcon } from 'lucide-react';
import { UploadedFile, Dimensions, AspectRatio, GenerationBatch, GeneratedAsset, JewelryCategory, AppMode, ImageResolution, Region } from './types';
import { FileUpload } from './components/FileUpload.tsx';
import { ResultGallery } from './components/ResultGallery.tsx';
import { generateTryOnImage, generateSceneImage, verifyFeedbackIntent, checkApiKey, promptForApiKey } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // App Mode
  const [activeMode, setActiveMode] = useState<AppMode>('try-on');

  // Common Inputs
  const [productImages, setProductImages] = useState<UploadedFile[]>([]);
  // Changed to array to support multiple reference images
  const [referenceImages, setReferenceImages] = useState<UploadedFile[]>([]);
  const [modelImage, setModelImage] = useState<UploadedFile | null>(null);
  const [category, setCategory] = useState<JewelryCategory>('项链');
  const [instructions, setInstructions] = useState(''); // Precautions
  
  // Scene Specific Input
  const [scenePrompt, setScenePrompt] = useState('放置在黑色大理石纹理的台面上，周围有散落的玫瑰花瓣，柔和的侧光，高级感。');

  // Settings
  const [dimensions, setDimensions] = useState<Dimensions>({ width: '', height: '', unit: 'mm' });
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  
  // History / Generations
  const [history, setHistory] = useState<GenerationBatch[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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

  // --- Logic helpers ---

  const getDimensionText = () => {
    return dimensions.width && dimensions.height 
      ? `${dimensions.width}${dimensions.unit} x ${dimensions.height}${dimensions.unit}`
      : '标准珠宝尺寸';
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

  // --- Handlers ---
  
  const handleGenerate = async () => {
    // Validation
    if (productImages.length === 0) return;
    if (activeMode === 'try-on' && (referenceImages.length === 0 || !modelImage)) return;
    
    setIsGenerating(true);
    const batchId = Date.now().toString();

    // Define Generation Tasks based on Mode
    let tasks: { id: string, label: string, prompt: string }[] = [];

    if (activeMode === 'try-on') {
      tasks = [
        { id: `${batchId}-0`, label: '细节特写', prompt: 'Extreme close-up macro shot focused entirely on the jewelry texture and craftsmanship. Shallow depth of field.' },
        { id: `${batchId}-1`, label: '近景正面', prompt: 'Close-up portrait (Chest up/Face). Front view. Perfect symmetry showing how the jewelry hangs/sits.' },
        { id: `${batchId}-2`, label: '近景侧面', prompt: 'Close-up side profile (45-degree). Highlighting structural depth.' },
        { id: `${batchId}-3`, label: '手部互动', prompt: 'Model is gently touching the jewelry or adjusting it. Elegant hand pose interacting with the product.' }
      ];
    } else {
      // Scene Mode - Generate 3 variations
      tasks = [
        { id: `${batchId}-0`, label: '场景展示 1', prompt: scenePrompt },
        { id: `${batchId}-1`, label: '场景展示 2', prompt: scenePrompt + ' (Variation in angle)' },
        { id: `${batchId}-2`, label: '场景展示 3', prompt: scenePrompt + ' (Variation in lighting)' }
      ];
    }
    
    // Init Batch
    const newAssets: GeneratedAsset[] = tasks.map(t => ({
      id: t.id,
      imagePrompt: t.label,
      isImageLoading: true,
      resolution: '2K',
      aspectRatio: aspectRatio,
    }));

    setHistory(prev => [{
      id: batchId,
      timestamp: Date.now(),
      mode: activeMode,
      assets: newAssets
    }, ...prev]);

    // Execute Logic - Sequential to avoid 500 errors
    for (const task of tasks) {
      try {
        let base64Image = '';
        if (activeMode === 'try-on') {
           base64Image = await generateTryOnImage({
             productBase64s: productImages.map(f => f.base64),
             referenceBase64s: referenceImages.map(f => f.base64),
             modelBase64: modelImage!.base64,
             dimensionsText: getDimensionText(),
             aspectRatio: aspectRatio,
             viewpoint: task.prompt,
             category: category,
             instructions: instructions,
             resolution: '2K'
           });
        } else {
           base64Image = await generateSceneImage({
             productBase64s: productImages.map(f => f.base64),
             referenceBase64s: referenceImages.length > 0 ? referenceImages.map(f => f.base64) : undefined,
             modelBase64: modelImage?.base64, // Optional
             scenePrompt: task.prompt,
             aspectRatio: aspectRatio,
             category: category,
             instructions: instructions,
             resolution: '2K'
           });
        }
        updateAssetInHistory(batchId, task.id, { imageUrl: base64Image, isImageLoading: false });
      } catch (error: any) {
        let errorMsg = "生成失败，请重试。";
        const errorString = JSON.stringify(error);
        if (errorString.includes("User location is not supported")) {
             errorMsg = "所在地区暂不支持 (请检查网络/VPN)。";
        } else if (errorString.includes("500") || errorString.includes("Internal Server Error")) {
             errorMsg = "服务器繁忙，请稍后重试。";
        }
        updateAssetInHistory(batchId, task.id, { isImageLoading: false, error: errorMsg });
      }
    }

    setIsGenerating(false);
  };

  // --- Feedback & Verification ---

  const handleVerifyIntent = async (assetId: string, feedback: string, files: string[], region?: Region) => {
    // Find batch info
    const batch = history.find(b => b.assets.some(a => a.id === assetId));
    if (!batch) return;

    if (!feedback && files.length === 0 && !region) {
      // Clear verification state
      updateAssetInHistory(batch.id, assetId, { isVerifyingFeedback: false, feedbackInterpretation: undefined, feedbackReferenceImages: undefined, feedbackRegion: undefined });
      return;
    }

    updateAssetInHistory(batch.id, assetId, { isVerifyingFeedback: true });

    // Identify prompt context
    const asset = batch.assets.find(a => a.id === assetId);
    const originalPrompt = asset?.imagePrompt || "";
    const currentImageUrl = asset?.imageUrl;

    // Call lightweight model to interpret, now including image analysis
    const interpretation = await verifyFeedbackIntent(originalPrompt, feedback, currentImageUrl, files, region);
    
    updateAssetInHistory(batch.id, assetId, { 
      isVerifyingFeedback: false, 
      feedbackInterpretation: interpretation,
      feedbackDraft: feedback, // Store original text
      feedbackReferenceImages: files, // Store temporary feedback images
      feedbackRegion: region
    });
  };

  const handleRegenerate = async (assetId: string, feedback: string) => {
    const batch = history.find(b => b.assets.some(a => a.id === assetId));
    const asset = batch?.assets.find(a => a.id === assetId);
    if (!batch || !asset) return;

    // Reset UI state
    updateAssetInHistory(batch.id, assetId, { 
      isImageLoading: true, 
      error: undefined, 
      feedbackInterpretation: undefined 
    });

    try {
      let base64Image = '';
      // Use logic based on BATCH mode, not necessarily current app active mode
      if (batch.mode === 'try-on') {
          // Re-gen try on
          if (referenceImages.length === 0 || !modelImage) throw new Error("缺少原图信息");
          base64Image = await generateTryOnImage({
             productBase64s: productImages.map(f => f.base64),
             referenceBase64s: referenceImages.map(f => f.base64),
             modelBase64: modelImage.base64,
             dimensionsText: getDimensionText(),
             aspectRatio: asset.aspectRatio,
             viewpoint: asset.imagePrompt,
             category: category,
             instructions: instructions,
             feedback: feedback, // Pass confirmed feedback
             feedbackReferenceBase64s: asset.feedbackReferenceImages, // Pass confirmed reference images
             feedbackRegion: asset.feedbackRegion, // Pass confirmed region
             resolution: asset.resolution
           });
      } else {
          // Re-gen scene
          base64Image = await generateSceneImage({
             productBase64s: productImages.map(f => f.base64),
             referenceBase64s: referenceImages.length > 0 ? referenceImages.map(f => f.base64) : undefined,
             modelBase64: modelImage?.base64,
             scenePrompt: scenePrompt, // Use current prompt + feedback
             aspectRatio: asset.aspectRatio,
             category: category,
             instructions: `${instructions}. FEEDBACK: ${feedback}`,
             feedbackReferenceBase64s: asset.feedbackReferenceImages,
             feedbackRegion: asset.feedbackRegion,
             resolution: asset.resolution
           });
      }
      updateAssetInHistory(batch.id, assetId, { imageUrl: base64Image, isImageLoading: false, feedbackReferenceImages: undefined, feedbackRegion: undefined });
    } catch (e: any) {
      updateAssetInHistory(batch.id, assetId, { isImageLoading: false, error: "重绘失败" });
    }
  };

  const handleDownloadHighRes = async (assetId: string, resolution: ImageResolution) => {
    const batch = history.find(b => b.assets.some(a => a.id === assetId));
    const asset = batch?.assets.find(a => a.id === assetId);
    if (!batch || !asset) return;

    // Set loading state on the card (re-using image loading or adding a specific one, reusing image loading for simplicity)
    updateAssetInHistory(batch.id, assetId, { isImageLoading: true, resolution: resolution });

    try {
       // Trigger regeneration with 4K setting
       let base64Image = '';
       if (batch.mode === 'try-on') {
          if (referenceImages.length === 0 || !modelImage) throw new Error("缺少原图");
          base64Image = await generateTryOnImage({
             productBase64s: productImages.map(f => f.base64),
             referenceBase64s: referenceImages.map(f => f.base64),
             modelBase64: modelImage.base64,
             dimensionsText: getDimensionText(),
             aspectRatio: asset.aspectRatio,
             viewpoint: asset.imagePrompt,
             category: category,
             instructions: instructions,
             resolution: resolution // 4K
           });
       } else {
          base64Image = await generateSceneImage({
             productBase64s: productImages.map(f => f.base64),
             referenceBase64s: referenceImages.length > 0 ? referenceImages.map(f => f.base64) : undefined,
             modelBase64: modelImage?.base64,
             scenePrompt: scenePrompt,
             aspectRatio: asset.aspectRatio,
             category: category,
             instructions: instructions,
             resolution: resolution // 4K
           });
       }
       
       updateAssetInHistory(batch.id, assetId, { imageUrl: base64Image, isImageLoading: false });
       
       // Trigger download immediately
       const link = document.createElement('a');
       link.href = base64Image;
       link.download = `luxefit-${assetId}-${resolution}.png`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);

    } catch (e) {
      updateAssetInHistory(batch.id, assetId, { isImageLoading: false, error: "高清生成失败", resolution: '2K' });
    }
  };


  // --- Render ---

  if (isCheckingKey) return <div className="min-h-screen bg-luxury-black flex items-center justify-center text-gold-400">加载中...</div>;
  if (!hasApiKey) return <div className="min-h-screen bg-luxury-black flex items-center justify-center text-white"><button onClick={handleConnect}>Connect API</button></div>; // Simplified for brevity

  return (
    <div className="min-h-screen bg-luxury-black text-gray-200 selection:bg-gold-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header & Tabs */}
        <header className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6 gap-4">
            <div className="flex items-center gap-3">
              <Gem className="text-gold-400 w-8 h-8" />
              <h1 className="text-3xl font-serif text-white tracking-tight">LuxeFit AI</h1>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-4 border-b border-gray-800">
             <button 
               onClick={() => setActiveMode('try-on')}
               className={`pb-3 px-4 flex items-center gap-2 font-medium transition-all ${activeMode === 'try-on' ? 'text-gold-400 border-b-2 border-gold-400' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <Shirt size={18} />
               模特虚拟佩戴
             </button>
             <button 
               onClick={() => setActiveMode('scene')}
               className={`pb-3 px-4 flex items-center gap-2 font-medium transition-all ${activeMode === 'scene' ? 'text-gold-400 border-b-2 border-gold-400' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <ImageIcon size={18} />
               产品场景展示
             </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Inputs */}
          <section className="lg:col-span-4 space-y-6">
            
            {/* Common: Category & Precaution */}
            <div className="bg-luxury-charcoal p-6 rounded-2xl border border-gray-800 space-y-4">
               <h2 className="text-lg font-serif text-white flex items-center gap-2">
                 <Sparkles size={18} className="text-gold-400" />
                 产品信息
               </h2>
               
               {/* Category Selector */}
               <div>
                 <label className="block text-sm font-medium text-gray-300 mb-2">珠宝类别</label>
                 <select 
                   value={category}
                   onChange={(e) => setCategory(e.target.value as JewelryCategory)}
                   className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-gold-500 outline-none"
                 >
                   {['胸针', '项链', '耳环/耳坠', '戒指', '手链'].map(c => (
                     <option key={c} value={c}>{c}</option>
                   ))}
                 </select>
               </div>

               {/* Precautions */}
               <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    注意事项 (给 AI 的提示)
                  </label>
                  <textarea 
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="例如：产品实际尺寸很小；吊坠连接处有碎钻；保持金属光泽..."
                    className="w-full h-20 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 outline-none resize-none"
                  />
               </div>
            </div>

            {/* Images */}
            <div className="bg-luxury-charcoal p-6 rounded-2xl border border-gray-800 space-y-6">
              
              <FileUpload 
                label="珠宝白底图 (必填)" 
                multiple={true}
                value={productImages} 
                onChange={(files) => setProductImages(files as UploadedFile[])} 
              />
              
              {activeMode === 'try-on' ? (
                // Try-on Mode Inputs
                <>
                  <FileUpload 
                    label="真人佩戴实拍图 (必填)" 
                    subLabel="支持多张，AI 将严格对比"
                    multiple={true} 
                    value={referenceImages} 
                    onChange={(files) => setReferenceImages(files as UploadedFile[])} 
                  />
                  <FileUpload 
                    label="目标模特图 (必填)" 
                    value={modelImage} 
                    onChange={setModelImage} 
                  />
                  
                  {/* Dimensions */}
                  <div className="pt-2 border-t border-gray-700">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
                      <Ruler size={16} />
                      实际尺寸 (辅助参考)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="宽" 
                        value={dimensions.width}
                        onChange={(e) => setDimensions({...dimensions, width: e.target.value})}
                        className="w-1/3 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 outline-none"
                      />
                      <input 
                        type="number" 
                        placeholder="高" 
                        value={dimensions.height}
                        onChange={(e) => setDimensions({...dimensions, height: e.target.value})}
                        className="w-1/3 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 outline-none"
                      />
                      <select 
                        value={dimensions.unit}
                        onChange={(e) => setDimensions({...dimensions, unit: e.target.value as any})}
                        className="w-1/3 bg-black/50 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white focus:border-gold-500 outline-none"
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                // Scene Mode Inputs
                <>
                   <div className="grid grid-cols-2 gap-4">
                     <FileUpload 
                        label="实拍参考 (可选)" 
                        subLabel="参考材质/大小"
                        multiple={true}
                        value={referenceImages} 
                        onChange={(files) => setReferenceImages(files as UploadedFile[])} 
                      />
                      <FileUpload 
                        label="特定模特 (可选)" 
                        subLabel="如果不传则生成AI模特或静物"
                        value={modelImage} 
                        onChange={setModelImage} 
                      />
                   </div>
                   
                   <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                         场景描述
                      </label>
                      <textarea 
                        value={scenePrompt}
                        onChange={(e) => setScenePrompt(e.target.value)}
                        placeholder="描述你想要的背景、光线、氛围..."
                        className="w-full h-24 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 outline-none resize-none leading-relaxed"
                      />
                   </div>
                </>
              )}
            </div>

            {/* Output Settings & Action */}
            <div className="bg-luxury-charcoal p-6 rounded-2xl border border-gray-800 space-y-6">
              <h2 className="text-lg font-serif text-white flex items-center gap-2">
                <Layout size={18} className="text-gold-400" />
                输出规格
              </h2>
              
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

              <button
                disabled={isGenerating || productImages.length === 0 || (activeMode === 'try-on' && (referenceImages.length === 0 || !modelImage))}
                onClick={handleGenerate}
                className={`w-full py-4 text-base font-bold rounded-xl shadow-lg transition-all ${
                  isGenerating || productImages.length === 0 || (activeMode === 'try-on' && (referenceImages.length === 0 || !modelImage))
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-gold-400 to-gold-600 text-black hover:shadow-gold-500/20 hover:scale-[1.01]'
                }`}
              >
                {isGenerating ? '正在生成...' : `开始生成 (${activeMode === 'try-on' ? '4张' : '3张'})`}
              </button>
            </div>
          </section>

          {/* Right Column: Results */}
          <section className="lg:col-span-8">
             {history.length > 0 ? (
                <ResultGallery 
                  history={history}
                  onRegenerate={handleRegenerate}
                  onVerifyIntent={handleVerifyIntent}
                  onDownloadHighRes={handleDownloadHighRes}
                />
             ) : (
               <div className="h-[600px] border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-600 space-y-4 bg-white/5">
                 <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center">
                    <Layers className="text-gray-600 w-10 h-10" />
                 </div>
                 <p className="text-lg">暂无生成记录</p>
                 <p className="text-sm text-gray-500">
                   {activeMode === 'try-on' 
                     ? '上传图片以生成模特佩戴效果 (极致特写/正面/侧面/互动)' 
                     : '上传产品图并描述场景以生成商业展示图'}
                 </p>
               </div>
             )}
          </section>

        </main>
      </div>
    </div>
  );
};

export default App;