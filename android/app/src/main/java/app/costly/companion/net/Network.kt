package app.costly.companion.net

import app.costly.companion.BuildConfig
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

/** Single shared API client. Retrofit + OkHttp are cheap to hold as singletons. */
object Network {

    // Public: Prefs reuses this for (de)serializing the cached anchor ladder.
    val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    /**
     * The per-device secret from /api/device/link. Set at app start from Prefs
     * and updated on link. When present, attached as x-device-secret on every
     * request — which is how the server authenticates the device and derives
     * the user (Phase 1). The linking calls themselves carry no secret yet;
     * they're authorized by the one-time OTP in the body.
     */
    @Volatile
    var deviceSecret: String? = null

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val secret = deviceSecret
            val request = if (secret != null) {
                chain.request().newBuilder().header("x-device-secret", secret).build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC),
                )
            }
        }
        .build()

    val api: CostlyApi = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(client)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(CostlyApi::class.java)
}
