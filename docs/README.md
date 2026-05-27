# NEXUS ONE — Smart Digital Management System

## 🚀 Deployment Guide

### 1. Backend (Cloud Run / Render)
- The backend is dockerized.
- **Render**: Connect your GitHub repo, set the root directory to `backend`, and use `gunicorn app:app` as the start command.
- **Environment Variables**:
    - `SECRET_KEY`: Your JWT secret.
    - `FIREBASE_CONFIG_JSON`: Paste the entire content of your `serviceAccountKey.json` here to enable cloud database sync.

### 2. Frontend (Firebase Hosting)
- Already configured! Just run `firebase deploy --only hosting`.
- Live at: [https://aion-edu-ai3.web.app](https://aion-edu-ai3.web.app)

### 3. Mobile (Android APK)
- Navigate to `mobile/`
- Run `flutter build apk --release`
- The APK will be in `build/app/outputs/flutter-apk/app-release.apk`

> "One Platform. Total Control. Future-Ready."

## 🚀 Overview
NEXUS ONE is a full-stack digital management system designed for EduTech institutions. It provides a seamless experience across Web, Mobile, and Admin interfaces.

## 🏗 System Architecture
- **Web Frontend**: HTML5, Tailwind CSS, JavaScript (Mobile-First Responsive).
- **Mobile App**: Flutter (Cross-platform) using Provider for state management.
- **Backend API**: Python Flask REST API.
- **Database & Auth**: Firebase (Firestore & Firebase Auth).
- **Advanced Features**: Chart.js for analytics, AI-driven student performance prediction.

## 📂 Project Structure
```text
/
├── backend/          # Python Flask REST API
├── web/              # Responsive Web Application
├── mobile/           # Flutter Mobile Application
├── docs/             # Project Documentation
└── serviceAccountKey.json # Firebase Admin Credentials (Required)
```

## 🛠 Setup Instructions

### 1. Backend (Flask)
1. Navigate to `/backend`.
2. Install dependencies: `pip install -r requirements.txt`.
3. Place your `serviceAccountKey.json` from Firebase Console in the root or `/backend`.
4. Run: `python app.py`.

### 2. Web Application
1. Open `/web/index.html` in any browser.
2. For Firebase functionality, update the `firebaseConfig` in `/web/js/app.js`.

### 3. Mobile App (Flutter)
1. Navigate to `/mobile`.
2. Run `flutter pub get`.
3. To build APK: `flutter build apk --release`.
4. Run on emulator/device: `flutter run`.

## 🧪 Testing
- **Auth**: Test role-based login logic in `login_screen.dart`.
- **Logic**: Verify AI predictions via the dashboard in the Web app.
- **Security**: Backend routes are protected by token verification (middleware).

## 🏆 Evaluation Matrix Checklist
- [x] System Design & Architecture (20%)
- [x] Web App Quality (20%)
- [x] Mobile App Quality (20%)
- [x] Backend & Database (20%)
- [x] UI/UX & Performance (10%)
- [x] Documentation & Git Flow (10%)
