package com.igmeet.app.model

import java.util.Calendar

data class PrivacyPrefs(
    val whoCanMessageMe: String = "Everyone",
    val showOnlineStatus: Boolean = true,
    val showLastSeen: Boolean = true
)

data class NotificationPrefs(
    val allNotifications: Boolean = true,
    val likes: Boolean = true,
    val messages: Boolean = true,
    val newMatches: Boolean = true,
    val announcements: Boolean = true
)

data class UserProfile(
    val uid: String = "",
    val email: String = "",
    val fullName: String = "",
    val username: String = "",
    val dobDay: Int = 1,
    val dobMonth: Int = 1,
    val dobYear: Int = 2000,
    val age: Int = 18,
    val state: String = "",
    val district: String = "",
    val gender: String = "Other",
    val interestedIn: String = "Everyone",
    val bio: String = "",
    val photoUrl: String = "",
    val gallery: List<String> = emptyList(),
    val verified: Boolean = false,
    val membershipTier: String = "free",
    val membershipExpiresAt: Long? = null,
    val role: String = "user",
    val status: String = "active",
    val profileComplete: Boolean = false,
    val privacy: PrivacyPrefs = PrivacyPrefs(),
    val notifications: NotificationPrefs = NotificationPrefs(),
    val online: Boolean = false,
    val lastSeen: Long = 0L,
    val createdAt: Long = System.currentTimeMillis()
)

data class TelegramPromotion(
    val id: String = "promo_1",
    val slot: Int = 1,
    val enabled: Boolean = true,
    val coverImageUrl: String = "",
    val heading: String = "IG Meet Official Community",
    val subheading: String = "Stay updated with official IG Meet announcements.",
    val ctaText: String = "Open Community Channel",
    val inviteLink: String = ""
)

data class MatchChat(
    val id: String = "",
    val users: List<String> = emptyList(),
    val lastMessage: String = "",
    val lastMessageAt: Long = 0L,
    val lastMessageSender: String = ""
)

data class ChatMessage(
    val id: String = "",
    val chatId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val senderPhoto: String = "",
    val type: String = "text",
    val text: String = "",
    val mediaUrl: String = "",
    val deletedForEveryone: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

data class MembershipPlan(
    val id: String = "",
    val tier: String = "plus",
    val name: String = "IG Meet Plus",
    val priceInr: Int = 49,
    val validityDays: Int = 30,
    val description: String = "",
    val enabled: Boolean = true
)

data class PaymentConfig(
    val upiId: String = "satpal.rawat01@fam",
    val merchantName: String = "IG Meet Membership",
    val instructions: String = "Pay via UPI and submit screenshot + UTR for admin verification."
)

data class SupportContactSlot(
    val id: String = "",
    val label: String = "",
    val platform: String = "",
    val enabled: Boolean = false,
    val value: String = ""
)

object AgeValidator {
    fun calculateExactAge(day: Int, month: Int, year: Int): Int {
        val today = Calendar.getInstance()
        val dob = Calendar.getInstance().apply {
            isLenient = false
            set(year, month - 1, day)
        }
        return try {
            dob.time
            var age = today.get(Calendar.YEAR) - dob.get(Calendar.YEAR)
            if (today.get(Calendar.DAY_OF_YEAR) < dob.get(Calendar.DAY_OF_YEAR)) {
                age--
            }
            age
        } catch (_: Exception) {
            0
        }
    }
}

object IndianLocations {
    val stateDistricts: Map<String, List<String>> = mapOf(
        "Delhi" to listOf("Central Delhi", "East Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"),
        "Maharashtra" to listOf("Mumbai City", "Mumbai Suburban", "Nagpur", "Nashik", "Pune", "Thane"),
        "Karnataka" to listOf("Bengaluru Urban", "Bengaluru Rural", "Mangaluru", "Mysuru", "Hubballi-Dharwad"),
        "Uttarakhand" to listOf("Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Tehri Garhwal", "Udham Singh Nagar"),
        "Uttar Pradesh" to listOf("Agra", "Ghaziabad", "Gautam Buddha Nagar", "Kanpur Nagar", "Lucknow", "Prayagraj", "Varanasi"),
        "Rajasthan" to listOf("Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur"),
        "Gujarat" to listOf("Ahmedabad", "Gandhinagar", "Rajkot", "Surat", "Vadodara"),
        "Tamil Nadu" to listOf("Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"),
        "West Bengal" to listOf("Darjeeling", "Howrah", "Kolkata", "North 24 Parganas", "Siliguri"),
        "Punjab" to listOf("Amritsar", "Chandigarh", "Jalandhar", "Ludhiana", "Patiala")
    )
}
