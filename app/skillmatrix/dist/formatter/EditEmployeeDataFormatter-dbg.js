sap.ui.define([
    

], () => {
    "use strict";

    return {

        formatObjectHeaderTitle(sFirstName, sLastName, ) {
            if (!sFirstName || !sLastName) {
                return "";
            }
            
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            
        
            try {
                const sEdit = oResourceBundle.getText("pageTitleStringEdit", []),
                 sData = oResourceBundle.getText("pageTitleStringData", []),
                 possessive = sLastName.slice(-1).toLowerCase() === "s" ? "'" : "'s";
        
                return `${sEdit} ${sFirstName} ${sLastName}${possessive} ${sData}`;
            } catch (e) {
                console.error("Error in formatter:", e);
                return `${sFirstName} ${sLastName}`;
            }
        }
    };

});