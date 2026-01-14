# Complete Deployment Guide - Neurogrid

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Get API Keys](#2-get-api-keys)
3. [Firebase Setup](#3-firebase-setup)
4. [Local Development Setup](#4-local-development-setup)
5. [Deploy Firebase Functions](#5-deploy-firebase-functions)
6. [Deploy to Vercel](#6-deploy-to-vercel)
7. [Testing the Application](#7-testing-the-application)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

### Install Required Software

```bash
# 1. Install Node.js 18+ (required)
# Download from: https://nodejs.org/
# Verify installation:
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher

# 2. Install Firebase CLI
npm install -g firebase-tools
firebase --version  # Should show 13.x.x or higher

# 3. Install Vercel CLI
npm install -g vercel
vercel --version  # Should show 33.x.x or higher

# 4. Install Git (if not already installed)
git --version  # Should show 2.x.x or higher
```

### Verify All Tools Are Installed

```bash
# Run this command to check all tools:
node -v && npm -v && firebase --version && vercel --version && git --version
```

Expected output:
```
v18.19.0
9.8.1
13.0.2
33.0.1
git version 2.39.0
```

---

## 2. Get API Keys

### 2.1 Anthropic Claude API Key

**Time: ~5 minutes**

1. Go to **https://console.anthropic.com/**

2. Click **"Sign Up"** or **"Log In"**
   - Use Google or email to create account
   - Verify your email if required

3. Once logged in, click **"API Keys"** in the left sidebar

4. Click **"Create Key"** button

5. Name your key: `neurogrid-production`

6. **IMPORTANT**: Copy the key immediately! It won't be shown again.
   - Key format: `sk-ant-api03-xxxxxxxxxxxxxxxxxxxx`

7. Save it securely (password manager, secure note)

8. Add billing:
   - Go to **"Plans & Billing"** in sidebar
   - Add a credit card
   - Start with $20-50 for testing

**Your Claude API Key**: `sk-ant-api03-xxxxx` (save this!)

---

### 2.2 Firebase Project Setup

**Time: ~15 minutes**

#### Step 2.2.1: Create Firebase Project

1. Go to **https://console.firebase.google.com/**

2. Click **"Create a project"** (or "Add project")

3. Project name: `neurogrid` (or your preferred name)
   - Note: Firebase will add a unique suffix like `neurogrid-abc123`

4. Google Analytics:
   - Toggle OFF (not needed, simplifies setup)
   - Or keep ON if you want analytics

5. Click **"Create project"**

6. Wait 30-60 seconds for project creation

7. Click **"Continue"** when ready

#### Step 2.2.2: Enable Authentication

1. In Firebase Console, click **"Authentication"** in left sidebar

2. Click **"Get started"**

3. Click **"Sign-in method"** tab

4. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click "Save"

5. Enable **Google** (optional but recommended):
   - Click on "Google"
   - Toggle "Enable" to ON
   - Set "Project support email" (select your email)
   - Click "Save"

#### Step 2.2.3: Create Firestore Database

1. Click **"Firestore Database"** in left sidebar

2. Click **"Create database"**

3. Select **"Start in production mode"**
   - We'll add proper rules later

4. Choose location:
   - **Recommended**: `us-central1` (Iowa)
   - Or choose closest to your users
   - **IMPORTANT**: Location cannot be changed later!

5. Click **"Enable"**

6. Wait 1-2 minutes for database provisioning

#### Step 2.2.4: Enable Firebase Storage

1. Click **"Storage"** in left sidebar

2. Click **"Get started"**

3. Select **"Start in production mode"**

4. Choose **same location** as Firestore
   - Must match Firestore location!

5. Click **"Done"**

#### Step 2.2.5: Upgrade to Blaze Plan (Required for Functions)

1. Click **gear icon** ⚙️ next to "Project Overview"

2. Click **"Usage and billing"**

3. Click **"Details & settings"**

4. Click **"Modify plan"**

5. Select **"Blaze (pay as you go)"**

6. Add billing account:
   - Enter credit card details
   - Set budget alert (recommended: $25/month)

7. Click **"Purchase"**

**Note**: You won't be charged until you exceed free tier limits. Free tier includes:
- 50K auth users/month
- 1GB Firestore storage
- 50K Firestore reads/day
- 5GB Storage
- 2M function invocations/month

#### Step 2.2.6: Get Firebase Web App Configuration

1. Click **gear icon** ⚙️ → **"Project settings"**

2. Scroll down to **"Your apps"** section

3. Click **web icon** `</>` to add web app

4. Register app:
   - App nickname: `neurogrid-web`
   - Check "Also set up Firebase Hosting" (optional)
   - Click "Register app"

5. **COPY THE CONFIG OBJECT**:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "neurogrid-xxxxx.firebaseapp.com",
  projectId: "neurogrid-xxxxx",
  storageBucket: "neurogrid-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxxxxxxxxx"
};
```

6. Click "Continue to console"

**Save these values!**

#### Step 2.2.7: Get Firebase Admin SDK Service Account

1. In Project Settings, click **"Service accounts"** tab

2. Click **"Generate new private key"**

3. Click **"Generate key"** in confirmation dialog

4. A JSON file downloads (e.g., `neurogrid-xxxxx-firebase-adminsdk-xxxxx.json`)

5. **KEEP THIS FILE SECURE** - it has full admin access!

6. Open the file and note these values:
   - `private_key`: The long key starting with `-----BEGIN PRIVATE KEY-----`
   - `client_email`: Something like `firebase-adminsdk-xxxxx@neurogrid-xxxxx.iam.gserviceaccount.com`

---

### 2.3 (Optional) LangSmith API Key

**Time: ~5 minutes**

LangSmith helps debug AI workflows. Optional but helpful.

1. Go to **https://smith.langchain.com/**

2. Sign up or log in

3. Click **"Settings"** → **"API Keys"**

4. Click **"Create API Key"**

5. Name: `neurogrid`

6. Copy the key: `lsv2_pt_xxxxxxxxxxxxx`

---

## 3. Firebase Setup

### 3.1 Login to Firebase CLI

```bash
# Login to Firebase (opens browser)
firebase login

# Verify login
firebase projects:list
```

You should see your `neurogrid` project listed.

### 3.2 Initialize Firebase in Project

```bash
# Navigate to project directory
cd /path/to/neurogrid

# Initialize Firebase
firebase init
```

When prompted:

1. **Which Firebase features?**
   - Use arrow keys and SPACE to select:
     - ✅ Firestore
     - ✅ Functions
     - ✅ Storage
     - ✅ Emulators
   - Press ENTER

2. **Select project**:
   - Choose "Use an existing project"
   - Select your `neurogrid-xxxxx` project

3. **Firestore Rules**:
   - File: `firestore.rules` (press ENTER to accept)

4. **Firestore Indexes**:
   - File: `firestore.indexes.json` (press ENTER)

5. **Functions language**:
   - Select: `TypeScript`

6. **ESLint**:
   - Select: `No` (we have our own config)

7. **Install dependencies**:
   - Select: `Yes`

8. **Storage Rules**:
   - File: `storage.rules` (press ENTER)

9. **Emulators**:
   - Select all:
     - ✅ Authentication
     - ✅ Functions
     - ✅ Firestore
     - ✅ Storage
   - Use default ports (press ENTER for each)
   - Download emulators: `Yes`

### 3.3 Set Up Functions Environment Variables

```bash
# Navigate to functions directory
cd functions

# Set Anthropic API key as a secret
firebase functions:secrets:set ANTHROPIC_API_KEY
# When prompted, paste your Claude API key: sk-ant-api03-xxxxx

# Verify secret was set
firebase functions:secrets:access ANTHROPIC_API_KEY
```

### 3.4 Update Functions to Use Secret

The functions are already configured to use `process.env.ANTHROPIC_API_KEY`. Firebase automatically injects secrets as environment variables.

---

## 4. Local Development Setup

### 4.1 Install Dependencies

```bash
# From project root
cd /path/to/neurogrid

# Install frontend dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..
```

### 4.2 Create Environment File

Create `.env.local` in the project root:

```bash
# Create .env.local file
cat > .env.local << 'EOF'
# Firebase Client Configuration
# Get these from Firebase Console > Project Settings > Your apps
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=neurogrid-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=neurogrid-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=neurogrid-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:xxxxxxxxxxxxxxxxxxxx
EOF
```

**IMPORTANT**: Replace the placeholder values with your actual Firebase config!

### 4.3 Create Functions Environment File

Create `functions/.env`:

```bash
cat > functions/.env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF
```

**IMPORTANT**: Replace with your actual Anthropic API key!

### 4.4 Build Functions

```bash
cd functions
npm run build
cd ..
```

### 4.5 Start Firebase Emulators

```bash
# Terminal 1: Start emulators
firebase emulators:start
```

You should see:
```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
├─────────────────────────────────────────────────────────────┤
│ View Emulator UI at http://127.0.0.1:4000                   │
├─────────────────────────────────────────────────────────────┤
│ Auth Emulator at http://127.0.0.1:9099                      │
│ Functions Emulator at http://127.0.0.1:5001                 │
│ Firestore Emulator at http://127.0.0.1:8080                 │
│ Storage Emulator at http://127.0.0.1:9199                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Start Next.js Development Server

```bash
# Terminal 2: Start Next.js
npm run dev
```

You should see:
```
▲ Next.js 14.2.0
- Local: http://localhost:3000
```

### 4.7 Test Local Setup

1. Open **http://localhost:3000** in browser

2. You should see the login page

3. Click "Sign up" and create an account

4. You should be redirected to dashboard

5. Open **http://localhost:4000** (Emulator UI)
   - Check "Authentication" tab - your user should appear
   - Check "Firestore" tab - a users collection should exist

---

## 5. Deploy Firebase Functions

### 5.1 Build and Deploy Functions

```bash
# From project root
cd functions
npm run build

# Deploy all Firebase resources
cd ..
firebase deploy
```

This deploys:
- Firestore security rules
- Firestore indexes
- Storage security rules
- Cloud Functions

### 5.2 Verify Deployment

1. Go to **Firebase Console** → **Functions**

2. You should see these functions:
   - `onDocumentUploaded`
   - `getUploadUrl`
   - `processDocument`
   - `resolveReview`
   - `getReviewQueue`
   - `startWorkflow`
   - `getWorkflowStatus`
   - `runAgentTask`
   - `getProjects`
   - `getDocuments`

3. Check each function shows "Active" status

### 5.3 Set Production Secrets

```bash
# Set the Anthropic API key for production
firebase functions:secrets:set ANTHROPIC_API_KEY
# Enter your key when prompted
```

### 5.4 Redeploy Functions with Secrets

```bash
firebase deploy --only functions
```

---

## 6. Deploy to Vercel

### 6.1 Prepare for Vercel

```bash
# Login to Vercel
vercel login
```

### 6.2 Link Project to Vercel

```bash
# From project root
vercel link
```

When prompted:
1. Set up and deploy: `Y`
2. Which scope: Select your account
3. Link to existing project: `N` (create new)
4. Project name: `neurogrid`
5. Directory: `./` (current directory)

### 6.3 Add Environment Variables

```bash
# Add each environment variable
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
# When prompted: Select all environments (Production, Preview, Development)
# Paste value: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# Paste: neurogrid-xxxxx.firebaseapp.com

vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
# Paste: neurogrid-xxxxx

vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
# Paste: neurogrid-xxxxx.appspot.com

vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
# Paste: 123456789012

vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
# Paste: 1:123456789012:web:xxxxxxxxxxxxxxxxxxxx
```

### 6.4 Deploy to Production

```bash
vercel deploy --prod
```

You'll get a URL like: `https://neurogrid-xxxxx.vercel.app`

### 6.5 Configure Firebase Auth Domain

1. Go to **Firebase Console** → **Authentication** → **Settings**

2. Click **"Authorized domains"** tab

3. Click **"Add domain"**

4. Add your Vercel domain: `neurogrid-xxxxx.vercel.app`

5. Click **"Add"**

---

## 7. Testing the Application

### 7.1 Run Automated Tests

```bash
# Install test dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Run tests
npm test
```

### 7.2 Manual Testing Checklist

#### Test 1: Authentication
- [ ] Go to your Vercel URL
- [ ] Click "Sign Up"
- [ ] Enter email and password
- [ ] Verify you're redirected to dashboard
- [ ] Sign out
- [ ] Sign back in
- [ ] Test Google sign-in (if enabled)

#### Test 2: Create Project
- [ ] Click "New Project"
- [ ] Fill in project details:
  - Name: "Test Solar Farm"
  - Type: "Utility Solar"
  - State: "TX"
  - County: "Travis"
  - Capacity: 100 MW AC
- [ ] Click "Create Project"
- [ ] Verify project appears in dashboard

#### Test 3: Upload Document
- [ ] Click on your test project
- [ ] Click "Upload" tab
- [ ] Drop a PDF file (see sample below)
- [ ] Watch status change: uploading → processing → review_required/approved
- [ ] Check "Documents" tab for the uploaded file

#### Test 4: Review Queue
- [ ] If document requires review, go to Dashboard
- [ ] Click "Review Queue" tab
- [ ] You should see the pending review
- [ ] Click "Approve" or "Reject"
- [ ] Verify document status updates

### 7.3 Sample Test Document

Create a simple test lease document (save as `test-lease.txt`):

```
SOLAR LAND LEASE AGREEMENT

This Lease Agreement ("Agreement") is entered into as of January 15, 2024.

PARTIES:
Lessor: John Smith, an individual
Address: 123 Farm Road, Austin, TX 78701

Lessee: SolarDev LLC, a Delaware limited liability company
Address: 456 Energy Drive, Houston, TX 77001

PROPERTY:
The Lessor hereby leases to Lessee approximately 500 acres of land located in
Travis County, Texas, more particularly described as:
Parcel Number: APN-123-456-789

TERM:
Initial Term: 25 years
Commencement Date: March 1, 2024
Expiration Date: February 28, 2049

RENT:
Base Rent: $500 per acre per year
Annual Escalation: 2% per year
Signing Bonus: $50,000

EXTENSION OPTIONS:
Two (2) five-year extension options with 180 days written notice.

PERMITTED USES:
Solar energy generation, battery storage, and related infrastructure.

PURCHASE OPTION:
Lessee has option to purchase at fair market value with 12 months notice.

TERMINATION:
Either party may terminate with 180 days written notice for material breach.
```

### 7.4 Test API Endpoints

```bash
# Test from command line (requires jq)

# 1. Get ID token (use Firebase Auth REST API)
# First, sign in via the UI and get token from browser console:
# In browser console: await firebase.auth().currentUser.getIdToken()

# 2. Test with curl
TOKEN="your-id-token-here"

# Test getProjects
curl -X POST \
  https://us-central1-YOUR-PROJECT.cloudfunctions.net/getProjects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 8. Troubleshooting

### Problem: "Permission denied" in Firestore

**Solution**:
1. Check you're logged in (verify in Firebase Console → Authentication)
2. Verify security rules are deployed: `firebase deploy --only firestore:rules`
3. Check tenant ID matches user ID

### Problem: Functions not processing documents

**Solution**:
1. Check function logs: `firebase functions:log`
2. Verify ANTHROPIC_API_KEY is set: `firebase functions:secrets:access ANTHROPIC_API_KEY`
3. Redeploy functions: `firebase deploy --only functions`

### Problem: "Module not found" in functions

**Solution**:
```bash
cd functions
rm -rf node_modules lib
npm install
npm run build
firebase deploy --only functions
```

### Problem: CORS errors

**Solution**:
1. Verify domain is in Firebase Auth authorized domains
2. Check Vercel URL matches exactly

### Problem: Upload fails

**Solution**:
1. Check file size < 50MB
2. Verify file type is PDF, DOC, DOCX, or image
3. Check Storage rules are deployed: `firebase deploy --only storage`

### Problem: Claude API errors

**Solution**:
1. Verify API key is correct
2. Check you have billing set up at console.anthropic.com
3. Check API key hasn't been revoked

---

## Quick Reference

### Commands

```bash
# Local development
npm run dev                    # Start Next.js
firebase emulators:start       # Start Firebase emulators

# Deployment
firebase deploy                # Deploy all Firebase
firebase deploy --only functions  # Deploy only functions
vercel deploy --prod          # Deploy to Vercel

# Debugging
firebase functions:log        # View function logs
firebase functions:secrets:access ANTHROPIC_API_KEY  # Check secret

# Testing
npm test                      # Run tests
npm run test:watch           # Run tests in watch mode
```

### URLs

| Service | Local | Production |
|---------|-------|------------|
| App | http://localhost:3000 | https://your-app.vercel.app |
| Firebase Emulator UI | http://localhost:4000 | N/A |
| Firebase Console | N/A | https://console.firebase.google.com |
| Vercel Dashboard | N/A | https://vercel.com/dashboard |

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| NEXT_PUBLIC_FIREBASE_* | Vercel + .env.local | Firebase client config |
| ANTHROPIC_API_KEY | Firebase Secrets | Claude API key |
| LANGCHAIN_API_KEY | Firebase Secrets (optional) | LangSmith tracing |
