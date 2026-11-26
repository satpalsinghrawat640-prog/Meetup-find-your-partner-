package com.igmeet.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val PinkPrimary = Color(0xFFFF2D78)
val RedAccent = Color(0xFFE91E4D)
val LightPink = Color(0xFFFF80AB)
val RoseBackground = Color(0xFFFFF8FA)

enum class AppThemeMode { LIGHT, DARK, BLACK_WHITE }

private val LightPalette = lightColorScheme(
    primary = PinkPrimary,
    secondary = RedAccent,
    tertiary = LightPink,
    background = RoseBackground,
    surface = Color.White,
    onPrimary = Color.White,
    onBackground = Color(0xFF1F1218),
    onSurface = Color(0xFF1F1218)
)

private val DarkPalette = darkColorScheme(
    primary = PinkPrimary,
    secondary = RedAccent,
    tertiary = LightPink,
    background = Color(0xFF140E12),
    surface = Color(0xFF1C1419),
    onPrimary = Color.White,
    onBackground = Color.White,
    onSurface = Color.White
)

private val BlackWhitePalette = lightColorScheme(
    primary = Color.Black,
    secondary = Color(0xFF333333),
    tertiary = Color(0xFF666666),
    background = Color.White,
    surface = Color(0xFFF5F5F5),
    onPrimary = Color.White,
    onBackground = Color.Black,
    onSurface = Color.Black
)

@Composable
fun IGMeetTheme(
    mode: AppThemeMode = AppThemeMode.LIGHT,
    content: @Composable () -> Unit
) {
    val colors = when (mode) {
        AppThemeMode.LIGHT -> LightPalette
        AppThemeMode.DARK -> DarkPalette
        AppThemeMode.BLACK_WHITE -> BlackWhitePalette
    }
    MaterialTheme(colorScheme = colors, content = content)
}
