
# ================================================================
#  T&P PORTAL — app.py
#  Python Flask + MySQL
#  Rewa Engineering College
#
#  FOLDER STRUCTURE (sabhi files EK HI folder mein):
#  25a45/
#    app.py         ← yeh file
#    index.html
#    style.css
#    app.js
#    database.sql
#    requirements.txt
# ================================================================

from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import mysql.connector
import bcrypt
import os
import re
from datetime import timedelta
from functools import wraps

# backend/ folder mein app.py hai, frontend/ folder mein HTML/CSS/JS hai
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

app.secret_key = 'tp_portal_rewa_2024_xK9mP'
app.permanent_session_lifetime = timedelta(hours=8)

# ── CORS — localhost:5000 se hi chalega, cookies ke saath ──────
CORS(app,
     supports_credentials=True,
     origins=['http://localhost:5000', 'http://127.0.0.1:5000'],
     allow_headers=['Content-Type'],
     methods=['GET','POST','DELETE','OPTIONS'])

# ── SESSION COOKIE CONFIG ──────────────────────────────────────
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE']   = False   # HTTP ke liye False rakhna
app.config['SESSION_COOKIE_HTTPONLY'] = True

# ── ADMIN CREDENTIALS ─────────────────────────────────────────
ADMIN_ID   = 'tpo_admin'
ADMIN_PASS = 'admin@rec123'
ADMIN_NAME = 'Dr. Yashwant Goswami (TPO)'

# ── DATABASE CONFIG ───────────────────────────────────────────
DB_CONFIG = {
    'host':     'localhost',
    'user':     'root',
    'password': '082004',  # ← apna MySQL password yahan likho
    'database': 'tp_portal',
    'charset':  'utf8mb4',
    'use_unicode': True
}

# ================================================================
#  DATABASE HELPERS
# ================================================================
def get_db():
    return mysql.connector.connect(**DB_CONFIG)

def query(sql, params=(), fetch='all'):
    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params)
        if fetch == 'all':
            result = cur.fetchall()
        elif fetch == 'one':
            result = cur.fetchone()
        else:
            result = None
        conn.commit()
        return result
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

def execute(sql, params=()):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

# ================================================================
#  AUTH HELPERS
# ================================================================
def hash_pass(plain):
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_pass(plain, hashed):
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if 'role' not in session:
                return jsonify({'ok': False, 'msg': 'Not logged in. Please login again.'}), 401
            if role and session.get('role') != role:
                return jsonify({'ok': False, 'msg': 'Access denied.'}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

def ok(data=None, msg='Success'):
    return jsonify({'ok': True, 'msg': msg, 'data': data})

def err(msg='Error', code=400):
    return jsonify({'ok': False, 'msg': msg}), code

def extract_yt_id(url):
    patterns = [
        r'youtu\.be/([A-Za-z0-9_-]{11})',
        r'v=([A-Za-z0-9_-]{11})',
        r'embed/([A-Za-z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return ''

# ================================================================
#  SERVE FRONTEND (same folder)
# ================================================================
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # API calls ko aage jaane do
    if path.startswith('api/'):
        return err('Not found', 404)
    full = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')

# ================================================================
#  REGISTER ROUTES
# ================================================================
@app.route('/api/register/student', methods=['POST'])
def register_student():
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid request data.')

    name     = (d.get('name') or '').strip()
    enroll   = (d.get('enrollment') or '').strip()
    email    = (d.get('email') or '').strip().lower()
    branch   = d.get('branch', 'CSE')
    password = d.get('password', '')

    if not all([name, enroll, email, password]):
        return err('Sabhi fields bharna zaroori hai.')
    if len(password) < 6:
        return err('Password kam se kam 6 characters ka hona chahiye.')

    # Duplicate check
    try:
        if query('SELECT id FROM students WHERE enrollment=%s', (enroll,), 'one'):
            return err('Yeh Enrollment Number already registered hai. Login karein.')
        if query('SELECT id FROM students WHERE email=%s', (email,), 'one'):
            return err('Yeh Email already registered hai.')
        execute(
            'INSERT INTO students (enrollment,pass_hash,name,email,branch,verified) VALUES (%s,%s,%s,%s,%s,0)',
            (enroll, hash_pass(password), name, email, branch)
        )
    except mysql.connector.Error as e:
        return err(f'Database error: {str(e)}')

    return ok(msg='Registration successful! Admin verification ke baad login kar sakte hain.')


@app.route('/api/register/recruiter', methods=['POST'])
def register_recruiter():
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid request data.')

    name     = (d.get('name') or '').strip()
    email    = (d.get('email') or '').strip().lower()
    company  = (d.get('company') or '').strip()
    position = (d.get('position') or '').strip()
    phone    = (d.get('phone') or '').strip()
    password = d.get('password', '')

    if not all([name, email, company, password]):
        return err('Sabhi required fields bharna zaroori hai.')
    if len(password) < 6:
        return err('Password kam se kam 6 characters ka hona chahiye.')

    try:
        if query('SELECT id FROM recruiters WHERE email=%s', (email,), 'one'):
            return err('Yeh Email already registered hai. Login karein.')
        execute(
            'INSERT INTO recruiters (email,pass_hash,name,company,position,phone,verified) VALUES (%s,%s,%s,%s,%s,%s,0)',
            (email, hash_pass(password), name, company, position, phone)
        )
    except mysql.connector.Error as e:
        return err(f'Database error: {str(e)}')

    return ok(msg='Registration successful! Admin verification ke baad login kar sakte hain.')


# ================================================================
#  LOGIN / LOGOUT
# ================================================================
@app.route('/api/login', methods=['POST'])
def login():
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid request.')

    role     = d.get('role', '')
    login_id = (d.get('login_id') or '').strip()
    password = d.get('password', '')

    if role == 'admin':
        if login_id == ADMIN_ID and password == ADMIN_PASS:
            session.permanent = True
            session['role']   = 'admin'
            session['name']   = ADMIN_NAME
            return ok({'role': 'admin', 'name': ADMIN_NAME})
        return err('Admin credentials galat hain.')

    if role == 'student':
        try:
            stu = query('SELECT * FROM students WHERE enrollment=%s', (login_id,), 'one')
        except mysql.connector.Error as e:
            return err(f'Database error: {str(e)}')
        if not stu or not check_pass(password, stu['pass_hash']):
            return err('Enrollment Number ya Password galat hai.')
        if stu['debarred']:
            return err('Aapka account debarred hai. T&P Admin se sampark karein.')
        if not stu['verified']:
            return err('PENDING: Aapka account Admin verification ke liye wait kar raha hai.')
        session.permanent     = True
        session['role']       = 'student'
        session['enrollment'] = stu['enrollment']
        session['name']       = stu['name']
        return ok({'role': 'student', 'name': stu['name'], 'enrollment': stu['enrollment']})

    if role == 'recruiter':
        try:
            rec = query('SELECT * FROM recruiters WHERE email=%s', (login_id,), 'one')
        except mysql.connector.Error as e:
            return err(f'Database error: {str(e)}')
        if not rec or not check_pass(password, rec['pass_hash']):
            return err('Email ya Password galat hai.')
        if not rec['verified']:
            return err('PENDING: Aapka recruiter account Admin verification ke liye wait kar raha hai.')
        session.permanent    = True
        session['role']      = 'recruiter'
        session['rec_id']    = rec['id']
        session['name']      = rec['name']
        session['company']   = rec['company']
        return ok({'role': 'recruiter', 'name': rec['name'], 'company': rec['company']})

    return err('Role select nahi kiya.')


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return ok(msg='Logged out.')


@app.route('/api/me')
def me():
    if 'role' not in session:
        return err('Not logged in', 401)
    data = {'role': session['role'], 'name': session.get('name', '')}
    if session['role'] == 'student':
        data['enrollment'] = session.get('enrollment', '')
    if session['role'] == 'recruiter':
        data['company'] = session.get('company', '')
    return ok(data)


# ================================================================
#  STUDENT ROUTES
# ================================================================
@app.route('/api/student/profile', methods=['GET'])
@login_required('student')
def get_student_profile():
    enr = session['enrollment']
    stu = query('SELECT * FROM students WHERE enrollment=%s', (enr,), 'one')
    if not stu:
        return err('Student not found', 404)
    stu.pop('pass_hash', None)
    # Convert decimals to float
    for k in ['cgpa','tenth','twelfth','sgpa1','sgpa2','sgpa3','sgpa4','sgpa5','sgpa6','sgpa7','sgpa8']:
        if stu.get(k) is not None:
            stu[k] = float(stu[k])
    return ok(stu)


@app.route('/api/student/profile', methods=['POST'])
@login_required('student')
def save_student_profile():
    enr = session['enrollment']
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid data.')
    try:
        execute(
            '''UPDATE students SET
               name=%s,email=%s,mobile=%s,branch=%s,sem=%s,
               cgpa=%s,backlogs=%s,tenth=%s,twelfth=%s,
               sgpa1=%s,sgpa2=%s,sgpa3=%s,sgpa4=%s,
               sgpa5=%s,sgpa6=%s,sgpa7=%s,sgpa8=%s,
               profile_pic=%s WHERE enrollment=%s''',
            (
                d.get('name',''), d.get('email',''), d.get('mobile',''),
                d.get('branch','CSE'), d.get('sem','Sem 1'),
                d.get('cgpa',0), d.get('backlogs',0),
                d.get('tenth',0), d.get('twelfth',0),
                d.get('sgpa1',0), d.get('sgpa2',0), d.get('sgpa3',0), d.get('sgpa4',0),
                d.get('sgpa5',0), d.get('sgpa6',0), d.get('sgpa7',0), d.get('sgpa8',0),
                d.get('profile_pic',''), enr
            )
        )
    except mysql.connector.Error as e:
        return err(f'Save failed: {str(e)}')
    return ok(msg='Profile saved.')


@app.route('/api/student/stats')
@login_required('student')
def get_student_stats():
    enr     = session['enrollment']
    courses = query('SELECT course_key, total_lectures FROM courses')
    prog    = query('SELECT course_key, done, total FROM course_progress WHERE enrollment=%s', (enr,))
    pmap    = {p['course_key']: p for p in prog}
    completed = 0
    total_pct = 0
    for c in courses:
        p   = pmap.get(c['course_key'], {'done': 0, 'total': c['total_lectures'] or 10})
        pct = round(p['done'] / p['total'] * 100) if p['total'] > 0 else 0
        if pct >= 100: completed += 1
        total_pct += pct
    overall = round(total_pct / len(courses)) if courses else 0
    badges  = query('SELECT COUNT(*) AS cnt FROM certificates WHERE enrollment=%s', (enr,), 'one')['cnt']
    applied = query('SELECT COUNT(*) AS cnt FROM applications WHERE enrollment=%s', (enr,), 'one')['cnt']
    return ok({'completed': completed, 'overall': overall, 'badges': int(badges), 'applied': int(applied)})


@app.route('/api/student/jobs')
@login_required('student')
def get_student_jobs():
    enr  = session['enrollment']
    jobs = query(
        '''SELECT j.*, r.name AS rec_name, r.company AS rec_company
           FROM jobs j JOIN recruiters r ON j.posted_by=r.id
           WHERE r.verified=1 ORDER BY j.created_at DESC'''
    )
    apps    = query('SELECT job_id, status FROM applications WHERE enrollment=%s', (enr,))
    app_map = {a['job_id']: a['status'] for a in apps}
    for j in jobs:
        j['applied']      = j['id'] in app_map
        j['apply_status'] = app_map.get(j['id'], '')
        j['min_cgpa']     = float(j['min_cgpa']) if j['min_cgpa'] else 0
        if j.get('drive_date'):  j['drive_date']  = str(j['drive_date'])
        if j.get('created_at'): j['created_at']  = str(j['created_at'])
    return ok(jobs)


@app.route('/api/student/apply/<int:job_id>', methods=['POST'])
@login_required('student')
def apply_job(job_id):
    enr = session['enrollment']
    if query('SELECT id FROM applications WHERE job_id=%s AND enrollment=%s', (job_id, enr), 'one'):
        return err('Aap pehle se apply kar chuke hain.')
    execute('INSERT INTO applications (job_id,enrollment,status) VALUES (%s,%s,%s)', (job_id, enr, 'Applied'))
    execute('UPDATE jobs SET applicant_count=applicant_count+1 WHERE id=%s', (job_id,))
    return ok(msg='Applied successfully!')


@app.route('/api/student/applications')
@login_required('student')
def get_my_applications():
    enr  = session['enrollment']
    apps = query(
        '''SELECT a.*,j.company,j.role,j.ctc FROM applications a
           JOIN jobs j ON a.job_id=j.id
           WHERE a.enrollment=%s ORDER BY a.applied_date DESC''',
        (enr,)
    )
    for a in apps:
        if a.get('applied_date'): a['applied_date'] = str(a['applied_date'])
    return ok(apps)


# ── COURSES ──────────────────────────────────────────────────────
@app.route('/api/courses')
@login_required()
def get_courses():
    courses = query('SELECT * FROM courses ORDER BY category,branch,sem')
    for c in courses:
        if c.get('created_at'): c['created_at'] = str(c['created_at'])
    return ok(courses)


@app.route('/api/student/progress')
@login_required('student')
def get_progress():
    enr  = session['enrollment']
    prog = query('SELECT * FROM course_progress WHERE enrollment=%s', (enr,))
    return ok(prog)


@app.route('/api/student/progress/<course_key>', methods=['POST'])
@login_required('student')
def mark_lecture(course_key):
    enr    = session['enrollment']
    course = query('SELECT * FROM courses WHERE course_key=%s', (course_key,), 'one')
    if not course:
        return err('Course not found.', 404)
    total = course['total_lectures'] or 10
    prog  = query('SELECT * FROM course_progress WHERE enrollment=%s AND course_key=%s', (enr, course_key), 'one')
    if not prog:
        execute('INSERT INTO course_progress (enrollment,course_key,done,total) VALUES (%s,%s,1,%s)', (enr, course_key, total))
        done = 1
    else:
        if prog['done'] >= prog['total']:
            return ok({'done': prog['done'], 'total': prog['total'], 'cert': False})
        execute('UPDATE course_progress SET done=done+1 WHERE enrollment=%s AND course_key=%s', (enr, course_key))
        done = prog['done'] + 1
    cert_unlocked = False
    if done >= total:
        if not query('SELECT id FROM certificates WHERE enrollment=%s AND course_key=%s', (enr, course_key), 'one'):
            execute('INSERT INTO certificates (enrollment,course_key) VALUES (%s,%s)', (enr, course_key))
            cert_unlocked = True
    return ok({'done': done, 'total': total, 'cert': cert_unlocked})


@app.route('/api/student/certificates')
@login_required('student')
def get_certificates():
    enr   = session['enrollment']
    certs = query(
        '''SELECT c.*,co.title,co.category,co.badge FROM certificates c
           JOIN courses co ON c.course_key=co.course_key
           WHERE c.enrollment=%s ORDER BY c.issued_date DESC''',
        (enr,)
    )
    for c in certs:
        if c.get('issued_date'): c['issued_date'] = str(c['issued_date'])
    return ok(certs)


# ================================================================
#  RECRUITER ROUTES
# ================================================================
@app.route('/api/recruiter/jobs')
@login_required('recruiter')
def get_rec_jobs():
    rec_id = session['rec_id']
    jobs   = query('SELECT * FROM jobs WHERE posted_by=%s ORDER BY created_at DESC', (rec_id,))
    for j in jobs:
        j['min_cgpa'] = float(j['min_cgpa']) if j['min_cgpa'] else 0
        if j.get('drive_date'):  j['drive_date']  = str(j['drive_date'])
        if j.get('created_at'): j['created_at']  = str(j['created_at'])
    return ok(jobs)


@app.route('/api/recruiter/post-job', methods=['POST'])
@login_required('recruiter')
def post_job():
    rec_id = session['rec_id']
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid data.')
    if not all([d.get('company'), d.get('role'), d.get('ctc'), d.get('branches')]):
        return err('Sabhi required fields bharen.')
    execute(
        'INSERT INTO jobs (company,role,ctc,branches,min_cgpa,drive_date,description,posted_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
        (d['company'], d['role'], d['ctc'], d['branches'],
         d.get('min_cgpa', 6.0), d.get('drive_date') or None,
         d.get('description', ''), rec_id)
    )
    return ok(msg='Job drive posted!')


@app.route('/api/recruiter/delete-job/<int:job_id>', methods=['DELETE'])
@login_required('recruiter')
def delete_job(job_id):
    rec_id = session['rec_id']
    if not query('SELECT id FROM jobs WHERE id=%s AND posted_by=%s', (job_id, rec_id), 'one'):
        return err('Job not found.', 404)
    execute('DELETE FROM jobs WHERE id=%s', (job_id,))
    return ok(msg='Job deleted.')


@app.route('/api/recruiter/applications')
@login_required('recruiter')
def get_rec_apps():
    rec_id = session['rec_id']
    apps   = query(
        '''SELECT a.*,j.company,j.role,
                  s.name,s.enrollment,s.branch,s.cgpa,
                  s.email,s.mobile,s.tenth,s.twelfth,
                  s.placement_status,s.profile_pic
           FROM applications a
           JOIN jobs j     ON a.job_id=j.id
           JOIN students s ON a.enrollment=s.enrollment
           WHERE j.posted_by=%s ORDER BY a.applied_date DESC''',
        (rec_id,)
    )
    for a in apps:
        if a.get('applied_date'): a['applied_date'] = str(a['applied_date'])
        a['cgpa']   = float(a['cgpa'])   if a.get('cgpa')   else 0
        a['tenth']  = float(a['tenth'])  if a.get('tenth')  else 0
        a['twelfth']= float(a['twelfth'])if a.get('twelfth')else 0
    return ok(apps)


@app.route('/api/recruiter/update-status', methods=['POST'])
@login_required('recruiter')
def update_app_status():
    rec_id = session['rec_id']
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid data.')
    app_id = d.get('app_id')
    status = d.get('status')
    VALID  = ['Applied','Under Review','Shortlisted','Interview Scheduled','Selected','Rejected']
    if status not in VALID:
        return err('Invalid status.')
    row = query(
        'SELECT a.id FROM applications a JOIN jobs j ON a.job_id=j.id WHERE a.id=%s AND j.posted_by=%s',
        (app_id, rec_id), 'one'
    )
    if not row:
        return err('Application not found.', 404)
    execute('UPDATE applications SET status=%s WHERE id=%s', (status, app_id))
    return ok(msg='Status updated.')


# ================================================================
#  ADMIN ROUTES
# ================================================================
@app.route('/api/admin/stats')
@login_required('admin')
def admin_stats():
    total_stu = query('SELECT COUNT(*) AS cnt FROM students', fetch='one')['cnt']
    placed    = query("SELECT COUNT(*) AS cnt FROM students WHERE placement_status='Placed'", fetch='one')['cnt']
    drives    = query('SELECT COUNT(*) AS cnt FROM jobs', fetch='one')['cnt']
    pending   = query(
        'SELECT (SELECT COUNT(*) FROM students WHERE verified=0)+(SELECT COUNT(*) FROM recruiters WHERE verified=0) AS cnt',
        fetch='one'
    )['cnt']
    return ok({'total_students': int(total_stu), 'placed': int(placed), 'drives': int(drives), 'pending': int(pending)})


@app.route('/api/admin/students')
@login_required('admin')
def admin_get_students():
    students = query(
        'SELECT id,enrollment,name,email,branch,cgpa,placement_status,verified,debarred,reg_date FROM students ORDER BY reg_date DESC'
    )
    for s in students:
        if s.get('reg_date'): s['reg_date'] = str(s['reg_date'])
        s['cgpa'] = float(s['cgpa']) if s.get('cgpa') else 0
    return ok(students)


@app.route('/api/admin/verify-student/<enrollment>', methods=['POST'])
@login_required('admin')
def verify_student(enrollment):
    execute('UPDATE students SET verified=1 WHERE enrollment=%s', (enrollment,))
    return ok(msg=f'Student {enrollment} verified.')


@app.route('/api/admin/debar-student/<enrollment>', methods=['POST'])
@login_required('admin')
def debar_student(enrollment):
    try:
        d   = request.get_json(force=True)
    except Exception:
        d = {}
    val = 1 if d.get('debar', True) else 0
    execute('UPDATE students SET debarred=%s WHERE enrollment=%s', (val, enrollment))
    return ok(msg='Status updated.')


@app.route('/api/admin/update-placement', methods=['POST'])
@login_required('admin')
def update_placement():
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid data.')
    execute('UPDATE students SET placement_status=%s WHERE enrollment=%s',
            (d.get('status','Seeking'), d.get('enrollment')))
    return ok(msg='Placement status updated.')


@app.route('/api/admin/recruiters')
@login_required('admin')
def admin_get_recruiters():
    recs = query(
        'SELECT id,name,email,company,position,phone,verified,reg_date FROM recruiters ORDER BY reg_date DESC'
    )
    for r in recs:
        if r.get('reg_date'): r['reg_date'] = str(r['reg_date'])
    return ok(recs)


@app.route('/api/admin/verify-recruiter/<int:rec_id>', methods=['POST'])
@login_required('admin')
def verify_recruiter(rec_id):
    execute('UPDATE recruiters SET verified=1 WHERE id=%s', (rec_id,))
    return ok(msg='Recruiter verified.')


@app.route('/api/admin/delete-recruiter/<int:rec_id>', methods=['DELETE'])
@login_required('admin')
def delete_recruiter(rec_id):
    execute('DELETE FROM recruiters WHERE id=%s', (rec_id,))
    return ok(msg='Recruiter removed.')


@app.route('/api/admin/drives')
@login_required('admin')
def admin_get_drives():
    jobs = query(
        '''SELECT j.*,r.email AS rec_email,r.company AS rec_company,
                  (SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) AS app_count
           FROM jobs j JOIN recruiters r ON j.posted_by=r.id
           ORDER BY j.created_at DESC'''
    )
    for j in jobs:
        j['min_cgpa'] = float(j['min_cgpa']) if j.get('min_cgpa') else 0
        if j.get('drive_date'):  j['drive_date']  = str(j['drive_date'])
        if j.get('created_at'): j['created_at']  = str(j['created_at'])
    return ok(jobs)


@app.route('/api/admin/delete-drive/<int:job_id>', methods=['DELETE'])
@login_required('admin')
def admin_delete_drive(job_id):
    execute('DELETE FROM jobs WHERE id=%s', (job_id,))
    return ok(msg='Drive removed.')


@app.route('/api/admin/courses')
@login_required('admin')
def admin_get_courses():
    courses = query('SELECT * FROM courses ORDER BY category,branch,sem')
    for c in courses:
        if c.get('created_at'): c['created_at'] = str(c['created_at'])
    return ok(courses)


@app.route('/api/admin/add-course', methods=['POST'])
@login_required('admin')
def admin_add_course():
    try:
        d = request.get_json(force=True)
    except Exception:
        return err('Invalid data.')

    title = (d.get('title') or '').strip()
    yt    = (d.get('yt_link') or '').strip()
    badge = (d.get('badge') or '').strip()

    if not title:
        return err('Course title zaroori hai.')
    if not yt:
        return err('YouTube link zaroori hai.')
    if not badge:
        return err('Badge name zaroori hai.')

    yt_id = extract_yt_id(yt)

    import time
    course_key = 'adm_' + str(int(time.time()))

    try:
        execute(
            'INSERT INTO courses (course_key,title,category,branch,sem,badge,yt_video_id,yt_link,total_lectures) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',
            (
                course_key,
                title,
                d.get('category', 'PLACEMENT_PREP'),
                d.get('branch', 'ALL'),
                d.get('sem', 'ALL'),
                badge,
                yt_id,
                yt,
                int(d.get('total_lectures', 10))
            )
        )
    except mysql.connector.Error as e:
        return err(f'Course add nahi ho saka: {str(e)}')

    return ok(msg='Course successfully add ho gaya!')


@app.route('/api/admin/delete-course/<course_key>', methods=['DELETE'])
@login_required('admin')
def admin_delete_course(course_key):
    execute('DELETE FROM courses WHERE course_key=%s', (course_key,))
    return ok(msg='Course deleted.')


# ================================================================
#  RUN
# ================================================================
if __name__ == '__main__':
    print("=" * 55)
    print("  T&P Portal — Rewa Engineering College")
    print("  Server: http://localhost:5000")
    print("  Admin:  tpo_admin / admin@rec123")
    print("=" * 55)
    app.run(debug=True, host='0.0.0.0', port=5000)
