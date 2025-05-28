sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/ui/core/UIComponent"
], (BaseController, MessageBox, UIComponent) => {
  "use strict";

  return BaseController.extend("skillmatrix.skillmatrix.controller.App", {
    onInit() {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.attachRouteMatched(this.onRouteMatched, this);
    },

    getText(sKey, aArgs) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    },

    onRouteMatched(oEvent) {
      var sRouteName = oEvent.getParameter("name"),
          oIconTabBarWrapper = this.byId("iconTabBarWrapper"),
          oShellBar = this.byId("appShellBar");
    
      var bHideTabBar = sRouteName === "RouteEditEmployeeData" || sRouteName === "RouteEmployeeDetails";
    
      oIconTabBarWrapper.setVisible(!bHideTabBar);
      oShellBar.setShowNavButton(bHideTabBar);
    },

    onTabSelect(oEvent) {
      const sKey = oEvent.getParameter("key"),
        oRouter = UIComponent.getRouterFor(this);

      switch (sKey) {
        case "home":
          oRouter.navTo("RouteMain");
          break;
        case "upload":
          oRouter.navTo("RouteUpload");
          break;
        case "manageEntries":
          oRouter.navTo("RouteManageEntries");
          break;
        default:
          MessageBox.error(this.getText("routeNotFound"))

      }
    },

    onNavButtonPress() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteMain");
    }


  });
});