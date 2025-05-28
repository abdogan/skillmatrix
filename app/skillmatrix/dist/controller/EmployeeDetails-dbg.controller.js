sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
  ], function (Controller, UIComponent) {
    "use strict";
  
    return Controller.extend("skillmatrix.skillmatrix.controller.EmployeeDetails", {
      onInit() {
        const oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteEmployeeDetails").attachPatternMatched(this._onEmployeeMatched, this);
      },

      _onEmployeeMatched(oEvent) {
        const sEmployeeID = oEvent.getParameter("arguments").KID;
        this.getView().bindElement({
          path: "/TeamMembers('" + sEmployeeID + "')",
          model: "catalogModel",
          parameters: { $$updateGroupId: "teamMembersGroup" }
        });
      }
    });
  });