package com.igmeet.app.data

import android.net.Uri
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import com.igmeet.app.model.*
import kotlinx.coroutines.tasks.await

class IGMeetRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val rtdb: FirebaseDatabase = FirebaseDatabase.getInstance(
        "https://ig-meet--find-your-partner-default-rtdb.firebaseio.com"
    ),
    private val storage: FirebaseStorage = FirebaseStorage.getInstance(),
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance()
) {
    companion object {
        const val GOOGLE_WEB_CLIENT_ID =
            "358917824526-fpgltkj5t1mfsgfnjtnulul41ig6iabs.apps.googleusercontent.com"
    }

    fun currentUid(): String? = auth.currentUser?.uid
    fun currentEmail(): String = auth.currentUser?.email ?: ""
    fun currentDisplayName(): String = auth.currentUser?.displayName ?: ""

    suspend fun signInWithGoogleIdToken(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
    }

    fun updatePresence(uid: String, showOnline: Boolean) {
        try {
            val ref = rtdb.getReference("presence").child(uid)
            val payload = mapOf("online" to showOnline, "lastSeen" to System.currentTimeMillis())
            ref.setValue(payload)
            ref.onDisconnect().setValue(mapOf("online" to false, "lastSeen" to System.currentTimeMillis()))
        } catch (_: Exception) {
            // Keep app resilient offline
        }
    }

    suspend fun signInEmail(email: String, password: String) {
        auth.signInWithEmailAndPassword(email.trim(), password).await()
    }

    suspend fun signUpEmail(email: String, password: String) {
        val res = auth.createUserWithEmailAndPassword(email.trim(), password).await()
        res.user?.sendEmailVerification()?.await()
    }

    suspend fun sendPasswordReset(email: String) {
        auth.sendPasswordResetEmail(email.trim()).await()
    }

    fun signOut() {
        currentUid()?.let { uid ->
            try {
                rtdb.getReference("presence").child(uid)
                    .setValue(mapOf("online" to false, "lastSeen" to System.currentTimeMillis()))
            } catch (_: Exception) {
            }
        }
        auth.signOut()
    }

    suspend fun getRoleFromClaims(): String {
        val user = auth.currentUser ?: return "user"
        return try {
            val token = user.getIdToken(true).await()
            (token.claims["role"] as? String) ?: "user"
        } catch (_: Exception) {
            "user"
        }
    }

    suspend fun isUsernameAvailable(username: String, excludeUid: String): Boolean {
        val normalized = username.trim().lowercase()
        if (!Regex("^[a-z0-9._]{3,24}$").matches(normalized)) return false
        val snap = db.collection("users").whereEqualTo("username", normalized).limit(2).get().await()
        return snap.isEmpty || snap.documents.all { it.id == excludeUid }
    }

    suspend fun fetchProfile(uid: String): UserProfile? {
        val snap = db.collection("users").document(uid).get().await()
        return if (snap.exists()) snap.toObject(UserProfile::class.java)?.copy(uid = snap.id) else null
    }

    suspend fun uploadImage(path: String, uri: Uri): String {
        val ref = storage.reference.child(path)
        ref.putFile(uri).await()
        return ref.downloadUrl.await().toString()
    }

    suspend fun completeProfile(profile: UserProfile) {
        val exactAge = AgeValidator.calculateExactAge(profile.dobDay, profile.dobMonth, profile.dobYear)
        require(exactAge >= 18) { "Only adults aged 18 or above may register on IG Meet." }

        val cleanUsername = profile.username.trim().lowercase()
        require(isUsernameAvailable(cleanUsername, profile.uid)) {
            "That username is invalid or already taken."
        }

        val safeProfile = profile.copy(
            email = profile.email.ifBlank { currentEmail() },
            age = exactAge,
            username = cleanUsername,
            role = "user",
            verified = false,
            membershipTier = "free",
            status = "active",
            profileComplete = true
        )

        try {
            functions.getHttpsCallable("completeProfileRegistration")
                .call(mapOf("profile" to safeProfile, "initialPosts" to emptyList<Any>()))
                .await()
        } catch (_: Exception) {
            db.collection("users").document(safeProfile.uid).set(safeProfile, SetOptions.merge()).await()
            db.collection("profiles").document(safeProfile.uid).set(
                mapOf(
                    "uid" to safeProfile.uid,
                    "fullName" to safeProfile.fullName,
                    "username" to safeProfile.username,
                    "age" to safeProfile.age,
                    "state" to safeProfile.state,
                    "district" to safeProfile.district,
                    "gender" to safeProfile.gender,
                    "interestedIn" to safeProfile.interestedIn,
                    "bio" to safeProfile.bio,
                    "photoUrl" to safeProfile.photoUrl,
                    "gallery" to safeProfile.gallery,
                    "verified" to false,
                    "membershipTier" to "free",
                    "status" to "active",
                    "createdAt" to safeProfile.createdAt
                ),
                SetOptions.merge()
            ).await()
        }
    }

    suspend fun updateProfile(profile: UserProfile) {
        val exactAge = AgeValidator.calculateExactAge(profile.dobDay, profile.dobMonth, profile.dobYear)
        require(exactAge >= 18) { "IG Meet is strictly for adults aged 18+." }
        val patch = mapOf(
            "fullName" to profile.fullName.trim(),
            "state" to profile.state,
            "district" to profile.district,
            "gender" to profile.gender,
            "interestedIn" to profile.interestedIn,
            "bio" to profile.bio.trim(),
            "photoUrl" to profile.photoUrl,
            "age" to exactAge,
            "updatedAt" to System.currentTimeMillis()
        )
        db.collection("users").document(profile.uid).update(patch).await()
        db.collection("profiles").document(profile.uid).set(patch, SetOptions.merge()).await()
    }

    suspend fun fetchAllActiveProfiles(myUid: String): List<UserProfile> {
        val blocked = db.collection("blockedUsers")
            .whereEqualTo("blockerUid", myUid)
            .get()
            .await()
            .documents
            .mapNotNull { it.getString("blockedUid") }
            .toSet()

        val snap = db.collection("users").limit(120).get().await()
        return snap.documents
            .mapNotNull { it.toObject(UserProfile::class.java)?.copy(uid = it.id) }
            .filter {
                it.uid != myUid &&
                    it.profileComplete &&
                    it.status == "active" &&
                    it.age >= 18 &&
                    !blocked.contains(it.uid)
            }
    }

    suspend fun fetchSwipedUids(myUid: String): Set<String> {
        val likes = db.collection("likes").whereEqualTo("fromUid", myUid).get().await()
        val passes = db.collection("passes").whereEqualTo("fromUid", myUid).get().await()
        val supers = db.collection("superLikes").whereEqualTo("fromUid", myUid).get().await()
        return (likes.documents + passes.documents + supers.documents)
            .mapNotNull { it.getString("toUid") }
            .toSet()
    }

    suspend fun recordSwipe(me: UserProfile, target: UserProfile, action: String): Boolean {
        val col = when (action) {
            "pass" -> "passes"
            "super_like" -> "superLikes"
            else -> "likes"
        }
        val docId = "${me.uid}_${target.uid}"
        db.collection(col).document(docId).set(
            mapOf(
                "fromUid" to me.uid,
                "toUid" to target.uid,
                "action" to action,
                "createdAt" to System.currentTimeMillis()
            )
        ).await()

        if (action == "pass") return false

        val reverseLike = db.collection("likes").document("${target.uid}_${me.uid}").get().await()
        val reverseSuper = db.collection("superLikes").document("${target.uid}_${me.uid}").get().await()
        if (!reverseLike.exists() && !reverseSuper.exists()) return false

        val sorted = listOf(me.uid, target.uid).sorted()
        val matchId = sorted.joinToString("_")
        db.runTransaction { tx ->
            val matchRef = db.collection("matches").document(matchId)
            if (!tx.get(matchRef).exists()) {
                tx.set(matchRef, mapOf("users" to sorted, "createdAt" to System.currentTimeMillis()))
            }
            val chatRef = db.collection("personalChats").document(matchId)
            if (!tx.get(chatRef).exists()) {
                tx.set(
                    chatRef,
                    mapOf(
                        "users" to sorted,
                        "createdAt" to System.currentTimeMillis(),
                        "lastMessage" to "",
                        "lastMessageAt" to System.currentTimeMillis()
                    )
                )
            }
        }.await()
        return true
    }

    suspend fun ensurePersonalChat(myUid: String, peerUid: String): String {
        val sorted = listOf(myUid, peerUid).sorted()
        val chatId = sorted.joinToString("_")
        val ref = db.collection("personalChats").document(chatId)
        db.runTransaction { tx ->
            if (!tx.get(ref).exists()) {
                tx.set(
                    ref,
                    mapOf(
                        "users" to sorted,
                        "createdAt" to System.currentTimeMillis(),
                        "lastMessage" to "",
                        "lastMessageAt" to System.currentTimeMillis()
                    )
                )
            }
        }.await()
        return chatId
    }

    suspend fun fetchPersonalChats(myUid: String): List<MatchChat> {
        val snap = db.collection("personalChats")
            .whereArrayContains("users", myUid)
            .limit(50)
            .get()
            .await()
        return snap.documents
            .mapNotNull { it.toObject(MatchChat::class.java)?.copy(id = it.id) }
            .sortedByDescending { it.lastMessageAt }
    }

    suspend fun fetchPersonalMessages(chatId: String): List<ChatMessage> {
        val snap = db.collection("personalMessages")
            .whereEqualTo("chatId", chatId)
            .limit(100)
            .get()
            .await()
        return snap.documents
            .mapNotNull { it.toObject(ChatMessage::class.java)?.copy(id = it.id) }
            .sortedBy { it.createdAt }
    }

    suspend fun sendPersonalMessage(chatId: String, me: UserProfile, text: String) {
        val now = System.currentTimeMillis()
        val clean = text.trim()
        if (clean.isEmpty()) return
        db.collection("personalMessages").add(
            mapOf(
                "chatId" to chatId,
                "senderId" to me.uid,
                "senderName" to me.fullName,
                "senderPhoto" to me.photoUrl,
                "type" to "text",
                "text" to clean,
                "deletedForEveryone" to false,
                "createdAt" to now
            )
        ).await()
        db.collection("personalChats").document(chatId).set(
            mapOf(
                "lastMessage" to clean,
                "lastMessageAt" to now,
                "lastMessageSender" to me.uid
            ),
            SetOptions.merge()
        ).await()
    }

    suspend fun fetchGlobalMessages(): List<ChatMessage> {
        val snap = db.collection("globalChatMessages")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(60)
            .get()
            .await()
        return snap.documents.mapNotNull { it.toObject(ChatMessage::class.java)?.copy(id = it.id) }.reversed()
    }

    suspend fun sendGlobalMessage(me: UserProfile, text: String) {
        val clean = text.trim()
        if (clean.isEmpty()) return
        db.collection("globalChatMessages").add(
            mapOf(
                "chatId" to "global",
                "senderId" to me.uid,
                "senderName" to me.fullName,
                "senderPhoto" to me.photoUrl,
                "type" to "text",
                "text" to clean,
                "deletedForEveryone" to false,
                "createdAt" to System.currentTimeMillis()
            )
        ).await()
    }

    suspend fun fetchPaymentConfig(): PaymentConfig {
        return try {
            val snap = db.collection("adminSettings").document("payment").get().await()
            snap.toObject(PaymentConfig::class.java) ?: PaymentConfig()
        } catch (_: Exception) {
            PaymentConfig()
        }
    }

    suspend fun fetchMembershipPlans(): List<MembershipPlan> {
        return try {
            val snap = db.collection("membershipPlans").get().await()
            val list = snap.documents.mapNotNull { it.toObject(MembershipPlan::class.java)?.copy(id = it.id) }
            list.ifEmpty {
                listOf(
                    MembershipPlan("ig_meet_plus", "plus", "IG Meet Plus", 49, 30, "30 days premium access", true),
                    MembershipPlan("ig_meet_elite", "elite", "IG Meet Elite", 199, 365, "365 days elite access", true)
                )
            }
        } catch (_: Exception) {
            listOf(
                MembershipPlan("ig_meet_plus", "plus", "IG Meet Plus", 49, 30, "30 days premium access", true),
                MembershipPlan("ig_meet_elite", "elite", "IG Meet Elite", 199, 365, "365 days elite access", true)
            )
        }
    }

    suspend fun submitPaymentRequest(
        me: UserProfile,
        plan: MembershipPlan,
        whatsapp: String,
        utr: String,
        screenshotUrl: String
    ) {
        db.collection("paymentRequests").add(
            mapOf(
                "uid" to me.uid,
                "userName" to me.fullName,
                "userEmail" to me.email,
                "planId" to plan.id,
                "planTier" to plan.tier,
                "planName" to plan.name,
                "validityDays" to plan.validityDays,
                "originalAmount" to plan.priceInr,
                "discountAmount" to 0,
                "finalAmount" to plan.priceInr,
                "whatsappNumber" to whatsapp.trim(),
                "utrReference" to utr.trim(),
                "screenshotUrl" to screenshotUrl,
                "status" to "pending",
                "createdAt" to System.currentTimeMillis()
            )
        ).await()
    }

    suspend fun submitVerificationRequest(me: UserProfile, submittedName: String, selfieUrl: String) {
        val existing = db.collection("verificationRequests")
            .whereEqualTo("uid", me.uid)
            .whereEqualTo("status", "pending")
            .limit(1)
            .get()
            .await()
        require(existing.isEmpty) { "You already have a verification request pending review." }

        db.collection("verificationRequests").add(
            mapOf(
                "uid" to me.uid,
                "username" to me.username,
                "submittedName" to submittedName.trim(),
                "selfieUrl" to selfieUrl,
                "status" to "pending",
                "createdAt" to System.currentTimeMillis()
            )
        ).await()
    }
}
