
export enum PipelineStatus {
  IDLE = 'IDLE',
  PROMPTING = 'PROMPTING',
  PRODUCTION = 'PRODUCTION',
  ERROR = 'ERROR'
}

export type ImageModel = 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image' | 'custom-upload';
export type VideoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';
export type AspectRatio = '16:9' | '9:16';
export type NarrativeMode = 'story' | 'montage';
export type TransitionType = 'bridge' | 'standalone';

export interface FrameImage {
  id: string;
  url: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  modelId: ImageModel;
  progress?: number; // 0-100
}

export interface FrameSpec {
  index: number;
  raw: string;
  structuredPrompt?: string;
  images: FrameImage[];
  selectedImageIndex: number;
  candidateCount: number;
  status: 'idle' | 'generating' | 'completed' | 'error';
  imageModel: ImageModel;
  // Motion support for single-frame animation
  videoUrl?: string;
  videoStatus?: 'idle' | 'generating' | 'completed' | 'error';
  videoProgress?: number;
  videoPrompt?: string;
  videoModel?: VideoModel;
}

export interface TransitionSpec {
  fromIndex: number;
  toIndex: number;
  type: TransitionType;
  directorPrompt?: string;
  videoUrl?: string;
  modelId: VideoModel;
  status: 'idle' | 'generating' | 'completed' | 'error';
  progress?: number;
}

export interface CharacterSpec {
  name: string;
  description: string;
  images?: string[]; // Base64 data URIs
}

export interface ClipPlan {
  title: string;
  aspectRatio: AspectRatio;
  narrativeMode: NarrativeMode;
  globalConstraints: {
    continuityRules: string[];
    paletteNotes: string;
    doNotInclude: string[];
    characters?: CharacterSpec[];
  };
  frames: FrameSpec[];
  transitionPolicy: {
    mode: 'simple' | 'director';
    durationSeconds: number;
  };
}

export interface AppState {
  status: PipelineStatus;
  plan: ClipPlan;
  transitions: TransitionSpec[];
  error?: string;
  currentTask?: string;
}
