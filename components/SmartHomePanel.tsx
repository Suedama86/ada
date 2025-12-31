import React from 'react';
import { SmartDevice } from '../types';

interface SmartHomePanelProps {
  devices: SmartDevice[];
}

const SmartHomePanel: React.FC<SmartHomePanelProps> = ({ devices }) => {
  return (
    <div className="hud-border bg-black/80 p-4 font-mono w-full">
      <div className="text-cyan-bright font-bold border-b border-cyan-900 pb-2 mb-4">
        HOME_AUTOMATION_PROTOCOL
      </div>
      <div className="grid grid-cols-2 gap-4">
        {devices.map((device) => (
          <div key={device.id} className={`p-3 border ${device.state ? 'border-cyan-bright bg-cyan-900/20' : 'border-gray-700 bg-transparent'} transition-all`}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400">{device.location.toUpperCase()}</span>
              <div className={`w-2 h-2 rounded-full ${device.state ? 'bg-cyan-bright shadow-[0_0_5px_#00f0ff]' : 'bg-red-900'}`} />
            </div>
            <div className="text-sm font-bold text-cyan-100">{device.name}</div>
            <div className="text-xs text-cyan-500 mt-1">STATUS: {device.state ? 'ONLINE' : 'OFFLINE'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SmartHomePanel;
