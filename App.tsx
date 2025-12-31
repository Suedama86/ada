import React, { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GeminiClient } from './services/geminiService';
import { ConnectionState, LogEntry, SmartDevice, AIProvider, AIModel, PendingUpdate } from './types';
import { INITIAL_LOGS, AVAILABLE_MODELS } from './constants';
import ArcReactor from './components/ArcReactor';
import Terminal from './components/Terminal';
import VideoHUD from './components/VideoHUD';
import SmartHomePanel from './components/SmartHomePanel';
import VoiceCalibration from './components/VoiceCalibration';
import SystemUpdateUI from './components/SystemUpdateUI';

interface AIService {
  connect(stream: MediaStream, modelId: string): Promise<void>;
  disconnect(): void;
  analyzeImage(base64: string): Promise<void> | void;
}

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([...INITIAL_LOGS]);
  const [audioVol, setAudioVol] = useState<{in: number, out: number}>({ in: 0, out: 0 });
  const [isScanning, setIsScanning] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  
  // Model Selection & Calibration State
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS[0]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  
  // System Update State
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [isTestingUpdate, setIsTestingUpdate] = useState(false);

  const [devices, setDevices] = useState<SmartDevice[]>([
    { id: '1', name: 'Main Lights', type: 'light', state: true, location: 'Lab' },
    { id: '2', name: 'Door Lock', type: 'lock', state: false, location: 'Front Door' },
    { id: '3', name: 'Climate Control', type: 'thermostat', state: "72°F", location: 'Office' },
  ]);

  const aiRef = useRef<AIService | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', source: string = 'SYSTEM') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      source: source as any,
      message,
      type
    }]);
  }, []);

  const handleToolCall = async (name: string, args: any) => {
    // ============ EXECUTION TOOLS ============
    if (name === 'execute_python') {
      try {
        addLog(`Executing Python code...`, "info", "PYTHON");
        const result: any = await invoke('execute_python', { code: args.code });
        
        if (result.exit_code === 0) {
          addLog(`Python execution successful`, "success", "PYTHON");
          return {
            status: "success",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        } else {
          addLog(`Python error (exit ${result.exit_code})`, "error", "PYTHON");
          return {
            status: "error",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        }
      } catch (e: any) {
        addLog(`Python execution failed: ${e}`, "error", "PYTHON");
        return { status: "error", message: e.toString() };
      }
    }

    if (name === 'execute_powershell') {
      try {
        addLog(`Executing PowerShell...`, "info", "PWSH");
        const result: any = await invoke('execute_powershell', { command: args.command });
        
        if (result.exit_code === 0) {
          addLog(`PowerShell execution successful`, "success", "PWSH");
          return {
            status: "success",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        } else {
          addLog(`PowerShell error (exit ${result.exit_code})`, "error", "PWSH");
          return {
            status: "error",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        }
      } catch (e: any) {
        addLog(`PowerShell execution failed: ${e}`, "error", "PWSH");
        return { status: "error", message: e.toString() };
      }
    }

    if (name === 'install_python_package') {
      try {
        addLog(`Installing Python package: ${args.package}`, "info", "PIP");
        const result: any = await invoke('install_python_package', { package: args.package });
        
        if (result.exit_code === 0) {
          addLog(`Package ${args.package} installed successfully`, "success", "PIP");
          return {
            status: "success",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        } else {
          addLog(`Package installation failed (exit ${result.exit_code})`, "error", "PIP");
          return {
            status: "error",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        }
      } catch (e: any) {
        addLog(`Package installation failed: ${e}`, "error", "PIP");
        return { status: "error", message: e.toString() };
      }
    }

    if (name === 'execute_shell') {
      try {
        addLog(`Executing shell command...`, "info", "SHELL");
        const result: any = await invoke('execute_shell', { command: args.command });
        
        if (result.exit_code === 0) {
          addLog(`Shell execution successful`, "success", "SHELL");
          return {
            status: "success",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        } else {
          addLog(`Shell error (exit ${result.exit_code})`, "error", "SHELL");
          return {
            status: "error",
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code
          };
        }
      } catch (e: any) {
        addLog(`Shell execution failed: ${e}`, "error", "SHELL");
        return { status: "error", message: e.toString() };
      }
    }

    // ============ ORIGINAL TOOLS ============
    if (name === 'getSmartHomeState') {
      return { status: "success", devices: devices };
    }
    
    if (name === 'toggleLight') {
      const { room, state } = args;
      let matchedCount = 0;
      const updatedDevices = devices.map(d => {
         const isMatch = d.location.toLowerCase().includes(room.toLowerCase()) || 
                         d.name.toLowerCase().includes(room.toLowerCase());
         if (isMatch && d.type === 'light') {
           matchedCount++;
           return { ...d, state: state };
         }
         return d;
      });
      if (matchedCount > 0) {
        setDevices(updatedDevices);
        return { status: "success", message: `Updated ${matchedCount} devices` };
      } else {
        return { status: "error", message: `No devices found matching '${room}'` };
      }
    }
    
    if (name === 'launchApp') {
      const { appName } = args;
      try {
        addLog(`Launching: ${appName}`, "info", "SYSTEM");
        await invoke('launch_app', { appName });
        addLog(`Successfully launched ${appName}`, "success", "SYSTEM");
        return { status: "success", message: `Application ${appName} launched.` };
      } catch (e: any) {
        addLog(`Failed to launch ${appName}: ${e}`, "error", "SYSTEM");
        return { status: "error", message: e.toString() };
      }
    }

    if (name === 'scanEnvironment') {
      if (!videoStream) return { status: "error", message: "Vision offline." };
      setIsScanning(true);
      return { status: "success", message: "Scanning initiated..." };
    }

    if (name === 'proposeSystemUpdate') {
      setPendingUpdate({
        code: args.code,
        description: args.description,
        riskLevel: args.riskLevel || 'HIGH'
      });
      return { status: "pending_auth", message: "User authorization requested. Waiting for manual override." };
    }

    return { status: "error", message: "Unknown tool" };
  };

  const handleConfirmUpdate = async () => {
    if (!pendingUpdate) return;
    setIsTestingUpdate(true);
    addLog("Initiating Sandbox Environment...", "warning");

    await new Promise(r => setTimeout(r, 1500));

    try {
      const safeFunction = new Function('document', 'console', pendingUpdate.code);
      
      const sandboxConsole = {
        log: (msg: string) => addLog(msg, 'info', 'SCRIPT_OUT'),
        warn: (msg: string) => addLog(msg, 'warning', 'SCRIPT_OUT'),
        error: (msg: string) => addLog(msg, 'error', 'SCRIPT_OUT'),
      };

      safeFunction(document, sandboxConsole);
      
      addLog("Diagnostics Passed. Patch Applied Successfully.", "success");
      setPendingUpdate(null);
    } catch (e: any) {
      addLog(`Update Failed Verification: ${e.message}`, "error");
    } finally {
      setIsTestingUpdate(false);
    }
  };

  const initiateStartup = async () => {
    if (connectionState === ConnectionState.CONNECTED) return;
    
    setConnectionState(ConnectionState.CONNECTING);
    addLog(`Initializing ${selectedModel.name}...`, "info");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      setVideoStream(mediaStream);
      setPendingStream(mediaStream); 
      setShowCalibration(true);

    } catch (e: any) {
      addLog(`Sensor Error: ${e.message}`, "warning");
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setVideoStream(null);
        setPendingStream(audioStream);
        setShowCalibration(true);
      } catch (e2) {
        setConnectionState(ConnectionState.ERROR);
        addLog("Critical Sensor Failure", "error");
      }
    }
  };

  const finalizeConnection = async () => {
    setShowCalibration(false);
    if (!pendingStream) return;

    addLog("Biometrics Verified. Access Granted.", "success");

    const client = new GeminiClient({
      onLog: addLog,
      onAudioLevel: (i, o) => setAudioVol({ in: i, out: o }),
      onToolCall: handleToolCall
    });

    try {
        await client.connect(pendingStream, selectedModel.id);
        aiRef.current = client;
        setConnectionState(ConnectionState.CONNECTED);
    } catch (e: any) {
      setConnectionState(ConnectionState.ERROR);
      addLog(`Initialization Failed: ${e.message}`, "error");
    }
  };

  const handleVideoFrame = (base64: string) => {
    if (isScanning && aiRef.current) {
      aiRef.current.analyzeImage(base64);
      setIsScanning(false);
    }
  };

  const handleDisconnect = () => {
    if (aiRef.current) {
      aiRef.current.disconnect();
      aiRef.current = null;
    }
    setConnectionState(ConnectionState.DISCONNECTED);
    setVideoStream(null);
    setPendingStream(null);
    setAudioVol({ in: 0, out: 0 });
    addLog("System Disengaged.", "warning");
  };

  const calculateLoad = () => {
    if (connectionState !== ConnectionState.CONNECTED) return 0;
    let load = selectedModel.tier === 'LOW' ? 10 : selectedModel.tier === 'MEDIUM' ? 40 : 85;
    if (selectedModel.provider === 'GEMINI') load = load / 3; 
    
    if (audioVol.in > 0.05) load += 10; 
    if (audioVol.out > 0.05) load += 10; 
    if (isScanning) load += 20; 
    if (pendingUpdate) load += 30;
    return Math.min(100, load + Math.random() * 5);
  };

  const getTierColor = (tier: string) => {
      switch(tier) {
          case 'LOW': return 'text-green-400';
          case 'MEDIUM': return 'text-yellow-400';
          case 'HIGH': return 'text-alert-red';
          default: return 'text-cyan-dim';
      }
  };

  return (
    <div className="w-screen h-screen bg-black text-cyan-bright font-sans overflow-hidden flex flex-col p-4 relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {showCalibration && <VoiceCalibration onComplete={finalizeConnection} stream={pendingStream} />}
      
      {pendingUpdate && (
        <SystemUpdateUI 
          update={pendingUpdate}
          isTesting={isTestingUpdate}
          onConfirm={handleConfirmUpdate}
          onDeny={() => {
             setPendingUpdate(null);
             addLog("Update Aborted by User.", "warning");
          }}
        />
      )}

      <header className="flex justify-between items-center mb-4 z-50 relative border-b border-cyan-900 pb-2 bg-black/80 backdrop-blur-sm">
        <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-widest text-shadow-glow">J.A.R.V.I.S. <span className="text-xs align-top opacity-70">MK. IX</span></h1>
            <div className="text-[10px] text-cyan-dim font-mono tracking-wider">
                ACTIVE MODEL: <span className="text-cyan-bright">{selectedModel.name}</span>
            </div>
        </div>
        
        {connectionState === ConnectionState.DISCONNECTED && (
          <div className="relative">
             <button 
               onClick={() => setShowModelMenu(!showModelMenu)}
               className="px-4 py-1 border border-cyan-bright text-xs font-mono bg-black hover:bg-cyan-900/30 transition-all flex items-center gap-2 cursor-pointer z-50"
             >
               SYSTEM CONFIG
               <span className={`w-2 h-2 rounded-full ${selectedModel.provider === 'GEMINI' ? 'bg-blue-400' : 'bg-orange-400'}`}></span>
             </button>
             
             {showModelMenu && (
                 <div className="absolute top-full right-0 mt-2 w-80 bg-black border border-cyan-bright shadow-[0_0_20px_rgba(0,240,255,0.2)] z-50 max-h-96 overflow-y-auto">
                     <div className="p-2 border-b border-cyan-900 bg-cyan-900/20 text-xs font-bold font-mono">SELECT CORE MODEL</div>
                     {AVAILABLE_MODELS.map(model => (
                         <div 
                            key={model.id}
                            onClick={() => { setSelectedModel(model); setShowModelMenu(false); }}
                            className={`p-3 border-b border-cyan-900/50 cursor-pointer hover:bg-cyan-900/10 transition-all ${selectedModel.id === model.id ? 'bg-cyan-900/30' : ''}`}
                         >
                             <div className="flex justify-between items-center mb-1 pointer-events-none">
                                 <span className="font-bold text-sm">{model.name}</span>
                                 <span className={`text-[10px] px-1 border rounded ${model.provider === 'GEMINI' ? 'border-blue-500 text-blue-400' : 'border-orange-500 text-orange-400'}`}>
                                     {model.provider}
                                 </span>
                             </div>
                             <div className="text-[10px] text-gray-400 mb-1 pointer-events-none">{model.description}</div>
                             <div className="flex justify-between text-[10px] font-mono pointer-events-none">
                                 <span>RES: <span className={getTierColor(model.tier)}>{model.tier}</span></span>
                                 <span>VIS: <span className={model.isVisionCapable ? 'text-green-400' : 'text-gray-600'}>{model.isVisionCapable ? 'YES' : 'NO'}</span></span>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        )}

        <div className="flex gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span>NET:</span>
            <span className={connectionState === ConnectionState.CONNECTED ? 'text-green-400' : 'text-alert-red'}>
              {connectionState === ConnectionState.CONNECTED ? (selectedModel.provider === 'GEMINI' ? 'SAT_LINK' : 'LOCALHOST') : 'OFFLINE'}
            </span>
          </div>
          <div className={calculateLoad() > 80 ? 'text-alert-red' : 'text-cyan-bright'}>
            CPU: {Math.floor(calculateLoad())}%
          </div>
          <div>MEM: {connectionState === ConnectionState.CONNECTED ? (selectedModel.tier === 'HIGH' && selectedModel.provider === 'OLLAMA' ? '32.0GB' : '4.2GB') : 'IDLE'}</div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 z-10 min-h-0 relative">
        
        <div className="col-span-3 flex flex-col gap-4">
           <div className="hud-border bg-black/50 p-4">
              <h3 className="font-bold border-b border-cyan-800 mb-2 text-sm">SYSTEM DIAGNOSTICS</h3>
              <ul className="space-y-2 text-sm font-mono text-cyan-dim">
                <li className="flex justify-between text-cyan-bright">
                  <span>LOGIC_CORE</span>
                  <span>[{selectedModel.id.split('-')[0].toUpperCase()}]</span>
                </li>
                <li className="flex justify-between"><span>LATENCY</span><span>{selectedModel.provider === 'GEMINI' ? '120ms' : 'LOCAL'}</span></li>
                <li className={`flex justify-between ${isScanning ? 'text-alert-red animate-pulse' : ''}`}>
                  <span>VISION_PROC</span><span>{isScanning ? 'ACTIVE' : 'STANDBY'}</span>
                </li>
              </ul>
           </div>
           
           <SmartHomePanel devices={devices} />
        </div>

        <div className="col-span-6 flex flex-col items-center justify-center relative">
          <ArcReactor isListening={audioVol.in > 0.05} speakingVolume={audioVol.out} />
          
          {connectionState !== ConnectionState.CONNECTED ? (
             <button 
                onClick={initiateStartup}
                disabled={connectionState === ConnectionState.CONNECTING}
                className="mt-12 px-8 py-2 border border-cyan-bright text-cyan-bright hover:bg-cyan-bright hover:text-black transition-all font-mono tracking-widest uppercase z-20 cursor-pointer"
             >
                {connectionState === ConnectionState.CONNECTING ? 'INITIALIZING...' : `ENGAGE ${selectedModel.provider}`}
             </button>
          ) : (
            <button 
                onClick={handleDisconnect}
                className="mt-12 px-8 py-2 border border-alert-red text-alert-red hover:bg-alert-red hover:text-black transition-all font-mono tracking-widest uppercase text-xs z-20 cursor-pointer"
             >
                TERMINATE SESSION
             </button>
          )}

          <div className="mt-8 h-8 text-center text-cyan-200 font-mono text-sm animate-pulse">
            {audioVol.out > 0.1 ? "TRANSMITTING DATA..." : (audioVol.in > 0.05 ? "RECEIVING INPUT..." : "")}
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="h-48">
            <VideoHUD onFrame={handleVideoFrame} isActive={isScanning} videoStream={videoStream} />
          </div>
          <div className="flex-1 min-h-0">
            <Terminal logs={logs} />
          </div>
        </div>

      </main>

      <footer className="mt-4 border-t border-cyan-900 pt-2 flex justify-between text-[10px] text-gray-500 font-mono z-10">
         <div>{selectedModel.provider === 'GEMINI' ? `SECURE CHANNEL: ${selectedModel.id}` : `LOCAL INFERENCE: ${selectedModel.id}`}</div>
         <div>RES_USAGE: {selectedModel.tier}</div>
      </footer>
    </div>
  );
};

export default App;