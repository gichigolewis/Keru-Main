const button = document.querySelector(".btn");
const menu = document.querySelector(".menu");
const nav = document.querySelector(".nav");
const navLinks = document.querySelectorAll(".nav a");
const footerDate = document.getElementById("current-year");
const aside = document.querySelector("aside");
const joinBtn = document.querySelector(".join");
// Set the current year in the footer
if (footerDate) {
    footerDate.textContent = new Date().getFullYear();
}

// 1. Define modular open and close functions
const openMenu = () => {
    if (!aside) return;
    aside.style.display = "block";
    aside.offsetHeight; // Force browser reflow to guarantee CSS animation plays
    aside.classList.remove("slide-out");
    aside.classList.add("slide-in");
    if (joinBtn) {
        joinBtn.style.display = "block"; // Show the Join Us button when menu opens
    }
};

const closeMenu = () => {
    if (!aside || !aside.classList.contains("slide-in")) return;

    aside.classList.remove("slide-in");
    aside.classList.add("slide-out");
    
    // Hide display after CSS transition completes (match your transition duration, e.g., 300ms)
    setTimeout(() => {
        if (aside && aside.classList.contains("slide-out")) {
            aside.style.display = "none";
        }
    }, 300); 
};

// 2. Toggle menu when clicking the menu button
if (menu) {
    menu.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevents this click from immediately triggering the document listener
        const isOpen = aside && aside.classList.contains("slide-in");
        
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });
}

// 3. Auto-close when clicking outside the aside section
document.addEventListener("click", (e) => {
    if (!aside) return;
    // If the click happened OUTSIDE the aside AND OUTSIDE the menu button, close it
    if (!aside.contains(e.target) && !(menu && menu.contains(e.target))) {
        closeMenu();
    }
});



// 4. Auto-close when the user scrolls
// window.addEventListener("scroll", () => {
//     closeMenu();
// }, { passive: true }); // Optimizes scroll performance


// button.addEventListener('click', () => {
//     alert("Feature coming soon")
// })
  
  // Sabbath Countdown Logic
        function updateSabbathCountdown() {
            const now = new Date();
            
            // Calculate time until next Friday at 18:00 (Sunset Proxy)
            const dayOfWeek = now.getDay(); 
            let daysUntilFriday = 5 - dayOfWeek;
            
            // If it's past Friday 6 PM or it's Saturday, aim for next week's Friday
            if (daysUntilFriday < 0 || (daysUntilFriday === 0 && now.getHours() >= 18)) {
                daysUntilFriday += 7; 
            }
            
            const nextFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFriday);
            nextFriday.setHours(18, 0, 0, 0);

            const diff = nextFriday - now;

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);

            // Determine if it's currently Sabbath
            if (dayOfWeek === 6 || (dayOfWeek === 5 && now.getHours() >= 18)) {
                document.getElementById("sabbath-countdown").innerText = "It's Sabbath! Welcome.";
                document.getElementById("sabbath-countdown").style.color = "#fff";
            } else {
                document.getElementById("sabbath-countdown").innerText = `${days}d ${hours}h ${minutes}m`;
            }
        }

        // Initialize and set interval
        updateSabbathCountdown();
        setInterval(updateSabbathCountdown, 60000); // Refresh every minute

        // --- Announcements storage and admin functions ---
        let useBackend = false;
        let authHeader = null;

        // Session storage helpers for admin auth
        function getStoredAuth() {
            try {
                return sessionStorage.getItem('adminAuth');
            } catch (e) {
                return null;
            }
        }

        function setStoredAuth(header, user) {
            try {
                sessionStorage.setItem('adminAuth', header);
                sessionStorage.setItem('adminUser', user || '');
            } catch (e) {}
        }

        function clearStoredAuth() {
            try {
                sessionStorage.removeItem('adminAuth');
                sessionStorage.removeItem('adminUser');
            } catch (e) {}
        }

        function updateLoginUI() {
            const loginBtn = document.getElementById('admin-login-btn');
            const modal = document.getElementById('admin-login-modal');
            const loggedDiv = document.getElementById('admin-logged');
            const loggedUser = document.getElementById('admin-logged-user');
            const stored = getStoredAuth();
            const user = sessionStorage.getItem('adminUser') || '';

            if (stored) {
                if (loginBtn) loginBtn.textContent = 'Admin';
                if (loggedDiv) { loggedDiv.style.display = 'block'; }
                if (loggedUser) loggedUser.textContent = user;
                if (modal) modal.style.display = 'none';
            } else {
                if (loginBtn) loginBtn.textContent = 'Admin Login';
                if (loggedDiv) { loggedDiv.style.display = 'none'; }
            }
        }

        function isAdminLoggedIn() {
            return !!getStoredAuth();
        }

        async function requireAdminLogin() {
            if (isAdminLoggedIn()) return true;
            return !!(await ensureAuth());
        }

        async function verifyAuthHeader(header) {
            try {
                const res = await fetch('/api/auth-check', {
                    method: 'GET',
                    headers: { Authorization: header }
                });
                return res.ok;
            } catch (e) {
                return false;
            }
        }

        async function detectBackend() {
            try {
                const res = await fetch('/api/ping', { cache: 'no-store' });
                if (res.ok) {
                    useBackend = true;
                    return true;
                }
            } catch (e) {
                // ignore
            }
            useBackend = false;
            return false;
        }

        async function getAnnouncements() {
            if (useBackend) {
                const res = await fetch('/api/announcements', { cache: 'no-store' });
                if (!res.ok) return [];
                return res.json();
            }
            try {
                const raw = localStorage.getItem('announcements');
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                console.error('Failed to parse announcements', e);
                return [];
            }
        }

        function saveAnnouncementsLocal(list) {
            localStorage.setItem('announcements', JSON.stringify(list));
        }

        async function renderAnnouncementsList(container) {
            const list = await getAnnouncements();
            container.innerHTML = '';

            if (!list.length) {
                container.innerHTML = '<p>No announcements yet.</p>';
                return;
            }

            list.slice().reverse().forEach(a => {
                const el = document.createElement('article');
                el.className = 'announcement';
                const date = a.date ? `<time>${a.date}</time>` : '';
                el.innerHTML = `<h3>${escapeHtml(a.title)}</h3>${date}<p>${escapeHtml(a.content)}</p>`;
                container.appendChild(el);
            });
        }

        async function renderAdminList() {
            const container = document.getElementById('admin-announcements');
            if (!container) return;

            const list = await getAnnouncements();
            container.innerHTML = '';
            if (!list.length) {
                container.innerHTML = '<p>No announcements yet.</p>';
                return;
            }

            list.slice().reverse().forEach(a => {
                const row = document.createElement('div');
                row.className = 'admin-row';
                row.style.border = '1px solid #ddd';
                row.style.padding = '0.7rem';
                row.style.marginBottom = '0.6rem';
                const date = a.date ? ` <small>${a.date}</small>` : '';
                row.innerHTML = `<strong>${escapeHtml(a.title)}</strong>${date}<div style="margin-top:0.5rem">${escapeHtml(a.content)}</div>`;

                const btns = document.createElement('div');
                btns.style.marginTop = '0.5rem';

                const edit = document.createElement('button');
                edit.textContent = 'Edit';
                edit.className = 'btn';
                edit.style.marginRight = '0.5rem';
                edit.addEventListener('click', () => startEdit(a.id));

                const del = document.createElement('button');
                del.textContent = 'Delete';
                del.className = 'btn';
                del.style.background = '#c0392b';
                del.addEventListener('click', async () => {
                    if (!confirm('Delete this announcement?')) return;
                    await deleteAnnouncement(a.id);
                });

                btns.appendChild(edit);
                btns.appendChild(del);
                row.appendChild(btns);
                container.appendChild(row);
            });
        }

        async function ensureAuth() {
            if (authHeader) return authHeader;
            const stored = getStoredAuth();
            if (stored) {
                authHeader = stored;
                return authHeader;
            }

            const modal = document.getElementById('admin-login-modal');
            if (modal) {
                modal.style.display = 'flex';
                return null;
            }

            const user = prompt('Admin username:');
            if (user === null) return null;
            const pass = prompt('Admin password:');
            if (pass === null) return null;
            authHeader = 'Basic ' + btoa(`${user}:${pass}`);
            setStoredAuth(authHeader, user);
            return authHeader;
        }

        async function addAnnouncement({ title, content, date }) {
            if (useBackend) {
                const h = await ensureAuth();
                if (!h) return;
                const res = await fetch('/api/announcements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': h },
                    body: JSON.stringify({ title, content, date })
                });
                if (res.status === 401) { authHeader = null; return alert('Unauthorized'); }
                if (!res.ok) return alert('Failed to add announcement');
                await renderAdminList();
                const announcementsContainer = document.getElementById('announcements-list');
                if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
                return;
            }

            const list = await getAnnouncements();
            const ann = { id: Date.now().toString(), title, content, date };
            list.push(ann);
            saveAnnouncementsLocal(list);
            await renderAdminList();
            const announcementsContainer = document.getElementById('announcements-list');
            if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
        }

        async function updateAnnouncement(id, { title, content, date }) {
            if (useBackend) {
                const h = await ensureAuth();
                if (!h) return;
                const res = await fetch(`/api/announcements/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': h },
                    body: JSON.stringify({ title, content, date })
                });
                if (res.status === 401) { authHeader = null; return alert('Unauthorized'); }
                if (!res.ok) return alert('Failed to update');
                await renderAdminList();
                const announcementsContainer = document.getElementById('announcements-list');
                if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
                return;
            }

            const list = await getAnnouncements();
            const idx = list.findIndex(x => x.id === id);
            if (idx === -1) return;
            list[idx].title = title;
            list[idx].content = content;
            list[idx].date = date;
            saveAnnouncementsLocal(list);
            await renderAdminList();
            const announcementsContainer = document.getElementById('announcements-list');
            if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
        }

        async function deleteAnnouncement(id) {
            if (useBackend) {
                const h = await ensureAuth();
                if (!h) return;
                const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE', headers: { 'Authorization': h } });
                if (res.status === 401) { authHeader = null; return alert('Unauthorized'); }
                if (res.status === 404) return alert('Not found');
                if (!res.ok && res.status !== 204) return alert('Failed to delete');
                await renderAdminList();
                const announcementsContainer = document.getElementById('announcements-list');
                if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
                return;
            }

            let list = await getAnnouncements();
            list = list.filter(x => x.id !== id);
            saveAnnouncementsLocal(list);
            await renderAdminList();
            const announcementsContainer = document.getElementById('announcements-list');
            if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
        }

        function startEdit(id) {
            getAnnouncements().then(list => {
                const item = list.find(x => x.id === id);
                if (!item) return;
                const formTitle = document.getElementById('form-title');
                const idEl = document.getElementById('ann-id');
                const titleEl = document.getElementById('ann-title');
                const contentEl = document.getElementById('ann-content');
                const dateEl = document.getElementById('ann-date');
                const cancelBtn = document.getElementById('cancel-edit');

                if (formTitle) formTitle.textContent = 'Edit Announcement';
                if (idEl) idEl.value = item.id;
                if (titleEl) titleEl.value = item.title;
                if (contentEl) contentEl.value = item.content;
                if (dateEl) dateEl.value = item.date || '';
                if (cancelBtn) cancelBtn.style.display = 'inline-block';
            });
        }

        function escapeHtml(str) {
            if (!str && str !== '') return '';
            return String(str).replace(/[&<>\"']/g, function (s) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": "&#39;" })[s];
            });
        }

        document.addEventListener('DOMContentLoaded', async () => {
            await detectBackend();
            const announcementsContainer = document.getElementById('announcements-list');
            if (announcementsContainer) await renderAnnouncementsList(announcementsContainer);
            // Initialize login UI
            updateLoginUI();
            const loginBtn = document.getElementById('admin-login-btn');
            const modal = document.getElementById('admin-login-modal');
            const loginForm = document.getElementById('admin-login-form');
            const loginCancel = document.getElementById('admin-login-cancel');
            const logoutBtn = document.getElementById('admin-logout');
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('service-worker.js')
                    .then(() => console.log('Service worker registered'))
                    .catch(err => console.warn('Service worker registration failed:', err));
            }

            if (loginBtn) loginBtn.addEventListener('click', () => {
                if (modal) modal.style.display = 'flex';
            });

            if (loginCancel && modal) loginCancel.addEventListener('click', () => { modal.style.display = 'none'; });

            if (loginForm) loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const user = document.getElementById('admin-user').value.trim();
                const pass = document.getElementById('admin-pass').value;
                if (!user || !pass) return alert('Provide username and password');
                authHeader = 'Basic ' + btoa(`${user}:${pass}`);
                const isValid = await verifyAuthHeader(authHeader);
                const loginResult = document.getElementById('login-result');
                if (!isValid) {
                    authHeader = null;
                    clearStoredAuth();
                    if (loginResult) {
                        loginResult.style.display = 'block';
                        loginResult.textContent = 'Invalid credentials. Please try again.';
                        loginResult.style.color = '#c0392b';
                    } else {
                        alert('Invalid admin credentials');
                    }
                    return;
                }
                setStoredAuth(authHeader, user);
                updateLoginUI();
                if (loginResult) {
                    loginResult.style.display = 'block';
                    loginResult.textContent = 'Logged in — redirecting to Admin panel...';
                    loginResult.style.color = 'var(--primary-color)';
                    setTimeout(() => { window.location.href = 'admin.html'; }, 700);
                }
            });

            if (logoutBtn) logoutBtn.addEventListener('click', () => {
                authHeader = null;
                clearStoredAuth();
                updateLoginUI();
            });

            // Admin page bindings
            const form = document.getElementById('announcement-form');
            if (form) {
                if (!(await requireAdminLogin())) return;
                await renderAdminList();

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('ann-id').value;
                    const title = document.getElementById('ann-title').value.trim();
                    const content = document.getElementById('ann-content').value.trim();
                    const date = document.getElementById('ann-date').value || '';

                    if (!title || !content) {
                        alert('Please provide title and content.');
                        return;
                    }

                    if (id) {
                        await updateAnnouncement(id, { title, content, date });
                    } else {
                        await addAnnouncement({ title, content, date });
                    }

                    form.reset();
                    document.getElementById('ann-id').value = '';
                    const formTitle = document.getElementById('form-title');
                    if (formTitle) formTitle.textContent = 'Create Announcement';
                    const cancelBtn = document.getElementById('cancel-edit');
                    if (cancelBtn) cancelBtn.style.display = 'none';
                });

                const cancelBtn = document.getElementById('cancel-edit');
                if (cancelBtn) cancelBtn.addEventListener('click', () => {
                    form.reset();
                    document.getElementById('ann-id').value = '';
                    const formTitle = document.getElementById('form-title');
                    if (formTitle) formTitle.textContent = 'Create Announcement';
                    cancelBtn.style.display = 'none';
                });
            }
        });