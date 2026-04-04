import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const COLORS = [
  'hsl(173, 58%, 39%)', 'hsl(215, 70%, 55%)', 'hsl(280, 60%, 55%)',
  'hsl(35, 90%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(150, 60%, 40%)', 'hsl(45, 80%, 50%)',
];

const fmt = n => '$' + n.toLocaleString();

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-primary">{fmt(Math.round(payload[0].value))}</p>
    </div>
  );
};

export default function BenefitsCalculator() {
  const [inputs, setInputs] = useState({
    salary: '',
    healthCost: '',
    matchPct: 5,
    vacationDays: 15,
    equity: 0,
    signingBonus: 0,
    remoteSavings: 0,
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const calculate = (e) => {
    e.preventDefault();
    const salary = Number(inputs.salary) || 0;
    const healthCost = Number(inputs.healthCost) || 0;
    const matchPct = Number(inputs.matchPct) || 0;
    const vacationDays = Number(inputs.vacationDays) || 0;
    const equity = Number(inputs.equity) || 0;
    const signingBonus = Number(inputs.signingBonus) || 0;
    const remoteSavings = Number(inputs.remoteSavings) || 0;

    const employerMatch = salary * matchPct / 100;
    const vacationValue = (salary / 260) * vacationDays;
    const remoteAnnual = remoteSavings * 12;
    const healthAnnual = healthCost * 12;

    const totalComp = salary + employerMatch + vacationValue + equity + signingBonus + remoteAnnual - healthAnnual;
    const benefitsAdded = totalComp - salary;
    const benefitsPct = salary > 0 ? ((benefitsAdded) / salary * 100) : 0;

    const breakdown = [
      { name: 'Base Salary', value: salary },
      { name: 'Employer RRSP/401k Match', value: employerMatch },
      { name: 'Vacation Days Value', value: vacationValue },
      { name: 'Stock Options/Equity', value: equity },
      { name: 'Signing Bonus', value: signingBonus },
      { name: 'Remote Work Savings', value: remoteAnnual },
      { name: 'Health Insurance Cost', value: -healthAnnual },
    ].filter(item => item.value !== 0);

    const positiveBreakdown = breakdown.filter(item => item.value > 0);

    setResult({
      totalComp,
      benefitsPct,
      breakdown,
      positiveBreakdown,
      details: {
        salary,
        employerMatch,
        vacationValue,
        equity,
        signingBonus,
        remoteAnnual,
        healthAnnual,
      },
    });
  };

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <ToolLayout title="Total Compensation Calculator" description="Calculate your true total compensation including salary, benefits, equity, and perks.">
      <form onSubmit={calculate} className="glass-card rounded-2xl p-6 space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Base Salary (Annual)</label>
            <input className={inputClass} type="number" min="0" placeholder="75000" value={inputs.salary} onChange={e => set('salary', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Health Insurance Monthly Cost to You</label>
            <input className={inputClass} type="number" min="0" placeholder="200" value={inputs.healthCost} onChange={e => set('healthCost', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employer RRSP/401k Match %</label>
            <input className={inputClass} type="number" min="0" max="100" value={inputs.matchPct} onChange={e => set('matchPct', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Annual Vacation Days</label>
            <input className={inputClass} type="number" min="0" max="365" value={inputs.vacationDays} onChange={e => set('vacationDays', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stock Options/Equity Annual Value</label>
            <input className={inputClass} type="number" min="0" value={inputs.equity} onChange={e => set('equity', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Signing Bonus</label>
            <input className={inputClass} type="number" min="0" value={inputs.signingBonus} onChange={e => set('signingBonus', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Remote Work Savings per Month</label>
            <input className={inputClass} type="number" min="0" placeholder="150" value={inputs.remoteSavings} onChange={e => set('remoteSavings', e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Commute, meals, clothing, etc. you save by working remotely</p>
          </div>
        </div>
        <Button type="submit" className="w-full">
          <Calculator className="w-4 h-4 mr-2" /> Calculate Total Compensation
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Total Annual Compensation</p>
            <p className="text-4xl font-bold font-['Outfit'] text-primary mt-2">
              {fmt(Math.round(result.totalComp))}
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Your benefits add <span className="font-semibold text-primary">{result.benefitsPct >= 0 ? '+' : ''}{result.benefitsPct.toFixed(1)}%</span> on top of your base salary
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-4">Compensation Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={result.positiveBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {result.positiveBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3">Detailed Breakdown</h3>
            <div className="space-y-2">
              {[
                ['Base Salary', result.details.salary],
                ['Employer RRSP/401k Match', result.details.employerMatch],
                ['Vacation Days Value', result.details.vacationValue],
                ['Stock Options/Equity', result.details.equity],
                ['Signing Bonus', result.details.signingBonus],
                ['Remote Work Savings', result.details.remoteAnnual],
                ['Health Insurance Cost', -result.details.healthAnnual],
              ].filter(([, val]) => val !== 0).map(([label, val]) => {
                const pct = result.details.salary > 0 ? (val / result.details.salary * 100).toFixed(1) : '0.0';
                return (
                  <div key={label} className="flex justify-between text-sm py-1 border-b border-border/30">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-16 text-right">{pct}%</span>
                      <span className={`font-medium w-24 text-right ${val < 0 ? 'text-red-500' : ''}`}>{val < 0 ? '-' : ''}{fmt(Math.abs(Math.round(val)))}</span>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm pt-2 font-semibold">
                <span>Total Compensation</span>
                <span className="text-primary">{fmt(Math.round(result.totalComp))}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This is an estimate for comparison purposes. Vacation day value is calculated at your daily rate (salary / 260 working days). Tax implications vary by jurisdiction.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
