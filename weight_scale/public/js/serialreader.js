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

    let lastConsoleUpdate = 0;
    let weightUpdateTimeout = null;
    let lastStableWeight = null;
    let lastWeightTime = 0;
    const STABILIZATION_TIME = 3000;

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

    function updateQuantityIfStable(currentWeight) {
        const now = Date.now();
        
        if (weightUpdateTimeout) {
            clearTimeout(weightUpdateTimeout);
        }

        if (lastStableWeight === null || Math.abs(currentWeight - lastStableWeight) > 0.01) {
            lastStableWeight = currentWeight;
            lastWeightTime = now;
            
            weightUpdateTimeout = setTimeout(() => {
                if (active_cdt && active_cdn && !hasSetValue) {
                    frappe.model.set_value(active_cdt, active_cdn, "qty", flt(currentWeight, 2));
                    hasSetValue = true;
                    console.log("Weight stabilized, updating quantity to:", currentWeight);
                }
            }, STABILIZATION_TIME);
        }
        
        if (now - lastConsoleUpdate >= 3000) {
            console.log("Current scale reading:", currentWeight, "(waiting for stabilization...)");
            lastConsoleUpdate = now;
        }
    }

    async function readScaleStream() {
        while (isReading) {
            try {
                const { value, done } = await reader.read();
                if (done) break;

                const bytes = Array.from(value);
                if (bytes.every(b => b < 32)) continue;

                byteBuffer.push(...bytes);
                const weight = parseWeightFromBytes(byteBuffer);

                if (weight !== null && active_cdt && active_cdn && !hasSetValue) {
                    updateQuantityIfStable(weight);
                    byteBuffer = [];
                }

                if (byteBuffer.length > 100) byteBuffer = [];

            } catch (error) {
                console.error("Error reading from scale:", error);
                break;
            }
        }
    }

    // Initialize when form loads
    frappe.ui.form.on("Delivery Note", {
        onload: function(frm) {
            // Set up click handler for qty fields
            setupScaleIntegration(frm);
        },
        
        refresh: function(frm) {
            setupScaleIntegration(frm);
        }
    });

    function setupScaleIntegration(frm) {
        const grid = frm.fields_dict.items.grid;
        
        if (!grid) return;
        
        // Remove any existing click handlers
        grid.wrapper.off('click', '[data-fieldname="qty"] input');
        
        // Add click handler to qty field inputs
        grid.wrapper.on('click', '[data-fieldname="qty"] input', function() {
            const $row = $(this).closest('.grid-row');
            const row_name = $row.attr('data-name');
            
            if (row_name) {
                // Clear any pending weight update
                if (weightUpdateTimeout) {
                    clearTimeout(weightUpdateTimeout);
                    weightUpdateTimeout = null;
                }
                
                // Set active row
                active_cdt = `${frm.doctype} Item`;
                active_cdn = row_name;
                hasSetValue = false;
                lastStableWeight = null;
                byteBuffer = [];
                lastConsoleUpdate = 0;
                
                console.log("Clicked on qty field for row:", row_name, "Doc:", active_cdt);
                connectScale();
                
                // Also focus the input field
                $(this).focus();
            }
        });
        
        // Optional: Add a visual indicator
        grid.wrapper.on('focus', '[data-fieldname="qty"] input', function() {
            $(this).closest('.grid-row').addClass('scale-active-row');
        });
        
        grid.wrapper.on('blur', '[data-fieldname="qty"] input', function() {
            $(this).closest('.grid-row').removeClass('scale-active-row');
        });
    }

    // Add some CSS for visual feedback
    $('<style>').text(`
        .scale-active-row {
            background-color: #fff3cd !important;
            border-left: 3px solid #ffc107 !important;
        }
    `).appendTo('head');

    window.addEventListener("beforeunload", async () => {
        try {
            isReading = false;
            if (weightUpdateTimeout) clearTimeout(weightUpdateTimeout);
            if (reader) await reader.cancel();
            if (port) await port.close();
        } catch (e) {}
    });
});