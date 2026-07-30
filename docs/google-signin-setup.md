# Google Sign-In setup

Sign-in is Google-first on both surfaces. The code is in place; these are the
credentials only you can create.

## 1. Google Cloud console

1. Create (or pick) a project, then open **APIs & Services > Credentials**.
2. Configure the **OAuth consent screen**. External, and add your own address as
   a test user while the app is unverified. Scopes needed: `email`, `profile`,
   `openid`.
3. **Create Credentials > OAuth client ID > Web application.**
   - Authorised JavaScript origins: `http://localhost:3000` and your deployed
     origin.
   - Copy the client ID. This is the one that matters most: it is the audience
     the server verifies, and the Android app requests it too.
4. **Create Credentials > OAuth client ID > Android.**
   - Package name: `app.costly.companion`
   - SHA-1: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - For a release build, use the SHA-1 of your release keystore.
   - Android needs this entry to exist even though the token still carries the
     WEB client id as its audience.

## 2. Web

In `web/.env`:

```
GOOGLE_CLIENT_ID="<web client id>"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="<web client id>"
```

Both, and the same value: the server verifies with the first, the browser
renders the button with the second. Without them the sign-in step says so
instead of showing a dead button.

## 3. Android

In `~/.gradle/gradle.properties` (never commit this):

```
costlyGoogleWebClientId=<web client id>
```

or pass `-PcostlyGoogleWebClientId=<web client id>` at build time. The value
lands in `BuildConfig.GOOGLE_WEB_CLIENT_ID`; when it is blank the app hides the
Google button and offers email and password instead, so an unconfigured build
is still usable.

## Why the WEB client id on Android

Credential Manager requests a token whose `aud` claim is the web client id, and
the server verifies against exactly that. Passing the Android client id there
produces a token the server rejects, which is the most common way this is
mis-wired.

## What to check when it fails

- `invalid_google_token` from `/api/auth/google`: the audience does not match.
  Compare `GOOGLE_CLIENT_ID` against `costlyGoogleWebClientId`.
- Android throws `NoCredentialException`: no Google account on the device, or
  the SHA-1 in the console does not match the keystore that signed the build.
- The web button never appears: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is missing, or
  the page origin is not in the authorised origins list.
