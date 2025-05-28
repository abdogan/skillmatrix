// Provides a shim for the xlsx library
sap.ui.loader.config({
    paths: {
      "custom/XLSX": "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min"
    },
    shim: {
      "custom/XLSX": {
        amd: true,
        exports: "XLSX"
      }
    }
  });



sap.ui.define([
    "sap/ui/core/UIComponent",
    "skillmatrix/skillmatrix/model/models",
    
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("skillmatrix.skillmatrix.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        },

        
        
    });
});

