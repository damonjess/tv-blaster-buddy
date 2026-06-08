package app.lovable.tvoff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.lovable.tvoff.IRPlugin;   // ← Add this import

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(IRPlugin.class);   // ← Add this line
    super.onCreate(savedInstanceState);
  }
}