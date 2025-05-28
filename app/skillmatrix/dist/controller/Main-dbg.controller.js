sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "skillmatrix/skillmatrix/formatter/CapacityFormatter",
    "sap/ui/core/Fragment"


], (Controller, JSONModel, Filter, CapacityFormatter, Fragment) => {
    "use strict";

    return Controller.extend("skillmatrix.skillmatrix.controller.Main", {
        capacityFormatter: CapacityFormatter,

        onInit() {
            const oDateModel = new JSONModel({
                DateFilter: {
                    dateFrom: null,
                    dateTo: null
                }

            });
            this.getView().setModel(oDateModel, "dateFilterModel");

            this.getOwnerComponent().getRouter()
                .getRoute("RouteMain")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched() {
            const oGrid = this.byId("gridList"),
                oBinding = oGrid.getBinding("items");

            if (oBinding) {
                oBinding.refresh();
            }
        },

        getText(sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        onDateRangeChange(oEvent) {
            let oDatePicker = oEvent.getSource(),
                fromDate = oDatePicker.getDateValue(),
                toDate = oDatePicker.getSecondDateValue();

            if (!fromDate || !toDate) {
                return;
            }

            // Force date snap to start of the week (Monday)
            const dayFrom = fromDate.getDay(),
                offsetFrom = dayFrom === 0 ? -6 : 1 - dayFrom; // Sunday = 0, Monday = 1 and so on
            fromDate = new Date(fromDate);
            fromDate.setDate(fromDate.getDate() + offsetFrom);

            // Snap to end of the week (Sunday of the same or future week)
            const dayTo = toDate.getDay(),
                offsetTo = dayTo === 0 ? 0 : 7 - dayTo;

            toDate = new Date(toDate);
            toDate.setDate(toDate.getDate() + offsetTo);

            // Update control
            oDatePicker.setDateValue(fromDate);
            oDatePicker.setSecondDateValue(toDate);

            const oModel = this.getView().getModel("dateFilterModel");
            oModel.setProperty("/DateFilter/dateFrom", fromDate);
            oModel.setProperty("/DateFilter/dateTo", toDate);


        },

        onFilterBarSearch() {
            const oGridList = this.byId("gridList"),
                oBinding = oGridList.getBinding("items");

            // Get selected values from UI controls directly by ID
            const aSkillKeys = this.byId("skillsFilter").getSelectedKeys(),
                aMemberKeys = this.byId("membersFilter").getSelectedKeys();

            const aFilters = [];

            // --- Skill filters ---
            if (aSkillKeys.length) {
                const aSkillFilters = aSkillKeys.map(sKey => new sap.ui.model.Filter({
                    path: "TO_MEMBER_SKILLS",
                    operator: sap.ui.model.FilterOperator.Any,
                    variable: "member",
                    condition: new sap.ui.model.Filter("member/SKILL", sap.ui.model.FilterOperator.EQ, sKey)
                }))

                aFilters.push(new sap.ui.model.Filter({ filters: aSkillFilters, and: true }));
            }

            // --- Member filters ---
            if (aMemberKeys.length) {
                const aMemberFilters = aMemberKeys.map(key =>
                    new Filter("KID", "EQ", key)
                );
                aFilters.push(new Filter({ filters: aMemberFilters, and: false }));
            }
            console.log("Selected skill keys:", this.byId("skillsFilter").getSelectedKeys());

            // --- Date Range Extraction ---
            const oDateModel = this.getView().getModel("dateFilterModel");
            const fromDate = oDateModel.getProperty("/DateFilter/dateFrom");
            const toDate = oDateModel.getProperty("/DateFilter/dateTo");

            console.log("Filter range from:", fromDate, "to:", toDate);

            // if the date range was not selected, skips capacity filtering entirely
            if (!fromDate || !toDate) {
                oBinding.filter(aFilters.length ? new Filter({ filters: aFilters, and: true }) : []);
                return;
            }

            // --- Helper Function: Parse DD.MM.YYYY string to Javascript Date object ---
            const parseDateFromRange = (rangeStr) => {
                const startStr = rangeStr.split(" - ")[0]; // e.g. "02.06.25"
                const [day, month, yearSuffix] = startStr.split(".");
                const fullYear = parseInt(yearSuffix, 10) < 50 ? 2000 + parseInt(yearSuffix) : 1900 + parseInt(yearSuffix);
                return new Date(`${fullYear}-${month}-${day}`); // "yyyy-mm-dd" for JS Date
            };


            // --- Get All TeamMembers with TO_CAPACITY Expanded ---
            // Get all visible TeamMembers from the list binding context
            const allMembers = oBinding.getCurrentContexts().map(ctx => ctx.getObject());

            // Create an object to store availability data indexed by KID
            const availabilityData = {};

            allMembers.forEach(member => {
                const capacities = member.TO_CAPACITY || [];

                // Weeks within selected range
                const inRangeWeeks = capacities.filter(c => {
                    const capDate = parseDateFromRange(c.DATE_RANGE);
                    return capDate >= fromDate && capDate <= toDate;
                });

                if (!inRangeWeeks.length) return;

                // Raw average CAPACITY (0 = free, 1 = fully booked)
                const rawAvg = inRangeWeeks.reduce((sum, c) => sum + c.CAPACITY, 0) / inRangeWeeks.length;

                // Convert to availability
                const avgAvailability = 1 - rawAvg;
                const availabilityPercent = (avgAvailability * 100).toFixed(2);

                // Annotate member for display
                member.availabilityPercent = `${availabilityPercent}%`;
                console.log("Member enriched:", member);

                // Determine next fully available week (CAPACITY === 0)
                const sortedFuture = capacities
                    .map(c => ({
                        date: parseDateFromRange(c.DATE_RANGE),
                        cap: c.CAPACITY,
                        range: c.DATE_RANGE
                    }))
                    .filter(c => c.date > toDate)
                    .sort((a, b) => a.date - b.date);

                const nextFree = sortedFuture.find(c => c.cap === 0);
                member.nextAvailability = nextFree ? nextFree.range : "-";

                // Debug
                console.log(`Member ${member.KID} : Availability: ${availabilityPercent}%, Next Free: ${member.nextAvailability}`);

                // Store in external availability model by KID
                availabilityData[member.KID] = {
                    availabilityPercent: `${availabilityPercent}%`,
                    nextAvailability: member.nextAvailability
                };
            });

            // Register the availability model to the view
            const oAvailabilityModel = new JSONModel(availabilityData);
            this.getView().setModel(oAvailabilityModel, "availabilityModel");




            // Apply all filters to binding
            oBinding.filter(
                aFilters.length ? new Filter({ filters: aFilters, and: true }) : []
            );
        },

        onClearFilters() {
            const oSkills = this.byId("skillsFilter"),
                oMembers = this.byId("membersFilter"),
                oDateRange = this.byId("dateRangeFilter");
                

            if (oSkills) oSkills.setSelectedKeys([]);
            if (oMembers) oMembers.setSelectedKeys([]);

            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
            }

            // re-run filtering logic to show all
            
            this.onFilterBarSearch();
            

            // show confirmation message
            sap.m.MessageToast.show(this.getText("filtersCleared"));
        },

        onSelectionChange() {
            this.onFilterBarSearch();
        },

        onEditEmployeeDataPress(oEvent) {
            const oEmployeeContext = oEvent.getSource().getBindingContext("catalogModel"),
                sEmployeeID = oEmployeeContext.getProperty("KID");

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteEditEmployeeData", { KID: sEmployeeID });
        },

        onMorePress(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("catalogModel");

            if (!this._pActionSheet) {
                this._pActionSheet = this.loadFragment({
                    name: "skillmatrix.skillmatrix.view.ActionSheet",
                    id: "actionSheet"
                }).then((oFragment) => {
                    oFragment.setModel(this.getView().getModel("i18n"), "i18n");
                    this.getView().addDependent(oFragment);
                    return oFragment;
                });
            }

            this._pActionSheet.then((oActionSheet) => {
                oActionSheet.setBindingContext(oContext, "catalogModel");
                oActionSheet.openBy(oButton);
            });
        },

        onOpenWeekPicker(oEvent) {
            const oView = this.getView();
            const oInput = this.byId("weeklyInput");

            // create popover
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "skillmatrix.skillmatrix.view.WeekPicker",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });

            }
            this._pPopover.then(function (oPopover) {
                oPopover.openBy(oInput);
            });
        },

        onDetailsPress(oEvent) {
            const oEmployeeKID = oEvent.getSource().getBindingContext("catalogModel"),
                sEmployeeKID = oEmployeeKID.getProperty("KID");

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteEmployeeDetails", { KID: sEmployeeKID });
        },

        onDeletePress(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("catalogModel");

            const oCatalogModel = this.getView().getModel("catalogModel");

            if (!oContext) {
                console.warn(this.getText("DeleteNoContext"));
                return;
            }

            // Confirmation dialog 
            sap.m.MessageBox.confirm(this.getText("DeleteConfirmation"), {
                onClose: (sAction) => {
                    if (sAction === "OK") {
                        oContext.delete();


                        oCatalogModel.submitBatch("teamMembersGroup")
                            .then(() => {

                                sap.m.MessageToast.show(this.getText("DeleteSuccessText"));
                                oCatalogModel.refresh();
                            })
                            .catch((oError) => {
                                sap.m.MessageBox.error(this.getText("DeleteFailedText"));
                                console.error(this.getText("DeleteConsoleErrorText"), oError);
                            });
                    }
                }
            });
        }

    });
});