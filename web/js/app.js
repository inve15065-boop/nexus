// NEXUS ONE - Smart Digital Management System
// Professional Grade Frontend Logic

// --- State ---
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:5000' 
    : 'https://nexus-backend-aion.onrender.com'; // Placeholder for production backend URL
let allCourses = [];
let editingCourseId = null;
let currentUser = null; 
let activeView = 'dashboard';
let syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');

let editingUserId = null;

// --- DOM Elements ---
const loginPage = document.getElementById('loginPage');
const mainNavbar = document.getElementById('mainNavbar');
const mainLayout = document.getElementById('mainLayout');
const loginForm = document.getElementById('loginForm');
const courseTableBody = document.getElementById('courseTableBody');
const userTableBody = document.getElementById('userTableBody');
const logsContainer = document.getElementById('logsContainer');
const backendStatus = document.getElementById('backendStatus');
const themeToggle = document.getElementById('themeToggle');
const predictBtn = document.getElementById('predictBtn');
const studentScoreInput = document.getElementById('studentScore');
const aiResult = document.getElementById('aiResult');
const html = document.documentElement;
const courseModal = document.getElementById('courseModal');
const courseForm = document.getElementById('courseForm');
const userModal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
const addUserBtn = document.getElementById('addUserBtn');
const addCourseBtn = document.getElementById('addCourseBtn');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportUsersPdfBtn = document.getElementById('exportUsersPdfBtn');
const exportUsersExcelBtn = document.getElementById('exportUsersExcelBtn');
const logoutBtn = document.getElementById('logoutBtn');

// --- Export Logic ---
async function handleExport(type, format) {
    const originalBtn = type === 'users' ? 
        (format === 'pdf' ? exportUsersPdfBtn : exportUsersExcelBtn) :
        (format === 'pdf' ? exportPdfBtn : exportExcelBtn);
    
    if (originalBtn) {
        originalBtn.disabled = true;
        originalBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    }

    try {
        const response = await apiFetch(`/api/export/${type}/${format}`);
        if (response instanceof Blob) {
            const url = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = url;
            a.download = `NexusOne_${type}_${new Date().getTime()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            sendNotification('Export Success', `${type.toUpperCase()} report generated.`);
        }
    } catch (e) {
        console.error('Export Error:', e);
        alert('Failed to generate export file.');
    } finally {
        if (originalBtn) {
            originalBtn.disabled = false;
            originalBtn.innerHTML = `<i class="fas fa-file-${format === 'pdf' ? 'pdf' : 'excel'}"></i> ${type === 'users' ? format.toUpperCase() : ''}`;
        }
    }
}

if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => handleExport('courses', 'pdf'));
if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => handleExport('courses', 'excel'));
if (exportUsersPdfBtn) exportUsersPdfBtn.addEventListener('click', () => handleExport('users', 'pdf'));
if (exportUsersExcelBtn) exportUsersExcelBtn.addEventListener('click', () => handleExport('users', 'excel'));

// --- Auth & Session ---
async function checkAuth() {
    console.log("Checking authentication status...");
    const savedUser = localStorage.getItem('nexus_user');
    const token = localStorage.getItem('nexus_token');
    
    if (!savedUser || !token) {
        console.log("No session found. Showing login page.");
        showLogin();
    } else {
        try {
            currentUser = JSON.parse(savedUser);
            console.log("Session restored for:", currentUser.email);
            hideLogin();
            applyRolePermissions();
            
            // Redirect to appropriate view on load
            const targetView = getTargetViewByRole(currentUser.role);
            switchView(targetView);
        } catch (e) {
            console.error("Auth restoration failed:", e);
            localStorage.clear();
            showLogin();
        }
    }
}

function getTargetViewByRole(role) {
    if (role === 'admin') return 'users';
    if (role === 'staff') return 'courses';
    return 'dashboard';
}

function showLogin() {
    console.log("UI: Showing Login Page");
    if (loginPage) {
        loginPage.classList.remove('hidden-important');
    }
    if (mainNavbar) mainNavbar.classList.add('hidden-important');
    if (mainLayout) mainLayout.classList.add('hidden-important');
}

function hideLogin() {
    console.log("UI: Hiding Login Page");
    if (loginPage) {
        loginPage.classList.add('hidden-important');
    }
    if (mainNavbar) mainNavbar.classList.remove('hidden-important');
    if (mainLayout) mainLayout.classList.remove('hidden-important');
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const email = emailInput.value;
        const password = passwordInput.value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;

        console.log("Login form submitted for:", email);

        // Modern UI Loading State
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Authenticating...';

        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            console.log("Login API Response:", data);

            if (data && data.user && data.token) {
                currentUser = data.user;
                // Store Token and User Data Securely
                localStorage.setItem('nexus_user', JSON.stringify(currentUser));
                localStorage.setItem('nexus_token', data.token);
                
                hideLogin();
                applyRolePermissions();
                
                // Professional Redirection Logic
                const targetView = getTargetViewByRole(currentUser.role);
                console.log("Redirecting to:", targetView);
                switchView(targetView);
                
                sendNotification('Login Successful', `Welcome back, ${currentUser.role}!`);
            } else {
                throw new Error(data?.error || 'Invalid server response');
            }
        } catch (err) {
            console.error('Login Failure:', err);
            alert(err.message || 'Connection failed. Please ensure backend is running.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    });
}

function applyRolePermissions() {
    if (!currentUser) return;
    const role = currentUser.role;
    const email = currentUser.email;

    // Load custom display name and avatar from settings if available
    const savedSettings = JSON.parse(localStorage.getItem(`nexus_settings_${currentUser.uid}`) || '{}');
    const displayName = savedSettings.displayName || role.charAt(0).toUpperCase() + role.slice(1);
    const avatar = savedSettings.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;

    // Sidebar Visibility
    const navUsers = document.getElementById('nav-users');
    const navAnalytics = document.getElementById('nav-analytics');
    if (navUsers) navUsers.style.display = (role === 'admin' || role === 'staff') ? 'flex' : 'none';
    if (navAnalytics) navAnalytics.style.display = (role === 'admin' || role === 'staff') ? 'flex' : 'none';
    
    // Dashboard Action Button Visibility
    const addCourseBtn = document.getElementById('addCourseBtn');
    const addUserBtn = document.getElementById('addUserBtn');
    const exportUsersPdfBtn = document.getElementById('exportUsersPdfBtn');
    const exportUsersExcelBtn = document.getElementById('exportUsersExcelBtn');

    if (addCourseBtn) addCourseBtn.style.display = (role === 'admin' || role === 'staff') ? 'block' : 'none';
    if (addUserBtn) addUserBtn.style.display = (role === 'admin') ? 'block' : 'none';
    if (exportUsersPdfBtn) exportUsersPdfBtn.style.display = (role === 'admin' || role === 'staff') ? 'flex' : 'none';
    if (exportUsersExcelBtn) exportUsersExcelBtn.style.display = (role === 'admin' || role === 'staff') ? 'flex' : 'none';

    // Profile UI
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userAvatar = document.getElementById('userAvatar');
    if (userNameDisplay) userNameDisplay.innerText = displayName;
    if (userAvatar) {
        userAvatar.src = avatar;
        userAvatar.classList.add('object-cover'); // Ensure it fits well
    }
}

// --- Navigation Logic ---
window.switchView = (viewId) => {
    // Permission check
    if (!currentUser) return showLogin();
    const role = currentUser.role;
    
    // Admins see everything, Staff sees Users/Courses/Analytics/Settings, Users see Dashboard/Courses/Settings
    if (viewId === 'users' && role !== 'admin' && role !== 'staff') return switchView('dashboard');
    if (viewId === 'analytics' && role !== 'admin' && role !== 'staff') return switchView('dashboard');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.id === `nav-${viewId}`) link.classList.add('active');
    });

    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
        if (section.id === `view-${viewId}`) section.classList.add('active');
    });

    activeView = viewId;
    if (viewId === 'dashboard') refreshDashboard();
    if (viewId === 'users') loadAdminData();
    if (viewId === 'courses') refreshDashboard();
    if (viewId === 'analytics') initAnalyticsCharts();
    if (viewId === 'settings') initSettings();
};

// --- Modal Handlers ---
window.closeModal = () => {
    courseModal.classList.add('hidden');
    courseForm.reset();
    editingCourseId = null;
    courseModal.querySelector('h3').innerText = 'Add New Course';
};

window.closeUserModal = () => {
    userModal.classList.add('hidden');
    userForm.reset();
    editingUserId = null;
    userModal.querySelector('h3').innerText = 'Add New User / Staff';
};

if (addUserBtn) addUserBtn.addEventListener('click', () => {
    editingUserId = null;
    userModal.querySelector('h3').innerText = 'Add New User / Staff';
    userModal.classList.remove('hidden');
});

if (addCourseBtn) addCourseBtn.addEventListener('click', () => {
    editingCourseId = null;
    courseModal.querySelector('h3').innerText = 'Add New Course';
    courseModal.classList.remove('hidden');
});

if (courseForm) {
    courseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(courseForm);
        const data = {
            name: formData.get('name'),
            instructor: formData.get('instructor'),
            students: parseInt(formData.get('students')),
            status: formData.get('status')
        };
        await handleFormAction(editingCourseId ? `/api/courses/${editingCourseId}` : '/api/courses', editingCourseId ? 'PUT' : 'POST', data, closeModal);
    });
}

if (userForm) {
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(userForm);
        const data = {
            email: formData.get('email'),
            role: formData.get('role')
        };
        await handleFormAction(editingUserId ? `/api/admin/users/${editingUserId}` : '/api/admin/users', editingUserId ? 'PUT' : 'POST', data, window.closeUserModal);
    });
}

async function handleFormAction(endpoint, method, data, closeFn) {
    if (!navigator.onLine) {
        queueSyncTask(endpoint, method, data);
        sendNotification('Offline Mode', 'Action queued for sync. Will upload when online.');
        closeFn();
        return;
    }

    try {
        const result = await apiFetch(endpoint, { method, body: JSON.stringify(data) });
        if (result) {
            closeFn();
            refreshDashboard();
            if (activeView === 'users') loadAdminData();
            sendNotification('Success', 'System synchronized.');
        }
    } catch (e) {
        console.error('Action failed:', e);
        alert(e.message || 'Action failed. Check permissions.');
    }
}

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    }
    themeToggle.addEventListener('click', () => {
        html.classList.toggle('dark');
        localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    });
}

// --- Data Rendering ---
function renderCourses(courses) {
    if (!courseTableBody) return;
    
    const role = currentUser?.role || 'user';
    
    const filtered = courses.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchInput?.value.toLowerCase() || '') || 
                             c.instructor.toLowerCase().includes(searchInput?.value.toLowerCase() || '');
        const matchesStatus = (statusFilter?.value || 'all') === 'all' || c.status === statusFilter.value;
        return matchesSearch && matchesStatus;
    });

    courseTableBody.innerHTML = filtered.length ? '' : '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No courses matching criteria.</td></tr>';
    
    filtered.forEach(course => {
        const row = `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${course.name}</td>
                <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${course.instructor}</td>
                <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${course.students}</td>
                <td class="px-6 py-4">
                    <span class="${course.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'} px-2.5 py-0.5 rounded-full text-xs font-medium">
                        ${course.status}
                    </span>
                </td>
                <td class="px-6 py-4 text-right space-x-3">
                    ${(role === 'admin' || role === 'staff') ? `
                    <button onclick="editCourse('${course.id}')" class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCourse('${course.id}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : `<span class="text-xs text-gray-400 italic">View Only</span>`}
                </td>
            </tr>
        `;
        courseTableBody.insertAdjacentHTML('beforeend', row);
    });
}

// --- API & Sync ---
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('nexus_token');
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                ...options.headers 
            }
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }
        const contentType = response.headers.get('content-type');
        if (contentType && (contentType.includes('pdf') || contentType.includes('sheet'))) return await response.blob();
        return await response.json();
    } catch (e) {
        console.error(`API Error (${endpoint}):`, e);
        if (e.message.includes('Unauthorized')) {
            localStorage.removeItem('nexus_user');
            localStorage.removeItem('nexus_token');
            showLogin();
        }
        throw e; // Re-throw to handle in UI
    }
}

// --- Offline Sync Engine ---
function queueSyncTask(endpoint, method, data) {
    syncQueue.push({ endpoint, method, data, timestamp: Date.now() });
    localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
    updateSyncUI(true);
}

function updateSyncUI(isPending) {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;
    if (isPending) {
        syncStatus.innerHTML = '<i class="fas fa-sync fa-spin text-yellow-500"></i> <span class="text-yellow-500">Sync Pending</span>';
    } else {
        syncStatus.innerHTML = '<i class="fas fa-cloud-upload-alt text-green-500"></i> <span class="text-green-500">System Synced</span>';
    }
}

async function processSyncQueue() {
    if (!navigator.onLine || syncQueue.length === 0) return;
    
    updateSyncUI(true);
    console.log(`Processing ${syncQueue.length} queued tasks...`);
    const tasks = [...syncQueue];
    syncQueue = [];
    localStorage.setItem('syncQueue', '[]');

    for (const task of tasks) {
        await apiFetch(task.endpoint, { method: task.method, body: JSON.stringify(task.data) });
    }
    refreshDashboard();
    updateSyncUI(false);
    sendNotification('Sync Complete', 'All offline changes have been uploaded.');
}

window.addEventListener('online', processSyncQueue);

// --- Push Notifications ---
function sendNotification(title, body) {
    console.log(`Notification: [${title}] ${body}`);
    
    // 1. Browser Push Notification
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/1042/1042339.png' });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    // 2. In-App Toast (Always visible fallback)
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-20 right-5 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-[2000] transform transition-all duration-300 translate-y-20 opacity-0 border border-gray-700';
    toast.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="bg-primary p-2 rounded-lg">
                <i class="fas fa-bell text-white"></i>
            </div>
            <div>
                <p class="font-bold text-sm">${title}</p>
                <p class="text-xs text-gray-400">${body}</p>
            </div>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-20', 'opacity-0');
    }, 100);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Dashboards ---
async function updateSystemStatus() {
    try {
        const data = await apiFetch('/');
        if (data && backendStatus) {
            const statusDot = backendStatus.querySelector('div');
            const statusText = backendStatus.querySelector('span');
            statusDot.className = 'w-2 h-2 rounded-full ' + (data.database_connected ? 'bg-green-500' : 'bg-yellow-500');
            statusText.innerText = data.database_connected ? 'System Online' : 'DB Disconnected';
        }
    } catch (e) {
        if (backendStatus) {
            backendStatus.querySelector('div').className = 'w-2 h-2 rounded-full bg-red-500';
            backendStatus.querySelector('span').innerText = 'API Offline';
        }
    }
}

async function refreshDashboard() {
    if (!currentUser) return;

    try {
        const stats = await apiFetch('/api/stats');
        if (stats) {
            const dashboardSection = document.getElementById('view-dashboard');
            const containers = dashboardSection.querySelectorAll('h3.text-2xl.font-bold');
            const labels = dashboardSection.querySelectorAll('p.text-gray-500.dark\\:text-gray-400.text-sm');
            
            if (containers.length >= 4 && labels.length >= 4) {
                if (currentUser.role === 'user') {
                    containers[0].innerText = stats.progress || "0%";
                    containers[1].innerText = stats.my_courses || "0";
                    containers[2].innerText = stats.avg_grade || "A-";
                    containers[3].innerText = stats.fees_paid || "$0";
                    
                    labels[0].innerText = "My Progress";
                    labels[1].innerText = "Enrolled";
                    labels[2].innerText = "Avg Grade";
                    labels[3].innerText = "Fees";
                } else if (currentUser.role === 'staff') {
                    containers[0].innerText = stats.total_students.toLocaleString();
                    containers[1].innerText = stats.active_courses;
                    containers[2].innerText = stats.performance;
                    containers[3].innerText = stats.earnings;
                    
                    labels[0].innerText = "Students";
                    labels[1].innerText = "Classes";
                    labels[2].innerText = "Performance";
                    labels[3].innerText = "Salary";
                } else {
                    containers[0].innerText = stats.total_students.toLocaleString();
                    containers[1].innerText = stats.active_courses;
                    containers[2].innerText = stats.attendance_rate;
                    containers[3].innerText = stats.revenue;
                    
                    labels[0].innerText = "Students";
                    labels[1].innerText = "Courses";
                    labels[2].innerText = "Attendance";
                    labels[3].innerText = "Revenue";
                }
            }
        }
    } catch (e) { console.error('Dashboard Stats Load Fail', e); }

    // Role-Specific Content Injection
    const roleContent = document.getElementById('roleContent');
    const defaultCharts = document.getElementById('defaultDashboardCharts');
    
    if (roleContent) {
        if (currentUser.role === 'user' || currentUser.role === 'staff') {
            if (defaultCharts) defaultCharts.classList.add('hidden-important');
            
            try {
                const myData = await apiFetch('/api/my-data');
                if (currentUser.role === 'user') {
                    renderStudentView(myData);
                } else {
                    renderStaffView(myData);
                }
            } catch (e) { console.error('Role Data Load Fail', e); }
        } else {
            if (defaultCharts) defaultCharts.classList.remove('hidden-important');
            roleContent.innerHTML = '';
        }
    }

    try {
        allCourses = await apiFetch('/api/courses') || [];
        renderCourses(allCourses);
        if (currentUser.role === 'admin') updateChartsWithRealData(allCourses);
    } catch (e) { console.error('Courses Load Fail', e); }
}

function renderStudentView(data) {
    const roleContent = document.getElementById('roleContent');
    roleContent.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                <h3 class="font-bold mb-4">My Enrolled Courses</h3>
                <div class="space-y-4">
                    ${data.courses.map(c => `
                        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-bold">${c.name}</span>
                                <span class="text-xs font-bold text-primary">${c.grade}</span>
                            </div>
                            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                                <div class="bg-primary h-1.5 rounded-full" style="width: ${c.progress}%"></div>
                            </div>
                            <div class="text-[10px] mt-1 text-gray-400 text-right">${c.progress}% Complete</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                <h3 class="font-bold mb-4">Upcoming Deadlines</h3>
                <div class="space-y-3">
                    ${data.assignments.map(a => `
                        <div class="flex items-start space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition">
                            <div class="mt-1 ${a.status === 'Submitted' ? 'text-green-500' : 'text-yellow-500'}">
                                <i class="fas ${a.status === 'Submitted' ? 'fa-check-circle' : 'fa-clock'}"></i>
                            </div>
                            <div>
                                <p class="text-sm font-medium">${a.title}</p>
                                <p class="text-[10px] text-gray-400">Due: ${a.due}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderStaffView(data) {
    const roleContent = document.getElementById('roleContent');
    roleContent.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                <h3 class="font-bold mb-4">My Teaching Schedule</h3>
                <div class="space-y-4">
                    ${data.courses.length ? data.courses.map(c => `
                        <div class="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-l-4 border-primary">
                            <div>
                                <p class="font-bold">${c.name}</p>
                                <p class="text-xs text-gray-500">${c.students} Active Students</p>
                            </div>
                            <button onclick="editCourse('${c.id}')" class="bg-white dark:bg-gray-800 p-2 rounded shadow-sm text-xs hover:bg-gray-50 transition border dark:border-gray-700">
                                <i class="fas fa-edit mr-1"></i> Manage Class
                            </button>
                        </div>
                    `).join('') : '<p class="text-center text-gray-500 py-4">No active classes found.</p>'}
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                <h3 class="font-bold mb-4">Student Performance Alerts</h3>
                <div class="space-y-4">
                    ${data.students.length ? data.students.map(s => `
                        <div class="flex items-center justify-between p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition rounded-lg">
                            <div class="flex items-center space-x-3">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random" class="w-8 h-8 rounded-full">
                                <div>
                                    <p class="text-sm font-bold">${s.name}</p>
                                    <p class="text-[10px] text-gray-500">${s.course}</p>
                                </div>
                            </div>
                            <span class="text-xs ${s.performance === 'Excellent' ? 'text-green-500' : s.performance === 'Good' ? 'text-blue-500' : 'text-red-500'} font-bold">
                                ${s.performance}
                            </span>
                        </div>
                    `).join('') : '<p class="text-center text-gray-500 py-4">No student data available.</p>'}
                </div>
            </div>
        </div>
    `;
}

function updateChartsWithRealData(courses) {
    // Dynamic Growth Chart based on student distribution in courses
    const growthCanvas = document.getElementById('growthChart');
    if (growthCanvas && courses.length) {
        const labels = courses.map(c => c.name.split(' ')[0]);
        const data = courses.map(c => c.students);
        
        const chart = Chart.getChart(growthCanvas);
        if (chart) chart.destroy();
        
        new Chart(growthCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Students per Course', data: data, backgroundColor: '#3b82f6' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Dynamic Revenue Chart
    const revenueCanvas = document.getElementById('revenueChart');
    if (revenueCanvas && courses.length) {
        const labels = ['Core', 'Elective', 'Workshop'];
        const data = [
            courses.filter(c => c.students > 100).length,
            courses.filter(c => c.students <= 100 && c.students > 50).length,
            courses.filter(c => c.students <= 50).length
        ];

        const chart = Chart.getChart(revenueCanvas);
        if (chart) chart.destroy();

        new Chart(revenueCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: ['#3b82f6', '#8b5cf6', '#eab308'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

async function loadAdminData() {
    try {
        const users = await apiFetch('/api/admin/users');
        if (users && userTableBody) {
            userTableBody.innerHTML = users.map(u => `
                <tr class="border-t dark:border-gray-700">
                    <td class="px-6 py-4 font-medium">${u.email}</td>
                    <td class="px-6 py-4"><span class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full text-xs font-bold capitalize">${u.role}</span></td>
                    <td class="px-6 py-4"><span class="flex items-center text-green-500 text-xs font-medium"><i class="fas fa-circle mr-2 text-[6px]"></i> Active</span></td>
                    <td class="px-6 py-4 text-right flex justify-end space-x-2">
                        ${currentUser.role === 'admin' ? `
                        <button onclick="editUser('${u.uid}')" class="text-blue-500 hover:text-blue-700 transition px-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteUser('${u.uid}')" class="text-red-500 hover:text-red-700 transition px-2">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : `<span class="text-xs text-gray-400 italic">Restricted</span>`}
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Users Load Fail', e); }

    try {
        const logs = await apiFetch('/api/admin/logs');
        if (logs && logsContainer) {
            logsContainer.innerHTML = logs.length ? logs.map(l => {
                const logId = l.id || l.timestamp; // Use ID or timestamp as fallback
                return `
                <div class="text-xs p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-primary transition hover:bg-gray-100 dark:hover:bg-gray-700 group">
                    <div class="flex justify-between font-bold mb-1">
                        <span class="text-primary">${l.action}</span>
                        <div class="flex items-center space-x-2">
                            <span class="text-gray-400 font-normal">${new Date(l.timestamp).toLocaleTimeString()}</span>
                            <button onclick="deleteLog('${logId}')" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-gray-600 dark:text-gray-400">${l.details}</div>
                </div>
                `;
            }).join('') : '<p class="text-center text-gray-500 py-4">No recent activity found.</p>';
        }
    } catch (e) { console.error('Logs Load Fail', e); }
}

window.deleteUser = async (uid) => {
    if (!confirm('Permanently delete this user?')) return;
    try {
        await apiFetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
        loadAdminData();
        sendNotification('User Deleted', 'Account has been removed from system.');
    } catch (e) { alert('Failed to delete user'); }
};

window.editUser = async (uid) => {
    try {
        const user = await apiFetch(`/api/admin/users/${uid}`);
        if (user) {
            editingUserId = uid;
            userModal.classList.remove('hidden');
            userModal.querySelector('h3').innerText = 'Edit User / Staff';
            
            userForm.querySelector('[name="email"]').value = user.email;
            userForm.querySelector('[name="role"]').value = user.role;
        }
    } catch (e) { alert('Failed to load user details'); }
};

window.deleteLog = async (logId) => {
    if (!logId) return;
    try {
        await apiFetch(`/api/admin/logs/${logId}`, { method: 'DELETE' });
        loadAdminData();
        sendNotification('Log Removed', 'Activity entry deleted successfully.');
    } catch (e) { 
        console.error('Log delete failed:', e);
    }
};

window.deleteCourse = async (courseId) => {
    if (!confirm('Permanently delete this course?')) return;
    try {
        await apiFetch(`/api/courses/${courseId}`, { method: 'DELETE' });
        refreshDashboard();
        sendNotification('Course Deleted', 'Course has been removed.');
    } catch (e) { alert('Failed to delete course'); }
};

window.editCourse = async (courseId) => {
    try {
        const course = await apiFetch(`/api/courses/${courseId}`);
        if (course) {
            editingCourseId = courseId;
            courseModal.classList.remove('hidden');
            courseModal.querySelector('h3').innerText = 'Edit Course';
            
            courseForm.querySelector('[name="name"]').value = course.name;
            courseForm.querySelector('[name="instructor"]').value = course.instructor;
            courseForm.querySelector('[name="students"]').value = course.students;
            courseForm.querySelector('[name="status"]').value = course.status;
        }
    } catch (e) { alert('Failed to load course details'); }
};

// --- Settings Logic ---
window.switchSettingsTab = (tabId) => {
    document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active', 'bg-gray-100', 'dark:bg-gray-800'));
    
    const targetContent = document.getElementById(`settings-${tabId}`);
    if (targetContent) targetContent.classList.remove('hidden');
    
    // Find the button that was clicked
    const btn = [...document.querySelectorAll('.settings-tab-btn')].find(b => b.getAttribute('onclick').includes(tabId));
    if (btn) btn.classList.add('active', 'bg-gray-100', 'dark:bg-gray-800');
};

function initSettings() {
    const settingsForm = document.getElementById('settingsForm');
    const avatarInput = document.getElementById('avatarInput');
    const settingsAvatar = document.getElementById('settingsAvatar');
    
    if (!settingsForm || !currentUser) return;

    // Show/Hide Admin only tabs
    const systemTabBtn = document.getElementById('settings-tab-system-btn');
    if (systemTabBtn) systemTabBtn.style.display = (currentUser.role === 'admin') ? 'flex' : 'none';

    // Populate current data
    const orgInput = settingsForm.querySelector('[name="orgName"]');
    const emailInput = settingsForm.querySelector('[name="email"]');
    const nameInput = settingsForm.querySelector('[name="displayName"]');
    const maintenanceInput = settingsForm.querySelector('[name="maintenanceMode"]');
    
    const savedSettings = JSON.parse(localStorage.getItem(`nexus_settings_${currentUser.uid}`) || '{}');
    const globalSettings = JSON.parse(localStorage.getItem('nexus_global_settings') || '{"orgName": "Nexus One EduTech", "maintenanceMode": false}');

    const displayName = savedSettings.displayName || currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    if (nameInput) nameInput.value = displayName;
    if (emailInput) emailInput.value = currentUser.email;
    if (orgInput) orgInput.value = globalSettings.orgName;
    if (maintenanceInput) maintenanceInput.checked = globalSettings.maintenanceMode;

    // Update Profile UI in settings
    document.getElementById('settingsUserName').innerText = displayName;
    document.getElementById('settingsUserRole').innerText = currentUser.role.toUpperCase();
    
    const currentAvatar = savedSettings.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;
    if (settingsAvatar) settingsAvatar.src = currentAvatar;

    // Handle Avatar Upload
    if (avatarInput) {
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) { // 2MB Limit
                alert('Image is too large. Max 2MB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Image = event.target.result;
                if (settingsAvatar) settingsAvatar.src = base64Image;
                
                // Temporarily store in session to save with form
                settingsForm.dataset.pendingAvatar = base64Image;
                sendNotification('Photo Prepared', 'Click Save to update your profile.');
            };
            reader.readAsDataURL(file);
        });
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pendingAvatar = settingsForm.dataset.pendingAvatar;
        const userSettings = {
            displayName: nameInput.value,
            email: emailInput.value,
            avatar: pendingAvatar || savedSettings.avatar
        };

        localStorage.setItem(`nexus_settings_${currentUser.uid}`, JSON.stringify(userSettings));
        
        // Sync to backend if needed (optional for local demo but good practice)
        try {
            await apiFetch(`/api/admin/users/${currentUser.uid}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    email: userSettings.email,
                    displayName: userSettings.displayName,
                    avatar: userSettings.avatar
                })
            });
        } catch (err) { console.error('Sync to backend failed', err); }

        if (currentUser.role === 'admin') {
            const global = {
                orgName: orgInput.value,
                maintenanceMode: maintenanceInput.checked
            };
            localStorage.setItem('nexus_global_settings', JSON.stringify(global));
            
            if (global.maintenanceMode) {
                sendNotification('System Warning', 'Maintenance Mode is now ACTIVE.');
            }
        }

        delete settingsForm.dataset.pendingAvatar;
        applyRolePermissions(); 
        sendNotification('Profile Updated', 'Your settings and photo have been saved.');
    });
}

// --- Logout ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            currentUser = null;
            showLogin();
            sendNotification('Logged Out', 'Session ended securely.');
        }
    });
}

// --- Analytics Charts ---
function initDashboardChart() {
    const canvas = document.getElementById('enrollmentChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Enrollments',
                data: [65, 82, 75, 95, 110, 145],
                borderColor: '#3b82f6',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function initAnalyticsCharts() {
    const growthCanvas = document.getElementById('growthChart');
    if (growthCanvas) {
        new Chart(growthCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                datasets: [{ label: 'Growth', data: [12, 19, 15, 25], backgroundColor: '#3b82f6' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const revenueCanvas = document.getElementById('revenueChart');
    if (revenueCanvas) {
        new Chart(revenueCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Courses', 'Subs', 'Ads'],
                datasets: [{ data: [300, 150, 100], backgroundColor: ['#3b82f6', '#8b5cf6', '#eab308'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// --- AI Insights ---
if (predictBtn) {
    predictBtn.addEventListener('click', async () => {
        const score = parseInt(studentScoreInput.value);
        const attendance = parseInt(document.getElementById('studentAttendance').value);
        const difficulty = parseInt(document.getElementById('courseDifficulty').value);

        if (isNaN(score) || isNaN(attendance)) return alert('Please enter valid performance metrics');
        
        const originalBtnHtml = predictBtn.innerHTML;
        predictBtn.disabled = true;
        predictBtn.innerHTML = '<i class="fas fa-microchip fa-spin mr-2"></i> Neural Processing...';

        aiResult.classList.remove('hidden');
        aiResult.querySelector('p').innerHTML = "Nexus AI is performing multivariate inference analysis...";

        try {
            const data = await apiFetch('/api/ai/predict', { 
                method: 'POST', 
                body: JSON.stringify({ score, attendance, difficulty }) 
            });

            if (data) {
                const badgeColor = data.category === 'High Potential' ? 'text-green-500' : 
                                  data.category === 'Critical' ? 'text-red-500' : 'text-purple-500';

                aiResult.querySelector('p').innerHTML = `
                    <div class="flex justify-between items-center mb-2 border-b dark:border-purple-800 pb-2">
                        <span class="font-bold text-lg ${badgeColor}">${data.category}</span>
                        <span class="text-[10px] bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded-full">Confidence: ${data.model_confidence}</span>
                    </div>
                    <div class="text-sm italic mb-3">"${data.prediction}"</div>
                    <div class="grid grid-cols-2 gap-2 text-[10px] opacity-70">
                        <div>Algorithm: Random Forest</div>
                        <div class="text-right">Weighting: Score (70%)</div>
                    </div>
                `;
            }
        } catch (err) {
            aiResult.querySelector('p').innerText = "Predictive Engine Error. Check API connection.";
        } finally {
            predictBtn.disabled = false;
            predictBtn.innerHTML = originalBtnHtml;
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Nexus One System Initializing...");
    initTheme();
    initDashboardChart();
    checkAuth();
    updateSystemStatus(); // Call immediately
    setInterval(updateSystemStatus, 30000);
    if ("Notification" in window) Notification.requestPermission();
});
