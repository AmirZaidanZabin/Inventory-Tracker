import { controller } from '../lib/controller.js';
import { publicFetch } from '../lib/api.js';
import { estimateDuration } from '../lib/travel-logic.js';

export function PublicTrackingView(trackingId) {
    const view = controller({
        stringComponent: `
            <div class="tracking-view h-100 d-flex flex-column bg-light">
                <style>
                    .tracking-header { background: #fff; border-bottom: 1px solid #cbd5e1; padding: 1rem; z-index: 1000; display:flex; align-items:center; justify-content:space-between; }
                    .pulse-ring { width: 12px; height: 12px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
                    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); } 70% { box-shadow: 0 0 0 10px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
                    #map { flex-grow: 1; z-index: 1; }
                    .info-card { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 400px; background: #fff; padding: 1rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1000; }
                </style>
                
                <div class="tracking-header shadow-sm">
                    <div class="d-flex align-items-center gap-2">
                        <img src="/logo.png" style="height: 24px; filter: grayscale(1) contrast(5);" alt="Logo">
                        <span class="fw-bold" style="letter-spacing: -0.5px;">Live Track</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <div class="pulse-ring bg-primary" id="track-pulse"></div>
                        <span class="badge bg-primary text-white" id="track-status">Connecting...</span>
                    </div>
                </div>

                <div id="tracking-map" style="flex-grow: 1; position: relative;">
                    <div class="info-card border border-secondary-subtle">
                        <h6 class="fw-bold mb-1" id="track-title">Loading your appointment...</h6>
                        <p class="text-muted small mb-0"><i class="bi bi-clock me-1"></i>ETA: <span class="fw-bold text-dark" id="track-eta">-- mins</span></p>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'tracking-map' })
        .onboard({ id: 'track-pulse' })
        .onboard({ id: 'track-status' })
        .onboard({ id: 'track-title' })
        .onboard({ id: 'track-eta' });

    let map = null;
    let techMarker = null;
    let destMarker = null;
    let routingControl = null;
    let pollInterval = null;

    const initMap = (destLat, destLng) => {
        if (map) return;
        map = L.map(view.$('tracking-map')).setView([destLat, destLng], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        const destIcon = L.divIcon({
            html: '<i class="bi bi-geo-alt-fill text-danger fs-3" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"></i>',
            className: '', iconSize: [24, 24], iconAnchor: [12, 24]
        });

        destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map);
    };

    const updateTechLocation = (lat, lng, destLat, destLng) => {
        if (!map) initMap(destLat, destLng);

        // Custom Tech Icon
        const techIcon = L.divIcon({
            html: '<i class="bi bi-car-front-fill text-primary" style="font-size: 2rem; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3));"></i>',
            className: '', iconSize: [32, 32], iconAnchor: [16, 16]
        });

        if (!techMarker) {
            techMarker = L.marker([lat, lng], { icon: techIcon }).addTo(map);
        } else {
            techMarker.setLatLng([lat, lng]);
        }

        // Draw Route using OSRM
        if (routingControl) map.removeControl(routingControl);
        
        // Simple mock route display using polyline if we wanted, but let's just draw a direct line for simplicity if OSRM UI isn't loaded
        // To keep it dependency-safe, we just bound the box.
        const bounds = L.latLngBounds([ [lat, lng], [destLat, destLng] ]);
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
    };

    const pollLocation = async () => {
        try {
            const data = await publicFetch(`/api/appointments/${trackingId}`);
            if (!data) {
                view.$('track-title').textContent = "Appointment Not Found";
                view.$('track-status').textContent = "Error";
                view.$('track-status').className = 'badge bg-danger text-white';
                return;
            }

            const isComplete = data.status === 'completed';
            const statusEl = view.$('track-status');
            
            view.$('track-title').textContent = data.appointment_name || 'Your Service Appointment';

            if (isComplete) {
                statusEl.textContent = 'Arrived / Completed';
                statusEl.className = 'badge bg-success text-white';
                view.$('track-pulse').className = 'pulse-ring bg-success';
                view.$('track-eta').textContent = 'Arrived';
                if (pollInterval) clearInterval(pollInterval);
                return;
            } else if (data.status === 'in-progress') {
                statusEl.textContent = 'On the way';
                statusEl.className = 'badge bg-primary text-white';
                view.$('track-pulse').className = 'pulse-ring bg-primary';
            } else {
                statusEl.textContent = 'Scheduled';
                statusEl.className = 'badge bg-secondary text-white';
                view.$('track-pulse').className = 'pulse-ring bg-secondary';
            }

            const techLoc = data.metadata?.tech_location;
            const destLoc = data.metadata?.location;

            if (destLoc?.lat && destLoc?.lng) {
                if (!map) initMap(parseFloat(destLoc.lat), parseFloat(destLoc.lng));
            }

            if (techLoc && destLoc) {
                const tLat = parseFloat(techLoc.lat);
                const tLng = parseFloat(techLoc.lng);
                const dLat = parseFloat(destLoc.lat);
                const dLng = parseFloat(destLoc.lng);

                updateTechLocation(tLat, tLng, dLat, dLng);

                // ETA calculation
                const etaMins = await estimateDuration(tLat, tLng, dLat, dLng);
                view.$('track-eta').textContent = etaMins > 0 ? `${etaMins} mins` : 'Arriving now...';
            } else {
                view.$('track-eta').textContent = 'Waiting for GPS signal...';
            }

        } catch (e) {
            console.warn("Tracker update failed:", e);
        }
    };

    view.on('init', () => {
        pollLocation();
        pollInterval = setInterval(pollLocation, 10000); // refresh every 10s
    });

    view.destroy = () => {
        if (pollInterval) clearInterval(pollInterval);
        if (map) map.remove();
    };

    return view;
}
