
import React from 'react';
import { TransitionSpec, VideoModel, TransitionType } from '../types';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';

interface TransitionCardProps {
  transition: TransitionSpec;
  fIdx: number;
  isPortrait: boolean;
  generatingPromptFor: number | null;
  isSelected: boolean;
  onToggleSelect: () => void;
  actions: {
    updateTransitionModel: (idx: number, model: VideoModel) => void;
    updateTransitionType: (idx: number, type: TransitionType) => void;
    updateDirectorPrompt: (idx: number, val: string) => void;
    handleGenerateTransitionPrompt: (idx: number) => void;
    generateSingleVideo: (idx: number) => void;
  };
}

export const TransitionCard: React.FC<TransitionCardProps> = ({
  transition,
  fIdx,
  isPortrait,
  generatingPromptFor,
  isSelected,
  onToggleSelect,
  actions
}) => {
  return (
    <div className="pl-[5.5rem] py-12">
      <div className={`bg-beige-200/50 border rounded-[2.5rem] p-8 flex flex-col xl:flex-row gap-12 transition-colors group/trans shadow-sm ${isSelected ? 'border-terracotta bg-beige-200 ring-1 ring-terracotta/20' : 'border-beige-300 hover:bg-beige-200'}`}>
        <div className="flex-1 space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-beige-500 tracking-[0.2em] flex items-center gap-3">
              {transition.type === 'bridge' ? (
                <><i className="fa-solid fa-link"></i> Connecting Frame {fIdx + 1} & {fIdx + 2}</>
              ) : (
                <><i className="fa-solid fa-clapperboard"></i> Standalone Clip (Frame {fIdx + 1})</>
              )}
            </span>
            <div className="flex gap-4">
              {/* Mode Toggle */}
              <div className="flex gap-2 bg-white rounded-lg p-1 border border-beige-300 shadow-sm">
                <button
                  onClick={() => actions.updateTransitionType(fIdx, 'bridge')}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-md transition-all ${transition.type === 'bridge' ? 'bg-terracotta text-white' : 'text-beige-400 hover:text-terracotta'}`}
                  title="Morph Frame A into Frame B"
                >
                  Bridge
                </button>
                <button
                  onClick={() => actions.updateTransitionType(fIdx, 'standalone')}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-md transition-all ${transition.type === 'standalone' ? 'bg-terracotta text-white' : 'text-beige-400 hover:text-terracotta'}`}
                  title="Animate Frame A only (Cut to cut)"
                >
                  Animate
                </button>
              </div>
              {/* Model Toggle */}
              <div className="flex gap-2 bg-white rounded-lg p-1 border border-beige-300 shadow-sm">
                <button
                  onClick={() => actions.updateTransitionModel(fIdx, 'veo-3.1-fast-generate-preview')}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-md transition-all ${transition.modelId.includes('fast') ? 'bg-terracotta text-white' : 'text-beige-500 hover:text-terracotta'}`}
                >
                  Veo Fast
                </button>
                <button
                  onClick={() => actions.updateTransitionModel(fIdx, 'veo-3.1-generate-preview')}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-md transition-all ${!transition.modelId.includes('fast') ? 'bg-terracotta text-white' : 'text-beige-500 hover:text-terracotta'}`}
                >
                  Veo Premium
                </button>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="flex justify-between items-end mb-2">
              <label className="absolute -top-3 left-4 bg-beige-200 px-2 text-[10px] font-bold uppercase text-terracotta tracking-widest">Director Prompt</label>
              <div className="flex-1"></div>
              <button
                onClick={() => actions.handleGenerateTransitionPrompt(fIdx)}
                disabled={generatingPromptFor === fIdx}
                className="text-[10px] font-bold uppercase text-beige-500 hover:text-terracotta transition-colors flex items-center gap-2"
                title="Generate an AI-optimized director prompt for this transition"
              >
                {generatingPromptFor === fIdx ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                AI Write
              </button>
            </div>
            <textarea
              value={transition.directorPrompt}
              onChange={e => actions.updateDirectorPrompt(fIdx, e.target.value)}
              className="w-full bg-white border border-beige-300 rounded-2xl px-6 py-5 text-lg font-serif italic text-beige-900 focus:ring-2 focus:ring-terracotta/20 focus:border-terracotta outline-none resize-none shadow-sm"
              rows={3}
            />
          </div>
          <Button
            onClick={() => actions.generateSingleVideo(fIdx)}
            disabled={transition.status === 'generating'}
            className="w-full rounded-xl py-4 text-xs font-black uppercase tracking-widest"
            title="Generate video for this transition using the director prompt"
          >
            {transition.status === 'generating' ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Synthesize Video'}
          </Button>
        </div>

        <div className={`w-full ${isPortrait ? 'xl:w-[320px] aspect-[9/16]' : 'xl:w-[480px] aspect-video'} bg-black rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl flex items-center justify-center relative transition-all duration-300`}>
          {transition.status === 'completed' ? (
            <div className="relative w-full h-full group/vid">
              {/* Selection Overlay */}
              <div className="absolute top-4 left-4 z-30">
                <button
                  onClick={onToggleSelect}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-lg ${isSelected ? 'bg-terracotta border-terracotta text-white' : 'bg-black/50 border-white/50 text-transparent hover:border-white hover:bg-black/70'}`}
                  title="Select this video to include in stitched compilation"
                >
                  <i className="fa-solid fa-check text-sm"></i>
                </button>
              </div>

              <video src={transition.videoUrl} className="w-full h-full object-contain" controls loop muted autoPlay />
              <a
                href={transition.videoUrl}
                download={`video-transition-${fIdx + 1}-to-${fIdx + 2}.mp4`}
                className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur text-white rounded-full flex items-center justify-center hover:bg-terracotta transition-colors z-20"
                title="Save Video"
              >
                <i className="fa-solid fa-download"></i>
              </a>
            </div>
          ) : transition.status === 'generating' ? (
            <div className="flex flex-col items-center gap-4 w-2/3">
              <div className="w-12 h-12 border-4 border-terracotta border-t-transparent rounded-full animate-spin"></div>
              <ProgressBar progress={transition.progress || 0} label="Synthesizing" />
            </div>
          ) : (
            <div className="text-xs font-bold text-neutral-700 uppercase flex flex-col items-center gap-3">
              <i className="fa-solid fa-film text-4xl opacity-20"></i>
              <span>Awaiting Synthesis</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
