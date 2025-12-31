import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Tool } from "@google/genai";
import { JARVIS_SYSTEM_INSTRUCTION } from "../constants.ts";
import { base64ToUint8Array, float32ToInt16, arrayBufferToBase64, decodeAudioData } from "./audioUtils";

// ============ EXECUTION TOOLS ============
const executePythonTool: FunctionDeclaration = {
  name: "execute_python",
  description: "Execute Python code to solve complex tasks. Can do calculations, data analysis, file processing, API calls, etc. Returns stdout, stderr, and exit code.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: "The Python code to execute. Can be multi-line. Use print() for output."
      }
    },
    required: ["code"]
  }
};

const executePowershellTool: FunctionDeclaration = {
  name: "execute_powershell",
  description: "Execute PowerShell commands for Windows system operations. Good for file management, system info, process control.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: "The PowerShell command to execute."
      }
    },
    required: ["command"]
  }
};

const installPythonPackageTool: FunctionDeclaration = {
  name: "install_python_package",
  description: "Install a Python package using pip. Use this before executing Python code that requires external libraries.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      package: {
        type: Type.STRING,
        description: "The pip package name to install (e.g., 'pandas', 'requests', 'beautifulsoup4')."
      }
    },
    required: ["package"]
  }
};

const executeShellTool: FunctionDeclaration = {
  name: "execute_shell",
  description: "Execute a shell command. Cross-platform but use with caution. Prefer execute_powershell for Windows-specific tasks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: "The shell command to execute."
      }
    },
    required: ["command"]
  }
};

// ============ ORIGINAL TOOLS ============
const getSmartHomeStateTool: FunctionDeclaration = {
  name: "getSmartHomeState",
  description: "Get the current status of all smart home devices (lights, locks, thermostats).",
  parameters: { type: Type.OBJECT, properties: {} },
};

const toggleLightTool: FunctionDeclaration = {
  name: "toggleLight",
  description: "Turn a specific smart light on or off.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      room: { type: Type.STRING },
      state: { type: Type.BOOLEAN },
    },
    required: ["room", "state"],
  },
};

const launchAppTool: FunctionDeclaration = {
  name: "launchApp",
  description: "Launches a desktop application on the host machine. Use common names like 'calculator', 'spotify', 'notepad', 'chrome', 'excel'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appName: { type: Type.STRING, description: "The name of the application to launch." },
    },
    required: ["appName"],
  },
};

const scanEnvironmentTool: FunctionDeclaration = {
  name: "scanEnvironment",
  description: "Triggers a visual scan of the current camera feed.",
  parameters: { type: Type.OBJECT, properties: {} },
};

const proposeSystemUpdateTool: FunctionDeclaration = {
  name: "proposeSystemUpdate",
  description: "Propose a code modification or new feature. Use this when the user asks to change how the system behaves, looks, or calculates things.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: "Short description of what the code does" },
      code: { type: Type.STRING, description: "The executable JavaScript code to run in the sandbox." },
      riskLevel: { type: Type.STRING, enum: ["LOW", "HIGH"] }
    },
    required: ["description", "code", "riskLevel"]
  }
};

const tools: Tool[] = [
  { 
    functionDeclarations: [
      // Execution capabilities
      executePythonTool,
      executePowershellTool,
      installPythonPackageTool,
      executeShellTool,
      // Original tools
      getSmartHomeStateTool,
      toggleLightTool,
      launchAppTool,
      scanEnvironmentTool,
      proposeSystemUpdateTool
    ] 
  },
  { googleSearch: {} }
];

interface GeminiClientProps {
  onLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error', source?: string) => void;
  onAudioLevel: (input: number, output: number) => void;
  onToolCall: (name: string, args: any) => Promise<any>;
}

export class GeminiClient {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private props: GeminiClientProps;
  
  // SESSION STATE MANAGEMENT
  private isActive: boolean = false; // JARVIS starts in STANDBY mode
  private recognition: any = null;
  
  constructor(props: GeminiClientProps) {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.props = props;
  }

  async connect(stream: MediaStream, modelId: string) {
    // LIVE API COMPATIBILITY CHECK
    let effectiveModel = modelId;
    
    if (modelId.includes('gemini-3')) {
       this.props.onLog(`Protocol Alert: ${modelId} does not support real-time audio interface.`, 'warning');
       this.props.onLog(`Rerouting neural pathways to Gemini 2.5 Flash (Native Audio)...`, 'info');
       effectiveModel = 'gemini-2.5-flash-native-audio-preview-09-2025';
    }

    this.props.onLog(`Establishing secure connection to Cloud Core (${effectiveModel})...`, "info");

    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    // Setup keyword detection for wake word
    this.setupKeywordDetection();

    try {
      this.sessionPromise = this.client.live.connect({
        model: effectiveModel,
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO],
          tools: tools,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          }
        },
        callbacks: {
          onopen: () => {
            this.props.onLog("Neural Link Established. Mode: STANDBY", "success");
            this.startAudioInput(stream);
          },
          onmessage: this.handleMessage.bind(this),
          onclose: () => {
            this.props.onLog("Connection severed.", "warning");
          },
          onerror: (err) => {
            this.props.onLog(`System Error: ${err.message}`, "error");
          }
        }
      });
    } catch (e: any) {
        this.props.onLog(`Model Handshake Failed: ${e.message}`, "error");
        throw e;
    }
  }

  private setupKeywordDetection() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.props.onLog("Speech Recognition not available. Using voice-only mode.", "warning");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      
      // Check for activation
      if (!this.isActive && transcript.includes('jarvis')) {
        this.isActive = true;
        this.props.onLog("Mode: ACTIVE", "success", "SYSTEM");
      }
      
      // Check for deactivation
      if (this.isActive && (
        transcript.includes('jarvis vila') || 
        transcript.includes('jarvis sleep') ||
        transcript.includes('dismissed') ||
        transcript.includes('stand down')
      )) {
        this.isActive = false;
        this.props.onLog("Mode: STANDBY", "warning", "SYSTEM");
      }
    };

    this.recognition.onerror = (event: any) => {
      // Silently handle errors, speech recognition can be flaky
      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.props.onLog("Could not start speech recognition", "warning");
    }
  }

  private startAudioInput(stream: MediaStream) {
    if (!this.inputContext) return;

    this.inputSource = this.inputContext.createMediaStreamSource(stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      this.props.onAudioLevel(rms * 5, 0); 

      const pcm16 = float32ToInt16(inputData);
      const base64Data = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);

      // ONLY send audio to Gemini when ACTIVE
      if (this.isActive) {
        this.sessionPromise?.then((session) => {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        });
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.outputContext) {
      this.playAudio(audioData);
    }

    const toolCall = message.toolCall;
    if (toolCall) {
      for (const fc of toolCall.functionCalls) {
        this.props.onLog(`Executing: ${fc.name}`, 'info', 'TOOL');
        const result = await this.props.onToolCall(fc.name, fc.args);
        
        this.sessionPromise?.then(session => {
          session.sendToolResponse({
            functionResponses: {
              id: fc.id,
              name: fc.name,
              response: { result }
            }
          });
        });
      }
    }
  }

  private async playAudio(base64Data: string) {
    if (!this.outputContext) return;
    this.props.onAudioLevel(0, 0.8); 

    this.nextStartTime = Math.max(this.outputContext.currentTime, this.nextStartTime);
    const audioBytes = base64ToUint8Array(base64Data);
    const audioBuffer = await decodeAudioData(audioBytes, this.outputContext);
    
    const source = this.outputContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputContext.destination);
    source.start(this.nextStartTime);
    
    this.nextStartTime += audioBuffer.duration;

    source.onended = () => {
       this.props.onAudioLevel(0, 0);
    }
  }

  public async analyzeImage(base64Image: string) {
    this.sessionPromise?.then(session => {
      session.sendRealtimeInput({
        media: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      });
    });
  }

  public disconnect() {
    this.inputSource?.disconnect();
    this.processor?.disconnect();
    this.inputContext?.close();
    this.outputContext?.close();
  }
}