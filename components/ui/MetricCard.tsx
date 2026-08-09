interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  alert?: boolean;
}

export function MetricCard({ title, value, trend, trendUp, alert }: MetricCardProps) {
  return (
    <div className="bg-[#111318] border border-[#23262b] rounded-[10px] p-5 flex flex-col justify-between">
      <h3 className="text-[#9a9da3] text-sm font-medium">{title}</h3>
      <div className="mt-4 flex items-baseline justify-between">
        <span className={`text-3xl font-semibold ${alert ? 'text-[#ff6b6b]' : 'text-primary-text'}`}>
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-[6px] ${
            trendUp === false && !alert 
              ? 'bg-[#5bd48f]/10 text-[#5bd48f]' 
              : trendUp 
                ? 'bg-[#ff6b6b]/10 text-[#ff6b6b]' 
                : 'bg-[#23262b] text-[#9a9da3]'
          }`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
