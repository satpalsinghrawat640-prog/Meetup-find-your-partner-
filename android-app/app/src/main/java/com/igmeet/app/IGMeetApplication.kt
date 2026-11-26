package com.igmeet.app

import android.app.Application
import com.google.firebase.FirebaseApp

class IGMeetApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}
