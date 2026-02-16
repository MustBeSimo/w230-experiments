
import { GoogleGenAI, Type } from "@google/genai";
import React, { useState, useEffect, useRef } from 'react';
import { ClipPlan, TransitionSpec, FrameSpec, FrameImage, ImageModel, VideoModel, NarrativeMode, TransitionType } from './types';
import {
  generateProjectPlan,
  generateKeyframeImage,
  generateDirectorPrompt,
  generateTransitionVideo,
  editImage,
  describeImage,
  searchVisualTrends,
  generateSearchGroundedReferences
} from './services/geminiService';
import { stitchVideos, processImageFile } from './services/videoUtils';
import { Header } from './components/Header';
import { ProjectConcept } from './components/ProjectConcept';
import { FrameCard } from './components/FrameCard';
import { TransitionCard } from './components/TransitionCard';
import { EditImageModal } from './components/EditImageModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';

const App: React.FC = () => {
  const [plan, setPlan] = useState<ClipPlan>({
    title: "Untitled Project",
    aspectRatio: '16:9',
    narrativeMode: 'story',
    globalConstraints: { continuityRules: [], paletteNotes: "", doNotInclude: [], characters: [] },
    frames: Array(3).fill(null).map((_, i) => ({
      index: i + 1, raw: "", images: [], selectedImageIndex: 0, candidateCount: 1, status: 'idle', imageModel: 'gemini-3-pro-image-preview',
      videoStatus: 'idle', videoProgress: 0, videoPrompt: "Cinematic motion...", videoModel: 'veo-3.1-fast-generate-preview'
    })),
    transitionPolicy: { mode: 'director', durationSeconds: 2.5 }
  });

  const [transitions, setTransitions] = useState<TransitionSpec[]>([]);
  const [hasVeoAccess, setHasVeoAccess] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [productionStatus, setProductionStatus] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<{ frameIdx: number, imgIdx: number } | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [selectedFrameIndices, setSelectedFrameIndices] = useState<Set<number>>(new Set());
  const [generatingPromptFor, setGeneratingPromptFor] = useState<string | null>(null);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  const [masterConcept, setMasterConcept] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [draftFrameCount, setDraftFrameCount] = useState<number>(3);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showMoviePlayer, setShowMoviePlayer] = useState(false);
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);

  // A ref to keep track of the most up-to-date plan during production
  const planRef = useRef<ClipPlan>(plan);
  useEffect(() => { planRef.current = plan; }, [plan]);

  useEffect(() => {
    const checkVeo = async () => {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasVeoAccess(hasKey);
      } else {
        console.log("Running freely (no AI Studio context detected)");
        setHasVeoAccess(true);
      }
    };
    checkVeo();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
    setHasVeoAccess(true);
  };

  const handleQuotaError = () => {
    if (window.confirm("QUOTA EXHAUSTED: Video synthesis usually requires a GCP project with billing enabled. High-volume requests can trigger rate limits. Would you like to check billing status or select a different paid API key?")) {
      window.open("https://ai.google.dev/gemini-api/docs/billing", "_blank");
      handleSelectKey();
    }
  };

  useEffect(() => {
    ensureTransitions(plan.frames);
  }, [plan.frames.length]);

  const ensureTransitions = (frames: FrameSpec[]) => {
    setTransitions(prev => {
      const newTransitions = [...prev];
      if (newTransitions.length < frames.length - 1) {
        for (let i = newTransitions.length; i < frames.length - 1; i++) {
          newTransitions.push({
            fromIndex: i + 1,
            toIndex: i + 2,
            type: 'bridge',
            directorPrompt: "Cinematic transition...",
            status: 'idle',
            modelId: 'veo-3.1-fast-generate-preview',
            progress: 0
          });
        }
      } else if (newTransitions.length > frames.length - 1) {
        newTransitions.length = Math.max(0, frames.length - 1);
      }
      return newTransitions;
    });
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const filesToAdd = imageFiles.slice(0, 4 - referenceImages.length);
    for (const file of filesToAdd) {
      try {
        const processed = await processImageFile(file);
        setReferenceImages(prev => prev.length >= 4 ? prev : [...prev, processed]);
      } catch (e) { console.error(e); }
    }
  };

  const handleSearchInspiration = async () => {
    if (!masterConcept.trim()) return;
    setIsSearching(true);
    try {
      const [textBriefing, visualReferences] = await Promise.all([
        searchVisualTrends(masterConcept),
        generateSearchGroundedReferences(masterConcept, 2)
      ]);
      setPlan(p => ({ ...p, globalConstraints: { ...p.globalConstraints, paletteNotes: textBriefing } }));
      if (visualReferences.length > 0) {
        setReferenceImages(prev => [...prev, ...visualReferences].slice(0, 4));
      }
    } catch (e) {
      alert("Search-grounded inspiration failed.");
    } finally { setIsSearching(false); }
  };

  const handleMagicDraft = async () => {
    if (!masterConcept.trim()) return;
    setIsDrafting(true);
    try {
      const aiPlan = await generateProjectPlan(masterConcept, draftFrameCount, referenceImages, plan);
      const newFrames: FrameSpec[] = (aiPlan.frames || []).map((f: any, i: number) => ({
        index: i + 1, raw: f.raw, images: [], selectedImageIndex: 0, candidateCount: 1, status: 'idle', imageModel: 'gemini-3-pro-image-preview' as ImageModel,
        videoStatus: 'idle', videoProgress: 0, videoPrompt: "Cinematic motion...", videoModel: 'veo-3.1-fast-generate-preview' as VideoModel
      }));
      const updatedPlan = {
        ...plan,
        title: aiPlan.title || plan.title,
        globalConstraints: { ...plan.globalConstraints, ...aiPlan.globalConstraints },
        frames: newFrames
      };
      setPlan(updatedPlan);
      planRef.current = updatedPlan;
      return newFrames;
    } catch (err) {
      alert("Drafting failed.");
      return null;
    } finally {
      setIsDrafting(false);
    }
  };

  const generateFrameImages = async (frameIdx: number) => {
    const frame = planRef.current.frames[frameIdx];
    if (frame.status === 'generating') return null;
    if (frame.status === 'completed' && frame.images.length > 0) return frame.images[0].url;

    const placeholders: FrameImage[] = Array(frame.candidateCount).fill(null).map(() => ({
      id: crypto.randomUUID(), url: "", status: 'generating', modelId: frame.imageModel, progress: 5
    }));

    setPlan(prev => {
      const nf = [...prev.frames];
      nf[frameIdx] = { ...nf[frameIdx], status: 'generating', images: [...nf[frameIdx].images, ...placeholders] };
      return { ...prev, frames: nf };
    });

    const interval = setInterval(() => {
      setPlan(prev => {
        const up = [...prev.frames];
        const imgs = up[frameIdx].images.map(img =>
          img.status === 'generating' ? { ...img, progress: Math.min(95, (img.progress || 0) + 2) } : img
        );
        up[frameIdx] = { ...up[frameIdx], images: imgs };
        return { ...prev, frames: up };
      });
    }, 400);

    try {
      const charImages: string[] = [];
      (planRef.current.globalConstraints.characters || []).forEach(c => { if (c.images) charImages.push(...c.images); });
      const prompt = `STYLE: ${planRef.current.globalConstraints.paletteNotes}\n\nSCENE: ${frame.raw}`;
      const results = await Promise.all(
        Array.from({ length: frame.candidateCount }).map((_, i) =>
          generateKeyframeImage(prompt, planRef.current.aspectRatio, frame.imageModel, i, frame.candidateCount, [...referenceImages, ...charImages])
            .catch((e) => {
              if (e.message?.includes("QUOTA_EXHAUSTED")) throw e;
              return null;
            })
        )
      );
      clearInterval(interval);
      const newImages: FrameImage[] = results.map((url, i) => ({
        id: placeholders[i].id, url: url || "", status: url ? 'completed' : 'error' as any, modelId: frame.imageModel, progress: 100
      }));

      const updatedPlan = { ...planRef.current };
      const finalF = [...updatedPlan.frames];
      const currentImages = [...finalF[frameIdx].images];
      placeholders.forEach((p, idx) => {
        const foundIdx = currentImages.findIndex(img => img.id === p.id);
        if (foundIdx !== -1) currentImages[foundIdx] = newImages[idx];
      });
      finalF[frameIdx] = { ...finalF[frameIdx], status: 'completed', images: currentImages, selectedImageIndex: currentImages.length - 1 };
      updatedPlan.frames = finalF;

      setPlan(updatedPlan);
      planRef.current = updatedPlan;
      return newImages[0]?.url;
    } catch (e: any) {
      clearInterval(interval);
      if (e.message?.includes("QUOTA_EXHAUSTED")) handleQuotaError();
      setPlan(prev => {
        const errF = [...prev.frames];
        errF[frameIdx].status = 'error';
        return { ...prev, frames: errF };
      });
      throw e; // Bubble up for full production loop
    }
  };

  const generateFrameVideo = async (frameIdx: number) => {
    const currentPlan = planRef.current;
    const frame = currentPlan.frames[frameIdx];

    if (frame.videoStatus === 'completed' && frame.videoUrl) return frame.videoUrl;

    const masterImg = frame.images[frame.selectedImageIndex];
    if (!masterImg || masterImg.status !== 'completed') {
      console.warn(`Frame ${frameIdx + 1} has no completed master image.`);
      return null;
    }

    setPlan(p => { const nf = [...p.frames]; nf[frameIdx].videoStatus = 'generating'; nf[frameIdx].videoProgress = 0; return { ...p, frames: nf }; });

    try {
      let finalPrompt = frame.videoPrompt;
      if (!finalPrompt || finalPrompt === "Cinematic motion...") {
        finalPrompt = await generateDirectorPrompt(frame, undefined, currentPlan, 'standalone');
        setPlan(p => { const nf = [...p.frames]; nf[frameIdx].videoPrompt = finalPrompt; return { ...p, frames: nf }; });
      }

      const url = await generateTransitionVideo(
        finalPrompt,
        masterImg.url,
        undefined,
        currentPlan.aspectRatio,
        frame.videoModel!,
        'standalone',
        (p) => setPlan(prev => {
          const nf = [...prev.frames];
          if (nf[frameIdx].videoStatus === 'generating') nf[frameIdx].videoProgress = p;
          return { ...prev, frames: nf };
        })
      );

      setPlan(prev => {
        const nf = [...prev.frames];
        nf[frameIdx] = { ...nf[frameIdx], videoUrl: url, videoStatus: 'completed', videoProgress: 100 };
        const updated = { ...prev, frames: nf };
        planRef.current = updated;
        return updated;
      });
      return url;
    } catch (e: any) {
      console.error(`Frame ${frameIdx + 1} video synthesis failed:`, e);
      if (e.message?.includes("QUOTA_EXHAUSTED")) handleQuotaError();
      setPlan(p => { const nf = [...p.frames]; nf[frameIdx].videoStatus = 'error'; return { ...p, frames: nf }; });
      throw e;
    }
  };

  const generateSingleTransition = async (idx: number) => {
    const currentPlan = planRef.current;
    const t = transitions[idx];

    if (t.status === 'completed' && t.videoUrl) return t.videoUrl;

    const f1 = currentPlan.frames[idx], f2 = currentPlan.frames[idx + 1];
    const img1 = f1.images[f1.selectedImageIndex];
    const img2 = f2.images[f2.selectedImageIndex];

    if (!img1 || img1.status !== 'completed') return null;

    setTransitions(prev => { const n = [...prev]; n[idx].status = 'generating'; n[idx].progress = 0; return n; });
    try {
      let finalPrompt = t.directorPrompt;
      if (!finalPrompt || finalPrompt === "Cinematic transition...") {
        finalPrompt = await generateDirectorPrompt(f1, f2, currentPlan, t.type);
        setTransitions(prev => { const n = [...prev]; n[idx].directorPrompt = finalPrompt; return n; });
      }

      const endImgUrl = t.type === 'bridge' ? img2.url : undefined;
      const url = await generateTransitionVideo(
        finalPrompt, img1.url, endImgUrl,
        currentPlan.aspectRatio, t.modelId, t.type,
        (p) => setTransitions(prev => { const n = [...prev]; if (n[idx].status === 'generating') n[idx].progress = p; return n; })
      );
      setTransitions(prev => {
        const n = [...prev];
        n[idx] = { ...n[idx], videoUrl: url, status: 'completed', progress: 100 };
        return n;
      });
      return url;
    } catch (e: any) {
      console.error(`Transition ${idx + 1} failed:`, e);
      if (e.message?.includes("QUOTA_EXHAUSTED")) handleQuotaError();
      setTransitions(prev => { const n = [...prev]; n[idx].status = 'error'; return n; });
      throw e;
    }
  };

  const handleFullProduction = async () => {
    if (!masterConcept.trim()) {
      alert("Please enter a concept first.");
      return;
    }
    setIsProcessing(true);
    setProductionStatus("Directing the Storyboard Swarm...");

    try {
      // Step 1: Draft Story if needed (Sequential as it defines the frame objects)
      let currentFrames = planRef.current.frames;
      if (currentFrames.every(f => !f.raw.trim())) {
        const drafted = await handleMagicDraft();
        if (!drafted) throw new Error("Drafting failed");
        currentFrames = drafted;
      }

      // Step 2: Parallel Keyframe Imaging Swarm
      setProductionStatus(`Capturing all Keyframes simultaneously...`);
      const imagingTasks = currentFrames.map((f, i) => {
        if (f.status !== 'completed') return generateFrameImages(i);
        return Promise.resolve(f.images[f.selectedImageIndex]?.url);
      });
      await Promise.all(imagingTasks);

      // Step 3: Parallel Video Synthesis Swarm
      // We trigger both Independent Motion Clips AND Bridge Transitions in one massive parallel block
      setProductionStatus(`Synthesizing Visual Motion Swarm...`);

      const videoTasks: Promise<any>[] = [];

      // Add Independent Motion Clips to swarm
      for (let i = 0; i < planRef.current.frames.length; i++) {
        if (planRef.current.frames[i].videoStatus !== 'completed') {
          videoTasks.push(generateFrameVideo(i));
        }
      }

      // Add Transitions to swarm
      for (let i = 0; i < transitions.length; i++) {
        if (transitions[i].status !== 'completed') {
          videoTasks.push(generateSingleTransition(i));
        }
      }

      if (videoTasks.length > 0) {
        await Promise.allSettled(videoTasks);
      }

      setProductionStatus("Production Complete!");
      setTimeout(() => setProductionStatus(null), 4000);
    } catch (e: any) {
      console.error("Full Production encountered an error:", e);
      if (e.message?.includes("QUOTA_EXHAUSTED")) {
        setProductionStatus("Quota Hit - Resumable");
      } else {
        setProductionStatus("Production Paused");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenFramePrompt = async (idx: number) => {
    setGeneratingPromptFor(`frame-${idx}`);
    try {
      const p = await generateDirectorPrompt(planRef.current.frames[idx], undefined, planRef.current, 'standalone');
      setPlan(prev => { const nf = [...prev.frames]; nf[idx].videoPrompt = p; return { ...prev, frames: nf }; });
    } finally { setGeneratingPromptFor(null); }
  };

  const handleGenTransPrompt = async (idx: number) => {
    setGeneratingPromptFor(`trans-${idx}`);
    try {
      const p = await generateDirectorPrompt(planRef.current.frames[idx], planRef.current.frames[idx + 1], planRef.current, transitions[idx].type);
      setTransitions(prev => { const n = [...prev]; n[idx].directorPrompt = p; return n; });
    } finally { setGeneratingPromptFor(null); }
  };

  return (
    <div className="font-sans text-sage-900">
      <Header
        hasVeoAccess={hasVeoAccess}
        plan={plan}
        transitions={transitions}
        isProcessing={isProcessing}
        productionStatus={productionStatus}
        selectedFrameIndices={selectedFrameIndices}
        selectedTransitionIndices={new Set()}
        onUnlock={handleSelectKey}
        onAspectRatioChange={(r) => setPlan(p => ({ ...p, aspectRatio: r }))}
        onPlaySequence={() => setShowMoviePlayer(true)}
        onStitchSelected={async () => {
          const urls = transitions.filter(t => t.videoUrl).map(t => t.videoUrl!);
          if (urls.length < 2) return;
          setIsProcessing(true);
          const url = await stitchVideos(urls);
          setStitchedVideoUrl(url); setShowMoviePlayer(true); setIsProcessing(false);
        }}
        onBatchRender={async (indices) => {
          setIsProcessing(true);
          const targets = indices || plan.frames.map((_, i) => i).filter(i => plan.frames[i].status !== 'completed');
          for (const i of targets) await generateFrameImages(i);
          setIsProcessing(false);
        }}
        onFullProduction={handleFullProduction}
      />

      <main className="max-w-[1920px] mx-auto px-6 py-12 space-y-12 pb-48">
        {hasVeoAccess && (
          <div className="bg-white/60 border border-beige-300 rounded-[2rem] p-8 shadow-sm backdrop-blur-sm">
            <h2 className="text-xl font-serif font-black text-beige-900 mb-6 flex items-center gap-3">
              <i className="fa-solid fa-circle-info text-terracotta"></i>
              Studio Workflow & Guide
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm leading-relaxed text-beige-900/80">
              <div className="space-y-3">
                <h3 className="font-bold text-terracotta uppercase tracking-widest text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-terracotta/10 flex items-center justify-center text-[10px]">1</span>
                  Concept & Swarm
                </h3>
                <p>
                  Define your <strong>Master Concept</strong> and Cast below. When ready, the <strong>One-Click Master Cut</strong> button triggers a massive parallel "Swarm". It simultaneously drafts the story, renders 4 high-res candidates per frame (Gemini 3 Pro), and begins synthesizing video clips (Veo) immediately.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-terracotta uppercase tracking-widest text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-terracotta/10 flex items-center justify-center text-[10px]">2</span>
                  Direct & Refine
                </h3>
                <p>
                  While video generates, review your images. Click any candidate to <strong>Swap</strong> the master shot. Use <strong>AI Refine</strong> to fix details using text prompts. You can also rewrite the "Director Prompt" for any specific clip and regenerate just that video.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-terracotta uppercase tracking-widest text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-terracotta/10 flex items-center justify-center text-[10px]">3</span>
                  Implications & Export
                </h3>
                <p>
                  <strong>Quota Warning:</strong> The "Swarm" fires ~10-20 complex API requests at once. This requires a paid GCP project with high quotas. If synthesis fails, check the billing console. Finally, select your best clips and hit <strong>Stitch</strong> to export a seamless movie.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasVeoAccess && (
          <ProjectConcept
            masterConcept={masterConcept} setMasterConcept={setMasterConcept}
            isDrafting={isDrafting} isSearching={isSearching} referenceImages={referenceImages}
            draftFrameCount={draftFrameCount} plan={plan} isDragging={isDragging}
            isFullProduction={isProcessing && !!productionStatus}
            handlers={{
              onMagicDraft: handleMagicDraft,
              onSearchInspiration: handleSearchInspiration,
              onFullProduction: handleFullProduction,
              onPaste: (e) => { if (e.clipboardData.files.length) processFiles(e.clipboardData.files); },
              onDrop: (e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); },
              onDragOver: (e) => { e.preventDefault(); setIsDragging(true); },
              onDragLeave: (e) => { e.preventDefault(); setIsDragging(false); },
              onReferenceUpload: (e) => processFiles(e.target.files),
              onRemoveReference: (i) => setReferenceImages(p => p.filter((_, idx) => idx !== i)),
              setPlan: setPlan, setDraftFrameCount: setDraftFrameCount, onStoryLengthChange: (c) => setDraftFrameCount(c)
            }}
          />
        )}

        {hasVeoAccess && plan.frames.map((frame, fIdx) => (
          <React.Fragment key={fIdx}>
            <FrameCard
              frame={frame} fIdx={fIdx}
              selectedFrameIndices={selectedFrameIndices}
              isPortrait={plan.aspectRatio === '9:16'}
              generatingPromptFor={generatingPromptFor === `frame-${fIdx}`}
              actions={{
                toggleFrameSelection: (i) => setSelectedFrameIndices(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; }),
                updateFrameModel: (i, m) => setPlan(p => { const f = [...p.frames]; f[i].imageModel = m; return { ...p, frames: f }; }),
                setCandidateCount: (i, c) => setPlan(p => { const f = [...p.frames]; f[i].candidateCount = c; return { ...p, frames: f }; }),
                removeFrame: (i) => setPlan(p => ({ ...p, frames: p.frames.filter((_, idx) => idx !== i) })),
                updateFrameRaw: (i, v) => setPlan(p => { const f = [...p.frames]; f[i].raw = v; return { ...p, frames: f }; }),
                generateFrameImages: generateFrameImages,
                selectImageForTransition: (fi, ii) => setPlan(p => { const f = [...p.frames]; f[fi].selectedImageIndex = ii; return { ...p, frames: f }; }),
                setEditingImage: setEditingImage,
                handleGenFramePrompt: () => handleGenFramePrompt(fIdx),
                updateFrameVideoPrompt: (v) => setPlan(p => { const nf = [...p.frames]; nf[fIdx].videoPrompt = v; return { ...p, frames: nf }; }),
                updateFrameVideoModel: (m) => setPlan(p => { const nf = [...p.frames]; nf[fIdx].videoModel = m; return { ...p, frames: nf }; }),
                generateFrameVideo: () => generateFrameVideo(fIdx),
                uploadImage: (files) => {
                  const proc = async () => {
                    const file = files?.[0]; if (!file) return;
                    const url = await processImageFile(file);
                    const desc = await describeImage(url);
                    setPlan(p => {
                      const f = [...p.frames];
                      f[fIdx] = { ...f[fIdx], raw: desc, images: [...f[fIdx].images, { id: crypto.randomUUID(), url, status: 'completed', modelId: 'custom-upload' }], selectedImageIndex: f[fIdx].images.length };
                      return { ...p, frames: f };
                    });
                  }; proc();
                }
              }}
            />
            {fIdx < plan.frames.length - 1 && transitions[fIdx] && (
              <TransitionCard
                transition={transitions[fIdx]} fIdx={fIdx} isPortrait={plan.aspectRatio === '9:16'}
                generatingPromptFor={generatingPromptFor === `trans-${fIdx}` ? fIdx : null} isSelected={false} onToggleSelect={() => { }}
                actions={{
                  updateTransitionModel: (i, m) => setTransitions(p => { const n = [...p]; n[i].modelId = m; return n; }),
                  updateTransitionType: (i, t) => setTransitions(p => { const n = [...p]; n[i].type = t; return n; }),
                  updateDirectorPrompt: (i, v) => setTransitions(p => { const n = [...p]; n[i].directorPrompt = v; return n; }),
                  handleGenerateTransitionPrompt: () => handleGenTransPrompt(fIdx),
                  generateSingleVideo: () => generateSingleTransition(fIdx)
                }}
              />
            )}
          </React.Fragment>
        ))}
      </main>

      {showMoviePlayer && (
        <VideoPlayerModal
          videos={stitchedVideoUrl ? [stitchedVideoUrl] : [...plan.frames.map(f => f.videoUrl!), ...transitions.map(t => t.videoUrl!)].filter(Boolean)}
          currentIndex={currentMovieIndex} setCurrentIndex={setCurrentMovieIndex}
          onClose={() => { setShowMoviePlayer(false); setStitchedVideoUrl(null); }}
          isPortrait={plan.aspectRatio === '9:16'} isStitched={!!stitchedVideoUrl}
        />
      )}

      {editingImage && (
        <EditImageModal
          editingImage={editingImage} plan={plan} editPrompt={editPrompt} setEditPrompt={setEditPrompt}
          onClose={() => setEditingImage(null)}
          onApply={async () => {
            const { frameIdx, imgIdx } = editingImage;
            const img = plan.frames[frameIdx].images[imgIdx];
            setEditingImage(null);
            const url = await editImage(img.url, editPrompt);
            setPlan(p => { const f = [...p.frames]; f[frameIdx].images[imgIdx].url = url; return { ...p, frames: f }; });
          }}
        />
      )}
    </div>
  );
};

export default App;
