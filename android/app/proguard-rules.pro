# Moshi / Retrofit models are reflected over — keep the DTOs and adapters.
-keep class app.costly.companion.net.** { *; }
-keepclassmembers class app.costly.companion.net.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn okhttp3.**
-dontwarn okio.**
