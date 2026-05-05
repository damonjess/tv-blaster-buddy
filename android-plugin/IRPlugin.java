package app.lovable.tvoff;

import android.content.Context;
import android.hardware.ConsumerIrManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "IR")
public class IRPlugin extends Plugin {

    private ConsumerIrManager getIr() {
        Context ctx = getContext();
        return (ConsumerIrManager) ctx.getSystemService(Context.CONSUMER_IR_SERVICE);
    }

    @PluginMethod
    public void hasIR(PluginCall call) {
        ConsumerIrManager ir = getIr();
        boolean ok = ir != null && ir.hasIrEmitter();
        JSObject ret = new JSObject();
        ret.put("hasIR", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void transmit(PluginCall call) {
        ConsumerIrManager ir = getIr();
        if (ir == null || !ir.hasIrEmitter()) {
            call.reject("No IR emitter");
            return;
        }
        Integer freq = call.getInt("frequency", 38000);
        JSONArray arr = call.getArray("pattern");
        if (arr == null) { call.reject("Missing pattern"); return; }
        try {
            int[] pattern = new int[arr.length()];
            for (int i = 0; i < arr.length(); i++) pattern[i] = arr.getInt(i);
            ir.transmit(freq, pattern);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void transmitMany(PluginCall call) {
        ConsumerIrManager ir = getIr();
        if (ir == null || !ir.hasIrEmitter()) { call.reject("No IR emitter"); return; }
        JSONArray codes = call.getArray("codes");
        int gap = call.getInt("gapMs", 120);
        int sent = 0;
        try {
            for (int i = 0; i < codes.length(); i++) {
                JSObject c = JSObject.fromJSONObject(codes.getJSONObject(i));
                int freq = c.getInteger("frequency", 38000);
                JSONArray p = c.getJSONArray("pattern");
                int[] pattern = new int[p.length()];
                for (int j = 0; j < p.length(); j++) pattern[j] = p.getInt(j);
                ir.transmit(freq, pattern);
                sent++;
                Thread.sleep(gap);
            }
        } catch (Exception e) {
            // continue best-effort
        }
        JSObject ret = new JSObject();
        ret.put("sent", sent);
        call.resolve(ret);
    }
}
