import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full w-full bg-black/80 hud-border p-4 font-mono text-xs overflow-hidden flex flex-col">
      <div className="border-b border-cyan-900 pb-2 mb-2 flex justify-between">
        <span className="text-cyan-bright font-bold">TERMINAL OUTPUT</span>
        <span className="animate-pulse text-alert-red">● REC</span>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-gray-500">[{log.timestamp}]</span>
            <span className={`font-bold ${
              log.source === 'JARVIS' ? 'text-cyan-bright' : 
              log.source === 'TOOL' ? 'text-purple-400' :
              'text-green-500'
            }`}>
              {log.source}&gt;&gt;
            </span>
            <span className={`${
              log.type === 'error' ? 'text-alert-red' : 
              log.type === 'warning' ? 'text-yellow-400' : 
              'text-cyan-dim'
            } text-opacity-90`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Terminal;
