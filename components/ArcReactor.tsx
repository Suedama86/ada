import React from 'react';

interface ArcReactorProps {
  isListening: boolean;
  speakingVolume: number; // 0 to 1
}

const ArcReactor: React.FC<ArcReactorProps> = ({ isListening, speakingVolume }) => {
  // Scale outer ring based on volume
  const scale = 1 + speakingVolume * 0.5;
  const glowIntensity = 0.5 + speakingVolume;

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Rotating Ring */}
      <div className={`absolute w-full h-full rounded-full border-2 border-dashed border-cyan-bright opacity-30 animate-spin-slow`} />
      
      {/* Middle Static Ring */}
      <div className="absolute w-48 h-48 rounded-full border border-cyan-bright opacity-50" />
      
      {/* Inner Core */}
      <div 
        className="absolute w-32 h-32 rounded-full bg-cyan-dim border-2 border-cyan-bright flex items-center justify-center transition-all duration-100 ease-out"
        style={{ 
          transform: `scale(${scale})`,
          boxShadow: `0 0 ${20 * glowIntensity}px #00f0ff, inset 0 0 ${10 * glowIntensity}px #00f0ff`
        }}
      >
        <div className="w-16 h-16 rounded-full bg-cyan-bright opacity-80 blur-md" />
      </div>

      {/* Text Overlay */}
      <div className="absolute top-full mt-4 text-center font-mono text-cyan-bright text-xs tracking-[0.3em]">
        {isListening ? "LISTENING..." : speakingVolume > 0.01 ? "SPEAKING" : "STANDBY"}
      </div>
    </div>
  );
};

export default ArcReactor;
