import { firebase } from '../lib/firebase.js';
import { db } from '../lib/db/index.js';
import { AppointmentDetailView } from '../views/view.appointment_detail.js';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function runTrackingTests(t) {
    console.log("Running Live Tracking Simulation Tests...");

    // Mock Leaflet
    const originalL = window.L;
    let markerInstances = [];
    window.L = {
        map: () => ({
            setView: function() { return this; },
            panTo: function() { return this; },
            getBounds: () => ({ contains: () => true }),
            remove: () => {},
            addLayer: () => {}
        }),
        tileLayer: () => ({ addTo: () => {} }),
        marker: (latlng) => {
            const m = {
                latlng,
                addTo: function() { markerInstances.push(this); return this; },
                setLatLng: function(nl) { this.latlng = nl; return this; },
                bindPopup: function() { return this; },
                openPopup: function() { return this; },
                remove: function() { 
                    markerInstances = markerInstances.filter(mi => mi !== this);
                },
                setPopupContent: function() { return this; }
            };
            return m;
        },
        divIcon: (opt) => opt
    };

    const container = document.createElement('div');
    container.id = 'tracking-test-container';
    document.body.appendChild(container);

    try {
        await t.test('AppointmentDetailView: real-time tracking should initialize and update', async () => {
            const testAptId = 'TRACK-TEST-' + Date.now();
            const dest = { lat: 51.5, lng: -0.1 };
            
            await db.create('appointments', {
                appointment_name: 'Tracking Test Job',
                tech_id: 'test-tech-1',
                status: 'scheduled',
                metadata: {
                    location: dest
                }
            }, testAptId);

            const view = AppointmentDetailView(testAptId);
            container.appendChild(view.element());
            // Promise to wait for loading to end
            const loaded = new Promise(resolve => {
                view.on('loading:end', resolve);
                setTimeout(resolve, 5000); // 5s timeout
            });

            view.trigger('init');
            await loaded;
            await wait(500);

            const trackBtn = view.$('btn-track-tech');
            t.assert(trackBtn, 'Track Technician button should be rendered');

            // Click Track
            trackBtn.click();
            await wait(1000);

            t.assert(trackBtn.classList.contains('btn-tracking-active'), 'Button should have active class');
            t.assert(markerInstances.length > 0, 'Technician marker should be added to the map');

            const initialLatLng = markerInstances[0].latlng;
            t.assert(initialLatLng[0] < dest.lat, 'Initial technician position should be offset from destination');

            // Wait for one interval (2s in logic)
            await wait(2100);

            const updatedLatLng = markerInstances[0].latlng;
            t.assert(updatedLatLng[0] > initialLatLng[0], 'Technician should move closer to destination');

            // Stop Tracking
            trackBtn.click();
            await wait(100);
            t.assert(!trackBtn.classList.contains('btn-tracking-active'), 'Button should deactivate on second click');
            t.assert(markerInstances.length === 0, 'Marker should be removed after tracking stops');

            // Cleanup
            await db.remove('appointments', testAptId);
            view.destroy();
        });

    } finally {
        window.L = originalL;
        if (container.parentNode) document.body.removeChild(container);
    }
}
