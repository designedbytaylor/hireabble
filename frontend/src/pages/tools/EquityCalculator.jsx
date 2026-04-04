import { useState } from 'react';
import { TrendingUp, Calculator } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const VESTING_SCHEDULES = [
  { value: '4y-cliff', label: '4 years with 1 year cliff' },
  { value: '3y-monthly', label: '3 years monthly' },
  { value: '4y-monthly', label: '4 years monthly' },
  { value: 'vested', label: 'Fully vested' },
];

const COMPANY_STAGES = [
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c', label: 'Series C' },
  { value: 'pre-ipo', label: 'Pre-IPO' },
  { value: 'public', label: 'Public' },
];

const STAGE_NOTES = {
  'pre-seed': 'Pre-seed equity carries the highest risk but highest potential upside. Most pre-seed companies do not reach exit.',
  'seed': 'Seed-stage equity is high risk. Historically, roughly 10% of seed-funded startups achieve a successful exit.',
  'series-a': 'Series A companies have validated product-market fit, but significant risk remains. Liquidity is typically 5-8 years away.',
  'series-b': 'Series B indicates strong growth. Your equity is more likely to have value, but dilution from future rounds will reduce your percentage.',
  'series-c': 'Series C companies are scaling rapidly. The path to liquidity is clearer, but upside multiples are more modest.',
  'pre-ipo': 'Pre-IPO equity has the clearest path to liquidity. Consider secondary market sales if available, and watch for lockup periods.',
  'public': 'Public company stock has immediate liquidity. Consider tax-efficient exercise strategies and diversification.',
};

const fmt = n => '$' + Math.round(n).toLocaleString();

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">Month {label}</p>
      <p className="text-primary">{fmt(payload[0].value)}</p>
      <p className="text-muted-foreground text-xs">{Math.round(payload[0].payload.vestedShares).toLocaleString()} shares vested</p>
    </div>
  );
};

function getVestingTimeline(totalShares, schedule, strikePrice, currentPrice) {
  const data = [];
  let months;
  let cliffMonths = 0;

  switch (schedule) {
    case '4y-cliff':
      months = 48;
      cliffMonths = 12;
      break;
    case '3y-monthly':
      months = 36;
      break;
    case '4y-monthly':
      months = 48;
      break;
    case 'vested':
      return [{ month: 0, vestedShares: totalShares, value: totalShares * Math.max(0, currentPrice - strikePrice) }];
    default:
      months = 48;
  }

  for (let m = 0; m <= months; m += 1) {
    let vestedShares;
    if (cliffMonths > 0 && m < cliffMonths) {
      vestedShares = 0;
    } else if (cliffMonths > 0 && m === cliffMonths) {
      vestedShares = totalShares * (cliffMonths / months);
    } else {
      vestedShares = totalShares * (m / months);
    }
    const value = vestedShares * Math.max(0, currentPrice - strikePrice);
    if (m % 3 === 0 || m === months) {
      data.push({ month: m, vestedShares, value });
    }
  }

  return data;
}

export default function EquityCalculator() {
  const [inputs, setInputs] = useState({
    shares: '',
    strikePrice: 0,
    currentPrice: '',
    schedule: '4y-cliff',
    vestingProgress: 0,
    stage: 'series-a',
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const calculate = (e) => {
    e.preventDefault();
    const shares = Number(inputs.shares) || 0;
    const strikePrice = Number(inputs.strikePrice) || 0;
    const currentPrice = Number(inputs.currentPrice) || 0;
    const vestingProgress = Number(inputs.vestingProgress) || 0;

    const vestedShares = Math.round(shares * vestingProgress / 100);
    const unvestedShares = shares - vestedShares;
    const currentSpread = Math.max(0, currentPrice - strikePrice);
    const currentVestedValue = vestedShares * currentSpread;
    const totalCurrentValue = shares * currentSpread;

    const multipliers = [1, 2, 5, 10, 20];
    const scenarios = multipliers.map(mult => {
      const futurePrice = currentPrice * mult;
      const spread = Math.max(0, futurePrice - strikePrice);
      return {
        multiplier: `${mult}x`,
        sharePrice: futurePrice,
        vestedValue: vestedShares * spread,
        totalValue: shares * spread,
      };
    });

    const timeline = getVestingTimeline(shares, inputs.schedule, strikePrice, currentPrice);
    const stageNote = STAGE_NOTES[inputs.stage] || '';

    setResult({
      shares,
      vestedShares,
      unvestedShares,
      strikePrice,
      currentPrice,
      currentVestedValue,
      totalCurrentValue,
      scenarios,
      timeline,
      stageNote,
      vestingProgress,
    });
  };

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <ToolLayout title="Equity & Stock Option Calculator" description="Calculate the value of your stock options or equity at different scenarios and visualize your vesting timeline.">
      <form onSubmit={calculate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Number of Shares/Options</label>
            <input className={inputClass} type="number" min="0" placeholder="10000" value={inputs.shares} onChange={e => set('shares', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Strike/Exercise Price per Share</label>
            <input className={inputClass} type="number" min="0" step="0.01" value={inputs.strikePrice} onChange={e => set('strikePrice', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Current Estimated Share Price</label>
            <input className={inputClass} type="number" min="0" step="0.01" placeholder="5.00" value={inputs.currentPrice} onChange={e => set('currentPrice', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vesting Schedule</label>
            <select className={inputClass} value={inputs.schedule} onChange={e => set('schedule', e.target.value)}>
              {VESTING_SCHEDULES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vesting Progress: {inputs.vestingProgress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={inputs.vestingProgress}
              onChange={e => set('vestingProgress', e.target.value)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company Stage</label>
            <select className={inputClass} value={inputs.stage} onChange={e => set('stage', e.target.value)}>
              {COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <Button type="submit" className="w-full">
          <Calculator className="w-4 h-4 mr-2" /> Calculate Equity Value
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Vested Shares</p>
              <p className="text-3xl font-bold font-['Outfit'] text-primary">{result.vestedShares.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">of {result.shares.toLocaleString()} total</p>
            </div>
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Current Vested Value</p>
              <p className="text-3xl font-bold font-['Outfit'] text-primary">{fmt(result.currentVestedValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">at {fmt(result.currentPrice)}/share</p>
            </div>
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Total Value (Fully Vested)</p>
              <p className="text-3xl font-bold font-['Outfit'] text-primary">{fmt(result.totalCurrentValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">spread: {fmt(Math.max(0, result.currentPrice - result.strikePrice))}/share</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-4">Valuation Scenarios</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {result.scenarios.map((s, i) => {
                const isCurrent = s.multiplier === '1x';
                return (
                  <div
                    key={s.multiplier}
                    className={`rounded-xl p-4 text-center border ${
                      isCurrent
                        ? 'border-border bg-muted/30'
                        : 'border-green-500/20 bg-green-500/5'
                    }`}
                  >
                    <p className={`text-xs font-medium mb-1 ${isCurrent ? 'text-muted-foreground' : 'text-green-600'}`}>
                      {s.multiplier} valuation
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">{fmt(s.sharePrice)}/share</p>
                    <p className="text-lg font-bold font-['Outfit'] mt-1">{fmt(s.vestedValue)}</p>
                    <p className="text-xs text-muted-foreground">vested</p>
                    <p className="text-sm font-semibold text-primary mt-1">{fmt(s.totalValue)}</p>
                    <p className="text-xs text-muted-foreground">fully vested</p>
                  </div>
                );
              })}
            </div>
          </div>

          {result.timeline.length > 1 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold font-['Outfit'] mb-4">Vesting Timeline</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={result.timeline}>
                  <defs>
                    <linearGradient id="vestGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={m => `M${m}`}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(173, 58%, 39%)"
                    strokeWidth={2}
                    fill="url(#vestGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Value shown at current share price of {fmt(result.currentPrice)}
              </p>
            </div>
          )}

          {result.stageNote && (
            <div className="glass-card rounded-2xl p-6 bg-gradient-to-b from-primary/5 to-transparent">
              <h3 className="font-semibold font-['Outfit'] mb-2">Stage Insight</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.stageNote}</p>
            </div>
          )}

          <div className="glass-card rounded-2xl p-4 border-amber-500/20 bg-amber-500/5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Tax Note:</span> Stock option taxation varies significantly by jurisdiction, option type (ISO vs. NSO), exercise timing, and holding period. This calculator shows pre-tax values only. Consult a tax professional before making exercise decisions.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This is an estimate for comparison purposes. Actual equity value depends on liquidation preferences, dilution, company performance, and market conditions.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
