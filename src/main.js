import { auth } from './lib/auth.js';
import { db } from './lib/db/index.js';
import { controller } from './lib/controller.js';
import { runTests } from './tests/index.js';

const App = (() => {
    let state = {
        user: null,
        activeView: 'calendar',
        views: {},
        currentView: null,
        roleId: 'viewer',
        authorities: []
    };

    const shell = controller({ domComponent: document.body });
    
    const applyAuthorities = () => {
        if (!state.user) return;
        
        const currentUserEmail = state.user.email?.toLowerCase();
        const adminEmail = 'amir.zaidan.zabin@gmail.com';
        const adminEmailAlt = 'amirzaidanzabin@gmail.com';
        const isAdmin = state.roleId === 'admin' || currentUserEmail === adminEmail || currentUserEmail === adminEmailAlt || state.authorities.includes('admin') || state.authorities.includes('manage_users');
        
        console.log("Auth Debug:", {
            currentUserEmail,
            adminEmail,
            adminEmailAlt,
            emailsMatch: currentUserEmail === adminEmail || currentUserEmail === adminEmailAlt,
            roleId: state.roleId,
            isAdmin
        });

        const safeAuthorities = Array.isArray(state.authorities) ? state.authorities : [];
        
        document.querySelectorAll('[class*="auth-"]').forEach(el => {
            const authClass = Array.from(el.classList).find(c => c.startsWith('auth-'));
            if (authClass && authClass.includes('auth-')) {
                const parts = authClass.split('auth-');
                const required = parts.length > 1 ? parts[1] : null;
                
                if (required && (safeAuthorities.includes(required) || isAdmin)) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
        });
    };

    document.addEventListener('apply-auth', applyAuthorities);

    shell.onboard({ id: 'auth-overlay' })
         .onboard({ id: 'app-shell' })
         .onboard({ id: 'login-btn' })
         .onboard({ id: 'guest-btn' })
         .onboard({ id: 'logout-btn' })
         .onboard({ id: 'user-avatar' })
         .onboard({ id: 'user-name' })
         .onboard({ id: 'user-role' })
         .onboard({ id: 'view-container' })
         .onboard({ id: 'view-title' })
         .onboard({ id: 'main-nav' })
         .onboard({ id: 'sidebar' })
         .onboard({ id: 'sidebar-toggle' })
         .onboard({ id: 'mobile-toggle' })
         .onboard({ id: 'sidebar-overlay' })
         .onboard({ id: 'run-app-tests' })
         .onboard({ id: 'login-email' })
         .onboard({ id: 'login-password' })
         .onboard({ id: 'toggle-password' })
         .onboard({ id: 'email-login-btn' })
         .onboard({ id: 'login-error' })
         .onboard({ id: 'show-forgot-btn' })
         .onboard({ id: 'login-main-form' })
         .onboard({ id: 'forgot-password-form' })
         .onboard({ id: 'reset-email' })
         .onboard({ id: 'send-reset-btn' })
         .onboard({ id: 'back-to-login-btn' });

    // Sidebar Toggle
    shell.trigger('click', 'sidebar-toggle', () => {
        shell.$('sidebar').classList.toggle('minimized');
    });

    // Run Tests
    shell.trigger('click', 'run-app-tests', (e) => {
        e.preventDefault();
        runTests();
    });

    // Mobile Toggle
    shell.trigger('click', 'mobile-toggle', () => {
        shell.$('sidebar').classList.add('show');
        shell.$('sidebar-overlay').classList.add('show');
    });

    // Accordion Logic
    shell.trigger('click', 'main-nav', (e) => {
        const category = e.target.closest('.sidebar-category');
        if (category && category.dataset.group) {
            const groupId = `group-${category.dataset.group}`;
            const groupEl = document.getElementById(groupId);
            if (groupEl) {
                const isCollapsed = category.classList.toggle('collapsed');
                groupEl.classList.toggle('d-none', isCollapsed);
            }
            return;
        }

        const link = e.target.closest('.nav-link');
        if (link) {
            e.preventDefault();
            window.location.hash = link.dataset.view;
            
            // Close mobile sidebar on nav
            shell.$('sidebar').classList.remove('show');
            shell.$('sidebar-overlay').classList.remove('show');
        }
    });

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1);
        App.navigate(hash || 'dashboard');
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.error('SW registration failed: ', err);
            });
        });
    }

    window.addEventListener('online', async () => {
        console.log('App is back online!');
    });

    shell.trigger('click', 'login-btn', () => auth.signIn());
    shell.trigger('click', 'toggle-password', () => {
        const passInput = shell.$('login-password');
        const icon = shell.$('toggle-password').querySelector('i');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            icon.classList.replace('bi-eye', 'bi-eye-slash');
        } else {
            passInput.type = 'password';
            icon.classList.replace('bi-eye-slash', 'bi-eye');
        }
    });

    shell.trigger('click', 'email-login-btn', async () => {
        const email = shell.$('login-email').value.trim();
        const pass = shell.$('login-password').value;
        const btn = shell.$('email-login-btn');
        const errDiv = shell.$('login-error');
        const card = document.querySelector('.login-card');

        if (!email || !pass) {
            if (errDiv) {
                errDiv.textContent = "Please enter both email and password.";
                errDiv.classList.remove('hidden');
            }
            card?.classList.add('shake');
            setTimeout(() => card?.classList.remove('shake'), 400);
            return;
        }
        
        const originalHtml = btn.innerHTML;
        try {
            errDiv?.classList.add('hidden');
            console.log(`Auth: Attempting email login for ${email}...`);
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
            
            await auth.signInEmail(email, pass);
            console.log("Auth: Email login successful");
        } catch (e) {
            console.error("Auth: Email login failed", e);
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            
            card?.classList.add('shake');
            setTimeout(() => card?.classList.remove('shake'), 400);

            let msg = "Login failed: " + e.message;
            if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                msg = "Incorrect password. Try again or reset via email.";
            } else if (e.code === 'auth/user-not-found') {
                msg = "Account not found. Use Google or check email.";
            } else if (e.code === 'auth/too-many-requests') {
                msg = "Too many failed attempts. Try again later.";
            }

            if (errDiv) {
                errDiv.textContent = msg;
                errDiv.classList.remove('hidden');
            } else {
                alert(msg);
            }
        }
    });

    shell.trigger('click', 'show-forgot-btn', (e) => {
        e.preventDefault();
        shell.$('login-main-form').classList.add('hidden');
        shell.$('forgot-password-form').classList.remove('hidden');
    });

    shell.trigger('click', 'back-to-login-btn', (e) => {
        e.preventDefault();
        shell.$('login-main-form').classList.remove('hidden');
        shell.$('forgot-password-form').classList.add('hidden');
    });

    shell.trigger('click', 'send-reset-btn', async () => {
        const email = shell.$('reset-email').value;
        if (!email) return alert("Please enter your email address.");
        try {
            await auth.resetPassword(email);
            alert("Password reset link has been sent to your email!");
            shell.$('login-main-form').classList.remove('hidden');
            shell.$('forgot-password-form').classList.add('hidden');
        } catch (e) {
            alert("Error sending reset link: " + e.message);
        }
    });
    shell.trigger('click', 'guest-btn', async () => {
        try {
            await auth.signInAnonymously();
        } catch (e) {
            console.error("Anon Login failed", e);
        }
    });
    shell.trigger('click', 'logout-btn', () => auth.signOut());

    return {
        init: () => {
            if (window.location.hash.startsWith('#public_booking') || window.location.hash.startsWith('#track')) {
                const overlay = document.getElementById('auth-overlay');
                if (overlay) overlay.style.display = 'none';
                const shellEl = document.getElementById('app-shell');
                if (shellEl) shellEl.style.display = 'none';

                if (window.location.hash.startsWith('#track')) {
                    const trackingId = window.location.hash.split('/')[1];
                    import('./views/view.public_tracking.js').then(module => {
                        const trView = module.PublicTrackingView(trackingId);
                        document.body.appendChild(trView.element());
                        trView.emit('init');
                    });
                } else {
                    import('./views/view.public_booking.js').then(module => {
                        const pbView = module.PublicBookingView();
                        document.body.appendChild(pbView.element());
                        pbView.emit('init');
                    });
                }
                return;
            }

            auth.onAuth(async (user) => {
                if (user) {
                    state.user = user;
                    shell.$('auth-overlay').classList.add('hidden');
                    shell.$('app-shell').classList.remove('hidden');
                    
                    shell.$('user-avatar').src = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`;
                    shell.$('user-name').textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Guest');
                    
                    // Sync user to database
                    let userDoc;
                    try {
                        userDoc = await db.findOne('users', user.uid);
                    } catch (e) {
                        console.error("Critical: Failed to get user doc", e);
                    }
                    
                    let roleId = 'viewer';
                    if (userDoc) {
                        roleId = userDoc.role_id || 'viewer';
                    } else {
                        try {
                            await db.create('users', {
                                user_id: user.uid,
                                user_name: user.displayName,
                                role_id: 'viewer',
                                created_at: db.serverTimestamp(),
                                updated_at: db.serverTimestamp(),
                                is_deleted: false,
                                metadata: { email: user.email }
                            }, user.uid);
                        } catch (e) {
                            console.error("Critical: Failed to create user doc", e);
                        }
                    }
                    state.roleId = roleId;
                    shell.$('user-role').textContent = roleId;

                    // Fetch Authorities
                    state.authorities = [];
                    if (roleId) {
                        try {
                            const roleDoc = await db.findOne('roles', roleId);
                            if (roleDoc) {
                                state.authorities = roleDoc.authorities || [];
                            }
                        } catch (e) {
                            console.error("Failed to fetch role authorities for role:", roleId, e);
                        }
                    }
                    
                    applyAuthorities();
                    App.navigate(window.location.hash.slice(1) || state.activeView);
                } else {
                    state.user = null;
                    shell.$('auth-overlay').classList.remove('hidden');
                    shell.$('app-shell').classList.add('hidden');
                    
                    // Reset login button state if it was stuck in loading
                    const loginBtn = shell.$('email-login-btn');
                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.innerHTML = 'Sign In';
                    }
                }
            });
        },

        navigate: (path) => {
            if (!state.user) return;
            let [viewId, param] = (path || '').split('/');
            if (!viewId) viewId = state.activeView;

            // Guest/Viewer restriction: Only Calendar and Gantt
            const isGuest = state.user.isAnonymous;
            const isViewer = state.roleId === 'viewer';
            const publicViews = ['calendar', 'gantt'];
            
            if ((isGuest || isViewer) && !publicViews.includes(viewId)) {
                console.warn(`Access denied to ${viewId} for ${isGuest ? 'Guest' : 'Viewer'}. Redirecting.`);
                viewId = 'calendar';
                window.location.hash = 'calendar';
            }

            state.activeView = viewId;
            
            // Update UI
            shell.$('main-nav').querySelectorAll('.nav-link').forEach(l => {
                const isActive = l.dataset.view === viewId;
                l.classList.toggle('active', isActive);
                
                // Auto-expand accordion if child is active
                if (isActive) {
                    const group = l.closest('.sidebar-group');
                    if (group) {
                        const groupId = group.id.replace('group-', '');
                        const category = document.querySelector(`.sidebar-category[data-group="${groupId}"]`);
                        if (category) {
                            category.classList.remove('collapsed');
                            group.classList.remove('d-none');
                        }
                    }
                }
            });
            shell.$('view-title').textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);
            
            // Apply fade out
            const container = shell.$('view-container');
            container.classList.add('fade-out');

            setTimeout(async () => {
                // Destroy previous view properly to stop listeners
                if (state.currentView && typeof state.currentView.destroy === 'function') {
                    state.currentView.destroy();
                }

                // Clear container
                shell.delete('view-container');

                // Load View
                let view;
                let module;
                try {
                    switch(viewId) {
                        case 'dashboard': module = await import('./views/view.dashboard.js'); view = module.DashboardView(); break;
                        case 'vans': module = await import('./views/view.vans.js'); view = module.VansView(); break;
                        case 'items': module = await import('./views/view.items.js'); view = module.ItemsView(); break;
                        case 'appointments': module = await import('./views/view.appointments.js'); view = module.AppointmentsView(); break;
                        case 'appointment': module = await import('./views/view.appointment_detail.js'); view = module.AppointmentDetailView(param); break;
                        case 'reporting': module = await import('./views/view.reporting.js'); view = module.ReportingView(); break;
                        case 'calendar': module = await import('./views/view.calendar.js'); view = module.CalendarView(); break;
                        case 'roles': module = await import('./views/view.roles.js'); view = module.RolesView(); break;
                        case 'users': module = await import('./views/view.users.js'); view = module.UsersView(); break;
                        case 'stock': module = await import('./views/view.stock.js'); view = module.StockView(); break;
                        case 'gantt': module = await import('./views/view.gantt.js'); view = module.AppointmentsGanttView(); break;
                        case 'triggers': module = await import('./views/view.triggers.js'); view = module.TriggersView(); break;
                        case 'forms': module = await import('./views/view.forms.js'); view = module.FormsView(); break;
                        case 'item_types': module = await import('./views/view.item_types.js'); view = module.ItemTypesView(); break;
                        case 'mobile_appointment': module = await import('./views/view.mobile_appointment.js'); view = module.MobileAppointmentView(param); break;
                        case 'mobile_stock': module = await import('./views/view.mobile_stock.js'); view = module.MobileStockView(); break;
                    }
                } catch (e) {
                    console.error("Failed to load view module", e);
                }

                if (view) {
                    state.currentView = view;
                    container.appendChild(view.element());
                    view.on('rendered', applyAuthorities);
                    
                    // Add listener for async loading completion if the view supports it
                    view.on('loading:start', () => document.getElementById('global-loader')?.classList.add('show'));
                    view.on('loading:end', () => document.getElementById('global-loader')?.classList.remove('show'));
                    
                    view.message('init');
                    applyAuthorities();
                }

                // Apply fade in
                container.classList.remove('fade-out');
            }, 300); // Wait for fade out transition (0.3s)
        }
    };
})();

App.init();
export default App;
