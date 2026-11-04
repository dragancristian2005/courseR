# Study Planner

A study planner for a university timetable, homework, exams and notes. Phase 1 runs as an installable web app on iPhone, iPad and laptop, and keeps its data in Firebase (Firestore).

## 1. Firebase setup

1. In the Firebase console, create a project on the Spark (free) plan.
2. Under Authentication, enable the Google sign-in provider.
3. Under Firestore Database, create a database in production mode and pick a European location.
4. Under Project settings, register a web app and copy its config.
5. Copy `.env.example` to `.env` and fill in the six `EXPO_PUBLIC_FIREBASE_*` values.
6. Once hosting is deployed (section 3), set `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` to `<project-id>.web.app` and deploy again. The installed app signs in by redirect, and that only works when the auth domain is the same as the domain the app is served from. Otherwise iOS blocks the sign-in result.

## 2. Run locally

```
npm ci
npx expo start --web
```

Run the checks with `npx jest` and `npx tsc --noEmit`. Regenerate the app icons with `npm run icons`.

## 3. Deploy

```
npm install -g firebase-tools
firebase login
firebase use --add
npm run deploy
```

`npm run deploy` exports the web app to `dist/` and publishes it to Firebase Hosting together with the Firestore rules. The command prints the Hosting URL.

## 4. Install on iPhone or iPad

Open the Hosting URL in Safari, tap Share, then Add to Home Screen. Open the app from the new icon and sign in with Google.

## 5. Check that it works offline

1. Open the installed app, sign in and add a class.
2. Turn on airplane mode and reopen the app. Today should still show the class.
3. Add a note while offline.
4. Turn airplane mode off. The note should appear on a second device.
