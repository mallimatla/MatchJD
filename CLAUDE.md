# Neurogrid - AI-Powered Solar Development Platform

## Architecture: Vercel + Firebase

```
neurogrid/
├── src/                        # Next.js 14 Frontend (Vercel)
│   ├── app/                    # App Router pages
│   ├── components/             # React components
│   ├── lib/                    # Utilities & Firebase client
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript types
├── functions/                  # Firebase Cloud Functions (Backend)
│   └── src/
│       ├── agents/             # CrewAI agents
│       ├── workflows/          # LangGraph workflows
│       └── document-ai/        # Document processing
├── firebase.json               # Firebase configuration
├── firestore.rules            # Security rules
└── vercel.json                # Vercel configuration
```

## Tech Stack

### Frontend (Vercel)
- **Next.js 14** with App Router
- **TypeScript** strict mode
- **Tailwind CSS** + **shadcn/ui**
- **Firebase Client SDK** for auth & real-time data

### Backend (Firebase)
- **Cloud Functions** (Node.js 18) - API endpoints & AI processing
- **Firestore** - Document database with real-time sync
- **Firebase Storage** - Document file storage
- **Firebase Auth** - User authentication

### AI/ML
- **Claude API** - Document extraction & reasoning
- **LangGraph** - Workflow orchestration with state management
- **CrewAI** - Specialized agent teams

## Required API Keys

See `SETUP.md` for complete setup instructions.

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Build for production

# Firebase
npm run firebase:emulators  # Start local emulators
npm run firebase:deploy     # Deploy functions & rules

# Deployment
vercel                   # Deploy to Vercel
```
