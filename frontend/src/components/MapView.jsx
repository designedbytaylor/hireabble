import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const formatSalary = (min, max) => {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max)}`;
};

export default function MapView({ jobs = [] }) {
  const navigate = useNavigate();

  // Filter jobs with valid coordinates
  const mappableJobs = jobs.filter(j => j.location_lat && j.location_lng);

  if (mappableJobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] rounded-2xl bg-accent/50 border border-border">
        <p className="text-muted-foreground text-sm">No jobs with location data to display on map</p>
      </div>
    );
  }

  // Calculate center from jobs
  const avgLat = mappableJobs.reduce((s, j) => s + j.location_lat, 0) / mappableJobs.length;
  const avgLng = mappableJobs.reduce((s, j) => s + j.location_lng, 0) / mappableJobs.length;

  return (
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
        <MarkerClusterGroup chunkedLoading>
          {mappableJobs.map((job) => (
            <Marker key={job.id} position={[job.location_lat, job.location_lng]}>
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <strong style={{ fontSize: '14px' }}>{job.title}</strong>
                  <br />
                  <span style={{ color: '#666', fontSize: '12px' }}>{job.company}</span>
                  {(job.salary_min || job.salary_max) && (
                    <>
                      <br />
                      <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '12px' }}>
                        {formatSalary(job.salary_min, job.salary_max)}
                      </span>
                    </>
                  )}
                  <br />
                  <a
                    href={`/jobs/${job.id}`}
                    style={{ color: '#6366f1', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={(e) => { e.preventDefault(); navigate(`/jobs/${job.id}`); }}
                  >
                    View Details
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
