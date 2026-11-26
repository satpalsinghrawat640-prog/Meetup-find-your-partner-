package com.igmeet.app.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igmeet.app.data.IGMeetRepository
import com.igmeet.app.model.*
import com.igmeet.app.ui.theme.AppThemeMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class IGMeetUiState(
    val loading: Boolean = true,
    val busy: Boolean = false,
    val signedInUid: String? = null,
    val signedInEmail: String = "",
    val profile: UserProfile? = null,
    val isAdmin: Boolean = false,
    val allProfiles: List<UserProfile> = emptyList(),
    val candidates: List<UserProfile> = emptyList(),
    val personalChats: List<MatchChat> = emptyList(),
    val activeChatId: String? = null,
    val activeChatPeer: UserProfile? = null,
    val activeChatMessages: List<ChatMessage> = emptyList(),
    val globalMessages: List<ChatMessage> = emptyList(),
    val plans: List<MembershipPlan> = emptyList(),
    val paymentConfig: PaymentConfig = PaymentConfig(),
    val themeMode: AppThemeMode = AppThemeMode.LIGHT,
    val statusMessage: String? = null,
    val matchedPeer: UserProfile? = null
)

class IGMeetViewModel(
    private val repo: IGMeetRepository = IGMeetRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(IGMeetUiState())
    val uiState: StateFlow<IGMeetUiState> = _uiState.asStateFlow()

    init {
        refreshSession()
    }

    fun refreshSession() {
        viewModelScope.launch {
            val uid = repo.currentUid()
            if (uid == null) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        busy = false,
                        signedInUid = null,
                        signedInEmail = "",
                        profile = null,
                        isAdmin = false,
                        activeChatId = null,
                        activeChatPeer = null
                    )
                }
                return@launch
            }
            val role = repo.getRoleFromClaims()
            val prof = try { repo.fetchProfile(uid) } catch (_: Exception) { null }
            val admin = role == "owner" || role == "admin" || prof?.role == "owner" || prof?.role == "admin"

            val all = if (prof?.profileComplete == true) {
                try { repo.fetchAllActiveProfiles(uid) } catch (_: Exception) { emptyList() }
            } else emptyList()

            val swiped = if (prof?.profileComplete == true) {
                try { repo.fetchSwipedUids(uid) } catch (_: Exception) { emptySet() }
            } else emptySet()

            val candidates = if (prof?.profileComplete == true) {
                all.filter {
                    !swiped.contains(it.uid) &&
                        (prof.interestedIn == "Everyone" || it.gender == prof.interestedIn)
                }
            } else emptyList()

            val chats = if (prof?.profileComplete == true) {
                try { repo.fetchPersonalChats(uid) } catch (_: Exception) { emptyList() }
            } else emptyList()

            val payCfg = repo.fetchPaymentConfig()
            val plans = repo.fetchMembershipPlans()
            val global = try { repo.fetchGlobalMessages() } catch (_: Exception) { emptyList() }

            if (prof?.profileComplete == true) {
                repo.updatePresence(uid, prof.privacy.showOnlineStatus)
            }

            _uiState.update {
                it.copy(
                    loading = false,
                    busy = false,
                    signedInUid = uid,
                    signedInEmail = repo.currentEmail(),
                    profile = prof,
                    isAdmin = admin,
                    allProfiles = all,
                    candidates = candidates,
                    personalChats = chats,
                    plans = plans,
                    paymentConfig = payCfg,
                    globalMessages = global
                )
            }
        }
    }

    fun signInWithGoogleIdToken(idToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, statusMessage = null) }
            try {
                repo.signInWithGoogleIdToken(idToken)
                refreshSession()
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Google Sign-In failed.") }
            }
        }
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, statusMessage = null) }
            try {
                repo.signInEmail(email, password)
                refreshSession()
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Sign-in failed.") }
            }
        }
    }

    fun signUp(email: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, statusMessage = null) }
            try {
                repo.signUpEmail(email, password)
                refreshSession()
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Sign-up failed.") }
            }
        }
    }

    fun sendPasswordReset(email: String) {
        viewModelScope.launch {
            if (email.isBlank()) {
                _uiState.update { it.copy(statusMessage = "Enter your registered email address first.") }
                return@launch
            }
            try {
                repo.sendPasswordReset(email)
                _uiState.update { it.copy(statusMessage = "Password reset link sent to your email.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(statusMessage = e.message ?: "Unable to send reset link.") }
            }
        }
    }

    fun completeProfile(profile: UserProfile, photoUri: Uri?) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, statusMessage = null) }
            try {
                val uploadedUrl = if (photoUri != null) {
                    repo.uploadImage("profilePhotos/${profile.uid}/${System.currentTimeMillis()}.jpg", photoUri)
                } else profile.photoUrl
                repo.completeProfile(profile.copy(photoUrl = uploadedUrl, gallery = listOfNotNull(uploadedUrl.takeIf { it.isNotBlank() })))
                refreshSession()
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Profile setup failed.") }
            }
        }
    }

    fun updateProfile(updated: UserProfile) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true) }
            try {
                repo.updateProfile(updated)
                _uiState.update { it.copy(busy = false, profile = updated, statusMessage = "Profile updated.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Update failed.") }
            }
        }
    }

    fun swipeTop(action: String) {
        val state = _uiState.value
        val me = state.profile ?: return
        val target = state.candidates.firstOrNull() ?: return
        _uiState.update { it.copy(candidates = it.candidates.drop(1)) }
        viewModelScope.launch {
            try {
                val matched = repo.recordSwipe(me, target, action)
                if (matched) {
                    val chats = repo.fetchPersonalChats(me.uid)
                    _uiState.update { it.copy(matchedPeer = target, personalChats = chats) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(statusMessage = "Unable to record swipe.") }
            }
        }
    }

    fun openPersonalChat(peer: UserProfile) {
        val me = _uiState.value.profile ?: return
        viewModelScope.launch {
            try {
                val chatId = repo.ensurePersonalChat(me.uid, peer.uid)
                val msgs = repo.fetchPersonalMessages(chatId)
                _uiState.update {
                    it.copy(activeChatId = chatId, activeChatPeer = peer, activeChatMessages = msgs)
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(statusMessage = e.message ?: "Unable to open chat.") }
            }
        }
    }

    fun closePersonalChat() {
        _uiState.update { it.copy(activeChatId = null, activeChatPeer = null, activeChatMessages = emptyList()) }
    }

    fun sendPersonalMessage(text: String) {
        val state = _uiState.value
        val me = state.profile ?: return
        val chatId = state.activeChatId ?: return
        if (text.isBlank()) return
        viewModelScope.launch {
            try {
                repo.sendPersonalMessage(chatId, me, text)
                val msgs = repo.fetchPersonalMessages(chatId)
                val chats = repo.fetchPersonalChats(me.uid)
                _uiState.update { it.copy(activeChatMessages = msgs, personalChats = chats) }
            } catch (_: Exception) {
                _uiState.update { it.copy(statusMessage = "Unable to send message.") }
            }
        }
    }

    fun sendGlobalMessage(text: String) {
        val me = _uiState.value.profile ?: return
        if (text.isBlank()) return
        viewModelScope.launch {
            try {
                repo.sendGlobalMessage(me, text)
                val updated = repo.fetchGlobalMessages()
                _uiState.update { it.copy(globalMessages = updated) }
            } catch (_: Exception) {
                _uiState.update { it.copy(statusMessage = "Unable to send global message.") }
            }
        }
    }

    fun submitPaymentProof(plan: MembershipPlan, whatsapp: String, utr: String, screenshotUri: Uri?) {
        val me = _uiState.value.profile ?: return
        if (screenshotUri == null || whatsapp.length < 10 || utr.length < 6) {
            _uiState.update { it.copy(statusMessage = "Upload screenshot and enter valid WhatsApp number & UTR.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true) }
            try {
                val url = repo.uploadImage("paymentScreenshots/${me.uid}/${System.currentTimeMillis()}.jpg", screenshotUri)
                repo.submitPaymentRequest(me, plan, whatsapp, utr, url)
                _uiState.update {
                    it.copy(
                        busy = false,
                        statusMessage = "Payment Submitted Successfully. Please Wait for 24 Hours for admin approval."
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Payment submission failed.") }
            }
        }
    }

    fun submitVerification(submittedName: String, selfieUri: Uri?) {
        val me = _uiState.value.profile ?: return
        if (selfieUri == null || submittedName.isBlank()) {
            _uiState.update { it.copy(statusMessage = "Select a clear selfie and enter your full name.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true) }
            try {
                val url = repo.uploadImage("verificationSelfies/${me.uid}/${System.currentTimeMillis()}.jpg", selfieUri)
                repo.submitVerificationRequest(me, submittedName, url)
                _uiState.update {
                    it.copy(busy = false, statusMessage = "Verification Request Submitted. Pending Admin Review.")
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, statusMessage = e.message ?: "Verification failed.") }
            }
        }
    }

    fun setTheme(mode: AppThemeMode) {
        _uiState.update { it.copy(themeMode = mode) }
    }

    fun setError(message: String) {
        _uiState.update { it.copy(statusMessage = message) }
    }

    fun dismissMatch() {
        _uiState.update { it.copy(matchedPeer = null) }
    }

    fun clearStatus() {
        _uiState.update { it.copy(statusMessage = null) }
    }

    fun signOut() {
        repo.signOut()
        refreshSession()
    }
}
