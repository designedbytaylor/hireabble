import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Activity, Server, Database, Globe, AlertTriangle, CheckCircle,
  XCircle, RefreshCw, Settings, Users, Briefcase, Heart,
  Zap, HardDrive, Cpu, MemoryStick, Wifi, TrendingUp, ChevronRight,
  ChevronDown, DollarSign, Layers, Plus, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ status }) {
  const color = status === 'healthy' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
  );
}

function UsageBar({ label, used, max, unit = '', icon: Icon }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500';
  const textColor = pct > 80 ? 'text-red-400' : pct > 60 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className={`text-sm font-medium ${textColor}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5 mb-1">
        <div className={`h-2.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {typeof used === 'number' ? used.toLocaleString() : used}{unit} / {typeof max === 'number' ? max.toLocaleString() : max}{unit}
      </p>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const styles = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[severity] || styles.info}`}>
      {severity}
    </span>
  );
}

function ServiceStatusCard({ icon: Icon, name, status, details }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <h3 className="text-white font-medium">{name}</h3>
            <p className="text-xs text-gray-500">{details}</p>
          </div>
        </div>
        <StatusDot status={status} />
      </div>
    </div>
  );
}

const TIER_OPTIONS = {
  railway: [
    { value: 'hobby', label: 'Hobby ($5/mo)', desc: '8GB RAM, 8 vCPU, 1 replica' },
    { value: 'pro', label: 'Pro ($20/mo)', desc: '32GB RAM, 32 vCPU, 50 replicas' },
  ],
  mongodb: [
    { value: 'M0', label: 'M0 Free', desc: '512MB storage, 100 connections' },
    { value: 'M10', label: 'M10 ($57/mo)', desc: '10GB storage, 1500 connections' },
    { value: 'M20', label: 'M20 ($140/mo)', desc: '20GB storage, 1500 connections' },
    { value: 'M30', label: 'M30 ($200+/mo)', desc: '40GB storage, 3000 connections' },
  ],
  vercel: [
    { value: 'hobby', label: 'Hobby (Free)', desc: '100GB bandwidth, non-commercial' },
    { value: 'pro', label: 'Pro ($20/mo)', desc: '1TB bandwidth, commercial use' },
  ],
};

export default function AdminHealth() {
  const { token } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    railway: 'hobby',
    mongodb: 'M0',
    vercel: 'hobby',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [expandedProjection, setExpandedProjection] = useState(null);

  const fetchHealth = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/admin/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
      // Sync config form with current infrastructure
      const infra = res.data.infrastructure;
      if (infra) {
        setConfigForm({
          railway: infra.railway?.plan || 'hobby',
          mongodb: infra.mongodb?.tier || 'M0',
          vercel: infra.vercel?.plan || 'hobby',
        });
      }
    } catch (e) {
      console.error('Health check failed:', e);
      if (!data) toast.error('Failed to load health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.put(`${API}/admin/health/config`, {
        railway: { plan: configForm.railway },
        mongodb: { tier: configForm.mongodb },
        vercel: { plan: configForm.vercel },
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Infrastructure config updated');
      setShowConfig(false);
      fetchHealth(true);
    } catch (e) {
      toast.error('Failed to update config');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { server = {}, database = {}, app = {}, infrastructure = {}, recommendations = [], scale_readiness = {}, scale_projections = [] } = data || {};

  const serverStatus = server.memory?.percent > 85 || server.cpu?.percent > 85 ? 'warning' : server.status || 'healthy';
  const dbStatus = database.status || 'unknown';
  const dbStoragePct = infrastructure.mongodb?.max_storage_mb > 0
    ? (database.storage?.used_mb || 0) / infrastructure.mongodb.max_storage_mb * 100 : 0;
  const vercelStatus = infrastructure.vercel?.plan === 'hobby' ? 'warning' : 'healthy';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">App Health</h1>
          <p className="text-gray-400 mt-1">Infrastructure monitoring & scale readiness</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors border border-gray-700"
          >
            <Settings className="w-4 h-4" />
            Configure
          </button>
          <button
            onClick={() => fetchHealth(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm transition-colors border border-red-500/30"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <ServiceStatusCard
          icon={Server}
          name="Backend (Railway)"
          status={serverStatus}
          details={`Uptime: ${formatUptime(server.uptime_seconds || 0)} | ${server.workers || 0} workers`}
        />
        <ServiceStatusCard
          icon={Database}
          name="Database (MongoDB)"
          status={dbStoragePct > 80 ? 'warning' : dbStatus === 'healthy' ? 'healthy' : 'error'}
          details={`${database.documents?.toLocaleString() || 0} documents | ${database.collections || 0} collections`}
        />
        <ServiceStatusCard
          icon={Globe}
          name="Frontend (Vercel)"
          status={vercelStatus}
          details={`${infrastructure.vercel?.plan?.charAt(0).toUpperCase() + infrastructure.vercel?.plan?.slice(1) || 'Hobby'} plan | ${infrastructure.vercel?.max_bandwidth_gb || 100}GB bandwidth`}
        />
      </div>

      {/* Resource Usage */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Resource Usage</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <UsageBar
            label="Server Memory"
            used={server.memory?.used_mb || 0}
            max={infrastructure.railway?.max_ram_gb ? infrastructure.railway.max_ram_gb * 1024 : 8192}
            unit=" MB"
            icon={MemoryStick}
          />
          <UsageBar
            label="CPU Usage"
            used={server.cpu?.percent || 0}
            max={100}
            unit="%"
            icon={Cpu}
          />
          <UsageBar
            label="DB Storage"
            used={database.storage?.used_mb || 0}
            max={infrastructure.mongodb?.max_storage_mb || 512}
            unit=" MB"
            icon={HardDrive}
          />
          <UsageBar
            label="DB Connections"
            used={database.connections?.current || 0}
            max={infrastructure.mongodb?.max_connections || 100}
            unit=""
            icon={Wifi}
          />
        </div>
      </div>

      {/* App Metrics */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">App Metrics</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Users', value: app.total_users, icon: Users, color: 'text-indigo-400' },
            { label: 'Active (30d)', value: app.active_users_30d, icon: Users, color: 'text-green-400' },
            { label: 'Total Jobs', value: app.total_jobs, icon: Briefcase, color: 'text-blue-400' },
            { label: 'Active Jobs', value: app.active_jobs, icon: Briefcase, color: 'text-cyan-400' },
            { label: 'Matches', value: app.total_matches, icon: Heart, color: 'text-pink-400' },
            { label: 'WebSockets', value: server.websocket_connections, icon: Zap, color: 'text-yellow-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-800/50 rounded-xl p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
              <p className="text-xl font-bold text-white">{value?.toLocaleString() ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure Tiers */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Infrastructure Tiers</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'Railway',
              icon: Server,
              plan: infrastructure.railway?.plan || 'hobby',
              cost: infrastructure.railway?.cost_mo || 0,
              limits: [
                `${infrastructure.railway?.max_ram_gb || 8}GB RAM`,
                `${infrastructure.railway?.max_vcpu || 8} vCPU`,
                `${infrastructure.railway?.max_replicas || 1} replica(s)`,
              ],
            },
            {
              name: 'MongoDB Atlas',
              icon: Database,
              plan: infrastructure.mongodb?.tier || 'M0',
              cost: infrastructure.mongodb?.cost_mo || 0,
              limits: [
                `${infrastructure.mongodb?.max_storage_mb >= 1024 ? (infrastructure.mongodb.max_storage_mb / 1024).toFixed(0) + 'GB' : (infrastructure.mongodb?.max_storage_mb || 512) + 'MB'} storage`,
                `${infrastructure.mongodb?.max_connections || 100} connections`,
              ],
            },
            {
              name: 'Vercel',
              icon: Globe,
              plan: infrastructure.vercel?.plan || 'hobby',
              cost: infrastructure.vercel?.cost_mo || 0,
              limits: [
                `${infrastructure.vercel?.max_bandwidth_gb || 100}GB bandwidth`,
                infrastructure.vercel?.plan === 'hobby' ? 'Non-commercial only' : 'Commercial use',
              ],
            },
          ].map((svc) => (
            <div key={svc.name} className="bg-gray-800/50 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <svc.icon className="w-5 h-5 text-gray-400" />
                <div>
                  <h3 className="text-white font-medium">{svc.name}</h3>
                  <p className="text-xs text-gray-500">{svc.plan.charAt(0).toUpperCase() + svc.plan.slice(1)} — ${svc.cost}/mo</p>
                </div>
              </div>
              <ul className="space-y-1">
                {svc.limits.map((limit, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-gray-600" />
                    {limit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Total monthly cost: ${(infrastructure.railway?.cost_mo || 0) + (infrastructure.mongodb?.cost_mo || 0) + (infrastructure.vercel?.cost_mo || 0)}/mo
        </p>
      </div>

      {/* Upgrade Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Upgrade Recommendations</h2>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className={`rounded-xl p-4 border ${
                rec.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' :
                rec.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' :
                'bg-blue-500/10 border-blue-500/20'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {rec.severity === 'critical' ? <XCircle className="w-4 h-4 text-red-400" /> :
                     rec.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-400" /> :
                     <CheckCircle className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={rec.severity} />
                      <span className="text-xs text-gray-500 uppercase">{rec.service}</span>
                    </div>
                    <p className="text-sm text-gray-300">{rec.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scale Readiness */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Scale Readiness: 100K Users</h2>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            scale_readiness.can_handle_100k
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {scale_readiness.can_handle_100k ? 'Ready' : 'Not Ready'}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {(scale_readiness.bottlenecks || []).map((b, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-4">
              <div className="mt-0.5">
                {b.status === 'pass' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium text-sm">{b.service}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{b.issue}</p>
                <p className="text-xs text-gray-500 mt-1">{b.recommendation}</p>
              </div>
            </div>
          ))}
        </div>

        {scale_readiness.estimated_monthly_cost && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">
              Estimated cost at 100K scale: <span className="text-white font-medium">{scale_readiness.estimated_monthly_cost}</span>
            </p>
          </div>
        )}
      </div>

      {/* Scale Projections: 250K – 1M */}
      {scale_projections.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Scale Projections: 250K – 1M Users</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Infrastructure requirements and estimated costs at each growth milestone. Based on your current plans.</p>

          <div className="space-y-3">
            {scale_projections.map((proj) => {
              const isExpanded = expandedProjection === proj.target_users;
              const passCount = proj.items.filter(i => i.status === 'pass').length;
              const totalCount = proj.items.length;
              const allPass = passCount === totalCount;

              return (
                <div key={proj.target_users} className={`rounded-xl border transition-colors ${
                  allPass ? 'border-green-500/20 bg-green-500/5' : 'border-gray-700 bg-gray-800/30'
                }`}>
                  {/* Projection header — always visible */}
                  <button
                    onClick={() => setExpandedProjection(isExpanded ? null : proj.target_users)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        allPass ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {proj.label.replace(' Users', '')}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{proj.label}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {proj.estimated_cost}
                          </span>
                          <span className={`text-xs ${allPass ? 'text-green-400' : 'text-gray-500'}`}>
                            {passCount}/{totalCount} ready
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        allPass
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {allPass ? 'Ready' : 'Upgrades Needed'}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      {/* Infrastructure requirements */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                          <Server className="w-4 h-4 text-gray-500" />
                          Infrastructure Requirements
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {proj.items.map((item) => (
                            <div key={item.service} className={`rounded-lg p-3 border ${
                              item.status === 'pass'
                                ? 'bg-green-500/10 border-green-500/20'
                                : 'bg-gray-800/50 border-gray-700'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                {item.status === 'pass'
                                  ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                                <span className="text-sm font-medium text-white">{item.service}</span>
                              </div>
                              <p className="text-xs text-gray-400 mb-1">
                                <span className="text-gray-500">Plan:</span> {item.required}
                              </p>
                              <p className="text-xs text-gray-400 mb-2">
                                <span className="text-gray-500">Cost:</span> {item.cost}
                              </p>
                              <p className="text-xs text-gray-500 leading-relaxed">{item.notes}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Additional services */}
                      {proj.additional_services?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-gray-500" />
                            Additional Services
                          </h4>
                          <div className="space-y-2">
                            {proj.additional_services.map((svc) => (
                              <div key={svc.service} className="flex items-start gap-3 bg-gray-800/40 rounded-lg p-3">
                                <Layers className={`w-4 h-4 mt-0.5 flex-shrink-0 ${svc.required ? 'text-amber-400' : 'text-gray-500'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-white font-medium">{svc.service}</span>
                                    <span className="text-xs text-gray-500">{svc.cost}</span>
                                    {svc.required ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Required</span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 border border-gray-600">Recommended</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{svc.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Architecture changes */}
                      {proj.architecture_changes?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-gray-500" />
                            Architecture Changes Required
                          </h4>
                          <div className="bg-gray-800/40 rounded-lg p-3">
                            <ul className="space-y-1.5">
                              {proj.architecture_changes.map((change, idx) => (
                                <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                  <ChevronRight className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
                                  <span>{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Total estimated cost summary */}
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                        <p className="text-sm text-gray-400">
                          Total estimated infrastructure cost at {proj.label.toLowerCase()}:{' '}
                          <span className="text-white font-medium">{proj.estimated_cost}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Configure Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowConfig(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-1">Infrastructure Configuration</h2>
            <p className="text-sm text-gray-500 mb-6">Update your current plans so recommendations stay accurate.</p>

            <div className="space-y-4">
              {[
                { key: 'railway', label: 'Railway Plan', options: TIER_OPTIONS.railway },
                { key: 'mongodb', label: 'MongoDB Atlas Tier', options: TIER_OPTIONS.mongodb },
                { key: 'vercel', label: 'Vercel Plan', options: TIER_OPTIONS.vercel },
              ].map(({ key, label, options }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                  <select
                    value={configForm[key]}
                    onChange={e => setConfigForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-500"
                  >
                    {options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowConfig(false)}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {savingConfig ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
