import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { toast } from 'sonner';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Custom themed marker icon — inline SVG, no external image dependencies
const customIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.716 23.284 0 15 0z" fill="#2A9D8F" stroke="#1f7a6f" stroke-width="1.2"/>
    <circle cx="15" cy="14" r="5.5" fill="white" opacity="0.95"/>
    <circle cx="15" cy="14" r="2.5" fill="#2A9D8F"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});

const formatSalary = (min, max) => {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max)}`;
};

export default function MapView({ jobs = [], userLat, userLng, token, onApply, onSave, onViewDetails }) {
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());

  // Filter jobs with valid coordinates
  const mappableJobs = jobs.filter(j => j.location_lat && j.location_lng);
  const unmappedCount = jobs.length - mappableJobs.length;

  if (mappableJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] rounded-2xl bg-accent/50 border border-border gap-2">
        <p className="text-muted-foreground text-sm">No jobs with location data to display on map</p>
        {jobs.length > 0 && (
          <p className="text-muted-foreground text-xs">{jobs.length} job{jobs.length !== 1 ? 's' : ''} found but missing coordinates</p>
        )}
      </div>
    );
  }

  // Center on user's location if available, otherwise average of jobs
  const hasUserLocation = userLat && userLng;
  const centerLat = hasUserLocation ? userLat : mappableJobs.reduce((s, j) => s + j.location_lat, 0) / mappableJobs.length;
  const centerLng = hasUserLocation ? userLng : mappableJobs.reduce((s, j) => s + j.location_lng, 0) / mappableJobs.length;
  const defaultZoom = hasUserLocation ? 11 : 4;

  const handleApply = async (job) => {
    if (job.already_applied || appliedIds.has(job.id)) return;
    try {
      await axios.post(`${API}/swipe`, { job_id: job.id, action: 'like' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppliedIds(prev => new Set([...prev, job.id]));
      onApply?.(job.id);
      toast.success('Applied!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply');
    }
  };

  const handleSave = async (job) => {
    if (job._saved || savedIds.has(job.id)) return;
    try {
      await axios.post(`${API}/jobs/${job.id}/save`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedIds(prev => new Set([...prev, job.id]));
      onSave?.(job.id);
      toast.success('Saved for later');
    } catch {
      toast.error('Failed to save');
    }
  };

  const salary = (job) => formatSalary(job.salary_min, job.salary_max);
  const isApplied = (job) => job.already_applied || appliedIds.has(job.id);
  const isSaved = (job) => job._saved || savedIds.has(job.id);

  return (
    <div className="space-y-2">
      {unmappedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {mappableJobs.length} of {jobs.length} jobs on map — {unmappedCount} missing location data
        </p>
      )}
      <div className="rounded-2xl overflow-hidden border border-border" style={{ height: '450px' }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          {/* Layer 1: Dark base — the main dark theme with brightened roads */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            className="map-water-underlay"
          />
          {/* Layer 2: Light tiles filtered to teal water, screen blended — teal shows on dark, land stays invisible */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            className="map-dark-base"
          />
          {/* Layer 3: Labels — crisp white text on transparent bg */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            className="map-labels-layer"
          />
          <MarkerClusterGroup
            chunkedLoading
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            maxClusterRadius={40}
          >
            {mappableJobs.map((job) => (
              <Marker key={job.id} position={[job.location_lat, job.location_lng]} icon={customIcon}>
                <Popup maxWidth={280} minWidth={240}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", padding: '2px 0' }}>
                    {/* Title */}
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f5f5f5', marginBottom: '2px', lineHeight: 1.3 }}>
                      {job.title}
                    </div>
                    {/* Company */}
                    <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
                      {job.company}
                    </div>

                    {/* Salary */}
                    {salary(job) && (
                      <div style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '20px',
                        padding: '2px 8px',
                        marginBottom: '6px',
                      }}>
                        {salary(job)}
                      </div>
                    )}

                    {/* Location + Type */}
                    <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '10px' }}>
                      {job.location || 'Location not specified'}
                      {job.job_type && ` · ${job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)}`}
                      {job.employment_type && ` · ${job.employment_type}`}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Apply / Applied */}
                      {isApplied(job) ? (
                        <div style={{
                          flex: 1,
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '8px',
                          padding: '7px 0',
                        }}>
                          ✓ Applied
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleApply(job); }}
                          style={{
                            flex: 1,
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'white',
                            background: '#2A9D8F',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '7px 12px',
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          Apply
                        </button>
                      )}

                      {/* Save / Saved */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSave(job); }}
                        disabled={isSaved(job)}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: isSaved(job) ? '#2A9D8F' : '#a1a1aa',
                          background: isSaved(job) ? 'rgba(42, 157, 143, 0.1)' : 'rgba(161, 161, 170, 0.1)',
                          border: `1px solid ${isSaved(job) ? 'rgba(42, 157, 143, 0.3)' : 'rgba(161, 161, 170, 0.2)'}`,
                          borderRadius: '8px',
                          padding: '7px 10px',
                          cursor: isSaved(job) ? 'default' : 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {isSaved(job) ? '★ Saved' : '☆ Save'}
                      </button>

                      {/* View Details */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewDetails?.(job); }}
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#a1a1aa',
                          background: 'transparent',
                          border: '1px solid rgba(161, 161, 170, 0.2)',
                          borderRadius: '8px',
                          padding: '7px 8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
