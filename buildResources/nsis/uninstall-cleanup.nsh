; Delete app userData directory on uninstall to remove logs and settings
Section "Uninstall"
  RMDir /r "$APPDATA\Maxframe"
SectionEnd
