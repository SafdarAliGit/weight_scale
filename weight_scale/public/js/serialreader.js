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

    // Array to accumulate bytes from scale
    let byteBuffer = [];

    function parseWeightFromBytes(bytes) {
        // Convert byte array to string safely
        try {
            const str = String.fromCharCode(...bytes);
            // Keep only numbers and dot
            const cleaned = str.replace(/[^\d.]/g, '').replace(/^0+(?=\d)/, '');
            if (!cleaned) return null;
            return parseFloat(cleaned);
        } catch (e) {
            console.warn("Cannot parse bytes:", bytes);
            return null;
        }
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
                baudRate: 9600,   // adjust according to your scale
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

                // Convert Uint8Array to array of numbers
                const bytes = Array.from(value);
                byteBuffer.push(...bytes);

                // Try to parse weight from accumulated bytes
                const weight = parseWeightFromBytes(byteBuffer);
                if (weight !== null) {

                    const now = Date.now();
                    if (now - lastUpdate < throttleDelay) continue;
                    lastUpdate = now;

                    console.log("Weight from scale:", weight);

                    // Set value into clicked child row
                    if (active_cdt && active_cdn) {
                        frappe.model.set_value(
                            active_cdt,
                            active_cdn,
                            "qty",
                            flt(weight, 2)
                        );
                    }

                    // Clear buffer after successful parse
                    byteBuffer = [];
                }

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }
    }

    // Trigger scale reading when qty field is clicked in child table
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
