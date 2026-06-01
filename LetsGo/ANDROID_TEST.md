# Android internal testing (Lets Go)

1. `eas build --platform android --profile preview` from the `LetsGo` folder.
2. Download the **APK** artifact from the Expo build page.
3. On a device, enable **Install unknown apps** for your browser or Files app, open the APK, and install.
4. **ADB sideload** (optional): `adb install -r path/to/app.apk` with USB debugging enabled.
