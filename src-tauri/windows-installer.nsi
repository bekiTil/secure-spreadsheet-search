; ─────────────────────────────────────────────────────────────────────────────
; Secure Spreadsheet Search — NSIS Custom Installer Extensions
;
; This file provides the logic for:
;   1. Auto-launching the app after installation completes
;   2. Remembering a pending .companybundle path (when user installs AFTER
;      double-clicking the bundle) and re-opening it automatically
;
; Usage: Tauri reads this via nsis.template or it can be merged manually.
; Reference: https://tauri.app/v1/guides/building/windows
; ─────────────────────────────────────────────────────────────────────────────

; ── Read pending bundle path from registry ────────────────────────────────────
; Written by the app before launching installer when user double-clicks a
; .companybundle with no app installed (handled in lib.rs startup detection).

!macro customInstall
  ; Check if there's a pending bundle path stored before install
  ReadRegStr $0 HKCU "Software\SecureSpreadsheetSearch" "PendingBundle"
  StrCmp $0 "" +2
  WriteRegStr HKCU "Software\SecureSpreadsheetSearch" "PendingBundleAfterInstall" "$0"
  DeleteRegValue HKCU "Software\SecureSpreadsheetSearch" "PendingBundle"
!macroend

!macro customUnInstall
  ; Clean up registry on uninstall
  DeleteRegKey HKCU "Software\SecureSpreadsheetSearch"
!macroend
