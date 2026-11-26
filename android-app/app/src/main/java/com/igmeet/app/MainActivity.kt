package com.igmeet.app

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.igmeet.app.data.IGMeetRepository
import com.igmeet.app.model.*
import com.igmeet.app.ui.theme.AppThemeMode
import com.igmeet.app.ui.theme.IGMeetTheme
import com.igmeet.app.viewmodel.IGMeetViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val vm: IGMeetViewModel = viewModel()
            val state by vm.uiState.collectAsState()

            IGMeetTheme(mode = state.themeMode) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    IGMeetRoot(vm = vm)
                }
            }
        }
    }
}

private fun generateQrBitmap(content: String, sizePx: Int = 512): Bitmap? {
    return try {
        val bitMatrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx)
        val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        for (x in 0 until sizePx) {
            for (y in 0 until sizePx) {
                bmp.setPixel(x, y, if (bitMatrix[x, y]) 0xFF1F1218.toInt() else 0xFFFFFFFF.toInt())
            }
        }
        bmp
    } catch (_: Exception) {
        null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IGMeetRoot(vm: IGMeetViewModel) {
    val state by vm.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    var subScreen by remember { mutableStateOf<String?>(null) }

    if (state.loading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    if (state.signedInUid == null) {
        AuthScreen(
            busy = state.busy,
            statusMessage = state.statusMessage,
            onSignIn = vm::signIn,
            onSignUp = vm::signUp,
            onForgotPassword = vm::sendPasswordReset,
            onGoogleIdToken = vm::signInWithGoogleIdToken,
            onGoogleError = vm::setError
        )
        return
    }

    val profile = state.profile
    if (profile == null || !profile.profileComplete) {
        CompleteProfileScreen(
            uid = state.signedInUid!!,
            email = state.signedInEmail,
            busy = state.busy,
            statusMessage = state.statusMessage,
            onBack = vm::signOut,
            onComplete = vm::completeProfile
        )
        return
    }

    if (state.activeChatId != null && state.activeChatPeer != null) {
        PersonalChatDetailScreen(
            me = profile,
            peer = state.activeChatPeer!!,
            messages = state.activeChatMessages,
            onBack = vm::closePersonalChat,
            onSend = vm::sendPersonalMessage
        )
        return
    }

    when (subScreen) {
        "upgrade" -> {
            UpgradeMembershipScreen(
                plans = state.plans,
                paymentConfig = state.paymentConfig,
                busy = state.busy,
                statusMessage = state.statusMessage,
                onBack = { subScreen = null },
                onSubmitProof = vm::submitPaymentProof
            )
            return
        }
        "verification" -> {
            BlueTickVerificationScreen(
                me = profile,
                busy = state.busy,
                statusMessage = state.statusMessage,
                onBack = { subScreen = null },
                onSubmit = vm::submitVerification
            )
            return
        }
        "global_chat" -> {
            GlobalChatDetailScreen(
                messages = state.globalMessages,
                onBack = { subScreen = null },
                onSend = vm::sendGlobalMessage
            )
            return
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Whatshot, contentDescription = "Home") },
                    label = { Text("Home") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Explore, contentDescription = "Explore") },
                    label = { Text("Explore") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.ChatBubble, contentDescription = "Messages") },
                    label = { Text("Messages") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Person, contentDescription = "Profile") },
                    label = { Text("Profile") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (selectedTab) {
                0 -> {
                    val top = state.candidates.firstOrNull()
                    Column(
                        modifier = Modifier.fillMaxSize().padding(16.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("IG Meet", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                            IconButton(onClick = { vm.refreshSession() }) {
                                Icon(Icons.Default.Notifications, contentDescription = "Notifications")
                            }
                        }
                        if (top == null) {
                            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("No more profiles right now.")
                                    OutlinedButton(onClick = vm::refreshSession) { Text("Refresh Discovery") }
                                }
                            }
                        } else {
                            Card(modifier = Modifier.weight(1f).fillMaxWidth().padding(vertical = 12.dp)) {
                                Column(modifier = Modifier.fillMaxSize()) {
                                    if (top.photoUrl.isNotBlank()) {
                                        AsyncImage(
                                            model = top.photoUrl,
                                            contentDescription = top.fullName,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxWidth().weight(1f)
                                        )
                                    }
                                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text("${top.fullName}, ${top.age}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                            if (top.verified) {
                                                Icon(Icons.Default.Verified, contentDescription = "Verified", tint = MaterialTheme.colorScheme.primary)
                                            }
                                        }
                                        Text("@${top.username} - ${top.district}, ${top.state}", style = MaterialTheme.typography.bodySmall)
                                        if (top.bio.isNotBlank()) Text(top.bio, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                FilledTonalButton(onClick = { vm.swipeTop("pass") }) { Text("Pass") }
                                OutlinedButton(onClick = { vm.swipeTop("super_like") }) { Text("Super Like") }
                                Button(onClick = { vm.swipeTop("like") }) { Text("Like") }
                            }
                        }
                    }
                }
                1 -> {
                    var searchQuery by remember { mutableStateOf("") }
                    var verifiedOnly by remember { mutableStateOf(false) }
                    val filtered = state.allProfiles.filter { member ->
                        val q = searchQuery.trim().lowercase()
                        val matchesText = q.isEmpty() ||
                            member.fullName.lowercase().contains(q) ||
                            member.username.lowercase().contains(q) ||
                            member.district.lowercase().contains(q) ||
                            member.state.lowercase().contains(q)
                        val matchesVerified = !verifiedOnly || member.verified
                        matchesText && matchesVerified
                    }
                    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Explore", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search name, username, state, district") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        FilterChip(
                            selected = verifiedOnly,
                            onClick = { verifiedOnly = !verifiedOnly },
                            label = { Text("Verified Profiles Only") }
                        )
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(filtered) { member ->
                                Card(
                                    modifier = Modifier.fillMaxWidth().clickable { vm.openPersonalChat(member) }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        if (member.photoUrl.isNotBlank()) {
                                            AsyncImage(
                                                model = member.photoUrl,
                                                contentDescription = member.fullName,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.size(52.dp).clip(CircleShape)
                                            )
                                        }
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("${member.fullName}, ${member.age}", fontWeight = FontWeight.Bold)
                                            Text("${member.district}, ${member.state}", style = MaterialTheme.typography.bodySmall)
                                        }
                                        TextButton(onClick = { vm.openPersonalChat(member) }) { Text("Message") }
                                    }
                                }
                            }
                        }
                    }
                }
                2 -> {
                    val peerMap = state.allProfiles.associateBy { it.uid }
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            Text("Messages", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                        if (state.allProfiles.isNotEmpty()) {
                            item {
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    items(state.allProfiles.take(10)) { member ->
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            modifier = Modifier.width(68.dp).clickable { vm.openPersonalChat(member) }
                                        ) {
                                            if (member.photoUrl.isNotBlank()) {
                                                AsyncImage(
                                                    model = member.photoUrl,
                                                    contentDescription = member.fullName,
                                                    contentScale = ContentScale.Crop,
                                                    modifier = Modifier.size(54.dp).clip(CircleShape)
                                                )
                                            } else {
                                                Icon(Icons.Default.AccountCircle, contentDescription = null, modifier = Modifier.size(54.dp))
                                            }
                                            Text(member.fullName.substringBefore(" "), maxLines = 1, style = MaterialTheme.typography.labelSmall)
                                        }
                                    }
                                }
                            }
                        }
                        item {
                            Card(modifier = Modifier.fillMaxWidth().clickable { subScreen = "global_chat" }) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Icon(Icons.Default.Public, contentDescription = "Global Chat")
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Global Chat", fontWeight = FontWeight.Bold)
                                        Text(
                                            state.globalMessages.lastOrNull()?.text ?: "Join the live IG Meet community room",
                                            maxLines = 1,
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                }
                            }
                        }
                        items(state.personalChats) { chat ->
                            val peerUid = chat.users.firstOrNull { it != profile.uid }
                            val peer = peerUid?.let { peerMap[it] }
                            if (peer != null) {
                                Card(modifier = Modifier.fillMaxWidth().clickable { vm.openPersonalChat(peer) }) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        if (peer.photoUrl.isNotBlank()) {
                                            AsyncImage(
                                                model = peer.photoUrl,
                                                contentDescription = peer.fullName,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.size(46.dp).clip(CircleShape)
                                            )
                                        }
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(peer.fullName, fontWeight = FontWeight.Bold)
                                            Text(chat.lastMessage.ifBlank { "Say hello" }, maxLines = 1, style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                3 -> {
                    Column(
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            if (profile.photoUrl.isNotBlank()) {
                                AsyncImage(
                                    model = profile.photoUrl,
                                    contentDescription = profile.fullName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.size(68.dp).clip(CircleShape)
                                )
                            }
                            Column {
                                Text("${profile.fullName}, ${profile.age}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                Text("@${profile.username} - ${profile.district}, ${profile.state}")
                            }
                        }
                        if (profile.bio.isNotBlank()) Text(profile.bio)
                        if (state.isAdmin) {
                            AssistChip(onClick = {}, label = { Text("Owner Admin Account") })
                        }
                        HorizontalDivider()
                        Button(onClick = { subScreen = "upgrade" }, modifier = Modifier.fillMaxWidth()) {
                            Text("IG Meet Upgrade (${profile.membershipTier.uppercase()})")
                        }
                        OutlinedButton(onClick = { subScreen = "verification" }, modifier = Modifier.fillMaxWidth()) {
                            Text(if (profile.verified) "Verified Blue Tick Active" else "Free Blue Tick Verification")
                        }
                        Text("Appearance Theme", fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AppThemeMode.entries.forEach { mode ->
                                FilterChip(
                                    selected = state.themeMode == mode,
                                    onClick = { vm.setTheme(mode) },
                                    label = { Text(mode.name.replace("_", " ")) }
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(onClick = vm::signOut, modifier = Modifier.fillMaxWidth()) {
                            Text("Logout")
                        }
                    }
                }
            }
        }
    }

    state.matchedPeer?.let { peer ->
        AlertDialog(
            onDismissRequest = vm::dismissMatch,
            title = { Text("It's a Match!") },
            text = { Text("You and ${peer.fullName} liked each other.") },
            confirmButton = {
                Button(onClick = {
                    vm.dismissMatch()
                    vm.openPersonalChat(peer)
                }) { Text("Send Message") }
            },
            dismissButton = { TextButton(onClick = vm::dismissMatch) { Text("Continue Exploring") } }
        )
    }
}

@Composable
private fun AuthScreen(
    busy: Boolean,
    statusMessage: String?,
    onSignIn: (String, String) -> Unit,
    onSignUp: (String, String) -> Unit,
    onForgotPassword: (String) -> Unit,
    onGoogleIdToken: (String) -> Unit,
    onGoogleError: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("IG Meet", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Black)
        Text("Find Your Match (18+ Only)")
        Spacer(modifier = Modifier.height(24.dp))
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        if (!isSignUp) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                TextButton(onClick = { onForgotPassword(email) }) { Text("Forgot Password?") }
            }
        }
        statusMessage?.let {
            Spacer(modifier = Modifier.height(6.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            enabled = !busy,
            onClick = { if (isSignUp) onSignUp(email, password) else onSignIn(email, password) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (isSignUp) "Create Account" else "Login")
        }
        Spacer(modifier = Modifier.height(10.dp))
        OutlinedButton(
            enabled = !busy,
            onClick = {
                scope.launch {
                    try {
                        val cm = CredentialManager.create(context)
                        val googleIdOption = GetGoogleIdOption.Builder()
                            .setFilterByAuthorizedAccounts(false)
                            .setServerClientId(IGMeetRepository.GOOGLE_WEB_CLIENT_ID)
                            .build()
                        val req = GetCredentialRequest.Builder()
                            .addCredentialOption(googleIdOption)
                            .build()
                        val result = cm.getCredential(context = context, request = req)
                        val googleCred = GoogleIdTokenCredential.createFrom(result.credential.data)
                        onGoogleIdToken(googleCred.idToken)
                    } catch (e: Exception) {
                        onGoogleError(e.message ?: "Unable to complete Google Sign-In.")
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Continue with Google")
        }
        TextButton(onClick = { isSignUp = !isSignUp }) {
            Text(if (isSignUp) "Already have an account? Login" else "New to IG Meet? Create Account")
        }
    }
}

@Composable
private fun CompleteProfileScreen(
    uid: String,
    email: String,
    busy: Boolean,
    statusMessage: String?,
    onBack: () -> Unit,
    onComplete: (UserProfile, Uri?) -> Unit
) {
    var fullName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var dobDay by remember { mutableStateOf("1") }
    var dobMonth by remember { mutableStateOf("1") }
    var dobYear by remember { mutableStateOf("2000") }
    var gender by remember { mutableStateOf("Male") }
    var interestedIn by remember { mutableStateOf("Everyone") }
    var stateVal by remember { mutableStateOf("Delhi") }
    var districtVal by remember { mutableStateOf("New Delhi") }
    var bio by remember { mutableStateOf("") }
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    var ageError by remember { mutableStateOf<String?>(null) }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) photoUri = uri
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Create Your Profile", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }

        OutlinedButton(
            onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (photoUri != null) "Profile Photo Selected" else "Choose Profile Photo")
        }

        OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = username, onValueChange = { username = it }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth())

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = dobDay, onValueChange = { dobDay = it }, label = { Text("Day") }, modifier = Modifier.weight(1f))
            OutlinedTextField(value = dobMonth, onValueChange = { dobMonth = it }, label = { Text("Month") }, modifier = Modifier.weight(1f))
            OutlinedTextField(value = dobYear, onValueChange = { dobYear = it }, label = { Text("Year") }, modifier = Modifier.weight(1.3f))
        }

        Text("Gender", fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Male", "Female", "Other").forEach { opt ->
                FilterChip(selected = gender == opt, onClick = { gender = opt }, label = { Text(opt) })
            }
        }

        Text("Interested In", fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Male", "Female", "Everyone").forEach { opt ->
                FilterChip(selected = interestedIn == opt, onClick = { interestedIn = opt }, label = { Text(opt) })
            }
        }

        OutlinedTextField(value = stateVal, onValueChange = { stateVal = it }, label = { Text("State") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = districtVal, onValueChange = { districtVal = it }, label = { Text("District") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = bio, onValueChange = { bio = it }, label = { Text("Bio") }, modifier = Modifier.fillMaxWidth())

        ageError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        statusMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        Button(
            enabled = !busy,
            onClick = {
                val d = dobDay.toIntOrNull() ?: 1
                val m = dobMonth.toIntOrNull() ?: 1
                val y = dobYear.toIntOrNull() ?: 2010
                val age = AgeValidator.calculateExactAge(d, m, y)
                if (age < 18) {
                    ageError = "You must be at least 18 years old to join IG Meet."
                } else {
                    ageError = null
                    onComplete(
                        UserProfile(
                            uid = uid,
                            email = email,
                            fullName = fullName.trim(),
                            username = username.trim().lowercase(),
                            dobDay = d,
                            dobMonth = m,
                            dobYear = y,
                            age = age,
                            gender = gender,
                            interestedIn = interestedIn,
                            state = stateVal.trim(),
                            district = districtVal.trim(),
                            bio = bio.trim()
                        ),
                        photoUri
                    )
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (busy) "Saving..." else "Complete Profile")
        }
    }
}

@Composable
private fun PersonalChatDetailScreen(
    me: UserProfile,
    peer: UserProfile,
    messages: List<ChatMessage>,
    onBack: () -> Unit,
    onSend: (String) -> Unit
) {
    var draft by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text(peer.fullName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(messages) { msg ->
                val isMine = msg.senderId == me.uid
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = if (isMine) Alignment.CenterEnd else Alignment.CenterStart) {
                    Card {
                        Text(msg.text, modifier = Modifier.padding(10.dp))
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = draft, onValueChange = { draft = it }, placeholder = { Text("Type a message") }, modifier = Modifier.weight(1f))
            Button(onClick = { onSend(draft); draft = "" }) { Text("Send") }
        }
    }
}

@Composable
private fun GlobalChatDetailScreen(
    messages: List<ChatMessage>,
    onBack: () -> Unit,
    onSend: (String) -> Unit
) {
    var draft by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Global Chat", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(messages) { item ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(item.senderName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                        Text(item.text)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = draft, onValueChange = { draft = it }, placeholder = { Text("Message Global Chat") }, modifier = Modifier.weight(1f))
            Button(onClick = { onSend(draft); draft = "" }) { Text("Send") }
        }
    }
}

@Composable
private fun UpgradeMembershipScreen(
    plans: List<MembershipPlan>,
    paymentConfig: PaymentConfig,
    busy: Boolean,
    statusMessage: String?,
    onBack: () -> Unit,
    onSubmitProof: (MembershipPlan, String, String, Uri?) -> Unit
) {
    val context = LocalContext.current
    var selected by remember { mutableStateOf(plans.firstOrNull() ?: MembershipPlan()) }
    var whatsapp by remember { mutableStateOf("") }
    var utr by remember { mutableStateOf("") }
    var screenshotUri by remember { mutableStateOf<Uri?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) screenshotUri = uri
    }

    val upiUrl = "upi://pay?pa=${Uri.encode(paymentConfig.upiId)}&pn=${Uri.encode(paymentConfig.merchantName)}&am=${selected.priceInr}&cu=INR"
    val qrBitmap = remember(upiUrl) { generateQrBitmap(upiUrl) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("IG Meet Upgrade", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            plans.forEach { plan ->
                FilterChip(
                    selected = selected.id == plan.id,
                    onClick = { selected = plan },
                    label = { Text("${plan.name} - Rs ${plan.priceInr}") }
                )
            }
        }
        qrBitmap?.let { bmp ->
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Image(bitmap = bmp.asImageBitmap(), contentDescription = "UPI QR Code", modifier = Modifier.size(200.dp))
            }
        }
        Text("UPI ID: ${paymentConfig.upiId}", fontWeight = FontWeight.Bold)
        Button(
            onClick = {
                try {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(upiUrl)))
                } catch (_: Exception) {
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Tap to Pay Rs ${selected.priceInr} in UPI App")
        }
        OutlinedButton(
            onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (screenshotUri != null) "Payment Screenshot Selected" else "Upload Payment Screenshot")
        }
        OutlinedTextField(value = whatsapp, onValueChange = { whatsapp = it }, label = { Text("WhatsApp Number") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = utr, onValueChange = { utr = it }, label = { Text("UTR / Transaction Reference") }, modifier = Modifier.fillMaxWidth())
        statusMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        Button(
            enabled = !busy,
            onClick = { onSubmitProof(selected, whatsapp, utr, screenshotUri) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (busy) "Submitting..." else "Submit Payment for Admin Approval")
        }
    }
}

@Composable
private fun BlueTickVerificationScreen(
    me: UserProfile,
    busy: Boolean,
    statusMessage: String?,
    onBack: () -> Unit,
    onSubmit: (String, Uri?) -> Unit
) {
    var submittedName by remember { mutableStateOf(me.fullName) }
    var selfieUri by remember { mutableStateOf<Uri?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) selfieUri = uri
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Free Blue Tick Verification", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        if (me.verified) {
            Text("Your profile is already verified with the Blue Badge.", fontWeight = FontWeight.Bold)
        } else {
            OutlinedButton(
                onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (selfieUri != null) "Selfie Selected" else "Select Verification Selfie")
            }
            OutlinedTextField(
                value = submittedName,
                onValueChange = { submittedName = it },
                label = { Text("Full Name") },
                modifier = Modifier.fillMaxWidth()
            )
            statusMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Button(
                enabled = !busy,
                onClick = { onSubmit(submittedName, selfieUri) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (busy) "Submitting..." else "Confirm & Submit")
            }
        }
    }
}
