import React, { useState, useEffect } from 'react';

interface VoiceCalibrationProps {
  onComplete: () => void;
  stream: MediaStream | null;
}

const VoiceCalibration: React.FC<VoiceCalibrationProps> = ({ onComplete, stream }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("INITIALIZING AUDIO SUBSYSTEM...");
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 32;
    source.connect(analyzer);
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const checkAudio = () => {
      analyzer.getByteFrequencyData(dataArray);
      let sum = 0;
      for (const i of dataArray) sum += i;
      setVolume(sum / dataArray.length);
      requestAnimationFrame(checkAudio);
    };
    checkAudio();

    return () => { audioContext.close(); }
  }, [stream]);

  useEffect(() => {
    // Sequence logic
    const timeouts = [
      setTimeout(() => { setStatus("SAY 'JARVIS' TO CALIBRATE..."); }, 1000),
      setTimeout(() => { setStatus("ANALYZING VOCAL BIOMETRICS..."); }, 3000),
      setTimeout(() => { setStatus("ENCRYPTING VOICE SIGNATURE..."); }, 5500),
      setTimeout(() => { setStatus("PROTOCOL LOCKED: USER AUTHENTICATED"); }, 7000),
      setTimeout(() => { onComplete(); }, 8500),
    ];
    
    // Fake progress bar
    const interval = setInterval(() => {
      setProgress(p => Math.min(100, p + 1.2));
    }, 80);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
    }
  }, [onComplete]);

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center flex-col">
      <div className="w-96 hud-border bg-black/80 p-6 relative overflow-hidden">
        {/* Scanning Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-bright shadow-[0_0_15px_#00f0ff] animate-scan opacity-50"></div>

        <h2 className="text-xl font-bold text-cyan-bright mb-6 text-center tracking-widest">VOICE AUTHENTICATION</h2>
        
        {/* Waveform Visualization */}
        <div className="flex justify-center items-end gap-1 h-16 mb-6">
           {[...Array(20)].map((_, i) => (
             <div 
               key={i} 
               className="w-2 bg-cyan-500 transition-all duration-75"
               style={{ 
                 height: `${Math.max(10, Math.random() * volume * 2)}%`,
                 opacity: volume > 10 ? 1 : 0.3 
               }}
             />
           ))}
        </div>

        <div className="font-mono text-xs text-cyan-dim mb-2 flex justify-between">
           <span>PROGRESS</span>
           <span>{Math.floor(progress)}%</span>
        </div>
        
        <div className="w-full h-2 bg-cyan-900 mb-4">
           <div 
             className="h-full bg-cyan-bright transition-all duration-100 ease-out"
             style={{ width: `${progress}%` }}
           />
        </div>

        <div className="text-center font-mono text-sm text-cyan-bright animate-pulse">
           &gt;&gt; {status}
        </div>
      </div>
    </div>
  );
};

export default VoiceCalibration;