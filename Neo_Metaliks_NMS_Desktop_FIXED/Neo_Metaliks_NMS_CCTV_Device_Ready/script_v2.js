/* =====================================================
   NMS PAGE NAVIGATION - SINGLE SOURCE OF TRUTH
===================================================== */
const pageHeadings = {
    dashboard: 'Network Monitoring Dashboard',
    devices: 'Device Inventory',
    cameras: 'CCTV Camera Wall',
    desktops: 'Desktop Management',
    network: 'Live Network Map',
    alerts: 'Alerts & Incidents',
    reports: 'Reports & Analytics',
    settings: 'NMS Settings',
    'admin-profile-page': 'Administrator Profile'
};

function getPages() {
    return [...document.querySelectorAll('.page')];
}

function getNavItems() {
    return [...document.querySelectorAll('.nav[data-page], .nav-item[data-page]')];
}

function openPage(pageName, updateHash = true) {
    const target = document.getElementById(pageName);
    if (!target || !target.classList.contains('page')) {
        console.warn('NMS page not found:', pageName);
        return false;
    }

    getPages().forEach(page => page.classList.remove('active'));
    getNavItems().forEach(item => item.classList.remove('active'));

    target.classList.add('active');

    getNavItems().forEach(item => {
        if (item.dataset.page === pageName) item.classList.add('active');
    });

    const heading = document.getElementById('pageHeading');
    if (heading) heading.textContent = pageHeadings[pageName] || 'NMS Control Center';

    if (updateHash && window.location.hash !== '#' + pageName) {
        history.replaceState(null, '', '#' + pageName);
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    if (pageName === 'dashboard' && typeof drawChart === 'function') setTimeout(drawChart, 30);
    if (pageName === 'admin-profile-page' && typeof loadAdminProfileData === 'function') loadAdminProfileData();
    return true;
}

function handlePageNavigation(event) {
    const nav = event.target.closest('.nav[data-page], .nav-item[data-page]');
    if (!nav) return;
    const pageName = nav.dataset.page;
    if (!pageName) return;
    event.preventDefault();
    openPage(pageName);
}

document.addEventListener('click', handlePageNavigation);
window.addEventListener('hashchange', function () {
    const pageName = window.location.hash.substring(1) || 'dashboard';
    openPage(pageName, false);
});

const initialPage = window.location.hash.substring(1) || 'dashboard';
openPage(document.getElementById(initialPage) ? initialPage : 'dashboard', false);

function updateClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    let timeFormat = '24';
    try {
        const saved = JSON.parse(localStorage.getItem('nmsSettings') || '{}');
        timeFormat = saved.timeFormat || timeFormat;
    } catch (e) { }
    try {
        el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: (timeFormat === '12') });
    } catch (e) { }
}
function clock() { updateClock() }
setInterval(clock, 1000); clock();

function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(window.tt); window.tt = setTimeout(() => t.classList.remove('show'), 2300) }
function showToast(msg) { toast(msg); }

function refreshAll() { window.location.reload(); }
function ackAlerts() { document.getElementById('dashAlerts').textContent = '0'; toast('All alerts acknowledged') }
async function pingTest() {
    const btn = document.querySelector('button[onclick="pingTest()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '&#9203; Pinging...';
    }
    
    if (typeof toast === 'function') toast('Running ping test on all devices...');
    
    if (typeof backendDevices !== 'undefined' && Array.isArray(backendDevices)) {
        const pingPromises = backendDevices.map(d => {
            if (typeof pingDeviceFromFrontend === 'function') {
                return pingDeviceFromFrontend(d.id, { silent: true }).catch(e => null);
            }
            return Promise.resolve();
        });
        await Promise.allSettled(pingPromises);
    }
    
    if (typeof loadNetworkMap === 'function') {
        await loadNetworkMap();
    }
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '&#9889; Run Ping Test';
    }
    
    if (typeof toast === 'function') toast('Ping test completed successfully!');
}

let devices = [
    ['SW-01', 'Core Switch', '10.10.1.1', 'Data Center', 'Online', '99.98%'],
    ['SW-02', 'Access Switch', '10.10.2.1', 'Admin Block', 'Online', '99.94%'],
    ['SW-04', 'Access Switch', '10.10.4.1', 'Admin Block', 'Online', '99.82%'],
    ['SW-07', 'Access Switch', '10.10.7.1', 'Production Block', 'Offline', '96.20%'],
    ['RTR-01', 'Gateway Router', '10.10.0.1', 'Network Room', 'Online', '99.99%'],
    ['RTR-02', 'Backup Router', '10.10.0.2', 'Data Center', 'Online', '99.91%'],
    ['AP-04', 'Access Point', '10.10.20.14', 'Admin Block', 'Online', '99.71%'],
    ['AP-07', 'Access Point', '10.10.20.17', 'Production Block', 'Online', '98.90%'],
    ['FW-01', 'Firewall', '10.10.0.254', 'Data Center', 'Online', '99.99%']
];
function loadCustomDevices() {
    try {
        const saved = JSON.parse(localStorage.getItem('nmsCustomDevices') || '[]');
        if (Array.isArray(saved)) {
            saved.forEach(d => {
                if (Array.isArray(d) && d.length >= 6 && !devices.some(x => x[0] === d[0])) devices.push(d);
            });
        }
    } catch (error) { console.warn('Custom device data could not be loaded.', error); }
}

function saveCustomDevices() {
    const baseIds = new Set(['SW-01', 'SW-02', 'SW-04', 'SW-07', 'RTR-01', 'RTR-02', 'AP-04', 'AP-07', 'FW-01']);
    const custom = devices.filter(d => !baseIds.has(d[0]));
    localStorage.setItem('nmsCustomDevices', JSON.stringify(custom));
}

// ==========================================
// DEVICES - LOAD FROM BACKEND
// ==========================================

let backendDevices = [];


async function loadDevicesFromBackend() {

    const token =
        localStorage.getItem("access_token");

    if (!token) {
        window.location.replace("login.html");
        return;
    }

    window.openDesktopLocationModal = openDesktopLocationModal;
    window.closeDesktopLocationModal = closeDesktopLocationModal;
    window.applyDesktopMonitoringLocation = applyDesktopMonitoringLocation;

    try {

        const response = await fetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/devices?_t=${Date.now()}`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        "Bearer " + token
                }
            }
        );

        if (!response.ok) {

            if (response.status === 401) {

                localStorage.removeItem(
                    "access_token"
                );

                window.location.replace(
                    "login.html"
                );

                return;
            }

            throw new Error(
                "Device API request failed."
            );
        }

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message ||
                "Device loading failed."
            );
        }

        backendDevices =
            Array.isArray(data.devices)
                ? data.devices
                : [];

        renderBackendDevices(
            backendDevices
        );

        console.log(
            "✅ MySQL devices loaded:",
            backendDevices.length
        );

    } catch (error) {

        console.error(
            "Device backend error:",
            error
        );

        const tbody =
            document.getElementById(
                "deviceRows"
            );

        if (tbody) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8"
                        style="
                            text-align:center;
                            padding:30px;
                            color:#ff6472;
                        ">
                        Device data load করা যায়নি।
                    </td>
                </tr>
            `;
        }

        toast(
            "Backend থেকে device data load করা যায়নি"
        );
    }
}

// ==========================================================
// DEVICES FRONTEND AUTO REFRESH
// ==========================================================

let devicesFrontendRefreshTimer = null;

function startDevicesFrontendAutoRefresh() {

    if (devicesFrontendRefreshTimer) {
        clearInterval(
            devicesFrontendRefreshTimer
        );
    }

    // Page open হলে একবার immediately load
    loadDevicesFromBackend();

    console.log("✅ Devices frontend initial load complete. Auto-refresh DISABLED as per user request.");
}

document.addEventListener(
    "DOMContentLoaded",
    function () {

        startDevicesFrontendAutoRefresh();
        startCCTVFrontendAutoRefresh();

    }
);


function renderBackendDevices(
    list = backendDevices
) {
    const dBadge = document.getElementById('sidebarDevicesCount');
    if (dBadge && list === backendDevices) dBadge.textContent = backendDevices.length;

    const tbody =
        document.getElementById(
            "deviceRows"
        );

    if (!tbody) {
        return;
    }


    // ------------------------------------------
    // NO DEVICE
    // ------------------------------------------

    if (!list.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8"
                    style="
                        text-align:center;
                        padding:30px;
                        color:#71859a;
                    ">
                    No devices found in database.
                </td>
            </tr>
        `;

        return;
    }


    // ------------------------------------------
    // RENDER
    // ------------------------------------------

    tbody.innerHTML =
        list.map(function (device) {

            const status =
                String(
                    device.status || "Unknown"
                ).toLowerCase();


            // --------------------------------------
            // UPTIME
            // --------------------------------------

            const uptime =
                device.uptime_percent !== null &&
                    device.uptime_percent !== undefined
                    ? `${Number(device.uptime_percent).toFixed(2)}%`
                    : "—";


            // --------------------------------------
            // LATENCY
            // --------------------------------------

            const latency =
                device.last_latency_ms !== null &&
                    device.last_latency_ms !== undefined
                    ? `${Number(device.last_latency_ms).toFixed(0)} ms`
                    : "—";


            // --------------------------------------
            // LAST CHECK
            // --------------------------------------

            let lastCheck = "—";


            if (device.last_check) {

                try {

                    const date =
                        new Date(
                            device.last_check
                        );


                    if (!isNaN(date.getTime())) {

                        lastCheck =
                            date.toLocaleString(
                                "en-IN",
                                {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                    hour12: false
                                }
                            );
                    }

                } catch (error) {

                    console.warn(
                        "Last check date format error:",
                        error
                    );

                    lastCheck =
                        device.last_check;
                }
            }


            return `
                <tr>

                    <!-- DEVICE -->

                    <td>
                        <b>
                            ${device.device_code || "—"}
                        </b>

                        <small>
                            ${device.device_name || "—"}
                        </small>
                    </td>


                    <!-- TYPE -->

                    <td>
                        ${device.device_type || "—"}
                    </td>


                    <!-- IP -->

                    <td>
                        ${device.ip_address || "—"}
                    </td>


                    <!-- LOCATION -->

                    <td>
                        ${device.location || "—"}
                    </td>


                    <!-- STATUS -->

                    <td>
                        <span class="status ${status}">
                            ● ${device.status || "Unknown"}
                        </span>
                    </td>


                    <!-- LATENCY -->

                    <td>
                        ${latency}
                    </td>


                    <!-- UPTIME -->

                    <td>
                        <strong>
                            ${uptime}
                        </strong>
                    </td>


                    <!-- LAST CHECK -->

                    <td>

                        <div>
                            ${lastCheck}
                        </div>


                        <div style="
                            display:flex;
                            gap:8px;
                            margin-top:8px;
                            flex-wrap:wrap;
                        ">

                            <button
                                type="button"
                                class="device-ping-btn"
                                onclick="pingDeviceFromFrontend(${device.id})">

                                PING

                            </button>


                            <button
                                type="button"
                                class="device-delete-btn"
                                onclick="deleteDeviceFromFrontend(
                                    ${device.id},
                                    '${String(
                device.device_code || ""
            ).replace(
                /'/g,
                "\\'"
            )}'
                                )">

                                DELETE

                            </button>

                        </div>

                    </td>

                </tr>
            `;

        }).join("");
}

function filterDevices() {

    const searchBox = document.getElementById("deviceSearch");
    const typeBox = document.getElementById("deviceTypeFilter");
    const statusBox = document.getElementById("deviceStatusFilter");

    const query = searchBox ? searchBox.value.trim().toLowerCase() : "";
    const typeVal = typeBox ? typeBox.value : "All Types";
    const statusVal = statusBox ? statusBox.value : "All Status";

    const filtered = backendDevices.filter(function (device) {
        // Search text filter
        const matchesQuery = [
            device.device_code,
            device.device_name,
            device.device_type,
            device.ip_address,
            device.location,
            device.status
        ].join(" ").toLowerCase().includes(query);
        
        // Type filter
        const matchesType = (typeVal === "All Types") || (device.device_type === typeVal);
        
        // Status filter
        const matchesStatus = (statusVal === "All Status") || (device.status === statusVal);

        return matchesQuery && matchesType && matchesStatus;
    });

    renderBackendDevices(filtered);
}


// Load database devices
document.addEventListener(
    "DOMContentLoaded",
    function () {
        loadDevicesFromBackend();
    }
);
const camNames = ['Main Gate', 'Gate-2', 'Main Yard', 'Production Line-1', 'Production Line-2', 'Warehouse', 'Admin Lobby', 'Control Room', 'Parking-A', 'Parking-B', 'Raw Material', 'Dispatch', 'Canteen', 'Substation', 'Workshop', 'Boundary-N'];
document.getElementById('cameraGrid').innerHTML = camNames.map((name, i) => `<div class="camera ${i === 10 ? 'offline' : ''}"><div class="camera-feed">${i === 10 ? '▧' : '◉'}</div><div class="camera-info"><span>CAM-${String(i + 1).padStart(2, '0')} · ${name}</span><span>${i === 10 ? 'OFFLINE' : 'LIVE'}</span></div></div>`).join('');
function setCameraGrid(n) { toast('Camera layout set to ' + n + ' × ' + n) }



function drawChart() {
    const c = document.getElementById('chart'); if (!c) return;
    const r = c.getBoundingClientRect(), d = devicePixelRatio || 1, w = r.width, h = r.height;
    c.width = w * d; c.height = h * d; const x = c.getContext('2d'); x.scale(d, d); x.clearRect(0, 0, w, h);
    x.strokeStyle = '#1a2e40'; x.lineWidth = 1;
    for (let y = 15; y < h; y += 42) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke() }
    const vals = [31, 36, 33, 45, 41, 52, 49, 61, 56, 64, 58, 67, 62, 71, 65, 60, 54, 58, 49, 52, 46, 50, 43, 38];
    x.beginPath(); vals.forEach((v, i) => { let px = i * w / (vals.length - 1), py = h - 14 - v / 80 * (h - 30); i ? x.lineTo(px, py) : x.moveTo(px, py) });
    x.strokeStyle = '#31a9ef'; x.lineWidth = 2; x.stroke();
    x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.fillStyle = 'rgba(49,169,239,.08)'; x.fill();
}
window.addEventListener('resize', drawChart); setTimeout(drawChart, 100);
document.getElementById('menuBtn').onclick = () => document.getElementById('sidebar').classList.toggle('open');
/* =========================================================
   ADMIN LOGOUT
========================================================= */

function adminLogout() {

    // Confirmation
    const confirmLogout = confirm(
        "Are you sure you want to logout?"
    );

    if (!confirmLogout) {
        return;
    }


    /* -----------------------------------------
       CLEAR LOGIN / SESSION DATA
    ----------------------------------------- */

    // Clear temporary session data
    sessionStorage.clear();


    // Remove admin/login related data
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_phone");
    localStorage.removeItem("admin_department");
    localStorage.removeItem("admin_location");

    localStorage.removeItem("loggedIn");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("user");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("access_token");

    /* -----------------------------------------
       OPTIONAL: CLEAR ALL DEMO DATA
       Uncomment if you want complete logout
    ----------------------------------------- */

    // localStorage.clear();


    /* -----------------------------------------
       SHOW LOGOUT MESSAGE
    ----------------------------------------- */

    try {

        if (typeof showToast === "function") {

            showToast(
                "You have been logged out successfully."
            );

        }

    } catch (error) {

        console.log("Logout notification error:", error);

    }


    /* -----------------------------------------
       REDIRECT TO LOGIN
    ----------------------------------------- */

    setTimeout(function () {

        window.location.href = "login.html";

    }, 500);

}
// ==========================================
// ADMIN PROFILE - ROBUST IMPLEMENTATION
// ==========================================

function closeAdminMenu() {
    const menu = document.getElementById('adminMenu');
    const button = document.getElementById('adminButton');
    if (menu) menu.classList.remove('show');
    const arrow = button ? button.querySelector('.admin-arrow') : null;
    if (arrow) arrow.style.transform = 'rotate(0deg)';
}

function openAdminProfile() {
    closeAdminMenu();
    if (typeof openPage === 'function') {
        openPage('admin-profile-page');
    }
    loadAdminProfileData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAdminSettings() {
    closeAdminMenu();
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof openPage === 'function') openPage('settings');
    showToast('Admin Settings opened');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAdminActivity() {
    closeAdminMenu();
    showToast('Activity Log feature removed');
}

function updateAdminProfileUI(name, email, phone, department, location) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };

    setValue('adminName', name);
    setValue('adminEmail', email);
    setValue('adminPhone', phone);
    setValue('adminDepartment', department);
    setValue('adminLocation', location);

    setText('profileDisplayName', name);
    setText('displayFullName', name);
    setText('displayEmail', email);
    setText('displayPhone', phone);
    setText('displayDepartment', department || 'IT & Network');
    setText('displayLocation', location || 'Neo Metaliks');

    const letter = (name || 'A').charAt(0).toUpperCase();
    ['profileAvatarLarge', 'editProfileAvatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.querySelector('img')) el.textContent = letter;
    });

    document.querySelectorAll('.admin-avatar, .admin-large-avatar').forEach(avatar => {
        if (!avatar.querySelector('img')) avatar.textContent = letter;
    });
    document.querySelectorAll('.admin-info strong, .admin-menu-header strong').forEach(el => {
        el.textContent = name;
    });
}

async function loadAdminProfileData() {

    const token = localStorage.getItem("access_token");

    // Token না থাকলে login page
    if (!token) {
        window.location.replace("login.html");
        return;
    }

    try {

        const response = await fetch(
            window.APP_CONFIG.API_BASE_URL + "/api/auth/me",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load administrator profile.");
        }

        const data = await response.json();

        if (!data.success || !data.admin) {
            throw new Error("Invalid administrator data.");
        }

        const admin = data.admin;

        const name = admin.name || "Administrator";
        const email = admin.email || "";
        const phone = admin.phone || "";
        const department = admin.department || "";
        const location = admin.location || "";

        // Browser-এ সর্বশেষ data save
        localStorage.setItem("admin_id", admin.id);
        localStorage.setItem("admin_name", name);
        localStorage.setItem("admin_email", email);
        localStorage.setItem("admin_phone", phone);
        localStorage.setItem("admin_department", department);
        localStorage.setItem("admin_location", location);

        // Profile page update
        updateAdminProfileUI(
            name,
            email,
            phone,
            department,
            location
        );
        const savedProfileImage =
            localStorage.getItem(
                "admin_profile_image"
            );

        if (savedProfileImage) {

            setProfileImage(
                API_BASE_URL +
                savedProfileImage
            );
        }
    } catch (error) {

        console.error(
            "Admin profile loading error:",
            error
        );

        showToast(
            "Administrator profile load করা যায়নি"
        );
    }
}
function cancelProfileEdit() {
    loadAdminProfileData();
    openPage('dashboard');
    showToast('Profile changes cancelled');
}

function bindAdminProfileForm() {

    const form = document.getElementById("adminProfileForm");

    if (!form || form.dataset.bound === "true") {
        return;
    }

    form.dataset.bound = "true";

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const token = localStorage.getItem("access_token");

        if (!token) {
            alert("Your login session has expired.");
            window.location.replace("login.html");
            return;
        }

        const name =
            document.getElementById("adminName")?.value.trim() || "";

        const email =
            document.getElementById("adminEmail")?.value.trim() || "";

        const phone =
            document.getElementById("adminPhone")?.value.trim() || "";

        const department =
            document.getElementById("adminDepartment")?.value.trim() || "";

        const location =
            document.getElementById("adminLocation")?.value.trim() || "";

        if (!name) {
            alert("Please enter your full name.");
            return;
        }

        if (!email) {
            alert("Please enter your email.");
            return;
        }

        const saveButton =
            document.querySelector(".profile-save-btn");

        const originalText =
            saveButton ? saveButton.innerHTML : "";

        try {

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.innerHTML = "Saving...";
            }

            const response = await fetch(
                window.APP_CONFIG.API_BASE_URL + "/api/auth/profile",
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    },

                    body: JSON.stringify({
                        name: name,
                        email: email,
                        phone: phone || null,
                        department: department || null,
                        location: location || null
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail ||
                    data.message ||
                    "Profile update failed."
                );
            }

            const admin = data.admin;
            if (admin.profile_image) {

                localStorage.setItem(
                    "admin_profile_image",
                    admin.profile_image
                );

                setProfileImage(
                    API_BASE_URL +
                    admin.profile_image
                );
            }
            // Update browser storage
            localStorage.setItem(
                "admin_id",
                admin.id
            );

            localStorage.setItem(
                "admin_name",
                admin.name
            );

            localStorage.setItem(
                "admin_email",
                admin.email
            );

            localStorage.setItem(
                "admin_phone",
                admin.phone || ""
            );

            localStorage.setItem(
                "admin_department",
                admin.department || ""
            );

            localStorage.setItem(
                "admin_location",
                admin.location || ""
            );

            // Update profile UI
            updateAdminProfileUI(
                admin.name,
                admin.email,
                admin.phone || "",
                admin.department || "",
                admin.location || ""
            );

            showToast(
                "Administrator profile updated successfully"
            );

        } catch (error) {

            console.error(
                "Profile update error:",
                error
            );

            alert(
                error.message ||
                "Unable to update administrator profile."
            );

        } finally {

            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = originalText;
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    bindAdminProfileForm();
    loadAdminProfileData();
});

// ==========================================
// ADMIN MENU BINDING (ONE RELIABLE HANDLER)
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('adminButton');
    const menu = document.getElementById('adminMenu');
    if (!button || !menu || button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';

    button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        menu.classList.toggle('show');
        const arrow = button.querySelector('.admin-arrow');
        if (arrow) {
            arrow.style.transform = menu.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });

    menu.addEventListener('click', function (event) {
        const item = event.target.closest('.admin-menu-item');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();

        const text = (item.innerText || '').trim();
        if (text.includes('Admin Profile')) openAdminProfile();
        else if (text.includes('Admin Settings')) openAdminSettings();
        else if (text.includes('Activity Log')) showAdminActivity();
        else if (text.includes('Logout')) adminLogout();
    });

    document.addEventListener('click', function () {
        closeAdminMenu();
    });
});

// Always expose these functions for inline buttons / browser console.
window.openAdminProfile = openAdminProfile;
window.openAdminSettings = openAdminSettings;
window.showAdminActivity = showAdminActivity;
window.loadAdminProfileData = loadAdminProfileData;
window.cancelProfileEdit = cancelProfileEdit;

// ==========================================
// PROFILE PHOTO - BACKEND UPLOAD
// ==========================================

const profileImageInput =
    document.getElementById("profileImageInput");

const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;


function setProfileImage(imageUrl) {

    if (!imageUrl) {
        return;
    }

    const elementsToUpdate = [];
    
    // Header Avatar
    const headerAvatar = document.querySelector("#adminButton .admin-avatar");
    if (headerAvatar) elementsToUpdate.push(headerAvatar);
    
    // Profile Page Avatars
    const largeAvatar = document.getElementById("profileAvatarLarge");
    if (largeAvatar) elementsToUpdate.push(largeAvatar);
    
    const editAvatar = document.getElementById("editProfileAvatar");
    if (editAvatar) elementsToUpdate.push(editAvatar);

    elementsToUpdate.forEach(function (element) {

        if (!element) {
            return;
        }

        element.innerHTML = `
            <img
                src="${imageUrl}"
                alt="Admin profile"
                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    border-radius:50%;
                "
            >
        `;
    });

    // Top administrator avatar-ও update
    document
        .querySelectorAll(
            ".admin-avatar, .admin-large-avatar"
        )
        .forEach(function (avatar) {

            avatar.innerHTML = `
                <img
                    src="${imageUrl}"
                    alt="Admin"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:50%;
                    "
                >
            `;
        });
}


if (profileImageInput) {

    profileImageInput.addEventListener(
        "change",
        async function () {

            const file =
                this.files?.[0];

            if (!file) {
                return;
            }

            // File type check
            if (
                file.type !== "image/jpeg" &&
                file.type !== "image/png"
            ) {

                alert(
                    "শুধু JPG বা PNG ছবি ব্যবহার করুন।"
                );

                this.value = "";
                return;
            }

            // Maximum 2MB
            if (
                file.size >
                2 * 1024 * 1024
            ) {

                alert(
                    "ছবির size 2MB-এর কম হতে হবে।"
                );

                this.value = "";
                return;
            }

            const token =
                localStorage.getItem(
                    "access_token"
                );

            if (!token) {

                alert(
                    "Login session পাওয়া যায়নি।"
                );

                window.location.replace(
                    "login.html"
                );

                return;
            }

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            try {

                showToast(
                    "Profile photo upload হচ্ছে..."
                );

                const response =
                    await fetch(
                        API_BASE_URL +
                        "/api/auth/profile-photo",
                        {
                            method: "POST",

                            headers: {
                                "Authorization":
                                    "Bearer " + token
                            },

                            body: formData
                        }
                    );

                const data =
                    await response.json();

                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.detail ||
                        data.message ||
                        "Profile photo upload failed."
                    );
                }

                // Backend থেকে পাওয়া path
                const imageUrl =
                    API_BASE_URL +
                    data.profile_image;

                // Browser UI update
                setProfileImage(imageUrl);

                // শুধু URL/path রাখা হবে,
                // পুরো image data নয়
                localStorage.setItem(
                    "admin_profile_image",
                    data.profile_image
                );

                showToast(
                    "Profile photo successfully updated"
                );

            } catch (error) {

                console.error(
                    "Profile photo upload error:",
                    error
                );

                alert(
                    error.message ||
                    "Profile photo upload করা যায়নি।"
                );

            } finally {

                this.value = "";
            }
        }
    );
}
// ==========================================
// NMS SETTINGS - COMPLETE JAVASCRIPT
// ==========================================


// ------------------------------------------
// DEFAULT SETTINGS
// ------------------------------------------

const defaultSettings = {
    theme: "dark",
    language: "english",
    timeFormat: "24",

    dashboardRefresh: "30",

    networkMonitoring: true,
    networkInterval: "10",

    cameraMonitoring: true,
    cameraInterval: "30",

    alert: true,
    soundNotification: true,
};


// ------------------------------------------
// GET ELEMENT
// ------------------------------------------

function get(id) {
    return document.getElementById(id);
}


// ------------------------------------------
// LOAD SETTINGS
// ------------------------------------------

function loadSettings() {

    let saved = localStorage.getItem("nmsSettings");

    let settings;

    if (saved) {
        try {
            settings = JSON.parse(saved);
        } catch (error) {
            settings = { ...defaultSettings };
        }
    } else {
        settings = { ...defaultSettings };
    }


    // GENERAL
    if (!get("theme")) return;
    get("theme").value = settings.theme || defaultSettings.theme;
    get("language").value = settings.language || defaultSettings.language;
    if(get("timeFormat")) get("timeFormat").value = settings.timeFormat || defaultSettings.timeFormat;
    


    // NETWORK
    get("networkMonitoring").checked =
        settings.networkMonitoring ?? defaultSettings.networkMonitoring;

    get("networkInterval").value =
        settings.networkInterval || defaultSettings.networkInterval;


    // CAMERA
    get("cameraMonitoring").checked =
        settings.cameraMonitoring ?? defaultSettings.cameraMonitoring;

    get("cameraInterval").value =
        settings.cameraInterval || defaultSettings.cameraInterval;

    get("cameraRetryInterval").value =
        settings.cameraRetryInterval || 120;

    // ALERT
    get("alert").checked =
        settings.alert ?? defaultSettings.alert;


    // NOTIFICATION

    get("soundNotification").checked =
        settings.soundNotification ?? defaultSettings.soundNotification;


    // BACKUP


    // RETENTION


    // APPLY THEME
    applyTheme(settings.theme);


    // APPLY LANGUAGE
    applyLanguage(settings.language);


    console.log("NMS Settings Loaded");
}



// ------------------------------------------
// SAVE SETTINGS
// ------------------------------------------

function persistCurrentSettings(showMsg = false) {
    saveSettings();
}

async function saveSettings() {

    const settings = {

        theme: get("theme").value,

        language: get("language").value,

        timeFormat: get("timeFormat") ? get("timeFormat").value : "24",

        networkMonitoring:
            get("networkMonitoring").checked,

        networkInterval:
            get("networkInterval").value,


        cameraMonitoring:
            get("cameraMonitoring").checked,

        cameraInterval:
            get("cameraInterval").value,

        cameraRetryInterval:
            parseInt(
                document.getElementById("cameraRetryInterval").value
            ),
        alert:
            get("alert").checked,

        soundNotification:
            get("soundNotification").checked,
    };


    // SAVE TO LOCAL STORAGE
    localStorage.setItem(
        "nmsSettings",
        JSON.stringify(settings)
    );


    // ==========================================
    // SYNC CCTV SETTINGS WITH BACKEND
    // ==========================================

    const token = localStorage.getItem("access_token");

    if (!token) {
        showMessage("⚠ Login session পাওয়া যায়নি");
        return;
    }

    try {

        const cameraResponse = await fetch(
            window.APP_CONFIG.API_BASE_URL + "/api/settings/camera",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    camera_monitoring: settings.cameraMonitoring,
                    camera_interval: Number(settings.cameraInterval),
                    camera_retry_interval: Number(settings.cameraRetryInterval)
                })
            }
        );

        const cameraData = await cameraResponse.json();

        if (!cameraResponse.ok || !cameraData.success) {
            throw new Error(
                cameraData.detail ||
                cameraData.message ||
                "CCTV settings sync failed."
            );
        }

        console.log(
            "✅ CCTV settings synced:",
            cameraData
        );

    } catch (error) {

        console.error(
            "CCTV settings sync error:",
            error
        );

        showMessage(
            "⚠ CCTV setting backend-e save hoyni"
        );

        return;
    }

    // APPLY SETTINGS
    applyTheme(settings.theme);

    applyLanguage(settings.language);
    updateClock();

    // RESTART FRONTEND TIMERS
    if (typeof startAutoMonitor === 'function') startAutoMonitor();
    if (typeof startBackgroundPinging === 'function') startBackgroundPinging();

    // SHOW MESSAGE
    syncNetworkSettingsToBackend(false);
    syncGlobalSettingsToBackend(settings);
    showMessage("✓ Settings saved successfully");


    console.log("Settings Saved:", settings);
}



// ------------------------------------------
// RESET SETTINGS
// ------------------------------------------

function resetSettings() {
    const confirmReset = confirm("Are you sure you want to reset all settings?");
    if (!confirmReset) return;

    // Apply defaults to UI
    if(get("theme")) get("theme").value = defaultSettings.theme;
    if(get("language")) get("language").value = defaultSettings.language;
    if(get("timeFormat")) get("timeFormat").value = defaultSettings.timeFormat;
    if(get("networkMonitoring")) get("networkMonitoring").checked = defaultSettings.networkMonitoring;
    if(get("networkInterval")) get("networkInterval").value = defaultSettings.networkInterval;
    if(get("cameraMonitoring")) get("cameraMonitoring").checked = defaultSettings.cameraMonitoring;
    if(get("cameraInterval")) get("cameraInterval").value = defaultSettings.cameraInterval;
    if(get("cameraRetryInterval")) get("cameraRetryInterval").value = defaultSettings.cameraRetryInterval;
    if(get("alert")) get("alert").checked = defaultSettings.alert;
    if(get("soundNotification")) get("soundNotification").checked = defaultSettings.soundNotification;

    saveSettings();
    showMessage("Settings reset to defaults and saved to backend");
}




// ------------------------------------------
// THEME
// ------------------------------------------

function applyTheme(theme) {

    if (theme === "light") {

        document.body.classList.add(
            "light-theme"
        );

    } else {

        document.body.classList.remove(
            "light-theme"
        );

    }
}



// ------------------------------------------
// LANGUAGE
// ------------------------------------------

function applyLanguage(language) {
    // We use Google Translate to handle entire site translation seamlessly.
    // Set the translation cookie.
    const currentCookie = document.cookie.split('; ').find(row => row.startsWith('googtrans='));
    const targetCookie = 'googtrans=/en/' + language;
    
    if (language === 'en') {
        if (currentCookie) {
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=." + document.domain + "; path=/;";
            window.location.reload();
        }
    } else {
        if (currentCookie !== targetCookie) {
            document.cookie = targetCookie + "; path=/;";
            document.cookie = targetCookie + "; domain=." + document.domain + "; path=/;";
            window.location.reload();
        }
    }
}

// ==========================================


// ------------------------------------------
// SOUND
// ------------------------------------------

function playSound() {

    const soundEnabled =
        get("soundNotification").checked;


    if (!soundEnabled) {
        return;
    }


    // ছোট notification beep
    const audioContext =
        new (
            window.AudioContext ||
            window.webkitAudioContext
        )();


    const oscillator =
        audioContext.createOscillator();


    const gainNode =
        audioContext.createGain();


    oscillator.connect(gainNode);

    gainNode.connect(
        audioContext.destination
    );


    oscillator.frequency.value = 800;

    oscillator.type = "sine";


    gainNode.gain.setValueAtTime(
        0.2,
        audioContext.currentTime
    );


    oscillator.start();


    oscillator.stop(
        audioContext.currentTime + 0.15
    );
}



// ------------------------------------------
// TEST SOUND
// ------------------------------------------

function testSound() {

    if (get("soundNotification").checked) {

        playSound();

        showMessage(
            "🔊 Sound notification is ON"
        );

    } else {

        showMessage(
            "🔇 Sound notification is OFF"
        );

    }
}



// ------------------------------------------
// MESSAGE
// ------------------------------------------

function showMessage(message) {
    if (typeof toast === 'function') {
        toast(message.replace(/[""]/g, ''));
    } else {
        console.log(message);
    }
}



// ------------------------------------------
// DASHBOARD BUTTON
// ------------------------------------------

function goDashboard() {
    openPage('dashboard');
}



// ------------------------------------------
// TOGGLE STATUS
// ------------------------------------------

function toggleStatus(id, name) {

    const checkbox = get(id);

    if (!checkbox) {
        return;
    }


    console.log(name + " : " + (checkbox.checked ? "ON" : "OFF"));
    persistCurrentSettings(true);
}



// ------------------------------------------
// NETWORK MONITORING
// ------------------------------------------

get("networkMonitoring")
    ?.addEventListener("change", function () {

        toggleStatus(
            "networkMonitoring",
            "Network Monitoring"
        );

    });



// ------------------------------------------
// CAMERA MONITORING
// ------------------------------------------

get("cameraMonitoring")
    ?.addEventListener("change", function () {

        toggleStatus(
            "cameraMonitoring",
            "Camera Monitoring"
        );

    });



// ------------------------------------------
// ALERT
// ------------------------------------------

get("alert")
    ?.addEventListener("change", function () {

        toggleStatus(
            "alert",
            "Alert"
        );

    });



// ------------------------------------------




// ------------------------------------------




// ------------------------------------------




// ------------------------------------------
// SOUND NOTIFICATION
// ------------------------------------------

get("soundNotification")
    ?.addEventListener("change", function () {

        toggleStatus(
            "soundNotification",
            "Sound Notification"
        );


        if (this.checked) {

            showMessage(
                "🔊 Sound notification enabled"
            );

        } else {

            showMessage(
                "🔇 Sound notification disabled"
            );

        }

    });



// ------------------------------------------
// AUTOMATIC BACKUP
// ------------------------------------------





// ------------------------------------------
// AUTO CLEANUP
// ------------------------------------------





// ------------------------------------------
// THEME CHANGE
// ------------------------------------------

get("theme")
    ?.addEventListener("change", function () {

        applyTheme(this.value);

        persistCurrentSettings();
        showMessage("Theme changed to " + this.value);

    });


// ==========================================
// SYNC NETWORK SETTINGS WITH BACKEND
// ==========================================

async function syncNetworkSettingsToBackend(
    showSuccess = true
) {

    const token =
        localStorage.getItem("access_token");

    if (!token) {
        console.warn(
            "Network settings sync skipped: login token missing."
        );
        return;
    }

    const networkMonitoring =
        get("networkMonitoring")?.checked ?? true;

    const networkInterval =
        Number(
            get("networkInterval")?.value || 60
        );

    try {

        const response =
            await fetch(
                window.APP_CONFIG.API_BASE_URL + "/api/settings/network",
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " + token
                    },

                    body: JSON.stringify({

                        enabled:
                            networkMonitoring,

                        interval:
                            networkInterval
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.detail ||
                data.message ||
                "Network settings update failed."
            );
        }

        console.log(
            "✅ Network settings synced with backend:",
            data
        );

        if (showSuccess) {

            showMessage(
                "✓ Network monitoring settings updated"
            );
        }

    } catch (error) {

        console.error(
            "Network settings sync error:",
            error
        );

        showMessage(
            "⚠ Network settings backend update failed"
        );
    }
}

async function syncGlobalSettingsToBackend(settings) {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
        const payload = {
            alert: !!settings.alert,
            soundNotification: !!settings.soundNotification,
        };

        const response = await fetch(window.APP_CONFIG.API_BASE_URL + "/api/settings/global", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Global settings sync failed:", response.status);
        } else {
            console.log("✅ Global settings synced to backend.");
        }
    } catch (error) {
        console.error("Global settings sync error:", error);
    }
}

// ------------------------------------------





// ------------------------------------------
// NETWORK INTERVAL
// ------------------------------------------

get("networkInterval")
    ?.addEventListener(
        "change",
        async function () {

            console.log(
                "Network Check Interval:",
                this.value + " seconds"
            );

            persistCurrentSettings();

            await syncNetworkSettingsToBackend(
                true
            );
        }
    );



// ------------------------------------------
// CAMERA INTERVAL
// ------------------------------------------

get("cameraInterval")
    ?.addEventListener("change", function () {

        console.log(
            "Camera Check Interval:",
            this.value + " seconds"
        );

        persistCurrentSettings();

    });



// ------------------------------------------
// LANGUAGE CHANGE
// ------------------------------------------

get("language")
    ?.addEventListener("change", function () {

        applyLanguage(this.value);

        persistCurrentSettings();
        showMessage("Language changed to " + this.value);

    });

// ------------------------------------------
// TIME FORMAT CHANGE
// ------------------------------------------

get("timeFormat")
    ?.addEventListener("change", function () {
        persistCurrentSettings();
        updateClock();
        showMessage("Time format changed");
    });

// ------------------------------------------
// SAVE BUTTON KEYBOARD SHORTCUT
// CTRL + S
// ------------------------------------------

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "s"
        ) {

            event.preventDefault();

            saveSettings();

        }

    }
);



// ------------------------------------------
// PAGE LOAD
// ------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadSettings();

        console.log(
            "NMS Settings Page Ready"
        );

    }
);


// Expose settings controls reliably for HTML onclick handlers.
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.goDashboard = goDashboard;
/* =========================================================
   DESKTOP MANAGEMENT
========================================================= */
let desktopData = [
    {
        id: 'NM-DESK-001',
        department: 'Admin',
        ip: '192.168.1.21',
        os: 'Windows 11',
        cpu: '18%',
        ram: '54%',
        status: 'Online',
        location: ''
    },
    {
        id: 'NM-DESK-002',
        department: 'Accounts',
        ip: '192.168.1.22',
        os: 'Windows 11',
        cpu: '42%',
        ram: '71%',
        status: 'Online',
        location: ''
    },
    {
        id: 'NM-DESK-003',
        department: 'HR',
        ip: '192.168.1.23',
        os: 'Windows 10',
        cpu: '—',
        ram: '—',
        status: 'Offline',
        location: ''
    }
];

// LOAD SAVED DESKTOPS
try {

    const savedDesktops =
        localStorage.getItem('nmsDesktopData');

    if (savedDesktops) {

        const parsedDesktops =
            JSON.parse(savedDesktops);

        if (Array.isArray(parsedDesktops)) {

            desktopData = parsedDesktops;

        }
    }

} catch (error) {

    console.error(
        'Desktop data load error:',
        error
    );
}
function openDesktopModal() { document.getElementById('desktopModal')?.classList.add('show'); }
function closeDesktopModal() { document.getElementById('desktopModal')?.classList.remove('show'); }
function closeDesktopView() { document.getElementById('desktopViewModal')?.classList.remove('show'); }

function viewDesktop(desktopId) {

    const device = desktopData.find(function (d) {
        return String(d.id) === String(desktopId);
    });

    const box = document.getElementById(
        'desktopDetails'
    );

    if (!device || !box) {
        console.warn(
            'Desktop not found:',
            desktopId
        );
        return;
    }

    const monitoring =
        Number(device.monitoring_enabled) === 1
            ? 'Enabled'
            : 'Disabled';

    const lastCheck =
        device.last_check
            ? device.last_check
            : 'Never';

    const latency =
        device.last_latency_ms !== null &&
            device.last_latency_ms !== undefined
            ? `${device.last_latency_ms} ms`
            : '—';

    const uptime =
        device.uptime_percent !== null &&
            device.uptime_percent !== undefined
            ? `${device.uptime_percent}%`
            : '0%';

    box.innerHTML = `

        <div class="desktop-detail-grid">

            <div>
                <span>Desktop ID</span>
                <strong>${device.id || '—'}</strong>
            </div>

            <div>
                <span>Department</span>
                <strong>${device.department || '—'}</strong>
            </div>

            <div>
                <span>Location</span>
                <strong>
                    ${device.location || 'Not Assigned'}
                </strong>
            </div>

            <div>
                <span>IP Address</span>
                <strong>${device.ip || '—'}</strong>
            </div>

            <div>
                <span>Operating System</span>
                <strong>${device.os || '—'}</strong>
            </div>

            <div>
                <span>CPU Usage</span>
                <strong>${device.cpu || '0%'}</strong>
            </div>

            <div>
                <span>RAM Usage</span>
                <strong>${device.ram || '0%'}</strong>
            </div>

            <div>
                <span>Status</span>
                <strong>${device.status || 'Unknown'}</strong>
            </div>

            <div>
                <span>Monitoring</span>
                <strong>${monitoring}</strong>
            </div>

            <div>
                <span>Monitoring Interval</span>
                <strong>
                    ${device.monitoring_interval || 30} sec
                </strong>
            </div>

            <div>
                <span>Last Check</span>
                <strong>${lastCheck}</strong>
            </div>

            <div>
                <span>Last Latency</span>
                <strong>${latency}</strong>
            </div>

            <div>
                <span>Total Checks</span>
                <strong>
                    ${device.total_checks ?? 0}
                </strong>
            </div>

            <div>
                <span>Successful Checks</span>
                <strong>
                    ${device.successful_checks ?? 0}
                </strong>
            </div>

            <div>
                <span>Uptime</span>
                <strong>${uptime}</strong>
            </div>

        </div>

    `;

    document
        .getElementById('desktopViewModal')
        ?.classList.add('show');

    console.log(
        '✅ Viewing backend desktop:',
        device
    );
}

async function addDesktopFromForm(event) {

    event.preventDefault();

    const values = {
        id: document.getElementById('desktopId')?.value.trim(),
        department: document.getElementById('desktopDepartment')?.value.trim(),
        location: document.getElementById('desktopLocation')?.value.trim(),
        ip: document.getElementById('desktopIP')?.value.trim(),
        os: document.getElementById('desktopOS')?.value || 'Windows 11',
        cpu: (document.getElementById('desktopCPU')?.value || '0') + '%',
        ram: (document.getElementById('desktopRAM')?.value || '0') + '%',
        status: document.getElementById('desktopStatus')?.value || 'Online'
    };

    // ==========================================
    // REQUIRED FIELD CHECK
    // ==========================================

    if (
        !values.id ||
        !values.department ||
        !values.location ||
        !values.ip
    ) {
        alert('Please fill all required desktop fields.');
        return;
    }

    // ==========================================
    // FRONTEND DUPLICATE CHECK
    // ==========================================

    if (
        desktopData.some(function (d) {
            return String(d.id).toLowerCase() ===
                String(values.id).toLowerCase();
        })
    ) {
        alert('Desktop ID already exists.');
        return;
    }

    // ==========================================
    // AUTH TOKEN
    // ==========================================

    const token =
        typeof getAuthToken === 'function'
            ? getAuthToken()
            : localStorage.getItem('access_token');

    if (!token) {
        alert('Please login again.');
        return;
    }

    // ==========================================
    // CONVERT CPU / RAM
    // ==========================================

    const cpuUsage =
        Number.parseFloat(values.cpu.replace('%', '')) || 0;

    const ramUsage =
        Number.parseFloat(values.ram.replace('%', '')) || 0;

    // ==========================================
    // BACKEND PAYLOAD
    // ==========================================

    const payload = {
        desktop_code: values.id,
        department: values.department,
        location: values.location,
        ip_address: values.ip,
        operating_system: values.os,
        cpu_usage: cpuUsage,
        ram_usage: ramUsage,
        status: values.status,
        monitoring_enabled: false,
        monitoring_interval: 30
    };

    try {

        // ==========================================
        // SEND DESKTOP TO MYSQL BACKEND
        // ==========================================

        const response = await fetch(
            `${NMS_API_BASE}/api/desktops`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },

                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        console.log(
            'Desktop POST response:',
            data
        );

        // ==========================================
        // BACKEND ERROR
        // ==========================================

        if (!response.ok || !data.success) {

            const errorMessage =
                data.detail ||
                data.message ||
                'Failed to add desktop.';

            alert(errorMessage);
            return;
        }

        // ==========================================
        // GET CREATED DESKTOP FROM BACKEND
        // ==========================================

        const createdDesktop =
            data.desktop || data.desktops;

        if (!createdDesktop) {

            alert(
                'Desktop was saved, but backend response is invalid.'
            );

            return;
        }

        // ==========================================
        // CONVERT BACKEND DATA TO FRONTEND FORMAT
        // ==========================================

        const newDesktop = {

            backendId:
                Number(createdDesktop.id),

            id:
                createdDesktop.desktop_code || values.id,

            department:
                createdDesktop.department || values.department,

            location:
                createdDesktop.location || values.location,

            ip:
                createdDesktop.ip_address || values.ip,

            os:
                createdDesktop.operating_system || values.os,

            cpu:
                `${Number(createdDesktop.cpu_usage ?? cpuUsage)}%`,

            ram:
                `${Number(createdDesktop.ram_usage ?? ramUsage)}%`,

            status:
                createdDesktop.status || values.status,

            monitoring_enabled:
                createdDesktop.monitoring_enabled,

            monitoring_interval:
                createdDesktop.monitoring_interval,

            last_check:
                createdDesktop.last_check,

            last_latency_ms:
                createdDesktop.last_latency_ms,

            total_checks:
                createdDesktop.total_checks,

            successful_checks:
                createdDesktop.successful_checks,

            uptime_percent:
                createdDesktop.uptime_percent
        };

        // ==========================================
        // ADD TO FRONTEND TABLE
        // ==========================================

        desktopData.push(newDesktop);

        // ==========================================
        // LOCAL CACHE
        // ==========================================

        localStorage.setItem(
            'nmsDesktopData',
            JSON.stringify(desktopData)
        );

        // ==========================================
        // REFRESH TABLE
        // ==========================================

        refreshDesktopData();

        // ==========================================
        // RESET FORM
        // ==========================================

        document
            .getElementById('desktopForm')
            ?.reset();

        // ==========================================
        // CLOSE MODAL
        // ==========================================

        closeDesktopModal();

        // ==========================================
        // SUCCESS MESSAGE
        // ==========================================

        if (typeof showToast === 'function') {

            showToast(
                'Desktop added successfully'
            );

        } else {

            alert(
                'Desktop added successfully'
            );
        }

        console.log(
            '✅ Desktop saved to MySQL:',
            newDesktop
        );

    } catch (error) {

        console.error(
            '❌ Desktop add error:',
            error
        );

        alert(
            'Could not connect to the backend. Please check that the FastAPI server is running.'
        );
    }
}
function refreshDesktopSummary() {
    const total = desktopData.length;
    const online = desktopData.filter(d => String(d.status).toLowerCase() === 'online').length;
    const offline = desktopData.filter(d => String(d.status).toLowerCase() === 'offline').length;
    const issues = desktopData.filter(d => {
        const cpu = parseInt(d.cpu, 10);
        const ram = parseInt(d.ram, 10);
        return String(d.status).toLowerCase() === 'offline' || cpu >= 80 || ram >= 80;
    }).length;

    const cards = document.querySelectorAll('#desktops .stats-grid .stat-card strong');
    if (cards[0]) cards[0].textContent = total;
    if (cards[1]) cards[1].textContent = online;
    if (cards[2]) cards[2].textContent = offline;
    if (cards[3]) cards[3].textContent = issues;
}

function renderDesktopRows(list = desktopData) {
    const tbody = document.querySelector('#desktops table tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(d => `
        <tr>
            <td><strong>${d.id}</strong></td>
            <td>${d.department}</td>
            <td>${d.ip}</td>
            <td>${d.os}</td>
            <td>${d.cpu}</td>
            <td>${d.ram}</td>
            <td><span class="status-badge ${String(d.status).toLowerCase()}">● ${d.status}</span></td>
           <td>
    <div style="
        display:flex;
        gap:8px;
        flex-wrap:wrap;
    ">

        <button
            type="button"
            class="table-action"
            onclick="viewDesktop('${String(d.id).replace(/'/g, "\\'")}')"
        >
            View
        </button>

        <button
            type="button"
            class="device-delete-btn"
            onclick="deleteDesktopFromFrontend(
                ${Number(d.backendId || d.id)},
                '${String(d.id).replace(/'/g, "\\'")}'
            )"
        >
            DELETE
        </button>

    </div>
</td>
        </tr>
    `).join('');
    refreshDesktopSummary();
}

// ==========================================================
// DESKTOP DELETE - BACKEND
// ==========================================================

async function deleteDesktopFromFrontend(
    desktopId,
    desktopCode
) {

    const token =
        localStorage.getItem("access_token");

    if (!token) {
        toast("Login required");
        return;
    }

    if (
        !confirm(
            `Are you sure you want to permanently delete desktop "${desktopCode}"?`
        )
    ) {
        return;
    }

    try {

        toast("Deleting desktop...");

        const response = await fetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/desktops/${desktopId}`,
            {
                method: "DELETE",

                headers: {
                    "Authorization":
                        "Bearer " + token
                }
            }
        );

        const raw =
            await response.text();

        let data = null;

        try {
            data = raw
                ? JSON.parse(raw)
                : null;
        } catch (_) {
            data = null;
        }

        if (
            !response.ok ||
            !data?.success
        ) {
            throw new Error(
                data?.detail ||
                data?.message ||
                raw ||
                "Failed to delete desktop"
            );
        }

        // Remove deleted desktop from frontend data
        desktopData =
            desktopData.filter(function (desktop) {

                return String(desktop.backendId || desktop.id)
                    !== String(desktopId);

            });

        // Update local browser data
        localStorage.setItem(
            "nmsDesktopData",
            JSON.stringify(desktopData)
        );

        // Refresh desktop table
        renderDesktopRows(desktopData);

        toast(
            "Desktop deleted successfully"
        );

        console.log(
            "✅ Desktop deleted:",
            desktopCode
        );

    } catch (error) {

        console.error(
            "Delete Desktop Error:",
            error
        );

        toast(
            "Delete error: " +
            error.message
        );
    }
}

window.deleteDesktopFromFrontend =
    deleteDesktopFromFrontend;


document.addEventListener('DOMContentLoaded', function () {
    // Hide modal by default even if another stylesheet changes .show.
    document.getElementById('desktopModal')?.classList.remove('show');
    document.getElementById('desktopViewModal')?.classList.remove('show');

    document.getElementById('addDesktopBtn')?.addEventListener('click', openDesktopModal);
    document.getElementById('closeDesktopModal')?.addEventListener('click', closeDesktopModal);
    document.getElementById('cancelDesktopBtn')?.addEventListener('click', closeDesktopModal);
    document.getElementById('desktopForm')?.addEventListener(
        'submit',
        addDesktopFromForm
    );
    document.getElementById('desktopRefreshBtn')?.addEventListener(
        'click',
        refreshDesktopPage
    );
    document.querySelectorAll('#desktopModal,#desktopViewModal').forEach(modal => {
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
    });

    const search = document.querySelector('#desktops .table-search');
    search?.addEventListener('input', function () {
        const q = this.value.trim().toLowerCase();
        const filtered = desktopData.filter(d =>
            [d.id, d.department, d.ip, d.os, d.cpu, d.ram, d.status].join(' ').toLowerCase().includes(q)
        );
        renderDesktopRows(filtered);
    });

    refreshDesktopData();
});

// ==========================================
// DESKTOP - REAL PAGE REFRESH
// ==========================================

function refreshDesktopPage() {

    const button =
        document.getElementById("desktopRefreshBtn");

    if (!button) {
        return;
    }

    button.disabled = true;

    button.innerHTML =
        "⟳ Refreshing...";

    // Same behaviour as Devices/CCTV Refresh
    window.location.reload();
}

// ==========================================
// DESKTOP REFRESH - GLOBAL FUNCTION
// ==========================================

async function refreshDesktopData() {

    /*
     * Backend monitoring state আসা পর্যন্ত
     * desktop table দেখাবো না.
     */
    renderDesktopRows([]);

    const token =
        typeof getAuthToken === 'function'
            ? getAuthToken()
            : localStorage.getItem('access_token');

    if (!token) {
        console.warn('⚠️ No login token found.');
        return;
    }

    try {

        const response = await fetch(
            `${NMS_API_BASE}/api/desktops`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.detail ||
                data.message ||
                'Failed to load desktops.'
            );
        }

        const backendDesktops =
            Array.isArray(data.desktops)
                ? data.desktops
                : [];

        desktopData =
            backendDesktops.map(function (desktop) {

                return {
                    backendId: Number(desktop.id),

                    id:
                        desktop.desktop_code || '',

                    department:
                        desktop.department || '',

                    location:
                        desktop.location || '',

                    ip:
                        desktop.ip_address || '',

                    os:
                        desktop.operating_system || '',

                    cpu:
                        `${Number(desktop.cpu_usage ?? 0)}%`,

                    ram:
                        `${Number(desktop.ram_usage ?? 0)}%`,

                    status:
                        desktop.status || 'Unknown',

                    monitoring_enabled:
                        desktop.monitoring_enabled,

                    monitoring_interval:
                        desktop.monitoring_interval,

                    last_check:
                        desktop.last_check,

                    last_latency_ms:
                        desktop.last_latency_ms,

                    total_checks:
                        desktop.total_checks,

                    successful_checks:
                        desktop.successful_checks,

                    uptime_percent:
                        desktop.uptime_percent
                };

            });

        /*
         * Browser cache update.
         */
        localStorage.setItem(
            'nmsDesktopData',
            JSON.stringify(desktopData)
        );

        /*
         * Filter display based on monitoring state
         */
        if (!desktopMonitoringEnabled) {
            renderDesktopRows([]);
        } else {
            const selectedLocation = String(selectedDesktopMonitoringLocation || '').trim().toLowerCase();
            const filteredDesktops = desktopData.filter(function (desktop) {
                return String(desktop.location || '').trim().toLowerCase() === selectedLocation;
            });
            renderDesktopRows(filteredDesktops);
        }

        refreshDesktopSummary();

        console.log(
            `✅ ${desktopData.length} desktop(s) loaded from MySQL.`
        );

    } catch (error) {

        console.error(
            '❌ Desktop GET error:',
            error
        );

        /*
         * Error হলেও table empty থাকবে.
         */
        renderDesktopRows([]);

    }
}

/* =========================================================
   DEVICES + CCTV FRONTEND MANAGEMENT
   Safe frontend layer; ready to replace with Flask APIs later.
========================================================= */

function openNmsModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeNmsModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function validateIpAddress(ip) {
    const parts = String(ip).trim().split('.');
    return parts.length === 4 && parts.every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function bindDeviceManagement() {
    const addBtn = document.getElementById('addDeviceBtn');
    const form = document.getElementById('deviceForm');
    const modal = document.getElementById('deviceModal');
    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = 'true';
        addBtn.addEventListener('click', () => {
            form?.reset();
            const uptime = document.getElementById('newDeviceUptime');
            if (uptime) uptime.value = '100%';
            openNmsModal('deviceModal');
        });
    }
    document.getElementById('closeDeviceModal')?.addEventListener('click', () => closeNmsModal('deviceModal'));
    document.getElementById('cancelDeviceBtn')?.addEventListener('click', () => closeNmsModal('deviceModal'));
    modal?.addEventListener('click', e => { if (e.target === modal) closeNmsModal('deviceModal'); });
}
// ==========================================
// DEVICES - REAL PAGE REFRESH
// ==========================================

function refreshDevicesFromBackend() {

    const button =
        document.getElementById(
            "refreshDevicesBtn"
        );

    if (!button) {
        return;
    }

    button.disabled = true;

    button.innerHTML =
        "⟳ Refreshing...";

    // EXACTLY like CCTV:
    // Reload the complete Devices page.
    window.location.reload();
}
// ==========================================
// CREATE REFRESH BUTTON
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const actions =
            document.querySelector(
                "#devices .nms-page-actions"
            );

        if (!actions) {
            return;
        }


        if (
            document.getElementById(
                "refreshDevicesBtn"
            )
        ) {
            return;
        }


        const refreshButton =
            document.createElement("button");


        refreshButton.type = "button";

        refreshButton.id =
            "refreshDevicesBtn";

        refreshButton.className =
            "btn secondary";

        refreshButton.innerHTML =
            "🔄 Refresh";


        refreshButton.addEventListener(
            "click",
            refreshDevicesFromBackend
        );



        // Add Device-এর আগে বসবে
        const addButton =
            document.getElementById(
                "addDeviceBtn"
            );


        if (addButton) {

            actions.insertBefore(
                refreshButton,
                addButton
            );

        } else {

            actions.appendChild(
                refreshButton
            );
        }

    }
);


function getStoredCameras() {
    try {
        const saved = JSON.parse(localStorage.getItem('nmsCustomCameras') || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.warn('Custom CCTV data could not be loaded.', error);
        return [];
    }
}

function saveStoredCameras(list) {
    localStorage.setItem('nmsCustomCameras', JSON.stringify(list));
}

function createCameraCard(camera) {
    const offline = String(camera.status).toUpperCase() === 'OFFLINE';
    const id = String(camera.id).replace(/"/g, '&quot;');
    const name = String(camera.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const location = String(camera.location || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="camera ${offline ? 'offline' : ''}" data-custom-camera-id="${id}">
        <div class="camera-feed">${offline ? '▧' : '◉'}</div>
        <div class="camera-info"><span>${id} · ${name}</span><span>${offline ? 'OFFLINE' : 'LIVE'}</span></div>
        <div class="custom-camera-meta">${location}</div>
    </div>`;
}

// =========================================================
// CCTV - BACKEND / MYSQL MANAGEMENT
// =========================================================

let backendCameras = [];


// ---------------------------------------------------------
// LOAD CAMERAS FROM BACKEND
// ---------------------------------------------------------

async function loadCamerasFromBackend() {

    const token =
        localStorage.getItem("access_token");

    if (!token) {
        window.location.replace("login.html");
        return;
    }

    try {

        const response = await fetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/cameras?_t=${Date.now()}`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        "Bearer " + token
                }
            }
        );

        if (!response.ok) {

            throw new Error(
                "Camera API request failed."
            );
        }

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message ||
                "Camera loading failed."
            );
        }

        backendCameras =
            Array.isArray(data.cameras)
                ? data.cameras
                : [];

        renderBackendCameras(
            backendCameras
        );

        console.log(
            "✅ MySQL cameras loaded:",
            backendCameras.length
        );

    } catch (error) {

        console.error(
            "CCTV backend error:",
            error
        );

        const grid =
            document.getElementById(
                "cameraGrid"
            );

        if (grid) {

            grid.innerHTML = `
                <div style="
                    grid-column:1/-1;
                    text-align:center;
                    padding:40px;
                    color:#ff6472;
                ">
                    CCTV data load করা যায়নি।
                </div>
            `;
        }
    }
}


// ==========================================================
// CCTV FRONTEND AUTO REFRESH
// DISABLED
//
// CCTV page will NOT auto-refresh.
// The Refresh button will be used for manual page refresh.
// Automatic camera ping/check is handled separately.
// ==========================================================

let cctvFrontendRefreshTimer = null;

function startCCTVFrontendAutoRefresh() {

    if (cctvFrontendRefreshTimer) {

        clearInterval(
            cctvFrontendRefreshTimer
        );

        cctvFrontendRefreshTimer = null;
    }

    // Fetch once on init, no timer
    loadCamerasFromBackend();
    console.log("✅ CCTV frontend initial load complete. Auto-refresh DISABLED as per user request.");
}


// Do NOT automatically refresh the page/data here.
// ==========================================================
// CCTV DASHBOARD SUMMARY
// Uses REAL backend/MySQL camera status
// ==========================================================

function updateCameraDashboardStats(list = backendCameras) {

    if (!Array.isArray(list)) {
        list = [];
    }

    const total = list.length;

    let online = 0;
    let offline = 0;
    let unknown = 0;

    list.forEach(function (camera) {

        const status = String(
            camera.status || "Unknown"
        ).trim().toLowerCase();

        if (status === "online" || status === "live") {

            online++;

        } else if (status === "offline") {

            offline++;

        } else {

            unknown++;

        }

    });

    /*
       Issues = Offline + Unknown
       কারণ এগুলো administrator-er attention
       দরকার হতে পারে।
    */

    const issues = offline + unknown;

    // ------------------------------------------
    // UPDATE TOTAL
    // ------------------------------------------

    const totalElement =
        document.getElementById("cctvTotalCount");

    if (totalElement) {
        totalElement.textContent = total;
    }


    // ------------------------------------------
    // UPDATE ONLINE
    // ------------------------------------------

    const onlineElement =
        document.getElementById("cctvOnlineCount");

    if (onlineElement) {
        onlineElement.textContent = online;
    }


    // ------------------------------------------
    // UPDATE OFFLINE
    // ------------------------------------------

    const offlineElement =
        document.getElementById("cctvOfflineCount");

    if (offlineElement) {
        offlineElement.textContent = offline;
    }


    // ------------------------------------------
    // UPDATE ISSUES
    // ------------------------------------------

    const issueElement =
        document.getElementById("cctvIssueCount");

    if (issueElement) {
        issueElement.textContent = issues;
    }


    // ------------------------------------------
    // AVAILABILITY
    // ------------------------------------------

    const availability =
        total > 0
            ? (online / total) * 100
            : 0;

    const availabilityText =
        document.getElementById(
            "cctvAvailability"
        );

    if (availabilityText) {

        availabilityText.textContent =
            availability.toFixed(1) + "%";

    }


    const availabilityBar =
        document.getElementById(
            "cctvAvailabilityBar"
        );

    if (availabilityBar) {

        availabilityBar.style.width =
            availability.toFixed(1) + "%";

    }

    console.log(
        "📹 CCTV Dashboard:",
        {
            total: total,
            online: online,
            offline: offline,
            unknown: unknown,
            issues: issues,
            availability:
                availability.toFixed(1) + "%"
        }
    );
}


// ==========================================================
// CCTV IP SEARCH - REAL BACKEND CAMERA DATA
// ==========================================================

function filterCamerasByIp() {

    const searchInput =
        document.getElementById("cameraIpSearch");

    const grid =
        document.getElementById("cameraGrid");

    if (!searchInput || !grid) {
        return;
    }

    const query =
        searchInput.value
            .trim()
            .toLowerCase();

    const cameraCards =
        grid.querySelectorAll(
            ".camera[data-camera-id]"
        );

    let matched = 0;

    cameraCards.forEach(function (card) {

        const cameraId =
            String(
                card.getAttribute("data-camera-id")
            );

        const camera =
            backendCameras.find(function (item) {

                return String(item.id) === cameraId;

            });

        if (!camera) {

            card.style.display = "none";

            return;
        }

        const ip =
            String(
                camera.ip_address || ""
            )
                .trim()
                .toLowerCase();

        /*
         * Search only by IP address
         */

        if (
            query === "" ||
            ip.includes(query)
        ) {

            card.style.display = "";

            matched++;

        } else {

            card.style.display = "none";

        }

    });


    // Remove previous "not found" message

    const oldMessage =
        document.getElementById(
            "cameraSearchEmpty"
        );

    if (oldMessage) {
        oldMessage.remove();
    }


    // If search text exists but no camera matched

    if (
        query !== "" &&
        matched === 0
    ) {

        const emptyMessage =
            document.createElement("div");

        emptyMessage.id =
            "cameraSearchEmpty";

        emptyMessage.className =
            "cctv-search-empty";

        emptyMessage.innerHTML = `
            <strong>No camera found</strong>
            No CCTV camera found with IP:
            <b>${query}</b>
        `;

        grid.appendChild(
            emptyMessage
        );
    }
}


// ==========================================================
// CLEAR CCTV IP SEARCH
// ==========================================================

function clearCameraSearch() {

    const searchInput =
        document.getElementById(
            "cameraIpSearch"
        );

    if (searchInput) {

        searchInput.value = "";

    }

    filterCamerasByIp();
}


// ==========================================================
// CCTV SEARCH EVENT
// ==========================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const searchInput =
            document.getElementById(
                "cameraIpSearch"
            );

        const clearButton =
            document.getElementById(
                "clearCameraSearch"
            );


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterCamerasByIp
            );

        }


        if (clearButton) {

            clearButton.addEventListener(
                "click",
                clearCameraSearch
            );

        }

    }
);


// ---------------------------------------------------------
// RENDER CAMERAS
// ---------------------------------------------------------

function renderBackendCameras(
    list = backendCameras
) {
    const cBadge = document.getElementById('sidebarCamerasCount');
    if (cBadge && list === backendCameras) cBadge.textContent = backendCameras.length;

    const grid =
        document.getElementById(
            "cameraGrid"
        );

    if (!grid) {
        return;
    }

    // Update CCTV dashboard summary from real backend data
    updateCameraDashboardStats(list);

    if (!list.length) {

        grid.innerHTML = `
            <div style="
                grid-column:1/-1;
                text-align:center;
                padding:40px;
                color:#71859a;
            ">
                No CCTV cameras found in database.
            </div>
        `;

        return;
    }

    grid.innerHTML =
        list.map(function (camera) {

            const status =
                String(
                    camera.status ||
                    "Unknown"
                ).toLowerCase();

            const statusText =
                camera.status ||
                "Unknown";

            const latency =
                camera.last_latency_ms !== null &&
                    camera.last_latency_ms !== undefined
                    ? camera.last_latency_ms + " ms"
                    : "—";

            const uptime =
                camera.uptime_percent !== null &&
                    camera.uptime_percent !== undefined
                    ? camera.uptime_percent + "%"
                    : "0%";

            const lastCheck =
                camera.last_check
                    ? new Date(
                        camera.last_check
                    ).toLocaleString()
                    : "—";

            return `
                <div
                    class="camera ${status === "offline" ? "offline" : ""}"
                    data-camera-id="${camera.id}"
                >

                    <div class="camera-feed">

                        ${status === "offline"
                    ? "▧"
                    : "◉"}

                    </div>

                    <div class="camera-info">

                        <span>
                            ${camera.camera_code || "—"}
                            ·
                            ${camera.camera_name || "—"}
                        </span>

                        <span>
                            ${String(statusText).toUpperCase()}
                        </span>

                    </div>

                    <div class="custom-camera-meta">

                        <div>
                            IP:
                            ${camera.ip_address || "—"}
                        </div>

                        <div>
                            Location:
                            ${camera.location || "—"}
                        </div>

                        <div>
                            Latency:
                            ${latency}
                        </div>

                        <div>
                            Uptime:
                            ${uptime}
                        </div>

                        <div>
                            Last Check:
                            ${lastCheck}
                        </div>

                        <div style="
                            margin-top:10px;
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                        ">

                            <button
                                type="button"
                                class="device-ping-btn"
                                onclick="pingCameraFromFrontend(${camera.id})"
                            >
                                PING
                            </button>

                          <button 
    type="button" 
    class="device-delete-btn" 
    onclick="deleteCameraFromFrontend(${camera.id}, '${camera.camera_code || ""}')"
> 
    DELETE 
</button>

                        </div>

                    </div>

                </div>
            `;

        }).join("");
}

// Re-apply IP search after backend auto-refresh
filterCamerasByIp();

// ---------------------------------------------------------
// ADD CCTV → MYSQL
// ---------------------------------------------------------

async function submitCameraToBackend(
    event
) {

    event.preventDefault();

    const token =
        localStorage.getItem(
            "access_token"
        );

    if (!token) {

        alert(
            "Login session পাওয়া যায়নি।"
        );

        window.location.replace(
            "login.html"
        );

        return;
    }

    const cameraCode =
        document.getElementById(
            "newCameraId"
        )?.value.trim();

    const cameraName =
        document.getElementById(
            "newCameraName"
        )?.value.trim();

    const ipAddress =
        document.getElementById(
            "newCameraIp"
        )?.value.trim();

    const location =
        document.getElementById(
            "newCameraLocation"
        )?.value.trim();


    if (
        !cameraCode ||
        !cameraName ||
        !ipAddress ||
        !location
    ) {

        alert(
            "Camera ID, Name, IP Address এবং Location পূরণ করুন।"
        );

        return;
    }


    if (
        typeof validateIpAddress ===
        "function" &&
        !validateIpAddress(ipAddress)
    ) {

        alert(
            "Please enter a valid IPv4 address."
        );

        return;
    }


    const payload = {

        camera_code:
            cameraCode,

        camera_name:
            cameraName,

        ip_address:
            ipAddress,

        location:
            location,

        monitoring_enabled:
            true,

        monitoring_interval:
            1800,

        offline_retry_interval:
            120
    };


    try {

        const response =
            await fetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/cameras?_t=${Date.now()}`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " +
                            token
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Camera could not be added."
            );
        }


        if (!data.success) {

            throw new Error(
                data.message ||
                "Camera could not be added."
            );
        }


        alert(
            "✅ CCTV camera added successfully."
        );


        const form =
            document.getElementById(
                "cameraForm"
            );

        form?.reset();


        closeNmsModal(
            "cameraModal"
        );


        await loadCamerasFromBackend();


    } catch (error) {

        console.error(
            "ADD CCTV ERROR:",
            error
        );

        alert(
            error.message ||
            "CCTV camera save করা যায়নি।"
        );
    }
}


// ---------------------------------------------------------
// MANUAL CCTV PING
// ---------------------------------------------------------

async function pingCameraFromFrontend(cameraId, options = {}) {

    const token =
        localStorage.getItem(
            "access_token"
        );

    if (!token) {

        alert(
            "Login required."
        );

        return;
    }


    if (!options.silent) toast("Pinging CCTV...");


    try {

        const response =
            await fetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/cameras/${cameraId}/ping`,
                {
                    method: "POST",

                    headers: {

                        "Authorization":
                            "Bearer " +
                            token
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "CCTV ping failed."
            );
        }


        console.log(
            "CCTV PING RESULT:",
            data
        );


        if (!options.silent) toast(`${data.camera_code} → ${data.status} | ${data.latency_ms ?? "-"} ms`);

        const index = backendCameras.findIndex(c => Number(c.id) === Number(cameraId));
        if (index >= 0) {
            backendCameras[index].status = data.status;
            backendCameras[index].last_latency_ms = data.latency_ms;
            backendCameras[index].total_checks = data.total_checks;
            backendCameras[index].successful_checks = data.successful_checks;
            backendCameras[index].uptime_percent = data.uptime_percent;
            backendCameras[index].last_check = data.last_check;
            
            if (options.silent) {
                if (typeof renderBackendCameras === "function") {
                    renderBackendCameras(backendCameras);
                }
            }
        }

        if (!options.silent) await loadCamerasFromBackend();


    } catch (error) {

        console.error(
            "CCTV PING ERROR:",
            error
        );

        if (!options.silent) alert(error.message || "CCTV ping failed.");
    }
}


// ---------------------------------------------------------
// CCTV REFRESH
// ---------------------------------------------------------

async function refreshCameras() {

    const button =
        document.getElementById(
            "refreshCamerasBtn"
        );

    if (!button) {
        return;
    }

    const oldHTML =
        button.innerHTML;


    // Button loading state
    button.disabled = true;

    button.innerHTML =
        "⟳ Refreshing...";


    /*
     * REAL CCTV PAGE REFRESH
     *
     * Page reload হওয়ার পর:
     * 1. Login token থাকবে
     * 2. /api/cameras আবার call হবে
     * 3. MySQL থেকে latest camera data আসবে
     * 4. Online / Offline status update হবে
     * 5. CCTV dashboard statistics update হবে
     */

    window.location.reload();
}

// ---------------------------------------------------------
// BIND CCTV FORM
// ---------------------------------------------------------

function bindCameraManagement() {

    const addButton =
        document.getElementById(
            "addCameraBtn"
        );

    const form =
        document.getElementById(
            "cameraForm"
        );


    if (
        addButton &&
        !addButton.dataset.bound
    ) {

        addButton.dataset.bound =
            "true";

        addButton.addEventListener(
            "click",
            function () {

                form?.reset();

                openNmsModal(
                    "cameraModal"
                );
            }
        );
    }


    document
        .getElementById(
            "closeCameraModal"
        )
        ?.addEventListener(
            "click",
            function () {

                closeNmsModal(
                    "cameraModal"
                );
            }
        );


    document
        .getElementById(
            "cancelCameraBtn"
        )
        ?.addEventListener(
            "click",
            function () {

                closeNmsModal(
                    "cameraModal"
                );
            }
        );


    document
        .getElementById(
            "cameraModal"
        )
        ?.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    this
                ) {

                    closeNmsModal(
                        "cameraModal"
                    );
                }
            }
        );


    if (
        form &&
        !form.dataset.backendBound
    ) {

        form.dataset.backendBound =
            "true";

        form.addEventListener(
            "submit",
            submitCameraToBackend
        );
    }
}


document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    closeNmsModal('deviceModal');
    closeNmsModal('cameraModal');
});

document.addEventListener(
    "DOMContentLoaded",
    function () {

        bindDeviceManagement();

        bindCameraManagement();

        loadCamerasFromBackend();

        document
            .getElementById(
                "refreshCamerasBtn"
            )
            ?.addEventListener(
                "click",
                refreshCameras
            );
    }
);

/* =========================================================
   REPORT GENERATOR
========================================================= */


/* -----------------------------------------
   REPORT DATA
----------------------------------------- */

const nmsReportData = [

    {
        id: "RTR-01",
        name: "Core Router",
        type: "Router",
        status: "Online",
        ip: "192.168.1.1",
        uptime: "99.99%",
        lastChecked: "Just now"
    },

    {
        id: "SW-01",
        name: "Main Switch",
        type: "Switch",
        status: "Online",
        ip: "192.168.1.10",
        uptime: "99.97%",
        lastChecked: "1 min ago"
    },

    {
        id: "SW-07",
        name: "Production Switch",
        type: "Switch",
        status: "Offline",
        ip: "192.168.1.17",
        uptime: "96.42%",
        lastChecked: "3 min ago"
    },

    {
        id: "SRV-01",
        name: "Application Server",
        type: "Server",
        status: "Online",
        ip: "192.168.1.21",
        uptime: "99.98%",
        lastChecked: "1 min ago"
    },

    {
        id: "SRV-02",
        name: "Database Server",
        type: "Server",
        status: "Online",
        ip: "192.168.1.22",
        uptime: "99.95%",
        lastChecked: "1 min ago"
    },

    {
        id: "CAM-18",
        name: "Gate Camera",
        type: "CCTV",
        status: "Warning",
        ip: "192.168.1.118",
        uptime: "98.21%",
        lastChecked: "2 min ago"
    },

    {
        id: "CAM-19",
        name: "Production Camera",
        type: "CCTV",
        status: "Online",
        ip: "192.168.1.119",
        uptime: "99.70%",
        lastChecked: "1 min ago"
    },

    {
        id: "AP-04",
        name: "Office Access Point",
        type: "Access Point",
        status: "Online",
        ip: "192.168.1.204",
        uptime: "99.45%",
        lastChecked: "2 min ago"
    }

];


/* -----------------------------------------
   DATE ELEMENTS
----------------------------------------- */

const reportFromDate =
    document.getElementById("reportFromDate");

const reportToDate =
    document.getElementById("reportToDate");

const generateReportBtn =
    document.getElementById("generateReportBtn");

const downloadCsvBtn =
    document.getElementById("downloadCSV");

const downloadExcelBtn =
    document.getElementById("downloadExcel");


/* -----------------------------------------
   DEFAULT DATE
----------------------------------------- */

function setDefaultReportDates() {

    if (!reportFromDate || !reportToDate) {
        return;
    }


    const today = new Date();


    const sevenDaysAgo =
        new Date(today);

    sevenDaysAgo.setDate(
        today.getDate() - 7
    );


    reportToDate.value =
        formatDateForInput(today);


    reportFromDate.value =
        formatDateForInput(sevenDaysAgo);

}


function formatDateForInput(date) {

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");


    return `${year}-${month}-${day}`;
}


setDefaultReportDates();


/* -----------------------------------------
   DATE DISPLAY
----------------------------------------- */

function formatReadableDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(dateString + "T00:00:00");


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* -----------------------------------------
   GENERATE REPORT
----------------------------------------- */

if (generateReportBtn) {

    generateReportBtn.addEventListener(
        "click",
        generateNMSReport
    );

}


function generateNMSReport() {

    const from =
        reportFromDate.value;

    const to =
        reportToDate.value;


    /* Validation */

    if (!from || !to) {

        showReportMessage(
            "Please select both From Date and To Date.",
            "error"
        );

        return;
    }


    if (from > to) {

        showReportMessage(
            "From Date cannot be later than To Date.",
            "error"
        );

        return;
    }


    /* Update date range */

    const reportDateRange =
        document.getElementById(
            "reportDateRange"
        );


    if (reportDateRange) {

        reportDateRange.textContent =
            `${formatReadableDate(from)} - ${formatReadableDate(to)}`;

    }


    /* Generate table */

    renderReportTable();


    /* Update summary */

    updateReportSummary();


    /* Status */

    showReportMessage(
        `Report generated successfully for ${formatReadableDate(from)} to ${formatReadableDate(to)}.`,
        "success"
    );

}


/* -----------------------------------------
   REPORT TABLE
----------------------------------------- */

function renderReportTable() {

    const tbody =
        document.getElementById(
            "reportTableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    nmsReportData.forEach(function (device) {

        const row =
            document.createElement("tr");


        let statusClass =
            "report-status-online";


        if (device.status === "Offline") {

            statusClass =
                "report-status-offline";

        }

        else if (device.status === "Warning") {

            statusClass =
                "report-status-warning";

        }


        row.innerHTML = `

            <td>${device.id}</td>

            <td>${device.name}</td>

            <td>${device.type}</td>

            <td>
                <span class="${statusClass}">
                    ${device.status}
                </span>
            </td>

            <td>${device.ip}</td>

            <td>${device.uptime}</td>

            <td>${device.lastChecked}</td>

        `;


        tbody.appendChild(row);

    });

    const recordCount = document.getElementById("reportRecordCount");
    if (recordCount) recordCount.textContent = `${nmsReportData.length} Records`;

}


/* -----------------------------------------
   REPORT SUMMARY
----------------------------------------- */

function updateReportSummary() {

    const total =
        nmsReportData.length;


    const online =
        nmsReportData.filter(
            device =>
                device.status === "Online"
        ).length;


    const alerts =
        nmsReportData.filter(
            device =>
                device.status === "Warning" ||
                device.status === "Offline"
        ).length;


    const totalElement =
        document.getElementById(
            "reportTotalDevices"
        );

    const onlineElement =
        document.getElementById(
            "reportOnlineDevices"
        );

    const alertElement =
        document.getElementById(
            "reportAlerts"
        );


    if (totalElement) {

        totalElement.textContent =
            total;

    }


    if (onlineElement) {

        onlineElement.textContent =
            online;

    }


    if (alertElement) {
        alertElement.textContent = alerts;
    }

    const uptimeElement = document.getElementById("reportUptime");
    if (uptimeElement) {
        const values = nmsReportData.filter(d => d.status !== "Offline").map(d => parseFloat(d.uptime));
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        uptimeElement.textContent = avg.toFixed(2) + "%";
    }

}


/* -----------------------------------------
   REPORT MESSAGE
----------------------------------------- */

function showReportMessage(
    message,
    type
) {

    const status =
        document.getElementById(
            "reportStatus"
        );

    const statusText =
        document.getElementById("reportStatusText") || status;

    if (!status || !statusText) {
        return;
    }


    statusText.textContent =
        message;


    if (type === "error") {

        status.style.borderColor =
            "rgba(255,100,114,0.35)";

        statusText.style.color =
            "#ff6472";

    }

    else {

        status.style.borderColor =
            "rgba(43,212,155,0.30)";

        statusText.style.color =
            "#2bd49b";

    }

}

// ===============================
// REPORT DOWNLOAD SYSTEM
// ===============================

const reportDownloadData = [
    {
        device: "RTR-01",
        type: "Core Router",
        ip: "192.168.1.1",
        status: "Online",
        uptime: "99.98%"
    },
    {
        device: "SW-01",
        type: "Core Switch",
        ip: "192.168.1.10",
        status: "Online",
        uptime: "99.95%"
    },
    {
        device: "SW-04",
        type: "Office Switch",
        ip: "192.168.1.14",
        status: "Online",
        uptime: "99.91%"
    },
    {
        device: "SW-07",
        type: "Warehouse Switch",
        ip: "192.168.1.17",
        status: "Offline",
        uptime: "97.40%"
    },
    {
        device: "SRV-01",
        type: "Main Server",
        ip: "192.168.1.20",
        status: "Online",
        uptime: "99.99%"
    },
    {
        device: "SRV-02",
        type: "Application Server",
        ip: "192.168.1.21",
        status: "Online",
        uptime: "99.96%"
    },
    {
        device: "CAM-18",
        type: "Gate Camera",
        ip: "192.168.1.50",
        status: "Online",
        uptime: "99.80%"
    },
    {
        device: "NM-DESK-001",
        type: "Admin Desktop",
        ip: "192.168.1.101",
        status: "Online",
        uptime: "99.70%"
    }
];


// ===============================
// CSV DOWNLOAD
// ===============================

function downloadCSVReport() {

    let csv = "Device,Type,IP Address,Status,Uptime\n";

    reportDownloadData.forEach(function (row) {

        csv +=
            `"${row.device}",` +
            `"${row.type}",` +
            `"${row.ip}",` +
            `"${row.status}",` +
            `"${row.uptime}"\n`;

    });

    // BOM for Excel / Unicode support
    const BOM = "\uFEFF";

    const blob = new Blob(
        [BOM + csv],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "Neo_Metaliks_Network_Report.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}


// ===============================
// EXCEL DOWNLOAD
// ===============================

function downloadExcelReport() {

    // Check SheetJS
    if (typeof XLSX === "undefined") {

        alert(
            "Excel library load হয়নি। CSV download ব্যবহার করুন অথবা internet connection check করুন."
        );

        return;
    }

    const excelData = reportDownloadData.map(function (row) {

        return {
            "Device": row.device,
            "Type": row.type,
            "IP Address": row.ip,
            "Status": row.status,
            "Uptime": row.uptime
        };

    });

    const worksheet =
        XLSX.utils.json_to_sheet(excelData);

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Network Report"
    );

    XLSX.writeFile(
        workbook,
        "Neo_Metaliks_Network_Report.xlsx"
    );
}


// ===============================
// BUTTON CONNECTION
// ===============================

document.addEventListener("DOMContentLoaded", function () {

    const csvButton =
        document.getElementById("downloadCSV");

    const excelButton =
        document.getElementById("downloadExcel");


    if (csvButton) {

        csvButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                downloadCSVReport();

            }
        );

    }


    if (excelButton) {

        excelButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                downloadExcelReport();

            }
        );

    }

});

// =====================================
// CLEAR REPORTS HISTORY
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    const clearHistoryBtn =
        document.getElementById("clearReportHistory");

    if (!clearHistoryBtn) return;

    clearHistoryBtn.addEventListener("click", function () {

        const confirmClear = confirm(
            "Are you sure you want to clear the reports history?"
        );

        if (!confirmClear) {
            return;
        }

        // Clear report table
        const tableBody =
            document.getElementById("reportTableBody");

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="7"
                        style="text-align:center; padding:30px; color:#71859a;">
                        No report history available
                    </td>
                </tr>
            `;

        }

        // Reset record count
        const recordCount =
            document.getElementById("reportRecordCount");

        if (recordCount) {
            recordCount.textContent = "0 Records";
        }

        // Reset summary cards
        const totalDevices =
            document.getElementById("reportTotalDevices");

        const onlineDevices =
            document.getElementById("reportOnlineDevices");

        const activeAlerts =
            document.getElementById("reportActiveAlerts");

        const uptime =
            document.getElementById("reportUptime");


        if (totalDevices) {
            totalDevices.textContent = "0";
        }

        if (onlineDevices) {
            onlineDevices.textContent = "0";
        }

        if (activeAlerts) {
            activeAlerts.textContent = "0";
        }

        if (uptime) {
            uptime.textContent = "0%";
        }


        // Status message
        const statusText = document.getElementById("reportStatusText");
        if (statusText) statusText.textContent = "Report history cleared successfully.";
        else { const status = document.getElementById("reportStatus"); if (status) status.textContent = "Report history cleared successfully."; }


        alert("Reports history cleared successfully.");

    });

});
// =========================================
// DESKTOP MANAGEMENT REFRESH BUTTON
// =========================================

document.addEventListener("DOMContentLoaded", function () {

    const desktopRefreshBtn =
        document.getElementById("desktopRefreshBtn");

    if (!desktopRefreshBtn) return;

    desktopRefreshBtn.addEventListener("click", function () {

        // Button loading state
        desktopRefreshBtn.disabled = true;
        desktopRefreshBtn.innerHTML = "⟳ Refreshing...";

        // Refresh desktop page/data
        setTimeout(function () {

            // যদি তোমার desktop render function থাকে
            if (typeof renderDesktops === "function") {
                renderDesktops();
            }

            // Success message
            if (typeof toast === "function") {
                toast("Desktop Management refreshed successfully");
            } else {
                alert("Desktop Management refreshed successfully");
            }

            // Button আবার normal
            desktopRefreshBtn.disabled = false;
            desktopRefreshBtn.innerHTML = "🔄 Refresh";

        }, 600);

    });

});

// ==========================================================
// NMS DEVICE MANAGEMENT - MYSQL + PING
// One source of truth for Add / Ping / Delete.
// ==========================================================

const NMS_API_BASE = window.APP_CONFIG.API_BASE_URL;
const deviceMonitoringTimers = new Map();

function getAuthToken() {
    return localStorage.getItem("access_token") || "";
}

function getDeviceForm() {
    return document.getElementById("deviceForm");
}

function getDeviceFormValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
}

function validateDeviceIp(ip) {
    const parts = String(ip || "").trim().split(".");
    return (
        parts.length === 4 &&
        parts.every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
    );
}

function closeDeviceModal() {
    const modal = document.getElementById("deviceModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

function resetDeviceFormDefaults() {
    const form = getDeviceForm();
    if (form) form.reset();

    const type = document.getElementById("newDeviceType");
    if (type) type.value = "Switch";

    const status = document.getElementById("newDeviceStatus");
    if (status) status.value = "Online";

    const uptime = document.getElementById("newDeviceUptime");
    if (uptime) uptime.value = "100%";
}

function setDeviceSaveButton(text, disabled) {
    const form = getDeviceForm();
    const button = form?.querySelector("button[type='submit']");
    if (!button) return;

    if (button.dataset.originalHtml === undefined) {
        button.dataset.originalHtml = button.innerHTML;
    }

    button.disabled = Boolean(disabled);
    button.innerHTML = text;
}

async function submitNewDevice(event) {
    if (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    const form = getDeviceForm();
    if (!form) {
        alert("Add Device form not found.");
        return false;
    }

    const token = getAuthToken();
    if (!token) {
        alert("Login session পাওয়া যায়নি। আবার login করুন।");
        window.location.replace("login.html");
        return false;
    }

    const deviceCode = getDeviceFormValue("newDeviceId");
    const deviceName = getDeviceFormValue("newDeviceName");
    const deviceType = getDeviceFormValue("newDeviceType");
    const ipAddress = getDeviceFormValue("newDeviceIp");
    const location = getDeviceFormValue("newDeviceLocation");

    if (!deviceCode || !deviceName || !deviceType || !ipAddress || !location) {
        alert("Device ID, Name, Type, IP Address এবং Location পূরণ করুন।");
        return false;
    }

    if (!validateDeviceIp(ipAddress)) {
        alert("Please enter a valid IPv4 address.");
        return false;
    }

    const payload = {
        device_code: deviceCode,
        device_name: deviceName,
        device_type: deviceType,
        ip_address: ipAddress,
        mac_address: null,
        location: location,
        description: null,
        monitoring_enabled: true,
        monitoring_interval: 30
    };

    try {
        setDeviceSaveButton("Saving...", true);

        const response = await fetch(`${NMS_API_BASE}/api/devices`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const raw = await response.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (_) {
            data = null;
        }

        if (!response.ok) {
            throw new Error(
                data?.detail || data?.message || raw || "Device save failed."
            );
        }

        if (!data?.success || !data?.device?.id) {
            throw new Error("Device was not returned by the server. Please check the backend.");
        }

        const newDeviceId = Number(data.device.id);

        // Save succeeded. Immediately perform the first ping.
        setDeviceSaveButton("Pinging...", true);

        let pingData = null;
        let pingFailureMessage = "";

        try {
            const pingResponse = await fetch(
                `${NMS_API_BASE}/api/devices/${newDeviceId}/ping`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const pingRaw = await pingResponse.text();
            try {
                pingData = pingRaw ? JSON.parse(pingRaw) : null;
            } catch (_) {
                pingData = null;
            }

            if (!pingResponse.ok || !pingData?.success) {
                pingFailureMessage =
                    pingData?.detail ||
                    pingData?.message ||
                    pingRaw ||
                    "Ping failed.";
            }
        } catch (pingError) {
            pingFailureMessage = pingError.message || "Ping failed.";
        }

        closeDeviceModal();
        resetDeviceFormDefaults();

        await loadDevicesFromBackend();

        if (pingData?.success) {
            const latencyText =
                pingData.latency_ms !== null && pingData.latency_ms !== undefined
                    ? ` • ${pingData.latency_ms} ms`
                    : "";

            showToast(
                `${pingData.device_name} → ${pingData.status}${latencyText}`
            );
        } else {
            showToast(`Device saved. Ping failed: ${pingFailureMessage}`);
        }

    } catch (error) {
        console.error("Add Device / Ping Error:", error);
        alert(error.message || "Device add/ping failed.");
    } finally {
        const formButton = form.querySelector("button[type='submit']");
        if (formButton) {
            formButton.disabled = false;
            formButton.innerHTML = formButton.dataset.originalHtml || "Save Device";
        }
    }

    return false;
}

window.submitNewDevice = submitNewDevice;

async function pingDeviceFromFrontend(deviceId, options = {}) {
    const token = getAuthToken();
    if (!token) {
        if (!options.silent) toast("Login required");
        return null;
    }

    if (!options.silent) toast("Pinging device...");

    try {
        const response = await fetch(
            `${NMS_API_BASE}/api/devices/${deviceId}/ping`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const raw = await response.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (_) {
            data = null;
        }

        if (!response.ok || !data?.success) {
            throw new Error(
                data?.detail || data?.message || raw || "Ping failed"
            );
        }

        const index = backendDevices.findIndex(
            device => Number(device.id) === Number(deviceId)
        );

        if (index >= 0) {
            backendDevices[index].status = data.status;
            backendDevices[index].last_latency_ms = data.latency_ms;
            backendDevices[index].last_check = data.last_check;
            renderBackendDevices(backendDevices);
        }

        console.log("Ping Result:", data);

        if (!options.silent) {
            const latencyText =
                data.latency_ms !== null && data.latency_ms !== undefined
                    ? ` • ${data.latency_ms} ms`
                    : "";
            toast(`${data.device_name} → ${data.status}${latencyText}`);
        }

        return data;

    } catch (error) {
        console.error("Ping Error:", error);
        if (!options.silent) toast("Ping error: " + error.message);
        return null;
    }
}

window.pingDeviceFromFrontend = pingDeviceFromFrontend;

async function deleteDeviceFromFrontend(deviceId, deviceCode) {
    const token = getAuthToken();
    if (!token) {
        toast("Login required");
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete device "${deviceCode}"?`)) {
        return;
    }

    try {
        toast("Deleting device...");

        const response = await fetch(
            `${NMS_API_BASE}/api/devices/${deviceId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const raw = await response.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (_) {
            data = null;
        }

        if (!response.ok || !data?.success) {
            throw new Error(
                data?.detail || data?.message || raw || "Failed to delete device"
            );
        }

        stopDeviceMonitoring(Number(deviceId));
        await loadDevicesFromBackend();
        toast("Device deleted successfully");

    } catch (error) {
        console.error("Delete Device Error:", error);
        toast("Delete error: " + error.message);
    }
}

window.deleteDeviceFromFrontend = deleteDeviceFromFrontend;

function stopDeviceMonitoring(deviceId) {
    const entry = deviceMonitoringTimers.get(Number(deviceId));
    if (entry) {
        clearInterval(entry.timer);
        deviceMonitoringTimers.delete(Number(deviceId));
    }
}

function syncDeviceMonitoring(list) {
    const ids = new Set();

    (Array.isArray(list) ? list : []).forEach(device => {
        const id = Number(device.id);
        if (!id) return;

        ids.add(id);

        const enabled = Boolean(
            device.monitoring_enabled === true ||
            device.monitoring_enabled === 1 ||
            String(device.monitoring_enabled).toLowerCase() === "true"
        );

        if (!enabled) {
            stopDeviceMonitoring(id);
            return;
        }

        const seconds = Math.max(
            5,
            Number(device.monitoring_interval) || 30
        );
        const intervalMs = seconds * 1000;
        const existing = deviceMonitoringTimers.get(id);

        if (existing && existing.intervalMs === intervalMs) {
            return;
        }

        stopDeviceMonitoring(id);

        const timer = null; // Removed frontend ping loop to rely on backend

        deviceMonitoringTimers.set(id, {
            timer,
            intervalMs
        });
    });

    for (const id of deviceMonitoringTimers.keys()) {
        if (!ids.has(id)) stopDeviceMonitoring(id);
    }
}

// Keep the backend list loader as the single source of truth.
const _originalLoadDevicesFromBackend = loadDevicesFromBackend;
loadDevicesFromBackend = async function () {
    await _originalLoadDevicesFromBackend();
    syncDeviceMonitoring(backendDevices);
};

// Keep old compatibility calls safe.
window.renderDevices = function () {
    return loadDevicesFromBackend();
};

// The existing bindDeviceManagement() above owns the modal open/close buttons.
// This section only provides the backend-backed submit, ping and monitoring functions.

// =========================================================
// DELETE CCTV FROM FRONTEND
// =========================================================

async function deleteCameraFromFrontend(cameraId, cameraCode) {

    const token = localStorage.getItem("access_token");

    if (!token) {
        alert("Login required.");
        window.location.replace("login.html");
        return;
    }

    const confirmDelete = confirm(
        'Are you sure you want to permanently delete CCTV "' +
        cameraCode +
        '"?'
    );

    if (!confirmDelete) {
        return;
    }

    try {

        const response = await fetch(
            window.APP_CONFIG.API_BASE_URL + "/api/cameras/" + cameraId,
            {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const raw = await response.text();

        let data = {};

        try {
            data = raw ? JSON.parse(raw) : {};
        } catch (e) {
            data = {};
        }

        if (!response.ok || !data.success) {

            throw new Error(
                data.detail ||
                data.message ||
                raw ||
                "CCTV delete failed."
            );
        }

        // Remove from frontend array
        backendCameras = backendCameras.filter(
            function (camera) {
                return Number(camera.id) !== Number(cameraId);
            }
        );

        // Re-render CCTV cards
        renderBackendCameras(backendCameras);

        alert(
            "CCTV " +
            cameraCode +
            " deleted permanently."
        );

        console.log(
            "✅ CCTV deleted:",
            cameraId,
            cameraCode
        );

    } catch (error) {

        console.error(
            "❌ CCTV Delete Error:",
            error
        );

        alert(
            "CCTV delete failed:\n" +
            error.message
        );
    }
}

// Make function available to onclick=""
window.deleteCameraFromFrontend =
    deleteCameraFromFrontend;

// =========================================================
// DESKTOP LOCATION MONITOR
// =========================================================

let selectedDesktopMonitoringLocation = null;

// =========================================================
// DESKTOP MONITORING MASTER ON / OFF
// =========================================================

let desktopMonitoringEnabled = true;

// LOAD MONITORING STATE
try {

    const savedMonitoringState =
        localStorage.getItem(
            "desktopMonitoringEnabled"
        );

    if (savedMonitoringState !== null) {

        desktopMonitoringEnabled =
            savedMonitoringState === "true";

    }

} catch (error) {

    console.warn(
        "Desktop monitoring state load error:",
        error
    );

}


// UPDATE MONITORING UI
function updateDesktopMonitoringUI() {

    const toggle =
        document.getElementById(
            "desktopMonitoringToggle"
        );

    const switchElement =
        document.getElementById(
            "desktopMonitoringSwitch"
        );

    const status =
        document.getElementById(
            "desktopMonitoringStatus"
        );

    if (toggle) {

        toggle.checked =
            desktopMonitoringEnabled;

    }

    if (switchElement) {

        switchElement.style.background =
            desktopMonitoringEnabled
                ? "#2588d8"
                : "#586777";

    }

    if (status) {

        status.textContent =
            desktopMonitoringEnabled
                ? "● Monitoring ON"
                : "● Monitoring OFF";

        status.style.color =
            desktopMonitoringEnabled
                ? "#39d98a"
                : "#ff5c5c";

    }

}


// CHANGE MONITORING STATE
async function setDesktopMonitoringState(enabled) {

    const token =
        typeof getAuthToken === 'function'
            ? getAuthToken()
            : localStorage.getItem('access_token');

    if (!token) {
        alert('Please login again.');
        return;
    }

    const newState = Boolean(enabled);

    /*
     * Monitoring ON করতে হলে আগে location লাগবে.
     */
    if (
        newState &&
        !selectedDesktopMonitoringLocation
    ) {

        alert(
            'Please select a desktop location first.'
        );

        updateDesktopMonitoringUI();

        return;
    }

    try {

        const response = await fetch(
            `${NMS_API_BASE}/api/desktops/monitoring`,
            {
                method: 'PUT',

                headers: {
                    'Content-Type': 'application/json',
                    'Authorization':
                        `Bearer ${token}`
                },

                body: JSON.stringify({
                    enabled: newState,
                    selected_location:
                        newState
                            ? selectedDesktopMonitoringLocation
                            : null
                })
            }
        );

        const data = await response.json();

        console.log(
            'Desktop monitoring backend response:',
            data
        );

        if (!response.ok || !data.success) {

            throw new Error(
                data.detail ||
                data.message ||
                'Desktop monitoring update failed.'
            );
        }

        /*
         * Backend successfully saved the state.
         */
        desktopMonitoringEnabled =
            newState;

        localStorage.setItem(
            'desktopMonitoringEnabled',
            String(newState)
        );

        if (!newState) {

            /*
             * Monitoring OFF হলে table-ও empty হবে.
             */
            renderDesktopRows([]);

        } else {

            /*
             * Selected location-এর desktop দেখাবে.
             */
            const selectedLocation =
                String(
                    selectedDesktopMonitoringLocation
                )
                    .trim()
                    .toLowerCase();

            const filteredDesktops =
                desktopData.filter(
                    function (desktop) {

                        return String(
                            desktop.location || ''
                        )
                            .trim()
                            .toLowerCase() ===
                            selectedLocation;
                    }
                );

            renderDesktopRows(
                filteredDesktops
            );
        }

        updateDesktopMonitoringUI();

        console.log(
            newState
                ? '🟢 Desktop monitoring ON'
                : '🔴 Desktop monitoring OFF'
        );

    } catch (error) {

        console.error(
            '❌ Desktop monitoring update error:',
            error
        );

        /*
         * Backend update failed হলে
         * checkbox আগের অবস্থায় ফিরবে.
         */
        desktopMonitoringEnabled =
            !newState;

        updateDesktopMonitoringUI();

        alert(
            'Desktop monitoring update failed.\n' +
            error.message
        );
    }
}


// =========================================================
// LOAD DESKTOP MONITORING STATE FROM BACKEND
// =========================================================

async function loadDesktopMonitoringState() {

    const token =
        typeof getAuthToken === 'function'
            ? getAuthToken()
            : localStorage.getItem('access_token');

    if (!token) {
        console.warn('⚠️ No login token found.');
        return;
    }

    try {

        const response = await fetch(
            `${NMS_API_BASE}/api/desktops/monitoring`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        console.log(
            'Desktop monitoring state from backend:',
            data
        );

        if (!response.ok || !data.success) {

            throw new Error(
                data.detail ||
                data.message ||
                'Failed to load desktop monitoring state.'
            );
        }

        // -----------------------------------------
        // BACKEND STATE
        // -----------------------------------------

        desktopMonitoringEnabled =
            Boolean(data.enabled);
            
        localStorage.setItem(
            'desktopMonitoringEnabled',
            String(data.enabled)
        );

        // -----------------------------------------
        // BACKEND SELECTED LOCATION
        // -----------------------------------------

        if (data.selected_location) {

            selectedDesktopMonitoringLocation =
                data.selected_location;

            localStorage.setItem(
                'selectedDesktopMonitoringLocation',
                data.selected_location
            );

            const locationButton =
                document.getElementById(
                    'desktopLocationBtn'
                );

            if (locationButton) {

                locationButton.textContent =
                    '📍 ' +
                    data.selected_location;
            }

        } else {

            selectedDesktopMonitoringLocation =
                null;

            localStorage.removeItem(
                'selectedDesktopMonitoringLocation'
            );

        }

        // -----------------------------------------
        // UPDATE ON / OFF UI
        // -----------------------------------------

        updateDesktopMonitoringUI();

        // -----------------------------------------
        // SHOW ONLY MONITORED LOCATION
        // OFF = EMPTY TABLE
        // -----------------------------------------

        if (!desktopMonitoringEnabled) {

            renderDesktopRows([]);

        } else {

            const selectedLocation =
                String(
                    selectedDesktopMonitoringLocation || ''
                )
                    .trim()
                    .toLowerCase();

            const filteredDesktops =
                desktopData.filter(function (desktop) {

                    return String(
                        desktop.location || ''
                    )
                        .trim()
                        .toLowerCase() ===
                        selectedLocation;

                });

            renderDesktopRows(
                filteredDesktops
            );
        }

        console.log(
            desktopMonitoringEnabled
                ? '🟢 Backend Desktop Monitoring is ON'
                : '🔴 Backend Desktop Monitoring is OFF'
        );

    } catch (error) {

        console.error(
            '❌ Failed to load desktop monitoring state:',
            error
        );

    }
}

// ------------------------------------------
// OPEN LOCATION MODAL
// ------------------------------------------

function openDesktopLocationModal() {

    const modal = document.getElementById(
        "desktopLocationModal"
    );

    if (!modal) {
        console.warn(
            "Desktop location modal not found."
        );
        return;
    }

    renderDesktopLocationOptions();

    modal.classList.add("show");
}


// ------------------------------------------
// CLOSE LOCATION MODAL
// ------------------------------------------

function closeDesktopLocationModal() {

    const modal = document.getElementById(
        "desktopLocationModal"
    );

    if (!modal) {
        return;
    }

    modal.classList.remove("show");
}


// ------------------------------------------
// GET UNIQUE DESKTOP LOCATIONS
// ------------------------------------------

function getDesktopLocations() {

    if (!Array.isArray(desktopData)) {
        return [];
    }

    return [
        ...new Set(
            desktopData
                .map(function (desktop) {
                    return String(
                        desktop.location || ""
                    ).trim();
                })
                .filter(function (location) {
                    return location !== "";
                })
        )
    ];
}


// ------------------------------------------
// RENDER LOCATION LIST
// ------------------------------------------

function renderDesktopLocationOptions(
    searchText = ""
) {

    const list = document.getElementById(
        "desktopLocationList"
    );

    if (!list) {
        return;
    }

    const query = String(
        searchText
    ).trim().toLowerCase();

    const locations =
        getDesktopLocations().filter(
            function (location) {
                return location
                    .toLowerCase()
                    .includes(query);
            }
        );

    if (!locations.length) {

        list.innerHTML = `
            <div style="
                padding:16px;
                text-align:center;
                color:#71859a;
                border:1px solid #23384d;
                border-radius:8px;
            ">
                No desktop locations found.
            </div>
        `;

        return;
    }


    list.innerHTML =
        locations.map(
            function (location) {

                const isSelected =
                    selectedDesktopMonitoringLocation ===
                    location;

                return `
                    <button
                        type="button"
                        class="desktop-location-option"
                        data-location="${location}"
                        style="
                            width:100%;
                            display:block;
                            text-align:left;
                            padding:12px 14px;
                            margin-bottom:8px;
                            border-radius:8px;
                            border:1px solid ${isSelected ? "#2588d8" : "#23384d"};
                            background:${isSelected ? "#123b5a" : "#101f2e"};
                            color:#eaf4ff;
                            cursor:pointer;
                            font-size:14px;
                        "
                    >
                        📍 ${location}
                    </button>
                `;
            }
        )
            .join("");


    list.querySelectorAll(
        ".desktop-location-option"
    ).forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    selectedDesktopMonitoringLocation =
                        this.dataset.location;

                    renderDesktopLocationOptions(
                        document.getElementById(
                            "desktopLocationSearch"
                        )?.value || ""
                    );

                }
            );

        }
    );
}


// ------------------------------------------
// APPLY SELECTED LOCATION
// ------------------------------------------

async function applyDesktopMonitoringLocation() {

    if (!selectedDesktopMonitoringLocation) {

        alert(
            "Please select a desktop location first."
        );

        return;
    }

    const token =
        typeof getAuthToken === "function"
            ? getAuthToken()
            : localStorage.getItem("access_token");

    if (!token) {

        alert("Please login again.");

        return;
    }

    const selectedLocation =
        selectedDesktopMonitoringLocation
            .trim();

    try {

        /*
         * Backend-এ selected location save হবে.
         *
         * Monitoring ON/OFF state
         * এখন change করছি না.
         */
        const response = await fetch(
            `${NMS_API_BASE}/api/desktops/monitoring`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${token}`
                },

                body: JSON.stringify({
                    enabled:
                        desktopMonitoringEnabled,

                    selected_location:
                        selectedLocation
                })
            }
        );

        const data =
            await response.json();

        console.log(
            "Desktop location backend response:",
            data
        );

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.detail ||
                data.message ||
                "Desktop location update failed."
            );
        }

        /*
         * Frontend state
         */
        selectedDesktopMonitoringLocation =
            selectedLocation;

        localStorage.setItem(
            "selectedDesktopMonitoringLocation",
            selectedLocation
        );

        /*
         * Button update
         */
        const button =
            document.getElementById(
                "desktopLocationBtn"
            );

        if (button) {

            button.textContent =
                "📍 " +
                selectedLocation;
        }

        /*
         * Always display all desktops in inventory.
         */
        renderDesktopRows(desktopData);

        /*
         * Modal close
         */
        closeDesktopLocationModal();

        console.log(
            "✅ Desktop monitoring location saved:",
            selectedLocation
        );

        console.log(
            "✅ Monitoring state:",
            desktopMonitoringEnabled
                ? "ON"
                : "OFF"
        );

        if (
            typeof showToast === "function"
        ) {

            showToast(
                "Monitoring location saved: " +
                selectedLocation
            );

        } else {

            alert(
                "Monitoring location saved successfully."
            );
        }

    } catch (error) {

        console.error(
            "❌ Desktop location update error:",
            error
        );

        alert(
            "Could not save desktop monitoring location.\n\n" +
            error.message
        );
    }
}
// ------------------------------------------
// LOAD SAVED LOCATION
// ------------------------------------------

function loadSelectedDesktopMonitoringLocation() {

    const savedLocation =
        localStorage.getItem(
            "selectedDesktopMonitoringLocation"
        );

    if (!savedLocation) {
        return;
    }

    selectedDesktopMonitoringLocation =
        savedLocation;

    const button = document.getElementById(
        "desktopLocationBtn"
    );

    if (button) {

        button.textContent =
            "📍 " + savedLocation;
    }
}


// ------------------------------------------
// BUTTON EVENTS
// ------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const locationButton =
            document.getElementById(
                "desktopLocationBtn"
            );

        const closeButton =
            document.getElementById(
                "closeDesktopLocationModal"
            );

        const monitoringToggle =
            document.getElementById(
                "desktopMonitoringToggle"
            );

        const cancelButton =
            document.getElementById(
                "cancelDesktopLocationBtn"
            );

        const applyButton =
            document.getElementById(
                "applyDesktopLocationBtn"
            );

        const searchInput =
            document.getElementById(
                "desktopLocationSearch"
            );

        // DESKTOP MONITORING ON / OFF
        monitoringToggle?.addEventListener(
            "change",
            function () {

                setDesktopMonitoringState(
                    this.checked
                );

            }
        );

        locationButton?.addEventListener(
            "click",
            openDesktopLocationModal
        );

        closeButton?.addEventListener(
            "click",
            closeDesktopLocationModal
        );

        cancelButton?.addEventListener(
            "click",
            closeDesktopLocationModal
        );

        applyButton?.addEventListener(
            "click",
            applyDesktopMonitoringLocation
        );


        searchInput?.addEventListener(
            "input",
            function () {

                renderDesktopLocationOptions(
                    this.value
                );
            }
        );


        document
            .getElementById(
                "desktopLocationModal"
            )
            ?.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target === this
                    ) {
                        closeDesktopLocationModal();
                    }

                }
            );


        loadSelectedDesktopMonitoringLocation();

        updateDesktopMonitoringUI();
    }
);

document.addEventListener(
    'DOMContentLoaded',
    function () {

        loadDesktopMonitoringState();

    }
);

// Dashboard Dynamic Stats
async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        
        // Fetch dashboard stats
        const res = await fetch(NMS_API_BASE + '/api/dashboard/stats?_t=' + Date.now(), {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                let enableAlerts = true;
                try { const s = JSON.parse(localStorage.getItem('nmsSettings') || '{}'); if(s.alert === false) enableAlerts = false; } catch(e){}
                
                if (!enableAlerts) {
                    data.active_alerts = 0;
                }
                
                let prevAlertCount = window.lastKnownAlertCount !== undefined ? window.lastKnownAlertCount : data.active_alerts;
                if (data.active_alerts > prevAlertCount && enableAlerts) {
                    toast("?? New system alert received!");
                    if (typeof playSound === "function") playSound();
                }
                window.lastKnownAlertCount = data.active_alerts;

                const elTotal = document.getElementById('dashTotal');
                const elOnline = document.getElementById('dashOnline');
                const elAlerts = document.getElementById('dashAlerts');

                if (elTotal) elTotal.textContent = data.total_devices;
                if (elOnline) elOnline.textContent = data.online_devices;
                if (elAlerts) elAlerts.textContent = data.active_alerts;
                const sbAlerts = document.getElementById('sidebarAlertsCount');
                const hrAlerts = document.getElementById('headerAlertsCount');
                if (sbAlerts) sbAlerts.textContent = data.active_alerts;
                if (hrAlerts) hrAlerts.textContent = data.active_alerts;
                
                const elHealth = document.getElementById('dashHealthList');
                if (elHealth && data.breakdown) {
                    elHealth.innerHTML = `
                        <div><span>📷 CCTV Cameras</span><b>${data.breakdown.cameras.online} / ${data.breakdown.cameras.total}</b></div>
                        <div><span>🖧 Network Devices</span><b>${data.breakdown.devices.online} / ${data.breakdown.devices.total}</b></div>
                        <div><span>🖥 Desktop Clients</span><b>${data.breakdown.desktops.online} / ${data.breakdown.desktops.total}</b></div>
                    `;
                }
                
                const hl = document.getElementById('dashHealthList');
                if (hl && data.breakdown) {
                    const c = data.breakdown.cameras;
                    const d = data.breakdown.devices;
                    const desk = data.breakdown.desktops;
                    
                    hl.innerHTML = `
                        <div><span>▣ CCTV Cameras</span><b class="${c.online < c.total ? 'amber' : ''}">${c.online} / ${c.total}</b></div>
                        <div><span>⌁ Network Devices</span><b class="${d.online < d.total ? 'amber' : ''}">${d.online} / ${d.total}</b></div>
                        <div><span>▤ Desktops</span><b class="${desk.online < desk.total ? 'amber' : ''}">${desk.online} / ${desk.total}</b></div>
                    `;
                    
                    const availability = data.total_devices > 0 ? ((data.online_devices / data.total_devices) * 100).toFixed(1) : 100;
                    
                    const avBox = document.querySelector('.availability b');
                    const avBar = document.querySelector('.availability i');
                    if (avBox) avBox.textContent = availability + '%';
                    if (avBar) avBar.style.width = availability + '%';

                    const dashQC = document.getElementById('dashQuickCCTV');
                    const dashQN = document.getElementById('dashQuickNetwork');
                    const dashQD = document.getElementById('dashQuickDevices');
                    const dashQDesk = document.getElementById('dashQuickDesktops');
                    
                    if(dashQC) dashQC.textContent = c.total + ' cameras';
                    if(dashQN) dashQN.textContent = d.total + ' devices';
                    if(dashQD) dashQD.textContent = d.total + ' devices';
                    if(dashQDesk) dashQDesk.textContent = data.breakdown.desktops.total + ' desktops';
                }
            }
        }
        
        // Fetch recent alerts
        const alRes = await fetch(NMS_API_BASE + '/api/alerts?_t=' + Date.now(), {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (alRes.ok) {
            const alData = await alRes.json();
            if (alData.success) {
                const alList = document.getElementById('dashAlertsList');
                if (alList) {
                    let enableAlerts = true;
                    try { const s = JSON.parse(localStorage.getItem('nmsSettings') || '{}'); if(s.alert === false) enableAlerts = false; } catch(e){}
                    alList.innerHTML = '';
                    const alerts = enableAlerts ? alData.alerts.slice(0, 4) : [];
                    if (alerts.length === 0) {
                        alList.innerHTML = '<div style="padding:20px;text-align:center;color:#688097">No recent alerts. Everything is healthy.</div>';
                    } else {
                        alerts.forEach(a => {
                            const icon = a.severity === 'Critical' ? '!' : (a.severity === 'Warning' ? '!' : 'i');
                            const cls = (a.severity || 'info').toLowerCase();
                            const time = new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            alList.innerHTML += `
                                <div class="alert ${cls}">
                                    <i>${icon}</i>
                                    <div><b>${a.message}</b><small>${a.source_type} ${a.source_name} · ${time}</small></div>
                                    <label>${a.severity}</label>
                                </div>
                            `;
                        });
                    }
                }
            }
        }
    } catch (err) { console.error('Dashboard Stats Error', err); }
}


document.addEventListener('DOMContentLoaded', () => { setTimeout(loadDashboardStats, 1000); });

// Dynamic Network Map
async function loadNetworkMap() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const res = await fetch(NMS_API_BASE + '/api/network-map?_t=' + Date.now(), { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.nodes.length > 0) {
                const topoEl = document.querySelector('.topology');
                if (!topoEl) return;

                // Configure container for absolute positioning
                topoEl.style.position = 'relative';
                topoEl.style.display = 'block';
                topoEl.style.minHeight = '700px';
                topoEl.style.overflow = 'hidden';
                topoEl.style.background = 'radial-gradient(circle at center, #0B1622 0%, #060B12 100%)';
                topoEl.innerHTML = '';

                const width = topoEl.clientWidth || 800;
                const height = topoEl.clientHeight || 700;
                const centerX = width / 2;
                const centerY = height / 2;

                // Create SVG for lines
                let svgHTML = `<svg style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">`;

                // Calculate positions in concentric circles
                const nodes = data.nodes;
                const nodeHTMLs = [];
                
                // Identify a core node if one exists, else make NMS Server the center
                const centerHtml = `<div style="position:absolute; left:${centerX - 40}px; top:${centerY - 40}px; width:80px; height:80px; background:#0e88e5; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-direction:column; box-shadow: 0 0 30px rgba(14,136,229,0.5); z-index:10; border:2px solid #64b5f6;">
                    <b style="font-size:12px; color:white;">CORE</b>
                    <small style="font-size:8px; color:#bbdefb;">NMS</small>
                </div>`;
                nodeHTMLs.push(centerHtml);

                const count = nodes.length;
                
                nodes.forEach((n, i) => {
                    // Distribute nodes in circles
                    // Outer circle radius based on container size
                    let radius = Math.min(width, height) * 0.35;
                    
                    // If too many nodes, create two layers of circles
                    if (count > 12 && i % 2 === 0) {
                        radius = Math.min(width, height) * 0.22;
                    }
                    
                    const angle = (i / count) * 2 * Math.PI - Math.PI / 2; // Start from top
                    const nx = centerX + radius * Math.cos(angle);
                    const ny = centerY + radius * Math.sin(angle);
                    
                    const isOnline = (n.status === 'Online');
                    const statusClass = isOnline ? 'online' : 'offline';
                    const statusStr = isOnline ? ('&#9889; ' + n.last_latency_ms + 'ms') : '&#9888; OFFLINE';
                    const lineColor = isOnline ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 61, 87, 0.6)';
                    const dashArray = isOnline ? 'none' : '5,5';
                    const anim = isOnline ? `<animate attributeName="stroke-opacity" values="0.2;1;0.2" dur="${(Math.random() * 2 + 1).toFixed(1)}s" repeatCount="indefinite" />` : '';

                    // Draw line
                    svgHTML += `<line x1="${centerX}" y1="${centerY}" x2="${nx}" y2="${ny}" stroke="${lineColor}" stroke-width="2" stroke-dasharray="${dashArray}">${anim}</line>`;

                    // Draw Node
                    const nodeWidth = 110;
                    const nodeHeight = 60;
                    
                    const glowColor = isOnline ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 61, 87, 0.3)';
                    const borderC = isOnline ? '#29465e' : '#ff3d57';

                    const html = `<div class="node-hover" style="position:absolute; left:${nx - nodeWidth/2}px; top:${ny - nodeHeight/2}px; width:${nodeWidth}px; padding:8px; text-align:center; background:#102132; border:1px solid ${borderC}; border-radius:9px; box-shadow:0 0 15px ${glowColor}; z-index:5; transition: transform 0.2s;">
                        <b style="font-size:10px;display:block;color:white;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${n.device_code}</b>
                        <small style="font-size:8px;color:#688097;display:block;margin:2px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${n.ip_address}</small>
                        <span class="status ${statusClass}" style="font-size:8px; padding:2px 4px;">${statusStr}</span>
                        </div>`;
                    nodeHTMLs.push(html);
                });

                svgHTML += `</svg>`;
                topoEl.innerHTML = svgHTML + nodeHTMLs.join('');
                
                // Add hover effect css if not exists
                if (!document.getElementById('topo-hover-style')) {
                    const style = document.createElement('style');
                    style.id = 'topo-hover-style';
                    style.innerHTML = '.node-hover:hover { transform: scale(1.1) !important; z-index: 20 !important; cursor: pointer; }';
                    document.head.appendChild(style);
                }
            }
        }
    } catch (err) { }
}


async function loadAlerts() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const res = await fetch(NMS_API_BASE + '/api/alerts?_t=' + Date.now(), { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                let enableAlerts = true;
                try { const s = JSON.parse(localStorage.getItem('nmsSettings') || '{}'); if(s.alert === false) enableAlerts = false; } catch(e){}
                if(!enableAlerts) data.alerts = [];

                const alertList = document.querySelector('.incident-list');
                if (!alertList) return;
                alertList.innerHTML = '';
                
                if (data.alerts.length === 0) {
                    alertList.innerHTML = '<div style="padding:40px;text-align:center;color:#688097;font-size:16px;"><b>No Active Alerts</b><br><br><small>Everything is healthy and operational.</small></div>';
                    return;
                }
                
                data.alerts.forEach(a => {
                    const cssBg = a.severity === 'Critical' ? 'critical-bg' : (a.severity === 'Warning' ? 'warning-bg' : 'info-bg');
                    const cssBorder = a.severity === 'Critical' ? 'critical-border' : (a.severity === 'Warning' ? 'warning-border' : 'info-border');
                    const createdDate = new Date(a.created_at);
                    
                    // Format relative time
                    const seconds = Math.floor((new Date() - createdDate) / 1000);
                    let timeAgo = Math.floor(seconds) + " seconds ago";
                    let interval = seconds / 31536000;
                    if (interval > 1) { timeAgo = Math.floor(interval) + " years ago"; }
                    else {
                        interval = seconds / 2592000;
                        if (interval > 1) { timeAgo = Math.floor(interval) + " months ago"; }
                        else {
                            interval = seconds / 86400;
                            if (interval > 1) { timeAgo = Math.floor(interval) + " days ago"; }
                            else {
                                interval = seconds / 3600;
                                if (interval > 1) { timeAgo = Math.floor(interval) + " hours ago"; }
                                else {
                                    interval = seconds / 60;
                                    if (interval > 1) { timeAgo = Math.floor(interval) + " minutes ago"; }
                                }
                            }
                        }
                    }

                    // Find location from frontend state
                    let loc = "Unknown Location";
                    if (typeof backendDevices !== 'undefined') {
                        const dev = backendDevices.find(d => d.device_code === a.source_name);
                        if (dev && dev.location) loc = dev.location;
                    }
                    if (loc === "Unknown Location" && typeof backendCameras !== 'undefined') {
                        const cam = backendCameras.find(c => c.camera_code === a.source_name);
                        if (cam && cam.location) loc = cam.location;
                    }
                    if (loc === "Unknown Location" && typeof desktopData !== 'undefined') {
                        const desk = desktopData.find(d => d.id === a.source_name);
                        if (desk && desk.location) loc = desk.location;
                    }

                    const timeStr = createdDate.toLocaleTimeString();
                    const detailsStr = loc + ' &bull; Detected ' + timeAgo + ' &bull; Logged at ' + timeStr;

                    let cleanMsg = a.message;
                    
                    alertList.innerHTML += '<div class="incident ' + cssBorder + '">' +
                        '<div class="severity ' + cssBg + '">' + a.severity.toUpperCase() + '</div>' +
                        '<div><h3 style="margin-bottom:5px;">' + cleanMsg + '</h3><p style="font-size:12px; color:#a2b5cd;">' + detailsStr + '</p></div>' +
                        '<div class="severity info-bg">' + a.status + '</div>' +
                        '</div>';
                });
            }
        }
    } catch (err) { }
}

window.ackAlerts = async function () {
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(NMS_API_BASE + '/api/alerts/acknowledge', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
            toast('All alerts acknowledged');
            loadAlerts();
            loadDashboardStats();
        }
    } catch (err) { }
};

// Reports Override
window.generateReport = async function () {
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(NMS_API_BASE + '/api/reports?_t=' + Date.now(), { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                const tbody = document.getElementById('reportTbody');
                if (tbody) {
                    tbody.innerHTML = '';
                    let rTotal = 0, rOnline = 0, avgUptime = 0;
                    data.report.forEach(r => {
                        rTotal++;
                        if (r.status === 'Online') rOnline++;
                        avgUptime += parseFloat(r.uptime || 0);
                        const statusHTML = r.status === 'Online' ? '<span class="status-badge online">? Online</span>' : '<span class="status-badge offline">? Offline</span>';
                        tbody.innerHTML += '<tr>' +
                            '<td><b>' + r.id + '</b><small>' + r.name + '</small></td>' +
                            '<td>' + r.type + '</td>' +
                            '<td>' + r.ip + '</td>' +
                            '<td>' + (r.uptime || 0) + '%</td>' +
                            '<td>' + statusHTML + '</td>' +
                            '</tr>';
                    });

                    const rtTotal = document.getElementById('reportTotalDevices');
                    const rtOnline = document.getElementById('reportOnlineDevices');
                    const rtUptime = document.getElementById('reportAvgUptime');

                    if (rtTotal) rtTotal.textContent = rTotal;
                    if (rtOnline) rtOnline.textContent = rOnline;
                    if (rtUptime) rtUptime.textContent = rTotal > 0 ? (avgUptime / rTotal).toFixed(2) + '%' : '0%';
                }

                window.nmsReportData = data.report;
            }
        }
        toast('Report generated successfully');
    } catch (err) {
        toast('Failed to generate report');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadNetworkMap, 1200);
    setTimeout(loadAlerts, 1800);
});

// Map report data for downloads
const origGen = window.generateReport;
window.generateReport = async function () {
    await origGen();
    if (window.nmsReportData) {
        window.reportDownloadData = window.nmsReportData.map(r => ({
            device: r.id + ' - ' + r.name,
            type: r.type,
            ip: r.ip,
            status: r.status,
            uptime: r.uptime + '%'
        }));
    }
};


// --- AUTO MONITORING FIX ---
let autoMonitorIntervalId = null;

function startAutoMonitor() {
    if (autoMonitorIntervalId) clearInterval(autoMonitorIntervalId);
    let tick = 0;
    
    autoMonitorIntervalId = setInterval(() => {
        if (localStorage.getItem('adminLoggedIn') !== 'true') return;
        tick++;

        // Read dynamically so it respects settings immediately without restart
        let s = {};
        try { s = JSON.parse(localStorage.getItem('nmsSettings') || '{}'); } catch(e){}
        let netInterval = parseInt(s.networkInterval) || 10;
        let camInterval = parseInt(s.cameraInterval) || 5;
        let defaultInterval = 5;

        const pageName = window.currentPage || document.querySelector('.page.active')?.id;
        
        // Global stats every default interval (5s)
        if (tick % defaultInterval === 0) {
            if (typeof loadDashboardStats === 'function') loadDashboardStats();
            if (pageName === 'alerts' && typeof loadAlerts === 'function') loadAlerts();
        }
        
        // Network Devices based on networkMonitoring and networkInterval
        let netEnabled = s.networkMonitoring !== false;
        if (netEnabled && tick % netInterval === 0 && pageName === 'devices') {
            if (typeof loadDevicesFromBackend === 'function') loadDevicesFromBackend();
        }
        
        // Cameras based on cameraMonitoring and cameraInterval
        let camEnabled = s.cameraMonitoring !== false;
        if (camEnabled && tick % camInterval === 0 && pageName === 'cctv') {
            if (typeof loadCamerasFromBackend === 'function') loadCamerasFromBackend();
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startAutoMonitor, 2000);
});
// ---------------------------

// --- BACKGROUND EXPLICIT PINGING TASKS ---
let devicePingIntervalId = null;
let cameraPingIntervalId = null;

function startBackgroundPinging() {
    if (devicePingIntervalId) clearInterval(devicePingIntervalId);
    if (cameraPingIntervalId) clearInterval(cameraPingIntervalId);

    const netSelect = document.getElementById('networkInterval');
    let netInterval = netSelect && netSelect.value ? parseInt(netSelect.value) : 10;
    if (isNaN(netInterval) || netInterval < 5) netInterval = 5;

    const camSelect = document.getElementById('cameraInterval');
    let camInterval = camSelect && camSelect.value ? parseInt(camSelect.value) : 30;
    if (isNaN(camInterval) || camInterval < 5) camInterval = 5;

    devicePingIntervalId = setInterval(async () => {
        if (localStorage.getItem('adminLoggedIn') !== 'true') return;
        if (typeof backendDevices !== 'undefined' && Array.isArray(backendDevices)) {
            for (const d of backendDevices) {
                // Ping devices with monitoring_enabled
                if (d.monitoring_enabled == 1 || d.monitoring_enabled === true || d.monitoring_enabled === 'true') {
                    if (typeof pingDeviceFromFrontend === 'function') {
                        pingDeviceFromFrontend(d.id, { silent: true }).catch(e => console.error(e));
                    }
                }
            }
        }
    }, netInterval * 1000);

    // Maintain last check times for each camera
    if (!window.cameraLastCheckTimes) window.cameraLastCheckTimes = {};
    
    cameraPingIntervalId = setInterval(async () => {
        if (localStorage.getItem('adminLoggedIn') !== 'true') return;
        
        const camSelect = document.getElementById('cameraInterval');
        let currentCamInterval = camSelect && camSelect.value ? parseInt(camSelect.value) : 30;
        if (isNaN(currentCamInterval) || currentCamInterval < 5) currentCamInterval = 5;
        
        const retrySelect = document.getElementById('cameraRetryInterval');
        let currentRetryInterval = retrySelect && retrySelect.value ? parseInt(retrySelect.value) : 120;
        if (isNaN(currentRetryInterval) || currentRetryInterval < 5) currentRetryInterval = 30;

        const now = Date.now();

        if (typeof backendCameras !== 'undefined' && Array.isArray(backendCameras)) {
            for (const c of backendCameras) {
                if (c.monitoring_enabled == 1 || c.monitoring_enabled === true || c.monitoring_enabled === 'true') {
                    const status = String(c.status || '').toLowerCase();
                    const intervalToUse = (status === 'offline' || status === 'unreachable' || status === 'unknown') ? currentRetryInterval : currentCamInterval;
                    
                    const last = window.cameraLastCheckTimes[c.id] || 0;
                    if (now - last >= intervalToUse * 1000) {
                        window.cameraLastCheckTimes[c.id] = now;
                        if (typeof pingCameraFromFrontend === 'function') {
                            pingCameraFromFrontend(c.id, { silent: true }).catch(e => console.error(e));
                        }
                    }
                }
            }
        }
    }, 1000); // Check every second, but respect the specific camera intervals
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startBackgroundPinging, 4000); // Start after initial load
    
    const netSelect = document.getElementById('networkInterval');
    if (netSelect) netSelect.addEventListener('change', startBackgroundPinging);
    
    const camSelect = document.getElementById('cameraInterval');
    if (camSelect) camSelect.addEventListener('change', startBackgroundPinging);
});
// -----------------------------------------


