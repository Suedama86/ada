import React, { useEffect, useRef } from 'react';

interface VideoHUDProps {
  onFrame: (base64: string) => void;
  isActive: boolean;
  videoStream: MediaStream | null;
}

const VideoHUD: React.FC<VideoHUDProps> = ({ onFrame, isActive, videoStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  useEffect(() => {
    if (!isActive || !videoStream) return;

    const interval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const base64 = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
          onFrame(base64);
        }
      }
    }, 1000); // Send frame every second when scanning

    return () => clearInterval(interval);
  }, [isActive, onFrame, videoStream]);

  return (
    <div className="relative w-full h-full hud-border overflow-hidden bg-black">
      {/* Real Video */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60" />
      <canvas ref={canvasRef} width="640" height="480" className="hidden" />

      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corners */}
        <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-cyan-bright" />
        <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-cyan-bright" />
        <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-cyan-bright" />
        <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-cyan-bright" />

        {/* Crosshair */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center">
          <div className="w-1 h-3 bg-cyan-bright absolute" />
          <div className="w-3 h-1 bg-cyan-bright absolute" />
          <div className="w-8 h-8 border border-cyan-bright rounded-full opacity-50" />
        </div>

        {/* Scan line */}
        {isActive && (
          <div className="absolute left-0 right-0 h-1 bg-cyan-bright opacity-50 shadow-[0_0_10px_#00f0ff] animate-scan" />
        )}
        
        <div className="absolute bottom-4 left-4 font-mono text-cyan-bright text-xs bg-black/50 p-1">
          VISION_MODULE: {isActive ? 'ACTIVE_SCAN' : (videoStream ? 'PASSIVE' : 'OFFLINE')}
          {!videoStream && <span className="text-alert-red ml-2">NO SIGNAL</span>}
        </div>
      </div>
    </div>
  );
};

export default VideoHUD;