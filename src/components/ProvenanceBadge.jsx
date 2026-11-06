import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, Satellite, Cpu, Calculator, ShieldAlert } from 'lucide-react';

export const PROVENANCE_DEFINITIONS = {
  OBSERVED: {
    label: 'OBSERVED',
    fullName: 'Direct Satellite / In-Situ Observation',
    description: 'Empirical data directly recorded by NASA/ESA instruments (e.g. MGS MOLA laser altimetry, Viking VIS camera, Mars Odyssey THEMIS IR).',
    bgColor: 'bg-emerald-950/70',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    dotColor: 'bg-emerald-400',
    icon: Satellite,
  },
  HISTORICAL: {
    label: 'HISTORICAL',
    fullName: 'Archival Mission Record',
    description: 'Historical records compiled across multi-year Martian surface operations (e.g. Curiosity REMS weather, Perseverance MEDA environmental logs).',
    bgColor: 'bg-cyan-950/70',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    dotColor: 'bg-cyan-400',
    icon: Database,
  },
  DERIVED: {
    label: 'DERIVED',
    fullName: 'Mathematical Geodesic Derivation',
    description: 'Scientifically derived using IAU 2000 planetocentric constants, Haversine spherical math, and Inverse Distance Weighting (IDW) interpolation.',
    bgColor: 'bg-purple-950/70',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    dotColor: 'bg-purple-400',
    icon: Calculator,
  },
  SIMULATED: {
    label: 'SIMULATED',
    fullName: 'Dynamic Physics Simulation',
    description: 'Real-time bioenergetic, radiation shielding, or diurnal atmospheric model based on peer-reviewed planetary formulas.',
    bgColor: 'bg-amber-950/70',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    dotColor: 'bg-amber-400',
    icon: Cpu,
  },
  NASA_SPEC: {
    label: 'NASA SPEC',
    fullName: 'Official NASA Flight Baseline',
    description: 'Formal NASA flight rule requirement, astronaut career radiation exposure ceiling, or life-support consumables budget standard.',
    bgColor: 'bg-red-950/70',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/40',
    dotColor: 'bg-red-400',
    icon: ShieldAlert,
  },
  ML_PREDICTION: {
    label: 'ML PREDICTED',
    fullName: 'NASA Machine Learning Forecast',
    description: 'Predicted in the browser by a model trained on real mission data: 4,700+ daily Curiosity REMS records, or ~5,400 Perseverance PIXL points and 30 SuperCam laser points from 6 Jezero rocks. Scores are measured on sols or rocks the model did not see.',
    bgColor: 'bg-violet-950/70',
    textColor: 'text-violet-300',
    borderColor: 'border-violet-500/40',
    dotColor: 'bg-violet-400',
    icon: Cpu,
  },
  ML_SURROGATE: {
    label: 'ML SURROGATE',
    fullName: 'ML Surrogate of a Physics Model',
    description: 'A fast model fitted to simulated data from published physics formulas, with constants tuned to a few NASA benchmarks. It reproduces those formulas; it was not trained on mission measurements.',
    bgColor: 'bg-amber-950/70',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/40',
    dotColor: 'bg-amber-400',
    icon: Cpu,
  },
};

const SHORT = {
  OBSERVED: 'Observed',
  HISTORICAL: 'Historical',
  DERIVED: 'Derived',
  SIMULATED: 'Simulated',
  NASA_SPEC: 'NASA spec',
  ML_PREDICTION: 'ML Predicted',
  PREDICTED_ML: 'ML Predicted',
  ML_SURROGATE: 'ML surrogate',
};

/**
 * A quiet pill saying where a number comes from. The detail and the long explanation live in a
 * tooltip drawn on the page (not inside the panel), so a narrow, scrolling sidebar never clips it.
 */
export default function ProvenanceBadge({ type = 'OBSERVED', size = 'sm', detail = '', className = '' }) {
  const [tip, setTip] = useState(null);
  const config = PROVENANCE_DEFINITIONS[type] || PROVENANCE_DEFINITIONS.OBSERVED;
  const Icon = config.icon;

  const sizeClasses = size === 'md' ? 'text-xs px-2.5 py-1 gap-1.5' : 'text-[11px] px-2 py-0.5 gap-1.5';

  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const width = 240;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = r.top < 150;
    setTip({ left, top: below ? r.bottom + 8 : r.top - 8, below, width });
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        onClick={(e) => (tip ? setTip(null) : show(e))}
        tabIndex={0}
        onFocus={show}
        onBlur={() => setTip(null)}
        className={`inline-flex items-center whitespace-nowrap font-medium rounded-full border cursor-help select-none transition-colors ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses} hover:brightness-125`}
        aria-label={`${SHORT[type] || config.label}: ${config.fullName}${detail ? `, ${detail}` : ''}`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{SHORT[type] || config.label}</span>
      </span>

      {tip && createPortal(
        <div
          className="fixed z-[9999] p-3 bg-[#0B0D12] border border-white/15 rounded-xl shadow-2xl text-xs text-zinc-200 pointer-events-none"
          style={{ left: tip.left, top: tip.top, width: tip.width, transform: tip.below ? 'none' : 'translateY(-100%)' }}
          role="tooltip"
        >
          <div className={`font-semibold flex items-center gap-1.5 mb-1 ${config.textColor}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{config.fullName}</span>
          </div>
          {detail && <div className="text-white font-medium mb-0.5">{detail}</div>}
          <p className="leading-relaxed text-zinc-400">{config.description}</p>
        </div>,
        document.body,
      )}
    </span>
  );
}
