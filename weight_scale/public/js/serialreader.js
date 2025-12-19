$(document).ready(function () {

    if (!('serial' in navigator)) {
        console.error('Web Serial API not supported in this browser.');
        return;
    }

    let port = null;
    let reader = null;
    let isReading = false;

    let lastUpdate = 0;
    const throttleDelay = 3000;

    let active_cdt = null;
    let active_cdn = null;

    // ✅ Function to clean string and get numeric value
    function cleanNumeric(str) {
        if (!str) return null;

        // Remove non-numeric characters except dot
        let cleaned = str.replace(/[^\d.]/g, '');

        // Remove leading zeros before numbers
        cleaned = cleaned.replace(/^0+(?=\d)/, '');

        if (cleaned === '') return null;
        return cleaned;
    }

    async function connectScale() {
        try {
            if (port && port.readable) {
                if (!isReading) {
                    isReading = true;
                    readScaleData();
                }
                return;
            }

            const ports = await navigator.serial.getPorts();
            port = ports.length ? ports[0] : await navigator.serial.requestPort();

            await port.open({
                baudRate: 9600,   // adjust based on your scale
                dataBits: 8,
                stopBits: 1,
                parity: "none"
            });

            reader = port.readable.getReader();
            console.log("Scale connected successfully!");
            isReading = true;
            readScaleData();

        } catch (error) {
            console.error("Error connecting to weight scale:", error);
        }
    }

    async function readScaleData() {
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                // Convert Uint8Array to string safely
                let str = '';
                try {
                    str = new TextDecoder().decode(value);
                } catch (e) {
                    console.warn("Cannot decode bytes as string:", value);
                    continue;
                }

                // Clean string to get only numeric value
                const numericValue = cleanNumeric(str);
                if (!numericValue) return;

                // Throttle updates
                const now = Date.now();
                if (now - lastUpdate < throttleDelay) continue;
                lastUpdate = now;

                console.log("Scale value (cleaned):", numericValue);

                // ✅ Set value into clicked child row qty
                if (active_cdt && active_cdn) {
                    frappe.model.set_value(
                        active_cdt,
                        active_cdn,
                        "qty",
                        flt(numericValue, 2)
                    );
                }

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }
    }

    // ✅ Trigger on qty click in Delivery Note Item
    frappe.ui.form.on("Delivery Note Item", {
        qty: function(frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;
            connectScale();
        }
    });

    // Cleanup on page unload
    window.addEventListener("beforeunload", async () => {
        try {
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});
