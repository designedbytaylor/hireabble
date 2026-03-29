import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Custom themed marker icon — inline SVG, no external image dependencies
// Uses app's primary teal color (#2A9D8F / hsl(173, 58%, 39%))
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

export default function MapView({ jobs = [] }) {
  const navigate = useNavigate();

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

  // Calculate center from jobs
  const avgLat = mappableJobs.reduce((s, j) => s + j.location_lat, 0) / mappableJobs.length;
  const avgLng = mappableJobs.reduce((s, j) => s + j.location_lng, 0) / mappableJobs.length;

  const salary = (job) => formatSalary(job.salary_min, job.salary_max);

  return (
    <div className="space-y-2">
      {unmappedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {mappableJobs.length} of {jobs.length} jobs on map — {unmappedCount} missing location data
        </p>
      )}
      <div className="rounded-2xl overflow-hidden border border-border" style={{ height: '450px' }}>
        <MapContainer
          center={[avgLat, avgLng]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup
            chunkedLoading
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            maxClusterRadius={40}
          >
            {mappableJobs.map((job) => (
              <Marker key={job.id} position={[job.location_lat, job.location_lng]} icon={customIcon}>
                <Popup maxWidth={260} minWidth={220}>
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
                    <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '8px' }}>
                      {job.location || 'Location not specified'}
                      {job.job_type && ` · ${job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)}`}
                      {job.employment_type && ` · ${job.employment_type}`}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {job.already_applied ? (
                        <div style={{
                          flex: 1,
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '8px',
                          padding: '6px 0',
                        }}>
                          ✓ Applied
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/jobs/${job.id}`); }}
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'white',
                          background: '#2A9D8F',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        View Details
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
