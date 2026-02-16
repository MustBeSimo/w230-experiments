
export async function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Optimize: Max 1536px (High quality enough for AI ref, small enough for payloads)
        const MAX_DIM = 1536; 
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = width / height;
            if (width > height) {
                width = MAX_DIM;
                height = Math.round(width / ratio);
            } else {
                height = MAX_DIM;
                width = Math.round(height * ratio);
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
           resolve(e.target?.result as string);
           return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Convert to JPEG 0.9 to ensure compatibility and reasonable size
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function resizeImage(base64: string, maxWidth: number = 1280, quality: number = 0.85): Promise<string> {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith('data:')) {
        resolve(base64);
        return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // Scale down if too large
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
         resolve(base64); 
         return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => {
        console.warn("Resize failed, using original", err);
        resolve(base64);
    };
    img.src = base64;
  });
}

export async function stitchVideos(videoUrls: string[], onProgress?: (msg: string) => void): Promise<string> {
  if (videoUrls.length === 0) throw new Error("No videos to stitch");

  // Create canvas and video element
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const video = document.createElement('video');
  video.crossOrigin = "anonymous";
  video.muted = false; 

  if (!ctx) throw new Error("Could not create canvas context");

  // Wait for metadata of the first video to set dimensions
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
    video.onerror = () => reject(new Error("Failed to load first video metadata"));
    video.src = videoUrls[0];
  });

  // Audio Context Setup
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const sourceNode = audioCtx.createMediaElementSource(video);
  sourceNode.connect(dest);
  
  // Create stream from canvas + audio destination
  const stream = canvas.captureStream(30); // 30 FPS target
  const audioTracks = dest.stream.getAudioTracks();
  if (audioTracks.length > 0) {
    stream.addTrack(audioTracks[0]);
  }

  const chunks: Blob[] = [];
  
  let mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
      } else {
          mimeType = ''; // Let browser choose default
      }
  }
  
  let recorder: MediaRecorder;
  try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (e) {
      console.warn("MediaRecorder creation failed with specific mimeType, falling back to default.", e);
      recorder = new MediaRecorder(stream);
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  // Play each video sequentially
  for (let i = 0; i < videoUrls.length; i++) {
    if (onProgress) onProgress(`Stitching clip ${i + 1} of ${videoUrls.length}...`);
    
    await new Promise<void>((resolve, reject) => {
      video.src = videoUrls[i];
      video.currentTime = 0;
      
      const draw = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      
      video.onplay = () => {
        draw();
      };
      
      video.onended = () => {
        resolve();
      };
      
      video.onerror = (e) => reject(e);
      
      video.play().catch(reject);
    });
  }

  recorder.stop();
  
  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      video.remove();
      canvas.remove();
      if (audioCtx.state !== 'closed') {
        audioCtx.close();
      }
      resolve(url);
    };
  });
}
