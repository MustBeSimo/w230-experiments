
import React, { useState } from 'react';
import { Button } from './Button';
import { ClipPlan } from '../types';

interface EditImageModalProps {
  editingImage: { frameIdx: number, imgIdx: number };
  plan: ClipPlan;
  editPrompt: string;
  setEditPrompt: (val: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export const EditImageModal: React.FC<EditImageModalProps> = ({
  editingImage,
  plan,
  editPrompt,
  setEditPrompt,
  onClose,
  onApply
}) => {
  const [isRefining, setIsRefining] = useState(false);

  const handleApply = async () => {
    setIsRefining(true);
    try {
      await onApply();
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-beige-900/60 backdrop-blur-sm">
      <div className="bg-white border border-beige-200 rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl space-y-6 overflow-hidden relative">
        {isRefining && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <i className="fa-solid fa-wand-magic-sparkles text-terracotta text-6xl animate-pulse"></i>
              <div className="absolute -top-2 -right-2">
                <i className="fa-solid fa-circle-notch animate-spin text-terracotta text-2xl"></i>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-serif font-black text-beige-900">Refining Vision...</p>
              <p className="text-xs font-bold uppercase tracking-widest text-terracotta">Analyzing pixel context & applying cinematic grade</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-serif font-black text-beige-900">AI Refinement</h3>
          <button onClick={onClose} disabled={isRefining} className="w-10 h-10 rounded-full bg-beige-100 hover:bg-beige-200 flex items-center justify-center transition-colors disabled:opacity-50" title="Close without applying changes">
            <i className="fa-solid fa-xmark text-beige-500"></i>
          </button>
        </div>

        <div className="aspect-video bg-beige-100 rounded-2xl overflow-hidden shadow-inner border border-beige-300 relative">
          <img src={plan.frames[editingImage.frameIdx].images[editingImage.imgIdx].url} className="w-full h-full object-contain" />
          <div className="absolute bottom-4 left-4">
            <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Input Master</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <label className="text-xs font-bold uppercase text-terracotta tracking-widest">Modification Instruction</label>
            <span className="text-[10px] font-bold text-beige-400 uppercase italic">Pro Image Model Active</span>
          </div>
          <textarea
            value={editPrompt}
            onChange={e => setEditPrompt(e.target.value)}
            disabled={isRefining}
            placeholder="e.g. Remove the text overlays, add a lens flare, make it rainy..."
            className="w-full bg-beige-50 border border-beige-300 rounded-2xl px-6 py-4 text-lg text-beige-900 focus:ring-2 focus:ring-terracotta/20 focus:border-terracotta outline-none resize-none transition-all disabled:opacity-50"
            rows={3}
          />
        </div>

        <div className="flex gap-4">
          <Button onClick={onClose} variant="secondary" disabled={isRefining} className="flex-1 py-5 rounded-2xl font-bold" title="Cancel and return without applying changes">Cancel</Button>
          <Button onClick={handleApply} disabled={isRefining || !editPrompt.trim()} className="flex-[2] py-5 rounded-2xl font-bold text-lg" title="Apply AI refinement to create a new version of this image">
            {isRefining ? 'Applying...' : 'Apply AI Refinement'}
          </Button>
        </div>
      </div>
    </div>
  );
};
