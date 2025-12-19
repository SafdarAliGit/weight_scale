$(document).ready(function () {

    if ('serial' in navigator) {

        let port;
        let reader;
        let textDecoder;
        let lastUpdate = 0;
        const throttleDelay = 3000;

        // 👇 Store clicked row info
        let active_cdt = null;
        let active_cdn = null;

        function reverseString(str) {
            const numericData = str.match(/(\d+\.\d+)/);
            if (!numericData) return null;
            return parseFloat(numericData[0]) * 1000;
        }

        async function connectSerial() {
            try {
                if (port) return;

                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });

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
                    if (isNaN(floatValue)) continue;

                    const currentTime = Date.now();
                    if (currentTime - lastUpdate < throttleDelay) continue;

                    lastUpdate = currentTime;

                    // ✅ SET VALUE INTO CLICKED CHILD ROW
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

        // ✅ DELIVERY NOTE ITEM → QTY CLICK
        frappe.ui.form.on("Delivery Note Item", {
            qty: function (frm, cdt, cdn) {
                active_cdt = cdt;
                active_cdn = cdn;
                connectSerial();
            }
        });

    } else {
        console.error('Web Serial API is not supported in this browser.');
    }

});
