# Android IR Blaster Setup

This app uses a small custom Capacitor plugin to access your phone's infrared emitter via Android's `ConsumerIrManager`.

## Steps to run on your phone

1. Click **GitHub → Connect** (top right of Lovable) and push the project.
2. `git clone` your repo, then:
   ```bash
   npm install
   npx cap add android
   npm run build
   npx cap sync android
   ```
3. Copy the IR plugin into the Android project:
   - Create folder: `android/app/src/main/java/app/lovable/tvoff/`
   - Copy `android-plugin/IRPlugin.java` into it.
4. Register the plugin in `android/app/src/main/java/.../MainActivity.java`:
   ```java
   import app.lovable.tvoff.IRPlugin;
   public class MainActivity extends BridgeActivity {
     @Override
     public void onCreate(android.os.Bundle savedInstanceState) {
       registerPlugin(IRPlugin.class);
       super.onCreate(savedInstanceState);
     }
   }
   ```
5. Add this inside `<manifest>` in `android/app/src/main/AndroidManifest.xml` so the Play Store knows IR is needed:
   ```xml
   <uses-feature android:name="android.hardware.consumerir" android:required="true" />
   ```
6. Open in Android Studio and run on your phone:
   ```bash
   npx cap open android
   ```

That's it — tap the giant red button and point the top edge of your phone at the TV.

> Note: If a particular brand doesn't respond, its specific power-off code may differ by model. The TV-B-Gone code database has more variants we can add.
