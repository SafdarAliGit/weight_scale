$(document).ready(function () {

    if (!('serial' in navigator)) {
        console.error('Web Serial API not supported in this browser.');
        return;
    }

    let port = null;
    let reader = null;
    let isReading = false;

    let active_cdt = null;
    let active_cdn = null;

    let byteBuffer = [];
    let hasSetValue = false;

    // ✅ Use your working parseWeightFromBytes function
    function parseWeightFromBytes(bytes) {
        try {
            const str = String.fromCharCode(...bytes);
            // Remove everything except digits and dot, remove leading zeros
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
                baudRate: 9600,
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

                const bytes = Array.from(value);
                byteBuffer.push(...bytes);

                const weight = parseWeightFromBytes(byteBuffer);

                if (weight !== null && !hasSetValue) {
                    console.log("Weight from scale:", weight);

                    if (active_cdt && active_cdn) {
                        frappe.model.set_value(
                            active_cdt,
                            active_cdn,
                            "qty",
                            flt(weight, 2)
                        );
                    }

                    // ✅ mark value as set and stop further updates
                    hasSetValue = true;
                    byteBuffer = [];

                    // stop reading until next click
                    break;
                }

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }

        if (hasSetValue && reader) {
            try {
                await reader.cancel();
            } catch (e) {}
            isReading = false;
        }
    }

    // ✅ Trigger on qty click
    frappe.ui.form.on("Delivery Note Item", {
        qty: function(frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;
            hasSetValue = false; // reset flag for new click
            connectScale();
        }
    });

    // Cleanup
    window.addEventListener("beforeunload", async () => {
        try {
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});
