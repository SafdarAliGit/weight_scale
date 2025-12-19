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
//         qty: function(frm, cdt, cdn) {
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

    let lastConsoleUpdate = 0; // timestamp for slowing console/log
    let weightUpdateTimeout = null; // timeout for delayed update
    let lastWeightValue = null; // store last weight value

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
            if (!port) {
                const ports = await navigator.serial.getPorts();
                port = ports.length ? ports[0] : await navigator.serial.requestPort();
                await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
                console.log("Scale connected successfully!");
            }

            if (!reader) {
                reader = port.readable.getReader();
                isReading = true;
                readScaleStream();
            }
        } catch (error) {
            console.error("Error connecting to weight scale:", error);
        }
    }

    function updateQtyWithDelay(weight) {
        // Clear any existing timeout
        if (weightUpdateTimeout) {
            clearTimeout(weightUpdateTimeout);
        }
        
        // Store the latest weight value
        lastWeightValue = weight;
        
        // Set a new timeout for 3 seconds
        weightUpdateTimeout = setTimeout(() => {
            if (active_cdt && active_cdn && !hasSetValue) {
                frappe.model.set_value(active_cdt, active_cdn, "qty", flt(lastWeightValue, 2));
                hasSetValue = true;
                console.log("Setting qty after 3 seconds:", lastWeightValue);
                byteBuffer = [];
            }
        }, 3000); // 3 seconds delay
    }

    async function readScaleStream() {
        while (isReading) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                const bytes = Array.from(value);

                // Ignore control bytes
                if (bytes.every(b => b < 32)) continue;

                byteBuffer.push(...bytes);

                const weight = parseWeightFromBytes(byteBuffer);

                if (weight !== null) {
                    // Update with 3 seconds delay
                    if (active_cdt && active_cdn && !hasSetValue) {
                        updateQtyWithDelay(weight);
                    }

                    // ✅ Slow down stream in console/log every 3 seconds
                    const now = Date.now();
                    if (now - lastConsoleUpdate >= 3000) {
                        console.log("Scale stream value:", weight);
                        lastConsoleUpdate = now;
                    }
                }

                // Prevent buffer overflow
                if (byteBuffer.length > 100) byteBuffer = [];

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }
    }

    // Trigger reading per click on qty
    frappe.ui.form.on("Delivery Note Item", {
        qty: function(frm, cdt, cdn) {
            // Clear any pending timeout when user clicks a new field
            if (weightUpdateTimeout) {
                clearTimeout(weightUpdateTimeout);
                weightUpdateTimeout = null;
            }
            
            active_cdt = cdt;
            active_cdn = cdn;
            hasSetValue = false;
            lastWeightValue = null;
            byteBuffer = []; // fresh read
            lastConsoleUpdate = 0;
            connectScale();
        }
    });

    // Cleanup
    window.addEventListener("beforeunload", async () => {
        try {
            isReading = false;
            if (weightUpdateTimeout) clearTimeout(weightUpdateTimeout);
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});