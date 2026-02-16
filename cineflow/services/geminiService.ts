
import { GoogleGenAI, Type } from "@google/genai";
import { ClipPlan, FrameSpec, AspectRatio, ImageModel, VideoModel, NarrativeMode, TransitionType } from "../types";
import { resizeImage } from "./videoUtils";

const FAL_API_KEY = process.env.FAL_API_KEY;

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found in environment.");
  return new GoogleGenAI({ apiKey });
};

const cleanJson = (text: string | undefined): string => {
  if (!text) return "{}";
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

const CINEMATIC_REALISM_PROMPT = "STRICT ART DIRECTION: Focus on grounded, realistic cinematography. Use natural lighting, professional film stocks (Arri Alexa, Red V-Raptor looks), and realistic physics. AVOID all fantasy, magic, or sci-fi visual effects (glows, sparkles, holograms, unprompted neon, magical particles) unless the user specifically requests them. The result must look like a real, high-budget cinematic production.";

const toInlineData = (base64: string) => {
  // Robust handling for data URIs
  if (!base64.includes(',')) return { inlineData: { mimeType: 'image/jpeg', data: base64 } };
  const [header, data] = base64.split(',');
  const mimeType = header.split(';')[0].split(':')[1] || 'image/jpeg';
  return { inlineData: { mimeType, data } };
};

/**
 * Generic Fal.ai Caller with Polling for Long Running Tasks (Video)
 * Docs: https://docs.fal.ai/model-apis
 */
async function callFalAI(endpoint: string, payload: any): Promise<any> {
  // Detect if this is a video generation task which requires Queue API
  const isVideo = endpoint.includes('veo') || endpoint.includes('video') || endpoint.includes('movie') || endpoint.includes('minimax') || endpoint.includes('kling') || endpoint.includes('luma');
  const subdomain = isVideo ? 'queue' : 'fal';

  // Clean endpoint to prevent double slashes
  const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
  const url = `https://${subdomain}.fal.run/${cleanEndpoint}`;

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    credentials: 'omit'
  };

  // 1. Submit Request
  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (e) {
    // Retry once for transient network errors (Load failed)
    console.warn("Fal.ai initial connection failed, retrying...", e);
    try {
      await new Promise(r => setTimeout(r, 2000));
      response = await fetch(url, fetchOptions);
    } catch (retryErr) {
      throw new Error(`Fal.ai connection failed: ${(retryErr as Error).message}`);
    }
  }

  if (!response || !response.ok) {
    const errText = response ? await response.text() : "Network Error";
    throw new Error(`Fal.ai Error (${response?.status || 0}): ${errText}`);
  }

  const data = await response.json();

  // If synchronous response (images/text) or immediate result, return.
  if (!isVideo) return data;

  // For Video (Queue), we get a request_id and must poll.
  const requestId = data.request_id;
  // Prefer the status URL provided by the API, fallback to manual construction
  const statusUrl = data.status_url || `https://queue.fal.run/${cleanEndpoint}/requests/${requestId}/status`;

  if (!requestId && !data.status_url) return data; // Fallback if API returned result immediately

  // Polling Loop
  const startTime = Date.now();
  const timeoutMs = 1200000; // 20 Minutes (Video gen can be slow)
  let consecutiveErrors = 0;

  // Initial wait to allow server propagation
  await new Promise(r => setTimeout(r, 1000));

  while (Date.now() - startTime < timeoutMs) {
    // Exponential backoff for polling interval
    const interval = Math.min(10000, 2000 + (consecutiveErrors * 1000));
    await new Promise(r => setTimeout(r, interval));

    let statusRes;
    try {
      statusRes = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Accept': 'application/json'
        },
        credentials: 'omit',
        cache: 'no-store'
      });
      consecutiveErrors = 0; // Reset on successful network call
    } catch (e) {
      console.warn(`Fal polling transient error (${consecutiveErrors + 1}/30):`, e);
      consecutiveErrors++;
      // Significantly increased tolerance for "Load failed" to 30 retries
      // If "Load failed" happens, it might be temporary network blip or browser throttling
      if (consecutiveErrors >= 30) {
        throw new Error("Fal.ai polling connection lost (Too many network errors).");
      }
      continue;
    }

    if (!statusRes.ok) {
      if (statusRes.status === 504 || statusRes.status === 404 || statusRes.status === 502 || statusRes.status === 503) {
        // Gateway Timeout / Bad Gateway / Not Found / Service Unavailable
        // Just wait and retry
        continue;
      }
      throw new Error(`Fal.ai Status Error: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();

    if (statusData.status === 'COMPLETED') {
      // Fetch final result from response_url
      const resultUrl = statusData.response_url;
      if (!resultUrl) {
        if (statusData.logs) console.log("Fal Logs:", statusData.logs);
        // Sometimes Fal returns the result directly in status for certain models
        if (statusData.video || statusData.images) return statusData;
        return statusData;
      }

      try {
        // CRITICAL FIX: Fetch result WITHOUT headers to avoid CORS/Signature errors on signed URLs
        const finalRes = await fetch(resultUrl);
        if (!finalRes.ok) throw new Error("Failed to load result JSON");
        return await finalRes.json();
      } catch (e) {
        console.error("Fal result fetch failed", e);
        // Some models return the result payload directly at response_url, others return JSON.
        // If JSON parse fails, maybe it's the file itself?
        // But typically Fal returns a JSON wrapper.
        return statusData;
      }
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`Fal.ai processing failed: ${statusData.error || 'Unknown error'}`);
    }

    // IN_QUEUE or IN_PROGRESS -> Continue loop
  }

  throw new Error("Fal.ai processing timed out.");
}

export async function searchVisualTrends(query: string): Promise<string> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [{
        text: `Research professional filmic references and real-world high-end advertising aesthetics for: "${query}". 
        GOAL: Provide a "Cinematic Visual Recipe" for an AI image generator.
        1. Search for real photography/film trends.
        2. Describe COLOR PALETTE precisely.
        3. Describe LIGHTING SETUP.
        4. Describe CAMERA GEAR.
        5. ${CINEMATIC_REALISM_PROMPT}
        Provide the response as a professional DP briefing.`
      }]
    },
    config: { tools: [{ googleSearch: {} }] }
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  let extraLinks = "";
  chunks.forEach((chunk: any) => {
    if (chunk.web?.uri && chunk.web?.title) {
      extraLinks += `\n- [Ref: ${chunk.web.title}](${chunk.web.uri})`;
    }
  });

  return `### DP BRIEFING: VISUAL TRENDS\n\n${response.text?.trim() || "No results."}${extraLinks ? "\n\n**Reference Sources:**" + extraLinks : ""}`;
}

export async function generateSearchGroundedReferences(query: string, count: number = 2): Promise<string[]> {
  const ai = getAIClient();
  const generateOne = async (idx: number) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{
            text: `Professional cinematic reference photography for: "${query}". Variation ${idx + 1}. ${CINEMATIC_REALISM_PROMPT}`
          }]
        },
        config: {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
          tools: [{ googleSearch: {} }]
        }
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    } catch (e: any) {
      if (e.message?.includes("429") || e.message?.toLowerCase().includes("quota") || e.message?.includes("Load failed")) {
        try {
          const result = await callFalAI("fal-ai/imagen3", {
            prompt: `Professional cinematic reference photography for: "${query}". Variation ${idx + 1}. ${CINEMATIC_REALISM_PROMPT}`,
            aspect_ratio: "1:1"
          });
          return result.images?.[0]?.url || null;
        } catch (falErr) {
          console.warn("Fal fallback failed", falErr);
          return null;
        }
      }
    }
    return null;
  };
  const images = await Promise.all(Array.from({ length: count }).map((_, i) => generateOne(i)));
  return images.filter(img => img !== null) as string[];
}

export async function generateProjectPlan(
  concept: string,
  frameCount: number,
  referenceImages: string[] = [],
  existingPlan?: ClipPlan
): Promise<Partial<ClipPlan>> {
  const ai = getAIClient();
  const narrativeMode = existingPlan?.narrativeMode || 'story';

  // Resize reference images for plan generation to avoid huge payloads
  const optimizedRefs = await Promise.all(referenceImages.map(img => resizeImage(img, 1024)));
  const parts: any[] = optimizedRefs.map(img => toInlineData(img));

  if (parts.length > 0) parts.push({ text: "Visual style references." });

  const chars = existingPlan?.globalConstraints?.characters || [];
  for (const char of chars) {
    if (char.images) {
      const optCharImages = await Promise.all(char.images.map(img => resizeImage(img, 1024)));
      optCharImages.forEach(img => parts.push(toInlineData(img)));
    }
    parts.push({ text: `Entity Ref: ${char.name}` });
  }

  const systemPrompt = `Act as a Director. Concept: "${concept}". Mode: ${narrativeMode}. ${CINEMATIC_REALISM_PROMPT}`;

  const promptText = `
    ${systemPrompt}
    Frame Count: ${frameCount}
    Style Preference: "${existingPlan?.globalConstraints?.paletteNotes || ''}"
    Return JSON matching the schema.
  `;

  parts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            globalConstraints: {
              type: Type.OBJECT,
              properties: {
                paletteNotes: { type: Type.STRING },
                continuityRules: { type: Type.ARRAY, items: { type: Type.STRING } },
                characters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { name: { type: Type.STRING }, description: { type: Type.STRING } },
                    required: ['name', 'description']
                  }
                }
              },
              required: ['paletteNotes', 'continuityRules']
            },
            frames: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { raw: { type: Type.STRING } }, required: ['raw'] }
            }
          },
          required: ['title', 'globalConstraints', 'frames']
        }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (e: any) {
    if (e.message?.includes("429") || e.message?.toLowerCase().includes("quota") || e.message?.includes("Load failed")) {
      const result = await callFalAI("fal-ai/any-llm", {
        prompt: promptText + "\nIMPORTANT: Return ONLY valid JSON.",
        model: "gemini-1.5-pro",
      });
      const text = result.output || result.data;
      return JSON.parse(cleanJson(text));
    }
    throw e;
  }
}

export async function generateKeyframeImage(
  basePrompt: string,
  aspectRatio: AspectRatio,
  modelId: ImageModel,
  candidateIndex: number = 0,
  totalCandidates: number = 1,
  referenceImages: string[] = []
): Promise<string> {
  const variations = ["Cinematic wide", "Dynamic medium", "Intimate close-up", "Low-angle heroic", "Abstract macro"];
  const finalPrompt = (totalCandidates > 1 ? `${basePrompt} (${variations[candidateIndex % variations.length]})` : basePrompt) + " " + CINEMATIC_REALISM_PROMPT;

  try {
    const ai = getAIClient();
    const config: any = { imageConfig: { aspectRatio: aspectRatio as any } };
    if (modelId === 'gemini-3-pro-image-preview') config.imageConfig.imageSize = "1K";

    const parts: any[] = [];

    // OPTIMIZE REFERENCE IMAGES: Resize to max 1024px to ensure payload stays within API limits
    const optimizedRefs = await Promise.all(referenceImages.map(img => resizeImage(img, 1024)));

    if (modelId === 'gemini-3-pro-image-preview') {
      parts.push({ text: finalPrompt });
      optimizedRefs.forEach(img => parts.push(toInlineData(img)));
    } else {
      optimizedRefs.forEach(img => parts.push(toInlineData(img)));
      parts.push({ text: finalPrompt });
    }

    const response = await ai.models.generateContent({ model: modelId, contents: { parts }, config });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imgPart?.inlineData) return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
    throw new Error("Generation failed.");
  } catch (err: any) {
    if (err.message?.includes("429") || err.message?.toLowerCase().includes("quota") || err.message?.includes("Load failed")) {
      console.log("Quota hit or Network Error. Falling back to Fal.ai Imagen3...");
      const result = await callFalAI("fal-ai/imagen3", {
        prompt: finalPrompt,
        aspect_ratio: aspectRatio,
        image_size: "landscape_4_3",
      });
      return result.images?.[0]?.url;
    }
    throw err;
  }
}

export async function describeImage(base64: string): Promise<string> {
  const ai = getAIClient();
  // Resize input for description to save bandwidth
  const optimized = await resizeImage(base64, 1024);
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        toInlineData(optimized),
        { text: "Describe this image for a film storyboard. Use realistic cinematography terminology. Single paragraph." }
      ]
    }
  });
  return (response.text?.trim() || "").replace(/\*\*[^*]+?\*\*[:]?\s*/g, "");
}

export async function generateDirectorPrompt(
  fromFrame: FrameSpec,
  toFrame?: FrameSpec,
  plan?: ClipPlan,
  type: TransitionType = 'bridge'
): Promise<string> {
  const ai = getAIClient();
  const parts: any[] = [];

  const styleContext = plan ? `Project Style: ${plan.globalConstraints.paletteNotes}.` : "";
  const taskDesc = toFrame && type === 'bridge'
    ? "Create a smart cinematic interpolation bridge between Scene A and Scene B. Describe the camera movement and physical flow."
    : "Animate this scene into a high-impact 5-second cinematic clip. Focus on internal motion, environmental effects (smoke, light shifts), and subtle camera movement.";

  parts.push({
    text: `
    Act as a Professional Film Director.
    ${styleContext}
    Scene A: ${fromFrame.raw}
    ${toFrame ? `Scene B: ${toFrame.raw}` : ""}
    
    Task: ${taskDesc}
    ${CINEMATIC_REALISM_PROMPT}
    Return ONLY the final prompt for the video synthesis engine.
  `});

  const appendImg = async (frame: FrameSpec, label: string) => {
    const img = frame.images[frame.selectedImageIndex];
    if (img?.url.startsWith('data:')) {
      parts.push({ text: `${label}:` });
      const optimized = await resizeImage(img.url, 1024);
      parts.push(toInlineData(optimized));
    }
  };

  // We need to wait for async appends
  await appendImg(fromFrame, "START_FRAME");
  if (toFrame && type === 'bridge') await appendImg(toFrame, "END_FRAME");

  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts } });
  return response.text?.trim() || "Cinematic synthesis.";
}

export async function generateTransitionVideo(
  prompt: string,
  startImageBase64: string,
  endImageBase64?: string,
  aspectRatio: AspectRatio = '16:9',
  modelId: VideoModel = 'veo-3.1-fast-generate-preview',
  type: TransitionType = 'standalone',
  onProgress?: (progress: number) => void
): Promise<string> {
  if (onProgress) onProgress(5);

  // OPTIMIZE IMAGE PAYLOAD: Resize to max 1024px to ensure payload is safe for network
  const optimizedStartImage = await resizeImage(startImageBase64, 1024);
  const optimizedEndImage = endImageBase64 ? await resizeImage(endImageBase64, 1024) : undefined;

  try {
    const ai = getAIClient();
    const startData = optimizedStartImage.split(',')[1];
    const startMime = optimizedStartImage.split(';')[0].split(':')[1];

    let config: any = { numberOfVideos: 1, resolution: '720p', aspectRatio };
    if (type === 'bridge' && optimizedEndImage) {
      config.lastFrame = {
        imageBytes: optimizedEndImage.split(',')[1],
        mimeType: optimizedEndImage.split(';')[0].split(':')[1]
      };
    }

    let operation = await ai.models.generateVideos({
      model: modelId,
      prompt,
      image: { imageBytes: startData, mimeType: startMime },
      config
    });

    let attempts = 0;
    while (!operation.done) {
      if (attempts++ > 250) throw new Error("Synthesis Timed Out");
      await new Promise(r => setTimeout(r, 6000));
      if (onProgress) onProgress(Math.min(99, 5 + (attempts * 0.4)));

      const pollAi = getAIClient();
      operation = await pollAi.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Synthesis yielded no result.");

    const separator = downloadLink.includes('?') ? '&' : '?';
    const fetchUrl = `${downloadLink}${separator}key=${process.env.API_KEY}`;

    try {
      const videoResponse = await fetch(fetchUrl);
      if (!videoResponse.ok) throw new Error("Failed to download content");
      const blob = await videoResponse.blob();
      return URL.createObjectURL(blob);
    } catch (fetchErr) {
      console.warn("Blob fetch failed, falling back to direct URL", fetchErr);
      return fetchUrl;
    }

  } catch (err: any) {
    const msg = err.message || "";
    // Trigger fallback on standard errors including "Load failed" (Network Error)
    if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("exhausted") || msg.includes("Load failed") || msg.includes("Failed to fetch")) {
      console.log("Gemini Video failed (Quota/Network), switching to Fal.ai Veo 3.1 fallback...");
      if (onProgress) onProgress(15);

      // FALLBACK 1: VEO 3.1 (Fast or Premium)
      let falEndpoint = "fal-ai/veo3.1/image-to-video";
      if (modelId.includes("fast")) {
        falEndpoint = "fal-ai/veo3.1/fast/image-to-video";
      }

      try {
        const payload: any = {
          prompt,
          image_url: optimizedStartImage,
        };
        // Try to support end frame if present (Veo fallback)
        if (type === 'bridge' && optimizedEndImage) {
          payload.end_image_url = optimizedEndImage;
        }

        // Use optimized image for Fal too (Data URI)
        const result = await callFalAI(falEndpoint, payload);

        const videoUrl = result.video?.url || result.url;
        if (videoUrl) return videoUrl;
        throw new Error("No video URL in Fal response");
      } catch (veoErr) {
        console.error("Fal Veo fallback failed:", veoErr);
        // Re-throw to inform UI of failure, strictly no Minimax fallback as requested.
        throw new Error("Video synthesis failed on both Gemini and Veo backup.");
      }
    }
    throw err;
  }
}

export async function editImage(base64: string, instruction: string): Promise<string> {
  const systemInstruction = `You are an elite cinematic image editor. 
  Modification: "${instruction}".
  
  STRICT RULES:
  1. No fantasy/magic elements.
  2. Maintain original composition and subjects perfectly unless told to change.
  3. Clean up text/footers/overlays by replacing them with natural background texture.
  4. Ensure the lighting remains photorealistic.
  5. ${CINEMATIC_REALISM_PROMPT}
  
  Output the modified image.`;

  try {
    const ai = getAIClient();
    // Optimize input image for editing
    const optimized = await resizeImage(base64, 1024);

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [toInlineData(optimized), { text: systemInstruction }] },
      config: { imageConfig: { imageSize: "1K" } }
    });

    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imgPart?.inlineData) return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
    throw new Error("AI Refinement failed.");
  } catch (e: any) {
    if (e.message?.includes("429") || e.message?.toLowerCase().includes("quota") || e.message?.includes("Load failed")) {
      // Fallback optimizes internally or uses url
      const result = await callFalAI("fal-ai/imagen3", {
        prompt: systemInstruction,
        image_url: base64, // Fal can handle larger, but safer to use optimized if variable available (omitted for brevity)
        strength: 0.75
      });
      return result.images?.[0]?.url;
    }
    throw e;
  }
}
