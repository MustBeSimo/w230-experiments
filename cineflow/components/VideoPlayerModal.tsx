
import React, { useRef, useEffect } from 'react';

interface VideoPlayerModalProps {
  videos: string[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  isPortrait: boolean;
  isStitched?: boolean;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  videos,
  currentIndex,
  setCurrentIndex,
  onClose,
  isPortrait,
  isStitched = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play();
    }
  }, [currentIndex, videos]);

  const handleVideoEnded = () => {
    if (currentIndex < videos.length - 1 && !isStitched) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-50 transition-colors"
        title="Close video player"
      >
        <i className="fa-solid fa-xmark text-xl"></i>
      </button>

      <div className={`w-full h-full flex items-center justify-center p-8`}>
        {videos.length > 0 ? (
          <div className={`relative ${isPortrait ? 'h-full aspect-[9/16]' : 'w-full max-w-7xl aspect-video'} bg-black shadow-2xl rounded-sm overflow-hidden flex items-center justify-center`}>
            <video
              ref={videoRef}
              src={videos[currentIndex]}
              className="w-full h-full object-contain"
              autoPlay
              controls
              onEnded={handleVideoEnded}
            />

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 p-4 bg-gradient-to-b from-black/80 to-transparent w-full pointer-events-none">
              <h3 className="text-white font-serif text-lg tracking-wide">
                {isStitched ? 'Stitched Video Result' : `Scene ${currentIndex + 1} of ${videos.length}`}
              </h3>
            </div>

            {/* Stitched Video Actions */}
            {isStitched && (
              <div className="absolute bottom-20 right-8 flex gap-4">
                <a
                  href={videos[0]}
                  download="stitched-movie.webm"
                  className="bg-terracotta hover:bg-terracotta-hover text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2"
                  title="Download the complete stitched video"
                >
                  <i className="fa-solid fa-download"></i> Download Movie
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white">No videos to play</div>
        )}
      </div>
    </div>
  );
};
