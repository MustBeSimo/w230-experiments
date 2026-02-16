
import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  // Ensure progress stays within 0-100 range for display
  const safeProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-terracotta">
        <span>{label || 'Generating...'}</span>
        <span>{Math.round(safeProgress)}%</span>
      </div>
      <div className="h-1.5 w-full bg-beige-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-terracotta transition-all duration-300 ease-out"
          style={{ width: `${safeProgress}%` }}
        ></div>
      </div>
    </div>
  );
};
