import { GoogleGenAI } from "@google/genai";
import { AspectRatio, VideoResolution } from "../types";

// Helper to strip base64 header
const stripBase64 = (base64: string) => base64.split(',')[1] || base64;

export const checkApiKey = async (): Promise<boolean> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const promptForApiKey = async (): Promise<void> => {
  if (window.aistudio && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    console.error("AI Studio API not available");
  }
};

interface ImageGenerationParams {
  productBase64s: string[]; // Changed to array
  referenceBase64: string;
  modelBase64: string;
  dimensionsText: string;
  aspectRatio: AspectRatio;
  viewpoint: string;
  feedback?: string; // Optional feedback for regeneration
}

export const generateJewelryImage = async (params: ImageGenerationParams): Promise<string> => {
  // Re-initialize to ensure latest key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let promptText = `
    You are a professional high-end jewelry photographer and retoucher.
    Task: Create a photorealistic image of the MODEL wearing the JEWELRY PRODUCT.
    
    Inputs provided:
    1. ${params.productBase64s.length} Image(s) of the JEWELRY PRODUCT (White background). Analyze these multiple angles to fully understand the 3D structure, thickness, and clasp details.
    2. Image of the JEWELRY worn by a real person (Reference for scale and fit).
    3. Image of the TARGET MODEL.
    
    Context:
    The jewelry dimensions are approximately: ${params.dimensionsText}.
    
    Instructions:
    - Synthesize the jewelry onto the target model naturally.
    - Match the lighting of the model's environment.
    - Ensure correct scaling based on the reference image and dimensions.
    - **CRITICAL**: You must strictly follow the specified Viewpoint/Pose below to create a unique variation.
    - Viewpoint/Pose Requirement: ${params.viewpoint}.
    - The output must be high quality, sharp focus, high resolution (4K style).
    - The jewelry must be the focal point.
  `;

  if (params.feedback) {
    promptText += `
    
    **CORRECTION REQUEST**:
    The user was not satisfied with the previous generation. 
    Strictly adhere to this feedback for the next generation: "${params.feedback}".
    Fix the structural issues or details as requested while maintaining the requested viewpoint.
    `;
  }

  const parts: any[] = [{ text: promptText }];

  // Add all product images
  params.productBase64s.forEach(base64 => {
    parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
  });

  // Add reference and model images
  parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(params.referenceBase64) } });
  parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(params.modelBase64) } });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: params.aspectRatio,
          imageSize: '4K'
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from API");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

interface VideoGenerationParams {
  imageBase64: string;
  resolution: VideoResolution;
  aspectRatio: AspectRatio;
  prompt: string; // Add prompt parameter
}

export const generateShowcaseVideo = async (params: VideoGenerationParams): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const videoAspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: params.prompt, // Use user provided prompt
      image: {
        imageBytes: stripBase64(params.imageBase64),
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: params.resolution,
        aspectRatio: videoAspectRatio
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video URI not found in response");

    return `${videoUri}&key=${process.env.API_KEY}`;

  } catch (error) {
    console.error("Video generation failed:", error);
    throw error;
  }
};