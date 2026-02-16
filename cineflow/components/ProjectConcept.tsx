
import React, { useRef } from 'react';
import { ClipPlan } from '../types';
import { processImageFile } from '../services/videoUtils';

interface ProjectConceptProps {
  masterConcept: string;
  setMasterConcept: (val: string) => void;
  isDrafting: boolean;
  isSearching?: boolean;
  referenceImages: string[];
  draftFrameCount: number;
  plan: ClipPlan;
  isDragging: boolean;
  isFullProduction?: boolean;
  handlers: {
    onMagicDraft: () => void;
    onSearchInspiration: () => void;
    onFullProduction: () => void;
    onPaste: (e: React.ClipboardEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onReferenceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveReference: (idx: number) => void;
    setPlan: React.Dispatch<React.SetStateAction<ClipPlan>>;
    setDraftFrameCount: (val: number) => void;
    onStoryLengthChange: (val: number) => void;
  };
}

export const ProjectConcept: React.FC<ProjectConceptProps> = ({
  masterConcept,
  setMasterConcept,
  isDrafting,
  isSearching = false,
  referenceImages,
  draftFrameCount,
  plan,
  isDragging,
  isFullProduction = false,
  handlers
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addCharacter = () => {
    handlers.setPlan(prev => ({
      ...prev,
      globalConstraints: {
        ...prev.globalConstraints,
        characters: [...(prev.globalConstraints.characters || []), { name: "New Entity", description: "", images: [] }]
      }
    }));
  };

  const updateCharacter = (idx: number, field: 'name' | 'description', value: string) => {
    handlers.setPlan(prev => {
      const chars = [...(prev.globalConstraints.characters || [])];
      chars[idx] = { ...chars[idx], [field]: value };
      return { ...prev, globalConstraints: { ...prev.globalConstraints, characters: chars } };
    });
  };

  const removeCharacter = (idx: number) => {
    handlers.setPlan(prev => {
      const chars = [...(prev.globalConstraints.characters || [])];
      chars.splice(idx, 1);
      return { ...prev, globalConstraints: { ...prev.globalConstraints, characters: chars } };
    });
  };

  const handleCharImageUpload = async (charIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const result = await processImageFile(file);
        handlers.setPlan(prev => {
          const chars = [...(prev.globalConstraints.characters || [])];
          const currentImages = chars[charIdx].images || [];
          chars[charIdx] = { ...chars[charIdx], images: [...currentImages, result] };
          return { ...prev, globalConstraints: { ...prev.globalConstraints, characters: chars } };
        });
      } catch (e) {
        console.error("Image process failed", e);
      }
    }
  };

  const handleCharPaste = async (charIdx: number, e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const filesArray = Array.from(e.clipboardData.files) as File[];
      const imageFiles = filesArray.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();

        for (const file of imageFiles) {
          try {
            const result = await processImageFile(file);
            handlers.setPlan(prev => {
              const chars = [...(prev.globalConstraints.characters || [])];
              if (!chars[charIdx]) return prev;
              const currentImages = chars[charIdx].images || [];
              chars[charIdx] = { ...chars[charIdx], images: [...currentImages, result] };
              return { ...prev, globalConstraints: { ...prev.globalConstraints, characters: chars } };
            });
          } catch (e) {
            console.error("Image paste failed", e);
          }
        }
      }
    }
  };

  const removeCharImage = (charIdx: number, imgIdx: number) => {
    handlers.setPlan(prev => {
      const chars = [...(prev.globalConstraints.characters || [])];
      const currentImages = chars[charIdx].images || [];
      chars[charIdx] = { ...chars[charIdx], images: currentImages.filter((_, i) => i !== imgIdx) };
      return { ...prev, globalConstraints: { ...prev.globalConstraints, characters: chars } };
    });
  };

  return (
    <section className="bg-beige-200 border border-beige-300 rounded-[2rem] p-8 md:p-12 space-y-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-4xl font-serif font-black text-beige-900">Project Concept</h2>
          <p className="text-beige-900/60 text-lg">Describe your cinematic vision. Once ready, hit One-Click Master Cut to generate everything.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handlers.onFullProduction}
            disabled={isFullProduction || !masterConcept}
            className={`group relative px-10 py-6 rounded-[2rem] font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 overflow-hidden ${isFullProduction || !masterConcept ? 'bg-beige-300 text-beige-900/50 cursor-not-allowed' : 'bg-gradient-to-br from-terracotta to-[#a04530] text-white'}`}
            title="Generate all scenes, images, and videos in one automated production"
          >
            <span className="relative z-10 flex items-center gap-3">
              {isFullProduction ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-bolt"></i> One-Click Master Cut</>}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
          </button>
          <button
            onClick={handlers.onMagicDraft}
            disabled={isDrafting || isFullProduction || !masterConcept}
            className="px-8 py-6 rounded-[2rem] font-bold text-lg bg-white border border-beige-300 text-beige-900 hover:text-terracotta transition-all shadow-sm"
            title="Generate scene descriptions only without rendering images or videos"
          >
            {isDrafting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* 1. Structure Control Block: Narrative Mode + Scenes Slider (TOP LEFT) */}
        <div className="lg:col-span-1 bg-white border border-beige-300 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm h-full min-h-[180px]">
          <div>
            <span className="text-[10px] font-bold uppercase text-terracotta tracking-widest block mb-2">Narrative Style</span>
            <div className="flex bg-beige-100 rounded-lg p-1 border border-beige-300">
              <button
                onClick={() => handlers.setPlan(p => ({ ...p, narrativeMode: 'story' }))}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${plan.narrativeMode === 'story' ? 'bg-white shadow-sm text-terracotta' : 'text-beige-500 hover:text-terracotta'}`}
                title="Create a narrative story with connected scenes"
              >Story</button>
              <button
                onClick={() => handlers.setPlan(p => ({ ...p, narrativeMode: 'montage' }))}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${plan.narrativeMode === 'montage' ? 'bg-white shadow-sm text-terracotta' : 'text-beige-500 hover:text-terracotta'}`}
                title="Create a montage with independent thematic scenes"
              >Montage</button>
            </div>
          </div>

          <div className="border-t border-beige-100 pt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold uppercase text-terracotta tracking-widest">Scenes</span>
              <span className="text-sm font-black text-beige-900">{draftFrameCount}</span>
            </div>
            <input
              type="range" min="3" max="10" step="1"
              value={draftFrameCount}
              onChange={(e) => handlers.onStoryLengthChange(parseInt(e.target.value))}
              className="w-full accent-terracotta cursor-pointer"
            />
          </div>
        </div>

        {/* 2. Master Concept Input (TOP RIGHT - Spanning remaining columns) */}
        <div className="md:col-span-1 lg:col-span-3 relative h-full">
          <textarea
            value={masterConcept}
            onChange={e => setMasterConcept(e.target.value)}
            onPaste={handlers.onPaste}
            placeholder="e.g. A cyberpunk detective walking through rainy neon streets..."
            className="w-full h-full bg-white border border-beige-300 rounded-2xl px-8 py-6 pb-16 text-xl text-beige-900 placeholder-beige-400 focus:ring-2 focus:ring-terracotta/50 focus:border-terracotta outline-none min-h-[180px] resize-none shadow-inner"
          />
          <button
            onClick={handlers.onSearchInspiration}
            disabled={isSearching}
            className="absolute bottom-4 right-4 bg-beige-100 hover:bg-white text-beige-500 hover:text-terracotta border border-beige-300 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            title="Search web for trending visual styles and cinematic references"
          >
            {isSearching ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-earth-americas"></i>}
            Research Trends
          </button>
        </div>

        {/* 3. Style References (Row 2) */}
        <div
          className={`md:col-span-2 lg:col-span-4 bg-white border border-beige-300 rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300 ${isDragging ? 'border-terracotta ring-4 ring-terracotta/10 bg-beige-50' : ''}`}
          onDragOver={handlers.onDragOver}
          onDragLeave={handlers.onDragLeave}
          onDrop={handlers.onDrop}
          onPaste={handlers.onPaste}
          tabIndex={0}
        >
          <div className="flex justify-between items-center pointer-events-none">
            <span className="text-xs font-bold uppercase text-terracotta tracking-widest flex items-center gap-2">
              Style References (Max 4)
            </span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {referenceImages.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-beige-200 group">
                <img src={img} className="w-full h-full object-cover" />
                <button onClick={() => handlers.onRemoveReference(idx)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Remove this reference image">
                  <i className="fa-solid fa-trash text-white"></i>
                </button>
              </div>
            ))}
            {referenceImages.length < 4 && (
              <div className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-beige-300 flex items-center justify-center hover:border-terracotta hover:bg-beige-50 transition-colors relative cursor-pointer">
                <i className="fa-solid fa-plus text-beige-400"></i>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlers.onReferenceUpload}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* 4. Cast & Entities (Row 3) */}
        <div className="md:col-span-2 lg:col-span-4 bg-white border border-beige-300 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-terracotta tracking-widest">
              Cast & Entities
            </span>
            <button onClick={addCharacter} className="text-[10px] font-bold uppercase text-beige-400 hover:text-terracotta flex items-center gap-1" title="Add a new character or entity to maintain consistency across scenes">
              <i className="fa-solid fa-plus"></i> Add
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.globalConstraints.characters?.map((char, i) => (
              <div
                key={i}
                className="bg-beige-50 rounded-xl p-4 border border-beige-200 text-sm group relative flex flex-col gap-3 focus:ring-2 focus:ring-terracotta/50 outline-none transition-shadow"
                tabIndex={0}
                onPaste={(e) => handleCharPaste(i, e)}
              >
                <div className="flex justify-between items-start">
                  <input
                    value={char.name}
                    onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                    placeholder="Character Name"
                    className="font-bold text-terracotta bg-transparent border-b border-transparent hover:border-beige-200 focus:border-terracotta outline-none w-2/3"
                  />
                  <button
                    onClick={() => removeCharacter(i)}
                    className="w-6 h-6 flex items-center justify-center text-beige-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove this character"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide">
                  {char.images?.map((img, imgIdx) => (
                    <div key={imgIdx} className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden border border-beige-200 group/img">
                      <img src={img} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeCharImage(i, imgIdx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-[8px] text-white"
                        title="Remove this character reference image"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                  <div className="relative w-10 h-10 flex-shrink-0 rounded-lg border border-dashed border-beige-300 flex items-center justify-center hover:bg-white hover:border-terracotta transition-colors cursor-pointer">
                    <i className="fa-solid fa-image text-beige-400 text-xs"></i>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleCharImageUpload(i, e.target.files)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <textarea
                  value={char.description}
                  onChange={(e) => updateCharacter(i, 'description', e.target.value)}
                  placeholder="Character description..."
                  className="text-beige-900/80 leading-relaxed bg-transparent w-full resize-none outline-none border-b border-transparent hover:border-beige-200 focus:border-terracotta h-24"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 5. Project Title (Row 4 Bottom Left) */}
        <input
          value={plan.title}
          onChange={e => handlers.setPlan(p => ({ ...p, title: e.target.value }))}
          placeholder="Project Title"
          className="lg:col-span-1 bg-white border border-beige-300 rounded-2xl px-6 py-4 text-sm font-bold text-beige-900 outline-none focus:ring-2 focus:ring-terracotta/20 min-h-[80px]"
        />

        {/* 6. Aesthetic Brief (Row 4 Bottom Right) */}
        <textarea
          value={plan.globalConstraints.paletteNotes}
          onChange={e => handlers.setPlan(p => ({ ...p, globalConstraints: { ...p.globalConstraints, paletteNotes: e.target.value } }))}
          placeholder="Aesthetic Brief (e.g. Cinematic, Noir, Wes Anderson style)..."
          className="md:col-span-1 lg:col-span-3 bg-white border border-beige-300 rounded-2xl px-6 py-4 text-sm font-bold text-beige-900 outline-none focus:ring-2 focus:ring-terracotta/20 min-h-[80px] resize-none"
        />

      </div>
    </section>
  );
};
