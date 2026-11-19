'use strict';
/* ================================================================
   T&P PORTAL — frontend/app.js
   Rewa Engineering College
   All data saved to MySQL via Flask API calls
   API Base: http://localhost:5000/api
================================================================ */

const API = '/api';  // Flask runs on same server

// ── SESSION (kept in memory after login) ──────────────────────
let SESSION = { role: null, enrollment: null, name: '', company: '' };

// ── COURSES (loaded from API once) ────────────────────────────
let ALL_COURSES    = [];
let COURSE_PROGRESS= {};  // { course_key: { done, total } }

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initEmojiPicker();
    checkSession();   // restore session if page refreshed
});

function bindEvents() {
    document.getElementById('mainLoginForm').addEventListener('submit', handleLogin);
    document.getElementById('studentProfileForm').addEventListener('submit', saveStudentProfile);
    document.getElementById('jobPostingForm').addEventListener('submit', postJob);
    document.getElementById('addCourseForm').addEventListener('submit', addCourseAdmin);
    document.getElementById('userRole').addEventListener('change', onRoleChange);
}

async function checkSession() {
    try {
        const res  = await apiFetch('/me');
        if (res.ok) restoreSession(res.data);
    } catch(e) { /* not logged in */ }
}

function restoreSession(data) {
    SESSION = { role: data.role, enrollment: data.enrollment || '', name: data.name, company: data.company || '' };
    enterApp(rolePanel(data.role), `Welcome, <strong>${data.name}</strong>`);
    if (data.role === 'student')   loadStudentPanel();
    if (data.role === 'recruiter') loadRecruiterPanel();
    if (data.role === 'admin')     loadAdminPanel();
}

function rolePanel(role) {
    return { student:'student-panel', recruiter:'recruiter-panel', admin:'admin-panel' }[role] || '';
}

/* ================================================================
   API HELPER
================================================================ */
async function apiFetch(path, options = {}) {
    const res  = await fetch(API + path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const json = await res.json();
    return json;
}

async function apiPost(path, body) {
    return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

async function apiDelete(path) {
    return apiFetch(path, { method: 'DELETE' });
}

/* ================================================================
   AUTH — TAB SWITCH
================================================================ */
function switchAuthTab(tab) {
    document.getElementById('loginSection').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('registerSection').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('tabLoginBtn').classList.toggle('active',    tab === 'login');
    document.getElementById('tabRegisterBtn').classList.toggle('active', tab === 'register');
    clearAuthErrors();
}

function toggleRegFields() {
    const role = document.getElementById('regRole').value;
    document.getElementById('regStudentFields').style.display   = role === 'student'   ? 'block' : 'none';
    document.getElementById('regRecruiterFields').style.display = role === 'recruiter' ? 'block' : 'none';
}

function clearAuthErrors() {
    ['loginError','registerError'].forEach(id => {
        const e = document.getElementById(id);
        e.style.display = 'none'; e.innerText = '';
    });
}
function showLoginErr(msg)    { showErr('loginError',    msg); }
function showRegisterErr(msg) { showErr('registerError', msg); }
function showErr(id, msg) {
    const e = document.getElementById(id);
    e.innerText = '⚠ ' + msg; e.style.display = 'block';
}

/* ── REGISTER ── */
async function handleRegister() {
    clearAuthErrors();
    const role = document.getElementById('regRole').value;

    if (role === 'student') {
        const name   = document.getElementById('regStuName').value.trim();
        const enroll = document.getElementById('regStuEnroll').value.trim();
        const email  = document.getElementById('regStuEmail').value.trim();
        const branch = document.getElementById('regStuBranch').value;
        const pass   = document.getElementById('regStuPass').value;
        const pass2  = document.getElementById('regStuPass2').value;

        if (!name||!enroll||!email||!pass) return showRegisterErr('All fields are required.');
        if (pass !== pass2)               return showRegisterErr('Passwords do not match.');
        if (pass.length < 6)             return showRegisterErr('Password must be 6+ characters.');

        setLoading('registerBtn', true);
        const res = await apiPost('/register/student', { name, enrollment: enroll, email, branch, password: pass });
        setLoading('registerBtn', false);
        if (res.ok) {
            showPending('Student account created! Awaiting Admin verification before login.');
        } else {
            showRegisterErr(res.msg);
        }
        return;
    }

    if (role === 'recruiter') {
        const name     = document.getElementById('regRecName').value.trim();
        const email    = document.getElementById('regRecEmail').value.trim();
        const company  = document.getElementById('regRecCompany').value.trim();
        const position = document.getElementById('regRecPosition').value.trim();
        const phone    = document.getElementById('regRecPhone').value.trim();
        const pass     = document.getElementById('regRecPass').value;
        const pass2    = document.getElementById('regRecPass2').value;

        if (!name||!email||!company||!pass) return showRegisterErr('All fields are required.');
        if (pass !== pass2)                 return showRegisterErr('Passwords do not match.');
        if (pass.length < 6)               return showRegisterErr('Password must be 6+ characters.');

        setLoading('registerBtn', true);
        const res = await apiPost('/register/recruiter', { name, email, company, position, phone, password: pass });
        setLoading('registerBtn', false);
        if (res.ok) {
            showPending('Recruiter account created! Awaiting Admin verification.');
        } else {
            showRegisterErr(res.msg);
        }
    }
}

/* ── LOGIN ── */
function onRoleChange() {
    const role = document.getElementById('userRole').value;
    const lbl  = document.getElementById('loginIdLabel');
    const inp  = document.getElementById('loginId');
    if (role === 'student')   { lbl.innerText = 'Enrollment Number'; inp.placeholder = 'e.g. 0301CS231044'; }
    else if (role === 'recruiter') { lbl.innerText = 'Corporate Email'; inp.placeholder = 'hr@company.com'; }
    else                      { lbl.innerText = 'Admin Username'; inp.placeholder = 'tpo_admin'; }
}

async function handleLogin(e) {
    e.preventDefault();
    clearAuthErrors();
    const role     = document.getElementById('userRole').value;
    const login_id = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPass').value;
    if (!role) return showLoginErr('Please select a role.');

    setLoading('loginBtn', true);
    const res = await apiPost('/login', { role, login_id, password });
    setLoading('loginBtn', false);

    if (!res.ok) {
        if (res.msg.startsWith('PENDING:')) {
            showPending(res.msg.replace('PENDING: ',''));
        } else {
            showLoginErr(res.msg);
        }
        return;
    }

    const data = res.data;
    SESSION = { role: data.role, enrollment: data.enrollment||'', name: data.name, company: data.company||'' };
    enterApp(rolePanel(data.role), `Welcome, <strong>${data.name}</strong>`);
    if (data.role === 'student')   loadStudentPanel();
    if (data.role === 'recruiter') loadRecruiterPanel();
    if (data.role === 'admin')     loadAdminPanel();
}

function showPending(msg) {
    document.getElementById('auth-screen').style.display    = 'none';
    document.getElementById('pending-screen').style.display = 'flex';
    document.getElementById('pendingMsg').innerText          = msg;
}

function enterApp(panelId, welcomeHtml) {
    document.getElementById('auth-screen').style.display    = 'none';
    document.getElementById('pending-screen').style.display = 'none';
    document.getElementById('main-app').style.display       = 'block';
    document.getElementById('welcome-message').innerHTML    = welcomeHtml;
    buildNav(panelId);
    showPanel(panelId);
}

function buildNav(activeId) {
    const nav  = document.getElementById('navTabs');
    const tabs = {
        'student-panel':   '🎓 Dashboard',
        'recruiter-panel': '🏢 Recruiter Console',
        'admin-panel':     '⚙️ Admin Dashboard'
    };
    nav.innerHTML = `<button class="nav-tab-btn active">${tabs[activeId]||''}</button>`;
}

function showPanel(id) {
    document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

async function logout() {
    await apiPost('/logout', {});
    SESSION = { role: null, enrollment: null, name: '', company: '' };
    document.getElementById('main-app').style.display       = 'none';
    document.getElementById('pending-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display    = 'flex';
    document.getElementById('mainLoginForm').reset();
    clearAuthErrors();
    switchAuthTab('login');
    document.getElementById('regRole').value = 'student';
    toggleRegFields();
}

/* ================================================================
   STUDENT PANEL
================================================================ */
async function loadStudentPanel() {
    const [profRes, statsRes] = await Promise.all([
        apiFetch('/student/profile'),
        apiFetch('/student/stats')
    ]);
    if (profRes.ok)  fillProfile(profRes.data);
    if (statsRes.ok) fillStats(statsRes.data);
    renderEligibleDrives();
    renderMyApplications();
    await loadCourses();
    renderCourseGrid();
    renderCertificatesTable();
    renderBadges();
}

function fillProfile(s) {
    document.getElementById('profEnrollment').value = s.enrollment || '';
    document.getElementById('profName').value        = s.name      || '';
    document.getElementById('profEmail').value       = s.email     || '';
    document.getElementById('profMobile').value      = s.mobile    || '';
    document.getElementById('profBranch').value      = s.branch    || 'CSE';
    document.getElementById('profSem').value         = s.sem       || 'Sem 7';
    document.getElementById('profCgpa').value        = s.cgpa      || '';
    document.getElementById('profBacklogs').value    = s.backlogs  !== undefined ? s.backlogs : 0;
    document.getElementById('prof10th').value        = s.tenth     || '';
    document.getElementById('prof12th').value        = s.twelfth   || '';
    for (let i = 1; i <= 8; i++) {
        const el = document.getElementById('sgpa'+i);
        if (el) el.value = s['sgpa'+i] || '0.00';
    }
    if (s.profile_pic) showPicImg(s.profile_pic);
    else setInitials(s.name || s.enrollment);
    document.getElementById('courseBranchFilter').value = s.branch || 'CSE';
}

function fillStats(d) {
    document.getElementById('completedCount').innerText        = d.completed || 0;
    document.getElementById('overallProgressPercent').innerText= (d.overall || 0) + '%';
    document.getElementById('badgeCount').innerText            = d.badges   || 0;
    document.getElementById('appliedJobsCount').innerText      = d.applied  || 0;
}

function handleProfilePic(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => showPicImg(e.target.result);
    reader.readAsDataURL(file);
}
function showPicImg(src) {
    document.getElementById('profileInitials').style.display = 'none';
    const img = document.getElementById('profilePicImg');
    img.src = src; img.style.display = 'block';
}
function setInitials(name) {
    document.getElementById('profilePicImg').style.display = 'none';
    const el = document.getElementById('profileInitials');
    el.style.display = 'block';
    if (name) {
        const p = name.trim().split(' ');
        el.innerText = p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
    } else el.innerText = 'ST';
}

async function saveStudentProfile(e) {
    e.preventDefault();
    const pic = document.getElementById('profilePicImg').src || '';
    const data = {
        name:     document.getElementById('profName').value.trim(),
        email:    document.getElementById('profEmail').value.trim(),
        mobile:   document.getElementById('profMobile').value.trim(),
        branch:   document.getElementById('profBranch').value,
        sem:      document.getElementById('profSem').value,
        cgpa:     parseFloat(document.getElementById('profCgpa').value) || 0,
        backlogs: parseInt(document.getElementById('profBacklogs').value) || 0,
        tenth:    parseFloat(document.getElementById('prof10th').value) || 0,
        twelfth:  parseFloat(document.getElementById('prof12th').value) || 0,
        profile_pic: pic.startsWith('data:') ? pic : ''
    };
    for (let i = 1; i <= 8; i++) {
        data['sgpa'+i] = parseFloat(document.getElementById('sgpa'+i).value) || 0;
    }
    const res = await apiPost('/student/profile', data);
    if (res.ok) {
        document.getElementById('courseBranchFilter').value = data.branch;
        setInitials(data.name);
        const statsRes = await apiFetch('/student/stats');
        if (statsRes.ok) fillStats(statsRes.data);
        renderEligibleDrives();
        renderCourseGrid();
        toast('✅ Profile saved!', 'success');
    } else {
        toast('❌ ' + res.msg, 'danger');
    }
}

/* ── ELIGIBLE DRIVES ── */
async function renderEligibleDrives() {
    const tbody = document.getElementById('eligibleDrivesTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Loading...</td></tr>';
    const res = await apiFetch('/student/jobs');
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Failed to load drives.</td></tr>'; return; }
    const jobs = res.data;
    if (!jobs.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No active drives yet.</td></tr>'; return; }
    tbody.innerHTML = jobs.map(job => `<tr>
        <td><strong>${esc(job.company)}</strong></td>
        <td>${esc(job.role)}</td>
        <td>${esc(job.branches)}</td>
        <td>${job.min_cgpa}</td>
        <td><span class="status-badge status-placed">${esc(job.ctc)}</span></td>
        <td>${job.applied
            ? `<span class="status-badge ${stClass(job.apply_status)}">${job.apply_status}</span>`
            : `<button class="btn btn-sm btn-success" onclick="applyJob(${job.id})">Apply Now</button>`
        }</td>
    </tr>`).join('');
}

async function applyJob(jobId) {
    const res = await apiPost(`/student/apply/${jobId}`, {});
    if (res.ok) {
        toast('✅ Applied successfully!', 'success');
        renderEligibleDrives();
        renderMyApplications();
        const statsRes = await apiFetch('/student/stats');
        if (statsRes.ok) fillStats(statsRes.data);
    } else {
        toast('❌ ' + res.msg, 'danger');
    }
}

async function renderMyApplications() {
    const tbody = document.getElementById('myApplicationsBody');
    const res   = await apiFetch('/student/applications');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No applications yet.</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map(app => `<tr>
        <td><strong>${esc(app.company)}</strong></td>
        <td>${esc(app.role)}</td>
        <td>${app.applied_date ? app.applied_date.substring(0,10) : ''}</td>
        <td><span class="status-badge ${stClass(app.status)}">${app.status}</span></td>
    </tr>`).join('');
}

/* ── COURSES ── */
async function loadCourses() {
    const res = await apiFetch('/courses');
    if (res.ok) ALL_COURSES = res.data;
    // Load student progress
    const pRes = await apiFetch('/student/progress');
    if (pRes.ok) {
        COURSE_PROGRESS = {};
        pRes.data.forEach(p => { COURSE_PROGRESS[p.course_key] = { done: p.done, total: p.total }; });
    }
}

function renderCourseGrid() {
    const cat    = document.getElementById('courseCategoryFilter').value;
    const branch = document.getElementById('courseBranchFilter').value;
    const sem    = document.getElementById('courseSemFilter').value;
    const box    = document.getElementById('coursesContainer');

    const list = ALL_COURSES.filter(c =>
        (cat    === 'ALL' || c.category === cat) &&
        (c.branch === 'ALL' || c.branch === branch || c.category === 'PLACEMENT_PREP') &&
        (sem    === 'ALL' || c.sem === 'ALL' || c.sem === sem)
    );
    if (!list.length) {
        box.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:2rem;font-style:italic;">No modules found for selected filters.</p>`;
        return;
    }
    box.innerHTML = list.map(c => {
        const prog   = COURSE_PROGRESS[c.course_key] || { done:0, total:c.total_lectures||10 };
        const pct    = prog.total > 0 ? Math.min(100, Math.round(prog.done/prog.total*100)) : 0;
        const isPlac = c.category === 'PLACEMENT_PREP';
        const thumbUrl = c.yt_video_id ? `https://img.youtube.com/vi/${c.yt_video_id}/hqdefault.jpg` : '';
        return `<div class="course-card" id="card-${c.course_key}">
            <div>
                <span class="course-badge-icon ${isPlac?'placement-badge':''}">${c.badge}</span>
                <h4>${esc(c.title)}</h4>
                <p class="course-meta">${c.branch==='ALL'?'All Branches':c.branch} &nbsp;|&nbsp; ${c.sem}</p>
            </div>
            ${thumbUrl ? `
            <div class="video-thumb-wrap" onclick="openVideoModal('${c.yt_video_id}','${esc(c.title).replace(/'/g,"\\'")}','${c.yt_link||''}')">
                <img src="${thumbUrl}" alt="${esc(c.title)}" loading="lazy"
                     onerror="this.src='https://img.youtube.com/vi/${c.yt_video_id}/mqdefault.jpg'">
                <div class="play-overlay">▶</div>
            </div>` : ''}
            <div>
                <div class="progress-label-row">
                    <span>Lectures watched</span>
                    <span id="pct-${c.course_key}">${prog.done}/${prog.total} (${pct}%)</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="bar-${c.course_key}" style="width:${pct}%"></div>
                </div>
                <div class="course-actions" style="margin-top:0.5rem;">
                    ${c.yt_video_id ? `
                    <button class="yt-btn" onclick="openVideoModal('${c.yt_video_id}','${esc(c.title).replace(/'/g,"\\'")}','${c.yt_link||''}')">
                        ▶ Watch Video
                    </button>` : ''}
                    ${pct < 100
                        ? `<button class="btn btn-sm" onclick="markLecture('${c.course_key}')">✓ +1 Lecture Done</button>`
                        : `<span class="status-badge status-placed">✅ Completed</span>`}
                    ${pct >= 100 ? `<button class="btn btn-sm btn-success" onclick="printCert('${c.course_key}')">📄 Certificate</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

async function markLecture(courseKey) {
    const res = await apiPost(`/student/progress/${courseKey}`, {});
    if (!res.ok) { toast('❌ ' + res.msg, 'danger'); return; }
    const { done, total, cert } = res.data;
    const pct = Math.min(100, Math.round(done/total*100));
    COURSE_PROGRESS[courseKey] = { done, total };
    const pctEl = document.getElementById(`pct-${courseKey}`);
    const barEl = document.getElementById(`bar-${courseKey}`);
    if (pctEl) pctEl.innerText = `${done}/${total} (${pct}%)`;
    if (barEl) barEl.style.width = pct + '%';
    if (cert) {
        renderCourseGrid();
        renderCertificatesTable();
        renderBadges();
        toast('🎉 Course complete! Certificate unlocked!', 'success');
    }
    const statsRes = await apiFetch('/student/stats');
    if (statsRes.ok) fillStats(statsRes.data);
}

async function renderBadges() {
    const res = await apiFetch('/student/certificates');
    const box = document.getElementById('badgesShowcase');
    if (!res.ok || !res.data.length) {
        box.innerHTML = '<span class="empty-msg">No badges yet. Complete courses!</span>'; return;
    }
    box.innerHTML = res.data.map(c => `<span class="visual-badge-item">${c.badge}</span>`).join('');
}

async function renderCertificatesTable() {
    const res   = await apiFetch('/student/certificates');
    const tbody = document.getElementById('certificatesTableBody');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No certificates yet.</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map(c => `<tr>
        <td><strong>${esc(c.title)}</strong></td>
        <td><span class="status-badge status-applied">${c.category==='PLACEMENT_PREP'?'Placement':'Core'}</span></td>
        <td>${c.issued_date ? c.issued_date.substring(0,10) : ''}</td>
        <td><span class="status-badge status-placed">✅ Issued</span></td>
        <td><button class="btn btn-sm btn-success" onclick="printCert('${c.course_key}')">📄 Download</button></td>
    </tr>`).join('');
}

function printCert(courseKey) {
    const stu    = { name: SESSION.name, enrollment: SESSION.enrollment };
    const course = ALL_COURSES.find(c => c.course_key === courseKey);
    if (!course) return;
    document.getElementById('certStudentName').innerText  = stu.name || stu.enrollment;
    document.getElementById('certEnrollmentNo').innerText = stu.enrollment;
    document.getElementById('certCourseTitle').innerText  = course.title;
    document.getElementById('certDate').innerText         = new Date().toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric'});
    window.print();
}

/* ── VIDEO MODAL ── */
function openVideoModal(videoId, title, ytLink) {
    document.getElementById('videoModalTitle').innerText  = title;
    document.getElementById('videoIframe').src            = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    document.getElementById('videoYtDirectLink').href     = ytLink || `https://www.youtube.com/watch?v=${videoId}`;
    document.getElementById('videoModal').style.display  = 'flex';
    document.body.style.overflow = 'hidden';
}
function closeVideoModal(event) { if (event.target===document.getElementById('videoModal')) closeVideoModalBtn(); }
function closeVideoModalBtn()   { document.getElementById('videoIframe').src=''; document.getElementById('videoModal').style.display='none'; document.body.style.overflow=''; }

/* ================================================================
   RECRUITER PANEL
================================================================ */
async function loadRecruiterPanel() {
    document.getElementById('recruiterVerifiedBanner').style.display = 'block';
    renderRecruiterInventory();
    renderRecruiterApps();
}

async function postJob(e) {
    e.preventDefault();
    const data = {
        company:     document.getElementById('jobCompany').value.trim(),
        role:        document.getElementById('jobProfile').value.trim(),
        ctc:         document.getElementById('jobCtc').value.trim(),
        branches:    document.getElementById('jobBranches').value.trim(),
        min_cgpa:    parseFloat(document.getElementById('jobMinCgpa').value) || 6.0,
        drive_date:  document.getElementById('jobDate').value,
        description: document.getElementById('jobDesc').value.trim()
    };
    const res = await apiPost('/recruiter/post-job', data);
    if (res.ok) {
        e.target.reset();
        renderRecruiterInventory();
        toast('✅ Job drive posted!', 'success');
    } else {
        toast('❌ ' + res.msg, 'danger');
    }
}

async function renderRecruiterInventory() {
    const res   = await apiFetch('/recruiter/jobs');
    const tbody = document.getElementById('recruiterInventoryTableBody');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No jobs posted yet.</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map((job, i) => `<tr>
        <td><code>JNF-${String(i+1).padStart(3,'0')}</code></td>
        <td><strong>${esc(job.company)}</strong></td>
        <td>${esc(job.role)}</td>
        <td>${esc(job.ctc)}</td>
        <td>${esc(job.branches)}</td>
        <td>${job.min_cgpa}</td>
        <td>${job.drive_date||'—'}</td>
        <td><span class="status-badge status-applied">${job.applicant_count||0}</span></td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteJob(${job.id})">🗑 Delete</button></td>
    </tr>`).join('');
}

async function deleteJob(jobId) {
    if (!confirm('Delete this job posting?')) return;
    const res = await apiDelete(`/recruiter/delete-job/${jobId}`);
    if (res.ok) { renderRecruiterInventory(); renderRecruiterApps(); toast('Job deleted.', 'warn'); }
    else toast('❌ ' + res.msg, 'danger');
}

async function renderRecruiterApps() {
    const res   = await apiFetch('/recruiter/applications');
    const tbody = document.getElementById('recruiterApplicationsTableBody');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No applications yet.</td></tr>'; return;
    }
    const statuses = ['Applied','Under Review','Shortlisted','Interview Scheduled','Selected','Rejected'];
    tbody.innerHTML = res.data.map(app => `<tr>
        <td><strong>${esc(app.company)}</strong></td>
        <td>${esc(app.role)}</td>
        <td><code style="font-size:.78rem;">${app.enrollment}</code></td>
        <td>${esc(app.name||'—')}</td>
        <td>${app.branch||'—'}</td>
        <td>${app.cgpa||'—'}</td>
        <td>
            <button class="btn btn-sm" style="background:#f1f5f9;color:#1e40af;border:1px solid #bfdbfe;"
                onclick="viewProfile(${JSON.stringify(app).replace(/"/g,'&quot;')})">👤 View</button>
        </td>
        <td>
            <select class="form-control" style="padding:3px 6px;font-size:.78rem;width:150px;"
                id="status-${app.id}">
                ${statuses.map(s => `<option ${app.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
        </td>
        <td>
            <button class="btn btn-sm btn-success"
                onclick="saveAppStatus(${app.id})">💾</button>
        </td>
    </tr>`).join('');
}

async function saveAppStatus(appId) {
    const status = document.getElementById(`status-${appId}`).value;
    const res    = await apiPost('/recruiter/update-status', { app_id: appId, status });
    if (res.ok) toast('Status saved!', 'success');
    else toast('❌ ' + res.msg, 'danger');
}

function viewProfile(app) {
    const ov = document.createElement('div');
    ov.className = 'profile-overlay'; ov.id = 'profOverlay';
    ov.innerHTML = `
        <div class="profile-modal">
            <button class="close-btn" onclick="document.getElementById('profOverlay').remove()">✕</button>
            <div class="profile-avatar-lg">
                ${app.profile_pic && app.profile_pic.startsWith('data:')
                    ? `<img src="${app.profile_pic}" alt="">`
                    : `<span>${initials(app.name||app.enrollment)}</span>`}
            </div>
            <h3 style="text-align:center;margin-bottom:1rem;">${esc(app.name||'Student')}</h3>
            ${[
                ['Enrollment No.', app.enrollment],
                ['Email',  app.email||'—'],
                ['Mobile', app.mobile||'—'],
                ['Branch', app.branch||'—'],
                ['CGPA',   app.cgpa||'—'],
                ['10th %', app.tenth||'—'],
                ['12th %', app.twelfth||'—'],
                ['Placement', app.placement_status||'Seeking']
            ].map(([k,v])=>`
                <div class="profile-info-row">
                    <span class="profile-info-key">${k}</span>
                    <span class="profile-info-val">${esc(String(v))}</span>
                </div>`).join('')}
        </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', ev => { if (ev.target===ov) ov.remove(); });
}

/* ================================================================
   ADMIN PANEL
================================================================ */
async function loadAdminPanel() {
    await Promise.all([
        renderAdminStats(),
        renderAdminRecruiters(),
        renderAdminStudents(),
        renderAdminDrives(),
        renderAdminCourses()
    ]);
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const idx = { 'tab-recruiters':0,'tab-students':1,'tab-drives':2,'tab-courses':3 }[tabId];
    const tabs = document.querySelectorAll('.admin-tab');
    if (tabs[idx]) tabs[idx].classList.add('active');
}

async function renderAdminStats() {
    const res = await apiFetch('/admin/stats');
    if (!res.ok) return;
    const d = res.data;
    document.getElementById('adminTotalStudents').innerText = d.total_students;
    document.getElementById('adminPlacedStudents').innerText= d.placed;
    document.getElementById('adminDrivesCounter').innerText = d.drives;
    document.getElementById('adminPendingCount').innerText  = d.pending;
}

async function renderAdminRecruiters() {
    const res   = await apiFetch('/admin/recruiters');
    const tbody = document.getElementById('adminRecruiterVerifyTableBody');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No recruiters yet.</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map(rec => `<tr>
        <td>${esc(rec.name)}</td>
        <td>${esc(rec.email)}</td>
        <td>${esc(rec.company)}</td>
        <td>${esc(rec.position||'—')}</td>
        <td>${esc(rec.phone||'—')}</td>
        <td>${rec.reg_date ? rec.reg_date.substring(0,10) : ''}</td>
        <td>${rec.verified
            ? '<span class="status-badge status-verified">✅ Verified</span>'
            : '<span class="status-badge status-pending">⏳ Pending</span>'}</td>
        <td style="display:flex;gap:5px;flex-wrap:wrap;">
            ${!rec.verified
                ? `<button class="btn btn-sm btn-success" onclick="verifyRecruiter(${rec.id})">✅ Approve</button>`
                : `<button class="btn btn-sm" style="background:#f1f5f9;color:#64748b;" disabled>Approved</button>`}
            <button class="btn btn-sm btn-danger" onclick="deleteRecruiter(${rec.id})">🗑</button>
        </td>
    </tr>`).join('');
}

async function verifyRecruiter(id) {
    const res = await apiPost(`/admin/verify-recruiter/${id}`, {});
    if (res.ok) { renderAdminRecruiters(); renderAdminStats(); toast('✅ Recruiter verified!', 'success'); }
    else toast('❌ ' + res.msg, 'danger');
}

async function deleteRecruiter(id) {
    if (!confirm('Remove recruiter?')) return;
    const res = await apiDelete(`/admin/delete-recruiter/${id}`);
    if (res.ok) { renderAdminRecruiters(); renderAdminDrives(); renderAdminStats(); toast('Recruiter removed.', 'warn'); }
}

async function renderAdminStudents() {
    const res   = await apiFetch('/admin/students');
    const tbody = document.getElementById('adminStudentVerificationTableBody');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No students yet.</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map(s => `<tr>
        <td><code style="font-size:.8rem;">${s.enrollment}</code></td>
        <td>${esc(s.name||'—')}</td>
        <td>${s.branch||'—'}</td>
        <td>${s.cgpa||'—'}</td>
        <td>
            <select class="form-control" style="padding:3px 6px;font-size:.78rem;width:130px;"
                id="plc-${s.enrollment}">
                <option ${s.placement_status==='Seeking'?'selected':''}>Seeking</option>
                <option ${s.placement_status==='Placed'?'selected':''}>Placed</option>
                <option ${s.placement_status==='Higher Studies'?'selected':''}>Higher Studies</option>
            </select>
        </td>
        <td>
            ${!s.verified
                ? '<span class="status-badge status-pending">⏳ Pending</span>'
                : s.debarred
                    ? '<span class="status-badge status-rejected">Debarred</span>'
                    : '<span class="status-badge status-verified">✅ Active</span>'}
        </td>
        <td style="display:flex;gap:5px;flex-wrap:wrap;">
            ${!s.verified
                ? `<button class="btn btn-sm btn-success" onclick="verifyStudent('${s.enrollment}')">✅ Verify</button>`
                : `<button class="btn btn-sm" style="background:#f1f5f9;color:#64748b;" disabled>Verified</button>`}
            ${s.debarred
                ? `<button class="btn btn-sm btn-success" onclick="debarStudent('${s.enrollment}',false)">Restore</button>`
                : `<button class="btn btn-sm btn-danger" onclick="debarStudent('${s.enrollment}',true)">🚫 Debar</button>`}
            <button class="btn btn-sm" style="background:#f1f5f9;color:#1e40af;"
                onclick="savePlacement('${s.enrollment}')">💾</button>
        </td>
    </tr>`).join('');
}

async function verifyStudent(enrollment) {
    const res = await apiPost(`/admin/verify-student/${enrollment}`, {});
    if (res.ok) { renderAdminStudents(); renderAdminStats(); toast(`✅ ${enrollment} verified!`, 'success'); }
}

async function debarStudent(enrollment, val) {
    const res = await apiPost(`/admin/debar-student/${enrollment}`, { debar: val });
    if (res.ok) { renderAdminStudents(); toast(val ? '🚫 Student debarred.' : '✅ Restored.', val?'warn':'success'); }
}

async function savePlacement(enrollment) {
    const status = document.getElementById(`plc-${enrollment}`).value;
    const res    = await apiPost('/admin/update-placement', { enrollment, status });
    if (res.ok) toast('Placement status saved!', 'success');
}

async function renderAdminDrives() {
    const res   = await apiFetch('/admin/drives');
    const tbody = document.getElementById('adminAllDrivesTableBody');
    if (!res.ok || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No drives yet.</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map(job => `<tr>
        <td><strong>${esc(job.company)}</strong></td>
        <td>${esc(job.role)}</td>
        <td>${esc(job.ctc)}</td>
        <td>${esc(job.branches)}</td>
        <td>${job.min_cgpa}</td>
        <td>${job.drive_date||'—'}</td>
        <td>${esc(job.rec_email||'—')}</td>
        <td><span class="status-badge status-applied">${job.app_count||0}</span></td>
        <td><button class="btn btn-sm btn-danger" onclick="adminDeleteDrive(${job.id})">🗑</button></td>
    </tr>`).join('');
}

async function adminDeleteDrive(id) {
    if (!confirm('Remove drive?')) return;
    const res = await apiDelete(`/admin/delete-drive/${id}`);
    if (res.ok) { renderAdminDrives(); renderAdminStats(); toast('Drive removed.', 'warn'); }
}

async function renderAdminCourses() {
    const res   = await apiFetch('/admin/courses');
    const tbody = document.getElementById('adminCourseListBody');
    if (!res.ok) return;
    ALL_COURSES = res.data;
    tbody.innerHTML = res.data.map(c => `<tr>
        <td><strong>${esc(c.title)}</strong></td>
        <td><span class="status-badge ${c.category==='PLACEMENT_PREP'?'status-applied':'status-shortlisted'}">${c.category==='PLACEMENT_PREP'?'Placement':'Core'}</span></td>
        <td>${c.branch}</td>
        <td>${c.sem}</td>
        <td>${c.badge}</td>
        <td>${c.yt_video_id
            ? `<button class="yt-btn" style="font-size:.7rem;padding:3px 7px;"
               onclick="openVideoModal('${c.yt_video_id}','${esc(c.title).replace(/'/g,"\\'")}','${c.yt_link||''}')">▶ Preview</button>`
            : '—'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteCourseAdmin('${c.course_key}')">🗑</button></td>
    </tr>`).join('');
}

async function addCourseAdmin(e) {
    e.preventDefault();
    const data = {
        title:          document.getElementById('newCourseTitle').value.trim(),
        yt_link:        document.getElementById('newCourseYtLink').value.trim(),
        category:       document.getElementById('newCourseCat').value,
        branch:         document.getElementById('newCourseBranch').value,
        sem:            document.getElementById('newCourseSem').value,
        badge:          document.getElementById('newCourseBadge').value.trim(),
        total_lectures: parseInt(document.getElementById('newCourseLectures').value)||10
    };
    const res = await apiPost('/admin/add-course', data);
    if (res.ok) { e.target.reset(); renderAdminCourses(); toast('✅ Course added!', 'success'); }
    else toast('❌ ' + res.msg, 'danger');
}

async function deleteCourseAdmin(courseKey) {
    if (!confirm('Delete course?')) return;
    const res = await apiDelete(`/admin/delete-course/${courseKey}`);
    if (res.ok) { renderAdminCourses(); toast('Course deleted.', 'warn'); }
}

/* ── EMOJI PICKER ── */
function initEmojiPicker() {
    const EMOJIS = ['💻','🚀','🧱','🗄️','⚙️','🌐','🎨','☁️','🖥️','☕','🛠️',
        '⚡','📟','📡','🤖','💪','🔥','🛣️','💧','🗺️','🔌','📊',
        '🔢','👔','💼','📄','🗣️','⭐','🏆','🎯','🏅','📚','🎓',
        '🔬','🔭','🛡️','💡','🧠','📐','🔩','⚗️','🏗️','🌍'];
    const box = document.getElementById('emojiPicker');
    if (!box) return;
    box.innerHTML = EMOJIS.map(em =>
        `<button type="button" class="emoji-btn" onclick="insertEmoji('${em}')">${em}</button>`
    ).join('');
}

function insertEmoji(em) {
    const inp = document.getElementById('newCourseBadge');
    inp.value = em + ' ' + inp.value.replace(/^[\p{Emoji}\s]+/u, '');
    inp.focus();
}

/* ── UTILITIES ── */
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function initials(name) {
    if (!name) return 'ST';
    const p = name.trim().split(' ');
    return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
}
function stClass(s) {
    return {'Applied':'status-applied','Under Review':'status-applied','Shortlisted':'status-shortlisted',
        'Interview Scheduled':'status-interview','Selected':'status-placed','Placed':'status-placed',
        'Rejected':'status-rejected'}[s] || 'status-applied';
}
function setLoading(btnId, loading) {
    const b = document.getElementById(btnId);
    if (b) b.disabled = loading;
}
let toastTimer = null;
function toast(msg, type='success') {
    let el = document.getElementById('tp-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'tp-toast';
        el.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:99999;padding:11px 20px;border-radius:8px;font-size:.85rem;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.18);transition:opacity .3s,transform .3s;opacity:0;transform:translateY(12px);pointer-events:none;max-width:320px;';
        document.body.appendChild(el);
    }
    const c = {success:['#d1fae5','#065f46','#a7f3d0'],warn:['#fef3c7','#92400e','#fde68a'],danger:['#fee2e2','#991b1b','#fecaca']}[type]||['#d1fae5','#065f46','#a7f3d0'];
    el.style.background = c[0]; el.style.color = c[1]; el.style.border = `1px solid ${c[2]}`;
    el.innerText = msg;
    el.style.opacity='1'; el.style.transform='translateY(0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(12px)'; }, 3500);
}
