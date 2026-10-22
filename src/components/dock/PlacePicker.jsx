import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Rocket, Mountain, MapPin, Flag, X } from 'lucide-react';
import { PLACES } from '../../data/places';
import { areaOf } from '../../utils/useDetailAreas';

const ICON = { site: Rocket, feature: Mountain, base: MapPin, target: Flag };

/**
 * A searchable list of places to start or end a walk at. When the other end is already chosen, the
 * places on the same 200 m terrain are listed first, since only those can be walked between.
 */
export default function PlacePicker({ title, otherPoint, areas, onPick, onClose }) {
  const [q, setQ] = useState('');
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);

  const otherArea = areaOf(areas, otherPoint);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PLACES
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.sub || '').toLowerCase().includes(needle))
      .map((p) => {
        const area = areaOf(areas, p);
        return { ...p, area, same: !!otherArea && area?.id === otherArea.id };
      })
      .sort((a, b) => (Number(b.same) - Number(a.same)) || (Number(!!b.area) - Number(!!a.area)));
  }, [q, areas, otherArea]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.07]">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
          placeholder={`Search places for ${title.toLowerCase()}`}
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
          aria-label={`Search places for ${title}`}
        />
        <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close the list"><X className="w-3.5 h-3.5" /></button>
      </div>
      <ul className="max-h-60 overflow-y-auto custom-scrollbar-y py-1" role="listbox" aria-label="Places">
        {otherArea && items.some((i) => i.same) && (
          <li className="px-3 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-emerald-300/80">Same terrain as the other end ({otherArea.name})</li>
        )}
        {items.length === 0 && <li className="px-3 py-4 text-sm text-zinc-400">No place matches "{q}".</li>}
        {items.map((p, i) => {
          const Icon = ICON[p.kind] || MapPin;
          const showDivider = otherArea && i > 0 && items[i - 1].same && !p.same;
          return (
            <li key={p.id} role="option" aria-selected="false">
              {showDivider && <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-zinc-500">Other places</div>}
              <button onClick={() => onPick(p)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.07] transition-colors cursor-pointer">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.same ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-zinc-300'}`}><Icon className="w-4 h-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white truncate">{p.name}</span>
                  <span className="block text-xs text-zinc-400 truncate">{p.sub}</span>
                </span>
                {p.area && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300 shrink-0" title={`200 m terrain: ${p.area.name}`}>200 m</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
