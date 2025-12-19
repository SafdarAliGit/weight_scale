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
    let lastUpdate = 0;
    const throttleDelay = 3000;

    let active_cdt = null;
    let active_cdn = null;

    let byteBuffer = [];
    let hasSetValue = false;

    // Store state for each row
    let rowStates = new Map(); // key: row_name, value: {hasSetValue: false, lastUpdate: 0}

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

                if (weight !== null && active_cdt && active_cdn) {
                    // Get row name for state tracking
                    const rowName = active_cdn;
                    
                    // Get or create state for this row
                    if (!rowStates.has(rowName)) {
                        rowStates.set(rowName, {hasSetValue: false, lastUpdate: 0});
                    }
                    
                    const rowState = rowStates.get(rowName);
                    
                    // Check if this row already got its value
                    if (rowState.hasSetValue) continue;
                    
                    // Check throttle delay for this specific row
                    const now = Date.now();
                    if (now - rowState.lastUpdate < throttleDelay) continue;
                    
                    rowState.lastUpdate = now;

                    console.log(`Weight from scale for row ${rowName}:`, weight);

                    // Update the specific row
                    frappe.model.set_value(
                        active_cdt,
                        active_cdn,
                        "qty",
                        flt(weight, 2)
                    );

                    rowState.hasSetValue = true; // Mark this row as done
                    byteBuffer = []; // clear buffer

                    // Don't break - keep reading for other rows
                    continue;
                }

                // Prevent buffer from growing indefinitely
                if (byteBuffer.length > 50) byteBuffer = [];

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }
        
        isReading = false;
    }

    // Trigger reading on child table qty click
    frappe.ui.form.on("Delivery Note Item", {
        qty: function(frm, cdt, cdn) {
            // Get row name from cdn
            const rowName = cdn;
            
            // Reset state for this specific row
            if (rowStates.has(rowName)) {
                rowStates.get(rowName).hasSetValue = false;
            } else {
                rowStates.set(rowName, {hasSetValue: false, lastUpdate: 0});
            }
            
            // Set active row
            active_cdt = cdt;
            active_cdn = cdn;
            
            // Connect and start reading
            connectScale();
        }
    });

    // Also listen for new rows being added
    frappe.ui.form.on("Delivery Note", {
        items_add: function(frm, cdt, cdn) {
            // Initialize state for new row
            const rowName = cdn;
            rowStates.set(rowName, {hasSetValue: false, lastUpdate: 0});
        },
        
        // Clean up when form is closed
        before_save: function(frm) {
            // Keep row states for current rows
            const currentRows = frm.doc.items || [];
            const newRowStates = new Map();
            
            currentRows.forEach(item => {
                const rowName = item.name;
                if (rowStates.has(rowName)) {
                    newRowStates.set(rowName, rowStates.get(rowName));
                }
            });
            
            rowStates = newRowStates;
        }
    });

    // Cleanup on page unload
    window.addEventListener("beforeunload", async () => {
        try {
            isReading = false;
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });

});