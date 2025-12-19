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

    let byteBuffer = [];
    let hasSetValue = false;

    // Use your working function to parse bytes from scale
    function parseWeightFromBytes(bytes) {
        try {
            const str = String.fromCharCode(...bytes);
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

                // Ignore control bytes (<32)
                if (bytes.every(b => b < 32)) continue;

                byteBuffer.push(...bytes);

                const weight = parseWeightFromBytes(byteBuffer);

                if (weight !== null && !hasSetValue) {
                    const now = Date.now();
                    if (now - lastUpdate < throttleDelay) continue;
                    lastUpdate = now;

                    console.log("Weight from scale:", weight);

                    if (active_cdt && active_cdn) {
                        frappe.model.set_value(
                            active_cdt,
                            active_cdn,
                            "qty",
                            flt(weight, 2)
                        );
                    }

                    hasSetValue = true; // ✅ Prevent further updates
                    byteBuffer = []; // clear buffer

                    // Stop reading until next click
                    break;
                }

                // Prevent buffer from growing indefinitely
                if (byteBuffer.length > 50) byteBuffer = [];

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }

        // Release reader after first valid value
        if (hasSetValue && reader) {
            try {
                await reader.cancel();
            } catch (e) {}
            isReading = false;
        }
    }

// Use delegated click handler for child table qty fields
$(document).on('click', '.grid-row input[data-fieldname="qty"]', function() {
    // Get the row's cdt and cdn
    const $row = $(this).closest('.grid-row');
    const cdt = $row.attr('data-doctype');  // child doctype
    const cdn = $row.attr('data-name');     // child docname

    if (!cdt || !cdn) return;

    active_cdt = cdt;
    active_cdn = cdn;
    hasSetValue = false; // allow new read

    connectScale();
});


    // Cleanup on page unload
    window.addEventListener("beforeunload", async () => {
        try {
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});



