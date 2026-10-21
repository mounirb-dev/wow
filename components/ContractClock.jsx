export default function ContractClock({ months }) {
  const total = 48;
  const zone = months <= 12;
  return (
    <div>
      <div className="flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => {
          const on = i < Math.min(months, total);
          const inZone = i < 12;
          return <span key={i} className={`h-6 flex-1 rounded-[2px] ${on ? (inZone ? "bg-amber-400" : "bg-emerald-400/70") : "bg-white/5"}`} />;
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        <span>vencimiento</span>
        <span className={zone ? "text-amber-400" : ""}>{zone ? "zona de palanca · " : ""}{months} meses</span>
        <span>hoy</span>
      </div>
    </div>
  );
}
