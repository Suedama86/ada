import React, { useState } from 'react';
import { PendingUpdate } from '../types';

interface SystemUpdateUIProps {
  update: PendingUpdate;
  onConfirm: () => void;
  onDeny: () => void;
  isTesting: boolean;
}

const SystemUpdateUI: React.FC<SystemUpdateUIProps> = ({ update, onConfirm, onDeny, isTesting }) => {
  return (
    <div className="absolute inset-0 bg-black/90 z-[60] flex items-center justify-center backdrop-blur-sm">
      <div className="w-[600px] hud-border bg-black p-6 flex flex-col gap-4 shadow-[0_0_50px_rgba(255,42,42,0.2)]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-alert-red pb-2">
          <h2 className="text-xl font-bold text-alert-red tracking-widest animate-pulse">SYSTEM UPDATE PROPOSAL</h2>
          <span className="text-xs font-mono text-gray-400">AUTH_REQUIRED</span>
        </div>

        {/* Description */}
        <div className="font-mono text-sm text-cyan-bright">
          <span className="text-gray-500">MODULE_DESC:</span> {update.description}
        </div>

        {/* Code Preview */}
        <div className="bg-gray-900/50 p-4 rounded border border-gray-800 font-mono text-[10px] text-green-400 h-48 overflow-y-auto whitespace-pre-wrap">
          {update.code}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 text-alert-red text-xs font-mono border border-alert-red/30 p-2 bg-alert-red/5">
          <span className="text-lg">⚠</span>
          <div>
            WARNING: Direct code injection requested. 
            Risk Level: {update.riskLevel}. 
            Test run required before implementation.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-2">
          <button 
            onClick={onDeny}
            disabled={isTesting}
            className="flex-1 py-3 border border-gray-600 text-gray-400 hover:bg-gray-900 transition-all font-mono uppercase text-sm"
          >
            Abort Protocol
          </button>
          
          <button 
            onClick={onConfirm}
            disabled={isTesting}
            className="flex-1 py-3 border border-cyan-bright text-black bg-cyan-bright hover:bg-white transition-all font-mono uppercase font-bold text-sm relative overflow-hidden"
          >
            {isTesting ? (
              <span className="animate-pulse">RUNNING DIAGNOSTICS...</span>
            ) : (
              "AUTHORIZE & TEST"
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SystemUpdateUI;