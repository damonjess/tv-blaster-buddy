package app.lovable.tvoff;

import android.content.Context;
import android.hardware.ConsumerIrManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "IR")
public class IRPlugin extends Plugin {
    private static final String TAG = "IRPlugin";

    private ConsumerIrManager getIr() {
        Context ctx = getContext();
        ConsumerIrManager ir = (ConsumerIrManager) ctx.getSystemService(Context.CONSUMER_IR_SERVICE);
        if (ir == null) {
            // Fallback for some older or specific manufacturer implementations
            try {
                ir = (ConsumerIrManager) ctx.getApplicationContext().getSystemService("consumer_ir");
            } catch (Exception e) {
                Log.e(TAG, "Fallback service acquisition failed", e);
            }
        }
        return ir;
    }

    @PluginMethod
    public void hasIR(PluginCall call) {
        try {
            ConsumerIrManager ir = getIr();
            boolean exists = ir != null;
            boolean hasEmitter = exists && ir.hasIrEmitter();
            
            JSObject ret = new JSObject();
            ret.put("hasIR", hasEmitter);
            ret.put("exists", exists);
            
            if (exists) {
                JSONArray ranges = new JSONArray();
                ConsumerIrManager.CarrierFrequencyRange[] freqRanges = ir.getCarrierFrequencies();
                if (freqRanges != null) {
                    for (ConsumerIrManager.CarrierFrequencyRange range : freqRanges) {
                        JSONObject r = new JSONObject();
                        r.put("min", range.getMinFrequency());
                        r.put("max", range.getMaxFrequency());
                        ranges.put(r);
                    }
                }
                ret.put("frequencies", ranges);
            }
            
            Log.d(TAG, "hasIR check: " + ret.toString());
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error in hasIR", e);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void transmit(PluginCall call) {
        ConsumerIrManager ir = getIr();
        if (ir == null || !ir.hasIrEmitter()) {
            call.reject("Hardware error: No IR emitter found on this device.");
            return;
        }

        Integer freq = call.getInt("frequency", 38000);
        JSONArray arr = call.getArray("pattern");
        
        if (arr == null) {
            call.reject("Input error: Missing pattern array.");
            return;
        }

        try {
            int[] pattern = new int[arr.length()];
            for (int i = 0; i < arr.length(); i++) {
                pattern[i] = arr.getInt(i);
            }
            
            Log.d(TAG, "Transmitting: freq=" + freq + " length=" + pattern.length);
            ir.transmit(freq, pattern);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Transmission failed", e);
            call.reject("Transmission failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void transmitMany(PluginCall call) {
        ConsumerIrManager ir = getIr();
        if (ir == null || !ir.hasIrEmitter()) {
            call.reject("Hardware error: No IR emitter found.");
            return;
        }

        JSONArray codes = call.getArray("codes");
        int gap = call.getInt("gapMs", 120);
        
        if (codes == null) {
            call.reject("Input error: No codes provided.");
            return;
        }

        int sent = 0;
        try {
            for (int i = 0; i < codes.length(); i++) {
                JSONObject c = codes.getJSONObject(i);
                int freq = c.optInt("frequency", 38000);
                JSONArray p = c.getJSONArray("pattern");
                
                int[] pattern = new int[p.length()];
                for (int j = 0; j < p.length(); j++) {
                    pattern[j] = p.getInt(j);
                }
                
                Log.d(TAG, "Transmitting many (" + (i+1) + "/" + codes.length() + "): freq=" + freq);
                ir.transmit(freq, pattern);
                sent++;
                
                if (i < codes.length() - 1) {
                    Thread.sleep(gap);
                }
            }
            
            JSObject ret = new JSObject();
            ret.put("sent", sent);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Bulk transmission error after " + sent + " codes", e);
            JSObject ret = new JSObject();
            ret.put("sent", sent);
            ret.put("error", e.getMessage());
            call.resolve(ret); // Resolve with partial count and error
        }
    }
}
