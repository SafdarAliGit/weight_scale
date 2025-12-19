$(document).ready(function () {

    if (!('serial' in navigator)) {
        console.error('Web Serial API is not supported in this browser.');
        return;
    }

    let port = null;
    let reader = null;
    let textDecoder = null;
    let lastUpdate = 0;
    const throttleDelay = 3000;

    let active_cdt = null;
    let active_cdn = null;

    function reverseString(str) {
        const numericData = str.match(/(\d+\.\d+)/);
        if (!numericData) return null;
        return parseFloat(numericData[0]) * 1000;
    }

    async function connectSerial() {
        try {
            // 🔒 Prevent reopening same port
            if (port && port.readable) {
                console.warn("Weight scale already connected");
                return;
            }

            port = await navigator.serial.requestPort();
            await port.open({
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: "none"
            });

            textDecoder = new TextDecoderStream();
            port.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.getReader();

            readSerialData();

        } catch (error) {
            console.error('Error connecting to weight scale:', error);
        }
    }

    async function readSerialData() {
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                let floatValue = reverseString(value);
                console.log("Weight Scale:", floatValue);
                if (isNaN(floatValue)) continue;

                const currentTime = Date.now();
                if (currentTime - lastUpdate < throttleDelay) continue;

                lastUpdate = currentTime;

                if (active_cdt && active_cdn) {
                    frappe.model.set_value(
                        active_cdt,
                        active_cdn,
                        "qty",
                        flt(floatValue, 2)
                    );
                }

            } catch (error) {
                console.error('Error reading weight scale:', error);
                break;
            }
        }
    }

    frappe.ui.form.on("Delivery Note Item", {
        qty: function (frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;
            connectSerial();
        }
    });

    // 🧹 Cleanup on page refresh
    window.addEventListener("beforeunload", async () => {
        try {
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});
