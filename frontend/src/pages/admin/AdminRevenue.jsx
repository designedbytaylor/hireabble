import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  DollarSign, TrendingUp, TrendingDown, Users, CreditCard,
  RefreshCw, UserMinus, Percent, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];

function formatCents(cents) {
  if (cents == null) return '$0.00';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({ icon: Icon, label, value, sub, color = 'indigo', trend }) {
  const colors = {
    indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-lg">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.name.toLowerCase().includes('revenue') ? formatCents(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminRevenue() {
  const { token } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/revenue`, { headers: getHeaders() });
      setData(res.data);
    } catch {
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, monthly_revenue, revenue_by_product, revenue_by_source, active_subscriptions, expired_subscriptions, duration_breakdown, churn_data, recent_transactions } = data;

  // Calculate month-over-month revenue trend
  const currentMonthRev = monthly_revenue[monthly_revenue.length - 1]?.revenue || 0;
  const prevMonthRev = monthly_revenue[monthly_revenue.length - 2]?.revenue || 0;
  const revTrend = prevMonthRev > 0 ? Math.round((currentMonthRev - prevMonthRev) / prevMonthRev * 100) : 0;

  // Chart data for revenue (convert cents to dollars for display)
  const revenueChartData = monthly_revenue.map(m => ({
    ...m,
    revenue_dollars: m.revenue / 100,
  }));

  // Subscription pie data
  const subPieData = active_subscriptions.map(s => ({ name: s.name, value: s.count }));

  // Revenue by category
  const categoryTotals = {};
  revenue_by_product.forEach(p => {
    const cat = p.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + p.total;
  });
  const categoryData = Object.entries(categoryTotals).map(([cat, total]) => ({
    name: cat.charAt(0).toUpperCase() + cat.slice(1) + 's',
    value: total,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Outfit'] text-white">Revenue & Subscriptions</h1>
          <p className="text-sm text-gray-400">Track revenue, subscriptions, and churn metrics</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCents(summary.total_revenue)}
          color="green"
          sub={`${summary.total_transactions} transactions`}
        />
        <StatCard
          icon={CreditCard}
          label="This Month"
          value={formatCents(currentMonthRev)}
          color="indigo"
          trend={revTrend}
        />
        <StatCard
          icon={Users}
          label="Active Subscriptions"
          value={summary.active_subscriptions}
          color="purple"
        />
        <StatCard
          icon={UserMinus}
          label="Expired / Cancelled"
          value={summary.expired_subscriptions}
          color="red"
        />
        <StatCard
          icon={Percent}
          label="Conversion Rate"
          value={`${summary.conversion_rate}%`}
          color="blue"
          sub={`${summary.active_subscriptions} of ${summary.total_users} users`}
        />
        <StatCard
          icon={TrendingUp}
          label="ARPU"
          value={summary.active_subscriptions > 0 ? formatCents(Math.round(summary.total_revenue / summary.active_subscriptions)) : '$0'}
          color="amber"
          sub="Avg revenue per subscriber"
        />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Monthly Revenue (12 months)</h2>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueChartData}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#374151' }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickFormatter={v => `$${v}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-lg">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="text-sm font-medium text-green-400">Revenue: {formatCents(payload[0]?.payload?.revenue)}</p>
                    <p className="text-sm font-medium text-blue-400">Transactions: {payload[0]?.payload?.transactions}</p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="revenue_dollars" name="Revenue" stroke="#22c55e" fill="url(#colorRev)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Churn & Subscriptions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Subscription Churn (6 months)</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={churn_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#374151' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="new_subscriptions" name="New Subs" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expired" name="Expired" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-4 justify-center">
            {churn_data.map((d, i) => (
              <div key={i} className="text-center">
                <p className="text-xs text-gray-500">{d.month}</p>
                <p className={`text-sm font-bold ${d.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {d.net >= 0 ? '+' : ''}{d.net} net
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Subscriptions Pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Active Subscriptions</h2>
          </div>
          {subPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={subPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {subPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {active_subscriptions.map((s, i) => (
                  <div key={s.tier_id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-300">{s.name}</span>
                      <span className="text-xs text-gray-500 ml-1">({s.role})</span>
                    </div>
                    <span className="text-sm font-bold text-white">{s.count}</span>
                    <span className="text-xs text-gray-500">{formatCents(s.total_revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-500">No active subscriptions</div>
          )}

          {/* Duration breakdown */}
          {duration_breakdown.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">By Duration</h3>
              <div className="flex gap-3">
                {duration_breakdown.map(d => (
                  <div key={d.duration} className="flex-1 bg-gray-800/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-white">{d.count}</p>
                    <p className="text-xs text-gray-400 capitalize">{d.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Product */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Revenue by Product</h2>
          </div>
          {revenue_by_product.length > 0 ? (
            <div className="space-y-2">
              {revenue_by_product.map((p, i) => {
                const maxRev = revenue_by_product[0]?.total || 1;
                return (
                  <div key={p.product_id} className="group">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-gray-300 flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded-full">{p.category}</span>
                      <span className="text-sm font-bold text-white">{formatCents(p.total)}</span>
                      <span className="text-xs text-gray-500">{p.count}x</span>
                    </div>
                    <div className="ml-5 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(p.total / maxRev) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No transactions yet</p>
          )}
        </div>

        {/* Revenue by Source + Cancelled Subs */}
        <div className="space-y-6">
          {/* By Source */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Revenue by Source</h2>
            </div>
            {revenue_by_source.length > 0 ? (
              <div className="flex gap-3">
                {revenue_by_source.map((s, i) => (
                  <div key={s.source} className="flex-1 bg-gray-800/50 rounded-xl p-4 text-center">
                    <p className="text-xl font-bold text-white">{formatCents(s.total)}</p>
                    <p className="text-xs text-gray-400 capitalize mt-1">{s.source.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500">{s.count} txns</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data</p>
            )}
          </div>

          {/* Expired/Cancelled */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <UserMinus className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Expired Subscriptions</h2>
            </div>
            {expired_subscriptions.length > 0 ? (
              <div className="space-y-2">
                {expired_subscriptions.map((s, i) => (
                  <div key={s.tier_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[(i + 4) % COLORS.length] }} />
                    <span className="text-sm text-gray-300 flex-1">{s.name}</span>
                    <span className="text-sm font-bold text-white">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No expired subscriptions</p>
            )}
          </div>

          {/* Revenue by Category */}
          {categoryData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Revenue by Category</h2>
              </div>
              <div className="flex gap-3">
                {categoryData.map((c, i) => (
                  <div key={c.name} className="flex-1 bg-gray-800/50 rounded-xl p-4 text-center">
                    <p className="text-xl font-bold text-white">{formatCents(c.value)}</p>
                    <p className="text-xs text-gray-400 mt-1">{c.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
        </div>
        {recent_transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">User</th>
                  <th className="text-left py-2 px-3 font-medium">Product</th>
                  <th className="text-left py-2 px-3 font-medium">Source</th>
                  <th className="text-right py-2 px-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent_transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <div>
                        <span className="text-gray-200">{t.user_name}</span>
                        <span className="text-xs text-gray-500 ml-1 capitalize">({t.user_role})</span>
                      </div>
                      <span className="text-xs text-gray-500">{t.user_email}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300">
                      {t.description || t.product_id?.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-400 capitalize">
                        {t.source?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {formatCents(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No transactions yet</p>
        )}
      </div>
    </div>
  );
}
