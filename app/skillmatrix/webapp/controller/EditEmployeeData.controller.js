

sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "skillmatrix/skillmatrix/formatter/EditEmployeeDataFormatter"
], function (Controller, UIComponent, EditEmployeeDataFormatter) {
  "use strict";

  return Controller.extend("skillmatrix.skillmatrix.controller.EditEmployeeData", {
    formatter: EditEmployeeDataFormatter,
    
    onInit() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteEditEmployeeData").attachPatternMatched(this._onEmployeeMatched, this);
    },

    getText(sKey, aArgs) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    },

    _onEmployeeMatched(oEvent) {
      const sEmployeeID = oEvent.getParameter("arguments").KID;
      this.getView().bindElement({
        path: "/TeamMembers('" + sEmployeeID + "')",
        model: "catalogModel",
        parameters: { $$updateGroupId: "teamMembersGroup" }
      });
    },

    onAddSkill() {
      // Accessing the comboboxes and get the selected keys
      const oSkillComboBox = this.byId("skillsComboBox"),
        oExpertiseLevelComboBox = this.byId("expertiseLevelComboBox"),
        sSelectedSkill = oSkillComboBox.getSelectedKey(),
        nSelectedExpertiseLevel = oExpertiseLevelComboBox.getSelectedKey(),
        sEmployeeID = this.getView().getBindingContext("catalogModel").getProperty("KID");

      //Validate if both comboboxes have been selected
      if (!sSelectedSkill || !nSelectedExpertiseLevel) {
        sap.m.MessageToast.show(this.getText("selectSkillAndLevel"));
        return;
      }

      //Get table control and its binding
      const oTable = this.byId("skillsTable"),
        oBinding = oTable.getBinding("rows"),
        aContexts = oBinding.getContexts();

      //Check for duplicate skill
      for (let i = 0; i < aContexts.length; i++) {
        let sExistingSkill = aContexts[i].getProperty("SKILL");
        if (sExistingSkill === sSelectedSkill) {
          sap.m.MessageToast.show(this.getText("duplicateSkill"));
          return;
        }
      }

      //Saving the values into a payload
      const oNewSkillData = {
        KID: sEmployeeID,
        SKILL: sSelectedSkill,
        SCORE: nSelectedExpertiseLevel
      };

      //create new data (add new row in odata)
      const oNewContext = oBinding.create(oNewSkillData);

      oSkillComboBox.setSelectedKey("");
      oExpertiseLevelComboBox.setSelectedKey("");
    },

    onDeleteSkill(oEvent) {
      const oButton = oEvent.getSource(),
        oContext = oButton.getBindingContext("catalogModel");

      oContext["delete"]("$auto")
        .then(function () {
          sap.m.MessageToast.show(this.getText("skillRemoved"));
        })
        .catch(function (oError) {
          sap.m.MessageToast.show(this.getText("skillRemoveError") + oError.message);
        });
    },

    handleCancel() {
      this.getView().getModel("catalogModel").resetChanges("teamMembersGroup");

      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteMain", {}, true);
    },

    _validateForm() {
      const oView = this.getView();
      let bValid = true;

      const oFirstName = oView.byId("FirstName"),
        oLastName = oView.byId("LastName"),

        oEmail = oView.byId("Email");


      const sFirstName = oFirstName.getValue(),
        sLastName = oLastName.getValue(),

        sEmail = oEmail.getValue();

      // Regex
      const nameRegex = /^[A-Za-zÀ-ÿ'-]+$/,

        emailRegex = /^\S+@\S+\.\S+$/;

      // First Name
      if (!sFirstName) {
        oFirstName.setValueState("Error");
        oFirstName.setValueStateText(this.getText("fieldRequiredText"));
        bValid = false;
      } else if (!nameRegex.test(sFirstName)) {
        oFirstName.setValueState("Error");
        oFirstName.setValueStateText(this.getText("nameInputValueStateText"));
        bValid = false;
      } else {
        oFirstName.setValueState("None");
      }

      // Last Name
      if (!sLastName) {
        oLastName.setValueState("Error");
        oLastName.setValueStateText(this.getText("fieldRequiredText"));
        bValid = false;
      } else if (!nameRegex.test(sLastName)) {
        oLastName.setValueState("Error");
        oLastName.setValueStateText(this.getText("nameInputValueStateText"));
        bValid = false;
      } else {
        oLastName.setValueState("None");
      }

      // Email
      if (!sEmail) {
        oEmail.setValueState("Error");
        oEmail.setValueStateText(this.getText("fieldRequiredText"));
        bValid = false;
      } else if (!emailRegex.test(sEmail)) {
        oEmail.setValueState("Error");
        oEmail.setValueStateText(this.getText("emailInputValueStateText"));
        bValid = false;
      } else {
        oEmail.setValueState("None");
      }

      return bValid;
    },

    handleSubmit() {
      if (!this._validateForm()) {
        sap.m.MessageBox.warning(this.getText("errorOnSubmitWarning"));
        return;
      }

      // Ask for confirmation before submit
      sap.m.MessageBox.confirm(
        this.getText("confirmSubmitMessage"),
        {
          title: this.getText("confirmSubmitTitle"),
          actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
          onClose: (sAction) => {
            if (sAction === sap.m.MessageBox.Action.OK) {
              // Proceed with submission
              this.getView().getModel("catalogModel").submitBatch("teamMembersGroup").then(() => {
                sap.m.MessageToast.show(this.getText("editDataSuccess"));

                const oRouter = UIComponent.getRouterFor(this);
                setTimeout(() => {
                  oRouter.navTo("RouteMain", {}, true);
                }, 500);

              }).catch((oError) => {
                sap.m.MessageBox.error(this.getText("errorOnSubmitMessage"));
                console.error(this.getText("submitFailed"), oError);
              });
            } else {
              return;
            }

          }
        }
      );
    }
  });
});