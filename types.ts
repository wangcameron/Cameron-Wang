
export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
}

export interface Dimensions {
  width: string;
  height: string;
  unit: 'mm' | 'cm' | 'in';
}

export type AspectRatio = '3:4' | '9:16' | '1:1';
export type ImageResolution = '2K' | '4K';

export type JewelryCategory = '胸针' | '项链' | '耳环/耳坠' | '戒指' | '手链';

export type AppMode = 'try-on' | 'scene';

export interface Region {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface GeneratedAsset {
  id: string;
  imageUrl?: string;
  imagePrompt: string;
  isImageLoading: boolean;
  error?: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  // Feedback Verification State
  feedbackDraft?: string;
  isVerifyingFeedback?: boolean;
  feedbackInterpretation?: string; // What the AI thinks the user wants
  feedbackReferenceImages?: string[]; // Store base64s of images uploaded during feedback
  feedbackRegion?: Region; // Store the selected region
}

export interface GenerationBatch {
  id: string;
  timestamp: number;
  mode: AppMode; // Track if this was try-on or scene
  assets: GeneratedAsset[];
}

export interface AppState {
  productImages: UploadedFile[];
  referenceImages: UploadedFile[];
  modelImage: UploadedFile | null;
  dimensions: Dimensions;
  aspectRatio: AspectRatio;
  history: GenerationBatch[];
  isGeneratingImages: boolean;
}

// Extend Window interface for AI Studio
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
