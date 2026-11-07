# Study Planner

A study planner for a university timetable, homework, exams and notes. Phase 1 runs as an installable web app on iPhone, iPad and laptop, and keeps its data in Firebase (Firestore).

## 1. Firebase setup

1. In the Firebase console, create a project on the Spark (free) plan.
2. Under Authentication, enable the Google sign-in provider.
3. Under Firestore Database, create a database in production mode and pick a European location.
4. Under Project settings, register a web app and copy its config.
5. Copy `.env.example` to `.env` and fill in the six `EXPO_PUBLIC_FIREBASE_*` values.
6. Do this only after the first deploy (section 3). Until then keep the default `<project-id>.firebaseapp.com` as the auth domain. The installed app signs in by redirect, which only works when the auth domain is the domain the app is served from, so then:
   1. Set `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` to `<project-id>.web.app` in `.env` and deploy again.
   2. In the Google Cloud console, open APIs & Services, then Credentials, then the "Web client (auto created by Google Service)" entry. Add `https://<project-id>.web.app/__/auth/handler` under "Authorised redirect URIs". Without this, sign-in in the installed app fails with "redirect_uri_mismatch".
   3. In the Firebase console, open Authentication, then Settings, then Authorised domains, and check that `<project-id>.web.app` is listed. It is by default.

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
firebase use YOUR-PROJECT-ID --alias default
npm run deploy
```

Run these inside `planner/`. Replace `YOUR-PROJECT-ID` with the value of `EXPO_PUBLIC_FIREBASE_PROJECT_ID` from your `.env` (also shown in Firebase console → Project settings → General → Project ID). If `firebase login` can't open a browser, use `firebase login --no-localhost`. The `firebase use` command writes `.firebaserc`, which stays out of git.

`npm run deploy` exports the web app to `dist/` and publishes it to Firebase Hosting together with the Firestore rules. The command prints the Hosting URL.

## 4. Install on iPhone or iPad

Open the Hosting URL in Safari, tap Share, then Add to Home Screen. Open the app from the new icon and sign in with Google.

## 5. Check that it works offline

1. Open the installed app, sign in and add a class.
2. Turn on airplane mode and reopen the app. Today should still show the class.
3. Add a note while offline.
4. Turn airplane mode off. The note should appear on a second device.

## Import your timetable

You can fill the planner from a photo or PDF of your timetable. It works with a free Claude account and needs no API key.

1. Open Settings and tap Import timetable (on first launch, tap Import from a photo).
2. Tap Copy prompt.
3. Open Claude, attach the photo or PDF, paste the prompt and send it.
4. Copy Claude's whole answer, come back, tap Paste from clipboard (or paste into the box), then Check answer.
5. Pick your group, answer the questions and tap Save.

Nothing is saved until you tap Save. Exams work the same way: choose the exams import, then check the list and tap Save exams.
