'use client';

import { useState } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { RiskGauge } from '@/components/ui/RiskGauge';
import { RiskTrendChart } from '@/components/ui/RiskTrendChart';
import { ActivityFeed } from '@/components/ui/ActivityFeed';
import { StatusBadge, RiskBadge } from '@/components/ui/Badges';
import { getAgents, getActivityEvents } from '@/lib/mock-data';
import { ShieldAlert } from 'lucide-react';

export default function CommandCenter() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const agents = getAgents();
  const activityEvents = getActivityEvents();

  const handleScan = () => {
    setIsScanning(true);
    setScanComplete(false);
    
    // Simulate a scan delay
    setTimeout(() => {
      setIsScanning(false);
      setScanComplete(true);
      
      // Hide the success message after 5 seconds
      setTimeout(() => setScanComplete(false), 5000);
    }, 2000);
  };

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex justify-end items-center mb-6">
        <button 
          onClick={handleScan}
          disabled={isScanning}
          className="bg-[#5b9dff] hover:bg-[#4a85e0] text-[#0d0f12] font-semibold px-4 py-2 rounded-[6px] transition-colors disabled:opacity-50"
        >
          {isScanning ? 'Scanning...' : 'Run Scan'}
        </button>
      </div>

      {/* Scan Results Notification */}
      {scanComplete && (
        <div className="bg-[#5b9dff]/10 border border-[#5b9dff]/20 text-[#5b9dff] px-4 py-3 rounded-[6px] flex items-center mb-6 text-sm">
          <ShieldAlert className="w-4 h-4 mr-2" />
          Security scan completed. 3 new risk events detected.
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total Identities" value={184} trend="+12 this week" trendUp={false} />
        <MetricCard title="Active AI Agents" value={24} trend="+3 this week" trendUp={false} />
        <MetricCard title="High Risk" value={17} trend="-2 from yesterday" trendUp={false} alert={true} />
        <MetricCard title="Critical" value={4} trend="+1 from yesterday" trendUp={true} alert={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Risk Posture */}
        <div className="bg-[#111318] border border-[#23262b] rounded-[10px] p-6 lg:col-span-1">
          <h3 className="text-primary-text text-sm font-medium mb-6">Enterprise Risk Posture</h3>
          <RiskGauge score={72} />
          
          <div className="grid grid-cols-2 gap-4 mt-6 border-t border-[#23262b] pt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#9a9da3]">Critical</span>
              <span className="text-[#ff6b6b] font-semibold">4</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#9a9da3]">High Risk</span>
              <span className="text-[#f2a623] font-semibold">13</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#9a9da3]">Medium</span>
              <span className="text-[#9a9da3] font-semibold">52</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#9a9da3]">Healthy</span>
              <span className="text-[#5bd48f] font-semibold">115</span>
            </div>
          </div>
          <p className="text-[#6b6e75] text-[10px] text-center mt-4">Demo telemetry only</p>
        </div>

        {/* Risk Trend */}
        <div className="bg-[#111318] border border-[#23262b] rounded-[10px] p-6 lg:col-span-2 flex flex-col">
          <h3 className="text-primary-text text-sm font-medium mb-2">Risk Trend</h3>
          <RiskTrendChart />
        </div>
      </div>

      {/* Connected Systems Table */}
      <div className="bg-[#111318] border border-[#23262b] rounded-[10px] p-0 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-[#23262b]">
          <h3 className="text-primary-text text-sm font-medium">AI Agents — Connected Systems</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-primary-text border-collapse">
            <thead className="text-xs text-[#9a9da3] border-b border-[#23262b] bg-[#111318]">
              <tr>
                <th className="px-6 py-3 font-medium">Agent</th>
                <th className="px-6 py-3 font-medium">Environment</th>
                <th className="px-6 py-3 font-medium">Risk</th>
                <th className="px-6 py-3 font-medium">Last Action</th>
                <th className="px-6 py-3 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {agents.slice(0, 4).map((agent) => {
                // Find last action for the agent
                const lastEvent = activityEvents.find(e => e.actorId === agent.id);
                
                return (
                  <tr key={agent.id} className="border-b border-[#23262b] hover:bg-[#23262b]/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{agent.name}</td>
                    <td className="px-6 py-4 text-[#9a9da3]">{agent.environment}</td>
                    <td className="px-6 py-4">
                      <RiskBadge score={agent.riskScore} />
                    </td>
                    <td className="px-6 py-4 font-mono text-xs max-w-[200px] truncate">
                      {lastEvent ? `${lastEvent.action} ${lastEvent.resource}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {lastEvent ? <StatusBadge status={lastEvent.decision} /> : <span className="text-[#6b6e75]">N/A</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#111318] border border-[#23262b] rounded-[10px] p-0 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-[#23262b]">
          <h3 className="text-primary-text text-sm font-medium">Recent Activity</h3>
        </div>
        <ActivityFeed events={activityEvents.slice(0, 5)} />
      </div>
      
    </div>
  );
}
