import { controller } from '../lib/controller.js';
import { auth } from '../lib/auth.js';
import { apiDb as db } from '../lib/api-client.js';

export function PublicBookingView() {
    const view = controller({
        stringComponent: `
            <div class="public-booking-view container py-5" style="max-width: 600px;">
                <div class="card border-0 shadow-lg" style="border-radius: 12px;">
                    <div class="card-header bg-primary text-white p-4" style="border-top-left-radius: 12px; border-top-right-radius: 12px;">
                        <h4 class="mb-0 fw-bold">Book an Appointment</h4>
                        <p class="mb-0 opacity-75 small">Secure your hardware installation slot.</p>
                    </div>
                    <div class="card-body p-4 position-relative">
                        <div id="booking-loading" class="position-absolute w-100 h-100 bg-white d-flex justify-content-center align-items-center" style="top:0; left:0; z-index: 10; opacity: 0.9;">
                            <div class="spinner-border text-primary" role="status"></div>
                        </div>

                        <form id="public-booking-form">
                            <div class="mb-3">
                                <label class="form-label fw-bold small">Your Name</label>
                                <input type="text" name="appointment_name" class="form-control bg-light" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold small">Target Date</label>
                                <input type="date" name="schedule_date" class="form-control bg-light" required>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold small">Location Map (Click to select pin)</label>
                                <div id="public-map" class="bg-light rounded border" style="height: 250px; width: 100%;"></div>
                                <div class="form-text mt-2"><i class="bi bi-geo-alt-fill text-muted"></i> Click the map to drop a pin.</div>
                            </div>
                            <input type="hidden" name="lat">
                            <input type="hidden" name="lng">

                            <button type="submit" class="btn btn-primary w-100 fw-bold py-2 shadow-sm rounded-3 mt-4">Confirm Request</button>
                        </form>
                        
                        <div id="booking-success" class="text-center d-none py-5">
                            <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
                            <h4 class="mt-3 fw-bold">Request Submitted!</h4>
                            <p class="text-muted mb-0">We have received your requested date. A technician will be assigned shortly.</p>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'public-booking-form' })
        .onboard({ id: 'public-map' })
        .onboard({ id: 'booking-loading' })
        .onboard({ id: 'booking-success' });

    view.on('init', () => {
        let map, marker;

        // Initialize Map
        setTimeout(() => {
            const mapEl = view.$('public-map');
            if(window.L && mapEl) {
                map = L.map(mapEl).setView([39.8283, -98.5795], 4);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    maxZoom: 19
                }).addTo(map);

                map.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    if (marker) map.removeLayer(marker);
                    marker = L.marker([lat, lng]).addTo(map);
                    view.component.querySelector('[name="lat"]').value = lat;
                    view.component.querySelector('[name="lng"]').value = lng;
                });
            }
            view.$('booking-loading').classList.add('d-none');
        }, 800);

        view.trigger('submit', 'public-booking-form', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            
            if(!fd.get('lat')) {
                return alert("Please select a location on the map.");
            }

            view.$('booking-loading').classList.remove('d-none');
            const appointmentId = 'APT-' + Math.floor(Math.random() * 1000000);
            
            try {
                let currentUser = auth.currentUser;
                if (!currentUser) {
                    await auth.signInAnonymously();
                }

                await db.create('appointments', {
                    appointment_id: appointmentId,
                    appointment_name: fd.get('appointment_name'),
                    appointment_time: '12:00', // Default pending time
                    schedule_date: fd.get('schedule_date'),
                    status: 'scheduled',
                    tech_id: 'pending', // Pending assignment
                    metadata: {
                        hardware_requirements: [],
                        location: { lat: parseFloat(fd.get('lat')), lng: parseFloat(fd.get('lng')) }
                    },
                    created_at: db.serverTimestamp(),
                    updated_at: db.serverTimestamp(),
                    is_deleted: false
                }, appointmentId);

                view.$('public-booking-form').classList.add('d-none');
                view.$('booking-loading').classList.add('d-none');
                view.$('booking-success').classList.remove('d-none');
            } catch(err) {
                console.error(err);
                alert("Failed to submit request.");
                view.$('booking-loading').classList.add('d-none');
            }
        });
    });

    return view;
}
