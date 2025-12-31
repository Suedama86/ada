import { JARVIS_SYSTEM_INSTRUCTION } from "../constants";

interface OllamaServiceProps {
  onLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error', source?: string) => void;
  onAudioLevel: (input: number, output: number) => void;
  onToolCall: (name: string, args: any) => Promise<any>;
}

export class OllamaService {
  private props: OllamaServiceProps;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private recognition: any = null;
  private synth: SpeechSynthesis = window.speechSynthesis;
  private isListening: boolean = false;
  private isSessionActive: boolean = false; // Tracks if Jarvis is "Awake"
  private conversationHistory: any[] = [];
  
  // Configuration
  private textModel = 'llama3'; 
  private visionModel = 'llava';
  private ollamaHost = 'http://localhost:11434';

  constructor(props: OllamaServiceProps) {
    this.props = props;
  }

  async connect(stream: MediaStream, modelId: string) {
    this.textModel = modelId; // Set the selected model
    this.props.onLog(`Initializing Local Neural Net (${this.textModel})...`, "info");
    
    this.mediaStream = stream;
    this.setupAudioAnalysis(stream);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.props.onLog("Browser does not support Speech Recognition", "error");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (!this.synth.speaking) {
         try { this.recognition.start(); } catch(e) {}
      }
    };

    this.recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim().length > 0) {
        const cleanText = transcript.trim().toLowerCase();
        
        // --- SESSION LOGIC ---
        
        // 1. Check for Termination (Sleep)
        if (this.isSessionActive && (cleanText.includes('jarvis sleep') || cleanText.includes('jarvis vila') || cleanText.includes('dismissed'))) {
           this.isSessionActive = false;
           this.props.onLog("Mode: STANDBY", "warning", "SYSTEM");
           this.speak("Standing by.");
           return;
        }

        // 2. Check for Activation (Wake)
        if (!this.isSessionActive) {
            if (cleanText.startsWith('jarvis')) {
                this.isSessionActive = true;
                this.props.onLog("Mode: ACTIVE", "success", "SYSTEM");
                // If there is more text after "Jarvis", process it. 
                // E.g., "Jarvis turn on lights" -> processed. 
                // "Jarvis" -> just wakes up.
                if (cleanText.trim() === 'jarvis') {
                    this.speak("Online.");
                    return;
                }
            } else {
                // Ignore input in Standby
                this.props.onLog(`Ignored: "${transcript}"`, "info", "STANDBY");
                return;
            }
        }

        // 3. Process Input (If Active or just Activated)
        this.props.onLog(transcript, "info", "USER");
        await this.processInput(transcript);
      }
    };

    this.conversationHistory = [
      { role: 'system', content: JARVIS_SYSTEM_INSTRUCTION + "\n\nIMPORTANT: You are running LOCALLY via Ollama. If you need to use a tool, output ONLY JSON in this format: { \"tool\": \"toolName\", \"args\": { ... } }." }
    ];

    try {
      this.recognition.start();
      this.props.onLog(`Local Core Online. Using ${this.textModel}`, "success");
    } catch (e) {
      this.props.onLog("Failed to start microphone listener", "error");
    }
  }

  private setupAudioAnalysis(stream: MediaStream) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    const updateVolume = () => {
      if (!this.audioContext) return;
      analyzer.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      const inputVol = avg / 128.0;

      const outputVol = this.synth.speaking ? Math.random() * 0.8 + 0.2 : 0;

      this.props.onAudioLevel(inputVol, outputVol);
      requestAnimationFrame(updateVolume);
    };
    updateVolume();
  }

  private async processInput(text: string, imageBase64?: string) {
    this.recognition.stop();

    this.conversationHistory.push({
      role: 'user',
      content: text,
      images: imageBase64 ? [imageBase64] : undefined
    });

    try {
      let model = this.textModel;
      if (imageBase64) {
          model = this.visionModel;
          this.props.onLog(`Switching to ${model} for visual analysis...`, "info");
      }
      
      const response = await fetch(`${this.ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: this.conversationHistory,
          stream: false,
          format: "json" 
        })
      });

      if (!response.ok) throw new Error("Ollama connection failed");

      const data = await response.json();
      let reply = data.message.content;

      try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const potentialTool = JSON.parse(jsonMatch[0]);
            if (potentialTool.tool && potentialTool.args) {
                this.props.onLog(`Executing: ${potentialTool.tool}`, "info", "TOOL");
                const result = await this.props.onToolCall(potentialTool.tool, potentialTool.args);
                
                this.conversationHistory.push({ role: 'assistant', content: reply });
                this.conversationHistory.push({ role: 'user', content: `Tool Result: ${JSON.stringify(result)}. Reply to user based on this.` });
                
                await this.processInput("Generate response based on tool result.");
                return;
            }
        }
      } catch (e) {}

      this.conversationHistory.push({ role: 'assistant', content: reply });
      this.props.onLog(reply, "success", "JARVIS");
      this.speak(reply);

    } catch (error: any) {
      this.props.onLog(`Ollama Error: ${error.message}. Is model '${this.textModel}' pulled?`, "error");
      this.speak("I cannot reach my local brain servers, sir.");
    }
  }

  public async analyzeImage(base64Image: string) {
    this.props.onLog("Analyzing visual frame...", "info");
    await this.processInput("Describe specifically what you see in this image in one short sentence.", base64Image);
  }

  private speak(text: string) {
    if (this.synth.speaking) this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = this.synth.getVoices();
    const jarvisVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('David')) || voices[0];
    utterance.voice = jarvisVoice;
    utterance.pitch = 0.9;
    utterance.rate = 1.1;

    utterance.onend = () => {
      try { this.recognition.start(); } catch(e) {}
    };

    this.synth.speak(utterance);
  }

  public disconnect() {
    this.recognition?.stop();
    this.synth.cancel();
    this.audioContext?.close();
  }
}