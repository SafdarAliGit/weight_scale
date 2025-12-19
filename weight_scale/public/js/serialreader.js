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

    async function connectScale() {
        try {
            // Reuse port if already open
            if (port && port.readable) {
                console.warn("Scale already connected");
                if (!isReading) {
                    isReading = true;
                    readScaleData();
                }
                return;
            }

            const ports = await navigator.serial.getPorts();
            port = ports.length ? ports[0] : await navigator.serial.requestPort();

            await port.open({
                baudRate: 9600,  // adjust according to your scale
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

                // Log raw bytes
                const rawArray = Array.from(value);
                console.log("RAW SCALE BYTES:", rawArray);

                // Try converting to string safely (for ASCII scales)
                try {
                    const str = String.fromCharCode(...value);
                    console.log("Scale string:", str);
                } catch (e) {
                    console.warn("Cannot decode bytes as string:", value);
                }

                // Optional: set into qty field if numeric detected
                // Here we can add parsing later once we know exact protocol

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
