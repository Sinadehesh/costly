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

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC),
                )
            }
            // TODO(auth): addInterceptor { chain ->
            //   chain.proceed(chain.request().newBuilder()
            //     .header("x-device-secret", BuildConfig.DEVICE_API_SECRET).build())
            // }
        }
        .build()

    val api: CostlyApi = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(client)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(CostlyApi::class.java)
}
