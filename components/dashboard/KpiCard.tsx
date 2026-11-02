export function KpiCard({
  label,
  value,
  change,
  tone,
  testId
}: {
  label: string;
  value: string;
  change: string;
  tone: "blue" | "violet" | "orange" | "green";
  testId?: string;
}) {
  const badgeStyles = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-blue-50 text-blue-700 border-blue-200",
    orange: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200"
  };

  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-mono tabular-nums">{value}</p>
      <p className={`mt-3 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeStyles[tone]}`}>
        {change}
      </p>
    </section>
  );
}
