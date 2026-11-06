import {
  getWeatherModel, getMineralModel, getLibsModel, getRadiationModel,
  getTerramechanicsModel, getQuakeModel, getSolarDustModel,
} from '../services/marsMlService';

const pct = (v) => (v == null ? 'n/a' : `${Math.round(v * 1000) / 10}%`);
const num = (v, d = 3) => (v == null ? 'n/a' : (+v).toFixed(d));

const VERDICT = {
  strong: { label: 'Beats baseline', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  fair: { label: 'Good on known types', cls: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  modest: { label: 'Modest', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  weak: { label: 'Weak', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' },
  surrogate: { label: 'Formula fit', cls: 'text-zinc-300 bg-white/5 border-white/15' },
};

/** One row per model family, read from the trained model files so the page never drifts from the models. */
function buildRows() {
  const w = getWeatherModel();
  const ev = w?.evaluation?.sol_plus_1 || {};
  const mineral = getMineralModel()?.metrics || {};
  const libs = getLibsModel();
  const libsMetrics = libs?.metrics || {};
  const beating = libsMetrics.oxides_beating_baseline || [];
  const rad = getRadiationModel()?.metrics || {};
  const terra = getTerramechanicsModel()?.metrics || {};
  const quake = getQuakeModel()?.metadata || {};
  const solar = getSolarDustModel()?.metadata || {};

  return [
    {
      name: 'Weather forecast (next sol)',
      real: true,
      data: `${(w?.metadata?.samples_count || 0).toLocaleString()} Curiosity REMS sols`,
      test: 'Latest 15% of sols, never seen in training',
      score: `T_max R² ${num(ev.t_max?.r2_score)} · pressure MAE ${num(ev.pressure?.mae, 2)} Pa`,
      baseline: `"Tomorrow = today": T_max R² ${num(ev.t_max?.persistence_r2)}`,
      verdict: 'strong',
    },
    {
      name: 'Dust-storm risk',
      real: true,
      data: 'Curiosity REMS; storm label is a temperature-range proxy, not a storm catalogue',
      test: 'Train on earlier sols, test on the next block (time folds)',
      score: `ROC-AUC ${num(ev.dust_storm?.roc_auc, 2)}`,
      baseline: 'Random guessing: ROC-AUC 0.50',
      verdict: 'modest',
    },
    {
      name: 'Rock-type classifier',
      real: true,
      data: `${(mineral.real_points || 0).toLocaleString()} PIXL points from ${mineral.real_rocks || 6} Jezero rocks, + ${(mineral.synthetic_points || 0).toLocaleString()} synthetic (mudstone, carbonate)`,
      test: 'Leave one rock out: each rock classified by a model that never saw it',
      score: `${pct(mineral.leave_one_rock_out_accuracy)} correct (random split: ${pct(mineral.random_split_cv_accuracy)})`,
      baseline: getMineralModel()?.calibration ? `Confidence calibrated (T = ${num(getMineralModel().calibration.temperature, 2)})` : '—',
      verdict: 'fair',
    },
    {
      name: 'SuperCam oxide estimates',
      real: true,
      data: `${libsMetrics.real_laser_points || 30} SuperCam laser points from ${(libsMetrics.real_rocks || []).length || 6} rocks, + synthetic spectra`,
      test: 'Leave one rock out',
      score: `Mean error ${num(libsMetrics.mean_mae, 2)} wt%`,
      baseline: `"Predict the average": ${num(libsMetrics.mean_baseline_mae, 2)} wt%; beats it on ${beating.length} of ${libs?.oxide_targets?.length || 9} oxides (${beating.join(', ') || 'none'})`,
      verdict: 'weak',
    },
    {
      name: 'Radiation dose',
      real: false,
      data: 'Simulated from a dose formula anchored to Curiosity RAD values',
      test: '20% of the simulated data',
      score: `GCR R² ${num(rad.gcr_test_r2)} · SPE ROC-AUC ${num(rad.spe_test_auc ?? rad.spe_auc, 2)}`,
      baseline: 'Reproduces its formula',
      verdict: 'surrogate',
    },
    {
      name: 'Rover terramechanics',
      real: false,
      data: 'Simulated Bekker-Wong soil mechanics, tuned to MER / Curiosity slip events',
      test: '20% of the simulated data',
      score: `Slip R² ${num(terra.slip_r2)} · trap ROC-AUC ${num(terra.trap_auc, 3)}`,
      baseline: 'Reproduces its formulas',
      verdict: 'surrogate',
    },
    {
      name: 'Marsquake shaking',
      real: false,
      data: 'InSight catalogue magnitudes & distances; shaking from a hand-calibrated equation',
      test: '20% of the simulated data',
      score: `PGA R² ${num(quake.r2_score_pga)}`,
      baseline: 'Reproduces its equation',
      verdict: 'surrogate',
    },
    {
      name: 'Solar-array dust',
      real: false,
      data: 'Simulated insolation and dust deposition, tuned to Opportunity Dust Factor trends',
      test: '20% of the simulated data',
      score: `Dust-rate R² ${num(solar.r2_dust_rate)}`,
      baseline: 'Reproduces its formulas',
      verdict: 'surrogate',
    },
  ];
}

/** How well each ML model does on data it did not see, next to the bar it has to beat. */
export default function MlScorecard() {
  const rows = buildRows();
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const v = VERDICT[r.verdict];
        return (
          <div key={r.name} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-white">{r.name}</span>
              <span className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-px rounded border ${r.real ? 'text-violet-200 bg-violet-500/10 border-violet-500/30' : 'text-amber-200 bg-amber-500/10 border-amber-500/30'}`}>
                  {r.real ? 'Real mission data' : 'Surrogate'}
                </span>
                <span className={`text-[10px] px-1.5 py-px rounded border ${v.cls}`}>{v.label}</span>
              </span>
            </div>
            <p className="text-zinc-400 mt-1">{r.data}</p>
            <div className="mt-1.5 grid sm:grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-zinc-500">Tested on: <span className="text-zinc-300">{r.test}</span></span>
              <span className="text-zinc-500">Score: <span className="text-white font-mono">{r.score}</span></span>
              <span className="text-zinc-500">Compared with: <span className="text-zinc-300">{r.baseline}</span></span>
            </div>
          </div>
        );
      })}
      <p className="text-zinc-500 text-[11px]">
        Read live from the trained model files. Retrain with <span className="font-mono">python scripts/ml/train_models.py</span> (packages in <span className="font-mono">scripts/ml/requirements.txt</span>). A surrogate&rsquo;s score says how closely it reproduces its physics formula, not how well it predicts Mars.
      </p>
    </div>
  );
}
