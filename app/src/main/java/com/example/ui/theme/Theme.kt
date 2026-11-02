package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val MojiSurvivorColorScheme = darkColorScheme(
  primary = BreBreDeepPink,
  onPrimary = BreBreWhite,
  primaryContainer = BreBrePinkDark3,
  onPrimaryContainer = BreBreLightPink,
  secondary = BreBreLightPink,
  onSecondary = BreBreBlack,
  secondaryContainer = BreBrePinkDark2,
  onSecondaryContainer = BreBreWhite,
  tertiary = BreBreSilver,
  onTertiary = BreBreBlack,
  background = BreBreBlack,
  onBackground = BreBreWhite,
  surface = BreBreGray900,
  onSurface = BreBreWhite,
  surfaceVariant = BreBreGray850,
  onSurfaceVariant = BreBreGray100,
  outline = BreBrePinkDark1,
  outlineVariant = BreBreGray600
)

@Composable
fun MyApplicationTheme(
  content: @Composable () -> Unit
) {
  MaterialTheme(
    colorScheme = MojiSurvivorColorScheme,
    typography = Typography,
    content = content
  )
}
