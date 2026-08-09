import { ActivityEvent } from '@/types/nexus';
import { RiskBadge, StatusBadge } from './Badges';
import { formatTimestamp } from '@/lib/utils';

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left text-sm text-primary-text border-collapse">
        <thead className="text-xs text-[#9a9da3] uppercase border-b border-[#23262b]">
          <tr>
            <th className="px-4 py-3 font-medium">Identity / Agent</th>
            <th className="px-4 py-3 font-medium">Action</th>
            <th className="px-4 py-3 font-medium">Resource</th>
            <th className="px-4 py-3 font-medium">Timestamp</th>
            <th className="px-4 py-3 font-medium">Risk Score</th>
            <th className="px-4 py-3 font-medium">Decision</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-[#23262b] hover:bg-[#23262b]/30 transition-colors">
              <td className="px-4 py-3 font-medium">{event.actor}</td>
              <td className="px-4 py-3 font-mono text-xs">{event.action}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#9a9da3]">{event.resource}</td>
              <td className="px-4 py-3 text-[#9a9da3] text-xs">
                {formatTimestamp(event.timestamp)}
              </td>
              <td className="px-4 py-3">
                <RiskBadge score={event.riskScore} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={event.decision} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
