import { GoogleGenAI } from "@google/genai";
import { AspectRatio, JewelryCategory, ImageResolution, Region } from "../types";

// Helper to strip base64 header
const stripBase64 = (base64: string) => base64.split(',')[1] || base64;

// Helper for retry logic
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, retries = 5, delay = 4000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    let isRetryable = false;
    let message = "";

    try {
      const status = error.status || error.response?.status;
      message = error.message || String(error);
      
      // Extended list of retryable errors covering network instability and timeouts
      isRetryable = 
        status === 503 || 
        status === 500 || 
        status === 429 ||
        message.includes("Deadline expired") ||
        message.includes("Overloaded") || 
        message.includes("UNAVAILABLE") ||
        message.includes("Unexpected end of JSON input") ||
        message.includes("Failed to construct 'Response'") ||
        message.includes("Response body object should not be disturbed") ||
        message.includes("ReadableStreamDefaultController") ||
        message.includes("network") ||
        message.includes("fetch");
    } catch (e) {
      console.warn("Error inspecting failure cause, defaulting to retry", e);
      isRetryable = true; 
    }

    if (isRetryable) {
      console.warn(`Operation failed, retrying in ${delay}ms... (${retries} retries left). Error: ${message}`);
      await sleep(delay);
      return retryOperation(operation, retries - 1, delay * 2); 
    }
    
    throw error;
  }
}

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

// --- Intent Verification ---

export const verifyFeedbackIntent = async (
  originalPrompt: string, 
  feedback: string, 
  currentImageBase64?: string, 
  feedbackReferenceBase64s?: string[],
  region?: Region
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let promptText = `
    Role: Professional Jewelry QA Specialist.
    Task: Analyze the User's Feedback and confirm the modification direction.
    
    Context:
    - The user is modifying a previously generated jewelry image.
    - Original Requirement: ${originalPrompt}
    - User Feedback: "${feedback}"
  `;

  if (region) {
    promptText += `\n- **Target Region Specified**: The user has drawn a box on the image to focus on. 
      Region Coordinates (Percentages): 
      Top: ${Math.round(region.y)}%, Left: ${Math.round(region.x)}%
      Width: ${Math.round(region.width)}%, Height: ${Math.round(region.height)}%
      Interpreting this region is crucial.
    `;
  }

  const parts: any[] = [];

  if (currentImageBase64) {
    promptText += `\n- Attached is the 'Current Generated Image'.`;
    parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(currentImageBase64) } });
  }

  if (feedbackReferenceBase64s && feedbackReferenceBase64s.length > 0) {
    promptText += `\n- Attached are 'New Reference Images' provided by the user. Compare these with the 'Current Generated Image' to understand the specific visual discrepancies (e.g. size, texture, setting style) mentioned in the feedback.`;
    feedbackReferenceBase64s.forEach(b64 => {
      parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(b64) } });
    });
  }

  promptText += `
    
    Instruction:
    1. Analyze the problem based on feedback, optional region, and reference images.
    2. Formulate a polite confirmation sentence in Chinese.
    3. Format: "确认您的需求：[Analysis of the problem] -> [Proposed Fix]"
    ${region ? "4. Explicitly mention that you will focus modifications on the selected area." : ""}
    
    Example: "确认您的需求：您在左上角框选了吊坠扣头，我将根据参考图调整其镶嵌方式为包镶。"
  `;

  parts.push({ text: promptText });

  try {
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts },
        });
        return response.text?.trim() || "确认您的修改需求";
    }, 2, 1000);
  } catch (e) {
    console.error("Verification failed", e);
    return `确认您的需求：${feedback}`;
  }
};

// --- Image Generation ---

interface BaseGenerationParams {
  category?: JewelryCategory;
  instructions?: string; // User precautions
  resolution: ImageResolution;
}

interface TryOnGenerationParams extends BaseGenerationParams {
  productBase64s: string[];
  referenceBase64s: string[]; // Changed to array
  modelBase64: string;
  dimensionsText: string;
  aspectRatio: AspectRatio;
  viewpoint: string;
  feedback?: string;
  feedbackReferenceBase64s?: string[]; // New images for feedback
  feedbackRegion?: Region;
}

export const generateTryOnImage = async (params: TryOnGenerationParams): Promise<string> => {
  let promptText = `
    You are a professional high-end jewelry photographer and retoucher.
    Category: ${params.category || 'Jewelry'}.
    Task: Create a photorealistic image of the MODEL wearing the JEWELRY PRODUCT.
    
    Inputs provided:
    1. ${params.productBase64s.length} Image(s) of the JEWELRY PRODUCT (White background). Analyze 3D structure/clasp.
    2. ${params.referenceBase64s.length} Real Life Reference Image(s): **CRITICAL FOR SCALING**. Use these images to determine the EXACT physical size of the jewelry. Do NOT make the jewelry appear larger or smaller than it looks in these reference photos relative to a human.
    3. Image of the TARGET MODEL.
    
    Context/Precautions:
    Dimensions: ${params.dimensionsText}.
    ${params.instructions ? `**USER PRECAUTIONS**: ${params.instructions}` : ''}
    
    Instructions:
    - Synthesize the jewelry onto the target model naturally.
    - Match lighting/skin tone.
    - **SCALE CHECK**: Ensure the jewelry size is realistic based on the 'Real Life Reference'.
    - Viewpoint/Pose Requirement: ${params.viewpoint}.
    - Quality: High resolution, photorealistic, sharp focus.
  `;

  if (params.feedback) {
    promptText += `
    
    **CORRECTION REQUEST**:
    The user requires changes to a previous version. 
    Strictly adhere to: "${params.feedback}".
    ${params.feedbackReferenceBase64s?.length ? "Refer to the NEWLY provided reference images for the specific look/size required." : ""}
    `;
    
    if (params.feedbackRegion) {
      promptText += `
      **TARGET REGION**: 
      The user has defined a specific bounding box for this modification.
      Focus your changes strictly within the area defined by:
      Top: ${params.feedbackRegion.y}%, Left: ${params.feedbackRegion.x}%
      Width: ${params.feedbackRegion.width}%, Height: ${params.feedbackRegion.height}%
      (Coordinates are percentage of the total image size).
      `;
    }
  }

  const parts: any[] = [{ text: promptText }];

  params.productBase64s.forEach(base64 => {
    parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
  });

  params.referenceBase64s.forEach(base64 => {
    parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
  });

  parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(params.modelBase64) } });

  if (params.feedbackReferenceBase64s) {
    params.feedbackReferenceBase64s.forEach(base64 => {
      parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
    });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  return await callImageModel(ai, parts, params.aspectRatio, params.resolution);
};

interface SceneGenerationParams extends BaseGenerationParams {
  productBase64s: string[];
  referenceBase64s?: string[]; // Optional for scene, array
  modelBase64?: string; // Optional for scene
  scenePrompt: string;
  aspectRatio: AspectRatio;
  feedback?: string;
  feedbackReferenceBase64s?: string[];
  feedbackRegion?: Region;
}

export const generateSceneImage = async (params: SceneGenerationParams): Promise<string> => {
  let promptText = `
    You are a luxury product photographer.
    Category: ${params.category || 'Jewelry'}.
    Task: Create a creative commercial scene for the JEWELRY PRODUCT.
    
    Scene Description: ${params.scenePrompt}
    
    Inputs:
    1. Product Image(s).
    ${params.referenceBase64s?.length ? '2. Real Reference (for scale/material context).' : ''}
    ${params.modelBase64 ? '3. Specific Model (to be placed in scene).' : ''}

    ${params.instructions ? `**USER PRECAUTIONS**: ${params.instructions}` : ''}

    Instructions:
    - If a model is requested in the prompt but no model image provided, generate a suitable AI model.
    - If no model is requested, focus on a still-life product shot in the described environment.
    - Lighting: Commercial high-end luxury lighting.
  `;

  if (params.feedback) {
     promptText += `\n**CORRECTION REQUEST**: ${params.feedback}`;
     if (params.feedbackRegion) {
        promptText += `
        **TARGET REGION**: 
        Focus changes strictly within:
        Top: ${params.feedbackRegion.y}%, Left: ${params.feedbackRegion.x}%
        Width: ${params.feedbackRegion.width}%, Height: ${params.feedbackRegion.height}%
        `;
     }
  }

  const parts: any[] = [{ text: promptText }];
  params.productBase64s.forEach(base64 => {
    parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
  });
  if (params.referenceBase64s) {
    params.referenceBase64s.forEach(base64 => {
      parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
    });
  }
  if (params.modelBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(params.modelBase64) } });
  }
  if (params.feedbackReferenceBase64s) {
    params.feedbackReferenceBase64s.forEach(base64 => {
      parts.push({ inlineData: { mimeType: 'image/png', data: stripBase64(base64) } });
    });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  return await callImageModel(ai, parts, params.aspectRatio, params.resolution);
};

// Common execution function
async function callImageModel(ai: GoogleGenAI, parts: any[], aspectRatio: AspectRatio, resolution: ImageResolution): Promise<string> {
  const operation = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution // '2K' or '4K'
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from API");
  };

  try {
    // Retry up to 5 times with exponential backoff starting at 4s
    return await retryOperation(operation, 5, 4000);
  } catch (error) {
    console.error("Image generation failed after retries:", error);
    throw error;
  }
}
