import 'package:flutter/material.dart';

/// Design tokens and brand color palette for EduSense AI.
class AppColors {
  AppColors._();

  // Core Brand Colors
  static const Color primary = Color(0xFF2457E6);
  static const Color navy = Color(0xFF102A56);
  static const Color softBlue = Color(0xFFEAF0FF);
  static const Color background = Color(0xFFF6F8FC);
  static const Color cardBackground = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color secondary = Color(0xFF4F46E5);

  // Semantic & Feedback Colors
  static const Color success = Color(0xFF16A34A);
  static const Color successLight = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEE2E2);

  // Neutral Colors & Text
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textTertiary = Color(0xFF94A3B8);
  static const Color border = Color(0xFFE2E8F0);
  static const Color divider = Color(0xFFEEF2F6);

  // Extended Tokens for AI Tutor & Rich UI
  static const Color primaryNavy = Color(0xFF102A56);
  static const Color accentCyan = Color(0xFF06B6D4);
  static const Color deepSlate = Color(0xFF0F172A);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);

  // Brand Gradient
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, navy],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [softBlue, background],
  );
}
