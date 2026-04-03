import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const COLORS = ['hsl(173, 58%, 39%)', 'hsl(215, 70%, 55%)', 'hsl(280, 60%, 55%)', 'hsl(35, 90%, 55%)', 'hsl(0, 70%, 55%)'];

const fmt = (n) => `$${Math.round(n).toLocaleString()}`;

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-primary">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function HiringCostCalculator() {
  const [inputs, setInputs] = useState({
    salary: 75000, benefitsPct: 25, recruiterFeePct: 15,
    timeToFill: 45, numHires: 1, jobBoardCost: 500,
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: Number(v) || 0 }));

  const calculate = (e) => {
    e.preventDefault();
    const { salary, benefitsPct, recruiterFeePct, timeToFill, numHires, jobBoardCost } = inputs;
    const recruiterFee = salary * recruiterFeePct / 100;
    const benefitsCost = salary * benefitsPct / 100;
    const vacancyCost = (salary / 260) * timeToFill * 0.5;
    const costPerHire = recruiterFee + jobBoardCost + vacancyCost;
    const totalPerEmployee = salary + benefitsCost + costPerHire;
    const annualBudget = totalPerEmployee * numHires;

    setResult({
      costPerHire,
      annualBudget,
      totalPerEmployee,
      breakdown: [
        { name: 'Base Salary', value: salary * numHires },
        { name: 'Benefits', value: benefitsCost * numHires },
        { name: 'Recruiter Fees', value: recruiterFee * numHires },
        { name: 'Job Board Costs', value: jobBoardCost * numHires },
        { name: 'Vacancy Cost', value: vacancyCost * numHires },
      ],
      details: { salary, benefitsCost, recruiterFee, jobBoardCost, vacancyCost },
    });
  };

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <ToolLayout title="Hiring Cost Calculator" description="Calculate your true cost-per-hire and annual hiring budget with a detailed breakdown.">
      <form onSubmit={calculate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Annual Salary (CAD)</label>
            <input className={inputClass} type="number" min="0" value={inputs.salary} onChange={e => set('salary', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Benefits Cost (%)</label>
            <input className={inputClass} type="number" min="0" max="100" value={inputs.benefitsPct} onChange={e => set('benefitsPct', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Recruiter Fee (%)</label>
            <input className={inputClass} type="number" min="0" max="100" value={inputs.recruiterFeePct} onChange={e => set('recruiterFeePct', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time to Fill (days)</label>
            <input className={inputClass} type="number" min="0" value={inputs.timeToFill} onChange={e => set('timeToFill', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Number of Hires</label>
            <input className={inputClass} type="number" min="1" value={inputs.numHires} onChange={e => set('numHires', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job Board Cost per Hire (CAD)</label>
            <input className={inputClass} type="number" min="0" value={inputs.jobBoardCost} onChange={e => set('jobBoardCost', e.target.value)} />
          </div>
        </div>
        <Button type="submit" className="w-full">
          <Calculator className="w-4 h-4 mr-2" /> Calculate Costs
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Cost Per Hire</p>
              <p className="text-3xl font-bold font-['Outfit'] text-primary">{fmt(result.costPerHire)}</p>
            </div>
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Cost Per Employee (Year 1)</p>
              <p className="text-3xl font-bold font-['Outfit'] text-primary">{fmt(result.totalPerEmployee)}</p>
            </div>
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Total Annual Budget</p>
              <p className="text-3xl font-bold font-['Outfit'] text-primary">{fmt(result.annualBudget)}</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-4">Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={result.breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                  {result.breakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3">Line Items (Per Hire)</h3>
            <div className="space-y-2">
              {[
                ['Base Salary', result.details.salary],
                ['Benefits', result.details.benefitsCost],
                ['Recruiter Fee', result.details.recruiterFee],
                ['Job Board Cost', result.details.jobBoardCost],
                ['Vacancy Cost', result.details.vacancyCost],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm py-1 border-b border-border/30">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 font-semibold">
                <span>Total Per Employee (Year 1)</span>
                <span className="text-primary">{fmt(result.totalPerEmployee)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
