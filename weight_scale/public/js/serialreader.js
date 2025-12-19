$(document).ready(function () {

    if (!('serial' in navigator)) {
        console.error('Web Serial API not supported');
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

    function reverseString(str) {
        const match = str.match(/(\d+\.\d+)/);
        if (!match) return null;
        return parseFloat(match[0]) * 1000;
    }

    async function connectSerial() {
        try {
            // ✅ If already open, do nothing
            if (port && port.readable) {
                console.warn("Weight scale already connected");
                return;
            }

            // ✅ Reuse previously approved port if available
            const ports = await navigator.serial.getPorts();
            port = ports.length ? ports[0] : await navigator.serial.requestPort();

            await port.open({
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: "none"
            });

            decoder = new TextDecoderStream();
            port.readable.pipeTo(decoder.writable);
            reader = decoder.readable.getReader();

            if (!isReading) {
                isReading = true;
                readSerialData();
            }

        } catch (error) {
            console.error('Error connecting to weight scale:', error);
        }
    }

    async function readSerialData() {
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                const weight = reverseString(value);
                if (isNaN(weight)) continue;

                const now = Date.now();
                if (now - lastUpdate < throttleDelay) continue;

                lastUpdate = now;
                console.log("Weight Scale:", weight);

                if (active_cdt && active_cdn) {
                    frappe.model.set_value(
                        active_cdt,
                        active_cdn,
                        "qty",
                        flt(weight, 2)
                    );
                }

            } catch (error) {
                console.error('Error reading weight scale:', error);
                break;
            }
        }
    }

    // ✅ DELIVERY NOTE ITEM → QTY CLICK
    frappe.ui.form.on("Delivery Note Item", {
        qty: function (frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;
            connectSerial();
        }
    });

    // ✅ Clean shutdown (VERY IMPORTANT)
    window.addEventListener("beforeunload", async () => {
        try {
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});
