# Preserve IG Meet Firestore / RTDB / Functions model classes and no-arg constructors
-keep class com.igmeet.app.model.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*

# Preserve Firebase & Google Play Services classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Preserve Android Credential Manager & Google Identity
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn androidx.credentials.**

# Preserve Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

# Preserve ZXing QR code encoder
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**
