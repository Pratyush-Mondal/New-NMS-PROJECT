/* =====================================================



   NMS API BASE URL & GLOBAL CONFIG



===================================================== */



var NMS_API_BASE = (function() {



    if (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null) {



        return window.APP_CONFIG.API_BASE_URL;



    }



    if (window.location.protocol === "http:" || window.location.protocol === "https:") {



        if (window.location.port === "8000" || window.location.port === "8081" || !window.location.port) {



            return "";



        }



        return window.location.protocol + "//" + window.location.hostname + ":8000";



    }



    return "http://127.0.0.1:8000";



})();







window.APP_CONFIG = window.APP_CONFIG || {};



window.APP_CONFIG.API_BASE_URL = NMS_API_BASE;







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



    'admin-profile-page': 'Administrator Profile',



    'admin-panel': 'Administrator Management & System Health'



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







    if (pageName === 'dashboard') {



        if (typeof drawChart === 'function') setTimeout(drawChart, 30);



        if (typeof loadDashboardStats === 'function') loadDashboardStats();



    } else if (pageName === 'devices') {



        if (typeof loadDevicesFromBackend === 'function') loadDevicesFromBackend();



    } else if (pageName === 'cameras') {



        if (typeof loadCamerasFromBackend === 'function') loadCamerasFromBackend();



    } else if (pageName === 'desktops') {



        if (typeof refreshDesktopData === 'function') refreshDesktopData();



        if (typeof loadDesktopMonitoringState === 'function') loadDesktopMonitoringState();



    } else if (pageName === 'network') {



        if (typeof loadNetworkMap === 'function') loadNetworkMap();



    } else if (pageName === 'alerts') {



        if (typeof loadAlerts === 'function') loadAlerts();



    } else if (pageName === 'reports') {



        if (typeof generateNMSReport === 'function') generateNMSReport();



    } else if (pageName === 'admin-profile-page') {



        if (typeof loadAdminProfileData === 'function') loadAdminProfileData();



    } else if (pageName === 'admin-panel') {



        if (typeof loadAdminPanelData === 'function') loadAdminPanelData();



    } else if (pageName === 'settings') {



        if (typeof loadSettings === 'function') loadSettings();



    }



    if (typeof updateAutoPingBannerUI === 'function') updateAutoPingBannerUI();



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







function toast(msg) {



    let t = document.getElementById('toast');



    if (!t) {



        t = document.createElement('div');



        t.id = 'toast';



        document.body.appendChild(t);



    }



    t.textContent = msg;



    t.classList.add('show');



    clearTimeout(window.tt);



    window.tt = setTimeout(() => t.classList.remove('show'), 2800);



}



window.toast = toast;



function showToast(msg) { toast(msg); }







function updateDashboardGreeting() {



    const el = document.getElementById("dashboardGreeting") || document.querySelector("#dashboard .hero h2");



    if (!el) return;



    const hour = new Date().getHours();



    const timeGreeting = hour < 12 ? "Good morning" : (hour < 17 ? "Good afternoon" : "Good evening");



    const adminName = localStorage.getItem("admin_name") || "Administrator";



    el.textContent = `${timeGreeting}, ${adminName}.`;



}







async function refreshAll() {



    const btn = document.getElementById('dashboardRefreshBtn') || document.querySelector('button[onclick="refreshAll()"]');



    if (btn) {



        btn.disabled = true;



        btn.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite;">⟳</span> Refreshing...';



    }







    try {



        const promises = [];



        if (typeof loadDashboardStats === 'function') promises.push(loadDashboardStats());



        if (typeof loadDevicesFromBackend === 'function') promises.push(loadDevicesFromBackend());



        if (typeof loadCamerasFromBackend === 'function') promises.push(loadCamerasFromBackend());



        if (typeof refreshDesktopData === 'function') promises.push(refreshDesktopData());



        if (typeof loadDesktopMonitoringState === 'function') promises.push(loadDesktopMonitoringState());



        if (typeof loadNetworkMap === 'function') promises.push(loadNetworkMap());



        if (typeof loadAlerts === 'function') promises.push(loadAlerts());







        await Promise.allSettled(promises);



        if (typeof updateDashboardGreeting === 'function') updateDashboardGreeting();



        if (typeof drawChart === 'function') setTimeout(drawChart, 30);



        if (typeof toast === 'function') toast('✅ Dashboard and infrastructure data refreshed');



    } catch (err) {



        console.error('Dashboard refresh error:', err);



    } finally {



        if (btn) {



            btn.disabled = false;



            btn.innerHTML = '↻ Refresh';



        }



    }



}







window.refreshAll = refreshAll;



window.updateDashboardStats = loadDashboardStats;



window.fetchBackendDevices = loadDevicesFromBackend;



window.fetchBackendCameras = loadCamerasFromBackend;



window.updateDashboardGreeting = updateDashboardGreeting;



function ackAlerts() { document.getElementById('dashAlerts').textContent = '0'; toast('All alerts acknowledged') }



async function pingTest() {



    const btn = document.querySelector('button[onclick="pingTest()"]');



    if (btn) {



        btn.disabled = true;



        btn.innerHTML = '&#9203; Pinging...';



    }



    



    if (typeof toast === 'function') toast('Running ping test on all devices...');



    



    const pingPromises = [];



    



    if (typeof backendDevices !== 'undefined' && Array.isArray(backendDevices)) {



        backendDevices.forEach(d => {



            if (typeof pingDeviceFromFrontend === 'function') {



                pingPromises.push(pingDeviceFromFrontend(d.id, { silent: true }).catch(e => null));



            }



        });



    }







    if (typeof backendCameras !== 'undefined' && Array.isArray(backendCameras)) {



        backendCameras.forEach(c => {



            if (typeof pingCameraFromFrontend === 'function') {



                pingPromises.push(pingCameraFromFrontend(c.id, { silent: true }).catch(e => null));



            }



        });



    }







    if (typeof desktopData !== 'undefined' && Array.isArray(desktopData)) {



        desktopData.forEach(d => {



            if (typeof pingDesktopFromFrontend === 'function') {



                pingPromises.push(pingDesktopFromFrontend(d.backendId || d.id, { silent: true }).catch(e => null));



            }



        });



    }



    



    await Promise.allSettled(pingPromises);



    



    if (typeof loadNetworkMap === 'function') {



        await loadNetworkMap();



    }



    if (typeof loadDashboardStats === 'function') {



        await loadDashboardStats();



    }



    



    if (btn) {



        btn.disabled = false;



        btn.innerHTML = '&#9889; Run Ping Test';



    }



    



    if (typeof toast === 'function') toast('Ping test completed successfully!');



}



window.pingTest = pingTest;







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



        const apiBase = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE_URL === 'string') 



                        ? window.APP_CONFIG.API_BASE_URL 



                        : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        const response = await fetch(



            `${apiBase}/api/devices?_t=${Date.now()}`,



            {



                method: "GET",



                headers: {



                    "Authorization": "Bearer " + token



                }



            }



        );







        if (!response.ok) {



            if (response.status === 401 || response.status === 403) {



                localStorage.removeItem("access_token");



                window.location.replace("login.html");



                return;



            }



            throw new Error("Device API request failed: HTTP " + response.status);



        }







        const data = await response.json();



        if (!data.success) {



            throw new Error(data.message || "Device loading failed.");



        }







        backendDevices = Array.isArray(data.devices) ? data.devices : [];



        window._deviceRetry = 0;



        renderBackendDevices(backendDevices);



        console.log("✅ MySQL devices loaded:", backendDevices.length);







    } catch (error) {



        console.error("Device backend error:", error);



        window._deviceRetry = (window._deviceRetry || 0) + 1;



        if (window._deviceRetry <= 3) {



            setTimeout(loadDevicesFromBackend, 1500);



            return;



        }



        const tbody = document.getElementById("deviceRows");



        if (tbody) {



            tbody.innerHTML = `



                <tr>



                    <td colspan="8" style="text-align:center;padding:30px;color:#ff6472;">



                        Device data load করা যায়নি। <button type="button" onclick="window._deviceRetry=0;loadDevicesFromBackend()" class="btn secondary" style="margin-left:12px;padding:4px 14px;cursor:pointer;">↻ Retry</button>



                    </td>



                </tr>



            `;



        }



        toast("Backend থেকে device data load করা যায়নি");



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



                                class="table-action"



                                style="background:#0284c7;color:#fff;font-weight:600;padding:4px 8px;border-radius:4px;"



                                title="Toggle Online / Offline Status"



                                onclick="toggleDeviceStatus(${device.id})">







                                TOGGLE







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



    const currentImg = localStorage.getItem("admin_profile_image");



    if (currentImg && typeof setProfileImage === 'function') {



        setProfileImage(API_BASE_URL + currentImg);



    } else {



        ['profileAvatarLarge', 'editProfileAvatar'].forEach(id => {



            const el = document.getElementById(id);



            if (el && !el.querySelector('img')) el.textContent = letter;



        });







        document.querySelectorAll('.admin-avatar, .admin-large-avatar').forEach(avatar => {



            if (!avatar.querySelector('img')) avatar.textContent = letter;



        });



    }



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



            admin.profile_image ||



            localStorage.getItem(



                "admin_profile_image"



            );







        if (savedProfileImage) {



            localStorage.setItem("admin_profile_image", savedProfileImage);



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



        if (text.includes('Admin Panel')) openAdminPanel();



        else if (text.includes('Admin Profile')) openAdminProfile();



        else if (text.includes('Admin Settings')) openAdminSettings();



        else if (text.includes('Activity Log')) showAdminActivity();



        else if (text.includes('Logout')) adminLogout();



    });







    document.addEventListener('click', function () {



        closeAdminMenu();



    });



});







// Always expose these functions for inline buttons / browser console.



window.openAdminPanel = openAdminPanel;



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



    if (!imageUrl) return;



    const adminName = localStorage.getItem("admin_name") || "Administrator";



    const letter = (adminName || 'A').charAt(0).toUpperCase();



    const cleanUrl = imageUrl.includes('?') ? imageUrl : `${imageUrl}?_t=${Date.now()}`;







    const updateEl = function (element) {



        if (!element) return;



        element.innerHTML = `



            <img



                src="${cleanUrl}"



                alt=""



                onerror="this.onerror=null; this.parentElement.textContent='${letter}';"



                style="



                    width: 100%;



                    height: 100%;



                    object-fit: cover;



                    border-radius: 50%;



                    display: block;



                "



            >



        `;



    };







    const headerAvatar = document.querySelector("#adminButton .admin-avatar");



    if (headerAvatar) updateEl(headerAvatar);







    const largeAvatar = document.getElementById("profileAvatarLarge");



    if (largeAvatar) updateEl(largeAvatar);







    const editAvatar = document.getElementById("editProfileAvatar");



    if (editAvatar) updateEl(editAvatar);







    document.querySelectorAll(".admin-avatar, .admin-large-avatar").forEach(updateEl);



}







const initialStoredPhoto = localStorage.getItem("admin_profile_image");



if (initialStoredPhoto) {



    setTimeout(() => {



        setProfileImage(API_BASE_URL + initialStoredPhoto);



    }, 50);



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







    desktopMonitoring: true,



    desktopInterval: "10",







    alert: true,



    soundNotification: true,



};











// ------------------------------------------



// GET ELEMENT & SELECT HELPER



// ------------------------------------------







function get(id) {



    return document.getElementById(id);



}







function setSelectValueSafely(selectEl, val) {



    if (!selectEl || val === undefined || val === null) return;



    const strVal = String(val).trim();



    let found = false;



    for (let i = 0; i < selectEl.options.length; i++) {



        if (selectEl.options[i].value === strVal) {



            selectEl.selectedIndex = i;



            found = true;



            break;



        }



    }



    if (!found && strVal !== "") {



        const num = parseInt(strVal, 10);



        let label = strVal + " Seconds";



        if (!isNaN(num)) {



            if (num >= 3600 && num % 3600 === 0) label = (num / 3600) + (num === 3600 ? " Hour" : " Hours");



            else if (num >= 60 && num % 60 === 0) label = (num / 60) + (num === 60 ? " Minute" : " Minutes");



            else if (num >= 60) {



                const mins = Math.floor(num / 60);



                const secs = num % 60;



                label = `${mins}m ${secs}s`;



            }



        }



        const opt = document.createElement("option");



        opt.value = strVal;



        opt.textContent = label;



        selectEl.appendChild(opt);



        selectEl.value = strVal;



    }



}







function formatIntervalDisplay(sec) {



    const s = Number(sec);



    if (isNaN(s)) return `${sec}`;



    if (s >= 3600 && s % 3600 === 0) return `${s / 3600} Hour${s > 3600 ? 's' : ''}`;



    if (s >= 60 && s % 60 === 0) return `${s / 60} Minute${s > 60 ? 's' : ''}`;



    return `${s}s`;



}











// ------------------------------------------



// LOAD SETTINGS



// ------------------------------------------







async function loadSettings() {



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







    // Try fetching live backend settings if available



    const token = localStorage.getItem("access_token");



    if (token) {



        try {



            const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                            ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : "");



            const [netRes, camRes, deskRes] = await Promise.allSettled([



                fetch(`${apiBase}/api/settings/network`, { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json()),



                fetch(`${apiBase}/api/settings/camera`, { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json()),



                fetch(`${apiBase}/api/desktops/monitoring`, { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json())



            ]);



            if (netRes.status === "fulfilled" && netRes.value && netRes.value.interval) {



                settings.networkInterval = String(netRes.value.interval);



                if (netRes.value.enabled !== undefined) settings.networkMonitoring = Boolean(netRes.value.enabled);



            }



            if (camRes.status === "fulfilled" && camRes.value && camRes.value.camera_interval) {



                settings.cameraInterval = String(camRes.value.camera_interval);



                if (camRes.value.camera_retry_interval) settings.cameraRetryInterval = String(camRes.value.camera_retry_interval);



                if (camRes.value.camera_monitoring !== undefined) settings.cameraMonitoring = Boolean(camRes.value.camera_monitoring);



            }



            if (deskRes.status === "fulfilled" && deskRes.value) {



                if (deskRes.value.interval) settings.desktopInterval = String(deskRes.value.interval);



                if (deskRes.value.enabled !== undefined) settings.desktopMonitoring = Boolean(deskRes.value.enabled);



            }



            localStorage.setItem("nmsSettings", JSON.stringify(settings));



        } catch (_) {}



    }







    // GENERAL



    if (get("theme")) get("theme").value = settings.theme || defaultSettings.theme;



    if (get("language")) get("language").value = settings.language || defaultSettings.language;



    if (get("timeFormat")) get("timeFormat").value = settings.timeFormat || defaultSettings.timeFormat;







    // NETWORK



    if (get("networkMonitoring")) {



        get("networkMonitoring").checked = settings.networkMonitoring ?? defaultSettings.networkMonitoring;



    }



    setSelectValueSafely(get("networkInterval"), settings.networkInterval || defaultSettings.networkInterval);







    // CAMERA



    if (get("cameraMonitoring")) {



        get("cameraMonitoring").checked = settings.cameraMonitoring ?? defaultSettings.cameraMonitoring;



    }



    setSelectValueSafely(get("cameraInterval"), settings.cameraInterval || defaultSettings.cameraInterval);



    setSelectValueSafely(get("cameraRetryInterval"), settings.cameraRetryInterval || 120);







    // DESKTOP



    if (get("desktopMonitoringSetting")) {



        get("desktopMonitoringSetting").checked = settings.desktopMonitoring ?? defaultSettings.desktopMonitoring;



    }



    setSelectValueSafely(get("desktopInterval"), settings.desktopInterval || settings.networkInterval || defaultSettings.desktopInterval);







    // ALERT



    if (get("alert")) {



        get("alert").checked = settings.alert ?? defaultSettings.alert;



    }







    // NOTIFICATION



    if (get("soundNotification")) {



        get("soundNotification").checked = settings.soundNotification ?? defaultSettings.soundNotification;



    }







    // APPLY THEME



    if (typeof applyTheme === 'function') applyTheme(settings.theme);







    // APPLY LANGUAGE



    if (typeof applyLanguage === 'function') applyLanguage(settings.language);







    console.log("NMS Settings Loaded", settings);



}



window.loadSettings = loadSettings;















// ------------------------------------------



// SAVE SETTINGS



// ------------------------------------------







function persistCurrentSettings(showMsg = false) {



    saveSettings();



}







async function saveSettings() {



    const settings = {



        theme: get("theme") ? get("theme").value : "dark",



        language: get("language") ? get("language").value : "en",



        timeFormat: get("timeFormat") ? get("timeFormat").value : "24",



        networkMonitoring: get("networkMonitoring") ? get("networkMonitoring").checked : true,



        networkInterval: get("networkInterval") ? get("networkInterval").value : "10",



        cameraMonitoring: get("cameraMonitoring") ? get("cameraMonitoring").checked : true,



        cameraInterval: get("cameraInterval") ? get("cameraInterval").value : "30",



        cameraRetryInterval: get("cameraRetryInterval") ? parseInt(get("cameraRetryInterval").value, 10) : 120,



        desktopMonitoring: get("desktopMonitoringSetting") ? get("desktopMonitoringSetting").checked : true,



        desktopInterval: get("desktopInterval") ? get("desktopInterval").value : "10",



        alert: get("alert") ? get("alert").checked : true,



        soundNotification: get("soundNotification") ? get("soundNotification").checked : true,



    };







    // SAVE TO LOCAL STORAGE



    localStorage.setItem("nmsSettings", JSON.stringify(settings));







    const token = localStorage.getItem("access_token");



    if (!token) {



        if (typeof showMessage === 'function') showMessage("⚠ Login session expired");



        return;



    }







    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : "");







    // 1. SYNC CAMERA MONITORING SETTINGS TO BACKEND



    try {



        const cameraResponse = await fetch(`${apiBase}/api/settings/camera`, {



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



        });







        const cameraData = await cameraResponse.json().catch(() => ({}));



        if (!cameraResponse.ok || !cameraData.success) {



            console.warn("CCTV settings sync detail:", cameraData);



        } else {



            console.log("✅ CCTV settings synced:", cameraData);



        }



    } catch (error) {



        console.error("CCTV settings sync error:", error);



    }







    // 2. SYNC NETWORK SETTINGS TO BACKEND



    try {



        await syncNetworkSettingsToBackend(false);



    } catch (error) {



        console.error("Network settings sync error:", error);



    }







    // 3. SYNC DESKTOP SETTINGS TO BACKEND



    try {



        await fetch(`${apiBase}/api/desktops/monitoring`, {



            method: "PUT",



            headers: {



                "Content-Type": "application/json",



                "Authorization": `Bearer ${token}`



            },



            body: JSON.stringify({



                enabled: settings.desktopMonitoring,



                interval: Number(settings.desktopInterval)



            })



        });



    } catch (error) {



        console.error("Desktop settings sync error:", error);



    }







    if (typeof syncGlobalSettingsToBackend === 'function') {



        syncGlobalSettingsToBackend(settings);



    }







    // APPLY THEME & LANGUAGE



    if (typeof applyTheme === 'function') applyTheme(settings.theme);



    if (typeof applyLanguage === 'function') applyLanguage(settings.language);



    if (typeof updateClock === 'function') updateClock();







    // RESTART FRONTEND TIMERS WITH NEW INTERVALS IMMEDIATELY



    if (typeof resetAutoPingTimers === 'function') resetAutoPingTimers();



    if (typeof startAutoMonitor === 'function') startAutoMonitor();



    if (typeof startBackgroundPinging === 'function') startBackgroundPinging();







    const netText = formatIntervalDisplay(settings.networkInterval);



    const camText = formatIntervalDisplay(settings.cameraInterval);



    const retryText = formatIntervalDisplay(settings.cameraRetryInterval);







    toast(`✓ Settings saved: Devices: ${netText} | CCTV: ${camText}`);



    if (typeof showMessage === 'function') showMessage("✓ Settings saved successfully");







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



    if(get("desktopMonitoringSetting")) get("desktopMonitoringSetting").checked = defaultSettings.desktopMonitoring;



    if(get("desktopInterval")) get("desktopInterval").value = defaultSettings.desktopInterval;



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



// ADVANCED NOTIFICATION CHIME & AUDIO ENGINE



// ------------------------------------------







const NMS_AUDIBLE_CHIME_B64 = "data:audio/wav;base64,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";







let _sharedAudioCtx = null;



let _nmsAudioEl = null;







function getNmsAudioElement() {



    if (!_nmsAudioEl) {



        _nmsAudioEl = document.getElementById('nmsChimePlayer');



        if (!_nmsAudioEl) {



            _nmsAudioEl = document.createElement('audio');



            _nmsAudioEl.id = 'nmsChimePlayer';



            _nmsAudioEl.style.display = 'none';



            _nmsAudioEl.preload = 'auto';



            document.body.appendChild(_nmsAudioEl);



        }



        if (!_nmsAudioEl.src || _nmsAudioEl.src === '' || _nmsAudioEl.src.length < 50) {



            _nmsAudioEl.src = NMS_AUDIBLE_CHIME_B64;



        }



    }



    return _nmsAudioEl;



}







function getSharedAudioContext() {



    try {



        if (!_sharedAudioCtx) {



            const AudioCtx = window.AudioContext || window.webkitAudioContext;



            if (AudioCtx) {



                _sharedAudioCtx = new AudioCtx();



            }



        }



        if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {



            _sharedAudioCtx.resume().catch(() => {});



        }



        return _sharedAudioCtx;



    } catch (e) {



        return null;



    }



}







// Automatically unlock AudioContext and HTML5 Audio on ANY user gesture



['click', 'keydown', 'mousedown', 'touchstart'].forEach(eventName => {



    document.addEventListener(eventName, function unlockAudio() {



        getSharedAudioContext();



        try {



            const el = getNmsAudioElement();



            if (el && (!el.src || el.src.length < 50)) {



                el.src = NMS_AUDIBLE_CHIME_B64;



            }



        } catch (_) {}



    }, { passive: true, once: false });



});







function isSoundNotificationEnabled() {



    try {



        const saved = JSON.parse(localStorage.getItem("nmsSettings") || "{}");



        if (saved.soundNotification !== undefined) {



            return Boolean(saved.soundNotification);



        }



        const toggle = document.getElementById("soundNotification");



        if (toggle) return toggle.checked;



    } catch (_) {}



    return true;



}







function playSound(forced = false) {



    const isForced = forced === true || forced === 'forced' || forced === 'alert';



    if (!isForced && !isSoundNotificationEnabled()) {



        console.log("🔇 Sound notification is OFF in settings. Audio chime suppressed.");



        return;



    }







    let webaudioPlayed = false;



    try {



        const ctx = getSharedAudioContext();



        if (ctx && ctx.state !== 'suspended') {



            const now = ctx.currentTime;



            // Dual-tone chime: Tone 1 (Ding 880Hz) -> Tone 2 (Dong 1175Hz)



            const osc1 = ctx.createOscillator();



            const gain1 = ctx.createGain();



            osc1.type = 'sine';



            osc1.frequency.setValueAtTime(880, now);



            gain1.gain.setValueAtTime(0.45, now);



            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);



            osc1.connect(gain1);



            gain1.connect(ctx.destination);



            osc1.start(now);



            osc1.stop(now + 0.35);







            const osc2 = ctx.createOscillator();



            const gain2 = ctx.createGain();



            osc2.type = 'sine';



            osc2.frequency.setValueAtTime(1174.66, now + 0.12);



            gain2.gain.setValueAtTime(0.45, now + 0.12);



            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.50);



            osc2.connect(gain2);



            gain2.connect(ctx.destination);



            osc2.start(now + 0.12);



            osc2.stop(now + 0.50);



            webaudioPlayed = true;



        } else if (ctx && ctx.state === 'suspended') {



            ctx.resume().catch(() => {});



        }



    } catch (err) {



        console.warn("WebAudio chime notice:", err);



    }







    // Audible Fallback & Guaranteed Playback via HTML5 Audio element



    try {



        const audioEl = getNmsAudioElement();



        if (audioEl) {



            audioEl.currentTime = 0;



            const playPromise = audioEl.play();



            if (playPromise !== undefined) {



                playPromise.catch(err => {



                    try {



                        const freshAudio = new Audio(NMS_AUDIBLE_CHIME_B64);



                        freshAudio.play().catch(() => {});



                    } catch (_) {}



                });



            }



        }



    } catch (_) {}



}



window.playSound = playSound;







function testSound() {



    playSound(true);



    const enabled = isSoundNotificationEnabled();



    const msg = enabled ? "🔊 Playing Alert Chime (Sound ON)" : "🔊 Playing Alert Chime (Forced Test)";



    if (typeof toast === 'function') {



        toast(msg);



    } else if (typeof showMessage === 'function') {



        showMessage(msg);



    }



}



window.testSound = testSound;















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



    if (!list || list.length === 0) {



        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:36px 16px; color:#8ea2b8;">



            <div style="font-size:15px; font-weight:600; color:#e2e8f0; margin-bottom:6px;">Desktop Monitoring is Paused</div>



            <div style="font-size:13px; color:#94a3b8;">Click <b>📍 Monitor Location</b> above to select a location and turn monitoring ON.</div>



        </td></tr>`;



        refreshDesktopSummary();



        return;



    }



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



            class="device-ping-btn"



            onclick="pingDesktopFromFrontend(${Number(d.backendId || d.id)})"



        >



            PING



        </button>







        <button



            type="button"



            class="table-action"



            style="background:#0284c7;color:#fff;font-weight:600;padding:4px 8px;border-radius:4px;"



            title="Toggle Online / Offline Status"



            onclick="toggleDesktopStatus(${Number(d.backendId || d.id)})"



        >



            TOGGLE



        </button>







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







async function pingDesktopFromFrontend(desktopId, options = {}) {



    const token = getAuthToken();



    if (!token) {



        if (!options.silent) toast("Login required");



        return null;



    }







    const btn = document.querySelector(`button[onclick*="pingDesktopFromFrontend(${desktopId})"]`);



    if (btn) {



        btn.disabled = true;



        btn.innerHTML = "&#9203; Pinging...";



    }







    if (!options.silent) toast("Pinging desktop...");







    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : "");







    try {



        const response = await fetch(



            `${apiBase}/api/desktops/${desktopId}/ping`,



            {



                method: "POST",



                headers: {



                    "Authorization": `Bearer ${token}`



                }



            }



        );







        const data = await response.json();







        if (!response.ok || !data?.success) {



            throw new Error(data?.detail || data?.message || "Desktop ping failed");



        }







        let statusChanged = false;



        const index = (window.desktopData || []).findIndex(



            d => Number(d.backendId || d.id) === Number(desktopId) || String(d.id) === String(desktopId)



        );



        if (index >= 0) {



            const oldStatus = desktopData[index].status;



            if (oldStatus && oldStatus !== 'Unknown' && oldStatus !== data.status) {



                statusChanged = true;



            }



            desktopData[index].status = data.status;



            desktopData[index].last_latency_ms = data.latency_ms;



            desktopData[index].last_check = data.last_check;



            renderDesktopRows(desktopData);



        }







        if (statusChanged) {



            playSound(true);



            if (typeof loadAlerts === 'function') loadAlerts();



            if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            if (typeof loadDashboardStats === 'function') loadDashboardStats();



        }







        if (!options.silent) {



            const isOnline = String(data.status).toLowerCase() === "online";



            const latencyText =



                data.latency_ms !== null && data.latency_ms !== undefined



                    ? ` • ${data.latency_ms} ms`



                    : "";



            toast(`${isOnline ? "✅" : "❌"} ${data.desktop_code} → ${data.status}${latencyText}`);



        }







        return data;







    } catch (error) {



        console.error("Desktop Ping Error:", error);



        if (!options.silent) toast("Ping: " + (error.message || "Failed"));



        return null;



    } finally {



        if (btn) {



            btn.disabled = false;



            btn.innerHTML = "PING";



        }



    }



}



window.pingDesktopFromFrontend = pingDesktopFromFrontend;







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







async function refreshDevicesFromBackend() {



    const button = document.getElementById("refreshDevicesBtn");



    if (button) {



        button.disabled = true;



        button.innerHTML = "↻ Refreshing...";



    }



    window._deviceRetry = 0;



    await loadDevicesFromBackend();



    if (button) {



        button.disabled = false;



        button.innerHTML = "↻ Refresh";



    }



    if (typeof toast === "function") toast("Device list refreshed");



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

    const token = localStorage.getItem("access_token");

    if (!token) {

        window.location.replace("login.html");

        return;

    }



    try {

        const apiBase = (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE_URL === 'string') 

                        ? window.APP_CONFIG.API_BASE_URL 

                        : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');

        const response = await fetch(

            `${apiBase}/api/cameras?_t=${Date.now()}`,

            {

                method: "GET",

                headers: {

                    "Authorization": "Bearer " + token

                }

            }

        );



        if (!response.ok) {

            if (response.status === 401 || response.status === 403) {

                localStorage.removeItem("access_token");

                localStorage.removeItem("adminLoggedIn");

                localStorage.removeItem("loggedIn");

                window.location.replace("login.html");

                return;

            }

            throw new Error("Camera API request failed: HTTP " + response.status);

        }



        const data = await response.json();

        if (!data.success) {

            throw new Error(data.message || "Camera loading failed.");

        }



        backendCameras = Array.isArray(data.cameras) ? data.cameras : [];

        window.backendCameras = backendCameras;

        window._cameraRetry = 0;

        renderBackendCameras(backendCameras);

        console.log("✅ MySQL cameras loaded:", backendCameras.length);



    } catch (error) {

        console.error("CCTV backend error:", error);

        window._cameraRetry = (window._cameraRetry || 0) + 1;

        if (window._cameraRetry <= 3) {

            setTimeout(loadCamerasFromBackend, 1500);

            return;

        }

        const grid = document.getElementById("cameraGrid");

        if (grid) {

            grid.innerHTML = `

                <div style="grid-column:1/-1;text-align:center;padding:40px;color:#ff6472;">

                    CCTV data load করা যায়নি। <button type="button" onclick="window._cameraRetry=0;loadCamerasFromBackend()" class="btn secondary" style="margin-left:12px;padding:4px 14px;cursor:pointer;">↻ Retry</button>

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



    // ALWAYS update CCTV summary cards first (even if grid is not currently open/visible)

    updateCameraDashboardStats(list);



    const grid = document.getElementById("cameraGrid");

    if (!grid) {

        return;

    }







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



                                class="table-action"



                                style="background:#0284c7;color:#fff;font-weight:600;padding:4px 8px;border-radius:4px;"



                                title="Toggle Online / Offline Status"



                                onclick="toggleCameraStatus(${camera.id})"



                            >



                                TOGGLE



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



        if (!options.silent) toast("Login required.");



        return null;



    }







    const btn = document.querySelector(`.camera[data-camera-id="${cameraId}"] .device-ping-btn`) ||



                document.querySelector(`button[onclick*="pingCameraFromFrontend(${cameraId})"]`);



    if (btn) {



        btn.disabled = true;



        btn.innerHTML = "&#9203; Pinging...";



    }







    if (!options.silent) toast("Pinging CCTV...");







    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : "");







    try {







        const response =



            await fetch(



                `${apiBase}/api/cameras/${cameraId}/ping`,



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











        if (!response.ok || !data.success) {







            throw new Error(



                data.detail ||



                data.message ||



                "CCTV ping failed."



            );



        }











        console.log(



            "CCTV PING RESULT:",



            data



        );











        if (!options.silent) {



            const isOnline = String(data.status).toLowerCase() === "online";



            toast(`${isOnline ? "✅" : "❌"} ${data.camera_code || "Camera"} → ${data.status} • ${data.latency_ms ?? "-"} ms`);



        }







        let statusChanged = false;



        const index = backendCameras.findIndex(c => Number(c.id) === Number(cameraId));



        if (index >= 0) {



            const oldStatus = backendCameras[index].status;



            if (oldStatus && oldStatus !== 'Unknown' && oldStatus !== data.status) {



                statusChanged = true;



            }



            backendCameras[index].status = data.status;



            backendCameras[index].last_latency_ms = data.latency_ms;



            backendCameras[index].total_checks = data.total_checks;



            backendCameras[index].successful_checks = data.successful_checks;



            backendCameras[index].uptime_percent = data.uptime_percent;



            backendCameras[index].last_check = data.last_check;



            



            if (typeof renderBackendCameras === "function") {



                renderBackendCameras(backendCameras);



            }



        } else if (!options.silent) {



            await loadCamerasFromBackend();



        }







        if (statusChanged) {



            playSound(true);



            if (typeof loadAlerts === 'function') loadAlerts();



            if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            if (typeof loadDashboardStats === 'function') loadDashboardStats();



        }







        return data;







    } catch (error) {







        console.error(



            "CCTV PING ERROR:",



            error



        );







        if (!options.silent) toast("CCTV Ping: " + (error.message || "Host offline or unreachable"));



        return null;



    } finally {



        if (btn) {



            btn.disabled = false;



            btn.innerHTML = "PING";



        }



    }



}



window.pingCameraFromFrontend = pingCameraFromFrontend;











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



        button.innerHTML = "↻ Refreshing...";
        window._cameraRetry = 0;
        try {
            await loadCamerasFromBackend();
            if (typeof toast === "function") toast("✅ CCTV camera wall refreshed");
        } catch (e) {
            console.error("Refresh error:", e);
        } finally {
            button.disabled = false;
            button.innerHTML = oldHTML || "↻ Refresh";
        }



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







if (reportFromDate) {



    reportFromDate.addEventListener("change", function () {



        if (reportFromDate.value && reportToDate.value && reportFromDate.value <= reportToDate.value) {



            generateNMSReport();



        }



    });



}







if (reportToDate) {



    reportToDate.addEventListener("change", function () {



        if (reportFromDate.value && reportToDate.value && reportFromDate.value <= reportToDate.value) {



            generateNMSReport();



        }



    });



}







window.generateNMSReport = generateNMSReport;











async function generateNMSReport() {







    const from =



        reportFromDate ? reportFromDate.value : "";







    const to =



        reportToDate ? reportToDate.value : "";











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







    showReportMessage("Generating monitoring analytics from database for " + formatReadableDate(from) + " to " + formatReadableDate(to) + "...", "info");







    const token = localStorage.getItem("access_token");



    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ? window.APP_CONFIG.API_BASE_URL : "";



    const url = `${apiBase}/api/reports/analytics?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}&_t=${Date.now()}`;







    try {



        const resp = await fetch(url, {



            headers: token ? { "Authorization": `Bearer ${token}` } : {}



        });







        if (!resp.ok) {



            throw new Error(`Server returned HTTP ${resp.status}`);



        }







        const data = await resp.json();



        if (!data.success) {



            throw new Error(data.message || "Failed to load report analytics");



        }







        // Store analytics in memory



        window.currentReportAnalytics = data;







        // Render table



        renderAnalyticsTable(data);







        // Update summary cards



        updateAnalyticsSummary(data);







        const totalAssets = (data.summary && data.summary.total_assets) || 0;



        const uptime = (data.summary && data.summary.overall_availability_pct != null) ? data.summary.overall_availability_pct : "100.00";



        const eventsCount = (data.status_history ? data.status_history.length : 0);







        showReportMessage(



            `Report generated: ${totalAssets} monitored assets (${uptime}% availability, ${eventsCount} events in period).`,



            "success"



        );







        if (typeof toast === "function") {



            toast("Report generated successfully");



        }







    } catch (err) {



        console.warn("Analytics API failed, using cached fallback:", err);



        renderReportTable();



        updateReportSummary();



        showReportMessage(



            `Report generated (cached view) for ${formatReadableDate(from)} to ${formatReadableDate(to)}.`,



            "success"



        );



        if (typeof toast === "function") {



            toast("Report loaded (cached)");



        }



    }







}











function escapeHtml(str) {



    if (str == null) return "";



    return String(str)



        .replace(/&/g, "&amp;")



        .replace(/</g, "&lt;")



        .replace(/>/g, "&gt;")



        .replace(/"/g, "&quot;")



        .replace(/'/g, "&#039;");



}











/* -----------------------------------------



   REPORT TABLE - LIVE ANALYTICS



----------------------------------------- */







function renderAnalyticsTable(data) {







    const tbody =



        document.getElementById(



            "reportTableBody"



        );







    if (!tbody) {



        return;



    }







    tbody.innerHTML = "";







    const allAssets = [];







    // Devices



    if (data.devices && Array.isArray(data.devices)) {



        data.devices.forEach(d => {



            allAssets.push({



                id: d.code || d.id || "DEV",



                name: d.name || "Device",



                type: d.type || "Network Device",



                category: "Device",



                status: d.current_status || "Online",



                ip: d.ip || "N/A",



                uptime: (d.availability_pct != null ? d.availability_pct : (d.uptime_percent_db || "100.00")) + "%",



                lastChecked: d.last_status_change || d.last_observed || "Recent",



                onlineDuration: d.online_duration_readable || d.online_duration_hms || "00:00:00",



                offlineDuration: d.offline_duration_readable || d.offline_duration_hms || "00:00:00",



                coverageNote: d.coverage_note || ""



            });



        });



    }







    // CCTV Cameras



    if (data.cameras && Array.isArray(data.cameras)) {



        data.cameras.forEach(c => {



            allAssets.push({



                id: c.code || c.id || "CAM",



                name: c.name || "CCTV Camera",



                type: "CCTV Camera",



                category: "CCTV Camera",



                status: c.current_status || "Online",



                ip: c.ip || "N/A",



                uptime: (c.availability_pct != null ? c.availability_pct : "100.00") + "%",



                lastChecked: c.last_status_change || c.last_observed || "Recent",



                onlineDuration: c.online_duration_readable || c.online_duration_hms || "00:00:00",



                offlineDuration: c.offline_duration_readable || c.offline_duration_hms || "00:00:00",



                coverageNote: c.coverage_note || ""



            });



        });



    }







    // Desktops



    if (data.desktops && Array.isArray(data.desktops)) {



        data.desktops.forEach(d => {



            allAssets.push({



                id: d.code || d.id || "DSK",



                name: d.name || "Desktop",



                type: d.type || "Desktop Workstation",



                category: "Desktop",



                status: d.current_status || "Online",



                ip: d.ip || "N/A",



                uptime: (d.availability_pct != null ? d.availability_pct : "100.00") + "%",



                lastChecked: d.last_status_change || d.last_observed || "Recent",



                onlineDuration: d.online_duration_readable || d.online_duration_hms || "00:00:00",



                offlineDuration: d.offline_duration_readable || d.offline_duration_hms || "00:00:00",



                coverageNote: d.coverage_note || ""



            });



        });



    }







    if (allAssets.length === 0) {



        tbody.innerHTML = `



            <tr>



                <td colspan="7" style="text-align:center; padding:30px; color:#71859a;">



                    No monitored assets found for the selected date period



                </td>



            </tr>



        `;



        const recordCount = document.getElementById("reportRecordCount");



        if (recordCount) recordCount.textContent = "0 Records";



        return;



    }







    allAssets.forEach(function (device) {







        const row = document.createElement("tr");







        let statusClass = "report-status-online";



        if (device.status === "Offline") {



            statusClass = "report-status-offline";



        } else if (device.status === "Warning") {



            statusClass = "report-status-warning";



        }







        const tooltipTitle = `Online: ${device.onlineDuration} | Offline: ${device.offlineDuration}${device.coverageNote ? ' (' + device.coverageNote + ')' : ''}`;







        row.innerHTML = `



            <td><b>${escapeHtml(device.id)}</b></td>



            <td>${escapeHtml(device.name)}</td>



            <td>${escapeHtml(device.type)}</td>



            <td>${escapeHtml(device.ip)}</td>



            <td><span class="${statusClass}">${escapeHtml(device.status)}</span></td>



            <td title="${escapeHtml(tooltipTitle)}">${escapeHtml(device.uptime)}</td>



            <td><small>${escapeHtml(device.lastChecked)}</small></td>



        `;







        tbody.appendChild(row);







    });







    const recordCount = document.getElementById("reportRecordCount");



    if (recordCount) {



        const eventsCount = data.status_history ? data.status_history.length : 0;



        recordCount.textContent = `${allAssets.length} Assets (${eventsCount} Events)`;



    }







}











function updateAnalyticsSummary(data) {







    if (!data || !data.summary) return;







    const totalElement = document.getElementById("reportTotalDevices");



    const onlineElement = document.getElementById("reportOnlineDevices");



    const alertElement = document.getElementById("reportActiveAlerts") || document.getElementById("reportAlerts");



    const uptimeElement = document.getElementById("reportUptime");







    if (totalElement) totalElement.textContent = data.summary.total_assets;



    if (onlineElement) onlineElement.textContent = data.summary.online_count;



    if (alertElement) alertElement.textContent = data.summary.offline_count;



    if (uptimeElement) {



        const pct = data.summary.overall_availability_pct != null ? data.summary.overall_availability_pct : "100.00";



        uptimeElement.textContent = pct + "%";



    }







}











/* -----------------------------------------



   REPORT TABLE (FALLBACK)



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







            <td>${device.ip}</td>







            <td>



                <span class="${statusClass}">



                    ${device.status}



                </span>



            </td>







            <td>${device.uptime}</td>







            <td>${device.lastChecked}</td>







        `;











        tbody.appendChild(row);







    });







    const recordCount = document.getElementById("reportRecordCount");



    if (recordCount) recordCount.textContent = `${nmsReportData.length} Records`;







}











/* -----------------------------------------



   REPORT SUMMARY (FALLBACK)



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



            "reportActiveAlerts"



        ) ||



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







async function downloadCSVReport() {







    const from =



        reportFromDate ? reportFromDate.value : "";







    const to =



        reportToDate ? reportToDate.value : "";







    const apiBase =



        (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ? window.APP_CONFIG.API_BASE_URL : "";







    const token =



        localStorage.getItem("access_token");







    showReportMessage("Preparing detailed CSV export from server...", "info");



    if (typeof toast === "function") toast("Preparing CSV export...");







    try {



        const url = `${apiBase}/api/reports/export/csv?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}&_t=${Date.now()}`;



        const resp = await fetch(url, {



            headers: token ? { "Authorization": `Bearer ${token}` } : {}



        });







        if (!resp.ok) {



            throw new Error(`Export API HTTP error: ${resp.status}`);



        }







        const blob = await resp.blob();



        const downloadUrl = window.URL.createObjectURL(blob);



        const link = document.createElement("a");







        link.href = downloadUrl;



        const filenameRange = (from && to) ? `${from}_to_${to}` : "full";



        link.download = `Neo_Metaliks_Network_Report_${filenameRange}.csv`;







        document.body.appendChild(link);



        link.click();



        document.body.removeChild(link);







        window.URL.revokeObjectURL(downloadUrl);







        showReportMessage("Detailed CSV report downloaded successfully.", "success");



        if (typeof toast === "function") toast("CSV downloaded successfully");







    } catch (err) {



        console.warn("Server CSV export failed, falling back to client-side CSV:", err);



        downloadCSVReportFallback();



    }







}







function downloadCSVReportFallback() {







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







    showReportMessage("Baseline CSV report downloaded.", "success");



    if (typeof toast === "function") toast("CSV report downloaded");







}











// ===============================



// EXCEL DOWNLOAD



// ===============================







async function downloadExcelReport() {







    const from =



        reportFromDate ? reportFromDate.value : "";







    const to =



        reportToDate ? reportToDate.value : "";







    const apiBase =



        (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ? window.APP_CONFIG.API_BASE_URL : "";







    const token =



        localStorage.getItem("access_token");







    showReportMessage("Generating 5-sheet Excel workbook from server...", "info");



    if (typeof toast === "function") toast("Generating 5-sheet Excel report...");







    try {



        const url = `${apiBase}/api/reports/export/excel?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}&_t=${Date.now()}`;



        const resp = await fetch(url, {



            headers: token ? { "Authorization": `Bearer ${token}` } : {}



        });







        if (!resp.ok) {



            throw new Error(`Export API HTTP error: ${resp.status}`);



        }







        const blob = await resp.blob();



        const downloadUrl = window.URL.createObjectURL(blob);



        const link = document.createElement("a");







        link.href = downloadUrl;



        const filenameRange = (from && to) ? `${from}_to_${to}` : "full";



        link.download = `Neo_Metaliks_Network_Report_${filenameRange}.xlsx`;







        document.body.appendChild(link);



        link.click();



        document.body.removeChild(link);







        window.URL.revokeObjectURL(downloadUrl);







        showReportMessage("Excel workbook (5 sheets) downloaded successfully.", "success");



        if (typeof toast === "function") toast("Excel workbook downloaded");







    } catch (err) {



        console.warn("Server Excel export failed, falling back to SheetJS:", err);



        downloadExcelReportFallback();



    }







}







function downloadExcelReportFallback() {







    // Check SheetJS



    if (typeof XLSX === "undefined") {







        alert(



            "Excel library load হয়নি। CSV download ব্যবহার করুন অথবা internet connection check করুন."



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







    showReportMessage("Baseline Excel report downloaded.", "success");



    if (typeof toast === "function") toast("Excel report downloaded");







}











// ===============================



// ZIP (ALL CSVs) DOWNLOAD



// ===============================







async function downloadZipReport() {







    const from =



        reportFromDate ? reportFromDate.value : "";







    const to =



        reportToDate ? reportToDate.value : "";







    const apiBase =



        (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ? window.APP_CONFIG.API_BASE_URL : "";







    const token =



        localStorage.getItem("access_token");







    showReportMessage("Packaging multi-section CSV reports into ZIP...", "info");



    if (typeof toast === "function") toast("Creating ZIP bundle...");







    try {



        const url = `${apiBase}/api/reports/export/zip?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}&_t=${Date.now()}`;



        const resp = await fetch(url, {



            headers: token ? { "Authorization": `Bearer ${token}` } : {}



        });







        if (!resp.ok) {



            throw new Error(`Export API HTTP error: ${resp.status}`);



        }







        const blob = await resp.blob();



        const downloadUrl = window.URL.createObjectURL(blob);



        const link = document.createElement("a");







        link.href = downloadUrl;



        const filenameRange = (from && to) ? `${from}_to_${to}` : "full";



        link.download = `Neo_Metaliks_Network_Reports_CSV_Bundle_${filenameRange}.zip`;







        document.body.appendChild(link);



        link.click();



        document.body.removeChild(link);







        window.URL.revokeObjectURL(downloadUrl);







        showReportMessage("ZIP bundle containing all CSV reports downloaded successfully.", "success");



        if (typeof toast === "function") toast("ZIP bundle downloaded");







    } catch (err) {



        console.error("ZIP download failed:", err);



        showReportMessage("Failed to download ZIP: " + err.message, "error");



    }







}











// ===============================



// BUTTON CONNECTION & EXPORTS



// ===============================







window.downloadCSVReport = downloadCSVReport;



window.downloadExcelReport = downloadExcelReport;



window.downloadZipReport = downloadZipReport;







function initReportButtons() {



    const csvButton = document.getElementById("downloadCSV");



    const excelButton = document.getElementById("downloadExcel");



    const zipButton = document.getElementById("downloadZIP");







    if (csvButton && !csvButton._hasReportListener) {



        csvButton._hasReportListener = true;



        csvButton.addEventListener("click", function (event) {



            event.preventDefault();



            downloadCSVReport();



        });



    }







    if (excelButton && !excelButton._hasReportListener) {



        excelButton._hasReportListener = true;



        excelButton.addEventListener("click", function (event) {



            event.preventDefault();



            downloadExcelReport();



        });



    }







    if (zipButton && !zipButton._hasReportListener) {



        zipButton._hasReportListener = true;



        zipButton.addEventListener("click", function (event) {



            event.preventDefault();



            downloadZipReport();



        });



    }



}







if (document.readyState === "loading") {



    document.addEventListener("DOMContentLoaded", initReportButtons);



} else {



    initReportButtons();



}







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







NMS_API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined) ? window.APP_CONFIG.API_BASE_URL : "";



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







    const btn = document.querySelector(`button[onclick*="pingDeviceFromFrontend(${deviceId})"]`);



    if (btn) {



        btn.disabled = true;



        btn.innerHTML = "&#9203; Pinging...";



    }







    if (!options.silent) toast("Pinging device...");







    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : "");







    try {



        const response = await fetch(



            `${apiBase}/api/devices/${deviceId}/ping`,



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







        let statusChanged = false;



        const index = backendDevices.findIndex(



            device => Number(device.id) === Number(deviceId)



        );







        if (index >= 0) {



            const oldStatus = backendDevices[index].status;



            if (oldStatus && oldStatus !== 'Unknown' && oldStatus !== data.status) {



                statusChanged = true;



            }



            backendDevices[index].status = data.status;



            backendDevices[index].last_latency_ms = data.latency_ms;



            backendDevices[index].last_check = data.last_check;



            renderBackendDevices(backendDevices);



        }







        if (statusChanged) {



            playSound(true);



            if (typeof loadAlerts === 'function') loadAlerts();



            if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            if (typeof loadDashboardStats === 'function') loadDashboardStats();



        }







        console.log("Ping Result:", data);







        if (!options.silent) {



            const isOnline = String(data.status).toLowerCase() === "online";



            const latencyText =



                data.latency_ms !== null && data.latency_ms !== undefined



                    ? ` • ${data.latency_ms} ms`



                    : "";



            toast(`${isOnline ? "✅" : "❌"} ${data.device_name || data.device_code} → ${data.status}${latencyText}`);



        }







        return data;







    } catch (error) {



        console.error("Ping Error:", error);



        if (!options.silent) toast("Ping error: " + error.message);



        return null;



    } finally {



        if (btn) {



            btn.disabled = false;



            btn.innerHTML = "PING";



        }



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



    if (!selectedDesktopMonitoringLocation) {



        selectedDesktopMonitoringLocation = "All Locations";



    }







    try {







        const response = await fetch(



            `${NMS_API_BASE}/api/desktops/monitoring`,



            {



                method: 'PUT',



                headers: {



                    'Content-Type': 'application/json',



                    'Authorization': `Bearer ${token}`



                },



                body: JSON.stringify({



                    enabled: newState,



                    selected_location: newState ? selectedDesktopMonitoringLocation : null



                })



            }



        );







        const data = await response.json();







        if (!response.ok || !data.success) {



            throw new Error(



                data.detail ||



                data.message ||



                'Desktop monitoring update failed.'



            );



        }







        desktopMonitoringEnabled = newState;



        localStorage.setItem(



            'desktopMonitoringEnabled',



            String(newState)



        );







        updateDesktopMonitoringUI();







        if (newState) {



            toast(`🟢 Desktop monitoring ON: ${selectedDesktopMonitoringLocation}`);



            triggerAutoPingAllDesktops(false);



        } else {



            toast("🔴 Desktop monitoring OFF");



            renderDesktopRows([]);



        }







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







        desktopMonitoringEnabled = !newState;



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



                (!selectedLocation || selectedLocation === 'all' || selectedLocation === 'all locations')



                    ? desktopData



                    : desktopData.filter(function (desktop) {



                        return String(desktop.location || '')



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







    const rawLocations = getDesktopLocations();



    let locations = ["All Locations", ...rawLocations.filter(loc => loc.toLowerCase() !== "all locations")];







    if (query) {



        locations = locations.filter(function (location) {



            return location.toLowerCase().includes(query);



        });



    }







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



                    (selectedDesktopMonitoringLocation &&



                     selectedDesktopMonitoringLocation.toLowerCase() === location.toLowerCase()) ||



                    (!selectedDesktopMonitoringLocation && location === "All Locations");







                return `



                    <button



                        type="button"



                        class="desktop-location-option"



                        data-location="${location}"



                        style="



                            width:100%;



                            display:flex;



                            align-items:center;



                            justify-content:space-between;



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



                        <span>📍 ${location}</span>



                        ${isSelected ? '<span style="color:#38bdf8; font-size:12px; font-weight:600;">✓ Active</span>' : ''}



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



        selectedDesktopMonitoringLocation = "All Locations";



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







        selectedDesktopMonitoringLocation =



            selectedLocation;







        localStorage.setItem(



            "selectedDesktopMonitoringLocation",



            selectedLocation



        );







        const button =



            document.getElementById(



                "desktopLocationBtn"



            );







        if (button) {







            button.textContent =



                "📍 " +



                selectedLocation;



        }







        closeDesktopLocationModal();







        if (desktopMonitoringEnabled) {



            toast(`📍 Desktop monitoring active for: ${selectedLocation}`);



            triggerAutoPingAllDesktops(false);



        } else {



            toast("🔴 Desktop monitoring is currently OFF");



            const loc = String(selectedLocation).trim().toLowerCase();



            const filtered = (!loc || loc === 'all' || loc === 'all locations')



                ? desktopData



                : desktopData.filter(d => String(d.location || '').trim().toLowerCase() === loc);



            renderDesktopRows(filtered);



        }







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







        const soundToggle = document.getElementById("soundNotification");



        soundToggle?.addEventListener("change", function () {



            let settings = {};



            try { settings = JSON.parse(localStorage.getItem("nmsSettings") || "{}"); } catch (e) {}



            settings.soundNotification = this.checked;



            localStorage.setItem("nmsSettings", JSON.stringify(settings));







            if (this.checked) {



                toast("🔊 Sound notification enabled");



                playSound(true);



            } else {



                toast("🔇 Sound notification muted");



            }







            if (typeof syncGlobalSettingsToBackend === 'function') {



                syncGlobalSettingsToBackend(settings);



            }



        });







        const alertToggle = document.getElementById("alert");



        alertToggle?.addEventListener("change", function () {



            let settings = {};



            try { settings = JSON.parse(localStorage.getItem("nmsSettings") || "{}"); } catch (e) {}



            settings.alert = this.checked;



            localStorage.setItem("nmsSettings", JSON.stringify(settings));



            toast(this.checked ? "🚨 Alert system enabled" : "⚠️ Alert system disabled");







            if (typeof syncGlobalSettingsToBackend === 'function') {



                syncGlobalSettingsToBackend(settings);



            }



        });



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



                



                let prevAlertCount = window.lastKnownAlertCount !== undefined ? window.lastKnownAlertCount : data.active_alerts;



                if (data.active_alerts > prevAlertCount && enableAlerts && isSoundNotificationEnabled()) {



                    if (typeof toast === "function") toast("⚠️ New system alert detected!");



                    if (typeof playSound === "function") playSound(true);



                }



                window.lastKnownAlertCount = data.active_alerts;







                const elTotal = document.getElementById('dashTotal');



                const elOnline = document.getElementById('dashOnline');



                const elAlerts = document.getElementById('dashAlerts');







                if (elTotal) {



                    elTotal.textContent = data.total_devices;



                    const elTotalSub = elTotal.parentElement?.querySelector('span');



                    if (elTotalSub) {



                        const offlineCount = (data.total_devices - data.online_devices);



                        elTotalSub.textContent = offlineCount > 0 ? `▲ ${offlineCount} offline today` : `▲ All devices online`;



                    }



                }



                if (elOnline) {



                    elOnline.textContent = data.online_devices;



                    const elOnlineSub = elOnline.parentElement?.querySelector('span');



                    if (elOnlineSub) {



                        const availability = data.total_devices > 0 ? ((data.online_devices / data.total_devices) * 100).toFixed(1) : 100;



                        elOnlineSub.textContent = `${availability}% availability`;



                    }



                }



                if (elAlerts) {



                    elAlerts.textContent = data.active_alerts;



                    const elAlertsSub = elAlerts.parentElement?.querySelector('span');



                    if (elAlertsSub) {



                        elAlertsSub.textContent = data.active_alerts > 0 ? `${data.active_alerts} needs attention` : 'All systems normal';



                        elAlertsSub.className = data.active_alerts > 0 ? 'negative' : 'positive';



                    }



                }



                const sbAlerts = document.getElementById('sidebarAlertsCount');



                const hrAlerts = document.getElementById('headerAlertsCount');



                if (sbAlerts) sbAlerts.textContent = data.active_alerts;



                if (hrAlerts) hrAlerts.textContent = data.active_alerts;



                if (typeof updateDashboardGreeting === 'function') updateDashboardGreeting();



                



                const hl = document.getElementById('dashHealthList');



                if (hl && data.breakdown) {

                    // Update CCTV summary numbers immediately from dashboard stats

                    if (data.breakdown.cameras) {

                        const bc = data.breakdown.cameras;

                        const elCctvTot = document.getElementById("cctvTotalCount");

                        const elCctvOn = document.getElementById("cctvOnlineCount");

                        const elCctvOff = document.getElementById("cctvOfflineCount");

                        const elCctvIss = document.getElementById("cctvIssueCount");

                        const elCctvAv = document.getElementById("cctvAvailability");

                        const elCctvAvB = document.getElementById("cctvAvailabilityBar");

                        const cOffCount = (bc.total - bc.online);

                        const cAvPct = bc.total > 0 ? ((bc.online / bc.total) * 100).toFixed(1) : "0.0";

                        if (elCctvTot && (!window.backendCameras || !window.backendCameras.length)) elCctvTot.textContent = bc.total;

                        if (elCctvOn && (!window.backendCameras || !window.backendCameras.length)) elCctvOn.textContent = bc.online;

                        if (elCctvOff && (!window.backendCameras || !window.backendCameras.length)) elCctvOff.textContent = cOffCount;

                        if (elCctvIss && (!window.backendCameras || !window.backendCameras.length)) elCctvIss.textContent = cOffCount;

                        if (elCctvAv && (!window.backendCameras || !window.backendCameras.length)) elCctvAv.textContent = cAvPct + "%";

                        if (elCctvAvB && (!window.backendCameras || !window.backendCameras.length)) elCctvAvB.style.width = cAvPct + "%";

                    }



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



                    alList.innerHTML = '';



                    const activeAlerts = (alData.alerts || []).filter(a => a.status === 'New' || a.status === 'Acknowledged');



                    const alerts = activeAlerts.slice(0, 4);



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



                                    <div><b>${a.message}</b><small>${a.source_type} ${a.source_name} · ${time} · ${a.status.toUpperCase()}</small></div>



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











window._alertViewMode = window._alertViewMode || 'active';







window.setAlertView = function(mode) {



    window._alertViewMode = mode;



    const tabActive = document.getElementById('alertTabActive');



    const tabAll = document.getElementById('alertTabAll');



    if (tabActive) {



        tabActive.style.borderBottom = mode === 'active' ? '2px solid #51b7f7' : '2px solid transparent';



        tabActive.style.color = mode === 'active' ? '#51b7f7' : '#64798e';



    }



    if (tabAll) {



        tabAll.style.borderBottom = mode === 'all' ? '2px solid #51b7f7' : '2px solid transparent';



        tabAll.style.color = mode === 'all' ? '#51b7f7' : '#64798e';



    }



    loadAlerts();



};







async function loadAlerts() {



    try {



        const token = localStorage.getItem('access_token');



        if (!token) return;



        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        const res = await fetch(`${apiBase}/api/alerts?_t=${Date.now()}`, { headers: { 'Authorization': 'Bearer ' + token } });



        if (res.ok) {



            const data = await res.json();



            if (data.success && Array.isArray(data.alerts)) {



                // Active alerts are those currently unresolved (New or Acknowledged)



                const activeAlerts = data.alerts.filter(a => a.status === 'New' || a.status === 'Acknowledged');



                const newAlerts = data.alerts.filter(a => a.status === 'New');







                // Synchronize sidebar, header, dashboard, and report badge counters



                const sbAlerts = document.getElementById('sidebarAlertsCount');



                const hrAlerts = document.getElementById('headerAlertsCount');



                const dashAlerts = document.getElementById('dashAlerts');



                const repAlerts = document.getElementById('reportActiveAlerts');



                if (sbAlerts) sbAlerts.textContent = activeAlerts.length;



                if (hrAlerts) hrAlerts.textContent = activeAlerts.length;



                if (dashAlerts) dashAlerts.textContent = activeAlerts.length;



                if (repAlerts) repAlerts.textContent = activeAlerts.length;







                // Update tab counters



                const activeBadge = document.getElementById('alertActiveBadge');



                const allBadge = document.getElementById('alertAllBadge');



                if (activeBadge) activeBadge.textContent = activeAlerts.length;



                if (allBadge) allBadge.textContent = data.alerts.length;







                const alertList = document.querySelector('.incident-list');



                if (!alertList) return;



                alertList.innerHTML = '';



                



                const currentMode = window._alertViewMode || 'active';



                const displayAlerts = currentMode === 'active' ? activeAlerts : data.alerts;







                if (displayAlerts.length === 0) {



                    if (currentMode === 'active') {



                        alertList.innerHTML = `



                            <div style="padding:48px 20px;text-align:center;color:#688097;">



                                <div style="font-size:42px;color:#10b981;margin-bottom:12px;line-height:1;">✓</div>



                                <b style="font-size:18px;color:#eff5fb;display:block;margin-bottom:8px;">No Active Alerts</b>



                                <p style="font-size:13px;color:#64798e;margin:0;">All infrastructure incidents have been resolved & cleared. Everything is healthy and operational.</p>



                            </div>



                        `;



                    } else {



                        alertList.innerHTML = `



                            <div style="padding:48px 20px;text-align:center;color:#688097;">



                                <div style="font-size:36px;color:#3b82f6;margin-bottom:12px;line-height:1;">ℹ</div>



                                <b style="font-size:16px;color:#eff5fb;display:block;margin-bottom:6px;">No Alert History</b>



                                <p style="font-size:13px;color:#64798e;margin:0;">No previous alert incidents recorded in database.</p>



                            </div>



                        `;



                    }



                    return;



                }



                



                displayAlerts.forEach(a => {



                    const isNew = a.status === 'New';



                    const isAck = a.status === 'Acknowledged';



                    const cssBg = a.severity === 'Critical' ? 'critical-bg' : (a.severity === 'Warning' ? 'warning-bg' : 'info-bg');



                    const cssBorder = a.severity === 'Critical' ? 'critical-border' : (a.severity === 'Warning' ? 'warning-border' : 'info-border');



                    const statusBadgeClass = isNew ? (a.severity === 'Critical' ? 'critical-bg' : 'warning-bg') : (isAck ? 'warning-bg' : 'info-bg');



                    const statusLabel = isNew ? '● ACTIVE' : (a.status || 'LOGGED').toUpperCase();



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



                    let loc = "Plant Infrastructure";



                    if (typeof backendDevices !== 'undefined') {



                        const dev = backendDevices.find(d => d.device_code === a.source_name);



                        if (dev && dev.location) loc = dev.location;



                    }



                    if (loc === "Plant Infrastructure" && typeof backendCameras !== 'undefined') {



                        const cam = backendCameras.find(c => c.camera_code === a.source_name);



                        if (cam && cam.location) loc = cam.location;



                    }



                    if (loc === "Plant Infrastructure" && typeof desktopData !== 'undefined') {



                        const desk = desktopData.find(d => d.id === a.source_name);



                        if (desk && desk.location) loc = desk.location;



                    }







                    const timeStr = createdDate.toLocaleTimeString();



                    const detailsStr = loc + ' &bull; Detected ' + timeAgo + ' &bull; Logged at ' + timeStr;







                    let cleanMsg = a.message;



                    



                    alertList.innerHTML += '<div class="incident ' + cssBorder + '" style="' + (isNew ? 'box-shadow: 0 0 12px rgba(239,68,68,0.25); border-left-width: 4px;' : 'opacity:0.9;') + '">' +



                        '<div class="severity ' + cssBg + '">' + a.severity.toUpperCase() + '</div>' +



                        '<div style="flex:1;"><h3 style="margin-bottom:5px;">' + cleanMsg + '</h3><p style="font-size:12px; color:#a2b5cd;">' + detailsStr + '</p></div>' +



                        '<div class="severity ' + statusBadgeClass + '" style="font-weight:700;">' + statusLabel + '</div>' +



                        '</div>';



                });



            }



        }



    } catch (err) { }



}







window.ackAlerts = async function () {



    try {



        const token = localStorage.getItem('access_token');



        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        



        // Immediate optimistic clearing across ALL UI locations



        const sbAlerts = document.getElementById('sidebarAlertsCount');



        const hrAlerts = document.getElementById('headerAlertsCount');



        const dashAlerts = document.getElementById('dashAlerts');



        const repAlerts = document.getElementById('reportActiveAlerts');



        const actBadge = document.getElementById('alertActiveBadge');



        if (sbAlerts) sbAlerts.textContent = '0';



        if (hrAlerts) hrAlerts.textContent = '0';



        if (dashAlerts) dashAlerts.textContent = '0';



        if (repAlerts) repAlerts.textContent = '0';



        if (actBadge) actBadge.textContent = '0';







        const dashSub = document.querySelector('#dashAlerts + span, #dashAlerts ~ span');



        if (dashSub) {



            dashSub.textContent = 'All systems normal';



            dashSub.className = 'positive';



        }







        const alList = document.getElementById('dashAlertsList');



        if (alList) {



            alList.innerHTML = '<div style="padding:20px;text-align:center;color:#688097">No recent alerts. Everything is healthy.</div>';



        }







        const alertList = document.querySelector('.incident-list');



        if (alertList && (!window._alertViewMode || window._alertViewMode === 'active')) {



            alertList.innerHTML = `



                <div style="padding:48px 20px;text-align:center;color:#688097;">



                    <div style="font-size:42px;color:#10b981;margin-bottom:12px;line-height:1;">✓</div>



                    <b style="font-size:18px;color:#eff5fb;display:block;margin-bottom:8px;">No Active Alerts</b>



                    <p style="font-size:13px;color:#64798e;margin:0;">All infrastructure incidents have been acknowledged & cleared. Everything is healthy and operational.</p>



                </div>



            `;



        }







        const res = await fetch(`${apiBase}/api/alerts/acknowledge`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });



        if (res.ok) {



            toast('✓ All alerts acknowledged & cleared');



            await loadAlerts();



            if (typeof loadDashboardStats === 'function') loadDashboardStats();



            if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



        }



    } catch (err) {



        console.error("ackAlerts error:", err);



    }



};







window.clearAllAlerts = async function () {



    try {



        const token = localStorage.getItem('access_token');



        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        



        // Immediate optimistic clearing across all locations



        const sbAlerts = document.getElementById('sidebarAlertsCount');



        const hrAlerts = document.getElementById('headerAlertsCount');



        const dashAlerts = document.getElementById('dashAlerts');



        const repAlerts = document.getElementById('reportActiveAlerts');



        const actBadge = document.getElementById('alertActiveBadge');



        const allBadge = document.getElementById('alertAllBadge');



        if (sbAlerts) sbAlerts.textContent = '0';



        if (hrAlerts) hrAlerts.textContent = '0';



        if (dashAlerts) dashAlerts.textContent = '0';



        if (repAlerts) repAlerts.textContent = '0';



        if (actBadge) actBadge.textContent = '0';



        if (allBadge) allBadge.textContent = '0';







        const alList = document.getElementById('dashAlertsList');



        if (alList) {



            alList.innerHTML = '<div style="padding:20px;text-align:center;color:#688097">No recent alerts. Everything is healthy.</div>';



        }







        const alertList = document.querySelector('.incident-list');



        if (alertList) {



            alertList.innerHTML = `



                <div style="padding:48px 20px;text-align:center;color:#688097;">



                    <div style="font-size:42px;color:#10b981;margin-bottom:12px;line-height:1;">✓</div>



                    <b style="font-size:18px;color:#eff5fb;display:block;margin-bottom:8px;">No Active Alerts</b>



                    <p style="font-size:13px;color:#64798e;margin:0;">All alert records have been completely cleared.</p>



                </div>



            `;



        }







        const res = await fetch(`${apiBase}/api/alerts/clear`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });



        if (res.ok) {



            toast('✓ All alerts cleared successfully');



            await loadAlerts();



            if (typeof loadDashboardStats === 'function') loadDashboardStats();



            if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



        }



    } catch (err) {



        console.error("clearAllAlerts error:", err);



    }



};







// Reports Unified Linkage



window.generateReport = function () {



    return generateNMSReport();



};







document.addEventListener('DOMContentLoaded', () => {



    setTimeout(loadNetworkMap, 1200);



    setTimeout(loadAlerts, 1800);



});











// =========================================================



// REAL-TIME AUTO-PING & COUNTDOWN ENGINE



// Supports: Devices, CCTV Cameras, Desktops



// Dynamic Settings Interval, Live Visual Countdown, Batch Ping Execution



// =========================================================







let autoPingEngineTimerId = null;



let devicePingCountdown = 10;



let cameraPingCountdown = 30;



let desktopPingCountdown = 10;



let isPingingDevices = false;



let isPingingCameras = false;



let isPingingDesktops = false;







function getAutoPingIntervals() {



    let s = {};



    try { s = JSON.parse(localStorage.getItem('nmsSettings') || '{}'); } catch(e){}



    return {



        networkEnabled: s.networkMonitoring !== false,



        networkInterval: Math.max(3, parseInt(s.networkInterval, 10) || 10),



        cameraEnabled: s.cameraMonitoring !== false,



        cameraInterval: Math.max(3, parseInt(s.cameraInterval, 10) || 30)



    };



}







function resetAutoPingTimers() {



    const cfg = getAutoPingIntervals();



    devicePingCountdown = cfg.networkInterval;



    cameraPingCountdown = cfg.cameraInterval;



    updateAutoPingBannerUI();



}



window.resetAutoPingTimers = resetAutoPingTimers;







function updateAutoPingBannerUI() {



    const cfg = getAutoPingIntervals();







    // 1. DEVICES BANNER



    const devBadge = document.getElementById('devicesIntervalBadge');



    const devCount = document.getElementById('devicesCountdownBadge');



    const devDot = document.getElementById('devicesPulseDot');



    if (devBadge) devBadge.innerHTML = `Interval: <b>${formatIntervalDisplay(cfg.networkInterval)}</b>`;



    if (devCount) {



        if (!cfg.networkEnabled) {



            devCount.className = 'auto-ping-badge';



            devCount.innerHTML = '⏸ Paused (Disabled in Settings)';



            if (devDot) devDot.style.background = '#64748b';



        } else if (!isPingingDevices) {



            devCount.className = 'auto-ping-badge';



            devCount.innerHTML = `Next ping in <b id="devicesCountdownText">${devicePingCountdown}s</b>`;



            if (devDot) devDot.style.background = '#10b981';



        }



    }







    // 2. CAMERAS BANNER



    const camBadge = document.getElementById('camerasIntervalBadge');



    const camCount = document.getElementById('camerasCountdownBadge');



    const camDot = document.getElementById('camerasPulseDot');



    if (camBadge) camBadge.innerHTML = `Interval: <b>${formatIntervalDisplay(cfg.cameraInterval)}</b>`;



    if (camCount) {



        if (!cfg.cameraEnabled) {



            camCount.className = 'auto-ping-badge';



            camCount.innerHTML = '⏸ Paused (Disabled in Settings)';



            if (camDot) camDot.style.background = '#64748b';



        } else if (!isPingingCameras) {



            camCount.className = 'auto-ping-badge';



            camCount.innerHTML = `Next ping in <b id="camerasCountdownText">${cameraPingCountdown}s</b>`;



            if (camDot) camDot.style.background = '#10b981';



        }



    }



}







// BATCH PING DEVICES



async function triggerAutoPingAllDevices(isManual = false) {



    if (isPingingDevices) return;



    const token = localStorage.getItem('access_token');



    if (!token) return;







    isPingingDevices = true;



    const countBadge = document.getElementById('devicesCountdownBadge');



    const btn = document.getElementById('triggerDevicesPingBtn');



    if (countBadge) {



        countBadge.className = 'auto-ping-badge is-pinging';



        countBadge.innerHTML = '⚡ Pinging all devices...';



    }



    if (btn) btn.disabled = true;







    try {



        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        const res = await fetch(`${apiBase}/api/devices/ping-all`, {



            method: 'POST',



            headers: {



                'Authorization': `Bearer ${token}`



            }



        });



        const data = await res.json().catch(() => ({}));



        if (res.ok && data.success && Array.isArray(data.devices)) {



            const prevStatusMap = new Map((window.backendDevices || []).map(d => [d.device_code || d.id, d.status]));



            let transitionOccurred = false;







            for (const d of data.devices) {



                const key = d.device_code || d.id;



                const oldSt = prevStatusMap.get(key);



                if (oldSt && oldSt !== 'Unknown' && oldSt !== d.status) {



                    transitionOccurred = true;



                    const icon = d.status === 'Online' ? '✅' : '🚨';



                    toast(`${icon} Device ${d.device_code} (${d.device_name || 'Switch'}) is now ${d.status}`);



                }



            }







            window.backendDevices = data.devices;



            if (typeof renderBackendDevices === 'function') {



                renderBackendDevices(window.backendDevices);



            }



            if (typeof loadDashboardStats === 'function') {



                loadDashboardStats();



            }







            if (transitionOccurred) {



                playSound(true);



                if (typeof loadAlerts === 'function') loadAlerts();



                if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            }







            const nowTime = new Date().toLocaleTimeString();



            const lastSync = document.getElementById('devicesLastSyncText');



            if (lastSync) lastSync.textContent = `✓ Synced at ${nowTime}`;



            if (isManual) toast(`✓ All ${data.devices.length} devices pinged & refreshed`);



        }



    } catch (err) {



        console.warn('Devices auto-ping batch error:', err);



    } finally {



        isPingingDevices = false;



        if (btn) btn.disabled = false;



        const cfg = getAutoPingIntervals();



        devicePingCountdown = cfg.networkInterval;



        updateAutoPingBannerUI();



    }



}



window.triggerAutoPingAllDevices = triggerAutoPingAllDevices;







// BATCH PING CAMERAS



async function triggerAutoPingAllCameras(isManual = false) {



    if (isPingingCameras) return;



    const token = localStorage.getItem('access_token');



    if (!token) return;







    isPingingCameras = true;



    const countBadge = document.getElementById('camerasCountdownBadge');



    const btn = document.getElementById('triggerCamerasPingBtn');



    if (countBadge) {



        countBadge.className = 'auto-ping-badge is-pinging';



        countBadge.innerHTML = '⚡ Pinging all CCTV...';



    }



    if (btn) btn.disabled = true;







    try {



        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        const res = await fetch(`${apiBase}/api/cameras/ping-all`, {



            method: 'POST',



            headers: {



                'Authorization': `Bearer ${token}`



            }



        });



        const data = await res.json().catch(() => ({}));



        if (res.ok && data.success && Array.isArray(data.cameras)) {



            const prevStatusMap = new Map((window.backendCameras || []).map(c => [c.camera_code || c.id, c.status]));



            let transitionOccurred = false;







            for (const c of data.cameras) {



                const key = c.camera_code || c.id;



                const oldSt = prevStatusMap.get(key);



                if (oldSt && oldSt !== 'Unknown' && oldSt !== c.status) {



                    transitionOccurred = true;



                    const icon = c.status === 'Online' ? '✅' : '🚨';



                    toast(`${icon} CCTV ${c.camera_code} (${c.location || c.camera_name || 'Camera'}) is now ${c.status}`);



                }



            }







            window.backendCameras = data.cameras;



            if (typeof renderBackendCameras === 'function') {



                renderBackendCameras(window.backendCameras);



            }



            if (typeof updateCameraDashboardStats === 'function') {



                updateCameraDashboardStats(window.backendCameras);



            }



            if (typeof loadDashboardStats === 'function') {



                loadDashboardStats();



            }







            if (transitionOccurred) {



                playSound(true);



                if (typeof loadAlerts === 'function') loadAlerts();



                if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            }







            const nowTime = new Date().toLocaleTimeString();



            const lastSync = document.getElementById('camerasLastSyncText');



            if (lastSync) lastSync.textContent = `✓ Synced at ${nowTime}`;



            if (isManual) toast(`✓ All ${data.cameras.length} CCTV cameras pinged & refreshed`);



        }



    } catch (err) {



        console.warn('Cameras auto-ping batch error:', err);



    } finally {



        isPingingCameras = false;



        if (btn) btn.disabled = false;



        const cfg = getAutoPingIntervals();



        cameraPingCountdown = cfg.cameraInterval;



        updateAutoPingBannerUI();



    }



}



window.triggerAutoPingAllCameras = triggerAutoPingAllCameras;







// BATCH PING DESKTOPS



async function triggerAutoPingAllDesktops(isManual = false) {



    if (isPingingDesktops) return;



    const token = localStorage.getItem('access_token');



    if (!token) return;







    isPingingDesktops = true;



    const countBadge = document.getElementById('desktopsCountdownBadge');



    const btn = document.getElementById('triggerDesktopsPingBtn');



    if (countBadge) {



        countBadge.className = 'auto-ping-badge is-pinging';



        countBadge.innerHTML = '⚡ Pinging all desktops...';



    }



    if (btn) btn.disabled = true;







    try {



        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



        const res = await fetch(`${apiBase}/api/desktops/ping-all`, {



            method: 'POST',



            headers: {



                'Authorization': `Bearer ${token}`



            }



        });



        const data = await res.json().catch(() => ({}));



        if (res.ok && data.success && Array.isArray(data.desktops)) {



            const prevStatusMap = new Map((window.desktopData || []).map(d => [d.id || d.backendId, d.status]));



            let transitionOccurred = false;







            for (const d of data.desktops) {



                const key = d.desktop_code || d.id;



                const oldSt = prevStatusMap.get(key) || prevStatusMap.get(Number(d.id));



                if (oldSt && oldSt !== 'Unknown' && oldSt !== d.status) {



                    transitionOccurred = true;



                    const icon = d.status === 'Online' ? '✅' : '🚨';



                    toast(`${icon} Desktop ${d.desktop_code} (${d.department || 'Workstation'}) is now ${d.status}`);



                }



            }







            if (transitionOccurred) {



                playSound(true);



                if (typeof loadAlerts === 'function') loadAlerts();



                if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            }







            window.desktopData = data.desktops.map(desktop => ({



                backendId: Number(desktop.id),



                id: desktop.desktop_code || '',



                department: desktop.department || '',



                location: desktop.location || '',



                ip: desktop.ip_address || '',



                os: desktop.operating_system || '',



                cpu: `${Number(desktop.cpu_usage ?? 0)}%`,



                ram: `${Number(desktop.ram_usage ?? 0)}%`,



                status: desktop.status || 'Unknown',



                monitoring_enabled: desktop.monitoring_enabled,



                monitoring_interval: desktop.monitoring_interval,



                last_check: desktop.last_check,



                last_latency_ms: desktop.last_latency_ms,



                total_checks: desktop.total_checks,



                successful_checks: desktop.successful_checks,



                uptime_percent: desktop.uptime_percent



            }));







            // Filter desktop table according to location if specific location is selected



            const loc = String(selectedDesktopMonitoringLocation || '').trim().toLowerCase();



            let displayList = window.desktopData;



            if (desktopMonitoringEnabled && loc && loc !== 'all' && loc !== 'all locations') {



                displayList = window.desktopData.filter(d => String(d.location || '').trim().toLowerCase() === loc);



            }







            if (typeof renderDesktopRows === 'function') {



                renderDesktopRows(displayList);



            }



            if (typeof updateDesktopStats === 'function') {



                updateDesktopStats();



            }







            if (isManual) toast(`✓ All ${data.desktops.length} desktops pinged & refreshed`);



        }



    } catch (err) {



        console.warn('Desktops auto-ping batch error:', err);



    } finally {



        isPingingDesktops = false;



        if (btn) btn.disabled = false;



    }



}



window.triggerAutoPingAllDesktops = triggerAutoPingAllDesktops;







// MAIN TICKER (RUNS EVERY 1 SECOND)



function startAutoMonitor() {



    if (autoPingEngineTimerId) clearInterval(autoPingEngineTimerId);



    resetAutoPingTimers();







    let globalTick = 0;



    autoPingEngineTimerId = setInterval(() => {



        const token = localStorage.getItem('access_token');



        if (!token) return;







        globalTick++;



        const cfg = getAutoPingIntervals();







        // 1. Tick devices (using configured network interval)



        if (cfg.networkEnabled) {



            devicePingCountdown--;



            if (devicePingCountdown <= 0) {



                triggerAutoPingAllDevices(false);



            }



        }







        // 2. Tick cameras (using configured camera interval)



        if (cfg.cameraEnabled) {



            cameraPingCountdown--;



            if (cameraPingCountdown <= 0) {



                triggerAutoPingAllCameras(false);



            }



        }







        // 3. Desktop monitoring: Controlled ONLY via "Monitor Location" modal



        // If desktop monitoring is ON, background ping runs every 10s quietly for monitored desktops



        if (desktopMonitoringEnabled && globalTick % 10 === 0) {



            triggerAutoPingAllDesktops(false);



        }







        // 4. Update banner visual labels & countdown numbers for devices and cameras



        updateAutoPingBannerUI();







        // 5. Global dashboard stats and automatic alert monitoring with sound chime (runs every 4s)



        if (globalTick % 4 === 0) {



            if (typeof loadDashboardStats === 'function') loadDashboardStats();



            if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



            const alertsPage = document.getElementById('alerts');



            if (alertsPage && alertsPage.classList.contains('active')) {



                if (typeof loadAlerts === 'function') loadAlerts();



            }



            const reportsPage = document.getElementById('reports');



            if (reportsPage && reportsPage.classList.contains('active')) {



                if (typeof generateNMSReport === 'function') generateNMSReport();



            }



        }



    }, 1000);



}



window.startAutoMonitor = startAutoMonitor;







let _seenAlertIds = null;







async function checkGlobalAlertsWithSound() {







    const token = localStorage.getItem('access_token');







    if (!token) return;















    try {







        let soundEnabled = true;







        try {







            const s = JSON.parse(localStorage.getItem('nmsSettings') || '{}');







            if (s.soundNotification === false || s.alert === false) soundEnabled = false;







        } catch(e){}















        const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');







        const res = await fetch(`${apiBase}/api/alerts?_t=${Date.now()}`, {







            headers: { 'Authorization': 'Bearer ' + token }







        });







        if (!res.ok) return;















        const data = await res.json().catch(() => ({}));







        if (!data.success || !Array.isArray(data.alerts)) return;















        const currentAlerts = data.alerts;







        const activeAlerts = currentAlerts.filter(a => a.status === 'New' || a.status === 'Acknowledged');







        const activeCount = activeAlerts.length;















        // Synchronize sidebar, header, dashboard, and report badge counters







        const sbAlerts = document.getElementById('sidebarAlertsCount');







        const hrAlerts = document.getElementById('headerAlertsCount');







        const dashAlerts = document.getElementById('dashAlerts');







        const repAlerts = document.getElementById('reportActiveAlerts');







        if (sbAlerts) sbAlerts.textContent = activeCount;







        if (hrAlerts) hrAlerts.textContent = activeCount;







        if (dashAlerts) dashAlerts.textContent = activeCount;







        if (repAlerts) repAlerts.textContent = activeCount;















        const activeBadge = document.getElementById('alertActiveBadge');







        const allBadge = document.getElementById('alertAllBadge');







        if (activeBadge) activeBadge.textContent = activeCount;







        if (allBadge) allBadge.textContent = currentAlerts.length;















        const currentIds = new Set(currentAlerts.map(a => Number(a.id)));















        // Initial check on load: capture existing IDs without chime







        if (_seenAlertIds === null) {







            _seenAlertIds = currentIds;







            return;







        }















        // Check for new unacknowledged alerts







        let hasNew = false;







        let newest = null;







        for (const a of currentAlerts) {







            const aid = Number(a.id);







            if (!_seenAlertIds.has(aid) && a.status === 'New') {







                hasNew = true;







                _seenAlertIds.add(aid);







                newest = a;







            }







        }















        if (hasNew && newest) {







            console.log("🚨 New alert detected:", newest);







            if (soundEnabled && typeof playSound === 'function') {







                playSound(true);







            }







            if (typeof toast === 'function') {







                const icon = newest.severity === 'Critical' ? '🚨' : (newest.severity === 'Warning' ? '⚠️' : (newest.severity === 'Info' ? '✅' : 'ℹ️'));







                toast(`${icon} ${newest.message}`);







            }















            // Always update alerts page if open







            if (typeof loadAlerts === 'function') {







                loadAlerts();







            }







            if (typeof loadDashboardStats === 'function') {







                loadDashboardStats();







            }







            // Automatically refresh reports if reports tab is active







            const reportsSection = document.getElementById('reports');







            if (reportsSection && reportsSection.classList.contains('active') && typeof generateNMSReport === 'function') {







                generateNMSReport();







            }







        }







    } catch (err) {







        console.warn("Global alert checking error:", err);







    }







}







window.checkGlobalAlertsWithSound = checkGlobalAlertsWithSound;







document.addEventListener('DOMContentLoaded', () => {



    setTimeout(() => {



        startAutoMonitor();



    }, 1500);



});







// Backward compatibility alias



function startBackgroundPinging() {



    // startAutoMonitor already performs live tick & background batch pings



}



window.startBackgroundPinging = startBackgroundPinging;



// -----------------------------------------







/* =========================================================



   ADMINISTRATOR PANEL & SYSTEM TELEMETRY CONTROLLERS



   ========================================================= */







window.adminListData = [];







function openAdminPanel() {



    if (typeof closeAdminMenu === 'function') closeAdminMenu();



    if (typeof openPage === 'function') {



        openPage('admin-panel');



    }



    loadAdminPanelData();



    window.scrollTo({ top: 0, behavior: 'smooth' });



}







async function loadAdminPanelData() {



    const token = localStorage.getItem('access_token');



    if (!token) {



        window.location.replace('login.html');



        return;



    }







    const apiBase = NMS_API_BASE;







    const refreshBtn = document.getElementById('adminRefreshTelemetryBtn');



    if (refreshBtn) {



        refreshBtn.disabled = true;



        refreshBtn.innerHTML = '⟳ Refreshing...';



    }







    try {



        const [overviewRes, listRes] = await Promise.all([



            fetch(apiBase + '/api/admin/overview', {



                headers: { 'Authorization': 'Bearer ' + token }



            }),



            fetch(apiBase + '/api/admin/list', {



                headers: { 'Authorization': 'Bearer ' + token }



            })



        ]);







        if (overviewRes.status === 401 || listRes.status === 401) {



            showToast('⚠️ Session expired. Please log in again.');



            setTimeout(() => { window.location.replace('login.html'); }, 1000);



            return;



        }







        const overviewData = await overviewRes.json();



        const listData = await listRes.json();







        const overviewPayload = overviewData.data || overviewData;



        if (overviewData.success && overviewPayload) {



            updateAdminOverviewUI(overviewPayload);



        }







        if (listData.success && Array.isArray(listData.admins)) {



            window.adminListData = listData.admins;



            renderAdminTable(window.adminListData);



        }







    } catch (err) {



        console.error('Error loading Admin Panel data:', err);



        showToast('⚠️ Error loading administrator telemetry');



    } finally {



        if (refreshBtn) {



            refreshBtn.disabled = false;



            refreshBtn.innerHTML = '↻ Refresh Telemetry';



        }



    }



}







function updateAdminOverviewUI(data) {



    const totalCountEl = document.getElementById('adminPanelTotalCount');



    const activeCountEl = document.getElementById('adminPanelActiveCount');



    const activePercentEl = document.getElementById('adminPanelActivePercent');



    const backendStatusEl = document.getElementById('adminPanelBackendStatus');



    const backendSubEl = document.getElementById('adminPanelBackendSub');



    const dbStatusEl = document.getElementById('adminPanelDbStatus');



    const dbSubEl = document.getElementById('adminPanelDbSub');



    const currentAdminBadge = document.getElementById('adminPanelCurrentAdminBadge');







    const totalAdmins = (data.total_admins !== undefined) ? data.total_admins : 1;



    const activeAdmins = (data.active_admins !== undefined) ? data.active_admins : 1;







    if (totalCountEl) totalCountEl.textContent = totalAdmins;



    if (activeCountEl) activeCountEl.textContent = activeAdmins;







    if (activePercentEl && totalAdmins > 0) {



        const pct = Math.round((activeAdmins / totalAdmins) * 100);



        activePercentEl.textContent = `${pct}% Operational`;



    }







    if (backendStatusEl) {



        backendStatusEl.textContent = 'FastAPI Online';



        backendStatusEl.style.color = '#38bdf8';



    }







    if (backendSubEl) {



        backendSubEl.textContent = (data.system_health && data.system_health.backend_status) || 'Port 8000 (Proxy 8081)';



    }







    if (dbStatusEl) {



        dbStatusEl.textContent = 'Connected';



        dbStatusEl.style.color = '#10b981';



    }







    if (dbSubEl) {



        dbSubEl.textContent = (data.system_health && data.system_health.database_status) || 'MySQL Pool Active';



    }







    if (currentAdminBadge && data.current_admin) {



        currentAdminBadge.textContent = `${data.current_admin.name} (${data.current_admin.email})`;



    }







    const events = data.recent_activity || data.recent_security_events || [];



    renderAdminAuditLogs(events);



}







function renderAdminTable(admins) {



    const tbody = document.getElementById('adminTableBody');



    const visibleCountEl = document.getElementById('adminVisibleCount');



    if (!tbody) return;







    if (!Array.isArray(admins) || admins.length === 0) {



        tbody.innerHTML = `



            <tr>



                <td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">



                    No administrator accounts match your criteria.



                </td>



            </tr>



        `;



        if (visibleCountEl) visibleCountEl.textContent = '0';



        return;



    }







    if (visibleCountEl) visibleCountEl.textContent = admins.length;







    const currentAdminId = parseInt(localStorage.getItem('admin_id')) || 0;







    tbody.innerHTML = admins.map(admin => {



        const isSelf = admin.id === currentAdminId;



        const isActive = admin.is_active === 1 || admin.is_active === true;



        const statusBadge = isActive



            ? `<span class="admin-badge-active"><span class="pulse-dot green"></span> Active</span>`



            : `<span class="admin-badge-inactive"><span class="pulse-dot amber"></span> Inactive</span>`;



        const youBadge = isSelf ? `<span class="admin-badge-self">You</span>` : '';



        const createdDate = admin.created_at || 'Existing';







        const toggleBtnTitle = isSelf



            ? "Cannot deactivate your own logged-in account"



            : (isActive ? "Deactivate account" : "Activate account");



        const toggleBtnAction = isSelf



            ? `disabled title="${toggleBtnTitle}"`



            : `onclick="toggleAdminStatus(${admin.id}, ${!isActive}, '${escapeAdminString(admin.name)}')"` ;







        const deleteBtnTitle = isSelf



            ? "Cannot delete your own logged-in account"



            : "Permanently delete account";



        const deleteBtnAction = isSelf



            ? `disabled title="${deleteBtnTitle}"`



            : `onclick="deleteAdmin(${admin.id}, '${escapeAdminString(admin.name)}')"` ;







        return `



            <tr>



                <td style="font-family:monospace; color:#64748b;">#${admin.id}</td>



                <td>



                    <div style="display:flex; align-items:center; gap:8px;">



                        <span style="display:inline-flex; width:28px; height:28px; border-radius:50%; background:#1e293b; color:#38bdf8; align-items:center; justify-content:center; font-weight:700; font-size:12px; border:1px solid #334155;">



                            ${(admin.name || 'A').charAt(0).toUpperCase()}



                        </span>



                        <div>



                            <strong style="color:#f8fafc; display:block;">${escapeAdminHtml(admin.name || 'Admin')} ${youBadge}</strong>



                            <small style="color:#64748b; font-size:11px;">${admin.phone || 'No phone'}</small>



                        </div>



                    </div>



                </td>



                <td style="color:#94a3b8; font-family:monospace; font-size:12px;">${escapeAdminHtml(admin.email)}</td>



                <td><span style="background:#1e293b; padding:3px 8px; border-radius:4px; font-size:12px; color:#cbd5e1;">${escapeAdminHtml(admin.department || 'IT & Network')}</span></td>



                <td style="color:#cbd5e1; font-size:12px;">${escapeAdminHtml(admin.location || 'Neo Metaliks')}</td>



                <td>${statusBadge}</td>



                <td style="color:#64748b; font-size:12px;">${createdDate}</td>



                <td style="text-align:right;">



                    <div style="display:inline-flex; gap:6px;">



                        <button type="button" class="admin-action-btn ${isActive ? 'danger' : 'success'}" ${toggleBtnAction}>



                            ${isActive ? '⏸ Deactivate' : '▶ Activate'}



                        </button>



                        <button type="button" class="admin-action-btn danger" ${deleteBtnAction}>



                            🗑 Delete



                        </button>



                    </div>



                </td>



            </tr>



        `;



    }).join('');



}







function escapeAdminHtml(str) {



    if (!str) return '';



    return String(str)



        .replace(/&/g, '&amp;')



        .replace(/</g, '&lt;')



        .replace(/>/g, '&gt;')



        .replace(/"/g, '&quot;')



        .replace(/'/g, '&#039;');



}







function escapeAdminString(str) {



    if (!str) return '';



    return String(str).replace(/'/g, "\\'");



}







function filterAdminsTable() {



    const searchTerm = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();



    const statusFilter = (document.getElementById('adminStatusFilter')?.value || 'all').toLowerCase();







    const filtered = (window.adminListData || []).filter(admin => {



        const matchesSearch = !searchTerm ||



            (admin.name && admin.name.toLowerCase().includes(searchTerm)) ||



            (admin.email && admin.email.toLowerCase().includes(searchTerm)) ||



            (admin.department && admin.department.toLowerCase().includes(searchTerm)) ||



            (admin.location && admin.location.toLowerCase().includes(searchTerm));







        const isActive = admin.is_active === 1 || admin.is_active === true;



        let matchesStatus = true;



        if (statusFilter === 'active') matchesStatus = isActive;



        else if (statusFilter === 'inactive') matchesStatus = !isActive;







        return matchesSearch && matchesStatus;



    });







    renderAdminTable(filtered);



}







function renderAdminAuditLogs(events) {



    // Activity section removed from admin panel per user request



    return;



}







function openAddAdminModal() {



    const modal = document.getElementById('addAdminModal');



    if (modal) {



        modal.style.display = 'flex';



        const alertBox = document.getElementById('addAdminAlert');



        if (alertBox) alertBox.style.display = 'none';



        const form = document.getElementById('addAdminForm');



        if (form) form.reset();



        document.getElementById('newAdminName')?.focus();



    }



}







function closeAddAdminModal() {



    const modal = document.getElementById('addAdminModal');



    if (modal) modal.style.display = 'none';



}







function toggleNewAdminPasswordVisibility() {



    const pwdInput = document.getElementById('newAdminPassword');



    if (!pwdInput) return;



    pwdInput.type = (pwdInput.type === 'password') ? 'text' : 'password';



}







async function submitCreateAdmin(event) {



    if (event) event.preventDefault();







    const name = document.getElementById('newAdminName')?.value.trim();



    const email = document.getElementById('newAdminEmail')?.value.trim();



    const password = document.getElementById('newAdminPassword')?.value;



    const department = document.getElementById('newAdminDept')?.value.trim() || 'IT & Network';



    const location = document.getElementById('newAdminLocation')?.value.trim() || 'Neo Metaliks';



    const phone = document.getElementById('newAdminPhone')?.value.trim() || null;







    const alertBox = document.getElementById('addAdminAlert');



    const submitBtn = document.getElementById('createAdminSubmitBtn');







    const showAlert = (msg, isError = true) => {



        if (!alertBox) return;



        alertBox.style.display = 'block';



        alertBox.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';



        alertBox.style.color = isError ? '#f87171' : '#34d399';



        alertBox.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';



        alertBox.textContent = msg;



    };







    if (!name || !email || !password) {



        showAlert('Please fill in all required fields.');



        return;



    }







    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;



    if (!emailRegex.test(email)) {



        showAlert('Please enter a valid email address.');



        return;



    }







    if (password.length < 6) {



        showAlert('Password must be at least 6 characters.');



        return;



    }







    const token = localStorage.getItem('access_token');



    if (!token) {



        showAlert('Authentication session missing. Please log in.');



        return;



    }







    const apiBase = NMS_API_BASE;







    if (submitBtn) {



        submitBtn.disabled = true;



        submitBtn.innerHTML = 'Creating...';



    }







    try {



        const response = await fetch(apiBase + '/api/admin/create', {



            method: 'POST',



            headers: {



                'Content-Type': 'application/json',



                'Authorization': 'Bearer ' + token



            },



            body: JSON.stringify({ name, email, password, department, location, phone })



        });







        const data = await response.json();







        if (!response.ok || !data.success) {



            showAlert(data.detail || data.message || 'Failed to create administrator account.');



            return;



        }







        showToast(`✅ Administrator "${name}" created successfully`);



        closeAddAdminModal();



        await loadAdminPanelData();







    } catch (err) {



        console.error('Error creating admin:', err);



        showAlert('Server or network connection error.');



    } finally {



        if (submitBtn) {



            submitBtn.disabled = false;



            submitBtn.innerHTML = 'Create Administrator';



        }



    }



}







async function toggleAdminStatus(adminId, newStatus, adminName) {



    const actionText = newStatus ? 'activate' : 'deactivate';



    if (!confirm(`Are you sure you want to ${actionText} administrator "${adminName}"?`)) {



        return;



    }







    const token = localStorage.getItem('access_token');



    if (!token) {



        showToast('⚠️ Session expired. Please log in.');



        return;



    }







    const apiBase = NMS_API_BASE;







    try {



        const response = await fetch(`${apiBase}/api/admin/${adminId}/status`, {



            method: 'PUT',



            headers: {



                'Content-Type': 'application/json',



                'Authorization': 'Bearer ' + token



            },



            body: JSON.stringify({ is_active: newStatus ? 1 : 0 })



        });







        const data = await response.json();







        if (!response.ok || !data.success) {



            showToast(`⚠️ ${data.detail || data.message || 'Status update failed'}`);



            return;



        }







        showToast(`✅ Administrator "${adminName}" status updated`);



        await loadAdminPanelData();







    } catch (err) {



        console.error('Error toggling admin status:', err);



        showToast('⚠️ Network error updating administrator status');



    }



}







async function deleteAdmin(adminId, adminName) {



    if (!confirm(`⚠️ PERMANENT ACTION: Are you sure you want to delete administrator "${adminName}"? This action cannot be undone.`)) {



        return;



    }







    const token = localStorage.getItem('access_token');



    if (!token) {



        showToast('⚠️ Session expired. Please log in.');



        return;



    }







    const apiBase = NMS_API_BASE;







    try {



        const response = await fetch(`${apiBase}/api/admin/${adminId}`, {



            method: 'DELETE',



            headers: {



                'Authorization': 'Bearer ' + token



            }



        });







        const data = await response.json();







        if (!response.ok || !data.success) {



            showToast(`⚠️ ${data.detail || data.message || 'Admin deletion failed'}`);



            return;



        }







        showToast(`✅ Administrator "${adminName}" deleted successfully`);



        await loadAdminPanelData();







    } catch (err) {



        console.error('Error deleting admin:', err);



        showToast('⚠️ Network error deleting administrator');



    }



}







// Window bindings



window.openAdminPanel = openAdminPanel;



window.loadAdminPanelData = loadAdminPanelData;



window.openAddAdminModal = openAddAdminModal;



window.closeAddAdminModal = closeAddAdminModal;



window.toggleNewAdminPasswordVisibility = toggleNewAdminPasswordVisibility;



window.submitCreateAdmin = submitCreateAdmin;



window.toggleAdminStatus = toggleAdminStatus;



window.deleteAdmin = deleteAdmin;



window.filterAdminsTable = filterAdminsTable;



















/* =========================================================



   STATUS TOGGLE & SIMULATION ACTIONS (DEVICES, CCTV, DESKTOPS)



   ========================================================= */







async function toggleDeviceStatus(deviceId) {



    const token = localStorage.getItem('access_token');



    if (!token) return (typeof toast === 'function' ? toast('Login required') : alert('Login required'));



    if (typeof toast === 'function') toast('Switching device status...');



    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



    try {



        const res = await fetch(`${apiBase}/api/devices/${deviceId}/toggle-status`, {



            method: 'PUT',



            headers: { 'Authorization': `Bearer ${token}` }



        });



        const data = await res.json();



        if (!res.ok || !data.success) throw new Error(data.detail || data.message || 'Toggle failed');



        



        const idx = (window.backendDevices || []).findIndex(d => Number(d.id) === Number(deviceId));



        if (idx >= 0) {



            window.backendDevices[idx].status = data.status;



            if (typeof renderBackendDevices === 'function') renderBackendDevices(window.backendDevices);



        }



        playSound(true);



        const icon = data.status === 'Online' ? '✅' : '🚨';



        if (typeof toast === 'function') toast(`${icon} ${data.message || 'Device ' + data.device_code + ' is now ' + data.status}`);



        if (typeof loadAlerts === 'function') loadAlerts();



        if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



        if (typeof loadDashboardStats === 'function') loadDashboardStats();



        return data;



    } catch (err) {



        if (typeof toast === 'function') toast('Toggle error: ' + err.message);



    }



}



window.toggleDeviceStatus = toggleDeviceStatus;







async function toggleCameraStatus(cameraId) {



    const token = localStorage.getItem('access_token');



    if (!token) return (typeof toast === 'function' ? toast('Login required') : alert('Login required'));



    if (typeof toast === 'function') toast('Switching CCTV status...');



    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



    try {



        const res = await fetch(`${apiBase}/api/cameras/${cameraId}/toggle-status`, {



            method: 'PUT',



            headers: { 'Authorization': `Bearer ${token}` }



        });



        const data = await res.json();



        if (!res.ok || !data.success) throw new Error(data.detail || data.message || 'Toggle failed');



        



        const idx = (window.backendCameras || []).findIndex(c => Number(c.id) === Number(cameraId));



        if (idx >= 0) {



            window.backendCameras[idx].status = data.status;



            if (typeof renderBackendCameras === 'function') renderBackendCameras(window.backendCameras);



        }



        playSound(true);



        const icon = data.status === 'Online' ? '✅' : '🚨';



        if (typeof toast === 'function') toast(`${icon} ${data.message || 'CCTV ' + data.camera_code + ' is now ' + data.status}`);



        if (typeof loadAlerts === 'function') loadAlerts();



        if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



        if (typeof loadDashboardStats === 'function') loadDashboardStats();



        return data;



    } catch (err) {



        if (typeof toast === 'function') toast('Toggle error: ' + err.message);



    }



}



window.toggleCameraStatus = toggleCameraStatus;







async function toggleDesktopStatus(desktopId) {



    const token = localStorage.getItem('access_token');



    if (!token) return (typeof toast === 'function' ? toast('Login required') : alert('Login required'));



    if (typeof toast === 'function') toast('Switching desktop status...');



    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



    try {



        const res = await fetch(`${apiBase}/api/desktops/${desktopId}/toggle-status`, {



            method: 'PUT',



            headers: { 'Authorization': `Bearer ${token}` }



        });



        const data = await res.json();



        if (!res.ok || !data.success) throw new Error(data.detail || data.message || 'Toggle failed');



        



        const idx = (window.desktopData || []).findIndex(d => Number(d.backendId || d.id) === Number(desktopId));



        if (idx >= 0) {



            window.desktopData[idx].status = data.status;



            if (typeof renderDesktopRows === 'function') renderDesktopRows(window.desktopData);



        }



        playSound(true);



        const icon = data.status === 'Online' ? '✅' : '🚨';



        if (typeof toast === 'function') toast(`${icon} ${data.message || 'Desktop ' + data.desktop_code + ' is now ' + data.status}`);



        if (typeof loadAlerts === 'function') loadAlerts();



        if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



        if (typeof loadDashboardStats === 'function') loadDashboardStats();



        return data;



    } catch (err) {



        if (typeof toast === 'function') toast('Toggle error: ' + err.message);



    }



}



window.toggleDesktopStatus = toggleDesktopStatus;







async function simulateQuickAlert(assetType = null) {



    const token = localStorage.getItem('access_token');



    if (!token) return (typeof toast === 'function' ? toast('Login required') : alert('Login required'));



    if (typeof toast === 'function') toast('Simulating status alert...');



    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL !== undefined && window.APP_CONFIG.API_BASE_URL !== null)



                    ? window.APP_CONFIG.API_BASE_URL : (typeof NMS_API_BASE !== 'undefined' ? NMS_API_BASE : '');



    try {



        const res = await fetch(`${apiBase}/api/alerts/simulate`, {



            method: 'POST',



            headers: {



                'Authorization': `Bearer ${token}`,



                'Content-Type': 'application/json'



            },



            body: JSON.stringify({ asset_type: assetType })



        });



        const data = await res.json();



        if (!res.ok || !data.success) throw new Error(data.detail || data.message || 'Simulation failed');



        playSound(true);



        const icon = data.new_status === 'Online' ? '✅' : '🚨';



        if (typeof toast === 'function') toast(`${icon} [ALERT] ${data.message}`);



        



        if (typeof loadAlerts === 'function') loadAlerts();



        if (typeof checkGlobalAlertsWithSound === 'function') checkGlobalAlertsWithSound();



        if (typeof loadDashboardStats === 'function') loadDashboardStats();



        if (data.asset_type === 'Device' && typeof refreshDevicesFromBackend === 'function') refreshDevicesFromBackend();



        if (data.asset_type === 'Camera' && typeof loadCamerasFromBackend === 'function') loadCamerasFromBackend();



        if (data.asset_type === 'Desktop' && typeof loadDesktopsFromBackend === 'function') loadDesktopsFromBackend();



        return data;



    } catch (err) {



        if (typeof toast === 'function') toast('Simulation error: ' + err.message);



    }



}



window.simulateQuickAlert = simulateQuickAlert;







