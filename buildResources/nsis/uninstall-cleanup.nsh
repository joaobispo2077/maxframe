; Delete app userData directory on uninstall to remove logs and settings.
; Hook into electron-builder uninstall flow instead of defining a standalone NSIS section.
!macro customUnInstall
  RMDir /r "$APPDATA\Maxframe"
!macroend
