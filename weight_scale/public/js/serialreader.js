// CODE WITH CONSOLES

// $(document).ready(function () {

//     if (!('serial' in navigator)) {
//         console.error('Web Serial API is not supported in this browser.');
//         return;
//     }

//     let port = null;
//     let reader = null;
//     let textDecoder = null;

//     let active_cdt = null;
//     let active_cdn = null;

//     let lastUpdate = 0;
//     const throttleDelay = 3000;

//     let weightLocked = true; // 🔒 locked by default

//     // ✅ STRICT parser: accepts ONLY + values
//     function parseWeightFromString(data) {
//         if (typeof data !== "string") return null;

//         const match = data.match(/\+(\d+(\.\d+)?)/);
//         if (!match) return null;

//         return parseFloat(match[1]);
//     }

//     // 🔌 Connect to serial port
//     async function connectSerial() {
//         try {
//             if (!port) {
//                 port = await navigator.serial.requestPort();
//                 await port.open({ baudRate: 9600 });

//                 textDecoder = new TextDecoderStream();
//                 port.readable.pipeTo(textDecoder.writable);
//                 reader = textDecoder.readable.getReader();

//                 readSerialData(); // start loop once
//             }
//         } catch (error) {
//             console.error('Error connecting to serial port:', error);
//         }
//     }

//     // 📡 Read data continuously
//     async function readSerialData() {
//         while (true) {
//             try {
//                 const { value, done } = await reader.read();

//                 if (done) {
//                     reader.releaseLock();
//                     break;
//                 }

//                 // 🚫 Do nothing if already locked
//                 if (weightLocked) continue;

//                 const floatValue = parseWeightFromString(value);
//                 console.log("Weight from scale:", floatValue);

//                 if (!isNaN(floatValue) && floatValue > 0) {
//                     const now = Date.now();

//                     if (now - lastUpdate >= throttleDelay) {
//                         lastUpdate = now;

//                         if (active_cdt && active_cdn) {
//                             frappe.model.set_value(
//                                 active_cdt,
//                                 active_cdn,
//                                 "qty",
//                                 flt(floatValue, 2)
//                             );

//                             weightLocked = true; // 🔒 LOCK after first set
//                             console.log("Weight locked:", floatValue);
//                         }
//                     }
//                 }
//             } catch (error) {
//                 console.error('Error reading serial data:', error);
//                 break;
//             }
//         }
//     }

//     // 🖱️ Button click — unlock & capture once
//     frappe.ui.form.on("Delivery Note Item", {
//         custom_get_weight: function (frm, cdt, cdn) {
//             active_cdt = cdt;
//             active_cdn = cdn;

//             lastUpdate = 0;
//             weightLocked = false; // 🔓 unlock capture

//             connectSerial();
//         }
//     });

// });


// CONSOLE REMOVED CODE

$(document).ready(function () {

    if (!('serial' in navigator)) {
        return;
    }

    let port = null;
    let reader = null;
    let textDecoder = null;

    let active_cdt = null;
    let active_cdn = null;

    let lastUpdate = 0;
    const throttleDelay = 3000;

    let weightLocked = true; // locked by default

    // STRICT parser: accepts ONLY + values
    function parseWeightFromString(data) {
        if (typeof data !== "string") return null;

        const match = data.match(/\+(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
    }

    async function connectSerial() {
        try {
            if (port) return; // already connected

            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });

            textDecoder = new TextDecoderStream();
            port.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.getReader();

            readSerialData(); // start once
        } catch (error) {
            port = null;
        }
    }

    async function readSerialData() {
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                // 🔒 Ignore stream when locked
                if (weightLocked) continue;

                const floatValue = parseWeightFromString(value);
                if (floatValue === null || floatValue <= 0) continue;

                const now = Date.now();
                if (now - lastUpdate < throttleDelay) continue;

                lastUpdate = now;

                if (active_cdt && active_cdn) {
                    frappe.model.set_value(
                        active_cdt,
                        active_cdn,
                        "qty",
                        flt(floatValue, 2)
                    );

                    weightLocked = true; // lock after first valid value
                }
            } catch {
                break;
            }
        }
    }

    frappe.ui.form.on("Delivery Note Item", {
        custom_get_weight: function (frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;

            lastUpdate = 0;
            weightLocked = false; // unlock for this click

            connectSerial();
        }
    });

});
