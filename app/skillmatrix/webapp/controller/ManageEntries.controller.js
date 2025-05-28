sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent"
], function (Controller, JSONModel, UIComponent) {
  "use strict";

  return Controller.extend("skillmatrix.skillmatrix.controller.ManageEntries", {
    onInit() {
      const oNewEntryData = {
        KID: null,
        FIRST_NAME: null,
        LAST_NAME: null,
        EMAIL: null,
        CAPACITY: null,
        LOCATION: null,
        TO_MEMBER_SKILLS: []
      };

      const oNewEntryModel = new JSONModel(oNewEntryData);
      this.getView().setModel(oNewEntryModel, "NewEntryModel");
    },

    getText(sKey, aArgs) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    },

    onAddSkill() {
      // Accessing the comboboxes and get the selected keys
      const oSkillComboBox = this.byId("NewSkillsComboBox"),
        oExpertiseLevelComboBox = this.byId("NewExpertiseLevelComboBox"),
        sSelectedSkill = oSkillComboBox.getSelectedKey(),
        nSelectedExpertiseLevel = oExpertiseLevelComboBox.getSelectedKey();

      //Validate if both comboboxes have been selected
      if (!sSelectedSkill || !nSelectedExpertiseLevel) {
        sap.m.MessageToast.show(this.getText("selectSkillAndLevel"));
        return;
      }

      const oModel = this.getView().getModel("NewEntryModel"),
        //Get existing skill list from the model, if it's undefined, use an empty list
        aSkills = oModel.getProperty("/TO_MEMBER_SKILLS") || [];

      //Prevent duplicate skills
      const bExists = aSkills.some(skill => skill.SKILL === sSelectedSkill);
      if (bExists) {
        sap.m.MessageToast.show(this.getText("duplicateSkill"));
        return;
      }

      // Add new skill entry to the aSkills array
      aSkills.push({
        SKILL: sSelectedSkill,
        SCORE: parseInt(nSelectedExpertiseLevel)
      });

      oModel.setProperty("/TO_MEMBER_SKILLS", aSkills);
      oSkillComboBox.setSelectedKey([]);
      oExpertiseLevelComboBox.setSelectedKey([]);
    },

    onDeleteSkill(oEvent) {
      const oSource = oEvent.getSource(),
        oContext = oSource.getBindingContext("NewEntryModel"),
        sPath = oContext.getPath(),
        oModel = this.getView().getModel("NewEntryModel");

      //Get the array of skills
      const aSkills = oModel.getProperty("/TO_MEMBER_SKILLS");
      //Get the index of the item/skill to remove
      const iIndex = parseInt(sPath.split("/").pop());

      //Remove the skill/item at the index
      aSkills.splice(iIndex, 1);

      //Re-set the array so the table refreshes
      oModel.setProperty("/TO_MEMBER_SKILLS", aSkills);

      sap.m.MessageToast.show(this.getText("skillRemoved"));
    },

    _validateForm() {
      const oView = this.getView();
      let bValid = true;

      const oFirstName = oView.byId("NewFirstName"),
        oLastName = oView.byId("NewLastName"),
        oKID = oView.byId("NewKID"),
        oEmail = oView.byId("NewEmail");


      const sFirstName = oFirstName.getValue(),
        sLastName = oLastName.getValue(),
        sKID = oKID.getValue(),
        sEmail = oEmail.getValue();

      // Regex
      const nameRegex = /^[A-Za-zÀ-ÿ'-]+$/,
        kidRegex = /^[A-Za-z][0-9]*$/,
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

      // KID
      if (!sKID) {
        oKID.setValueState("Error");
        oKID.setValueStateText(this.getText("fieldRequiredText"));
        bValid = false;
      } else if (!kidRegex.test(sKID)) {
        oKID.setValueState("Error");
        oKID.setValueStateText(this.getText("kidInputValueStateText"));
        bValid = false;
      } else {
        oKID.setValueState("None");
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

      // Location
      const oSkillCombo = this.byId("newLocationComboBox"),
       sSelectedKey = oSkillCombo.getSelectedKey();

      if (!sSelectedKey) {
        oSkillCombo.setValueState("Error");
        oSkillCombo.setValueStateText(this.getText("fieldRequiredText"));
        bValid = false;
      } else {
        oSkillCombo.setValueState("None");
      }

      return bValid;
    },

    async handleSubmit() {
      if (!this._validateForm()) {
        sap.m.MessageBox.warning(this.getText("errorOnSubmitWarning"));
        return;
      }


      const oNewEntryData = this.getView().getModel("NewEntryModel").getData(),
        oCatalogModel = this.getView().getModel("catalogModel");

      try {
        const sBatchGroupId = "newTeamMembersGroup";
        const oListBinding = oCatalogModel.bindList("/TeamMembers", undefined, undefined, undefined, { $$updateGroupId: sBatchGroupId });



        oListBinding.create(oNewEntryData);


        await oCatalogModel.submitBatch(sBatchGroupId).then(() => {
          sap.m.MessageToast.show(this.getText("newEntryCreateSuccess"));
          this.getView().getModel("NewEntryModel").setData({
            KID: null,
            FIRST_NAME: null,
            LAST_NAME: null,
            EMAIL: null,
            CAPACITY: null,
            LOCATION: null,
            TO_MEMBER_SKILLS: []
          });

          this.byId("NewSkillsComboBox").setSelectedKey(null);
          this.byId("NewExpertiseLevelComboBox").setSelectedKey(null);


          const oRouter = UIComponent.getRouterFor(this);
          setTimeout(() => {
            oRouter.navTo("RouteMain", {}, true);
          }, 500);
        })

      } catch (oError) {
        console.error(this.getText("newEntryErrorConsole"), oError);
        sap.m.MessageBox.error(this.getText("newEntryErrorMessageBox"));
      }
    },

    handleCancel() {
      const oModel = this.getView().getModel("NewEntryModel");

      oModel.setData({
        KID: null,
        FIRST_NAME: null,
        LAST_NAME: null,
        EMAIL: null,
        CAPACITY: null,
        LOCATION: null,
        TO_MEMBER_SKILLS: []
      });
      this.byId("NewSkillsComboBox").setSelectedKey(null);
      this.byId("NewExpertiseLevelComboBox").setSelectedKey(null);
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteMain", {}, true);
    }
  });
});