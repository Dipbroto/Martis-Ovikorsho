import { useState } from 'react';
import { ChevronDown, Info, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { marsLayers, LAYER_CATEGORIES } from '../data/marsLayers';

// Layers are grouped by the category labels defined in the layer data
const CATEGORY_LIST = Object.values(LAYER_CATEGORIES);

const Switch = ({ on }) => (
  <span className={`relative inline-block w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-[#F26A3D]' : 'bg-white/15'}`}>
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
  </span>
);

const LayerItem = ({ layer, isActive, opacity, onToggle, onOpacityChange, onFlyTo }) => {
  const [showInfo, setShowInfo] = useState(false);
  const derived = layer.category === LAYER_CATEGORIES.DERIVED;

  return (
    <div className={`rounded-xl border transition-colors ${isActive ? 'border-[#F26A3D]/35 bg-[#F26A3D]/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
      <div className="flex items-center gap-2 pr-2">
        <button
          onClick={() => onToggle(layer.id)}
          role="switch"
          aria-checked={isActive}
          className="flex-1 min-w-0 flex items-center gap-3 text-left pl-3 py-2.5 cursor-pointer"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white leading-snug">{layer.name}</span>
            <span className="block text-xs text-zinc-400 leading-snug mt-0.5">{[layer.mission, layer.resolution].filter(Boolean).join(' · ')}</span>
          </span>
          <Switch on={isActive} />
        </button>
        <button
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          aria-label={`About ${layer.name}`}
          title="About this layer"
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 cursor-pointer ${showInfo ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-0.5">
              <label className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="w-14 shrink-0">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value, 10))}
                  className="flex-1 h-1 bg-white/15 rounded-full appearance-none cursor-pointer accent-[#F26A3D]"
                />
                <span className="w-9 text-right tabular-nums text-zinc-300">{Math.round(opacity)}%</span>
              </label>
              {layer.legend && (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full" style={{ background: layer.legend.gradient || `linear-gradient(to right, ${layer.legend.colors?.join(', ')})` }} />
                  <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
                    <span>{layer.legend.min}</span>
                    <span>{layer.legend.max}</span>
                  </div>
                </div>
              )}
              {layer.landingSite && (
                <button
                  type="button"
                  onClick={() => onFlyTo?.(layer.landingSite.lat, layer.landingSite.lon, layer.landingSite.zoom)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold cursor-pointer transition-all active:scale-95"
                >
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Zoom to {layer.landingSite.name} (Sub-Meter View)</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showInfo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mx-3 mb-3 rounded-lg bg-black/25 p-3 text-xs text-zinc-300 leading-relaxed">
              <p>{layer.description || 'No description available.'}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div><dt className="text-zinc-500">Instrument</dt><dd className="text-zinc-200">{layer.instrument || 'n/a'}</dd></div>
                <div><dt className="text-zinc-500">Resolution</dt><dd className="text-zinc-200">{layer.resolution || 'n/a'}</dd></div>
                <div className="col-span-2"><dt className="text-zinc-500">Kind of data</dt><dd className="text-zinc-200">{derived ? 'Derived from NASA measurements' : 'Observed by a NASA instrument'}</dd></div>
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LayerCategory = ({ name, layers }) => {
  const [isOpen, setIsOpen] = useState(true);
  const activeLayers = useMapStore((s) => s.activeLayers) || [];
  const layerOpacity = useMapStore((s) => s.layerOpacity) || {};
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const flyToCoordinate = useMapStore((s) => s.flyToCoordinate);
  const setLayerOpacity = useMapStore((s) => s.setLayerOpacity);
  const on = layers.filter((l) => activeLayers.includes(l.id)).length;

  return (
    <section>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-2 py-1 text-left cursor-pointer group"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">{name}</span>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          {on > 0 && <span className="rounded-full bg-[#F26A3D]/20 text-[#ffb08f] px-1.5 py-px tabular-nums">{on} on</span>}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-2 pt-2 pb-1">
              {layers.map((layer) => (
                <LayerItem
                  key={layer.id}
                  onFlyTo={flyToCoordinate}
                  layer={layer}
                  isActive={activeLayers.includes(layer.id)}
                  opacity={Math.round((layerOpacity[layer.id] !== undefined ? layerOpacity[layer.id] : layer.defaultOpacity ?? 1) * 100)}
                  onToggle={toggleLayer}
                  onOpacityChange={(id, pct) => setLayerOpacity(id, pct / 100)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const LayerPanel = () => (
  <div className="flex flex-col gap-4">
    {CATEGORY_LIST.map((category) => {
      const layers = marsLayers.filter((l) => l.category === category);
      return layers.length ? <LayerCategory key={category} name={category} layers={layers} /> : null;
    })}
  </div>
);

export default LayerPanel;
