
import React from 'react';
import { Button } from './Button';
import { ClipPlan, TransitionSpec } from '../types';

interface HeaderProps {
  hasVeoAccess: boolean;
  plan: ClipPlan;
  transitions: TransitionSpec[];
  isProcessing: boolean;
  productionStatus: string | null;
  selectedFrameIndices: Set<number>;
  selectedTransitionIndices: Set<number>;
  onUnlock: () => void;
  onAspectRatioChange: (ratio: '16:9' | '9:16') => void;
  onPlaySequence: () => void;
  onStitchSelected: () => void;
  onBatchRender: (indices?: number[]) => void;
  onFullProduction: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasVeoAccess,
  plan,
  transitions,
  isProcessing,
  productionStatus,
  selectedFrameIndices,
  selectedTransitionIndices,
  onUnlock,
  onAspectRatioChange,
  onPlaySequence,
  onStitchSelected,
  onBatchRender,
  onFullProduction
}) => {
  return (
    <nav className="sticky top-0 z-50 bg-beige-100/90 backdrop-blur-md border-b border-beige-300">
      <div className="max-w-[1920px] mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-terracotta flex items-center justify-center text-white text-xl font-serif font-black shadow-lg shadow-terracotta/20">C</div>
          <div>
            <h1 className="text-xl font-serif font-bold tracking-tight text-beige-900">CineFlow</h1>
            <p className="text-[10px] uppercase font-bold text-terracotta tracking-widest">
              {productionStatus || 'Orchestrator'}
            </p>
          </div>
        </div>

        {hasVeoAccess && (
          <div className="flex items-center gap-4">
            {productionStatus && (
                <div className="flex items-center gap-3 px-4 py-2 bg-terracotta/5 rounded-full border border-terracotta/20 animate-pulse">
                    <i className="fa-solid fa-clapperboard text-terracotta text-xs"></i>
                    <span className="text-[10px] font-black uppercase text-terracotta tracking-widest">{productionStatus}</span>
                </div>
            )}

            <div className="hidden md:flex items-center gap-2 mr-4 bg-beige-200 p-1.5 rounded-lg border border-beige-300">
              <button 
                  onClick={() => onAspectRatioChange('16:9')}
                  className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${plan.aspectRatio === '16:9' ? 'bg-white shadow-sm text-terracotta' : 'text-beige-900/60 hover:text-terracotta'}`}
              >16:9</button>
              <button 
                  onClick={() => onAspectRatioChange('9:16')}
                  className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${plan.aspectRatio === '9:16' ? 'bg-white shadow-sm text-terracotta' : 'text-beige-900/60 hover:text-terracotta'}`}
              >9:16</button>
            </div>

            <Button 
                onClick={onFullProduction} 
                variant="terracotta" 
                disabled={isProcessing}
                className="rounded-full px-8 shadow-xl shadow-terracotta/20 group relative overflow-hidden"
            >
              {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-bolt"></i> One-Click Master Cut</>}
            </Button>

            {selectedTransitionIndices.size >= 2 && (
              <Button 
                onClick={onStitchSelected} 
                variant="secondary" 
                disabled={isProcessing}
                className="rounded-full px-6 bg-white"
              >
                {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-file-video"></i> Stitch ({selectedTransitionIndices.size})</>}
              </Button>
            )}

            {transitions.some(t => t.status === 'completed') && (
                <Button onClick={onPlaySequence} variant="secondary" className="rounded-full px-6 bg-white">
                    <i className="fa-solid fa-play"></i> Preview
                </Button>
            )}
          </div>
        )}

        {!hasVeoAccess && (
          <Button onClick={onUnlock} className="rounded-full text-xs font-bold px-8">Unlock Studio</Button>
        )}
      </div>
    </nav>
  );
};
