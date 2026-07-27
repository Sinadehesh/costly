plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

/**
 * Build-time configuration, injected rather than hardcoded.
 *
 * Set these in ~/.gradle/gradle.properties (preferred — keeps deployment URLs
 * and keystore passwords out of the repo) or pass -PcostlyReleaseApiBaseUrl=…
 * on the command line. See android/README.md.
 */
fun prop(name: String, fallback: String): String =
    (project.findProperty(name) as String?)?.takeIf { it.isNotBlank() } ?: fallback

val debugApiBaseUrl = prop("costlyDebugApiBaseUrl", "http://10.0.2.2:3000/")
val releaseApiBaseUrl = prop("costlyReleaseApiBaseUrl", "")

// A release APK pointing at a placeholder domain is worse than no APK: it
// installs, runs, and silently fails every call. Fail the build instead.
gradle.taskGraph.whenReady {
    // Match only real release packaging tasks — a broad "contains Release"
    // check would also fire on debug builds that happen to pull in a
    // release-named task, breaking CI's assembleDebug.
    val releaseTasks = setOf(
        "assembleRelease", "bundleRelease", "installRelease", "packageRelease",
    )
    val buildingRelease = allTasks.any { it.name in releaseTasks }
    if (buildingRelease && releaseApiBaseUrl.isBlank()) {
        throw GradleException(
            "costlyReleaseApiBaseUrl is not set — a release build needs the deployed API URL.\n" +
                "Set it in ~/.gradle/gradle.properties:\n" +
                "    costlyReleaseApiBaseUrl=https://your-deployment.example.com/\n" +
                "or pass -PcostlyReleaseApiBaseUrl=https://… (note the trailing slash).",
        )
    }
}

android {
    namespace = "app.costly.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.costly.companion"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Debug points at your machine by default (emulator → host). Override
        // with -PcostlyDebugApiBaseUrl for a LAN IP or adb reverse setup.
        buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
        // (Phase 1) The old shared DEVICE_API_SECRET build field is retired —
        // each device now gets a per-device secret from /api/device/link at
        // runtime, held in SharedPreferences, not baked into the build.
    }

    signingConfigs {
        /**
         * Release signing, explicit rather than implicit.
         *
         * Unset properties fall back to the debug keystore, which is what we
         * want TODAY (sideload testing) — but it is now a visible, documented
         * choice instead of AGP silently leaving the release unsigned. A
         * debug-signed APK cannot be uploaded to Play: set the four
         * costlyKeystore* properties in ~/.gradle/gradle.properties to sign
         * with a real upload key. See android/README.md.
         */
        create("release") {
            val storePath = project.findProperty("costlyKeystorePath") as String?
            if (storePath.isNullOrBlank()) {
                logger.warn(
                    "costlyKeystorePath not set — release will be DEBUG-SIGNED. " +
                        "Fine for sideloading, rejected by Play.",
                )
                initWith(getByName("debug"))
            } else {
                storeFile = file(storePath)
                storePassword = project.findProperty("costlyKeystorePassword") as String?
                keyAlias = project.findProperty("costlyKeyAlias") as String?
                keyPassword = project.findProperty("costlyKeyPassword") as String?
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Injected, never hardcoded — the build fails above if it's unset.
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.savedstate:savedstate-ktx:1.2.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")

    // Background work — the dead man's switch and health sync
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Health Connect — on-device walking data (no server can poll this).
    // Pinned to alpha07: connect-client 1.1.0-rc02 requires compileSdk 36 +
    // AGP 8.9.1, which the rest of this toolchain (AGP 8.7.3 / compileSdk 35)
    // isn't on. alpha07 predates that requirement and exposes the same APIs we
    // use (StepsRecord, ExerciseSessionRecord, aggregate, permissions). To move
    // back to rc/stable later, bump AGP → 8.9.1+ and compileSdk → 36 together.
    implementation("androidx.health.connect:connect-client:1.1.0-alpha07")

    // Network
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Local JVM unit tests for the pure logic (DoomscrollDetector, MeterMath).
    // Run on the host via `./gradlew :app:testDebugUnitTest` — no device, no
    // emulator, so they're cheap enough to run on every change.
    testImplementation("junit:junit:4.13.2")
}
