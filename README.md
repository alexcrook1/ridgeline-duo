# Ridgeline Duo

A shared health & fitness coach app for two people — scale photo readings, AI food calorie estimation,
weekly AI body check-ins, goal planning, fasting schedules, and a daily 9pm competitive log with
shared dashboards.

## Local dev

```
npm install
npm run dev
```

## Deploy (Vercel)

1. Import this repo at vercel.com/new
2. Add an environment variable: `ANTHROPIC_API_KEY` = your Anthropic API key (Production + Preview)
3. Deploy

## Firestore security rules

The Firebase project starts in test mode (open access) which is fine for two known users but should
be tightened. In the Firebase console → Firestore → Rules, use something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /entries/{doc} {
      allow read, write: if true; // tighten with auth once you add sign-in
    }
  }
}
```

For real protection later, add Firebase Auth (e.g. a shared passphrase or email link) and restrict
`allow read, write: if request.auth != null;`.

## How data is shared

Each device picks "who am I" once — stored locally on that device only. All logged data (weigh-ins,
food, activity, goals, weekly check-ins) is stored in Firestore under an `entries` collection keyed
by things like `weighins:Alex:2026-08-22`, so both partners' devices read and write the same shared
pool and each dashboard filters to show "me" vs "my partner".
