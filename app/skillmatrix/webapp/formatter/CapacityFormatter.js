sap.ui.define([

], () => {
    "use strict";

    return {

        getAvailabilityPercent(kid, availabilityMap) {
            const entry = availabilityMap && availabilityMap[kid];
            return entry ? entry.availabilityPercent : "–";
        },
        
        getNextAvailability(kid, availabilityMap) {
            const entry = availabilityMap && availabilityMap[kid];
            return entry ? entry.nextAvailability : "–";
        },

        getHighlightForAvailability(kid, availabilityMap) {
            const entry = availabilityMap && availabilityMap[kid];
            if (!entry || !entry.availabilityPercent) return "None";
        
            // Example : Convert string "87.50%" to float 87.5
            const value = parseFloat(entry.availabilityPercent.replace("%", "").replace(",", "."));
            if (isNaN(value)) return "None";
        
            // Defining thresholds (percent scale)
            if (value === 0) return "Error";     // Fully booked
            if (value >= 75) return "Success";   // High availability
            if (value > 0 && value < 75) return "Warning"; // Partial availability
        
            return "None";
        }

    }
});