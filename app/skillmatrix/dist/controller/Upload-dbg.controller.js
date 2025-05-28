sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "custom/XLSX",
  "sap/m/MessageBox",
  "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, XLSX, MessageBox, JSONModel) {
  "use strict";

  return Controller.extend("skillmatrix.skillmatrix.controller.Upload", {
    onInit() {
      const uploadModel = new JSONModel({ file: null, parsedData: [] });
      this.getView().setModel(uploadModel, "uploadModel");

      // Create a model to store TeamMembers data
      const teamMembersModel = new JSONModel({ members: [] });
      this.getView().setModel(teamMembersModel, "teamMembersModel");

      // Load the TeamMembers data when the component is initialized
      this.loadTeamMembers();

      const capacityPayloadModel = new JSONModel({ capacityData: [] });
      this.getView().setModel(capacityPayloadModel, "capacityPayloadModel");
    },

    getText(sKey, aArgs) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    },

    loadTeamMembers() {
      // Get the OData V4 model - make sure it's available first
      const oCatalogModel = this.getOwnerComponent().getModel("catalogModel");

      if (!oCatalogModel) {
        console.error("catalogModel is not available yet");
        // Try again after a short delay
        setTimeout(() => this.loadTeamMembers(), 500);
        return;
      }

      try {
        const oListBinding = oCatalogModel.bindList("/TeamMembers");

        // triggers a data request on the bound OData V4 collection /TeamMembers. 0 is the start index, 1000 is the number of entries requested (upper limit).
        oListBinding.requestContexts(0, 1000).then((aContexts) => {
          if (aContexts && aContexts.length > 0) {
            // Convert contexts to objects
            const aTeamMembers = aContexts.map(context => context.getObject());
            const teamMembersModel = this.getView().getModel("teamMembersModel");
            teamMembersModel.setProperty("/members", aTeamMembers);
            console.log("TeamMembers loaded successfully:", aTeamMembers);
          } else {
            console.log("No TeamMembers found or empty result");
          }
        }).catch((error) => {
          console.error("Error requesting TeamMembers contexts:", error);
        });
      } catch (e) {
        console.error("Error binding TeamMembers list:", e);
      }


    },

    handleUploadComplete(oEvent) {
      let sResponse = "File upload complete. Status: 404",
        iHttpStatusCode = parseInt(/\d{3}/.exec(sResponse)[0]),
        sMessage;

      if (sResponse) {
        sMessage = iHttpStatusCode === 200 ? sResponse + " (Upload Success)" : sResponse + " (Upload Error)";
        MessageToast.show(sMessage);
      }
    },


    /**
         * Change event of file upload
         * Sets the file on the JSON upload model
         * @param {Object} oEvent
         */
    fileUploadChange(oEvent) {
      const oView = this.getView(),
        oUploadModel = oView.getModel("uploadModel"),
        oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];

      oUploadModel.setProperty("/file", oFile);
      console.log("UploadModel Data:", this.getView().getModel("uploadModel").getData());

    },

    /**
           * Confirm of uploading excel file
           * @param {Object} oEvent
           */
    async handleParsePersonalDataPress(oEvent) {
      const oView = this.getView(),
        oUploadModel = oView.getModel("uploadModel"),
        oFile = oUploadModel.getProperty("/file"),
        oi18nModel = oView.getModel("i18n"),
        oCatalogModel = oView.getModel("catalogModel");

      if (!(oFile && window.FileReader)) return;

      // Fetch existing locations
      const oLocationBinding = oCatalogModel.bindList("/Locations");
      const aLocationContexts = await oLocationBinding.requestContexts();
      const existingLocations = new Set(aLocationContexts.map(ctx => ctx.getObject().LOCATION));

      const oFileReader = new FileReader();

      oFileReader.onload = async (e) => {
        const data = e.target.result,
          workbook = XLSX.read(data, { type: "binary" }),
          worksheet = workbook.Sheets[workbook.SheetNames[0]],
          rawData = XLSX.utils.sheet_to_json(worksheet),
          aKeys = rawData[0] ? Object.keys(rawData[0]) : [];

        if (!aKeys.length) {
          MessageBox.information(oi18nModel.getProperty("emptyExcelFile"));
          this.onUploadCancel();
          return;
        }

        const keyMap = {
          "firstname": "FIRST_NAME",
          "lastname": "LAST_NAME",
          "email": "EMAIL",
          "kid": "KID",
          "location(uuid)": "LOCATION",
          "location(city)": "CITY",
          "country": "COUNTRY"
        };

        const normalizedData = [];
        const newLocations = [];

        for (const row of rawData) {
          const normalizedRow = {};
          const locationEntry = {};

          // Normalize keys and map values
          Object.entries(row).forEach(([key, value]) => {
            const cleanKey = key.toLowerCase().replace(/[\s_]/g, "");
            const mappedKey = keyMap[cleanKey];
            if (mappedKey && value !== undefined) {
              if (mappedKey === "LOCATION") {
                normalizedRow.LOCATION = value.trim();
              } else if (mappedKey === "CITY") {
                locationEntry.CITY = value.trim();
              } else if (mappedKey === "COUNTRY") {
                locationEntry.COUNTRY = value.trim();
              } else {
                normalizedRow[mappedKey] = value.toString().trim();
              }
            }
          });

          // Basic required fields validation
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedRow.LOCATION);
          const hasValidKID = normalizedRow.KID && normalizedRow.KID.trim().length > 0;

          if (!isValidUUID || !hasValidKID) {
            console.warn("Skipping invalid row:", row);
            continue;
          }

          // CAPACITY always null (handled in a different entity)
          normalizedRow.CAPACITY = null;

          normalizedData.push(normalizedRow);

          // Check if this LOCATION UUID needs to be created
          if (!existingLocations.has(normalizedRow.LOCATION)) {
            newLocations.push({
              LOCATION: normalizedRow.LOCATION,
              CITY: locationEntry.CITY || "",
              COUNTRY: locationEntry.COUNTRY || ""
            });
            existingLocations.add(normalizedRow.LOCATION); // Avoid duplicate creates in same file
          }
        }

        oUploadModel.setProperty("/parsedData", normalizedData);
        oUploadModel.setProperty("/parsedLocations", newLocations);

        console.log("Team members parsed:", normalizedData);
        console.log("New locations found:", newLocations);

        MessageBox.information(oi18nModel.getProperty("parseInfoSuccessMsg"));
      };

      oFileReader.onerror = function (ex) {
        console.log(ex);
      };

      oFileReader.readAsArrayBuffer(oFile);
    },

    async handleSubmitPersonalDataPress() {
      const oView = this.getView(),
        oUploadModel = oView.getModel("uploadModel"),
        oCatalogModel = oView.getModel("catalogModel"),
        parsedData = oUploadModel.getProperty("/parsedData"),
        parsedLocations = oUploadModel.getProperty("/parsedLocations");

      if (!parsedData || !parsedData.length) {
        MessageBox.warning(this.getText("noDataMsg"));
        return;
      }

      const sBatchGroupId = "bulkUploadGroup";

      try {
        // Fetch existing team members 
        const oListBinding = oView.getBindingContext("catalogModel")
          ? oView.getBindingContext("catalogModel").getBinding("TeamMembers")
          : oCatalogModel.bindList("/TeamMembers");

        const aContexts = await oListBinding.requestContexts();
        const existingMap = new Map();
        aContexts.forEach(ctx => {
          const data = ctx.getObject();
          existingMap.set(data.KID, ctx);
        });

        // Create binding for batch create 
        const oCreateBinding = oCatalogModel.bindList("/TeamMembers", undefined, undefined, undefined, {
          $$updateGroupId: sBatchGroupId
        });

        parsedData.forEach(entry => {
          const ctx = existingMap.get(entry.KID);
          if (ctx) {
            Object.entries(entry).forEach(([key, value]) => {
              ctx.setProperty(key, value);
            });
          } else {
            oCreateBinding.create(entry);
          }
        });

        // Submit new Locations (if needed) 
        if (parsedLocations && parsedLocations.length) {
          const locationBinding = oCatalogModel.bindList("/Locations", undefined, undefined, undefined, {
            $$updateGroupId: sBatchGroupId
          });

          const existingLocationIDs = new Set(
            (await oCatalogModel.bindList("/Locations").requestContexts()).map(
              ctx => ctx.getObject().LOCATION
            )
          );

          parsedLocations.forEach(location => {
            if (!existingLocationIDs.has(location.LOCATION)) {
              locationBinding.create(location);
              existingLocationIDs.add(location.LOCATION); // avoid duplicates in batch
            }
          });
        }

        // Submit everything 
        await oCatalogModel.submitBatch(sBatchGroupId);
        oCatalogModel.refresh();
        MessageBox.success(this.getText("uploadSuccessMsg"));

        

      } catch (err) {
        console.error(this.getText("consoleUploadFailText"), err);
        MessageBox.error(this.getText("uploadFailMsg"));
      }
    },

    async handleParseSkillDataPress() {
      console.log("skill triggered")
      const oView = this.getView(),
        oUploadModel = oView.getModel("uploadModel"),
        oFile = oUploadModel.getProperty("/file"),
        oI18nModel = oView.getModel("i18n");

      if (!(oFile && window.FileReader)) return;

      function findColumnKey(rawKeys, target) {
        const targetNormalized = target.toLowerCase();
        return rawKeys.find(k =>
          k.toLowerCase().replace(/[\s_\-]/g, "").includes(targetNormalized)
        );
      }

      const oFileReader = new FileReader();

      oFileReader.onload = async (e) => {
        const data = e.target.result,
          workbook = XLSX.read(data, { type: "binary" }),
          worksheet = workbook.Sheets[workbook.SheetNames[0]],
          rawData = XLSX.utils.sheet_to_json(worksheet),
          aKeys = rawData[0] ? Object.keys(rawData[0]) : [];

        if (!aKeys.length) {
          MessageBox.information(oI18nModel.getProperty("emptyExcelFile"));
          return;
        }

        const skillKey = findColumnKey(aKeys, "skill");
        const descKey = findColumnKey(aKeys, "shortdesc");

        if (!skillKey || !descKey) {
          MessageBox.error("Required columns (Skill, Short Desc) not found.");
          return;
        }

        const parsedSkills = [];

        for (const row of rawData) {
          const skillIdRaw = row[skillKey];
          const skillId = skillIdRaw?.toString().trim().replace(/[^\x20-\x7E]/g, "");

          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(skillId);
          if (!isValidUUID) {
            console.warn("Skipping invalid UUID:", skillId);
            continue;
          }

          const shortDesc = row[descKey]?.toString().trim() || "Unnamed Skill";

          parsedSkills.push({
            SKILL: skillId,
            SHORT_DESC: shortDesc,
            LONG_DESC: ""
          });
        }

        console.log("Parsed skill data:", parsedSkills);
        oUploadModel.setProperty("/parsedSkills", parsedSkills);
        MessageBox.information(oI18nModel.getProperty("parseInfoSuccessMsg"));
      };

      oFileReader.onerror = function (ex) {
        console.error("File read error", ex);
      };

      oFileReader.readAsArrayBuffer(oFile);
    },



    async handleSubmitSkillDataPress() {
      const oView = this.getView(),
        oUploadModel = oView.getModel("uploadModel"),
        oCatalogModel = oView.getModel("catalogModel"),
        parsedSkills = oUploadModel.getProperty("/parsedSkills");

      if (!parsedSkills || !parsedSkills.length) {
        MessageBox.warning(this.getText("noDataMsg"));
        return;
      }

      const skillContexts = await oCatalogModel.bindList("/Skills").requestContexts();
      const existing = new Set(skillContexts.map(ctx => ctx.getObject().SKILL));

      const sBatchGroupId = "bulkUploadGroup";
      const oSkillBinding = oCatalogModel.bindList("/Skills", undefined, undefined, undefined, {
        $$updateGroupId: sBatchGroupId
      });

      parsedSkills.forEach(entry => {
        if (!existing.has(entry.SKILL)) {
          oSkillBinding.create(entry);
          existing.add(entry.SKILL); // Avoid duplicate creates in same batch
        }
      });

      try {
        await oCatalogModel.submitBatch(sBatchGroupId);
        //refresh the catalogModel
        oCatalogModel.refresh();
        MessageBox.success(this.getText("uploadSuccessMsg"));
      } catch (err) {
        console.error(this.getText("consoleUploadFailText"), err);
        MessageBox.error(this.getText("uploadFailMsg"));
      }
    },


    handleParseCapacityDataPress(oEvent) {
      console.log("capacity triggered")
      const oView = this.getView(),
        oUploadModel = oView.getModel("uploadModel"),
        oFile = oUploadModel.getProperty("/file"),
        oi18nModel = oView.getModel("i18n"),
        oController = this;

      if (oFile && window.FileReader) {
        const oFileReader = new FileReader();

        oFileReader.onload = async function (e) {
          const data = e.target.result,
            workbook = XLSX.read(data, { type: 'binary' }),
            worksheet = workbook.Sheets[workbook.SheetNames[0]],
            rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

          console.log(rawData.slice(0, 5));

          if (!rawData || rawData.length === 0) {
            MessageBox.information(this.getText("emptyExcelFile"));
            oController.onUploadCancel();
            return;
          }

          // Find the row containing "Planned" (used as anchor; week date ranges are in this row)
          let plannedRowIdx = -1;

          for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];

            if (row.some(cell => typeof cell === "string" && cell.trim().toLowerCase() === "planned")) {
              plannedRowIdx = i;
              break;
            }
          }

          console.log("plannedrowidx", plannedRowIdx);

          // Locate the "Week" label and extract week-related columns
          const weekIdRowIdx = plannedRowIdx + 1,
            weekIdRow = rawData[weekIdRowIdx];


          let startColIdx = -1;
          for (let i = 0; i < weekIdRow.length; i++) {
            const cell = weekIdRow[i];
            if (typeof cell === "string" && cell.trim().toLowerCase() === "week") {
              startColIdx = i;
              break;
            }
          }

          const weekColumnMap = {}; // colIdx -> { week_id, date_range }

          for (let col = startColIdx + 1; col < weekIdRow.length; col++) {
            const rawWeekId = weekIdRow[col],
              weekIdStr = rawWeekId != null ? String(rawWeekId).trim() : "",
              dateRange = rawData[plannedRowIdx][col];
            // Convert dateRange to string and check format
            let dateStr = "";

            if (dateRange !== null && dateRange !== undefined) {
              if (typeof dateRange === 'number') {
                // Handle Excel numeric date format
                const jsDate = new Date(Math.round((dateRange - 25569) * 86400 * 1000)),
                  day = jsDate.getDate().toString().padStart(2, '0'),
                  month = (jsDate.getMonth() + 1).toString().padStart(2, '0'),
                  year = jsDate.getFullYear().toString().slice(-2);
                dateStr = `${day}.${month}.${year}`;
              } else {
                // Already string format
                dateStr = String(dateRange).trim();

                // Check if it's a numeric string (like "45915")
                if (/^\d+$/.test(dateStr)) {
                  const excelDateNumber = parseInt(dateStr, 10),
                    jsDate = new Date(Math.round((excelDateNumber - 25569) * 86400 * 1000)),

                    day = jsDate.getDate().toString().padStart(2, '0'),
                    month = (jsDate.getMonth() + 1).toString().padStart(2, '0'),
                    year = jsDate.getFullYear().toString().slice(-2);

                  dateStr = `${day}.${month}.${year}`;
                }
              }
            }

            // Skip if empty, or contains "sum", or is literally "week"
            if (
              !weekIdStr ||
              weekIdStr.toLowerCase().includes("sum") ||
              weekIdStr.toLowerCase() === "week"
            ) {
              continue;
            }

            weekColumnMap[col] = {
              week_id: weekIdStr,
              date_range: dateStr
            };
          }
          console.log(weekColumnMap)

          // Locate the employee table header
          const possibleFirstNameLabels = ["prename", "firstname", "first_name", "first name"];
          const possibleLastNameLabels = ["name", "lastname", "last_name", "last name"];

          const normalizeLabel = label => label.trim().toLowerCase().replace(/[\s_]/g, "");

          let headerRowIdx = -1;

          for (let i = weekIdRowIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (
              row.some(cell =>
                typeof cell === "string" &&
                (possibleFirstNameLabels.includes(normalizeLabel(cell)) ||
                  possibleLastNameLabels.includes(normalizeLabel(cell)))
              )
            ) {
              headerRowIdx = i;
              break;
            }
          }

          console.log(headerRowIdx);

          // Determine the column positions of the needed fields (first name, last name, etc.)
          const headerRow = rawData[headerRowIdx];

          const colIndexMap = {
            prename: -1,
            name: -1,
            team: -1,
            needToCATs: -1,
            hoursPerWeek: -1
          };

          for (let i = 0; i < headerRow.length; i++) {
            const cell = headerRow[i];
            if (typeof cell === "string") {
              const normalized = normalizeLabel(cell);
              if (possibleFirstNameLabels.includes(normalized)) colIndexMap.prename = i;
              else if (possibleLastNameLabels.includes(normalized)) colIndexMap.name = i;
              else if (normalized === "team") colIndexMap.team = i;
              else if (normalized === "needtocats") colIndexMap.needToCATs = i;
              else if (normalized === "hoursperweek") colIndexMap.hoursPerWeek = i;
            }
          }

          console.log(colIndexMap.team);

          //Loop for extracting weekly capacity values for each employee that needs to register their CATs
          let employeeData = [];

          for (let i = headerRowIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];

            const needToCATsVal = row[colIndexMap.needToCATs];
            const shouldInclude =
              typeof needToCATsVal === "string" &&
              needToCATsVal.trim().toLowerCase() === "yes";//&&
            //row[colIndexMap.team]?.trim().toUpperCase() === "SAP"; //Remove or comment this later!!

            if (!shouldInclude) {
              continue;
            }

            const firstName = row[colIndexMap.prename] || "",
              lastName = row[colIndexMap.name] || "",
              team = row[colIndexMap.team] || "",
              hoursPerWeek = row[colIndexMap.hoursPerWeek] || null;

            // Assigning data to an array that stores all employees' capacity data and aggregating "split weeks" caused by booking period on the 15th of each month
            const weekBuffer = {}; // temp map: baseWeekId → [{ suffix, date_range, capacity }]

            for (const col in weekColumnMap) {
              const { week_id, date_range } = weekColumnMap[col];
              const raw = row[col];
              let capacityValue = null;

              if (typeof raw === "string" && raw.trim().endsWith("%")) {
                capacityValue = parseFloat(raw.replace("%", "").trim()) / 100;
              } else if (typeof raw === "number") {
                capacityValue = raw;
              }

              if (isNaN(capacityValue) || capacityValue === null) continue;

              const parts = week_id.split(".");
              const baseWeekId = parts[0];
              const suffix = parts[1] || "0";

              if (!weekBuffer[baseWeekId]) {
                weekBuffer[baseWeekId] = [];
              }

              weekBuffer[baseWeekId].push({
                suffix,
                date_range: date_range,
                capacity: capacityValue
              });
            }

            // Now aggregate .1 + .2 if both exist
            const weeklyCapacity = [];

            for (const baseWeek in weekBuffer) {
              const segments = weekBuffer[baseWeek];

              if (segments.length === 2) {
                const all = segments.sort((a, b) => a.suffix.localeCompare(b.suffix));
                const merged = {
                  week_id: baseWeek,
                  date_range: `${all[0].date_range.split("-")[0].trim()} - ${all[1].date_range.split("-")[1].trim()}`,
                  capacity: all[0].capacity + all[1].capacity
                };
                weeklyCapacity.push(merged);
              } else {
                // only one segment; keep it as-is but drop the .1/.2
                const single = segments[0];
                weeklyCapacity.push({
                  week_id: baseWeek,
                  date_range: single.date_range,
                  capacity: single.capacity
                });
              }
            }


            employeeData.push({
              FIRST_NAME: firstName,
              LAST_NAME: lastName,
              TEAM: team,
              HOURS_PER_WEEK: hoursPerWeek,
              WEEKLY_CAPACITY: weeklyCapacity
            });
          }

          console.log("Parsed employee capacity data:", employeeData);

          // Match the KID from excel data and teamMembers entity based on first name and last name
          const teamMembers = oController.getView().getModel("teamMembersModel").getProperty("/members");

          employeeData = employeeData
            .map(emp => {
              const rawFirst = (emp.FIRST_NAME || "").trim().toLowerCase();
              const rawLast = (emp.LAST_NAME || "").trim().toLowerCase();
              const possibleFirsts = rawFirst.split(/[\s-]+/).filter(Boolean);

              const match = teamMembers.find(tm => {
                const tmFirst = (tm.FIRST_NAME || "").trim().toLowerCase();
                const tmLast = (tm.LAST_NAME || "").trim().toLowerCase();
                return possibleFirsts.includes(tmFirst) && tmLast === rawLast;
              });

              if (!match) {
                console.warn("noEmployeeMatchMsg", emp.FIRST_NAME, emp.LAST_NAME);
                return null; // remove this later
              }

              emp.KID = match.KID;
              emp.WEEKLY_CAPACITY.forEach(entry => {
                entry.KID = match.KID;
              });

              return emp;
            })
            .filter(Boolean); // removes nulls

          console.log("Final employee data with KIDs:", employeeData);

          //Saving the parsed excel capacity data to the TeamMemberCapacity entity
          const flatPayload = [];

          employeeData.forEach(emp => {
            emp.WEEKLY_CAPACITY.forEach(cap => {
              flatPayload.push({
                KID: emp.KID,
                WEEK_ID: cap.week_id,
                DATE_RANGE: cap.date_range,
                CAPACITY: Math.round(cap.capacity * 100) / 100
              });
            });
          });

          const payloadModel = oController.getView().getModel("capacityPayloadModel");
          payloadModel.setProperty("/capacityData", flatPayload);

          console.log("Payload prepared:", flatPayload);
          MessageBox.information(oi18nModel.getProperty("parseInfoSuccessMsg"));



        };
        oFileReader.readAsArrayBuffer(oFile);
      }
    },

    async handleSubmitCapacityDataPress() {
      const oCatalogModel = this.getView().getModel("catalogModel");
      const payloadModel = this.getView().getModel("capacityPayloadModel");
      const entries = payloadModel.getProperty("/capacityData");

      MessageToast.show(this.getText("uploadWaitMsg"), {
        duration: 3000 // 3 sec
      });

      await new Promise(resolve => setTimeout(resolve, 300)); // Let the MeesageToast render first

      if (!entries || entries.length === 0) {
        MessageBox.warning(this.getText("noDataMsg"));
        return;
      }

      const deleteGroupId = "deleteGroup";

      const uniqueKIDs = [...new Set(entries.map(e => e.KID))];

      console.log("Unique KIDs to process:", uniqueKIDs);

      // Schedule deletions
      await Promise.all(uniqueKIDs.map(async kid => {
        console.log(`Processing delete for KID: ${kid}`);

        const binding = oCatalogModel.bindList("/TeamMemberCapacity", null, null, [
          new sap.ui.model.Filter("KID", "EQ", kid)
        ]);

        try {
          const contexts = await binding.requestContexts();

          if (contexts.length === 0) {
            console.log(`No existing records found for KID: ${kid}`);
          } else {
            console.log(`Found ${contexts.length} records for KID: ${kid}`);
          }

          contexts.forEach(ctx => {
            console.log(`Scheduling delete for: ${ctx.getPath()}`);
            ctx.delete(deleteGroupId); // 
          });
        } catch (err) {
          console.error(`Error retrieving or deleting records for KID ${kid}:`, err);
        }
      }));

      await oCatalogModel.submitBatch(deleteGroupId);
      console.log("All deletions submitted.");

      

      // Submit deletions
      try {
        await oCatalogModel.submitBatch(deleteGroupId);
        console.log("Deletion batch submitted.");
      } catch (err) {
        console.error("Deletion batch failed:", err);
        MessageToast.show(this.getText("deleteOldRecordsError"));
        return;
      }

      // Schedule creations in chunks
      const chunkSize = 100;

      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const groupId = `createGroup_${i}`; // unique ID per chunk

        const createBinding = oCatalogModel.bindList("/TeamMemberCapacity", null, null, null, {
          $$updateGroupId: groupId
        });

        chunk.forEach(entry => {
          createBinding.create(entry);
        });

        try {
          await oCatalogModel.submitBatch(groupId);
          console.log(`Submitted chunk ${i}–${i + chunk.length - 1}`);
        } catch (err) {
          console.error(`Submission failed for chunk ${i}–${i + chunk.length - 1}:`, err);
          //MessageToast.show(`Error submitting chunk ${i + 1}`);
          MessageBox.error(this.getText("uploadFailMsg"));
          return; //  stop on first failure
        }
      }
      oCatalogModel.refresh();
      MessageBox.success(this.getText("uploadSuccessMsg"));
      console.log("All entries saved:", entries.length);
    }


    /*
    async testPostMockEntry() {
      const oModel = this.getView().getModel("catalogModel");

      const binding = oModel.bindList("/TeamMemberCapacity", null, null, null, {
        $$updateGroupId: "testMock"
      });

      binding.create({
        KID: "T123",
        WEEK_ID: "2025-W01",
        DATE_RANGE: "01.01.25 - 07.01.25",
        CAPACITY: 1.5
      });

      try {
        await oModel.submitBatch("testMock");
        sap.m.MessageToast.show("Mock POST successful.");
        console.log("Mock POST submitted.");
      } catch (err) {
        console.error("Mock POST failed:", err);
        sap.m.MessageToast.show("Mock POST failed.");
      }
    },
    async deleteMockTestEntry() {
      const oModel = this.getView().getModel("catalogModel");

      const binding = oModel.bindList("/TeamMemberCapacity", null, null, [
        new sap.ui.model.Filter("KID", "EQ", "T123")
      ]);

      try {
        const contexts = await binding.requestContexts();
        if (contexts.length === 0) {
          console.log("No mock entries found for TEST123.");
          return;
        }

        const deleteGroupId = "mockDeleteGroup";

        contexts.forEach(ctx => {
          console.log("Deleting:", ctx.getPath());
          ctx.delete(deleteGroupId)
        });

        await oModel.submitBatch(deleteGroupId);


        console.log("Mock entries deleted.");
        sap.m.MessageToast.show("Mock test data deleted.");
      } catch (err) {
        console.error("Error deleting mock data:", err);
        sap.m.MessageToast.show("Failed to delete mock test data.");
      }
    }
  */





  });
});