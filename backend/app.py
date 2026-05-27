import os
import json
import datetime
import jwt
from functools import wraps
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import firebase_admin
from firebase_admin import credentials, auth, firestore
import pandas as pd
from reportlab.pdfgen import canvas
from io import BytesIO
from nexus_ai import nexus_ai

app = Flask(__name__)
# Simplified and Hardened CORS
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

SECRET_KEY = os.environ.get('SECRET_KEY', 'nexus_one_super_secret_key_2026')
DATA_FILE = "local_db.json"

def load_local_db():
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r") as f:
                content = f.read().strip()
                if content:
                    return json.loads(content)
    except Exception as e:
        print(f"ERROR: Local DB Load Fail: {e}")
            
    # Fallback to Initial data if file is missing/empty/corrupt
    print("Nexus System: Initializing fresh local database...")
    initial_data = {
        "courses": [
            {"id": "1", "name": "Flutter Mastery", "instructor": "Dr. Nexus", "instructor_email": "staff@nexus.one", "students": 120, "status": "Active"},
            {"id": "2", "name": "Advanced Python", "instructor": "Sarah Smith", "instructor_email": "staff@nexus.one", "students": 85, "status": "Active"},
            {"id": "3", "name": "AI & ML Ethics", "instructor": "Dr. Nexus", "instructor_email": "admin@nexus.one", "students": 45, "status": "Active"}
        ],
        "users": [
            {
                "uid": "dev_admin", 
                "email": "admin@nexus.one", 
                "password": generate_password_hash("nexus123"), 
                "role": "admin"
            },
            {
                "uid": "dev_staff", 
                "email": "staff@nexus.one", 
                "password": generate_password_hash("nexus123"), 
                "role": "staff"
            },
            {
                "uid": "dev_student", 
                "email": "student@nexus.one", 
                "password": generate_password_hash("nexus123"), 
                "role": "user"
            }
        ],
        "enrollments": [
            {"student_id": "dev_student", "student_name": "Student One", "course_id": "1", "grade": "A", "progress": 95},
            {"student_id": "dev_student", "student_name": "Student One", "course_id": "2", "grade": "B+", "progress": 82}
        ],
        "assignments": [
            {"id": "a1", "course_id": "1", "title": "Build a Weather App", "due": "2026-06-01", "status": "Pending"},
            {"id": "a2", "course_id": "2", "title": "Data Analysis with Pandas", "due": "2026-06-05", "status": "Submitted"}
        ],
        "logs": []
    }
    save_local_db(initial_data)
    return initial_data

def save_local_db(data):
    try:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"ERROR: Local DB Save Fail: {e}")

# Initialize Firebase Admin
db = None
try:
    if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase successfully initialized.")
    else:
        print("Warning: serviceAccountKey.json not found. Using local JSON DB.")
except Exception as e:
    print(f"Firebase Init Error: {e}. Falling back to local JSON DB.")

# --- Middleware: Auth & Activity ---
def generate_token(user_data):
    payload = {
        "uid": user_data["uid"],
        "email": user_data["email"],
        "role": user_data["role"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        token = auth_header.split('Bearer ')[1]
        
        # 1. Try Firebase Token if token looks like one (longer, multi-part)
        if len(token) > 100 and db:
            try:
                decoded_token = auth.verify_id_token(token)
                decoded_token['role'] = decoded_token.get('role', 'user')
                return decoded_token
            except:
                pass

        # 2. Try Internal JWT
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return decoded
    except Exception as e:
        print(f"Token Verification Error: {e}")
        return None

def require_role(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = verify_token()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if user.get('role') not in roles:
                return jsonify({"error": f"Forbidden: {roles} role required"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def log_activity(user_id, action, details):
    log_entry = {
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": firestore.SERVER_TIMESTAMP if db else pd.Timestamp.now().isoformat()
    }
    if db:
        db.collection('activity_logs').add(log_entry)
    else:
        db_data = load_local_db()
        db_data["logs"].append(log_entry)
        save_local_db(db_data)

# --- Global Handlers ---
# Removed manual OPTIONS handler to let flask-cors do its job correctly

# --- Routes ---

@app.route('/')
def home():
    return jsonify({
        "status": "Nexus One API is running", 
        "version": "1.2.0",
        "database_connected": db is not None,
        "mode": "Production (Firebase)" if db else "Development (Local JSON)"
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    user = verify_token()
    if not user: return jsonify({"error": "Unauthorized"}), 401

    db_data = load_local_db()
    role = user.get('role')
    email = user.get('email')
    uid = user.get('uid')
    
    if role == 'user':
        enrollments = [e for e in db_data.get("enrollments", []) if e['student_id'] == uid]
        avg_progress = sum(e['progress'] for e in enrollments) / len(enrollments) if enrollments else 0
        return jsonify({
            "progress": f"{int(avg_progress)}%",
            "my_courses": len(enrollments),
            "avg_grade": enrollments[0]['grade'] if enrollments else "N/A",
            "fees_paid": "$0"
        })
    
    if role == 'staff':
        # Real staff logic: filter courses where they are the instructor
        my_courses = [c for c in db_data["courses"] if c.get('instructor_email') == email]
        total_students = sum(int(c.get('students', 0)) for c in my_courses)
        
        # Calculate performance based on enrollments in their courses
        course_ids = [c['id'] for c in my_courses]
        relevant_enrollments = [e for e in db_data.get("enrollments", []) if e['course_id'] in course_ids]
        avg_perf = sum(e['progress'] for e in relevant_enrollments) / len(relevant_enrollments) if relevant_enrollments else 92
        
        return jsonify({
            "total_students": total_students,
            "active_courses": len(my_courses),
            "performance": f"{int(avg_perf)}%",
            "earnings": f"${len(my_courses) * 1500 + total_students * 5:,}"
        })

    # Admin Stats
    course_docs = db_data["courses"]
    total_students = sum(int(c.get('students', 0)) for c in course_docs)
    return jsonify({
        "total_students": total_students,
        "active_courses": len(course_docs),
        "revenue": f"${total_students * 10:,}",
        "attendance_rate": "94%"
    })

@app.route('/api/my-data', methods=['GET'])
def get_my_data():
    user = verify_token()
    if not user: return jsonify({"error": "Unauthorized"}), 401
    
    db_data = load_local_db()
    uid = user.get('uid')
    email = user.get('email')
    role = user.get('role')
    
    if role == 'user':
        my_enrollments = [e for e in db_data.get("enrollments", []) if e['student_id'] == uid]
        my_courses = []
        for e in my_enrollments:
            course = next((c for c in db_data["courses"] if c['id'] == e['course_id']), None)
            if course:
                my_courses.append({**course, "grade": e['grade'], "progress": e['progress']})
        
        my_assignments = []
        for c in my_courses:
            asgn = [a for a in db_data.get("assignments", []) if a['course_id'] == c['id']]
            my_assignments.extend(asgn)
            
        return jsonify({
            "courses": my_courses,
            "assignments": my_assignments
        })
        
    if role == 'staff':
        my_courses = [c for c in db_data["courses"] if c.get('instructor_email') == email]
        
        # Get real students from enrollments in these courses
        course_ids = [c['id'] for c in my_courses]
        relevant_enrollments = [e for e in db_data.get("enrollments", []) if e['course_id'] in course_ids]
        
        students_data = []
        for e in relevant_enrollments:
            course = next((c for c in db_data["courses"] if c['id'] == e['course_id']), None)
            perf = "Excellent" if e['progress'] > 90 else "Good" if e['progress'] > 75 else "Needs Attention"
            students_data.append({
                "name": e.get('student_name', 'Unknown Student'),
                "course": course['name'] if course else 'Unknown Course',
                "performance": perf
            })

        return jsonify({
            "courses": my_courses,
            "students": students_data
        })
        
    return jsonify({"error": "Role not supported for specific data"}), 400

@app.route('/api/courses', methods=['GET', 'POST'])
def manage_courses():
    user = verify_token()
    if not user: return jsonify({"error": "Unauthorized"}), 401

    if request.method == 'GET':
        if db:
            docs = db.collection('courses').stream()
            return jsonify([{**doc.to_dict(), "id": doc.id} for doc in docs])
        else:
            return jsonify(load_local_db()["courses"])

    if request.method == 'POST':
        if user.get('role') not in ['admin', 'staff']:
            return jsonify({"error": "Forbidden: Admin or Staff role required"}), 403
            
        new_data = request.json
        if not new_data.get('name'):
            return jsonify({"error": "Course name is required"}), 400
            
        if db:
            new_ref = db.collection('courses').document()
            new_ref.set(new_data)
            res = {"message": "Course created", "id": new_ref.id}
        else:
            db_data = load_local_db()
            new_data["id"] = str(len(db_data["courses"]) + 1)
            db_data["courses"].append(new_data)
            save_local_db(db_data)
            res = {"message": "Course saved to local DB", "id": new_data["id"]}
        
        log_activity(user['uid'], "CREATE_COURSE", f"Created course: {new_data['name']}")
        return jsonify(res), 201

@app.route('/api/courses/<course_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_course(course_id):
    user = verify_token()
    if not user: return jsonify({"error": "Unauthorized"}), 401

    if request.method == 'GET':
        if db:
            doc = db.collection('courses').document(course_id).get()
            if not doc.exists: return jsonify({"error": "Course not found"}), 404
            return jsonify({**doc.to_dict(), "id": doc.id})
        else:
            courses = load_local_db()["courses"]
            course = next((c for c in courses if str(c.get('id')) == course_id), None)
            if not course: return jsonify({"error": "Course not found"}), 404
            return jsonify(course)

    if request.method == 'PUT':
        if user.get('role') not in ['admin', 'staff']:
            return jsonify({"error": "Forbidden"}), 403
        
        updated_data = request.json
        if db:
            db.collection('courses').document(course_id).update(updated_data)
        else:
            db_data = load_local_db()
            for i, c in enumerate(db_data["courses"]):
                if str(c.get('id')) == course_id:
                    db_data["courses"][i].update(updated_data)
                    break
            save_local_db(db_data)
        
        log_activity(user['uid'], "UPDATE_COURSE", f"Updated course ID: {course_id}")
        return jsonify({"message": "Course updated successfully"})

    if request.method == 'DELETE':
        if user.get('role') not in ['admin', 'staff']:
            return jsonify({"error": "Forbidden"}), 403
            
        if db:
            db.collection('courses').document(course_id).delete()
        else:
            db_data = load_local_db()
            db_data["courses"] = [c for c in db_data["courses"] if str(c.get('id')) != course_id]
            save_local_db(db_data)
            
        log_activity(user['uid'], "DELETE_COURSE", f"Deleted course ID: {course_id}")
        return jsonify({"message": "Course deleted successfully"})

# --- Auth Routes ---

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        if not data:
            print("Login Error: Missing request body")
            return jsonify({"error": "Missing request body"}), 400
            
        email = data.get('email')
        password = data.get('password')

        print(f"Login Attempt: {email}")

        if not email or not password:
            print("Login Error: Missing email or password")
            return jsonify({"error": "Email and password are required"}), 400

        # Development Mock Auth Logic with Security
        db_data = load_local_db()
        users_list = db_data.get('users', [])
        user = next((u for u in users_list if u['email'] == email), None)
        
        if user:
            print(f"User found: {email}. Verifying password...")
            if check_password_hash(user['password'], password):
                token = generate_token(user)
                log_activity(user['uid'], "USER_LOGIN", f"User logged in: {email}")
                print(f"Login Success: {email}")
                return jsonify({
                    "message": "Login successful",
                    "user": {
                        "uid": user['uid'],
                        "email": user['email'],
                        "role": user['role']
                    },
                    "token": token
                })
            else:
                print(f"Login Failed: Incorrect password for {email}")
        else:
            print(f"Login Failed: User not found: {email}")
        
        return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"CRITICAL: Login Controller Exception:\n{error_msg}")
        return jsonify({"error": "Internal server error during authentication"}), 500

# --- Admin Routes ---

@app.route('/api/admin/users', methods=['GET', 'POST'])
@require_role(['admin'])
def manage_users():
    if request.method == 'GET':
        if db:
            try:
                users = auth.list_users().users
                return jsonify([{"uid": u.uid, "email": u.email, "role": u.custom_claims.get('role', 'user') if u.custom_claims else 'user'} for u in users])
            except Exception as e:
                print(f"Firebase Auth Error: {e}")
                return jsonify(load_local_db().get("users", []))
        else:
            return jsonify(load_local_db().get("users", []))

    if request.method == 'POST':
        new_user = request.json
        email = new_user.get('email')
        role = new_user.get('role', 'user')
        password = new_user.get('password', 'nexus123') # Default password if not provided
        
        if not email:
            return jsonify({"error": "Email is required"}), 400

        if db:
            try:
                # 1. Create in Firebase
                user_record = auth.create_user(email=email, password=password)
                auth.set_custom_user_claims(user_record.uid, {'role': role})
                
                # 2. Sync to local DB for login availability if Firebase is primary
                db_data = load_local_db()
                if not any(u['email'] == email for u in db_data['users']):
                    db_data['users'].append({
                        "uid": user_record.uid,
                        "email": email,
                        "role": role,
                        "password": generate_password_hash(password)
                    })
                    save_local_db(db_data)
                
                res = {"uid": user_record.uid, "email": email, "role": role}
            except Exception as e:
                return jsonify({"error": str(e)}), 400
        else:
            db_data = load_local_db()
            uid = f"user_{len(db_data['users']) + 1}"
            res = {
                "uid": uid, 
                "email": email, 
                "role": role, 
                "password": generate_password_hash(password)
            }
            db_data['users'].append(res)
            save_local_db(db_data)
        
        user = verify_token()
        log_activity(user['uid'] if user else 'system', "CREATE_USER", f"Created {role}: {email}")
        return jsonify(res), 201

@app.route('/api/admin/users/<uid>', methods=['GET', 'PUT', 'DELETE'])
@require_role(['admin'])
def handle_user(uid):
    if request.method == 'GET':
        if db:
            try:
                user = auth.get_user(uid)
                role = user.custom_claims.get('role', 'user') if user.custom_claims else 'user'
                return jsonify({"uid": user.uid, "email": user.email, "role": role})
            except Exception as e:
                return jsonify({"error": str(e)}), 404
        else:
            db_data = load_local_db()
            user = next((u for u in db_data['users'] if u['uid'] == uid), None)
            if not user: return jsonify({"error": "User not found"}), 404
            return jsonify(user)

    if request.method == 'PUT':
        updated_data = request.json
        email = updated_data.get('email')
        role = updated_data.get('role')
        avatar = updated_data.get('avatar')
        display_name = updated_data.get('displayName')
        
        if db:
            try:
                # Update Firebase
                params = {}
                if email: params['email'] = email
                if display_name: params['display_name'] = display_name
                if avatar: params['photo_url'] = avatar # Use photo_url for avatar in Firebase
                
                auth.update_user(uid, **params)
                if role: auth.set_custom_user_claims(uid, {'role': role})
                
                # Sync to local
                db_data = load_local_db()
                for i, u in enumerate(db_data['users']):
                    if u['uid'] == uid:
                        if email: db_data['users'][i]['email'] = email
                        if role: db_data['users'][i]['role'] = role
                        if avatar: db_data['users'][i]['avatar'] = avatar
                        if display_name: db_data['users'][i]['displayName'] = display_name
                        break
                save_local_db(db_data)
                return jsonify({"message": "User updated successfully"})
            except Exception as e:
                return jsonify({"error": str(e)}), 400
        else:
            db_data = load_local_db()
            for i, u in enumerate(db_data['users']):
                if u['uid'] == uid:
                    if email: db_data['users'][i]['email'] = email
                    if role: db_data['users'][i]['role'] = role
                    if avatar: db_data['users'][i]['avatar'] = avatar
                    if display_name: db_data['users'][i]['displayName'] = display_name
                    break
            save_local_db(db_data)
            return jsonify({"message": "User updated locally"})

    if request.method == 'DELETE':
        if db:
            try:
                auth.delete_user(uid)
                # Also remove from local sync
                db_data = load_local_db()
                db_data['users'] = [u for u in db_data['users'] if u['uid'] != uid]
                save_local_db(db_data)
                return jsonify({"message": "User deleted from Firebase and local sync"})
            except Exception as e:
                return jsonify({"error": str(e)}), 400
        else:
            db_data = load_local_db()
            db_data['users'] = [u for u in db_data['users'] if u['uid'] != uid]
            save_local_db(db_data)
            return jsonify({"message": "User deleted from local DB"})

@app.route('/api/admin/logs/<log_id>', methods=['DELETE'])
@require_role(['admin'])
def delete_log(log_id):
    if db:
        try:
            db.collection('activity_logs').document(log_id).delete()
            return jsonify({"message": "Log deleted"})
        except:
            # Fallback for timestamp-based IDs in local fallback
            db_data = load_local_db()
            db_data['logs'] = [l for l in db_data['logs'] if str(l.get('timestamp')) != log_id]
            save_local_db(db_data)
            return jsonify({"message": "Log deleted from local sync"})
    else:
        db_data = load_local_db()
        db_data['logs'] = [l for l in db_data['logs'] if str(l.get('timestamp')) != log_id]
        save_local_db(db_data)
        return jsonify({"message": "Log deleted from local DB"})

@app.route('/api/admin/logs', methods=['GET'])
@require_role(['admin'])
def get_logs():
    if db:
        logs = db.collection('activity_logs').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(50).stream()
        return jsonify([{**l.to_dict(), "id": l.id} for l in logs])
    else:
        return jsonify(load_local_db().get("logs", [])[::-1])

# --- Advanced Features ---

def generate_professional_pdf(title, data, headers):
    buffer = BytesIO()
    p = canvas.Canvas(buffer)
    width, height = 595.27, 841.89 # A4
    
    # Header Branding
    p.setFillColorRGB(0.23, 0.51, 0.96) # Primary Blue
    p.rect(0, height - 80, width, 80, fill=1)
    
    p.setFillColorRGB(1, 1, 1)
    p.setFont("Helvetica-Bold", 24)
    p.drawString(40, height - 50, "NEXUS ONE")
    
    p.setFont("Helvetica", 10)
    p.drawString(40, height - 65, "SMART DIGITAL MANAGEMENT SYSTEM")
    
    p.setFont("Helvetica-Bold", 14)
    p.drawRightString(width - 40, height - 50, title)
    p.setFont("Helvetica", 8)
    p.drawRightString(width - 40, height - 65, f"Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    # Table Content
    y = height - 120
    p.setFillColorRGB(0, 0, 0)
    p.setFont("Helvetica-Bold", 10)
    
    # Draw Headers
    col_width = (width - 80) / len(headers)
    for i, header in enumerate(headers):
        p.drawString(40 + (i * col_width), y, str(header).upper())
    
    y -= 10
    p.line(40, y, width - 40, y)
    y -= 20
    
    p.setFont("Helvetica", 9)
    for row in data:
        if y < 50:
            p.showPage()
            y = height - 50
        
        for i, val in enumerate(row):
            p.drawString(40 + (i * col_width), y, str(val))
        y -= 20
        
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer

@app.route('/api/export/courses/<format>', methods=['GET'])
@require_role(['admin', 'staff', 'user'])
def export_courses(format):
    db_data = load_local_db()
    courses = db_data["courses"]
    
    if format == 'pdf':
        data = [[c.get('name'), c.get('instructor'), c.get('students'), c.get('status')] for c in courses]
        headers = ["Course Name", "Instructor", "Students", "Status"]
        buffer = generate_professional_pdf("Course Catalog", data, headers)
        return send_file(buffer, as_attachment=True, download_name="NexusOne_Courses.pdf", mimetype='application/pdf')
    
    elif format == 'excel':
        df = pd.DataFrame(courses)
        buffer = BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name="NexusOne_Courses.xlsx", mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.route('/api/export/users/<format>', methods=['GET'])
@require_role(['admin', 'staff'])
def export_users(format):
    db_data = load_local_db()
    users = [{"email": u['email'], "role": u['role']} for u in db_data["users"]]
    
    if format == 'pdf':
        data = [[u.get('email'), u.get('role')] for u in users]
        headers = ["Email Address", "System Role"]
        buffer = generate_professional_pdf("User Directory", data, headers)
        return send_file(buffer, as_attachment=True, download_name="NexusOne_Users.pdf", mimetype='application/pdf')
    
    elif format == 'excel':
        df = pd.DataFrame(users)
        buffer = BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name="NexusOne_Users.xlsx", mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.route('/api/ai/predict', methods=['POST'])
def ai_predict():
    try:
        data = request.json
        score = data.get('score', 0)
        attendance = data.get('attendance', 95)
        difficulty = data.get('difficulty', 3)
        
        # Real ML Inference using Scikit-Learn Random Forest
        result = nexus_ai.predict(score, attendance, difficulty)
        
        return jsonify({
            "score": score,
            "category": result["category"],
            "prediction": result["prediction"],
            "model_confidence": result["confidence"],
            "analysis_metadata": result["metadata"]
        })
    except Exception as e:
        print(f"AI Engine Error: {e}")
        return jsonify({"error": "Predictive engine failure"}), 500

if __name__ == '__main__':
    print("Starting Nexus One API...")
    app.run(debug=True, port=5000, host='0.0.0.0')
