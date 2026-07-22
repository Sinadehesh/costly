plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
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

        // Point the debug build at your local machine (adb reverse tcp:3000
        // tcp:3000, or your LAN IP). Release should point at the deployed API.
        buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000/\"")
        // (Phase 1) The old shared DEVICE_API_SECRET build field is retired —
        // each device now gets a per-device secret from /api/device/link at
        // runtime, held in SharedPreferences, not baked into the build.
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "API_BASE_URL", "\"https://YOUR-DEPLOYMENT.vercel.app/\"")
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
}
