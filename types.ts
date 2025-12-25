
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
export type VideoResolution = '720p' | '1080p';
export type VideoAspectRatio = '9:16' | '16:9';

export interface GeneratedAsset {
  id: string;
  imageUrl?: string;
  imagePrompt: string;
  isImageLoading: boolean;
  videoUrl?: string;
  isVideoLoading: boolean;
  error?: string;
  aspectRatio: AspectRatio; // Image aspect ratio
  videoAspectRatio?: VideoAspectRatio;
}

export interface GenerationBatch {
  id: string;
  timestamp: number;
  assets: GeneratedAsset[];
}

export interface AppState {
  productImages: UploadedFile[];
  referenceImage: UploadedFile | null;
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
