// $(document).ready(function () {

//     if (!('serial' in navigator)) {
//         console.error('Web Serial API not supported in this browser.');
//         return;
//     }

//     let port = null;
//     let reader = null;
//     let isReading = false;
//     let lastUpdate = 0;
//     const throttleDelay = 3000;

//     let active_cdt = null;
//     let active_cdn = null;

//     let byteBuffer = [];
//     let hasSetValue = false;

//     // Use your working function to parse bytes from scale
//     function parseWeightFromBytes(bytes) {
//         try {
//             const str = String.fromCharCode(...bytes);
//             const cleaned = str.replace(/[^\d.]/g, '').replace(/^0+(?=\d)/, '');
//             if (!cleaned) return null;
//             return parseFloat(cleaned);
//         } catch (e) {
//             console.warn("Cannot parse bytes:", bytes);
//             return null;
//         }
//     }

//     async function connectScale() {
//         try {
//             if (port && port.readable) {
//                 if (!isReading) {
//                     isReading = true;
//                     readScaleData();
//                 }
//                 return;
//             }

//             const ports = await navigator.serial.getPorts();
//             port = ports.length ? ports[0] : await navigator.serial.requestPort();

//             await port.open({
//                 baudRate: 9600,
//                 dataBits: 8,
//                 stopBits: 1,
//                 parity: "none"
//             });

//             reader = port.readable.getReader();
//             console.log("Scale connected successfully!");
//             isReading = true;
//             readScaleData();

//         } catch (error) {
//             console.error("Error connecting to weight scale:", error);
//         }
//     }

//     async function readScaleData() {
//         while (true) {
//             try {
//                 const { value, done } = await reader.read();
//                 if (done) break;

//                 const bytes = Array.from(value);

//                 // Ignore control bytes (<32)
//                 if (bytes.every(b => b < 32)) continue;

//                 byteBuffer.push(...bytes);

//                 const weight = parseWeightFromBytes(byteBuffer);

//                 if (weight !== null && !hasSetValue) {
//                     const now = Date.now();
//                     if (now - lastUpdate < throttleDelay) continue;
//                     lastUpdate = now;

//                     console.log("Weight from scale:", weight);

//                     if (active_cdt && active_cdn) {
//                         frappe.model.set_value(
//                             active_cdt,
//                             active_cdn,
//                             "qty",
//                             flt(weight, 2)
//                         );
//                     }

//                     hasSetValue = true; // ✅ Prevent further updates
//                     byteBuffer = []; // clear buffer

//                     // Stop reading until next click
//                     break;
//                 }

//                 // Prevent buffer from growing indefinitely
//                 if (byteBuffer.length > 50) byteBuffer = [];

//             } catch (error) {
//                 console.error("Error reading from scale:", error);
//                 break;
//             }
//         }

//         // Release reader after first valid value
//         if (hasSetValue && reader) {
//             try {
//                 await reader.cancel();
//             } catch (e) {}
//             isReading = false;
//         }
//     }

//     // Trigger reading on child table qty click
//     frappe.ui.form.on("Delivery Note Item", {
//         custom_get_weight: function(frm, cdt, cdn) {
//             active_cdt = cdt;
//             active_cdn = cdn;
//             hasSetValue = false; // reset flag for new click
//             connectScale();
//         }
//     });

//     // Cleanup on page unload
//     window.addEventListener("beforeunload", async () => {
//         try {
//             if (reader) await reader.cancel();
//             if (port) await port.close();
//         } catch (e) {}
//     });

// });


// $(document).ready(function () {

// if ('serial' in navigator) {
//         let port;
//         let reader;
//         let textDecoder;
//         let lastUpdate = 0; // Timestamp of the last update
//         const throttleDelay = 3000; // Throttle delay in milliseconds
//         let active_cdt = null;
//         let active_cdn = null;

//         function parseWeightFromString(data) {
//             if (typeof data !== "string") return null;

//             // Find +number pattern anywhere in the string
//             const match = data.match(/\+(\d+(\.\d+)?)/);

//             if (!match) return null;

//             return parseFloat(match[1]);
//         }




//         // Function to connect to the serial port
//         async function connectSerial() {
//             try {
//                 port = await navigator.serial.requestPort();
//                 await port.open({baudRate: 9600});
//                 // Initialize text decoder
//                 textDecoder = new TextDecoderStream();
//                 const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
//                 reader = textDecoder.readable.getReader();

//                 // Start reading data
//                 readSerialData();
//             } catch (error) {
//                 console.error('Error connecting to serial port:', error);
//             }
//         }

//         // Function to read data from the serial port with throttling
//         async function readSerialData() {
//             while (true) {
//                 try {
//                     const {value, done} = await reader.read();
                    
//                     if (done) {
//                         reader.releaseLock();
//                         break;
//                     }
                    
//                     // Process the received data
//                     let floatValue = parseWeightFromString(value);
//                     // let floatValue = parseInt(reversedValue);
//                     console.log("Weight from scale:", floatValue);
//                     // Check if floatValue is a valid number
//                     if (!isNaN(floatValue)) {
//                         const currentTime = Date.now();

//                         // Throttle the updates
//                         if (currentTime - lastUpdate >= throttleDelay) {
//                             lastUpdate = currentTime;

//                                 if (active_cdt && active_cdn) {
//                                 frappe.model.set_value(
//                                     active_cdt,
//                                     active_cdn,
//                                     "qty",
//                                     flt(floatValue, 2)
//                                 );
                            
//                             } 
//                         }
//                     } else {
//                         console.error('Received data is not a valid number:', floatValue);
//                     }
//                 } catch (error) {
//                     console.error('Error reading serial data:', error);
//                     break;
//                 }
//             }
//         }

//         frappe.ui.form.on("Delivery Note Item", {
//             custom_get_weight: function(frm, cdt, cdn) {
//             active_cdt = cdt;
//             active_cdn = cdn;
//             connectSerial();
//         }
//     });

//     } else {
//         console.error('Web Serial API is not supported in this browser.');
//     }
// });


$(document).ready(function () {

    if (!('serial' in navigator)) {
        console.error('Web Serial API is not supported in this browser.');
        return;
    }

    let port = null;
    let reader = null;
    let textDecoder = null;

    let active_cdt = null;
    let active_cdn = null;

    let lastUpdate = 0;
    const throttleDelay = 3000;

    let weightLocked = true; // 🔒 locked by default

    // ✅ STRICT parser: accepts ONLY + values
    function parseWeightFromString(data) {
        if (typeof data !== "string") return null;

        const match = data.match(/\+(\d+(\.\d+)?)/);
        if (!match) return null;

        return parseFloat(match[1]);
    }

    // 🔌 Connect to serial port
    async function connectSerial() {
        try {
            if (!port) {
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });

                textDecoder = new TextDecoderStream();
                port.readable.pipeTo(textDecoder.writable);
                reader = textDecoder.readable.getReader();

                readSerialData(); // start loop once
            }
        } catch (error) {
            console.error('Error connecting to serial port:', error);
        }
    }

    // 📡 Read data continuously
    async function readSerialData() {
        while (true) {
            try {
                const { value, done } = await reader.read();

                if (done) {
                    reader.releaseLock();
                    break;
                }

                // 🚫 Do nothing if already locked
                if (weightLocked) continue;

                const floatValue = parseWeightFromString(value);
                console.log("Weight from scale:", floatValue);

                if (!isNaN(floatValue) && floatValue > 0) {
                    const now = Date.now();

                    if (now - lastUpdate >= throttleDelay) {
                        lastUpdate = now;

                        if (active_cdt && active_cdn) {
                            frappe.model.set_value(
                                active_cdt,
                                active_cdn,
                                "qty",
                                flt(floatValue, 2)
                            );

                            weightLocked = true; // 🔒 LOCK after first set
                            console.log("Weight locked:", floatValue);
                        }
                    }
                }
            } catch (error) {
                console.error('Error reading serial data:', error);
                break;
            }
        }
    }

    // 🖱️ Button click — unlock & capture once
    frappe.ui.form.on("Delivery Note Item", {
        custom_get_weight: function (frm, cdt, cdn) {
            active_cdt = cdt;
            active_cdn = cdn;

            lastUpdate = 0;
            weightLocked = false; // 🔓 unlock capture

            connectSerial();
        }
    });

});
