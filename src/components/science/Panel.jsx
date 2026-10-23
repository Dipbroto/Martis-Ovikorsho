export default function Panel({ title, icon: Icon, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#0a0c12]/40 backdrop-blur-md p-5 sm:p-6 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            {Icon && <Icon className="w-4 h-4 text-[#ffa07f]" />}{title}
          </h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** Where a number on screen comes from: instrument, sol and the NASA PDS product name. */
export function Provenance({ children }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 break-words">{children}</p>;
}
