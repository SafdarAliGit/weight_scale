$(document).ready(function () {

    if (!('serial' in navigator)) {
        console.error('Web Serial API not supported in this browser.');
        return;
    }

    let port = null;
    let reader = null;
    let decoder = null;
    let isReading = false;

    let lastUpdate = 0;
    const throttleDelay = 3000;

    let active_cdt = null;
    let active_cdn = null;

    function parseWeight(str) {
        const match = str.match(/(\d+\.\d+)/);
        if (!match) return null;
        return parseFloat(match[0]) * 1000; // scale factor if needed
    }

    async function connectScale() {
        try {
            // ✅ Reuse existing port if already open
            if (port && port.readable) {
                console.warn("Scale already connected");
                return;
            }

            // Use previously approved port if exists
            const ports = await navigator.serial.getPorts();
            port = ports.length ? ports[0] : await navigator.serial.requestPort();

            await port.open({
                baudRate: 9600,     // adjust to your scale
                dataBits: 8,
                stopBits: 1,
                parity: "none"
            });

            decoder = new TextDecoderStream();
            port.readable.pipeTo(decoder.writable);
            reader = decoder.readable.getReader();

            if (!isReading) {
                isReading = true;
                readScaleData();
            }

            console.log("Scale connected successfully!");

        } catch (error) {
            console.error("Error connecting to weight scale:", error);
        }
    }

    async function readScaleData() {
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                const weight = parseWeight(value);
                if (weight === null || isNaN(weight)) continue;

                const now = Date.now();
                if (now - lastUpdate < throttleDelay) continue;
                lastUpdate = now;

                // ✅ Set value into clicked child table row
                if (active_cdt && active_cdn) {
                    frappe.model.set_value(
                        active_cdt,
                        active_cdn,
                        "qty",
                        flt(weight, 2)
                    );
                }

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }
    }

    // ✅ Trigger scale reading when qty is clicked in Delivery Note Item
    frappe.ui.form.on("Delivery Note Item", {
        qty: function(frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;
            connectScale();
        }
    });

    // ✅ Cleanup on page unload
    window.addEventListener("beforeunload", async () => {
        try {
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});
