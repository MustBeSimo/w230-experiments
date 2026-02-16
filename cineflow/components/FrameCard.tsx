
import React, { useRef } from 'react';
import { FrameSpec, ImageModel, VideoModel } from '../types';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';

interface FrameCardProps {
  frame: FrameSpec;
  fIdx: number;
  selectedFrameIndices: Set<number>;
  isPortrait: boolean;
  generatingPromptFor: boolean;
  actions: {
    toggleFrameSelection: (idx: number) => void;
    updateFrameModel: (idx: number, model: ImageModel) => void;
    setCandidateCount: (idx: number, count: number) => void;
    removeFrame: (idx: number) => void;
    updateFrameRaw: (idx: number, val: string) => void;
    generateFrameImages: (idx: number) => void;
    selectImageForTransition: (frameIdx: number, imgIdx: number) => void;
    setEditingImage: (val: { frameIdx: number, imgIdx: number }) => void;
    uploadImage: (files: FileList | null) => void;
    // Motion actions
    handleGenFramePrompt: () => void;
    updateFrameVideoPrompt: (v: string) => void;
    updateFrameVideoModel: (m: VideoModel) => void;
    generateFrameVideo: () => void;
  };
}

export const FrameCard: React.FC<FrameCardProps> = ({
  frame,
  fIdx,
  selectedFrameIndices,
  isPortrait,
  generatingPromptFor,
  actions
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCarouselItemClass = () => {
    return isPortrait ? 'w-[60%] md:w-[35%] xl:w-[25%]' : 'w-[80%] md:w-[45%] xl:w-[35%]';
  };

  const renderModelBadge = (modelId: ImageModel) => {
    if (modelId === 'custom-upload') return 'User Upload';
    return modelId.includes('pro') ? 'Gemini 3 Pro' : '2.5 Flash';
  };

  const masterImage = frame.images[frame.selectedImageIndex];

  return (
    <div className="relative group/card">
      {/* Timeline line */}
      <div className="absolute left-7 top-24 bottom-0 w-px bg-beige-300 -z-10 group-last/card:hidden"></div>

      <div className="flex gap-8 items-start">
        {/* Step Indicator */}
        <div className="flex flex-col items-center gap-4 pt-4 sticky top-24">
          <button
            onClick={() => actions.toggleFrameSelection(fIdx)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-serif font-black border-2 transition-all shadow-lg hover:scale-105 active:scale-95 ${selectedFrameIndices.has(fIdx) ? 'bg-terracotta border-terracotta text-white shadow-terracotta/30' : 'bg-white border-beige-300 text-beige-400 hover:border-terracotta hover:text-terracotta'}`}
            title="Select/deselect this frame for batch operations"
          >
            {fIdx + 1}
          </button>
        </div>

        <div className="flex-1 space-y-8">
          {/* Header / Definition UI */}
          <div className={`bg-white border rounded-[2.5rem] p-8 space-y-6 shadow-sm transition-all ${selectedFrameIndices.has(fIdx) ? 'border-terracotta ring-1 ring-terracotta/10 shadow-terracotta/10' : 'border-beige-300'}`}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-xs font-black uppercase text-terracotta tracking-[0.2em]">Keyframe Definition</h3>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-beige-100 rounded-lg p-1 border border-beige-300 shadow-sm">
                  <button
                    onClick={() => actions.updateFrameModel(fIdx, 'gemini-3-pro-image-preview')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${frame.imageModel === 'gemini-3-pro-image-preview' ? 'bg-white shadow-sm text-terracotta' : 'text-beige-500 hover:text-terracotta'}`}
                    title="Use Gemini 3 Pro for higher quality image generation"
                  >Gemini 3 Pro</button>
                  <button
                    onClick={() => actions.updateFrameModel(fIdx, 'gemini-2.5-flash-image')}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${frame.imageModel === 'gemini-2.5-flash-image' ? 'bg-white shadow-sm text-terracotta' : 'text-beige-500 hover:text-terracotta'}`}
                    title="Use Gemini 2.5 Flash for faster image generation"
                  >2.5 Flash</button>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 bg-beige-100 border border-beige-300 rounded-lg">
                  <span className="text-[10px] font-bold uppercase text-beige-400 mr-1">Candidates</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => actions.setCandidateCount(fIdx, n)}
                        className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all ${frame.candidateCount === n ? 'bg-terracotta text-white shadow-md' : 'text-beige-500 hover:text-terracotta'}`}
                        title={`Generate ${n} image candidate${n > 1 ? 's' : ''}`}
                      > {n} </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => actions.generateFrameImages(fIdx)}
                    disabled={frame.status === 'generating'}
                    className="w-10 h-10 flex items-center justify-center bg-terracotta text-white rounded-xl shadow-lg shadow-terracotta/20 hover:bg-terracotta-hover transition-all disabled:opacity-50"
                    title="Render Candidates"
                  >
                    {frame.status === 'generating' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center text-beige-400 hover:text-terracotta transition-colors bg-beige-100 hover:bg-white rounded-xl border border-beige-300" title="Upload Reference"><i className="fa-solid fa-upload"></i></button>
                  <input type="file" ref={fileInputRef} onChange={(e) => actions.uploadImage(e.target.files)} accept="image/*" hidden />
                  <button onClick={() => actions.removeFrame(fIdx)} className="w-10 h-10 flex items-center justify-center text-beige-400 hover:text-rose-500 transition-colors" title="Delete this frame"><i className="fa-solid fa-trash"></i></button>
                </div>
              </div>
            </div>

            <textarea
              value={frame.raw}
              onChange={e => actions.updateFrameRaw(fIdx, e.target.value)}
              placeholder="Describe your scene here... Be specific about lighting, camera angle, and textures."
              className="w-full bg-transparent text-2xl font-serif text-beige-900 placeholder-beige-300 outline-none resize-none min-h-[140px] leading-snug"
            />

            {frame.status === 'generating' && (
              <div className="pt-4 border-t border-beige-100">
                <ProgressBar progress={frame.images.find(img => img.status === 'generating')?.progress || 10} label="Orchestrating Visuals..." />
              </div>
            )}
          </div>

          {/* Candidates Carousel */}
          {frame.images.length > 0 && (
            <div className="space-y-10">
              <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-hide">
                {frame.images.map((img, iIdx) => (
                  <div key={img.id} className={`flex-shrink-0 snap-center ${getCarouselItemClass()} group/img relative rounded-[2rem] overflow-hidden border-2 transition-all shadow-md ${frame.selectedImageIndex === iIdx ? 'border-terracotta ring-4 ring-terracotta/10' : 'border-beige-200 hover:border-beige-400'}`}>
                    <div className={`${isPortrait ? 'aspect-[9/16]' : 'aspect-video'} bg-beige-100 relative`}>
                      {img.status === 'generating' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 bg-white/40 backdrop-blur-sm">
                          <div className="w-12 h-12 border-4 border-terracotta border-t-transparent rounded-full animate-spin"></div>
                          <div className="w-full max-w-[120px]">
                            <ProgressBar progress={img.progress || 0} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <img src={img.url} className="w-full h-full object-cover transition-transform duration-1000 group-hover/img:scale-105" />
                          {img.status === 'completed' && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4 p-8 backdrop-blur-md">
                              <Button onClick={() => actions.selectImageForTransition(fIdx, iIdx)} variant="ghost" className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs ${frame.selectedImageIndex === iIdx ? '!bg-white !text-terracotta' : '!bg-white/20 !text-white'}`} title={frame.selectedImageIndex === iIdx ? 'This is the active master image' : 'Set this image as the master for video generation'}> {frame.selectedImageIndex === iIdx ? 'Active Master' : 'Set as Master'} </Button>
                              <div className="flex gap-2 w-full">
                                <Button onClick={() => actions.setEditingImage({ frameIdx: fIdx, imgIdx: iIdx })} variant="ghost" className="flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-xs text-white border border-white/20 hover:bg-white/10" title="Apply AI-powered refinements to this image"> AI Refine </Button>
                                <a
                                  href={img.url}
                                  download={`cineflow-frame-${fIdx + 1}-v${iIdx + 1}.jpg`}
                                  className="flex-shrink-0 w-12 h-12 bg-white/20 hover:bg-terracotta text-white rounded-xl flex items-center justify-center transition-all border border-white/20"
                                  title="Download Image"
                                >
                                  <i className="fa-solid fa-download"></i>
                                </a>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest"> {renderModelBadge(img.modelId)} </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Motion Directing Block */}
              <div className="bg-white border border-beige-300 rounded-[2.5rem] p-8 flex flex-col xl:flex-row gap-10 shadow-sm transition-all hover:shadow-md">
                <div className="flex-1 space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase text-terracotta tracking-[0.2em] flex items-center gap-3"> <i className="fa-solid fa-clapperboard"></i> Cinematic Motion (Direct Clip) </h4>
                    <div className="flex gap-1.5 bg-beige-100 rounded-lg p-1 border border-beige-300">
                      <button onClick={() => actions.updateFrameVideoModel('veo-3.1-fast-generate-preview')} className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-md transition-all ${frame.videoModel?.includes('fast') ? 'bg-terracotta text-white shadow-sm' : 'text-beige-400'}`} title="Use Veo Fast model for quicker video generation">Fast</button>
                      <button onClick={() => actions.updateFrameVideoModel('veo-3.1-generate-preview')} className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-md transition-all ${!frame.videoModel?.includes('fast') ? 'bg-terracotta text-white shadow-sm' : 'text-beige-400'}`} title="Use Veo Premium model for higher quality video generation">Premium</button>
                    </div>
                  </div>

                  <div className="relative">
                    <button onClick={actions.handleGenFramePrompt} disabled={generatingPromptFor} className="absolute -top-3 right-4 bg-white px-3 text-[10px] font-black uppercase text-terracotta hover:text-terracotta-hover transition-colors flex items-center gap-2 border border-beige-200 rounded-full shadow-sm" title="Generate an AI-optimized motion prompt based on your scene description"> {generatingPromptFor ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} AI Direct </button>
                    <textarea
                      value={frame.videoPrompt} onChange={e => actions.updateFrameVideoPrompt(e.target.value)}
                      className="w-full bg-beige-50 border border-beige-200 rounded-2xl px-6 py-5 text-base font-serif italic outline-none resize-none shadow-inner text-beige-800" rows={3}
                      placeholder="Describe the specific camera flight and motion for this keyframe..."
                    />
                  </div>

                  <Button onClick={actions.generateFrameVideo} disabled={frame.videoStatus === 'generating' || !masterImage} className="w-full rounded-2xl py-5 text-xs font-black uppercase tracking-widest shadow-xl shadow-terracotta/10" title="Generate a standalone video clip from this frame's master image">
                    {frame.videoStatus === 'generating' ? <><i className="fa-solid fa-spinner animate-spin mr-2"></i> Synthesizing Vision...</> : <><i className="fa-solid fa-bolt mr-2"></i> Synthesize Independent Clip</>}
                  </Button>
                </div>

                <div className={`xl:w-[360px] ${isPortrait ? 'aspect-[9/16]' : 'aspect-video'} bg-neutral-900 rounded-[1.5rem] overflow-hidden border-4 border-white shadow-2xl flex items-center justify-center relative transition-transform hover:scale-[1.02] duration-500`}>
                  {frame.videoStatus === 'completed' ? (
                    <div className="relative w-full h-full group/clip">
                      <video src={frame.videoUrl} className="w-full h-full object-cover" controls loop muted autoPlay />
                      <a
                        href={frame.videoUrl}
                        download={`cineflow-clip-f${fIdx + 1}.mp4`}
                        className="absolute top-4 right-4 w-12 h-12 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-terracotta transition-all z-20 shadow-lg"
                        title="Save Video"
                      >
                        <i className="fa-solid fa-download"></i>
                      </a>
                    </div>
                  ) : frame.videoStatus === 'generating' ? (
                    <div className="w-full px-10 flex flex-col items-center gap-6">
                      <div className="w-12 h-12 border-4 border-terracotta border-t-transparent rounded-full animate-spin"></div>
                      <ProgressBar progress={frame.videoProgress || 0} label="Developing Motion" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-white/20">
                      <i className="fa-solid fa-film text-5xl"></i>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Instruction</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
