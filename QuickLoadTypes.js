var uploadTypes = {
    'toJSON': function(dObj) {
        APIArr = [];
        tdata_orig = hot.getData()
        tcols = hot.getColHeader()
        dObj.jdata = []

        tdata = []
        if (tcols[0] == 'Error Code') {
            tcols.shift()
            $(tdata_orig).each(function(k, v) {
                v.shift();
                tdata.push(v);
            })
        } else tdata = tdata_orig

        if (dObj.hasOwnProperty('apiMap')) {
            $(tdata).each(function(k, v) {
                rec = {}
                if (!v.every(x => x === null) && !v.every(x => x === "")) { //CHECK ROW FOR BLANK
                    $(v).each(function(kk, vv) {
                        rowval = vv
                        ky = dObj.cdata.find(x => x['data'] === tcols[kk])
                        if (rowval) {
                            if (typeof rowval == 'string') rowval = rowval.replace(/(\r\n|\n|\r)/gm, "")
                        }
                        if (ky) rec[ky.name] = rowval
                    })
                    dObj.jdata.push(rec)
                    APIArr.push({
                        'rnum': k,
                        'api': dObj.apiMap(rec)
                    })
                }
            })
        }
        /*
        else {
            $(tdata).each(function(k,v){
                APIObj = {}
                if (!v.every(x => x === null)) { //CHECK ROW FOR BLANK
                    //console.log('row',v)
                    $(dObj.cdata).each(function(kk,vv){ //LOOP THROUGH CDATA (updateType "definition")
                        colPos = tcols.indexOf(vv.data)
                        cData = ''
                        if (colPos != -1) cData = v[colPos]
                        if (vv.hasOwnProperty('otherVal')) {
                            ob = dObj.cdata.find(x => x['name'] === vv.otherVal)
                        cData = v[tcols.indexOf(ob.data)]
                        }
                        if (cData != '')
                        {
                            if (vv.hasOwnProperty('return')) APIObj[vv.name] = vv.return(cData)
                            else APIObj[vv.name] = cData
                        }
                    })
                    
                    APIArr.push(APIObj) //Add API translated object to array
                }
            })
        }
        */
        if (dObj.hasOwnProperty('updateRemoveExisting') && dObj.jdata) dObj.updateRemoveExisting(dObj.jdata)
        if (dObj.hasOwnProperty('sorter')) APIArr.sort(dObj.sorter)
        //TEST LOGGING
        /*
        $(APIArr).each(function(k, v) {
            //console.log('ordered', v.api)
        })
        */
        //console.log(APIArr)
        return APIArr;
    },
    'findIt': function(v) {
        ut = this.data.find(x => x.type_name === v)
        if (Object.keys(ut).indexOf('toJSON') == -1) ut.toJSON = this.toJSON
        return ut;
    },
    'onload': function(dObj) {
        if (typeof dObj == 'undefined') dObj = null

        let dt = document.getElementById('data_table')
        let cdata = dObj.cdata
        let column_headers = [];
        let column_config = [];

        apiPromiseChain = []
        let kronos = new kronosAPI()
        $('#content').css('opacity', '1');
        $('#content').loadingModal('destroy');
        $('#content').loadingModal('show');
        $('#content').loadingModal({
            text: 'Logging into Dimensions to gather config data'
        });

        kronos.getOAuthToken(access_data.token).then(function(scope) {
            $(cdata).each(function(k, v) {
                if (v['visible']) {

                    cconfig = {
                        label: v['data']
                    }
                    if (v.hasOwnProperty('datasource')) {
                        if (Array.isArray(v.datasource)) {
                            cconfig.type = 'dropdown'
                            cconfig.source = v.datasource
                        } else apiPromiseChain.push(kronos.getAPI(v, scope))
                    }
                    column_headers.push(v['data']);
                    column_config.push(cconfig)
                }
            })

            Promise.all(apiPromiseChain).then(function(promiseArr) {

                $(promiseArr).each(function(k, v) {
                    $(column_config).each(function(kk, vv) {
                        if (vv['label'] == v['data']) {
                            column_config[kk] = {
                                label: v['data'],
                                type: 'autocomplete',
                                source: v.list,
                                strict: true
                            }
                        }
                    })
                })

                //tmp_obj = { type: 'autocomplete', source:tmp_config_obj, strict:true} 

                tData = []
                if (dObj.hasOwnProperty('data')) tData = dObj['data']

                function errorCodeRenderer(instance, td, row, col, prop, value, cellProperties) {

                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    //console.log(row,value,cellProperties)
                    if (value) {
                        if (value.indexOf('Successfully Imported') > -1 || value.indexOf('Allowable Error') > -1) {
                            //console.log('renderer',hot.promiseResponses.find(x => x.rnum === row))
                            td.style.background = '#99ffdd'
                            if (value.indexOf('Successfully Imported') > -1) td.innerHTML = value.replace('|', '')
                        } else {
                            td.style.background = '#fdb9b9'
                            eData = ["", ""]
                            if (value) eData = value.split('|')
                            td.innerHTML = '<div title="' + eData[1] + '">' + eData[0] + '</div>';
                        }
                    }
                }

                function stdRenderer(instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                }

                $('#content').loadingModal('hide');
                if (hot) hot.destroy()
                hot = new Handsontable(dt, {
                    startRows: 30,
                    rowHeaders: true,
                    contextMenu: true,
                    stretchH: 'all',
                    copyRowsLimit: 5000,
                    autoWrapRow: true,
                    autoWrapCol: true,
                    autoInsertRow: true,
                    manualColumnResize: true,
                    data: tData,
                    columns: column_config,
                    colHeaders: column_headers,
                    minSpareRows: 1,
                    trimWhitespace: true,
                    wordWrap: false,
                    trimDropdown: true,
                    cdata: cdata,
                    beforePaste: function(data, coords) {
                        for (i = 0; i < data.length; i++) {
                            for (j = 0; j < data[i].length; j++) {
                                data[i][j] = data[i][j].trim(); //.replace(/\r\n/g,"");
                            }
                        }
                        console.log(data);console.log(JSON.stringify(data))
                        
                    },
                    afterChange: function(change, source) {
                        //console.log('handsOnTable - After Change',change,source)
                        if (hot && change) {
                            //HAS ANYTHING CHANGED (global VAR)
                            odata = hot['original_data']
                            cdata = this.getData()
                            if (change != null && source != 'loadData') {
                                if (!compareArrays(odata, cdata)) gl_table_edited = true
                            }
                            return;
                        }
                    },

                    cells: function(row, col) {
                        var cellProperties = {};
                        var colHeads = this.instance.getColHeader();

                        if (col === 0 && colHeads[0] == 'Error Code') {

                            cellProperties.renderer = errorCodeRenderer; // uses function directly
                        } else {
                            cellProperties.renderer = stdRenderer; // uses lookup map
                        }

                        return cellProperties;
                    }
                })

                hot.validateCells()

                so = getSelectizeOption('#uploadSelection')
                if (so) hot['uploadType'] = so.type_name
                hot['original_data'] = hot.getData()

                hot.updateSettings({
                    height: $(window).height() - $("#data_table").offset().top
                })

                $(window).resize(function() {
                    if (hot) {
                        hot.updateSettings({
                            height: $(window).height() - $("#data_table").offset().top
                        })
                    }
                });
            })
        })
    },
    'data': [

        {
            'type_name': 'Personality Data - Full',
                
                    'apiUrl': '/v1/commons/persons/multi_upsert',
                        'cdata': [
                            {
                                visible: true, data: 'Update?', name: 'updateFlag',
                                datasource: ['TRUE', 'FALSE']
                            },
                            {
                                visible: true, data: 'Date', name: 'date'
                            },
                            {
                                visible: true, data: 'Hire Date', name: 'hireDate'
                            },
                            //Basic Information
                            {
                                visible: true, data: 'Person Number*', name: 'personNum'
                            },
                            {
                                visible: true, data: 'Override Person Number', name: 'overridePersonNum'
                            },
                            {
                                visible: true, data: 'First Name', name: 'firstName'
                            },
                            {
                                visible: true, data: 'Last Name*', name: 'lastName'
                            },
                            {
                                visible: true, data: 'Short Name', name: 'shortName'
                            },
                            {
                                visible: true, data: 'Middle Initial', name: 'middleInitial'
                            },
                            //Timekeeping Information
                            {
                                visible: true, data: 'Pay Rule*', name: 'payRule',
                                datasource: {
                                    apiurl: '/v1/timekeeping/setup/payrules',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Primary Job*', name: 'primaryJob'
                            },
                            {
                                visible: true, data: 'Labor Category', name: 'laborCategory'
                            },
                            {
                                visible: true, data: 'Employment Term', name: 'employmentTerm',
                                datasource: {
                                    apiurl: '/v1/timekeeping/setup/employment_terms',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Accrual Profile', name: 'accrualProfile',
                                datasource: {
                                    apiurl: '/v1/timekeeping/setup/accrual_profiles',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Full Time %*', name: 'fullTimePct'
                            },
                            {
                                visible: true, data: 'Full Time Hours', name: 'fullTimeHours'
                            },
                            {
                                visible: true, data: 'Employee Hours', name: 'employeeHours'
                            },
                            {
                                visible: true, data: 'Wage Rate', name: 'wageRate'
                            },
                            {
                                visible: true, data: 'Wage Currency', name: 'employeeCurrency'
        
                            },
                            {
                                visible: true, data: 'Reports To ID', name: 'supervisorID'
                            },
        
                            {
                                visible: true, data: 'Device Group', name: 'deviceGroupName',
                                datasource: {
                                    apiurl: '/v1/commons/device_groups',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Badge Number', name: 'badgeNumber'
                            },
                            //USER INFORMATION
                            {
                                visible: true, data: 'Authentication Type', name: 'authenticationTypeName'
                            },
                            {
                                visible: true, data: 'Username', name: 'userName'
                            },
                            {
                                visible: true, data: 'Password', name: 'userPassword'
                            },
                            {
                                visible: true, data: 'Logon Profile', name: 'logonProfile'
                            },
                            {
                                visible: true, data: 'MFA Required?', name: 'mfaRequired'
                            },
                            //Personal
                            {
                                visible: true, data: 'Analytics Type', name: 'analyticsLaborTypeName'
                            },
                            {
                                visible: true, data: 'Phone Field Label 1', name: 'phoneFieldName'
                            },
                            {
                                visible: true, data: 'Telephone Number 1', name: 'phoneNumber'
                            },
                            {
                                visible: true, data: 'SMS?1', name: 'isSMSSwitch', datasource:['true','false']
                            },
                            {
                                visible: true, data: 'Phone Field Label 2', name: 'phoneFieldName2'
                            },
                            {
                                visible: true, data: 'Telephone Number 2 ', name: 'phoneNumber2'
                            },
                            {
                                visible: true, data: 'SMS?2', name: 'isSMSSwitch2', datasource:['true','false']
                            },
                            {
                                visible: true, data: 'Phone Field Label 3', name: 'phoneFieldName3'
                            },
                            {
                                visible: true, data: 'Telephone Number 3', name: 'phoneNumber3'
                            },
                            {
                                visible: true, data: 'SMS?3', name: 'isSMSSwitch3', datasource:['true','false']
                            },
                            {
                                visible: true, data: 'State', name: 'state'
                            },
                            {
                                visible: true, data: 'Street', name: 'postalAddress'
                            },
                            {
                                visible: true, data: 'City', name: 'city'
                            },
                            {
                                visible: true, data: 'PostalCode', name: 'postalCode'
                            },
                            {
                                visible: true, data: 'Country', name: 'country'
                            },
                            {
                                visible: true, data: 'Worker Type', name: 'workerType'
                            },
                            {
                                visible: true, data: 'Email', name: 'email'
                            },
                            //Scheduling Information
                            {
                                visible: true, data: 'Expected Daily Hours', name: 'dailyHours'
                            },
                            {
                                visible: true, data: 'Expected Weekly Hours', name: 'weeklyHours'
                            },
                            {
                                visible: true, data: 'Expected PP Hours', name: 'payperiodHours'
                            },
                            {
                                visible: true, data: 'Schedule Group', name: 'scheduleGroup'
                            },
                            //Work Items
                            {
                                visible: true, data: 'Profile Name', name: 'workProfileName'
                            },
                            {
                                visible: true, data: 'Default Activity', name: 'defaultActivityName'
                            },
                            {
                                visible: true, data: 'Idle Activity', name: 'idleActivityName'
                            },
                            {
                                visible: true, data: 'Paid Activity', name: 'paidActivityName'
                            },
                            {
                                visible: true, data: 'Unpaid Activity', name: 'unpaidActivityName'
                            },
                            //Common Profiles
                            {
                                visible: true, data: 'Display Profile', name: 'preferenceProfileName',
                                datasource: {
                                    apiurl: '/v1/commons/display_profiles',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Function Access Profile', name: 'accessProfileName',
                                datasource: {
                                    apiurl: '/v1/commons/function_access_profiles',
                                    tag: 'name'
                                }
                            },
        
                            {
                                visible: true, data: 'Time Zone', name: 'timezone',
                                datasource: ['Afghanistan', 'Alaskan', 'Almaty', 'Arabian', 'Arizona', 'Atlantic', 'AUS_Central', 'Azores', 'Baghdad', 'Baku', 'Bangkok', 'Brisbane', 'Canada_Central', 'Cape_Verde_Islands', 'Central', 'Central_America', 'Central_Asia', 'Central_Australia', 'Central_Pacific', 'Chihuahua', 'China', 'Czech', 'E._Europe', 'E._South_America', 'Eastern', 'Egypt', 'Ekaterinburg', 'FIJI', 'GFT', 'GMT', 'Greenland', 'Greenwich', 'Hawaiian', 'Helsinki', 'India', 'Indiana(East)', 'Iran', 'Irkutsk', 'Israel', 'Kathmandu', 'Krasnoyarsk', 'Kuala_Lumpur', 'Lisbon_Warsaw', 'Lord_Howe_Island', 'Mexico', 'Mid-Atlantic', 'Mountain', 'Nairobi', 'New_Zealand', 'Newfoundland', 'Pacific', 'Perth', 'Rangoon', 'Romance', 'Russian', 'SA_Eastern', 'SA_Pacific', 'SA_Western', 'Samoa', 'Santiago', 'Saudi_Arabia', 'Seoul', 'South_Africa', 'Sri_Jayawardenepura', 'Sydney', 'Taipei', 'Tasmania', 'Tokyo', 'UTC', 'Vladivostok', 'W._Europe', 'West_Asia', 'West_Central_Africa', 'West_Pacific', 'Yakutsk']
                            },
                            {
                                visible: true, data: 'Locale', name: 'localePolicyName'
                            },
        
                            {
                                visible: true, data: 'Notification Profile', name: 'notProfileName'
                            },
                            //Employee Profiles
                            {
                                visible: true, data: 'Time Entry Method', name: 'timeEntryTypeName',
                                datasource: ['Time Stamp & Hourly View', 'Time Stamp', 'Hourly View']
                            },
                            {
                                visible: true, data: 'Employee Pay Code Profile', name: 'professionalPayCodeName'
                            },
                            {
                                visible: true, data: 'Employee Work Rule Profile', name: 'professionalWorkRule'
                            },
                            {
                                visible: true, data: 'Employee Labor Category Profile', name: 'employeeLCP'
                            },
                            {
                                visible: true, data: 'Labor Category Manager Additions', name: 'mgrEmplLaborCategoryProfileName'
                            },
                            {
                                visible: true, data: 'Employee JTS', name: 'professionalTransferOrganizationSetName'
                            },
                            {
                                visible: true, data: 'JTS Manager Additions', name: 'empMgrTransferOrganizationSetName'
                            },
                            //MANAGER PROFILES
                            {
                                visible: true, data: 'GDAP', name: 'gdapName'
                            },
                            {
                                visible: true, data: 'Organisational Set', name: 'organisationalSet',
                                datasource: {
                                    apiurl: '/v1/commons/location_sets/multi_read',
                                    tag: 'name',
                                    pdata: { "where": { "allDetails": false, "context": "ORG", "date": "1900-01-01", "types": { "ids": [1, 2, 3] } } }
                                }
                            },
                            {
                                visible: true, data: 'Employee Group', name: 'employeeGroup',
                                datasource: {
                                    apiurl: '/v1/commons/employee_groups',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Home Hyperfind', name: 'homeHyperFindQueryName'
                            },
                            {
                                visible: true, data: 'Manager Work Rule', name: 'managerWorkRule'
                            },
                            {
                                visible: true, data: 'Manager Pay Code Edit', name: 'managerPCE',
                                datasource: {
                                    apiurl: '/v1/timekeeping/setup/pay_codes/data_access_profiles',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Manager Pay Code View', name: 'managerPCV',
                                datasource: {
                                    apiurl: '/v1/timekeeping/setup/pay_codes/data_access_profiles',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Manager Labor Category Profile', name: 'managerLCP',
                                datasource: {
                                    apiurl: '/v1/commons/labor_category_profiles',
                                    tag: 'name'
                                }
                            },
                            {
                                visible: true, data: 'Pattern Template Profile', name: 'schedulePatternName'
                            },
                            {
                                visible: true, data: 'Shift Template Profile', name: 'shiftCodeName'
                            },
                            {
                                visible: true, data: 'Schedule Group Profile', name: 'groupScheduleName'
                            },
                            {
                                visible: true, data: 'Report Profile', name: 'reportName'
                            },
                            {
                                visible: true, data: 'Forecasting Category Profile', name: 'forecastingCategoryProfileName'
                            },
                            {
                                visible: true, data: 'Delegate Profile', name: 'delegateProfileName'
                            },
                            {
                                visible: true, data: 'Manager Currency Preference', name: 'currencyCode'
                            },
        
                            //LICENSES
                            {
                                visible: true, data: 'Timekeeping License', name: 'TimekeepingLicense', datasource:['Hourly Timekeeping','Salaried Timekeeping']
                            },
                            {
                                visible: true, data: 'Scheduling License', name: 'SchedulingLicense', datasource:['Advanced Scheduling']
                            },
                            {
                                visible: true, data: 'WAM License', name: 'WAMLicense', datasource:['Attendance and Leave','Accruals','Absence']
                            },
                            {
                                visible: true, data: 'Analytics License', name: 'AnalyticsLicense', datasource:['Analytics']
                            },
                            {
                                visible: true, data: 'Work License', name: 'WorkLicense', datasource:['Work']
                            },
                            {
                                visible: true, data: 'Employee License', name: 'EmployeeLicense',datasource:['Employee']
                            },
                            {
                                visible: true, data: 'Manager License', name: 'ManagerLicense',datasource:['Manager']
                            },
        
        
                            //CUSTOM DATA AND DATES
                            {
                                visible: true, data: 'Custom Data PSV', name: 'cdataCSV'
                            },
                            {
                                visible: true, data: 'Custom Date Name', name: 'customDateTypeName'
                            },
                            {
                                visible: true, data: 'Custom Date Value', name: 'customDateDate'
                            },
                            {
                                visible: true, data: 'Birth Date', name: 'birthDate'
                            },
                            {
                                visible: true, data: 'Biometric Employee', name: 'fingerRequiredFlag'
                            }
                            
                        ],
        
                            'apiMap': function(data) {
                                if (data.TimekeepingLicense == "" || data.TimekeepingLicense == null) { data.TimekeepingLicense = 'Hourly Timekeeping' }
                                var LicenseMap = []
                                if (CheckEmpty(data.TimekeepingLicense) == true){LicenseMap.push(data.TimekeepingLicense)}
                                if (CheckEmpty(data.SchedulingLicense) == true){LicenseMap.push(data.SchedulingLicense)}
                                if (CheckEmpty(data.WAMLicense) == true){LicenseMap.push(data.WAMLicense)}
                                if (CheckEmpty(data.AnalyticsLicense) == true){LicenseMap.push(data.AnalyticsLicense)}
                                if (CheckEmpty(data.WorkLicense) == true){LicenseMap.push(data.WorkLicense)}
                                if (CheckEmpty(data.EmployeeLicense) == true){LicenseMap.push(data.EmployeeLicense)}
                                if (CheckEmpty(data.ManagerLicense) == true){LicenseMap.push(data.ManagerLicense)}

                                   LicenseMap = LicenseMap
                                        .filter(function (e) {
                                            return e;
                                        })
                                        .map(function (y) {
                                            return {
                                                "activeFlag": true,
                                                "licenseTypeName": y
                                            }
                                        })

                                        console.log(LicenseMap)
        
                                if (data.cdataCSV != "" && data.cdataCSV != null) {
                                    var CustomDataMap =
                                        data.cdataCSV
                                            .split('|')
                                            .map(function (y) {
                                                return {
                                                    "customDataTypeName": y.split(':')[0],
                                                    "text": y.split(':')[1]
                                                }
                                            })
                                }
                                else CustomDataMap = []
        
        
                                x = [{
                                    "personIdentity": {
                                        "personNumber": data.personNum
                                    },
                                    "gdapAssignments": [{
                                        "gdapName": data.gdapName,
                                        "defaultSwitch":true,
                                        "role": "MANAGER_ROLE",
                                        "effectiveDate": new Date().toISOString().split('T')[0], "expirationDate": "3000-01-01"
                                    }],
                                    "jobAssignment": {
                                        "scheduleGroupName": data.scheduleGroup,
                                        "jobAssignmentDetails": {
                                            "payRuleEffectiveDate": data.date,
                                            "payRuleName": data.payRule,
                                            "timeZoneName": data.timezone,
                                            "deviceGroupName": data.deviceGroupName,
                                            "workerTypeName": data.workerType,
                                            "supervisorPersonNumber": data.supervisorID
        
                                        },
                                        "employmentTermAssignments": [{
                                            "startDate": data.date, "endDate": "3000-01-01",
                                            "name": data.employmentTerm
        
                                        }],
                                        "baseWageRates": [{
                                            "effectiveDate": data.date, "expirationDate": "3000-01-01",
                                            "hourlyRate": parseFloat(data.wageRate, 10).toPrecision(4)
                                        }],
        
                                        "primaryLaborAccounts": [{
                                            "effectiveDate": data.date, "expirationDate": "3000-01-01",
                                            "organizationPath": data.primaryJob,
                                            "laborCategoryName": data.laborCategory
                                        }]
                                    },
                                    "personInformation": {
                                        "employeeCurrencyAssignment": { "currencyCode": data.employeeCurrency },
        
        
                                        "telephoneNumbers": [
                                            {
                                                "contactTypeName": data.phoneFieldName, "isSMSSwitch": data.isSMSSwitch, "phoneNumber": data.phoneNumber
                                            },
                                            {
                                                "contactTypeName": data.phoneFieldName2, "isSMSSwitch": data.isSMSSwitch2, "phoneNumber": data.phoneNumber2
                                            },
                                            {
                                                "contactTypeName": data.phoneFieldName3, "isSMSSwitch": data.isSMSSwitch3, "phoneNumber": data.phoneNumber3
                                            }
        
                                        ],
                                        "personAuthenticationTypes": [{ "authenticationTypeName": data.authenticationTypeName, "activeFlag": true }],
                                        "customDateList": [
                                            {
                                                "customDateTypeName": data.customDateTypeName, "date": data.customDateDate
                                            }
                                        ],
                                        "postalAddresses": [
                                            {
                                                "city": data.city, "state": data.state, "postalCode": data.postalCode, "country": data.country,"street":data.postalAddress, "contactTypeName": "Home"
                                            }
                                        ],
                                        "expectedHoursList": [
                                            {
                                                "timePeriodTypeName": "WEEKLY", "quantity": data.weeklyHours
                                            },
                                            {
                                                "timePeriodTypeName": "DAILY", "quantity": data.dailyHours
                                            },
                                            {
                                                "timePeriodTypeName": "PAY PERIOD", "quantity": parseFloat(data.payperiodHours,10)
                                            }
        
                                        ],
                                        "emailAddresses": [
                                            {
                                                "contactTypeName": "WORK", "address": data.email
                                            }
                                        ],
                                        "customDataList": CustomDataMap,
                                        "accessAssignment": {
                                            "accessProfileName": data.accessProfileName,
                                            "timeEntryTypeName": data.timeEntryTypeName,
                                            "timeEntryTypeEffectiveDate": new Date().toISOString().split('T')[0],
                                            "preferenceProfileName": data.preferenceProfileName,
                                            "notificationProfileName": data.notProfileName,
                                            "localePolicyName": data.localePolicyName,
                                            "managerWorkRuleName": data.managerWorkRule,
                                            "managerViewPayCodeName": data.managerPCV,
                                            "managerPayCodeName": data.managerPCE,
                                            "managerLaborCategoryProfileName": data.managerLCP,
                                            "professionalPayCodeName": data.employeePCE,
                                            "professionalWorkRuleName": data.professionalWorkRule,
                                            "employeeLaborCategoryProfileName": data.employeeLCP,
                                            "schedulePatternName": data.schedulePatternName,
                                            "shiftCodeName": data.shiftCodeName,
                                            "reportName": data.reportName,
                                            "groupScheduleName": data.groupScheduleName,
                                            "forecastingCategoryProfileName": data.forecastingCategoryProfileName,
                                            "mgrEmplLaborCategoryProfileName": data.mgrEmplLaborCategoryProfileName,
                                            "delegateProfileName": data.delegateProfileName
        
                                        },
                                        "personAccessAssignments": [{
                                            "effectiveDate": data.date, "expirationDate": "3000-01-01",
                                            "managerEmployeeGroupName": data.employeeGroup,
                                            "managerTransferOrganizationSetName": data.organisationalSet,
                                            "empMgrTransferOrganizationSetName": data.empMgrTransferOrganizationSetName,
                                            "professionalTransferOrganizationSetName": data.professionalTransferOrganizationSetName,
                                            "homeHyperFindQueryName": data.homeHyperFindQueryName
                                        }],
                                        "person": {
                                            "personNumber": data.overridePersonNum || data.personNum,
                                            "lastName": data.lastName,
                                            "hireDate": data.hireDate,
                                            "middleInitial": data.middleInitial,
                                            "shortName": data.shortName,
                                            "birthDate": data.birthDate,
                                            "firstName": data.firstName,
                                            "accrualProfileName": data.accrualProfile,
                                            "accrualProfileEffectiveDate": data.date,
                                            "fingerRequiredFlag": data.fingerRequiredFlag,
                                            "fullTimeEquivalencies": [{
                                                "effectiveDate": data.date, "expirationDate": "3000-01-01",
                                                "employeeStandardHours": data.employeeHours,
                                                "fullTimeStandardHours": data.fullTimeHours,
                                                "fullTimePercentage": parseFloat(data.fullTimePct, 10)
                                            }]
                                        },
                                        "personLicenseTypes": LicenseMap,
                                        "userAccountStatusList": [{
                                            "effectiveDate": data.date,
                                            "userAccountStatusName": "Active"
                                        }],
                                        "employmentStatusList": [{
                                            "effectiveDate": data.date , 
                                            "expirationDate": "3000-01-01",
                                            "employmentStatusName": "Active"
        
                                        }],
                                        "badgeAssignments": [{
                                            "badgeNumber": data.badgeNumber,
                                            "effectiveDate": new Date().toISOString().split('T')[0]
                                        }],
                                        "analyticsLaborTypesList": [
                                            {
                                                "analyticsLaborTypeName": data.analyticsLaborTypeName,
                                                "effectiveDate": data.date, "expirationDate": "3000-01-01"
                                            }
                                        ],
                                        "workEmployee": {
                                            "defaultActivityName": data.defaultActivityName,
                                            "idleActivityName": data.idleActivityName,
                                            "paidActivityName": data.paidActivityName,
                                            "profileName": data.workProfileName,
                                            "unpaidActivityName": data.unpaidActivityName
                                        }
                                    },
        
                                    "user": {
                                        "userAccount": {
                                            "logonProfileName": data.logonProfileName,
                                            "userName": data.userName,
                                            "userPassword": data.userPassword,
                                            "mfaRequired": data.mfaRequired
                                        },
                                        "userCurrency": { "currencyCode": data.currencyCode }
                                    }
                                }]
        
                                var today = new Date();
                                var todayDate = today.toISOString().substr(0, 10)
                                console.log(x[0].personInformation.emailAddresses)
                                function CheckEmpty(param) {
                                    //console.log(param)
                                    if (param == '' || param == null || param == undefined) {;return false }
                                    else return true
                                }
                                function RemoveNullFromArray(array) {
                                    return array.filter(function(e) {
                                      return e;
                                    });
                                  }
        
                                //Identity
                                if (data.updateFlag == 'FALSE' || data.updateFlag == '' || data.updateFlag == null) { 
                                    delete x[0].personIdentity 
                                }
                                else {delete x[0].personInformation.employmentStatusList}

                                //GDAP
                                if (CheckEmpty(data.gdapName) == false) { delete x[0].gdapAssignments}
                                //SCHEDULEGROUP
                                if (CheckEmpty(data.scheduleGroup) == false) { delete x[0].jobAssignment.scheduleGroupName}
                                //JOBASSIGNMENTDETAILS
                                if (CheckEmpty(data.payRule) == false) { delete x[0].jobAssignment.jobAssignmentDetails.payRuleName; delete x[0].jobAssignment.jobAssignmentDetails.payRuleEffectiveDate  }
                                if (CheckEmpty(data.timezone) == false) { delete x[0].jobAssignment.jobAssignmentDetails.timeZoneName}
                                if (CheckEmpty(data.deviceGroupName) == false) { delete x[0].jobAssignment.jobAssignmentDetails.deviceGroupName}
                                if (CheckEmpty(data.workerTypeName) == false) { delete x[0].jobAssignment.jobAssignmentDetails.workerTypeName}
                                if (CheckEmpty(data.supervisorID) == false) { delete x[0].jobAssignment.jobAssignmentDetails.supervisorPersonNumber}
                                if (Object.keys(x[0].jobAssignment.jobAssignmentDetails).length == 0) { delete x[0].jobAssignment.jobAssignmentDetails }
                                //ETERMS
                                if (CheckEmpty(data.employmentTerm) == false) { delete x[0].jobAssignment.employmentTermAssignments }
                                //BASEWAGERATES
                                if (CheckEmpty(data.wageRate) == false) { delete x[0].jobAssignment.baseWageRates }
                                //PRIMARYLABORACCTS
                                if (CheckEmpty(data.primaryJob) == false) { delete x[0].jobAssignment.primaryLaborAccounts[0].organizationPath }
                                if (CheckEmpty(data.laborCategory) == false) { delete x[0].jobAssignment.primaryLaborAccounts[0].laborCategoryName }
                                if (Object.keys(x[0].jobAssignment.primaryLaborAccounts[0]).length == 2) { delete x[0].jobAssignment.primaryLaborAccounts }
                                //EMPCURENCY
                                if (CheckEmpty(data.employeeCurrency) == false) { delete x[0].personInformation.employeeCurrencyAssignment }
                                //MOBILE
                                if (CheckEmpty(data.isSMSSwitch) == false) {x[0].personInformation.telephoneNumbers[0].isSMSSwitch = false }
                                if (CheckEmpty(data.isSMSSwitch2) == false) {x[0].personInformation.telephoneNumbers[1].isSMSSwitch = false }
                                if (CheckEmpty(data.isSMSSwitch3) == false) {x[0].personInformation.telephoneNumbers[2].isSMSSwitch = false }
                                if (CheckEmpty(data.phoneNumber3) == false) {console.log('true'); x[0].personInformation.telephoneNumbers.splice(2,1) }
                                if (CheckEmpty(data.phoneNumber2) == false) {console.log('true'); x[0].personInformation.telephoneNumbers.splice(1,1) }
                                if (CheckEmpty(data.phoneNumber) == false) {console.log('true'); x[0].personInformation.telephoneNumbers.splice(0,1) }
                                if (x[0].personInformation.telephoneNumbers.length === 0){delete x[0].personInformation.telephoneNumbers}
                                //telephoneNumbers
                                if (CheckEmpty(data.authenticationTypeName) == false) { delete x[0].personInformation.personAuthenticationTypes }
                               
                                //CUSTOMDATE
                                if (CheckEmpty(data.customDateTypeName) == false) { delete x[0].personInformation.customDateList }
                                //POSTALADDRESS
                                if (CheckEmpty(data.city) == false) { delete x[0].personInformation.postalAddresses[0].city }
                                if (CheckEmpty(data.postalAddress) == false) { delete x[0].personInformation.postalAddresses[0].street }
                                if (CheckEmpty(data.state) == false) { delete x[0].personInformation.postalAddresses[0].state }
                                if (CheckEmpty(data.postalCode) == false) { delete x[0].personInformation.postalAddresses[0].postalCode }
                                if (CheckEmpty(data.country) == false) { delete x[0].personInformation.postalAddresses[0].country }
                                if (Object.keys(x[0].personInformation.postalAddresses[0]).length == 1) { delete x[0].personInformation.postalAddresses }
                                //EXPECTEDHOURSLIST
                                if (CheckEmpty(data.payperiodHours) == false) { x[0].personInformation.expectedHoursList.splice(2,1) }
                                if (CheckEmpty(data.dailyHours) == false) { x[0].personInformation.expectedHoursList.splice(1,1) }
                                if (CheckEmpty(data.weeklyHours) == false) { x[0].personInformation.expectedHoursList.splice(0,1) }
                                x[0].personInformation.expectedHoursList =  RemoveNullFromArray(x[0].personInformation.expectedHoursList)
                                if (x[0].personInformation.expectedHoursList.length == 0) { delete x[0].personInformation.expectedHoursList }

                                //EMAIL
                                if (CheckEmpty(data.email) == false) { delete x[0].personInformation.emailAddresses }
                                //CUSTOMDATA
                                if (CustomDataMap.length == 0) { delete x[0].personInformation.customDataList }
                                //ACCESSASSIGNMENTS
                                if (CheckEmpty(data.accessProfileName) == false) { delete x[0].personInformation.accessAssignment.accessProfileName }
                                if (CheckEmpty(data.timeEntryTypeName) == false) { delete x[0].personInformation.accessAssignment.timeEntryTypeName; delete x[0].personInformation.accessAssignment.timeEntryTypeEffectiveDate }
                                if (CheckEmpty(data.preferenceProfileName) == false) { delete x[0].personInformation.accessAssignment.preferenceProfileName }
                                if (CheckEmpty(data.notProfileName) == false) { delete x[0].personInformation.accessAssignment.notificationProfileName }
                                if (CheckEmpty(data.localePolicyName) == false) { delete x[0].personInformation.accessAssignment.localePolicyName }
                                if (CheckEmpty(data.managerWorkRule) == false) { delete x[0].personInformation.accessAssignment.managerWorkRuleName }
                                if (CheckEmpty(data.managerPCV) == false) { delete x[0].personInformation.accessAssignment.managerViewPayCodeName }
                                if (CheckEmpty(data.managerPCE) == false) { delete x[0].personInformation.accessAssignment.managerPayCodeName }
                                if (CheckEmpty(data.employeePCE) == false) { delete x[0].personInformation.accessAssignment.professionalPayCodeName }
                                if (CheckEmpty(data.managerLCP) == false) { delete x[0].personInformation.accessAssignment.managerLaborCategoryProfileName }
                                if (CheckEmpty(data.employeePCE) == false) { delete x[0].personInformation.accessAssignment.professionalPayCodeName }
                                if (CheckEmpty(data.professionalWorkRule) == false) { delete x[0].personInformation.accessAssignment.professionalWorkRuleName }
                                if (CheckEmpty(data.employeeLCP) == false) { delete x[0].personInformation.accessAssignment.employeeLaborCategoryProfileName }
                                if (CheckEmpty(data.schedulePatternName) == false) { delete x[0].personInformation.accessAssignment.schedulePatternName }
                                if (CheckEmpty(data.shiftCodeName) == false) { delete x[0].personInformation.accessAssignment.shiftCodeName }
                                if (CheckEmpty(data.reportName) == false) { delete x[0].personInformation.accessAssignment.reportName }
                                if (CheckEmpty(data.groupScheduleName) == false) { delete x[0].personInformation.accessAssignment.groupScheduleName }
                                if (CheckEmpty(data.forecastingCategoryProfileName) == false) { delete x[0].personInformation.accessAssignment.forecastingCategoryProfileName }
                                if (CheckEmpty(data.mgrEmplLaborCategoryProfileName) == false) { delete x[0].personInformation.accessAssignment.mgrEmplLaborCategoryProfileName }
                                if (CheckEmpty(data.delegateProfileName) == false) { delete x[0].personInformation.accessAssignment.delegateProfileName }
                                if (Object.keys(x[0].personInformation.accessAssignment).length == 0) delete x[0].personInformation.accessAssignment
                                //PERSONACCESSASSIGNMENTS
                                if (CheckEmpty(data.employeeGroup) == false) { delete x[0].personInformation.personAccessAssignments[0].managerEmployeeGroupName }
                                if (CheckEmpty(data.organisationalSet) == false) { delete x[0].personInformation.personAccessAssignments[0].managerTransferOrganizationSetName }
                                if (CheckEmpty(data.empMgrTransferOrganizationSetName) == false) { delete x[0].personInformation.personAccessAssignments[0].empMgrTransferOrganizationSetName }
                                if (CheckEmpty(data.professionalTransferOrganizationSetName) == false) { delete x[0].personInformation.personAccessAssignments[0].professionalTransferOrganizationSetName }
                                if (CheckEmpty(data.homeHyperFindQueryName) == false) { delete x[0].personInformation.personAccessAssignments[0].homeHyperFindQueryName }
                                if (Object.keys(x[0].personInformation.personAccessAssignments[0]).length == 2) {delete x[0].personInformation.personAccessAssignments}
                            
                                //PERSONDATA
                                if (CheckEmpty(data.personNum) == false) { delete x[0].personInformation.person.personNumber }
                                if (CheckEmpty(data.lastName) == false) { delete x[0].personInformation.person.lastName }
                                if (CheckEmpty(data.middleInitial) == false) { delete x[0].personInformation.person.middleInitial }
                                if (CheckEmpty(data.shortName) == false) { delete x[0].personInformation.person.shortName }
                                if (CheckEmpty(data.birthDate) == false) { delete x[0].personInformation.person.birthDate }
                                if (CheckEmpty(data.fingerRequiredFlag) == false) { delete x[0].personInformation.person.fingerRequiredFlag }
                                
                                if (CheckEmpty(data.hireDate) == false) { delete x[0].personInformation.person.hireDate }
                                if (CheckEmpty(data.firstName) == false) { delete x[0].personInformation.person.firstName }
                                if (CheckEmpty(data.accrualProfile) == false) { delete x[0].personInformation.person.accrualProfileName; delete x[0].personInformation.person.accrualProfileEffectiveDate }
                                if (CheckEmpty(data.employeeHours) == false) { delete x[0].personInformation.person.fullTimeEquivalencies[0].employeeStandardHours }
                                if (CheckEmpty(data.fullTimeHours) == false) { delete x[0].personInformation.person.fullTimeEquivalencies[0].fullTimeStandardHours }
                                if (CheckEmpty(data.fullTimePct) == false) {delete x[0].personInformation.person.fullTimeEquivalencies[0].fullTimePercentage }
                                if (Object.keys(x[0].personInformation.person.fullTimeEquivalencies[0]).length == 2) delete x[0].personInformation.person.fullTimeEquivalencies
                                if (Object.keys(x[0].personInformation.person).length === 0) delete x[0].personInformation.person
                                //USERACCOUNTSTATUS
                                if (CheckEmpty(data.userName) == false) { delete x[0].personInformation.userAccountStatusList }
                                //BADGES
                                if (CheckEmpty(data.badgeNumber) == false) { delete x[0].personInformation.badgeAssignments }
                                //ANALYTICS TYPE
                                if (CheckEmpty(data.analyticsLaborTypeName) == false) { delete x[0].personInformation.analyticsLaborTypesList }
                                //WORKDATA
                                if (CheckEmpty(data.defaultActivityName) == false) { delete x[0].personInformation.workEmployee.defaultActivityName }
                                if (CheckEmpty(data.idleActivityName) == false) { delete x[0].personInformation.workEmployee.idleActivityName }
                                if (CheckEmpty(data.paidActivityName) == false) { delete x[0].personInformation.workEmployee.paidActivityName }
                                if (CheckEmpty(data.workProfileName) == false) { delete x[0].personInformation.workEmployee.profileName }
                                if (CheckEmpty(data.unpaidActivityName) == false) { delete x[0].personInformation.workEmployee.unpaidActivityName }
                                if (Object.keys(x[0].personInformation.workEmployee).length === 0) { delete x[0].personInformation.workEmployee }
                                //USERDATA
                                if (CheckEmpty(data.currencyCode) == false) { delete x[0].user.userCurrency }
                                if (CheckEmpty(data.userName) == false) { delete x[0].user.userAccount.userName }
                                if (CheckEmpty(data.userPassword) == false) { delete x[0].user.userAccount.userPassword }
                                if (CheckEmpty(data.mfaRequired) == false) { delete x[0].user.userAccount.mfaRequired }
                                if (CheckEmpty(data.logonProfileName) == false) { delete x[0].user.userAccount.logonProfileName }
                                if (Object.keys(x[0].user.userAccount).length === 0) { delete x[0].user.userAccount }
                                if (Object.keys(x[0].user).length === 0) delete x[0].user

                                if (x[0].jobAssignment == {}){delete x[0].jobAssignment}
        
        
        
        
                                console.log(x)
                                return x
                            },
            //,data: [["998867","Muff","Quick Load","California","/Organization/United States/Metropolitan Plant/Machine Shop/Apprentice Welder","2018-09-20"]],
        },

        {
            'type_name': 'Fix Person Records',

            'apiUrl': '/v1/commons/persons/multi_upsert',
            'cdata': [{
                visible: true, data: 'Person Number*', name: 'personNum'
            }],
            'apiMap': function (data) {
                x = [{
                    "personIdentity": {
                        "personNumber": data.personNum
                    },
                    "user": {
                        "userAccount": { "passwordUpdateFlag": false }
                    }
                }]

                return x
            },
        },

        {
            'type_name': 'Update Employment Status/User Accounts',

            'apiUrl': '/v1/commons/persons/multi_upsert',
            'cdata': [{
                visible: true, data: 'Person Number*', name: 'personNum'
            },
            {
                visible: true, data: 'Date', name: 'date'
            }],
            'apiMap': function (data) {
                x = [{
                    "personIdentity": {
                        "personNumber": data.personNum
                    },
                    "personInformation": {
                        "employmentStatusList": [{
                            "effectiveDate": data.date,
                            "expirationDate": "3000-01-01",
                            "employmentStatusName": "Active"

                        }],
                        "userAccountStatusList": [{
                            "effectiveDate": data.date,
                            "userAccountStatusName": "Active"
                        }]
                    }
                }]

                return x
            },
        },
{

	'type_name': 'Attendance Event Import',
        'apiUrl': '/v1/attendance/events/multi_create',
        'async': false,
        'cdata': [
        {
        	visible: true,
                data: 'Employee Number*',
                name: 'employeeID'
        },
        {
        	visible: true,
                data: 'Event Name*',
                name: 'eventName',
		        datasource: {
                        apiurl: '/v1/attendance/events',
                        tag: 'name'
                    	    }
        },
        {
        	visible: true,
                data: 'Apply Date YYYY-MM-DD*',
                name: 'applyDate'
        },
        {
        	visible: true,
                data: 'Apply Time 24:00*',
                name: 'applyTime'
        },
        {
		visible: true,
                data: 'Amount in Seconds',
                name: 'timeInSeconds'
        }     



        ],
        'apiMap': function(d) {

                var y = 
[
    {
        "employee": {
            "qualifier": d.employeeID
        },
        "eventDefinition": {
            "qualifier": d.eventName,
            "type": {
                "name": "BASIC"
            }
        },
        "applyDate": d.applyDate,
        "eventTime": d.applyTime,
        "amount": d.timeInSeconds
    }
]

		if (d.timeInSeconds == '' || d.timeInSeconds == null ) delete y[0].amount
                x = y
		console.log(y)
                return x
        }
},


{

            'type_name': 'Pay Code Data Access Profiles',
            'apiUrl': '/v1/timekeeping/setup/pay_codes/data_access_profiles/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Paycodes CSV',
                    name: 'paycodesCSV'
                }
            ],
            'apiMap': function(d) {
         if (d.paycodesCSV == null) d.paycodesCSV = ''
         var entryArrPS = d.paycodesCSV.split(',')
               var entryArrMapPS = entryArrPS.map(function(x){
        		return  {"qualifier":x}})
                console.log(entryArrMapPS)
       
                var y = 
[{
  "description": d.description,
  "name": d.name,
  "payCodes": entryArrMapPS
}]

                if (y[0].description == '') delete y[0].description
                if (y[0].entryArrMapPS == '') delete y[0].entryArrMap

                x = y
                return x
            }
        },



{
            'type_name': 'Personality Data',
             limit: 500,
            'apiUrl': '/v1/commons/persons/multi_upsert',
	    'allowableErrors': [{
                errorCode: 'WCO-101520',
                errorColor: 'blue',
                errorMessage: 'The employee has already been loaded'
            }],
           
            'cdata': [
		{
                    visible: true,
                    data: 'Update?',
                    name: 'updateFlag',
		    datasource: ['TRUE','FALSE']
                },
		{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNum'
                },
                {
                    visible: true,
                    data: 'First Name',
                    name: 'firstName'
                },
                {
                    visible: true,
                    data: 'Last Name',
                    name: 'lastName'
                },
                {
                    visible: true,
                    data: 'Pay Rule',
                    name: 'payRule',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/payrules',
                        tag: 'name'
                    }
                },
                //NEW
                {
                    visible: true,
                    data: 'Accrual Profile',
                    name: 'accrualProfile',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/accrual_profiles',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Full Time %',
                    name: 'fullTimePct'
                },
		{
                    visible: true,
                    data: 'Full Time Hours',
                    name: 'fullTimeHours'
                },
		{
                    visible: true,
                    data: 'Employee Hours',
                    name: 'employeeHours'
                },

		{
                    visible: true,
                    data: 'Wage Rate',
                    name: 'wageRate'
                },
                {
                    visible: true,
                    data: 'Employment Term',
                    name: 'employmentTerm',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/employment_terms',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Primary Job',
                    name: 'primaryJob'
                },
                //END NEW
                {
                    visible: true,
                    data: 'Hire Date',
                    name: 'hireDate'
                },
                {
                    visible: true,
                    data: 'Labor Category',
                    name: 'laborCategory'
                },
                {
                    visible: true,
                    data: 'Time Zone',
                    name: 'timezone',
		    datasource: ['Afghanistan', 'Alaskan', 'Almaty', 'Arabian', 'Arizona', 'Atlantic', 'AUS_Central', 'Azores', 'Baghdad', 'Baku', 'Bangkok', 'Brisbane', 'Canada_Central', 'Cape_Verde_Islands', 'Central', 'Central_America', 'Central_Asia', 'Central_Australia', 'Central_Pacific', 'Chihuahua', 'China', 'Czech', 'E._Europe', 'E._South_America', 'Eastern', 'Egypt', 'Ekaterinburg', 'FIJI', 'GFT', 'GMT', 'Greenland', 'Greenwich', 'Hawaiian', 'Helsinki', 'India', 'Indiana(East)', 'Iran', 'Irkutsk', 'Israel', 'Kathmandu', 'Krasnoyarsk', 'Kuala_Lumpur', 'Lisbon_Warsaw', 'Lord_Howe_Island', 'Mexico', 'Mid-Atlantic', 'Mountain', 'Nairobi', 'New_Zealand', 'Newfoundland',  'Pacific', 'Perth', 'Rangoon', 'Romance', 'Russian', 'SA_Eastern', 'SA_Pacific', 'SA_Western', 'Samoa', 'Santiago', 'Saudi_Arabia', 'Seoul', 'South_Africa', 'Sri_Jayawardenepura', 'Sydney', 'Taipei', 'Tasmania', 'Tokyo', 'UTC', 'Vladivostok', 'W._Europe', 'West_Asia', 'West_Central_Africa', 'West_Pacific', 'Yakutsk']
                },
                {
                    visible: true,
                    data: 'Primary Account Effective Date',
                    name: 'primAcctEffDt'
                },
                {
                    visible: true,
                    data: 'Display Profile',
                    name: 'preferenceProfileName',
                    datasource: {
                        apiurl: '/v1/commons/display_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Function Access Profile',
                    name: 'accessProfileName',
		    datasource: {
                        apiurl: '/v1/commons/function_access_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Time Entry Method',
                    name: 'timeEntryTypeName',
                    datasource: ['Time Stamp & Hourly View', 'Time Stamp', 'Hourly View']
                },
		{
                    visible: true,
                    data: 'Locale',
                    name: 'localePolicyName'
                },
		{
                    visible: true,
                    data: 'Worker Type',
                    name: 'workerType'
                },
		{
                    visible: true,
                    data: 'Supervisor ID',
                    name: 'supervisorID'
                },

		{
                    visible: true,
                    data: 'Notification Profile',
                    name: 'notProfileName'
                },
		{
                    visible: true,
                    data: 'Email',
                    name: 'email'
                },
		{
                    visible: true,
                    data: 'Schedule Group',
                    name: 'scheduleGroup'
                },


                {
                    visible: true,
                    data: 'Device Group',
                    name: 'deviceGroupName',
                    datasource: {
                        apiurl: '/v1/commons/device_groups',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Badge Number',
                    name: 'badgeNumber'
                },
		{
                    visible: true,
                    data: 'Organisational Set',
                    name: 'organisationalSet',
                    datasource: {
                        apiurl: '/v1/commons/location_sets/multi_read',
                        tag: 'name',
			pdata: {"where": {"allDetails": false,"context": "ORG","date": "1900-01-01","types": {"ids": [1,2,3]}}}
                    }
                },
		{
                    visible: true,
                    data: 'Employee Group',
                    name: 'employeeGroup',
                    datasource: {
                        apiurl: '/v1/commons/employee_groups',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Manager Work Rule',
                    name: 'managerWorkRule'
                },
		{
                    visible: true,
                    data: 'Manager Pay Code Edit',
                    name: 'managerPCE',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes/data_access_profiles',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Manager Pay Code View',
                    name: 'managerPCV',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes/data_access_profiles',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Manager Labor Category Profile',
                    name: 'managerLCP',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_profiles',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Licenses CSV',
                    name: 'licenseCSV'
                },
		{
                    visible: true,
                    data: 'Custom Data CSV',
                    name: 'cdataCSV'
                },
            ],

            'apiMap': function(data) {

var checkNull = data.licenseCSV

if (data.licenseCSV == "" || data.licenseCSV == null) {
    console.log('true');
    checkNull = 'Hourly Timekeeping'
}

console.log(checkNull)
//console.log(data.licenseCSV)

var entryArr = checkNull.split(',')
var entryArrMap = entryArr.map(function(y) {
    return {
        "activeFlag": true,
        "licenseTypeName": y
    }
})
console.log(entryArrMap)

var checkNull1 = data.cdataCSV

if (data.cdataCSV == "" || data.cdataCSV == null) {
    console.log('true');
    checkNull1 = 'None'
}
entryArr2 = checkNull1.split(',')
var entryArrMap2 = entryArr2.map(function(y) {
    return y.split(':')
    
})
var entryArrMap3 = entryArrMap2.map(function(y) {
    return {
        "customDataTypeName": y[0],
        "text": y[1]
    }
})
console.log(entryArrMap3)


x = [{
    "personIdentity": {
        "personNumber": data.personNum
    },
    "jobAssignment": {
	"scheduleGroupName": data.scheduleGroup,
        "jobAssignmentDetails": {
            "payRuleEffectiveDate": data.hireDate,
            "payRuleName": data.payRule,
            "timeZoneName": data.timezone,
            "deviceGroupName": data.deviceGroupName,
            "workerTypeName": data.workerType,
            "supervisorPersonNumber": data.supervisorID
      	    
        },
        "employmentTermAssignments": [{
            "endDate": "3000-01-01",
            "name": data.employmentTerm,
            "startDate": data.hireDate
        }],
        "baseWageRates": [{
            "effectiveDate": data.hireDate,
            "expirationDate": "3000-01-01",
            "hourlyRate": parseInt(data.wageRate, 10)
        }],

        "primaryLaborAccounts": [{
            "effectiveDate": data.hireDate,
            "expirationDate": "3000-01-01",
            "organizationPath": data.primaryJob,
            "laborCategoryName": data.laborCategory
        }]
    },
    "personInformation": {
	 "emailAddresses": [
        	{
        	  "address": data.email,
		  "contactTypeName":"WORK"
        	}
     	],
  "customDataList":entryArrMap3,
        "accessAssignment": {
            "accessProfileName": data.accessProfileName,
            "timeEntryTypeName": data.timeEntryTypeName,
            "timeEntryTypeEffectiveDate": new Date().toISOString().split('T')[0],
            "preferenceProfileName": data.preferenceProfileName,
            "notificationProfileName": data.notProfileName,
            "localePolicyName": data.localePolicyName,
	    "managerWorkRuleName": data.managerWorkRule,
	    "managerViewPayCodeName": data.managerPCV,
	    "managerPayCodeName": data.managerPCE,
	    "managerLaborCategoryProfileName": data.managerLCP



        },
        "personAccessAssignments": [{
            "managerEmployeeGroupEffectiveDate": "1900-01-01",
            "managerEmployeeGroupExpirationDate": "3000-01-01",
            "managerEmployeeGroupName": data.organisationalSet,
            "managerTransferOrganizationSetEffectiveDate": "1900-01-01",
            "managerTransferOrganizationSetExpirationDate": "3000-01-01",
            "managerTransferOrganizationSetName": data.employeeGroup
        }],
        "person": {
            "personNumber": data.personNum,
            "lastName": data.lastName,
            "hireDate": data.hireDate,
            "firstName": data.firstName,
            "accrualProfileName": data.accrualProfile,
            "accrualProfileEffectiveDate": data.hireDate,
            "fullTimeEquivalencies": [{
                "effectiveDate": data.hireDate,
       		"employeeStandardHours": data.employeeHours,
		"fullTimeStandardHours" : data.fullTimeHours,
                "expirationDate": "3000-01-01",
                "fullTimePercentage": parseInt(data.fullTimePct, 10)
            }]
        },
        "personLicenseTypes": entryArrMap,
        "userAccountStatusList": [{
            "effectiveDate": data.hireDate,
            "userAccountStatusName": "Active"
        }],
        "employmentStatusList": [{
            "effectiveDate": data.hireDate,
            "employmentStatusName": "Active",
            "expirationDate": "3000-01-01"
        }],
        "badgeAssignments": [{
            "badgeNumber": data.badgeNumber,
            "effectiveDate": new Date().toISOString().split('T')[0]
        }]
    },

    "user": {
        "userAccount": {
            "logonProfileName": "Default",
            "userName": data.firstName + '.' + data.lastName,
            "userPassword": "Kr0n0s@Cloud"
        }
    }
}]

var today = new Date();
var todayDate = today.toISOString().substr(0, 10)
console.log(x[0].personInformation.emailAddresses)

if (data.updateFlag == 'TRUE') {
    delete x[0].user.userAccount.userPassword
    if (data.hireDate == '' || data.hireDate == null) { data.hireDate = todayDate ; console.log(data.hireDate)}
    if (data.scheduleGroup == '' || data.scheduleGroup == null) delete x[0].jobAssignment.scheduleGroupName
    if (data.laborCategory == '' || data.laborCategory == null) delete x[0].jobAssignment.primaryLaborAccounts.laborCategoryName
    if (data.timeZoneName == '' || data.timeZoneName == null) delete x[0].jobAssignment.jobAssignmentDetails.timeZoneName
    if (data.primAcctEffDt != '' || data.primAcctEffDt != null) x[0].jobAssignment.primaryLaborAccounts.effectiveDate = data.primAcctEffDt
    if (data.primaryJob == '' || data.primaryJob == null) delete x[0].jobAssignment.primaryLaborAccounts
    if (data.licenseCSV == '' || data.licenseCSV == null) delete x[0].personInformation.person.personLicenseTypes
console.log(x[0].personInformation.emailAddresses)
    if (data.email == '' || data.email == null) delete x[0].personInformation.emailAddresses[0].contactTypeName; delete x[0].personInformation.emailAddresses[0].address; delete x[0].personInformation.emailAddresses[0] ; delete x[0].personInformation.emailAddresses

    if (data.wageRate == '' || data.wageRate == null) {
        delete x[0].jobAssignment.baseWageRates
        delete x[0].personInformation.person.hireDate
    }

    if (data.supervisorID == '' || data.supervisorID == null) delete x[0].jobAssignment.jobAssignmentDetails.supervisorPersonNumber
    if (data.workerType == '' || data.workerType == null) delete x[0].jobAssignment.jobAssignmentDetails.workerTypeName
    if ( data.managerWorkRule == '' || data.managerWorkRule == null) delete x[0].personInformation.accessAssignment.managerWorkRuleName
    if ( data.managerPCV == '' || data.managerPCV == null) delete x[0].personInformation.accessAssignment.managerViewPayCodeName
    if ( data.managerPCE == '' || data.managerPCE == null) delete x[0].personInformation.accessAssignment.managerPayCodeName
    if ( data.managerLCP == '' || data.managerLCP == null) delete x[0].personInformation.accessAssignment.managerLaborCategoryProfileName

    if ( data.cdataCSV == '' || data.cdataCSV == null) delete x[0].personInformation.customDataList



  if(data.licenseCSV == "" || data.licenseCSV == null) delete x[0].personInformation.personLicenseTypes 
  if (x[0].personInformation.userAccountStatusList[0].effectiveDate == '' || x[0].personInformation.userAccountStatusList[0].effectiveDate == null){
          delete x[0].personInformation.userAccountStatusList} 
  if (x[0].personInformation.employmentStatusList[0].effectiveDate == '' || x[0].personInformation.employmentStatusList[0].effectiveDate == null){
          delete x[0].personInformation.employmentStatusList}
//Name Data
    if (data.lastName == '' || data.lastName == null) delete x[0].personInformation.person.lastName
    if (data.firstName == '' || data.firstName == null) delete x[0].personInformation.person.firstName
    if (data.personNumber == '' || data.personNumber == null) delete x[0].personInformation.person.personNumber
//User
    if ((data.lastName == '' || data.lastName == null) && (data.firstName == '' || data.firstName == null)) delete x[0].user
//Locale
    if (data.localePolicyName == '' || data.localePolicyName == null) delete x[0].personInformation.accessAssignment.localePolicyName
//Accrual Prfl
    if (data.accrualProfile == '' || data.accrualProfile == null) {
        delete x[0].personInformation.person.accrualProfileName
        delete x[0].personInformation.person.accrualProfileEffectiveDate
    }
 //Eterm
    if (data.employmentTerm == '' || data.employmentTerm == null){ delete x[0].jobAssignment.employmentTermAssignments ; console.log('truth')}
 //FTE
    if ((data.fullTimePct == '' || data.fullTimePct == null) && (data.employeeHours == '' || data.employeeHours == null)) delete x[0].personInformation.person.fullTimeEquivalencies
    if ((data.fullTimePct == '' || data.fullTimePct == null) && (data.employeeHours != '' || data.employeeHours != null)) delete x[0].personInformation.person.fullTimeEquivalencies[0].fullTimePercentage
    if ((data.fullTimePct != '' || data.fullTimePct != null) && (data.employeeHours == '' || data.employeeHours == null)) 
		{delete x[0].personInformation.person.fullTimeEquivalencies[0].employeeStandardHours
		 delete x[0].personInformation.person.fullTimeEquivalencies[0].fullTimeStandardHours}
//Display Profile
    if (data.accessProfileName == '' || data.accessProfileName == null) delete x[0].personInformation.accessAssignment.accessProfileName
    if (data.preferenceProfileName == '' || data.preferenceProfileName == null) delete x[0].personInformation.accessAssignment.preferenceProfileName
//Time Entry Type
    if (data.timeEntryTypeName == '' || data.timeEntryTypeName == null) {
        delete x[0].personInformation.accessAssignment.timeEntryTypeName
        delete x[0].personInformation.accessAssignment.timeEntryTypeEffectiveDate
    }  
//Badge
    if (data.deviceGroupName == '' || data.deviceGroupName == null) delete x[0].jobAssignment.jobAssignmentDetails.deviceGroupName 
    if (data.badgeNumber == '' || data.badgeNumber == null) delete x[0].personInformation.badgeAssignments
//Access
    if (data.notProfileName == '' || data.notProfileName == null) delete x[0].personInformation.accessAssignment.notificationProfileName 
    if (data.employeeGroup == '' || data.employeeGroup == null) { 
        delete x[0].personInformation.personAccessAssignments[0].managerEmployeeGroupName 
        delete x[0].personInformation.personAccessAssignments[0].managerEmployeeGroupExpirationDate
        delete x[0].personInformation.personAccessAssignments[0].managerEmployeeGroupEffectiveDate}
    if (data.organisationalSet == '' || data.organisationalSet == null){ 
        delete x[0].personInformation.personAccessAssignments[0].managerTransferOrganizationSetName
        delete x[0].personInformation.personAccessAssignments[0].managerTransferOrganizationSetEffectiveDate
        delete x[0].personInformation.personAccessAssignments[0].managerTransferOrganizationSetExpirationDate}
    if (data.payRule == '' || data.payRule == null) {
        delete x[0].jobAssignment.jobAssignmentDetails.payRuleName
        delete x[0].jobAssignment.jobAssignmentDetails.payRuleEffectiveDate
    if ( Object.keys(x[0].personInformation.person).length <= 0){ console.log('true');delete x[0].personInformation.person }
    if ( Object.keys(x[0].personInformation.personAccessAssignments[0]).length <= 0){ console.log('true');delete x[0].personInformation.personAccessAssignments }
    if ( Object.keys(x[0].personInformation.accessAssignment).length <= 0){ console.log('true');delete x[0].personInformation.accessAssignment }
    if ( Object.keys(x[0].jobAssignment.jobAssignmentDetails).length <= 0){ console.log('true');delete x[0].jobAssignment.jobAssignmentDetails }
    if ( Object.keys(x[0].jobAssignment).length <= 0){ console.log('true');delete x[0].jobAssignment } 
    if ( Object.keys(x[0].personInformation).length <= 0){ console.log('true');delete x[0].personInformation } 
    }

}
if (data.updateFlag == 'FALSE' || data.updateFlag == '') {
    delete x[0].personIdentity

    if (data.organisationalSet == '') delete x[0].personInformation.personAccessAssignments
    if (data.employeeGroup == '') delete x[0].personInformation.personAccessAssignments
if (data.scheduleGroup == '' || data.scheduleGroup == null) delete x[0].jobAssignment.scheduleGroupName
    if (data.wageRate == '') delete x[0].jobAssignment.baseWageRates
    if (data.notProfileName == '') delete x[0].personInformation.accessAssignment.notificationProfileName
    if (data.payRule == '') {
        delete x[0].jobAssignment.jobAssignmentDetails.payRuleName
        delete x[0].jobAssignment.jobAssignmentDetails.payRuleEffectiveDate
    }
    if (data.email == '' || data.email == null) delete x[0].personInformation.emailAddresses[0].contactTypeName; delete x[0].personInformation.emailAddresses[0].address; delete x[0].personInformation.emailAddresses[0] ; delete x[0].personInformation.emailAddresses
    if (data.hireDate == '') {
        delete x[0].personInformation.person.hireDate
        delete x[0].personInformation.person.userAccountStatusList
        delete x[0].personInformation.person.employmentStatusList
    }
    if (data.firstName == '') delete x[0].personInformation.person.firstName
    if (data.fullTimePct == '') x[0].personInformation.person.fullTimeEquivalencies[0].fullTimePercentage = '100'
    if (data.accrualProfile == '') {
        delete x[0].personInformation.person.accrualProfileName
        delete x[0].personInformation.person.accrualProfileEffectiveDate
    }
    if (data.employmentTerm == '') delete x[0].jobAssignment.employmentTermAssignments

    if ((data.fullTimePct == '' || data.fullTimePct == null) && (data.employeeHours == '' || data.employeeHours == null)) delete x[0].personInformation.person.fullTimeEquivalencies
    if ((data.fullTimePct == '' || data.fullTimePct == null) && (data.employeeHours != '' || data.employeeHours != null)) delete x[0].personInformation.person.fullTimeEquivalencies[0].fullTimePercentage
    if ((data.fullTimePct != '' || data.fullTimePct != null) && (data.employeeHours == '' || data.employeeHours == null)) 
		{delete x[0].personInformation.person.fullTimeEquivalencies[0].employeeStandardHours
		 delete x[0].personInformation.person.fullTimeEquivalencies[0].fullTimeStandardHours}

    if (data.primaryJob == '') delete x[0].jobAssignment.primaryLaborAccounts

    if (data.supervisorID == '' || data.supervisorID == null) delete x[0].jobAssignment.jobAssignmentDetails.supervisorPersonNumber
    if (data.workerType == '' || data.workerType == null) delete x[0].jobAssignment.jobAssignmentDetails.workerTypeName
    if ( data.managerWorkRule == '' || data.managerWorkRule == null) delete x[0].personInformation.accessAssignment.managerWorkRuleName
    if ( data.managerPCV == '' || data.managerPCV == null) delete x[0].personInformation.accessAssignment.managerViewPayCodeName
    if ( data.managerPCE == '' || data.managerPCE == null) delete x[0].personInformation.accessAssignment.managerPayCodeName
    if ( data.managerLCP == '' || data.managerLCP == null) delete x[0].personInformation.accessAssignment.managerLaborCategoryProfileName

    if ( data.cdataCSV == '' || data.cdataCSV == null) delete x[0].personInformation.customDataList


    if (data.timeZoneName == '') delete x[0].jobAssignment.jobAssignmentDetails.timeZoneName
    if (data.primAcctEffDt != '') x[0].jobAssignment.primaryLaborAccounts.effectiveDate = data.primAcctEffDt

    if (data.accessProfileName == '' || data.accessProfileName == null) delete x[0].personInformation.accessAssignment.accessProfileName
    if (data.preferenceProfileName == '' || data.preferenceProfileName == null) delete x[0].personInformation.accessAssignment.preferenceProfileName
    if (data.timeEntryTypeName == '' || data.timeEntryTypeName == null) {
        delete x[0].personInformation.accessAssignment.timeEntryTypeName
        delete x[0].personInformation.accessAssignment.timeEntryTypeEffectiveDate
    }

    if (Object.keys(x[0].personInformation.accessAssignment).length == 0) delete x[0].personInformation.accessAssignment

    if (data.deviceGroupName == '' || data.deviceGroupName == null) delete x[0].jobAssignment.jobAssignmentDetails.deviceGroupName
    if (data.badgeNumber == '' || data.badgeNumber == null) delete x[0].personInformation.badgeAssignments
}
console.log(x)
console.log(JSON.stringify(x))
return x 
            },
            //,data: [["998867","Muff","Quick Load","California","/Organization/United States/Metropolitan Plant/Machine Shop/Apprentice Welder","2018-09-20"]],
        },


        {

            'type_name': 'Accrual Profile Assignment',
            'apiUrl': '/v1/commons/persons/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Employee Number*',
                    name: 'personNum'
                },
                {
                    visible: true,
                    data: 'Accrual Profile*',
                    name: 'accrualProfile',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/accrual_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'EffectiveDate*',
                    name: 'hireDate'
                }],
'apiMap': function(data) {
x = 
[{"personIdentity": {
        "personNumber": data.personNum
    },    
    "personInformation": {    
	"person": {
            "accrualProfileName": data.accrualProfile,
            "accrualProfileEffectiveDate": data.hireDate
}}}]

return x
},},
//
{
            'type_name': 'Employment Terms',
            'apiUrl': '/v1/timekeeping/setup/employment_terms',
           'async': false,
            'cdata': [
                {
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Allow Schedule Inheritance',
                    name: 'ASI',
                    datasource: ["true","false"]
                },
                {
                    visible: true,
                    data: 'Pay Rule',
                    name: 'payRule',
                                    datasource: {
                        apiurl: '/v1/timekeeping/setup/payrules',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Accrual Profile',
                    name: 'accrualProfile',
                                   datasource: {
                        apiurl: '/v1/timekeeping/setup/accrual_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Holiday Profile',
                    name: 'holidayProfile'
                },
                                {
                    visible: true,
                    data: 'Cascade Profile',
                    name: 'cascadeProfile'
                },
                                {
                    visible: true,
                    data: 'Time Off Rule',
                    name: 'timeOffRule'
                },
                                {
                    visible: true,
                    data: 'WHD 1 Target Type',
                    name: 'targetAmountType1',
                                    datasource: ["SPECIFY_FIXED_AMOUNT", "CONTRACT_SCHEDULE_AMOUNT", "EMPLOYEE_SCHEDULE_AMOUNT"]
                },
                                {
                    visible: true,
                    data: 'WHD 1 Amount',
                    name: 'amount1'
                },
                                {
                    visible: true,
                    data: 'WHD 1 Date Pattern',
                    name: 'datePattern1'
                },
                                {
                    visible: true,
                    data: 'WHD 1 Tracking Pay Code',
                    name: 'payCode1',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                                {
                    visible: true,
                    data: 'WHD 1 Include in Genie?',
                    name: 'useInGenie1',
                                    datasource: ["true", "false"]
                },
                                {
                    visible: true,
                    data: 'WHD 2 Target Type',
                    name: 'targetAmountType2',
                                    datasource: ["SPECIFY_FIXED_AMOUNT", "CONTRACT_SCHEDULE_AMOUNT", "EMPLOYEE_SCHEDULE_AMOUNT"]
                },
                                {
                    visible: true,
                    data: 'WHD 2 Amount',
                    name: 'amount2'
                },
                                {
                    visible: true,
                    data: 'WHD 2 Date Pattern',
                    name: 'datePattern2'
                },
                                {
                    visible: true,
                    data: 'WHD 2 Tracking Pay Code',
                    name: 'payCode2',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'WHD 2 Include in Genie?',
                    name: 'useInGenie2',
                                    datasource: ["true", "false"]
                },
                {
                    visible: true,
                    data: 'WHD 3 Target Type',
                    name: 'targetAmountType3',
                                    datasource: ["SPECIFY_FIXED_AMOUNT", "CONTRACT_SCHEDULE_AMOUNT", "EMPLOYEE_SCHEDULE_AMOUNT"]
                },
                                {
                    visible: true,
                    data: 'WHD 3 Amount',
                    name: 'amount3'
                },
                                {
                    visible: true,
                    data: 'WHD 3 Date Pattern',
                    name: 'datePattern3'
                },
                                {
                    visible: true,
                    data: 'WHD 3 Tracking Pay Code',
                    name: 'payCode3',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'WHD 3 Include in Genie?',
                    name: 'useInGenie3',
                                    datasource: ["true", "false"]
                },
                                {
                    visible: true,
                    data: 'WHD 4 Target Type',
                    name: 'targetAmountType4',
                                    datasource: ["SPECIFY_FIXED_AMOUNT", "CONTRACT_SCHEDULE_AMOUNT", "EMPLOYEE_SCHEDULE_AMOUNT"]
                },
                                {
                    visible: true,
                    data: 'WHD 4 Amount',
                    name: 'amount4'
                },
                                {
                    visible: true,
                    data: 'WHD 4 Date Pattern',
                    name: 'datePattern4'
                },
                                {
                    visible: true,
                    data: 'WHD 4 Tracking Pay Code',
                    name: 'payCode4',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'WHD 4 Include in Genie?',
                    name: 'useInGenie4',
                                    datasource: ["true", "false"]
                },
                                {
                    visible: true,
                    data: 'WHD 5 Target Type',
                    name: 'targetAmountType5',
                                    datasource: ["SPECIFY_FIXED_AMOUNT", "CONTRACT_SCHEDULE_AMOUNT", "EMPLOYEE_SCHEDULE_AMOUNT"]
                },
                                {
                    visible: true,
                    data: 'WHD 5 Amount',
                    name: 'amount5'
                },
                                {
                    visible: true,
                    data: 'WHD 5 Date Pattern',
                    name: 'datePattern5'
                },
                                {
                    visible: true,
                    data: 'WHD 5 Tracking Pay Code',
                    name: 'payCode5',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'WHD 5 Include in Genie?',
                    name: 'useInGenie5',
                                    datasource: ["true", "false"]
                },
                {
                    visible: true,
                    data: 'Duration PayCode',
                    name: 'durationPC'
                },
                {
                    visible: true,
                    data: 'Duration Work Rule',
                    name: 'durationWR'
                }

                
                                                                
            ],
            'apiMap': function(data) {
                                                
                                                
          var y = {
  "allowsInheritance": data.ASI,
  "isActive": true,
  "name": data.name,
  "processType": "ENFORCE_END_DATE",
  "versions": {
    "employmentTermVersion": [
      {
        "accrualProfile": {
          "qualifier": data.accrualProfile
        },
        "durationPaycodes": {
            "termDurationPaycode": [
              {
                "payCode": {
                  "qualifier": data.durationPC
                },
                "workRule": {
                  "qualifier": data.durationWR
                }
              }
            ]
          },
           "cascadeProfile": {
          "qualifier": data.cascadeProfile
           },
              "timeOffRule": {
          "qualifier": data.timeOffRule
        },
              "holidayProfile": {
          "qualifier": data.holidayProfile
              },
        "endDate": "3000-01-01",
        "payRule": {
          "qualifier": data.payRule
        },
        "startDate": "1900-01-01",
        "workHours": {
          "workHourDef": [
            { "amount": data.amount1,
              "datePattern": data.datePattern1,
              "payCode": {
                "qualifier": data.payCode1
              },
              "targetAmountType": data.targetAmountType1,
              "useContractShift": false,
              "useInGenie": data.useInGenie1
            },
            { "amount": data.amount2,
            "datePattern": data.datePattern2,
            "payCode": {
              "qualifier": data.payCode2
            },
            "targetAmountType": data.targetAmountType2,
            "useContractShift": false,
            "useInGenie": data.useInGenie2
            },
            { "amount": data.amount3,
            "datePattern": data.datePattern3,
            "payCode": {
              "qualifier": data.payCode3
            },
            "targetAmountType": data.targetAmountType3,
            "useContractShift": false,
            "useInGenie": data.useInGenie3
            },
            { "amount": data.amount4,
            "datePattern": data.datePattern4,
            "payCode": {
              "qualifier": data.payCode4
            },
            "targetAmountType": data.targetAmountType4,
            "useContractShift": false,
            "useInGenie": data.useInGenie4
            },
            { "amount": data.amount5,
            "datePattern": data.datePattern5,
            "payCode": {
              "qualifier": data.payCode5
            },
            "targetAmountType": data.targetAmountType5,
            "useContractShift": false,
            "useInGenie": data.useInGenie5
            }

          ]
        }
      }
    ]
  }
}          

        if (data.targetAmountType1 == "CONTRACT_SCHEDULE_AMOUNT"){y.versions.employmentTermVersion[0].workHours.workHourDef[0].useContractShift = true}
        if (data.targetAmountType2 == "CONTRACT_SCHEDULE_AMOUNT"){y.versions.employmentTermVersion[0].workHours.workHourDef[1].useContractShift = true}
        if (data.targetAmountType3 == "CONTRACT_SCHEDULE_AMOUNT"){y.versions.employmentTermVersion[0].workHours.workHourDef[2].useContractShift = true}
        if (data.targetAmountType4 == "CONTRACT_SCHEDULE_AMOUNT"){y.versions.employmentTermVersion[0].workHours.workHourDef[3].useContractShift = true}
        if (data.targetAmountType5 == "CONTRACT_SCHEDULE_AMOUNT"){y.versions.employmentTermVersion[0].workHours.workHourDef[4].useContractShift = true}

        if (data.datePattern5 == '' || data.datePattern5 == null){y.versions.employmentTermVersion[0].workHours.workHourDef.splice(4,1) }
        if (data.datePattern4 == '' || data.datePattern4 == null){y.versions.employmentTermVersion[0].workHours.workHourDef.splice(3,1) }
        if (data.datePattern3 == '' || data.datePattern3 == null){y.versions.employmentTermVersion[0].workHours.workHourDef.splice(2,1) }
        if (data.datePattern2 == '' || data.datePattern2 == null){y.versions.employmentTermVersion[0].workHours.workHourDef.splice(1,1) }
        if (data.datePattern1 == '' || data.datePattern1 == null){y.versions.employmentTermVersion[0].workHours.workHourDef.splice(0,1) }

        if (data.accrualProfile == '' || data.accrualProfile == null){delete y.versions.employmentTermVersion[0].accrualProfile }
        if (data.cascadeProfile == '' || data.cascadeProfile == null){delete y.versions.employmentTermVersion[0].cascadeProfile }
        if (data.timeOffRule == '' || data.timeOffRule == null){delete y.versions.employmentTermVersion[0].timeOffRule }
        if (data.holidayProfile == '' || data.holidayProfile == null){delete y.versions.employmentTermVersion[0].holidayProfile}
        if (data.payRule == '' || data.payRule == null){delete y.versions.employmentTermVersion[0].payRule }

        if (data.durationPC =='' || data.durationPC == null){delete y.versions.employmentTermVersion[0].durationPaycodes}

                                x=y
                                console.log(x)

                //   
                                return x
            },            
        },



{

            'type_name': 'Organisational Rule Sets',
            'apiUrl': '/v1/scheduling/schedule_rule_sets',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Week Start Day',
                    name: 'weekStartDay'
                },
                {
                    visible: true,
                    data: 'Skills Severity',
                    name: 'skillSeverity',
		    datasource: ['WARNING','INFORMATIONAL']
                },
                {
                    visible: true,
                    data: 'Required Skills CSV',
                    name: 'requiredSkillsCSV'
                },
                {
                    visible: true,
                    data: 'Certs Severity',
                    name: 'certSeverity',
		    datasource: ['WARNING','INFORMATIONAL']
                },
                {
                    visible: true,
                    data: 'Required Certs CSV',
                    name: 'requiredCertsCSV'
                }
            ],
            'apiMap': function(d) {
         if (d.requiredSkillsCSV == null) d.requiredSkillsCSV = ''
         var entryArrRS = d.requiredSkillsCSV.split(',')
               var entryArrMapRS = entryArrRS.map(function(x,skillSeverity) {skillSeverity = d.skillSeverity
        return  {rule: {name: "ERULE_ORG_SKILL"},
                severity: {name: skillSeverity},ruleParameters: [
                    {ruleParameterType: {name: "ERPARAM_SKILL",localizedName: "Skill"},value: {reference: {qualifier: x }}},
                    {ruleParameterType: { name: "ERPARAM_FORBIDDEN",localizedName: "Is Forbidden"},value: {flag: false}}
                ]}})
                console.log(entryArrMapRS)
         if (d.requiredCertsCSV == null) d.requiredCertsCSV = ''
         var entryArrRC = d.requiredCertsCSV.split(',')
               var entryArrMapRC = entryArrRC.map(function(x,certSeverity) {certSeverity = d.certSeverity
        return  {rule: {name: "ERULE_ORG_CERTIFICATION"},
                severity: {name: certSeverity},ruleParameters: [
                    {ruleParameterType: {name: "ERPARAM_CERT",localizedName: "Certification"},value: {reference: {qualifier: x }}},
                    {ruleParameterType: { name: "ERPARAM_FORBIDDEN",localizedName: "Is Forbidden"},value: {flag: false}}
                ]}})
                console.log(entryArrMapRC)
                if(d.requiredSkillsCSV == null || d.requiredSkillsCSV == '') entryArrMapRS = []
                if(d.requiredCertsCSV == null || d.requiredCertsCSV == '') entryArrMapRC = []               
                var completedArray = entryArrMapRS.concat(entryArrMapRC)
                    console.log(completedArray)
                var y = 
    {
        "name": d.name,
        "description": d.description,
        "weekStartDay": {
            "name": d.weekStartDay
        },
        "useActualHours": false,
        "active": true,
        "ruleType": {
            "name": "SCHED_ORG_VAL_RULE"
        },
        "rules": completedArray
	}


                if (y.description == '') delete y.description
                if (y.entryArrMap == '') delete y.entryArrMap

                x = y
                return x
            }
        },


        {
            'type_name': 'Enable Edits',
            'apiUrl': '/v1/timekeeping/enable_edits/import',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                }

            ],
            'apiMap': function(d) {


                var y = 
{
    "employees": {
        "refs": [
            {
                "qualifier": d.personNumber
            }
        ]
    }
}

                x = y
                return x
            },
        },


{
            'type_name': 'Sign Off Previous Pay Period',
            'apiUrl': '/v1/timekeeping/timecard_signoffs?timeframe_id=0',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                }

            ],
            'apiMap': function(d) {


                var y = 
{
  "qualifier": d.personNumber
}

                x = y
                return x
            },
        },


        {
            'type_name': 'Terminate Employee',
            'apiUrl': '/v1/commons/persons/multi_upsert',
            'async': false,
            'cdata': [
                {
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Termination Date',
                    name: 'termDate'
                },
                


            ],
            'apiMap': function(d) {


                var y = 
                [
                    {
                        "personIdentity": {
                            "personNumber": d.personNumber
                        },
                        "personInformation": {
                            "employmentStatusList": [
                                {
                                    "effectiveDate": d.termDate ,
                                    "expirationDate": "3000-01-01",
                                    "employmentStatusName": "Terminated"
                                }
                            ],
                            "userAccountStatusList": [{
                                "effectiveDate": d.termDate,
                                "userAccountStatusName": "Terminated"
                            }],
                        }
                    }
                ]

                x = y
                return x
            },
        },

        {
            'type_name': 'Change Usernames',
            'apiUrl': '/v1/commons/persons/multi_upsert',
            'async': false,
            'cdata': [
                {
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'User Name',
                    name: 'userName'
                },
                


            ],
            'apiMap': function(d) {


                var y = 
                [
                    {
                        "personIdentity": {
                            "personNumber": d.personNumber
                        },
                        "user": {
                            "userAccount": {
                                "userName": d.userName
                    }
                }
            }
                ]

                x = y
                return x
            },
        },


{

            'type_name': 'Org Rule Set Location Assignment',
            'apiUrl': '/v1/scheduling/schedule_rule_sets/location_assignments/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name',
                    datasource: {
                        apiurl: '/v1/scheduling/schedule_rule_sets',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Organisational Path',
                    name: 'orgPath',

                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effDate'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'expDate'
                }
               
            ],
            'apiMap': function(d) {
         
              var y = 
    {
        "orgNode": {
            "qualifier": d.orgPath
        },
        "ruleSet": {
            "qualifier": d.name
        },
        "effectiveDate": d.effDate,
        "expirationDate": d.expDate
    }
console.log(JSON.stringify(y))
                x = y
                return x

            }
        },

   
        {
            'type_name': 'Delete Attendance Events',
            'apiUrl': '/v1/attendance/events',
	    'delete' : 'yes',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Attendance Event ID',
                    name: 'id'
                }

            ],
            'apiMap': function(d) {


                var y = d.id

                x = y
                return x
            },
        },


        {
            'type_name': 'Skills',
            'apiUrl': '/v1/scheduling/skills',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Abbreviation',
                    name: 'abbreviation'
                }

            ],
            'apiMap': function(d) {


                var y = {
                    "abbreviation": d.abbreviation,
                    "active": true,
                    "name": d.name
                }

                x = y
                return x
            },
        },
        {
            'type_name': 'Certifications',
            'apiUrl': '/v1/scheduling/certifications',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Abbreviation',
                    name: 'abbreviation'
                }

            ],
            'apiMap': function(d) {


                var y = {
                    "abbreviation": d.abbreviation,
                    "active": true,
                    "name": d.name
                }

                x = y
                return x
            },
        },
        {
            'type_name': 'Proficiency Levels',
            'apiUrl': '/v1/scheduling/proficiency_levels',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Level Number',
                    name: 'proficiencyLevelNumeric'
                }

            ],
            'apiMap': function(d) {


                var y = {
                    "active": true,
                    "description": d.description,
                    "proficiencyLevelNumeric": d.proficiencyLevelNumeric,
                    "name": d.name
                }
                x = y
                return x
            },
        },

{
            'type_name': 'PCVP Assignments',
            'apiUrl': '/v1/commons/persons/pay_code_value_profiles/multi_update',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'PCVP name',
                    name: 'name'
                }

            ],
            'apiMap': function(d) {


                var y = 
[
  {
    "payCodeValueProfile": {
      "qualifier": d.name
    },
    "personIdentity": {
      "personNumber": d.personNumber
    }
  }
]
                x = y
                return x
            },
        },

        {
            'type_name': 'Cascade Profile Assignments',
            'apiUrl': '/v1/commons/persons/cascade_profile/multi_update',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Cascade Profile Name',
                    name: 'name'
                }

            ],
            'apiMap': function(d) {


                var y = 
[
  {
    "assignmentProfile" :d.name,
    "personIdentity": {
      "personNumber": d.personNumber
    }
  }
]
                x = y
                return x
            },
        },

{
            'type_name': 'Schedule Rule Set Assignments',
            'apiUrl': '/v1/commons/persons/schedule_rule_sets/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Rule Set Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Start Date',
                    name: 'startDate'
                },
                {
                    visible: true,
                    data: 'End Date',
                    name: 'endDate'
                }

            ],
            'apiMap': function(d) {


                var y = 
[
  {
    "assignments": [
    	{
    "context": {
          "qualifier": "DEFAULT"
        },
      
        "effectiveDate": d.startDate,
        "expirationDate": d.endDate,
        "ruleSet": {
          "qualifier": d.name
        }
      }
    ],
    "personIdentity": {
      "personNumber": d.personNumber
    }
  }
]

if (d.endDate == '' || d.endDate == null) delete y[0].assignments[0].expirationDate
                x = y
                return x
            },
        },

        {

            'type_name': 'Organisational Sets',
            'apiUrl': '/v1/commons/location_sets?date=2019-01-01',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Type',
                    name: 'type',
                    datasource: ['All_Org_Groups', 'Manager_Org_Groups', 'Transfer_Org_Groups']
                },
                {
                    visible: true,
                    data: 'Business Structure Node Paths CSV',
                    name: 'bsNodePaths'
                }
            ],
            'apiMap': function(d) {

                var entryArr = d.bsNodePaths.split(',')
                var entryArrMap = entryArr.map(function(x) {
                    return {
                        qualifier: x
                    }
                })
                console.log(entryArrMap)

                var y = {
                    "name": d.name,
                    "description": d.description,

                    "nodeRefs": entryArrMap,

                    "typeId": d.type
                }

                if (y.description == '') delete y.description
                if (y.entryArrMap == '') delete y.entryArrMap
                if (d.type == '') y.typeId = 1
                if (d.type == 'All_Org_Groups') y.typeId = 1
                if (d.type == 'Manager_Org_Groups') y.typeId = 2
                if (d.type == 'Transfer_Org_Groups') y.typeId = 3

                x = y
                console.log(y)
                return x
            }
        },

        {

            'type_name': 'Update Organisational Sets',
            'apiUrl': '/v1/commons/location_sets/apply_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
               {
                    visible: true,
                    data: 'Type',
                    name: 'type',
                    datasource: ['All_Org_Groups', 'Manager_Org_Groups', 'Transfer_Org_Groups']
                },
                
                {
                    visible: true,
                    data: 'Nodes to Add',
                    name: 'bsNodePathsAdd'
                },                {
                    visible: true,
                    data: 'Nodes to Remove',
                    name: 'bsNodePaths'
                }
            ],
            'apiMap': function(d) {
                if (d.bsNodePaths != '' && d.bsNodePaths != null){
                var entryArr = d.bsNodePaths.split(',')
                var entryArrMap = entryArr.map(function(x) {
                    return {
                        id: x
                    }
                })
              }else entryArrMap = []  

                if (d.bsNodePathsAdd != '' && d.bsNodePathsAdd != null){
                var entryArr2 = d.bsNodePathsAdd.split(',')
                var entryArrMap2 = entryArr2.map(function(x) {
                    return {
                        id: x
                    }
                })
                console.log(entryArrMap2)
                }
                else entryArrMap2 = []
                var y = 
                [{
                    "name": d.name,
                    "description": d.description,
                    "addNodeRefs":entryArrMap2,
                    "removeNodeRefs": entryArrMap,
                    "effectiveOnDate":new Date().toISOString().split('T')[0],

                    "typeId": d.type
                }]

                if (y.description == '') delete y[0].description
                if (y.entryArrMap == '') delete y[0].entryArrMap
                if (d.entryArrMap == []){delete y[0].removeNodeRefs}
                if (d.entryArrMap2 == []){delete y[0].addNodeRefs}
                if (d.type == '') y[0].typeId = 1
                if (d.type == 'All_Org_Groups') y[0].typeId = 1
                if (d.type == 'Manager_Org_Groups') y[0].typeId = 2
                if (d.type == 'Transfer_Org_Groups') y[0].typeId = 3

                x = y
                console.log(y,JSON.stringify(y))
                return x
            }
        },

{
            'type_name': 'Skill Assignments',
            'apiUrl': '/v1/commons/persons/skills/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Skill',
                    name: 'skill',
		    datasource: {
                        apiurl: '/v1/scheduling/skills',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Proficiency Level',
                    name: 'proficiencyLevel',
		    datasource: {
                        apiurl: '/v1/scheduling/proficiency_levels',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Active',
                    name: 'active'
                }

            ],
            'apiMap': function(d) {


                var y = 
[
  {
    "assignments": [
      {
        "active": d.active,
        "effectiveDate": d.effectiveDate,
        "proficiencyLevel": {
          "qualifier": d.proficiencyLevel
        },
        "skill": {
          "qualifier": d.skill
        }
      }
    ],
    "personIdentity": {
      "personNumber": d.personNumber
    }
  }
]

if (d.active == '' || d.active == null) d.active = 'true'

                x = y
                return x
            },
        },

{
'type_name': 'Work - Activities',
'apiUrl': '/v1/work/activities/multi_upsert',
'data' : [["","","Example Jury Duty","Example Description","2020-03-01","Not Started","Never Held or Released",0,0,0,0,1,0,0,0,"Indirect","false","false","true","false","false","true","true","","Run","false","false","false","Low","All",1,1440,"Even Allocation","All",""]],
'cdata': [
{visible: true,data: 'Level',name: 'level'},
{visible: true,data: 'Parent',name: 'parent'},
{visible: true,data: 'Name',name: 'name'},
{visible: true,data: 'Description',name: 'description'},
{visible: true,data: 'Scheduled Start Date',name: 'scheduledStartDate'},
{visible: true,data: 'Complete Status',name: 'completeStatus'},
{visible: true,data: 'Held History',name: 'heldHistory'},
{visible: true,data: 'Required Qty',name: 'requiredQuantity'},
{visible: true,data: 'Completed Qty',name: 'completedQuantity'},
{visible: true,data: 'Moved Qty',name: 'movedQuantity'},
{visible: true,data: 'Received Qty',name: 'receivedQuantity'},
{visible: true,data: 'Automatic Move Multiplier',name: 'autoMoveMultiQuantity'},
{visible: true,data: 'Scrapped Qty',name: 'scrappedQuantity'},
{visible: true,data: 'Moved to Rework Qty',name: 'movedToReworkQuantity'},
{visible: true,data: 'Unaccounted Qty',name: 'unaccountedQuantity'},
{visible: true,data: 'Activity Type',name: 'activityType'},
{visible: true,data: 'Include Scrapped Qty',name: 'isIncludedScrappedQuantity'},
{visible: true,data: 'Include Reworked Qty',name: 'isIncludedReworkedQuantity'},
{visible: true,data: 'Extend completion status',name: 'isExtendedCompletionStatus'},
{visible: true,data: 'Hold Parent',name: 'isHoldParent'},
{visible: true,data: 'Enable Auto Moves',name: 'isAutoMoves'},
{visible: true,data: 'Allow Start Before',name: 'canBeStartedBeforeStartDate'},
{visible: true,data: 'Allow Start After',name: 'canBeStartedAfterEndDate'},
{visible: true,data: 'Customer',name: 'customer', datasource: {apiurl: '/v1/work/customers',tag: 'name'}},
{visible: true,data: 'Process Type',name: 'processType'},
{visible: true,data: 'Can Be Default',name: 'canBeDefault'},
{visible: true,data: 'Excl Seq Validation',name: 'isExcludedFromSequenceValidation'},
{visible: true,data: 'Milestone?',name: 'isMilestone'},
{visible: true,data: 'Priority',name: 'priorityType'},
{visible: true,data: 'Lab Hours Allc Type',name: 'laborHoursAllocationType'},
{visible: true,data: 'Min Duration',name: 'minDurationAmount'},
{visible: true,data: 'Max Duration',name: 'maxDurationAmount'},
{visible: true,data: 'Lab Quant Allc Type',name: 'laborQuantityAllocationType'},
{visible: true,data: 'Data Access Type',name: 'dataAccessType'},
{visible: true,data: 'Results Template',name: 'relatedResultTemplate', datasource: {apiurl: '/v1/work/results_templates',tag: 'name'}},
{visible: true,data: 'User Field 1',name: 'userField1'},
{visible: true,data: 'User Field 2',name: 'userField2'},
{visible: true,data: 'User Field 3',name: 'userField3'},
{visible: true,data: 'User Field 4',name: 'userField4'},
{visible: true,data: 'Cost Center',name: 'costcenter', datasource:{apiurl:'/v1/commons/cost_centers',tag:'name'}},
{visible: true,data: 'LC Entry 1 Name',name: 'LCName1'},
{visible: true,data: 'LC Entry 1 Value',name: 'LCEntry1'},
{visible: true,data: 'LC Entry 2 Name',name: 'LCName2'},
{visible: true,data: 'LC Entry 2 Value',name: 'LCEntry2'},
{visible: true,data: 'LC Entry 3 Name',name: 'LCName3'},
{visible: true,data: 'LC Entry 3 Value',name: 'LCEntry3'},
{visible: true,data: 'LC Entry 4 Name',name: 'LCName4'},
{visible: true,data: 'LC Entry 4 Value',name: 'LCEntry4'},
{visible: true,data: 'LC Entry 5 Name',name: 'LCName5'},
{visible: true,data: 'LC Entry 5Value',name: 'LCEntry5'},
{visible: true,data: 'LC Entry 6 Name',name: 'LCName6'},
{visible: true,data: 'LC Entry 6 Value',name: 'LCEntry6'}
],
            'apiMap': function(d) {
                var y = 
{
        "name": d.name,
        "description": d.description,
        "transfer":{
            "costCenter":{"qualifier":d.costcenter},
            "laborCategories": [
                {"laborCategoryDef": {"qualifier": d.LCName1  }, "laborCategoryEntry": { "qualifier": d.LCEntry1 }},
                {"laborCategoryDef": {"qualifier": d.LCName2  }, "laborCategoryEntry": { "qualifier": d.LCEntry2 }},
                {"laborCategoryDef": {"qualifier": d.LCName3  }, "laborCategoryEntry": { "qualifier": d.LCEntry3 }},
                {"laborCategoryDef": {"qualifier": d.LCName4  }, "laborCategoryEntry": { "qualifier": d.LCEntry4 }},
                {"laborCategoryDef": {"qualifier": d.LCName5  }, "laborCategoryEntry": { "qualifier": d.LCEntry5 }},
                {"laborCategoryDef": {"qualifier": d.LCName6  }, "laborCategoryEntry": { "qualifier": d.LCEntry6 }}
              ]
        },
        "parent":{"qualifier":d.parent},
        "level":d.level,
        "scheduledStartDate": d.scheduledStartDate,
        "completeStatus": {
            "qualifier": d.completeStatus
        },
        "heldHistory": {
            "qualifier": d.heldHistory
        },
        "requiredQuantity": d.requiredQuantity,
        "completedQuantity": d.completedQuantity,
        "movedQuantity": d.movedQuantity,
        "receivedQuantity": d.receivedQuantity,
        "autoMoveMultiQuantity": d.autoMoveMultiQuantity,
        "scrappedQuantity": d.scrappedQuantity,
        "movedToReworkQuantity": d.movedToReworkQuantity,
        "unaccountedQuantity": d.unaccountedQuantity,
        "header": {
            "activityType": {
                "qualifier": d.activityType
            },
            "sequenceValidationType": {"qualifier": "none"},
            "isIncludedScrappedQuantity": d.isIncludedScrappedQuantity,
            "isIncludedReworkedQuantity": d.isIncludedReworkedQuantity,
            "isIncludedCompleteQuantity": 0,
            "isExtendedCompletionStatus": d.isExtendedCompletionStatus,
            "isHoldParent": d.isHoldParent,
            "isAutoMoves": d.isAutoMoves,
            "canBeStartedBeforeStartDate": d.canBeStartedBeforeStartDate,
            "canBeStartedAfterEndDate": d.canBeStartedAfterEndDate
        },
        "processType": {
            "qualifier": d.processType
        },
        "validateRequiredQuantity":false,
        "requiredVarianceOverPct":10,
        "validateReceivedQuantity":false,
        "completedPercent":0,
        "receivedVarianceOverPct":10,
        "canBeDefault": d.canBeDefault,
        "isExcludedFromSequenceValidation": d.isExcludedFromSequenceValidation,
        "isMilestone": d.isMilestone,
        "priorityType": {
            "qualifier": d.priorityType
        },
        "laborHoursAllocationType": {
            "qualifier": d.laborHoursAllocationType
        },
        "minDurationAmount": d.minDurationAmount * 60,
        "maxDurationAmount": d.maxDurationAmount * 60,
        "laborQuantityAllocationType": {
            "qualifier": d.laborQuantityAllocationType
        },
        "dataAccess": {
            "dataAccessType": {
                "qualifier": d.dataAccessType
            }
        },
        "relatedResultTemplate": {
            "qualifier": d.relatedResultTemplate
        },
        "userField1": d.userField1,
        "userField2": d.userField2,
        "userField3": d.userField3,
        "userField4": d.userField4,

    }



if (d.description == null || d.description == '') delete y.description
if (d.level == null || d.level == '') {delete y.level} else if (d.level > 1) {delete y.header}
if (d.costcenter == null || d.costcenter == '') {delete y.transfer.costCenter}
if (d.LCName6 == null || d.LCName6 == '') {y.transfer.laborCategories.splice(5,1)}
if (d.LCName5 == null || d.LCName5 == '') {y.transfer.laborCategories.splice(4,1)}
if (d.LCName4 == null || d.LCName4 == '') {y.transfer.laborCategories.splice(3,1)}
if (d.LCName3 == null || d.LCName3 == '') {y.transfer.laborCategories.splice(2,1)}
if (d.LCName2 == null || d.LCName2 == '') {y.transfer.laborCategories.splice(1,1)}
if (d.LCName1 == null || d.LCName1 == '') {y.transfer.laborCategories.splice(0,1)}
if (y.transfer.laborCategories.length === 0){delete y.transfer.laborCategories}

if (Object.values(y.transfer).length === 0){delete y.transfer}


if (d.parent == null || d.parent == '') delete y.parent
if (d.completeStatus == null || d.completeStatus == '') delete y.completeStatus
if (d.heldHistory == null || d.heldHistory == '') delete y.heldHistory
if (d.requiredQuantity == null || d.requiredQuantity == '') delete y.requiredQuantity
if (d.completedQuantity == null || d.completedQuantity == '') delete y.completedQuantity
if (d.movedQuantity == null || d.movedQuantity == '') delete y.movedQuantity
if (d.receivedQuantity == null || d.receivedQuantity == '') delete y.receivedQuantity
if (d.autoMoveMultiQuantity == null || d.autoMoveMultiQuantity == '') delete y.autoMoveMultiQuantity
if (d.scrappedQuantity == null || d.scrappedQuantity == '') delete y.scrappedQuantity
if (d.movedToReworkQuantity == null || d.movedToReworkQuantity == '') delete y.movedToReworkQuantity
if (d.unaccountedQuantity== null || d.unaccountedQuantity == '') delete y.unaccountedQuantity
if (d.isIncludedScrappedQuantity == null || d.isIncludedScrappedQuantity == '') delete y.isIncludedScrappedQuantity
if (d.isIncludedReworkedQuantity == null || d.isIncludedReworkedQuantity == '') delete y.isIncludedReworkedQuantity
if (d.isExtendedCompletionStatus== null || d.isExtendedCompletionStatus == '') delete y.isExtendedCompletionStatus
if (d.isHoldParent == null || d.isHoldParent == '') delete y.isHoldParent
if (d.isAutoMoves== null || d.isAutoMoves == '') delete y.isAutoMoves
if (d.canBeStartedBeforeStartDate == null || d.canBeStartedBeforeStartDate == '') delete y.canBeStartedBeforeStartDate
if (d.canBeStartedAfterEndDate == null || d.canBeStartedAfterEndDate == '') delete y.canBeStartedAfterEndDate
if (d.customer == null || d.customer == '') delete y.customer
if (d.canBeDefault == null || d.canBeDefault == '') delete y.canBeDefault
if (d.isExcludedFromSequenceValidation == null || d.isExcludedFromSequenceValidation== '') delete y.isExcludedFromSequenceValidation
if (d.isMilestone == null || d.isMilestone == '') delete y.isMilestone
if (d.priorityType == null || d.priorityType == '') delete y.priorityType
if (d.laborHoursAllocationType == null || d.laborHoursAllocationType == '') delete y.laborHoursAllocationType
if (d.minDurationAmount == null || d.minDurationAmount == '') delete y.minDurationAmount
if (d.maxDurationAmount == null || d.maxDurationAmount == '') delete y.maxDurationAmount
if (d.laborQuantityAllocationType == null || d.laborQuantityAllocationType == '') delete y.laborQuantityAllocationType
if (d.dataAccessType == null || d.dataAccessType== '') delete y.dataAccess
if (d.relatedResultTemplate == null || d.relatedResultTemplate == '') delete y.relatedResultTemplate
if (d.userField1 == null || d.userField1== '') delete y.userField1
if (d.userField2 == null || d.userField2== '') delete y.userField2
if (d.userField3 == null || d.userField3== '') delete y.userField3
if (d.userField4 == null || d.userField4== '') delete y.userField4
if (d.userField4 == null || d.userField4== '') delete y.userField4


                x = [y]
                console.log(y)
                return x
            }
        },

        
{
    'type_name': 'Work - Update Activities',
    'apiUrl': '/v1/work/activities/multi_update',
    'data' : [["","","Example Jury Duty","Example Description","2020-03-01","Not Started","Never Held or Released",0,0,0,0,1,0,0,0,"Indirect","false","false","true","false","false","true","true","","Run","false","false","false","Low","All",1,1440,"Even Allocation","All",""]],
    'cdata': [
    {visible: true,data: 'Level',name: 'level'},
    {visible: true,data: 'Parent',name: 'parent'},
    {visible: true,data: 'Name',name: 'name'},
    {visible: true,data: 'Description',name: 'description'},
    {visible: true,data: 'Scheduled Start Date',name: 'scheduledStartDate'},
    {visible: true,data: 'Complete Status',name: 'completeStatus'},
    {visible: true,data: 'Held History',name: 'heldHistory'},
    {visible: true,data: 'Required Qty',name: 'requiredQuantity'},
    {visible: true,data: 'Completed Qty',name: 'completedQuantity'},
    {visible: true,data: 'Moved Qty',name: 'movedQuantity'},
    {visible: true,data: 'Received Qty',name: 'receivedQuantity'},
    {visible: true,data: 'Automatic Move Multiplier',name: 'autoMoveMultiQuantity'},
    {visible: true,data: 'Scrapped Qty',name: 'scrappedQuantity'},
    {visible: true,data: 'Moved to Rework Qty',name: 'movedToReworkQuantity'},
    {visible: true,data: 'Unaccounted Qty',name: 'unaccountedQuantity'},
    {visible: true,data: 'Activity Type',name: 'activityType'},
    {visible: true,data: 'Include Scrapped Qty',name: 'isIncludedScrappedQuantity'},
    {visible: true,data: 'Include Reworked Qty',name: 'isIncludedReworkedQuantity'},
    {visible: true,data: 'Extend completion status',name: 'isExtendedCompletionStatus'},
    {visible: true,data: 'Hold Parent',name: 'isHoldParent'},
    {visible: true,data: 'Enable Auto Moves',name: 'isAutoMoves'},
    {visible: true,data: 'Allow Start Before',name: 'canBeStartedBeforeStartDate'},
    {visible: true,data: 'Allow Start After',name: 'canBeStartedAfterEndDate'},
    {visible: true,data: 'Customer',name: 'customer', datasource: {apiurl: '/v1/work/customers',tag: 'name'}},
    {visible: true,data: 'Process Type',name: 'processType'},
    {visible: true,data: 'Can Be Default',name: 'canBeDefault'},
    {visible: true,data: 'Excl Seq Validation',name: 'isExcludedFromSequenceValidation'},
    {visible: true,data: 'Milestone?',name: 'isMilestone'},
    {visible: true,data: 'Priority',name: 'priorityType'},
    {visible: true,data: 'Lab Hours Allc Type',name: 'laborHoursAllocationType'},
    {visible: true,data: 'Min Duration',name: 'minDurationAmount'},
    {visible: true,data: 'Max Duration',name: 'maxDurationAmount'},
    {visible: true,data: 'Lab Quant Allc Type',name: 'laborQuantityAllocationType'},
    {visible: true,data: 'Data Access Type',name: 'dataAccessType'},
    {visible: true,data: 'Results Template',name: 'relatedResultTemplate', datasource: {apiurl: '/v1/work/results_templates',tag: 'name'}},
    {visible: true,data: 'User Field 1',name: 'userField1'},
    {visible: true,data: 'User Field 2',name: 'userField2'},
    {visible: true,data: 'User Field 3',name: 'userField3'},
    {visible: true,data: 'User Field 4',name: 'userField4'},
    {visible: true,data: 'Cost Center',name: 'costcenter', datasource:{apiurl:'/v1/commons/cost_centers',tag:'name'}},
    {visible: true,data: 'LC Entry 1 Name',name: 'LCName1'},
    {visible: true,data: 'LC Entry 1 Value',name: 'LCEntry1'},
    {visible: true,data: 'LC Entry 2 Name',name: 'LCName2'},
    {visible: true,data: 'LC Entry 2 Value',name: 'LCEntry2'},
    {visible: true,data: 'LC Entry 3 Name',name: 'LCName3'},
    {visible: true,data: 'LC Entry 3 Value',name: 'LCEntry3'},
    {visible: true,data: 'LC Entry 4 Name',name: 'LCName4'},
    {visible: true,data: 'LC Entry 4 Value',name: 'LCEntry4'},
    {visible: true,data: 'LC Entry 5 Name',name: 'LCName5'},
    {visible: true,data: 'LC Entry 5Value',name: 'LCEntry5'},
    {visible: true,data: 'LC Entry 6 Name',name: 'LCName6'},
    {visible: true,data: 'LC Entry 6 Value',name: 'LCEntry6'}
    ],
                'apiMap': function(d) {
                    var y = 
    {
            "name": d.name,
            "description": d.description,
            "transfer":{
                "costCenter":{"qualifier":d.costcenter},
                "laborCategories": [
                    {"laborCategoryDef": {"qualifier": d.LCName1  }, "laborCategoryEntry": { "qualifier": d.LCEntry1 }},
                    {"laborCategoryDef": {"qualifier": d.LCName2  }, "laborCategoryEntry": { "qualifier": d.LCEntry2 }},
                    {"laborCategoryDef": {"qualifier": d.LCName3  }, "laborCategoryEntry": { "qualifier": d.LCEntry3 }},
                    {"laborCategoryDef": {"qualifier": d.LCName4  }, "laborCategoryEntry": { "qualifier": d.LCEntry4 }},
                    {"laborCategoryDef": {"qualifier": d.LCName5  }, "laborCategoryEntry": { "qualifier": d.LCEntry5 }},
                    {"laborCategoryDef": {"qualifier": d.LCName6  }, "laborCategoryEntry": { "qualifier": d.LCEntry6 }}
                  ]
            },
            "parent":{"qualifier":d.parent},
            "level":d.level,
            "scheduledStartDate": d.scheduledStartDate,
            "completeStatus": {
                "qualifier": d.completeStatus
            },
            "heldHistory": {
                "qualifier": d.heldHistory
            },
            "requiredQuantity": d.requiredQuantity,
            "completedQuantity": d.completedQuantity,
            "movedQuantity": d.movedQuantity,
            "receivedQuantity": d.receivedQuantity,
            "autoMoveMultiQuantity": d.autoMoveMultiQuantity,
            "scrappedQuantity": d.scrappedQuantity,
            "movedToReworkQuantity": d.movedToReworkQuantity,
            "unaccountedQuantity": d.unaccountedQuantity,
            "header": {
                "activityType": {
                    "qualifier": d.activityType
                },
                "sequenceValidationType": {"qualifier": "none"},
                "isIncludedScrappedQuantity": d.isIncludedScrappedQuantity,
                "isIncludedReworkedQuantity": d.isIncludedReworkedQuantity,
                "isIncludedCompleteQuantity": 0,
                "isExtendedCompletionStatus": d.isExtendedCompletionStatus,
                "isHoldParent": d.isHoldParent,
                "isAutoMoves": d.isAutoMoves,
                "canBeStartedBeforeStartDate": d.canBeStartedBeforeStartDate,
                "canBeStartedAfterEndDate": d.canBeStartedAfterEndDate
            },
            "processType": {
                "qualifier": d.processType
            },
            "validateRequiredQuantity":false,
            "requiredVarianceOverPct":10,
            "validateReceivedQuantity":false,
            "completedPercent":0,
            "receivedVarianceOverPct":10,
            "canBeDefault": d.canBeDefault,
            "isExcludedFromSequenceValidation": d.isExcludedFromSequenceValidation,
            "isMilestone": d.isMilestone,
            "priorityType": {
                "qualifier": d.priorityType
            },
            "laborHoursAllocationType": {
                "qualifier": d.laborHoursAllocationType
            },
            "minDurationAmount": d.minDurationAmount * 60,
            "maxDurationAmount": d.maxDurationAmount * 60,
            "laborQuantityAllocationType": {
                "qualifier": d.laborQuantityAllocationType
            },
            "dataAccess": {
                "dataAccessType": {
                    "qualifier": d.dataAccessType
                }
            },
            "relatedResultTemplate": {
                "qualifier": d.relatedResultTemplate
            },
            "userField1": d.userField1,
            "userField2": d.userField2,
            "userField3": d.userField3,
            "userField4": d.userField4,
    
        }
    
    
    
    if (d.description == null || d.description == '') delete y.description
    if (d.level == null || d.level == '') {delete y.level} else if (d.level > 1) {delete y.header}
    if (d.costcenter == null || d.costcenter == '') {delete y.transfer.costCenter}
    if (d.LCName6 == null || d.LCName6 == '') {y.transfer.laborCategories.splice(5,1)}
    if (d.LCName5 == null || d.LCName5 == '') {y.transfer.laborCategories.splice(4,1)}
    if (d.LCName4 == null || d.LCName4 == '') {y.transfer.laborCategories.splice(3,1)}
    if (d.LCName3 == null || d.LCName3 == '') {y.transfer.laborCategories.splice(2,1)}
    if (d.LCName2 == null || d.LCName2 == '') {y.transfer.laborCategories.splice(1,1)}
    if (d.LCName1 == null || d.LCName1 == '') {y.transfer.laborCategories.splice(0,1)}
    if (y.transfer.laborCategories.length === 0){delete y.transfer.laborCategories}
    
    if (Object.values(y.transfer).length === 0){delete y.transfer}
    
    
    if (d.parent == null || d.parent == '') delete y.parent
    if (d.completeStatus == null || d.completeStatus == '') delete y.completeStatus
    if (d.heldHistory == null || d.heldHistory == '') delete y.heldHistory
    if (d.requiredQuantity == null || d.requiredQuantity == '') delete y.requiredQuantity
    if (d.completedQuantity == null || d.completedQuantity == '') delete y.completedQuantity
    if (d.movedQuantity == null || d.movedQuantity == '') delete y.movedQuantity
    if (d.receivedQuantity == null || d.receivedQuantity == '') delete y.receivedQuantity
    if (d.autoMoveMultiQuantity == null || d.autoMoveMultiQuantity == '') delete y.autoMoveMultiQuantity
    if (d.scrappedQuantity == null || d.scrappedQuantity == '') delete y.scrappedQuantity
    if (d.movedToReworkQuantity == null || d.movedToReworkQuantity == '') delete y.movedToReworkQuantity
    if (d.unaccountedQuantity== null || d.unaccountedQuantity == '') delete y.unaccountedQuantity
    if (d.isIncludedScrappedQuantity == null || d.isIncludedScrappedQuantity == '') delete y.isIncludedScrappedQuantity
    if (d.isIncludedReworkedQuantity == null || d.isIncludedReworkedQuantity == '') delete y.isIncludedReworkedQuantity
    if (d.isExtendedCompletionStatus== null || d.isExtendedCompletionStatus == '') delete y.isExtendedCompletionStatus
    if (d.isHoldParent == null || d.isHoldParent == '') delete y.isHoldParent
    if (d.isAutoMoves== null || d.isAutoMoves == '') delete y.isAutoMoves
    if (d.canBeStartedBeforeStartDate == null || d.canBeStartedBeforeStartDate == '') delete y.canBeStartedBeforeStartDate
    if (d.canBeStartedAfterEndDate == null || d.canBeStartedAfterEndDate == '') delete y.canBeStartedAfterEndDate
    if (d.customer == null || d.customer == '') delete y.customer
    if (d.canBeDefault == null || d.canBeDefault == '') delete y.canBeDefault
    if (d.isExcludedFromSequenceValidation == null || d.isExcludedFromSequenceValidation== '') delete y.isExcludedFromSequenceValidation
    if (d.isMilestone == null || d.isMilestone == '') delete y.isMilestone
    if (d.priorityType == null || d.priorityType == '') delete y.priorityType
    if (d.laborHoursAllocationType == null || d.laborHoursAllocationType == '') delete y.laborHoursAllocationType
    if (d.minDurationAmount == null || d.minDurationAmount == '') delete y.minDurationAmount
    if (d.maxDurationAmount == null || d.maxDurationAmount == '') delete y.maxDurationAmount
    if (d.laborQuantityAllocationType == null || d.laborQuantityAllocationType == '') delete y.laborQuantityAllocationType
    if (d.dataAccessType == null || d.dataAccessType== '') delete y.dataAccess
    if (d.relatedResultTemplate == null || d.relatedResultTemplate == '') delete y.relatedResultTemplate
    if (d.userField1 == null || d.userField1== '') delete y.userField1
    if (d.userField2 == null || d.userField2== '') delete y.userField2
    if (d.userField3 == null || d.userField3== '') delete y.userField3
    if (d.userField4 == null || d.userField4== '') delete y.userField4
    if (d.userField4 == null || d.userField4== '') delete y.userField4
    
    
                    x = [y]
                    console.log(y)
                    return x
                }
            },


{
            'type_name': 'Certification Assignments',
            'apiUrl': '/v1/commons/persons/certifications/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Certification',
                    name: 'certification',
		    datasource: {
                        apiurl: '/v1/scheduling/certifications',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Number',
                    name: 'certificationNumber'
                },
                {
                    visible: true,
                    data: 'Proficiency Level',
                    name: 'proficiencyLevel',
		    datasource: {
                        apiurl: '/v1/scheduling/proficiency_levels',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'expirationDate'
                },
               /* {
                    visible: true,
                    data: 'Active',
                    name: 'active'
                }*/

            ],
            'apiMap': function(d) {


                var y = 
[
  {
    "assignments": [
      {
        //"active": d.active,
        "certificationNumber":d.certificationNumber,
        "effectiveDate": d.effectiveDate,
        "expirationDate": d.expirationDate,
        "proficiencyLevel": {
          "qualifier": d.proficiencyLevel
        },
        "certification": {
          "qualifier": d.certification
        }
      }
    ],
    "personIdentity": {
      "personNumber": d.personNumber
    }
  }
]

//if (d.active == '' || d.active == null) d.active = 'true'
if (d.certificationNumber == '' || d.certificationNumber == null){delete y[0].assignments[0].certificationNumber}

                x = y
                return x
            },
        },






        {

            'type_name': 'Labor Category Profiles',
            'apiUrl': '/v1/commons/labor_category_profiles/multi_create',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Labor Category List 1',
                    name: 'laborCategoryList1',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_lists',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Labor Category List 2',
                    name: 'laborCategoryList2',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_lists',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Labor Category List 3',
                    name: 'laborCategoryList3',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_lists',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Labor Category List 4',
                    name: 'laborCategoryList4',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_lists',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Labor Category List 5',
                    name: 'laborCategoryList5',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_lists',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Labor Category List 6',
                    name: 'laborCategoryList6',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_lists',
                        tag: 'name'
                    }
                },


            ],
            'apiMap': function(d) {
                console.log('what')
                var y = {
                    "name": d.name,
                    "description": d.description,
                    "entryLists": []
                }



                if (d.description == '') delete y.description

                if (d.laborCategoryList1 !== '' && d.laborCategoryList1 != null) y.entryLists.push({
                    "name": d.laborCategoryList1
                })
                if (d.laborCategoryList2 !== '' && d.laborCategoryList2 != null) y.entryLists.push({
                    "name": d.laborCategoryList2
                })
                if (d.laborCategoryList3 !== '' && d.laborCategoryList3 != null) y.entryLists.push({
                    "name": d.laborCategoryList3
                })
                if (d.laborCategoryList4 !== '' && d.laborCategoryList4 != null) y.entryLists.push({
                    "name": d.laborCategoryList4
                })
                if (d.laborCategoryList5 !== '' && d.laborCategoryList5 != null) y.entryLists.push({
                    "name": d.laborCategoryList5
                })
                if (d.laborCategoryList6 !== '' && d.laborCategoryList6 != null) y.entryLists.push({
                    "name": d.laborCategoryList6
                })

                x = y
                console.log(y)
                return x
            }
        },
{
            'type_name': 'Delete E-Term/Group Schedule Patterns',
            'apiUrl': '/v1/scheduling/employment_term_schedule_patterns/apply_update?partial_success=true',
            'async': false,
            'cdata': [ 
		{ visible: true, data: 'E-term/Group', name: 'name',datasource: { apiurl: '/v1/timekeeping/setup/employment_terms?partial_success=true', tag: 'name'}},
                {
                    visible: true,
                    data: 'Start Date',
                    name: 'startDate'
                },
                {
                    visible: true,
                    data: 'End Date',
                    name: 'endDate'
                },

            ],
            'apiMap': function(d) {


                var y =  
		{"removeByGroups": {
    		"do": {
      			"startDate": d.startDate,
      			"endDate": d.endDate },
     		"where": {
      			"groupRefs": [{"qualifier": d.name}]
		}}}

                x = y
                return x
            },
        },

{

            'type_name': 'Employee Schedule Patterns',
            'apiUrl': '/v1/scheduling/employee_schedule_patterns/apply_create?partial_success=true',
            'async': false,
            'cdata': [
 { visible: true, data: 'Person Number', name: 'name'},
 { visible: true, data: 'Start Date', name: 'startDate' },
 { visible: true, data: 'End Date', name: 'endDate' },
 { visible: true, data: 'Pattern Name', name: 'patternName' },
 { visible: true, data: 'Time Period Type', name: 'timePeriodType' },
 { visible: true, data: 'Day Count', name: 'dayCount' },
 { visible: true, data: 'Anchor Date', name: 'anchorDate' },
 { visible: true, data: 'StartOnDayNo', name: 'startDateOffset' },
 { visible: true, data: 'Override', name: 'override' ,datasource:['true','false']},
 { visible: true, data: 'Day 1', name: 'Day1' },
 { visible: true, data: 'Day 2', name: 'Day2' },
 { visible: true, data: 'Day 3', name: 'Day3' },
 { visible: true, data: 'Day 4', name: 'Day4' },
 { visible: true, data: 'Day 5', name: 'Day5' },
 { visible: true, data: 'Day 6', name: 'Day6' },
 { visible: true, data: 'Day 7', name: 'Day7' },
 { visible: true, data: 'Day 8', name: 'Day8' },
 { visible: true, data: 'Day 9', name: 'Day9' },
 { visible: true, data: 'Day 10', name: 'Day10' },
 { visible: true, data: 'Day 11', name: 'Day11' },
 { visible: true, data: 'Day 12', name: 'Day12' },
 { visible: true, data: 'Day 13', name: 'Day13' },
 { visible: true, data: 'Day 14', name: 'Day14' },
 { visible: true, data: 'Day 15', name: 'Day15' },
 { visible: true, data: 'Day 16', name: 'Day16' },
 { visible: true, data: 'Day 17', name: 'Day17' },
 { visible: true, data: 'Day 18', name: 'Day18' },
 { visible: true, data: 'Day 19', name: 'Day19' },
 { visible: true, data: 'Day 20', name: 'Day20' },
 { visible: true, data: 'Day 21', name: 'Day21' },
 { visible: true, data: 'Day 22', name: 'Day22' },
 { visible: true, data: 'Day 23', name: 'Day23' },
 { visible: true, data: 'Day 24', name: 'Day24' },
 { visible: true, data: 'Day 25', name: 'Day25' },
 { visible: true, data: 'Day 26', name: 'Day26' },
 { visible: true, data: 'Day 27', name: 'Day27' },
 { visible: true, data: 'Day 28', name: 'Day28' },
 { visible: true, data: 'Day 29', name: 'Day29' },
 { visible: true, data: 'Day 30', name: 'Day30' },
 { visible: true, data: 'Day 31', name: 'Day31' },
 { visible: true, data: 'Day 32', name: 'Day32' },
 { visible: true, data: 'Day 33', name: 'Day33' },
 { visible: true, data: 'Day 34', name: 'Day34' },
 { visible: true, data: 'Day 35', name: 'Day35' },
 { visible: true, data: 'Day 36', name: 'Day36' },
 { visible: true, data: 'Day 37', name: 'Day37' },
 { visible: true, data: 'Day 38', name: 'Day38' },
 { visible: true, data: 'Day 39', name: 'Day39' },
 { visible: true, data: 'Day 40', name: 'Day40' },
 { visible: true, data: 'Day 41', name: 'Day41' },
 { visible: true, data: 'Day 42', name: 'Day42' },
 { visible: true, data: 'Day 43', name: 'Day43' },
 { visible: true, data: 'Day 44', name: 'Day44' },
 { visible: true, data: 'Day 45', name: 'Day45' },
 { visible: true, data: 'Day 46', name: 'Day46' },
 { visible: true, data: 'Day 47', name: 'Day47' },
 { visible: true, data: 'Day 48', name: 'Day48' },
 { visible: true, data: 'Day 49', name: 'Day49' },
 { visible: true, data: 'Day 50', name: 'Day50' },
 { visible: true, data: 'Day 51', name: 'Day51' },
 { visible: true, data: 'Day 52', name: 'Day52' },
 { visible: true, data: 'Day 53', name: 'Day53' },
 { visible: true, data: 'Day 54', name: 'Day54' },
 { visible: true, data: 'Day 55', name: 'Day55' },
 { visible: true, data: 'Day 56', name: 'Day56' },
 { visible: true, data: 'Day 57', name: 'Day57' },
 { visible: true, data: 'Day 58', name: 'Day58' },
 { visible: true, data: 'Day 59', name: 'Day59' },
 { visible: true, data: 'Day 60', name: 'Day60' },
 { visible: true, data: 'Day 61', name: 'Day61' },
 { visible: true, data: 'Day 62', name: 'Day62' },
 { visible: true, data: 'Day 63', name: 'Day63' },
 { visible: true, data: 'Day 64', name: 'Day64' },
 { visible: true, data: 'Day 65', name: 'Day65' },
 { visible: true, data: 'Day 66', name: 'Day66' },
 { visible: true, data: 'Day 67', name: 'Day67' },
 { visible: true, data: 'Day 68', name: 'Day68' },
 { visible: true, data: 'Day 69', name: 'Day69' },
 { visible: true, data: 'Day 70', name: 'Day70' },
 { visible: true, data: 'Day 71', name: 'Day71' },
 { visible: true, data: 'Day 72', name: 'Day72' },
 { visible: true, data: 'Day 73', name: 'Day73' },
 { visible: true, data: 'Day 74', name: 'Day74' },
 { visible: true, data: 'Day 75', name: 'Day75' },
 { visible: true, data: 'Day 76', name: 'Day76' },
 { visible: true, data: 'Day 77', name: 'Day77' },
 { visible: true, data: 'Day 78', name: 'Day78' },
 { visible: true, data: 'Day 79', name: 'Day79' },
 { visible: true, data: 'Day 80', name: 'Day80' },
 { visible: true, data: 'Day 81', name: 'Day81' },
 { visible: true, data: 'Day 82', name: 'Day82' },
 { visible: true, data: 'Day 83', name: 'Day83' },
 { visible: true, data: 'Day 84', name: 'Day84' },
 { visible: true, data: 'Day 85', name: 'Day85' },
 { visible: true, data: 'Day 86', name: 'Day86' },
 { visible: true, data: 'Day 87', name: 'Day87' },
 { visible: true, data: 'Day 88', name: 'Day88' },
 { visible: true, data: 'Day 89', name: 'Day89' },
 { visible: true, data: 'Day 90', name: 'Day90' },
 { visible: true, data: 'Day 91', name: 'Day91' },
 { visible: true, data: 'Day 92', name: 'Day92' },
 { visible: true, data: 'Day 93', name: 'Day93' },
 { visible: true, data: 'Day 94', name: 'Day94' },
 { visible: true, data: 'Day 95', name: 'Day95' },
 { visible: true, data: 'Day 96', name: 'Day96' },
 { visible: true, data: 'Day 97', name: 'Day97' },
 { visible: true, data: 'Day 98', name: 'Day98' },
 { visible: true, data: 'Day 99', name: 'Day99' },
 { visible: true, data: 'Day 100', name: 'Day100' },
 { visible: true, data: 'Day 101', name: 'Day101' },
 { visible: true, data: 'Day 102', name: 'Day102' },
 { visible: true, data: 'Day 103', name: 'Day103' },
 { visible: true, data: 'Day 104', name: 'Day104' },
 { visible: true, data: 'Day 105', name: 'Day105' },
 { visible: true, data: 'Day 106', name: 'Day106' },
 { visible: true, data: 'Day 107', name: 'Day107' },
 { visible: true, data: 'Day 108', name: 'Day108' },
 { visible: true, data: 'Day 109', name: 'Day109' },
 { visible: true, data: 'Day 110', name: 'Day110' },
 { visible: true, data: 'Day 111', name: 'Day111' },
 { visible: true, data: 'Day 112', name: 'Day112' }
 ],
'apiMap': function(data) {

var NewArray = []
//var data = ["testpi2","description","timeperiood","daycount","startdate","test","Test","","test","test","test","","test","test","","test"]
var entryArr = Object.values(data)
//console.log('dum')
console.log(entryArr)
//console.log(JSON.stringify(entryArr))
               var entryArrMap = entryArr.map(function(x,index) {
				   console.log(x)
				  if (x != '' && x != null){
				   y = 
				[
				  {"day": index-8 , 
					"availabilityTemplate":{
					"systemGenerated": true,
					   "segments":[
						{
						"availabilityType":
							{"qualifier":x.split('|')[1]},
						 "startTime":"00:00",
						 "endTime":"24:00"
						}
						]
						}
				  	}
					,
					{"day": index-8 , 
						"shiftTemplate":
						{"name": 
							x.split('|')[0]}
					}
				]				   	
				   if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'A' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_AVAILABLE"}
					else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'U' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_UNAVAILABLE"}
					else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'PA' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_PREFERRED_AVAILABLE"}
                    else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'PU' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_PREFERRED_UNAVAILABLE"}
                    else {delete y[0]}
                console.log(y[1].shiftTemplate.name)
                if (y[1].shiftTemplate.name == '' || y[1].shiftTemplate.name == null){delete y[1]}

                function bouncer(array) {
                    return array.filter(function(e) {
                      return e;
                    });
                  }
                  

                y = bouncer(y)


			}
				   
				   	else {y = 'wrong'}
                    console.log(y)
                    
				   return y
                  })
		
var objKeys = entryArrMap
for (var i = 9; i < objKeys.length; i++) {
	for (var y = 0; y < (entryArrMap)[i].length; y++) {
	if ((entryArrMap)[i] != 'wrong') {
        NewArray.push(       
          entryArrMap[i][y]);
    }
  }
}

var y = 



{
  "employeeSchedulePatterns": {
    "do": {
      "employeeSchedulePatternCreates": [
        {
          "employeeSchedulePattern": {
	    "startDate": data.startDate,
            "endDate": data.endDate,
            "startDateOffset":data.startDateOffset-1,

            "employeeRef": {
              "qualifier": data.name
            },

      "schedulePattern": {
        "timePeriodType": {
            "name": data.timePeriodType
        },
        "dayCount": data.dayCount,
        "startDate": data.anchorDate,
        "items": NewArray,
	    "name": data.patternName

					}
				},"override":data.override
			}]
		}
	}
}

if (data.patternName == '' || data.patternName == null) y.employeeSchedulePatterns.do.employeeSchedulePatternCreates[0].employeeSchedulePattern.schedulePattern.name = data.startDate + '-' + data.endDate
if (data.override == '' || data.override == null)y.employeeSchedulePatterns.do.employeeSchedulePatternCreates[0].override = true

console.log(y.employeeSchedulePatterns.do.employeeSchedulePatternCreates[0].employeeSchedulePattern.schedulePattern.name)




//console.log(y)
console.log(JSON.stringify(y))

	x=y
	return x

            }
        },

        
{

    'type_name': 'Employee Schedule Patterns Shift Times',
    'apiUrl': '/v1/scheduling/employee_schedule_patterns/apply_create?partial_success=true',
    'async': false,
    'cdata': [
{ visible: true, data: 'Person Number', name: 'name'},
{ visible: true, data: 'Start Date', name: 'startDate' },
{ visible: true, data: 'End Date', name: 'endDate' },
{ visible: true, data: 'Pattern Name', name: 'patternName' },
{ visible: true, data: 'Time Period Type', name: 'timePeriodType' },
{ visible: true, data: 'Day Count', name: 'dayCount' },
{ visible: true, data: 'Anchor Date', name: 'anchorDate' },
{ visible: true, data: 'StartOnDayNo', name: 'startDateOffset' },
{ visible: true, data: 'Day 1', name: 'Day1' },
{ visible: true, data: 'Day 2', name: 'Day2' },
{ visible: true, data: 'Day 3', name: 'Day3' },
{ visible: true, data: 'Day 4', name: 'Day4' },
{ visible: true, data: 'Day 5', name: 'Day5' },
{ visible: true, data: 'Day 6', name: 'Day6' },
{ visible: true, data: 'Day 7', name: 'Day7' },
{ visible: true, data: 'Day 8', name: 'Day8' },
{ visible: true, data: 'Day 9', name: 'Day9' },
{ visible: true, data: 'Day 10', name: 'Day10' },
{ visible: true, data: 'Day 11', name: 'Day11' },
{ visible: true, data: 'Day 12', name: 'Day12' },
{ visible: true, data: 'Day 13', name: 'Day13' },
{ visible: true, data: 'Day 14', name: 'Day14' },
{ visible: true, data: 'Day 15', name: 'Day15' },
{ visible: true, data: 'Day 16', name: 'Day16' },
{ visible: true, data: 'Day 17', name: 'Day17' },
{ visible: true, data: 'Day 18', name: 'Day18' },
{ visible: true, data: 'Day 19', name: 'Day19' },
{ visible: true, data: 'Day 20', name: 'Day20' },
{ visible: true, data: 'Day 21', name: 'Day21' },
{ visible: true, data: 'Day 22', name: 'Day22' },
{ visible: true, data: 'Day 23', name: 'Day23' },
{ visible: true, data: 'Day 24', name: 'Day24' },
{ visible: true, data: 'Day 25', name: 'Day25' },
{ visible: true, data: 'Day 26', name: 'Day26' },
{ visible: true, data: 'Day 27', name: 'Day27' },
{ visible: true, data: 'Day 28', name: 'Day28' },
{ visible: true, data: 'Day 29', name: 'Day29' },
{ visible: true, data: 'Day 30', name: 'Day30' },
{ visible: true, data: 'Day 31', name: 'Day31' },
{ visible: true, data: 'Day 32', name: 'Day32' },
{ visible: true, data: 'Day 33', name: 'Day33' },
{ visible: true, data: 'Day 34', name: 'Day34' },
{ visible: true, data: 'Day 35', name: 'Day35' },
{ visible: true, data: 'Day 36', name: 'Day36' },
{ visible: true, data: 'Day 37', name: 'Day37' },
{ visible: true, data: 'Day 38', name: 'Day38' },
{ visible: true, data: 'Day 39', name: 'Day39' },
{ visible: true, data: 'Day 40', name: 'Day40' },
{ visible: true, data: 'Day 41', name: 'Day41' },
{ visible: true, data: 'Day 42', name: 'Day42' },
{ visible: true, data: 'Day 43', name: 'Day43' },
{ visible: true, data: 'Day 44', name: 'Day44' },
{ visible: true, data: 'Day 45', name: 'Day45' },
{ visible: true, data: 'Day 46', name: 'Day46' },
{ visible: true, data: 'Day 47', name: 'Day47' },
{ visible: true, data: 'Day 48', name: 'Day48' },
{ visible: true, data: 'Day 49', name: 'Day49' },
{ visible: true, data: 'Day 50', name: 'Day50' },
{ visible: true, data: 'Day 51', name: 'Day51' },
{ visible: true, data: 'Day 52', name: 'Day52' },
{ visible: true, data: 'Day 53', name: 'Day53' },
{ visible: true, data: 'Day 54', name: 'Day54' },
{ visible: true, data: 'Day 55', name: 'Day55' },
{ visible: true, data: 'Day 56', name: 'Day56' },
{ visible: true, data: 'Day 57', name: 'Day57' },
{ visible: true, data: 'Day 58', name: 'Day58' },
{ visible: true, data: 'Day 59', name: 'Day59' },
{ visible: true, data: 'Day 60', name: 'Day60' },
{ visible: true, data: 'Day 61', name: 'Day61' },
{ visible: true, data: 'Day 62', name: 'Day62' },
{ visible: true, data: 'Day 63', name: 'Day63' },
{ visible: true, data: 'Day 64', name: 'Day64' },
{ visible: true, data: 'Day 65', name: 'Day65' },
{ visible: true, data: 'Day 66', name: 'Day66' },
{ visible: true, data: 'Day 67', name: 'Day67' },
{ visible: true, data: 'Day 68', name: 'Day68' },
{ visible: true, data: 'Day 69', name: 'Day69' },
{ visible: true, data: 'Day 70', name: 'Day70' },
{ visible: true, data: 'Day 71', name: 'Day71' },
{ visible: true, data: 'Day 72', name: 'Day72' },
{ visible: true, data: 'Day 73', name: 'Day73' },
{ visible: true, data: 'Day 74', name: 'Day74' },
{ visible: true, data: 'Day 75', name: 'Day75' },
{ visible: true, data: 'Day 76', name: 'Day76' },
{ visible: true, data: 'Day 77', name: 'Day77' },
{ visible: true, data: 'Day 78', name: 'Day78' },
{ visible: true, data: 'Day 79', name: 'Day79' },
{ visible: true, data: 'Day 80', name: 'Day80' },
{ visible: true, data: 'Day 81', name: 'Day81' },
{ visible: true, data: 'Day 82', name: 'Day82' },
{ visible: true, data: 'Day 83', name: 'Day83' },
{ visible: true, data: 'Day 84', name: 'Day84' },
{ visible: true, data: 'Day 85', name: 'Day85' },
{ visible: true, data: 'Day 86', name: 'Day86' },
{ visible: true, data: 'Day 87', name: 'Day87' },
{ visible: true, data: 'Day 88', name: 'Day88' },
{ visible: true, data: 'Day 89', name: 'Day89' },
{ visible: true, data: 'Day 90', name: 'Day90' },
{ visible: true, data: 'Day 91', name: 'Day91' },
{ visible: true, data: 'Day 92', name: 'Day92' },
{ visible: true, data: 'Day 93', name: 'Day93' },
{ visible: true, data: 'Day 94', name: 'Day94' },
{ visible: true, data: 'Day 95', name: 'Day95' },
{ visible: true, data: 'Day 96', name: 'Day96' },
{ visible: true, data: 'Day 97', name: 'Day97' },
{ visible: true, data: 'Day 98', name: 'Day98' },
{ visible: true, data: 'Day 99', name: 'Day99' },
{ visible: true, data: 'Day 100', name: 'Day100' },
{ visible: true, data: 'Day 101', name: 'Day101' },
{ visible: true, data: 'Day 102', name: 'Day102' },
{ visible: true, data: 'Day 103', name: 'Day103' },
{ visible: true, data: 'Day 104', name: 'Day104' },
{ visible: true, data: 'Day 105', name: 'Day105' },
{ visible: true, data: 'Day 106', name: 'Day106' },
{ visible: true, data: 'Day 107', name: 'Day107' },
{ visible: true, data: 'Day 108', name: 'Day108' },
{ visible: true, data: 'Day 109', name: 'Day109' },
{ visible: true, data: 'Day 110', name: 'Day110' },
{ visible: true, data: 'Day 111', name: 'Day111' },
{ visible: true, data: 'Day 112', name: 'Day112' }
],
'apiMap': function(data) {

var NewArray = []
//var data = ["testpi2","description","timeperiood","daycount","startdate","test","Test","","test","test","test","","test","test","","test"]
var entryArr = Object.values(data)
//console.log('dum')
console.log(entryArr)
//console.log(JSON.stringify(entryArr))
       var entryArrMap = entryArr.map(function(x,index) {
           console.log(x)
          if (x != '' && x != null){
            ShiftStart = x.split('|')[0].split('-')[0]
            ShiftEnd =  x.split('|')[0].split('-')[1]
            if (ShiftEnd < ShiftStart){DayOffset = 2}else {DayOffset = 1}

           y = 
        [
          {"day": index-7 , 
            "availabilityTemplate":{
            "systemGenerated": true,
               "segments":[
                {
                "availabilityType":
                    {"qualifier":x.split('|')[1]},
                 "startTime":"00:00",
                 "endTime":"24:00"
                }
                ]
                }
              }
            ,
            {"day": index-7 , 
                "shiftTemplate":
                {
                    
                    "endDateTime": "1900-01-0"+DayOffset+"T"+ShiftEnd,
                    "startDateTime": "1900-01-01T"+ShiftStart,
                    "systemGenerated":true,
                    "segments":[
                        {
                            "segmentType":{"qualifier":"REGULAR_SEGMENT"},
                            "endDateTime": "1900-01-0"+DayOffset+"T"+ShiftEnd,
                            "startDateTime": "1900-01-01T"+ShiftStart,
                        }
                    ],
                    "label":"Imported"
                              
                
                
                }
            }
        ]				   	
           if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'A' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_AVAILABLE"}
            else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'U' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_UNAVAILABLE"}
            else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'PA' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_PREFERRED_AVAILABLE"}
            else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'PU' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_PREFERRED_UNAVAILABLE"}
            else {delete y[0]}
        console.log(y[1].shiftTemplate.name)
        if (y[1].shiftTemplate.endDateTime == '' || y[1].shiftTemplate.endDateTime == null){delete y[1]}

        function bouncer(array) {
            return array.filter(function(e) {
              return e;
            });
          }
          

        y = bouncer(y)


    }
           
               else {y = 'wrong'}
            console.log(y)
            
           return y
          })

var objKeys = entryArrMap
for (var i = 8; i < objKeys.length; i++) {
for (var y = 0; y < (entryArrMap)[i].length; y++) {
if ((entryArrMap)[i] != 'wrong') {
NewArray.push(       
  entryArrMap[i][y]);
}
}
}

var y = 



{
"employeeSchedulePatterns": {
"do": {
"employeeSchedulePatternCreates": [
{
  "employeeSchedulePattern": {
"startDate": data.startDate,
    "endDate": data.endDate,
    "startDateOffset":data.startDateOffset-1,

    "employeeRef": {
      "qualifier": data.name
    },

"schedulePattern": {
"timePeriodType": {
    "name": data.timePeriodType
},
"dayCount": data.dayCount,
"startDate": data.anchorDate,
"items": NewArray,
"name": data.patternName

            }
        },"override":true
    }]
}
}
}

if (data.patternName == '' || data.patternName == null) y.employeeSchedulePatterns.do.employeeSchedulePatternCreates[0].employeeSchedulePattern.schedulePattern.name = data.startDate + '-' + data.endDate


console.log(y.employeeSchedulePatterns.do.employeeSchedulePatternCreates[0].employeeSchedulePattern.schedulePattern.name)




//console.log(y)
console.log(JSON.stringify(y))

x=y
return x

    }
},



{

            'type_name': 'E-Term/Group Schedule Patterns',
            'apiUrl': '/v1/scheduling/employment_term_schedule_patterns/apply_create?partial_success=true',
            'async': false,
            'cdata': [
 { visible: true, data: 'E-term/Group', name: 'name',datasource: { apiurl: '/v1/timekeeping/setup/employment_terms', tag: 'name'}},
 { visible: true, data: 'Start Date', name: 'startDate' },
 { visible: true, data: 'End Date', name: 'endDate' },
 { visible: true, data: 'Pattern Name', name: 'patternName' },
 { visible: true, data: 'Time Period Type', name: 'timePeriodType' },
 { visible: true, data: 'Day Count', name: 'dayCount' },
 { visible: true, data: 'Anchor Date', name: 'anchorDate' },
 { visible: true, data: 'StartOnDayNo', name: 'startDateOffset' },
 { visible: true, data: 'Day 1', name: 'Day1' },
 { visible: true, data: 'Day 2', name: 'Day2' },
 { visible: true, data: 'Day 3', name: 'Day3' },
 { visible: true, data: 'Day 4', name: 'Day4' }, 
 { visible: true, data: 'Day 5', name: 'Day5' },
 { visible: true, data: 'Day 6', name: 'Day6' },
 { visible: true, data: 'Day 7', name: 'Day7' },
 { visible: true, data: 'Day 8', name: 'Day8' },
 { visible: true, data: 'Day 9', name: 'Day9' },
 { visible: true, data: 'Day 10', name: 'Day10' },
 { visible: true, data: 'Day 11', name: 'Day11' },
 { visible: true, data: 'Day 12', name: 'Day12' },
 { visible: true, data: 'Day 13', name: 'Day13' },
 { visible: true, data: 'Day 14', name: 'Day14' },
 { visible: true, data: 'Day 15', name: 'Day15' },
 { visible: true, data: 'Day 16', name: 'Day16' },
 { visible: true, data: 'Day 17', name: 'Day17' },
 { visible: true, data: 'Day 18', name: 'Day18' },
 { visible: true, data: 'Day 19', name: 'Day19' },
 { visible: true, data: 'Day 20', name: 'Day20' },
 { visible: true, data: 'Day 21', name: 'Day21' },
 { visible: true, data: 'Day 22', name: 'Day22' },
 { visible: true, data: 'Day 23', name: 'Day23' },
 { visible: true, data: 'Day 24', name: 'Day24' },
 { visible: true, data: 'Day 25', name: 'Day25' },
 { visible: true, data: 'Day 26', name: 'Day26' },
 { visible: true, data: 'Day 27', name: 'Day27' },
 { visible: true, data: 'Day 28', name: 'Day28' },
 { visible: true, data: 'Day 29', name: 'Day29' },
 { visible: true, data: 'Day 30', name: 'Day30' },
 { visible: true, data: 'Day 31', name: 'Day31' },
 { visible: true, data: 'Day 32', name: 'Day32' },
 { visible: true, data: 'Day 33', name: 'Day33' },
 { visible: true, data: 'Day 34', name: 'Day34' },
 { visible: true, data: 'Day 35', name: 'Day35' },
 { visible: true, data: 'Day 36', name: 'Day36' },
 { visible: true, data: 'Day 37', name: 'Day37' },
 { visible: true, data: 'Day 38', name: 'Day38' },
 { visible: true, data: 'Day 39', name: 'Day39' },
 { visible: true, data: 'Day 40', name: 'Day40' },
 { visible: true, data: 'Day 41', name: 'Day41' },
 { visible: true, data: 'Day 42', name: 'Day42' },
 { visible: true, data: 'Day 43', name: 'Day43' },
 { visible: true, data: 'Day 44', name: 'Day44' },
 { visible: true, data: 'Day 45', name: 'Day45' },
 { visible: true, data: 'Day 46', name: 'Day46' },
 { visible: true, data: 'Day 47', name: 'Day47' },
 { visible: true, data: 'Day 48', name: 'Day48' },
 { visible: true, data: 'Day 49', name: 'Day49' },
 { visible: true, data: 'Day 50', name: 'Day50' },
 { visible: true, data: 'Day 51', name: 'Day51' },
 { visible: true, data: 'Day 52', name: 'Day52' },
 { visible: true, data: 'Day 53', name: 'Day53' },
 { visible: true, data: 'Day 54', name: 'Day54' },
 { visible: true, data: 'Day 55', name: 'Day55' },
 { visible: true, data: 'Day 56', name: 'Day56' },
 { visible: true, data: 'Day 57', name: 'Day57' },
 { visible: true, data: 'Day 58', name: 'Day58' },
 { visible: true, data: 'Day 59', name: 'Day59' },
 { visible: true, data: 'Day 60', name: 'Day60' },
 { visible: true, data: 'Day 61', name: 'Day61' },
 { visible: true, data: 'Day 62', name: 'Day62' },
 { visible: true, data: 'Day 63', name: 'Day63' },
 { visible: true, data: 'Day 64', name: 'Day64' },
 { visible: true, data: 'Day 65', name: 'Day65' },
 { visible: true, data: 'Day 66', name: 'Day66' },
 { visible: true, data: 'Day 67', name: 'Day67' },
 { visible: true, data: 'Day 68', name: 'Day68' },
 { visible: true, data: 'Day 69', name: 'Day69' },
 { visible: true, data: 'Day 70', name: 'Day70' },
 { visible: true, data: 'Day 71', name: 'Day71' },
 { visible: true, data: 'Day 72', name: 'Day72' },
 { visible: true, data: 'Day 73', name: 'Day73' },
 { visible: true, data: 'Day 74', name: 'Day74' },
 { visible: true, data: 'Day 75', name: 'Day75' },
 { visible: true, data: 'Day 76', name: 'Day76' },
 { visible: true, data: 'Day 77', name: 'Day77' },
 { visible: true, data: 'Day 78', name: 'Day78' },
 { visible: true, data: 'Day 79', name: 'Day79' },
 { visible: true, data: 'Day 80', name: 'Day80' },
 { visible: true, data: 'Day 81', name: 'Day81' },
 { visible: true, data: 'Day 82', name: 'Day82' },
 { visible: true, data: 'Day 83', name: 'Day83' },
 { visible: true, data: 'Day 84', name: 'Day84' },
 { visible: true, data: 'Day 85', name: 'Day85' },
 { visible: true, data: 'Day 86', name: 'Day86' },
 { visible: true, data: 'Day 87', name: 'Day87' },
 { visible: true, data: 'Day 88', name: 'Day88' },
 { visible: true, data: 'Day 89', name: 'Day89' },
 { visible: true, data: 'Day 90', name: 'Day90' },
 { visible: true, data: 'Day 91', name: 'Day91' },
 { visible: true, data: 'Day 92', name: 'Day92' },
 { visible: true, data: 'Day 93', name: 'Day93' },
 { visible: true, data: 'Day 94', name: 'Day94' },
 { visible: true, data: 'Day 95', name: 'Day95' },
 { visible: true, data: 'Day 96', name: 'Day96' },
 { visible: true, data: 'Day 97', name: 'Day97' },
 { visible: true, data: 'Day 98', name: 'Day98' },
 { visible: true, data: 'Day 99', name: 'Day99' },
 { visible: true, data: 'Day 100', name: 'Day100' },
 { visible: true, data: 'Day 101', name: 'Day101' },
 { visible: true, data: 'Day 102', name: 'Day102' },
 { visible: true, data: 'Day 103', name: 'Day103' },
 { visible: true, data: 'Day 104', name: 'Day104' },
 { visible: true, data: 'Day 105', name: 'Day105' },
 { visible: true, data: 'Day 106', name: 'Day106' },
 { visible: true, data: 'Day 107', name: 'Day107' },
 { visible: true, data: 'Day 108', name: 'Day108' },
 { visible: true, data: 'Day 109', name: 'Day109' },
 { visible: true, data: 'Day 110', name: 'Day110' },
 { visible: true, data: 'Day 111', name: 'Day111' },
 { visible: true, data: 'Day 112', name: 'Day112' }
 ],
'apiMap': function(data) {

var NewArray = []
//var data = ["testpi2","description","timeperiood","daycount","startdate","test","Test","","test","test","test","","test","test","","test"]
var entryArr = Object.values(data)
//console.log('dum')
//console.log(entryArr)
//console.log(JSON.stringify(entryArr))
               var entryArrMap = entryArr.map(function(x,index) {
                    return {day: index-7 , shiftTemplate:{name: x}}
                  })
var objKeys = entryArrMap
for (var i = 8; i < objKeys.length; i++) {
    if ((entryArrMap)[i].shiftTemplate.name != "" && (entryArrMap)[i].shiftTemplate.name != null) {
        NewArray.push(       
          entryArrMap[i]);
    }}

var y = 



{
  "groupSchedulePatterns": {
    "do": {
      "groupSchedulePatternCreates": [
        {
          "groupSchedulePattern": {
	    "startDate": data.startDate,
            "endDate": data.endDate,
            "startDateOffset":data.startDateOffset-1,

            "groupRef": {
              "qualifier": data.name
            },

      "schedulePattern": {
        "timePeriodType": {
            "name": data.timePeriodType
        },
        "dayCount": data.dayCount,
        "startDate": data.anchorDate,
        "items": NewArray,
	"name": data.patternName

					}
				},"override":true
			}]
		}
	}
}

if (data.patternName == '' || data.patternName == null) y.groupSchedulePatterns.do.groupSchedulePatternCreates[0].groupSchedulePattern.schedulePattern.name = data.startDate + '-' + data.endDate


console.log(y.groupSchedulePatterns.do.groupSchedulePatternCreates[0].groupSchedulePattern.schedulePattern.name)




//console.log(y)
console.log(JSON.stringify(y))

	x=y
	return x

            }
        },


        {
            'type_name': 'Import Volume',
            'apiUrl': '/v1/forecasting/actual_volume/import',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Site',
                    name: 'site'
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'As Of Date',
                    name: 'asOfDate'
                },
                {
                    visible: true,
                    data: 'Driver',
                    name: 'driver'
                },
                {
                    visible: true,
                    data: 'Label',
                    name: 'label'
                },
                { visible: true, data: 'T0000', name: 'T0000' },
                { visible: true, data: 'T0015', name: 'T0015' },
                { visible: true, data: 'T0030', name: 'T0030' },
                { visible: true, data: 'T0045', name: 'T0045' },
                { visible: true, data: 'T0100', name: 'T0100' },
                { visible: true, data: 'T0115', name: 'T0115' },
                { visible: true, data: 'T0130', name: 'T0130' },
                { visible: true, data: 'T0145', name: 'T0145' },
                { visible: true, data: 'T0200', name: 'T0200' },
                { visible: true, data: 'T0215', name: 'T0215' },
                { visible: true, data: 'T0230', name: 'T0230' },
                { visible: true, data: 'T0245', name: 'T0245' },
                { visible: true, data: 'T0300', name: 'T0300' },
                { visible: true, data: 'T0315', name: 'T0315' },
                { visible: true, data: 'T0330', name: 'T0330' },
                { visible: true, data: 'T0345', name: 'T0345' },
                { visible: true, data: 'T0400', name: 'T0400' },
                { visible: true, data: 'T0415', name: 'T0415' },
                { visible: true, data: 'T0430', name: 'T0430' },
                { visible: true, data: 'T0445', name: 'T0445' },
                { visible: true, data: 'T0500', name: 'T0500' },
                { visible: true, data: 'T0515', name: 'T0515' },
                { visible: true, data: 'T0530', name: 'T0530' },
                { visible: true, data: 'T0545', name: 'T0545' },
                { visible: true, data: 'T0600', name: 'T0600' },
                { visible: true, data: 'T0615', name: 'T0615' },
                { visible: true, data: 'T0630', name: 'T0630' },
                { visible: true, data: 'T0645', name: 'T0645' },
                { visible: true, data: 'T0700', name: 'T0700' },
                { visible: true, data: 'T0715', name: 'T0715' },
                { visible: true, data: 'T0730', name: 'T0730' },
                { visible: true, data: 'T0745', name: 'T0745' },
                { visible: true, data: 'T0800', name: 'T0800' },
                { visible: true, data: 'T0815', name: 'T0815' },
                { visible: true, data: 'T0830', name: 'T0830' },
                { visible: true, data: 'T0845', name: 'T0845' },
                { visible: true, data: 'T0900', name: 'T0900' },
                { visible: true, data: 'T0915', name: 'T0915' },
                { visible: true, data: 'T0930', name: 'T0930' },
                { visible: true, data: 'T0945', name: 'T0945' },
                { visible: true, data: 'T1000', name: 'T1000' },
                { visible: true, data: 'T1015', name: 'T1015' },
                { visible: true, data: 'T1030', name: 'T1030' },
                { visible: true, data: 'T1045', name: 'T1045' },
                { visible: true, data: 'T1100', name: 'T1100' },
                { visible: true, data: 'T1115', name: 'T1115' },
                { visible: true, data: 'T1130', name: 'T1130' },
                { visible: true, data: 'T1145', name: 'T1145' },
                { visible: true, data: 'T1200', name: 'T1200' },
                { visible: true, data: 'T1215', name: 'T1215' },
                { visible: true, data: 'T1230', name: 'T1230' },
                { visible: true, data: 'T1245', name: 'T1245' },
                { visible: true, data: 'T1300', name: 'T1300' },
                { visible: true, data: 'T1315', name: 'T1315' },
                { visible: true, data: 'T1330', name: 'T1330' },
                { visible: true, data: 'T1345', name: 'T1345' },
                { visible: true, data: 'T1400', name: 'T1400' },
                { visible: true, data: 'T1415', name: 'T1415' },
                { visible: true, data: 'T1430', name: 'T1430' },
                { visible: true, data: 'T1445', name: 'T1445' },
                { visible: true, data: 'T1500', name: 'T1500' },
                { visible: true, data: 'T1515', name: 'T1515' },
                { visible: true, data: 'T1530', name: 'T1530' },
                { visible: true, data: 'T1545', name: 'T1545' },
                { visible: true, data: 'T1600', name: 'T1600' },
                { visible: true, data: 'T1615', name: 'T1615' },
                { visible: true, data: 'T1630', name: 'T1630' },
                { visible: true, data: 'T1645', name: 'T1645' },
                { visible: true, data: 'T1700', name: 'T1700' },
                { visible: true, data: 'T1715', name: 'T1715' },
                { visible: true, data: 'T1730', name: 'T1730' },
                { visible: true, data: 'T1745', name: 'T1745' },
                { visible: true, data: 'T1800', name: 'T1800' },
                { visible: true, data: 'T1815', name: 'T1815' },
                { visible: true, data: 'T1830', name: 'T1830' },
                { visible: true, data: 'T1845', name: 'T1845' },
                { visible: true, data: 'T1900', name: 'T1900' },
                { visible: true, data: 'T1915', name: 'T1915' },
                { visible: true, data: 'T1930', name: 'T1930' },
                { visible: true, data: 'T1945', name: 'T1945' },
                { visible: true, data: 'T2000', name: 'T2000' },
                { visible: true, data: 'T2015', name: 'T2015' },
                { visible: true, data: 'T2030', name: 'T2030' },
                { visible: true, data: 'T2045', name: 'T2045' },
                { visible: true, data: 'T2100', name: 'T2100' },
                { visible: true, data: 'T2115', name: 'T2115' },
                { visible: true, data: 'T2130', name: 'T2130' },
                { visible: true, data: 'T2145', name: 'T2145' },
                { visible: true, data: 'T2200', name: 'T2200' },
                { visible: true, data: 'T2215', name: 'T2215' },
                { visible: true, data: 'T2230', name: 'T2230' },
                { visible: true, data: 'T2245', name: 'T2245' },
                { visible: true, data: 'T2300', name: 'T2300' },
                { visible: true, data: 'T2315', name: 'T2315' },
                { visible: true, data: 'T2330', name: 'T2330' },
                { visible: true, data: 'T2345', name: 'T2345' }

            ],
            'apiMap': function(d) {
                console.log(d)
                var entryArr = Object.values(d)
                console.log(entryArr)
                entryArr.splice(0,5)
                console.log(entryArr)
                var entryArrMap = entryArr.map(function(x,index) {
                        if (x != null && x != ""){return x} else {return "0"}
                })
                entryArrMap=entryArrMap.filter(function(e){return e})




                var y = {
                    "actualVolumes": [
                      {
                        "actualVolumesPerDay": [
                          {
                            "date": d.effectiveDate,
                            "intervalAmounts": entryArrMap.join(',')
                          }
                        ],
                        "driver": {
                          "qualifier": d.driver
                        },
                        "externalLabel": {
                          "qualifier": d.label
                        }
                      }
                    ],
                    "asOfDate": d.asOfDate,
                    "site": {
                      "qualifier": d.site
                    }
                  }

                x = y
                console.log(x)
                return x
            },
        },

        {
            'type_name': 'Delete Locations',
            'apiUrl': '/v1/commons/locations/multi_delete',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Node Reference',
                    name: 'node'
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                }

            ],
            'apiMap': function(d) {


                var y = {
  "where": {
    "forDate": d.effectiveDate,
    "nodes": [
      {
        "qualifier": d.node
      }
    ]
  }
}

                x = y
                //x = '{"accrualResets" :[' + y + '],"managerRole": true}'
                //   
                return x
            },
        },
        {
            'type_name': 'End Date Locations',
            'apiUrl': '/v1/commons/locations/multi_update',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Node ID',
                    name: 'node'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'expirationDate'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'FullName',
                    name: 'FullName'
                },
                {
                    visible: true,
                    data: 'ParentNode',
                    name: 'ParentNode'
                },
                {
                    visible: true,
                    data: 'NodeType',
                    name: 'nodeType'
                }

            ],
            'apiMap': function(d) {


                var y = [
                    {
                      "nodeId": d.node,
                      "lastRevision": true,
                      "effectiveDate":d.effectiveDate,
                      "expirationDate": d.expirationDate,
                      "fullName": d.fullName,
                      "name":d.fullName,

                      "orgNodeTypeRef":{"qualifier":d.nodeType},
                      "parentNodeRef":{"qualifier":d.ParentNode}
                    }
                  ]
                x = y
                //x = '{"accrualResets" :[' + y + '],"managerRole": true}'
                //   
                return x
            },
        },


        {
            'type_name': 'Accrual Resets',
            'apiUrl': '/v1/timekeeping/accruals/resets',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Employee Number',
                    name: 'employee'
                },
                {
                    visible: true,
                    data: 'Accrual Code Name',
                    name: 'accrualCode',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/accrual_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Accrual Type',
                    name: 'amountType',
                    datasource: ['DAY', 'HOUR']
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Amount',
                    name: 'amount'
                },
                {
                    visible: true,
                    data: 'Probation Amount',
                    name: 'probationAmount'
                }

            ],
            'apiMap': function(d) {


                var y = {
                    "accrualResets": [{
                        "accrualReset": {
                            "accrualCode": {
                                "qualifier": d.accrualCode
                            },
                            "amount": d.amount,
                            "amountType": d.amountType,
                            "effectiveDate": d.effectiveDate,
                            "employee": {
                                "qualifier": d.employee
                            },
                            "probationAmount": d.probationAmount
                        }
                    }],
                    "managerRole": true
                }

                if (y.probationAmount == '') y.probationAmount = 0
                if (y.amountType == 'Day') y.amountType = 'DAY'
                if (y.amountType == 'Hour') y.amountType = 'HOUR'
                x = y
                //x = '{"accrualResets" :[' + y + '],"managerRole": true}'
                //   
                return x
            },
        },


        {
            'type_name': 'Accrual Moves',
            'apiUrl': '/v1/timekeeping/accruals/moves',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Employee Number',
                    name: 'employee'
                },
                {
                    visible: true,
                    data: 'Move From Accrual Code Name',
                    name: 'accrualCode',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/accrual_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Move To Accrual Code Name',
                    name: 'toAccrualCode',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/accrual_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Amount Decimal',
                    name: 'amount'
                }
            ],
            'apiMap': function(d) {


                var y = 
{
  "accrualMoves": [
    {
      "amount": d.amount,
      "effectiveDate": d.effectiveDate,
      "employee": {
        "qualifier": d.employee
      },
      "fromAccrualCode": {
        "qualifier": d.accrualCode
      },
      "toAccrualCode": {
        "qualifier": d.toAccrualCode
      }
    }
  ],
  "managerRole": true
}

               x = y
                //x = '{"accrualResets" :[' + y + '],"managerRole": true}'
                //   
                return x
            },
        },

        {
            'type_name': 'Business Structure',
            'apiUrl': '/v1/commons/locations',
            'async': false,
            'allowableErrors': [{
                errorCode: 'WCO-103011',
                errorColor: 'blue',
                errorMessage: 'The node has previously been loaded'
            }],
            'cdata': [{
                    visible: true,
                    data: 'Location Type',
                    name: 'orgNodeTypeRef',
                    datasource: {
                        apiurl: '/v1/commons/location_types/multi_read',
                        tag: 'name',
                        pdata: {
                            "where": {
                                "span": {
                                    "context": "ORG",
                                    "endDate": "3000-01-01",
                                    "startDate": "1900-01-01"
                                }
                            }
                        }
                    }
                },
                {
                    visible: true,
                    data: 'Parent Path',
                    name: 'parentNodeRef'
                },
                {
                    visible: true,
                    data: 'Location Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Full Name',
                    name: 'fullName'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'expirationDate'
                },
                {
                    visible: true,
                    data: 'Address',
                    name: 'address'
                },
                {
                    visible: true,
                    data: 'Cost Center',
                    name: 'costCenterRef'
                }, //datasource:{apiurl:'/v1/commons/cost_centers',tag:'name'}
                {
                    visible: true,
                    data: 'Direct Work Percent',
                    name: 'directWorkPercent'
                },
                {
                    visible: true,
                    data: 'Indirect Work Percent',
                    name: 'indirectWorkPercent'
                },
                {
                    visible: true,
                    data: 'Time Zone',
                    name: 'timezoneRef'
                },
                {
                    visible: true,
                    data: 'Transferable',
                    name: 'transferable'
                },
                {
                    visible: true,
                    data: 'Currency Name',
                    name: 'currencyRef',
                    datasource: {
                        apiurl: '/v1/commons/currency/policies',
                        tag: 'currencyCode'
                    }
                },
                {
                    visible: true,
                    data: 'External ID',
                    name: 'externalID'
                },
                //          { visible:true,  data: 'Time Zone', name: 'timezoneRef' ,datasource:{apiurl:'/v1/commons/timezones',tag:'name'}},
                {
                    visible: false,
                    data: 'contextRef',
                    name: 'contextRef'
                },
                {
                    visible: false,
                    data: 'firstRevision',
                    name: 'firstRevision'
                },
                {
                    visible: false,
                    data: 'lastRevision',
                    name: 'lastRevision'
                },
                {
                    visible: false,
                    data: 'Generic Job',
                    name: 'genericJobRef'
                }


            ],
            'apiMap': function(d) {

                transferable = false
                if (d.transferable) {
                    //TODO: NEED TO CHANGE TO start with (VS IN STRING)
                    if (d.transferable.toUpperCase().indexOf('T') > -1) transferable = true
                }
                var x = {
                    //"nodeId": 1,
                    "address": d.address,
                    "indirectWorkPercent": d.indirectWorkPercent,
                    "timezoneRef": {
                        "qualifier": d.timezoneRef
                    },
                    "parentNodeRef": {
                        "qualifier": d.parentNodeRef
                    },
                    "orgNodeTypeRef": {
                        "qualifier": d.orgNodeTypeRef
                    },
                    "name": d.name,
                    "lastRevision": 'false',
                    "genericJobRef": {
                        "qualifier": d.genericJobRef
                    },
                    "contextRef": {
                        "qualifier": "ORG"
                    },
                    "fullName": d.fullName,
                    "firstRevision": 'false',
                    "externalId": d.externalID,
                    "expirationDate": dateAdjust(d.expirationDate),
                    "effectiveDate": dateAdjust(d.effectiveDate),
                    "directWorkPercent": d.directWorkPercent,
                    "description": d.description,
                    "currencyRef": {
                        "qualifier": d.currencyRef
                    },
                    "costCenterRef": {
                        "qualifier": d.costCenterRef
                    },
                    "transferable": transferable,
                }

                if (x.parentNodeRef.qualifier == '') x.parentNodeRef.qualifier = '/'
                if ((!x.timezoneRef.qualifier)) delete x['timezoneRef']
                if ((!x.externalID == '')) delete x['externalID']
                if ((!x.currencyRef.qualifier)) delete x['currencyRef']
                if ((!x.costCenterRef.qualifier)) delete x['costCenterRef']

                if (x.orgNodeTypeRef.qualifier == 'Job') {
                    //console.log(x.orgNodeTypeRef,'up')
                    if ((!x.genericJobRef.qualifier)) x.genericJobRef.qualifier = x.name
                    delete x['address']
                    if (x.timezoneRef) delete x['timezoneRef']
                    delete x['costCenterRef']
                } else {
                    //console.log(x.orgNodeTypeRef,'down')
                    delete x['genericJobRef']
                }


                //TODO: CHECK TO SEE IF CERTAIN FIELDS ARE NULL not passing if null
                return x
            },
            'sorter': function(a, b) {

                a = a.api.parentNodeRef.qualifier + a.api.name
                b = b.api.parentNodeRef.qualifier + b.api.name


                if (!a) a = ''
                if (!b) b = ''

                a = a.split("/").length - 1
                b = b.split("/").length - 1

                return a - b
            },
            'removeExisting': {
                datasource: {
                    apiurl: '/v1/commons/locations/multi_read',
                    pdata: {
                        "where": {
                            "descendantsOf": {
                                "context": "ORG",
                                "date": new Date().toISOString().split('T')[0],
                                "locationRef": {
                                    "qualifier": "/"
                                }
                            }
                        }
                    }
                },
                curDataPoint: function(o) {
                    return o.parentNodeRef.qualifier + '/' + o.name
                },
                stgDataPoint: function(o) {
                    return o.parentNodeRef.qualifier + '/' + o.name
                }
            }
            //,'data' : [['Company','/','Muff Quick Load','','Muff Quick Load','1900-01-01','3000-01-01','8209 Ehlerbrook Rd.','CC_Production','','','Eastern','']]   
        },



{

            'type_name': 'Schedule Pattern Templates',
            'apiUrl': '/v1/scheduling/schedule_pattern_templates',
            'async': false,
            'cdata': [
 { visible: true, data: 'Name', name: 'name' },
 { visible: true, data: 'Description', name: 'description' },
 { visible: true, data: 'Time Period Type', name: 'timePeriodType' },
 { visible: true, data: 'Day Count', name: 'dayCount' },
 { visible: true, data: 'Anchor Date', name: 'anchorDate' },
 { visible: true, data: 'Day 1', name: 'Day1' },
 { visible: true, data: 'Day 2', name: 'Day2' },
 { visible: true, data: 'Day 3', name: 'Day3' },
 { visible: true, data: 'Day 4', name: 'Day4' },
 { visible: true, data: 'Day 5', name: 'Day5' },
 { visible: true, data: 'Day 6', name: 'Day6' },
 { visible: true, data: 'Day 7', name: 'Day7' },
 { visible: true, data: 'Day 8', name: 'Day8' },
 { visible: true, data: 'Day 9', name: 'Day9' },
 { visible: true, data: 'Day 10', name: 'Day10' },
 { visible: true, data: 'Day 11', name: 'Day11' },
 { visible: true, data: 'Day 12', name: 'Day12' },
 { visible: true, data: 'Day 13', name: 'Day13' },
 { visible: true, data: 'Day 14', name: 'Day14' },
 { visible: true, data: 'Day 15', name: 'Day15' },
 { visible: true, data: 'Day 16', name: 'Day16' },
 { visible: true, data: 'Day 17', name: 'Day17' },
 { visible: true, data: 'Day 18', name: 'Day18' },
 { visible: true, data: 'Day 19', name: 'Day19' },
 { visible: true, data: 'Day 20', name: 'Day20' },
 { visible: true, data: 'Day 21', name: 'Day21' },
 { visible: true, data: 'Day 22', name: 'Day22' },
 { visible: true, data: 'Day 23', name: 'Day23' },
 { visible: true, data: 'Day 24', name: 'Day24' },
 { visible: true, data: 'Day 25', name: 'Day25' },
 { visible: true, data: 'Day 26', name: 'Day26' },
 { visible: true, data: 'Day 27', name: 'Day27' },
 { visible: true, data: 'Day 28', name: 'Day28' },
 { visible: true, data: 'Day 29', name: 'Day29' },
 { visible: true, data: 'Day 30', name: 'Day30' },
 { visible: true, data: 'Day 31', name: 'Day31' },
 { visible: true, data: 'Day 32', name: 'Day32' },
 { visible: true, data: 'Day 33', name: 'Day33' },
 { visible: true, data: 'Day 34', name: 'Day34' },
 { visible: true, data: 'Day 35', name: 'Day35' },
 { visible: true, data: 'Day 36', name: 'Day36' },
 { visible: true, data: 'Day 37', name: 'Day37' },
 { visible: true, data: 'Day 38', name: 'Day38' },
 { visible: true, data: 'Day 39', name: 'Day39' },
 { visible: true, data: 'Day 40', name: 'Day40' },
 { visible: true, data: 'Day 41', name: 'Day41' },
 { visible: true, data: 'Day 42', name: 'Day42' },
 { visible: true, data: 'Day 43', name: 'Day43' },
 { visible: true, data: 'Day 44', name: 'Day44' },
 { visible: true, data: 'Day 45', name: 'Day45' },
 { visible: true, data: 'Day 46', name: 'Day46' },
 { visible: true, data: 'Day 47', name: 'Day47' },
 { visible: true, data: 'Day 48', name: 'Day48' },
 { visible: true, data: 'Day 49', name: 'Day49' },
 { visible: true, data: 'Day 50', name: 'Day50' },
 { visible: true, data: 'Day 51', name: 'Day51' },
 { visible: true, data: 'Day 52', name: 'Day52' },
 { visible: true, data: 'Day 53', name: 'Day53' },
 { visible: true, data: 'Day 54', name: 'Day54' },
 { visible: true, data: 'Day 55', name: 'Day55' },
 { visible: true, data: 'Day 56', name: 'Day56' },
 { visible: true, data: 'Day 57', name: 'Day57' },
 { visible: true, data: 'Day 58', name: 'Day58' },
 { visible: true, data: 'Day 59', name: 'Day59' },
 { visible: true, data: 'Day 60', name: 'Day60' },
 { visible: true, data: 'Day 61', name: 'Day61' },
 { visible: true, data: 'Day 62', name: 'Day62' },
 { visible: true, data: 'Day 63', name: 'Day63' },
 { visible: true, data: 'Day 64', name: 'Day64' },
 { visible: true, data: 'Day 65', name: 'Day65' },
 { visible: true, data: 'Day 66', name: 'Day66' },
 { visible: true, data: 'Day 67', name: 'Day67' },
 { visible: true, data: 'Day 68', name: 'Day68' },
 { visible: true, data: 'Day 69', name: 'Day69' },
 { visible: true, data: 'Day 70', name: 'Day70' },
 { visible: true, data: 'Day 71', name: 'Day71' },
 { visible: true, data: 'Day 72', name: 'Day72' },
 { visible: true, data: 'Day 73', name: 'Day73' },
 { visible: true, data: 'Day 74', name: 'Day74' },
 { visible: true, data: 'Day 75', name: 'Day75' },
 { visible: true, data: 'Day 76', name: 'Day76' },
 { visible: true, data: 'Day 77', name: 'Day77' },
 { visible: true, data: 'Day 78', name: 'Day78' },
 { visible: true, data: 'Day 79', name: 'Day79' },
 { visible: true, data: 'Day 80', name: 'Day80' },
 { visible: true, data: 'Day 81', name: 'Day81' },
 { visible: true, data: 'Day 82', name: 'Day82' },
 { visible: true, data: 'Day 83', name: 'Day83' },
 { visible: true, data: 'Day 84', name: 'Day84' },
 { visible: true, data: 'Day 85', name: 'Day85' },
 { visible: true, data: 'Day 86', name: 'Day86' },
 { visible: true, data: 'Day 87', name: 'Day87' },
 { visible: true, data: 'Day 88', name: 'Day88' },
 { visible: true, data: 'Day 89', name: 'Day89' },
 { visible: true, data: 'Day 90', name: 'Day90' },
 { visible: true, data: 'Day 91', name: 'Day91' },
 { visible: true, data: 'Day 92', name: 'Day92' },
 { visible: true, data: 'Day 93', name: 'Day93' },
 { visible: true, data: 'Day 94', name: 'Day94' },
 { visible: true, data: 'Day 95', name: 'Day95' },
 { visible: true, data: 'Day 96', name: 'Day96' },
 { visible: true, data: 'Day 97', name: 'Day97' },
 { visible: true, data: 'Day 98', name: 'Day98' },
 { visible: true, data: 'Day 99', name: 'Day99' },
 { visible: true, data: 'Day 100', name: 'Day100' },
 { visible: true, data: 'Day 101', name: 'Day101' },
 { visible: true, data: 'Day 102', name: 'Day102' },
 { visible: true, data: 'Day 103', name: 'Day103' },
 { visible: true, data: 'Day 104', name: 'Day104' },
 { visible: true, data: 'Day 105', name: 'Day105' },
 { visible: true, data: 'Day 106', name: 'Day106' },
 { visible: true, data: 'Day 107', name: 'Day107' },
 { visible: true, data: 'Day 108', name: 'Day108' },
 { visible: true, data: 'Day 109', name: 'Day109' },
 { visible: true, data: 'Day 110', name: 'Day110' },
 { visible: true, data: 'Day 111', name: 'Day111' },
 { visible: true, data: 'Day 112', name: 'Day112' }
 ],
'apiMap': function(data) {

var NewArray = []
//var data = ["testpi2","description","timeperiood","daycount","startdate","test","Test","","test","test","test","","test","test","","test"]
var entryArr = Object.values(data)
//console.log('dum')
console.log(entryArr)
//console.log(JSON.stringify(entryArr))
               var entryArrMap = entryArr.map(function(x,index) {
				   console.log(x)
				  if (x != '' && x != null){
				   y = 
				[
				  {"day": index-4 , 
					"availabilityTemplate":{
					"systemGenerated": true,
					   "segments":[
						{
						"availabilityType":
							{"qualifier":x.split('|')[1]},
						 "startTime":"00:00",
						 "endTime":"24:00"
						}
						]
						}
				  	}
					,
					{"day": index-4 , 
						"shiftTemplate":
						{"name": 
							x.split('|')[0]}
					}
				]				   	
				   if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'A' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_AVAILABLE"}
					else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'U' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_UNAVAILABLE"}
					else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'PA' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_PREFERRED_AVAILABLE"}
                    else if (y[0].availabilityTemplate.segments[0].availabilityType.qualifier == 'PU' ){y[0].availabilityTemplate.segments[0].availabilityType.qualifier = "&AVAILABILITY_TYPE_PREFERRED_UNAVAILABLE"}
                    else {delete y[0]}
                console.log(y[1].shiftTemplate.name)
                if (y[1].shiftTemplate.name == '' || y[1].shiftTemplate.name == null){delete y[1]}

                function bouncer(array) {
                    return array.filter(function(e) {
                      return e;
                    });
                  }
                  

                y = bouncer(y)


			}
				   
				   	else {y = 'wrong'}
                    console.log(y)
                    
				   return y
                  })
		
var objKeys = entryArrMap
for (var i = 5; i < objKeys.length; i++) {
	for (var y = 0; y < (entryArrMap)[i].length; y++) {
	if ((entryArrMap)[i] != 'wrong') {
        NewArray.push(       
          entryArrMap[i][y]);
    }
  }
}

    
var y = {
        "name": data.name,
        "description": data.description,
        "timePeriodType": {
            "name": data.timePeriodType
        },
        "dayCount": data.dayCount,
        "startDate": data.anchorDate,
        "items": NewArray,
        "deleted": false,
        "systemGenerated": false
    }

	if (data.description == null) delete y.description


//console.log(y)
//console.log(JSON.stringify(y))

	x=y
	return x

            }
            ,data: [["Name","Description","Weekly","7","2020-01-01","","Shift Template Name","Shift Template Name","Shift Template Name","Shift Template Name","Shift Template Name",""]]
        },


        {
            'type_name': 'Schedule Pattern Pay Code Templates',
                'apiUrl': '/v1/scheduling/schedule_pattern_templates',
                    'async': false,
                        'cdata': [
                            { visible: true, data: 'Name', name: 'name' },
                            { visible: true, data: 'Description', name: 'description' },
                            { visible: true, data: 'Anchor Date', name: 'anchorDate' },
                            { visible: true, data: 'Labor Category', name: 'labCategory' },
                            { visible: true, data: 'Labor Category Entry', name: 'labCategoryEntry' },
                            { visible: true, data: 'Pay Code', name: 'PayCode' },
                            { visible: true, data: 'Start Date Time', name: 'StartDateTime' },
                            { visible: true, data: 'Pay Code Amount', name: 'Amount' },
                        ],
                            'apiMap': function(data) {
        
                                var y = {
                                    "name": data.name,
                                    "description": data.description,
                                    "timePeriodType": {
                                        "name": "Weekly"
                                    },
                                    "dayCount": 7,
                                    "startDate": data.anchorDate,
                                    "systemGenerated": false,
                                    "items": 
                                    [{  "day":1,
                                        "payCodeEditTemplate": {                                 
                                            "payCode": {
                                                "qualifier": data.PayCode
                                            },
                                            "systemGenerated": true,
                                            "laborCategories": {
                                                "entries": [
                                                    {
                                                        "entry": {
                                                            "qualifier": data.labCategoryEntry
                                                        },
                                                        "laborCategory": {
                                                            "qualifier": data.labCategory
                                                        }
                                                    }
                                                ]
                                            },
                                            "startDateTime": "1900-01-01T"+data.StartDateTime,
                                            "durationInTime": data.Amount
                                            
                                    }}]
        
                                }
        
                                if (data.description == null) delete y.description
        
        
                                //console.log(y)
                                //console.log(JSON.stringify(y))
        
                                x = y
                                return x
        
                            }
        },
        

        {
            'type_name': 'Schedule Pay Code Edits',
            'apiUrl': '/v1/scheduling/schedule/pay_code_edits/apply_create',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Employee Number',
                    name: 'employee'
                },
                {
                    visible: true,
                    data: 'Pay Code Name',
                    name: 'payCodeRef',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Paycode Type',
                    name: 'payCodeType',
                    datasource: ['DAY', 'HOUR']
                },
                {
                    visible: true,
                    data: 'Start Date',
                    name: 'startDate'
                },
                {
                    visible: true,
                    data: 'Start Time',
                    name: 'startTime'
                },
                {
                    visible: true,
                    data: 'Amount',
                    name: 'amount'
                },
                {
                    visible: true,
                    data: 'Symbolic Source',
                    name: 'symbolicValueRef',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/employee_pay_code_symbolic_values',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Override Shift',
                    name: 'shiftOverrideType',
                    datasource: ['WHOLE_OVERRIDE', 'PARTIAL_OVERRIDE', 'NO_OVERRIDE']
                }

            ],
            'apiMap': function(d) {


                var y = {
                    "repeating": {
                        "do": {
                            "payCodeEdit": {
                                "startTime": d.startTime,
                                "startDate": d.startDate,
                                "symbolicValueRef": {
                                    "qualifier": d.symbolicValueRef
                                },
                                "payCodeRef": {
                                    "qualifier": d.payCodeRef
                                },
                                "durationInTime": d.amount,
                                "durationInDays": d.amount,
                                "employee": {
                                    "qualifier": d.employee
                                }
                            },
                            "shiftOverrideType": d.shiftOverrideType
                        },
                        "where": {
                            "numberDays": 1
                        }
                    }
                }

                if (d.payCodeType == 'HOUR') {delete y.repeating.do.payCodeEdit.durationInDays} else {delete y.repeating.do.payCodeEdit.durationInTime}
                if (d.symbolicValueRef == '' || d.symbolicValueRef == null) {delete y.repeating.do.payCodeEdit.symbolicValueRef}
                if ((d.amount == '' || d.amount == null) && (d.payCodeType == 'HOUR')) delete y.repeating.do.payCodeEdit.durationInTime
                if ((d.amount == '' || d.amount == null) && (d.payCodeType == 'DAY')) delete y.repeating.do.payCodeEdit.durationInDays
                if (d.startTime == '' || d.startTime == null) delete y.repeating.do.payCodeEdit.startTime
                if (y.repeating.do.shiftOverrideType  == '' || y.repeating.do.shiftOverrideType  == null) y.repeating.do.shiftOverrideType = 'NO_OVERRIDE'

                x = y
                //x = '{"accrualResets" :[' + y + '],"managerRole": true}'
                //   
                return x
            },
        },


        {
            'type_name': 'Time Off Request',
            'apiUrl': '/v1/scheduling/timeoff',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Employee Number*',
                    name: 'employee'
                },
 		{
                    visible: true,
                    data: 'Request Name*',
                    name: 'requestRef'
                    //,
                    //datasource: {
                    //    apiurl: '/v1/scheduling/timeoff/request_subtypes',
                    //    tag: 'name'
                    //}
                },
                {
                    visible: true,
                    data: 'Pay Code Name',
                    name: 'payCodeRef',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Date*',
                    name: 'startDate'
                },
                {
                    visible: true,
                    data: 'Symbolic Source*',
                    name: 'symbolicValueRef',
                    datasource: ['FULL_DAY','HALF_DAY','FIRST_HALF_DAY','SECOND_HALF_DAY','HOURS']
                },
                {
                    visible: true,
                    data: 'Start Time',
                    name: 'startTime'
                },
                {
                    visible: true,
                    data: 'Amount Decimal',
                    name: 'amount'
                }
  

            ],
            'apiMap': function(d) {


                var y = 

{
    "timeOffRequest": {
        "employee": {
            "qualifier": d.employee
        },
        "periods": [
            {
            	"duration":d.amount,
                "endDate": d.startDate,
                "payCode": {
                    "qualifier": d.payCodeRef
                },
                "startDate": d.startDate,
		        "startTime":d.startTime,
                "symbolicAmount": {
                    "qualifier": d.symbolicValueRef
                }
            }
        ],
        "requestSubType": {
            "name": d.requestRef
        }
    }
}
                if (d.symbolicValueRef != 'HOURS')
                {delete y.timeOffRequest.periods[0].duration;
                delete y.timeOffRequest.periods[0].startTime}
                if (d.payCodeRef ==  '' || d.payCodeRef == null){delete y.timeOffRequest.periods[0].payCode}
                x = y
                return x
            },
        },





        {
            'type_name': 'Work - Paycode Actions',
            'apiUrl': '/v1/work/pay_code_actions',
            'async': false,
            'cdata': [
		{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
		{
                    visible: true,
                    data: 'Activity Name',
                    name: 'activityRef',
                    datasource: {
                        apiurl: '/v1/work/activities?combinedName=*',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Pay Code Name',
                    name: 'payCodeRef',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/pay_codes',
                        tag: 'name'
                    }
                }
		   ],

	'apiMap': function(d) {
                var y = 

{
  "activity": {
    "qualifier": d.activityRef
  },
  "name": d.name,
  "payCode": {
    "qualifier": d.payCodeRef
  }
}
                x = y
                return x
            },
        },


        {
            'type_name': 'Work - Result Codes',
            'apiUrl': '/v1/work/result_codes',
            'async': false,
            'cdata': [
		{
                    visible: true,
                    data: 'Field Definition*',
                    name: 'fieldDefinition',
		    datasource: {
                        apiurl: '/v1/work/field_definitions',
                        tag: 'name'
                    }
                },
		{
                    visible: true,
                    data: 'Name*',
                    name: 'name'
                },
		{
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
		{
                    visible: true,
                    data: 'Active',
                    name: 'active',
		    datasource: ['true','false']
                }
		   ],

	'apiMap': function(d) {
                var y = 

{
  "active": d.active,
  "description": d.description,
  "fieldDefinition": {
    "qualifier": d.fieldDefinition
  },
  "name": d.name
}

if (d.active == '' || d.active ==  null) y.active = 'true'
                x = y
                return x
            },
        },


        {
            'type_name': 'Work - Field Definitions',
            'apiUrl': '/v1/work/field_definitions',
            'async': false,
            'cdata': [
		{
                    visible: true,
                    data: 'Field Name*',
                    name: 'name'
                },
		{
                    visible: true,
                    data: 'Data Type ID',
                    name: 'type',
		            datasource: ['Alpha Numeric','Alpha numeric with slash','Date','Floating decimal','Numeric','Time']
                },
		{
                    visible: true,
                    data: 'Field length',
                    name: 'fieldLength'
                },
		{
                    visible: true,
                    data: 'Digits Left of Decimal',
                    name: 'scale'
                },
		{
                    visible: true,
                    data: 'Digits Right of Decimal',
                    name: 'precision'
                },
		{
                    visible: true,
                    data: 'Active',
                    name: 'active',
		            datasource: ['true','false']
                },
		{
                    visible: true,
                    data: 'Multi Select?',
                    name: 'multiSelect',
		            datasource: ['true','false']
                },

		   ],

	'apiMap': function(d) {
                var y = 

{
  "active": d.active,
  "fieldLength": d.fieldLength,				//Field Length
  "precision": d.precision,     			//Digits right of Decimal
  "scale": d.scale,			        		//Digits left of Decimal
  "fieldType": {
    "qualifier": d.type
  },
  "multiSelect": d.multiSelect,
  "name": d.name,
  "resultType": true,
}

if (d.active == '' || d.active == null) y.active = 'true'
if (d.multiSelect == '' || d.multiSelect == null) y.multiSelect = 'false'

if (d.type == 'Time' || d.type == 'Numeric' || d.type == 'Date') {
delete y.precision;delete y.scale;delete y.fieldlength
}
else if (d.type == 'Alpha numeric with slash' || d.type == 'Alpha Numeric'){
delete y.precision;delete y.scale
}
else if (d.type == 'Floating Decimal'){
delete y.fieldlength
}

                x = y
                return x
            },
        },


{
            'type_name': 'Assign Adjustment Rules',
            'apiUrl': '/v1/commons/persons/adjustment_rule',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Adjustment Rules',
                    name: 'adjustmentRule',
		    datasource: {
                        apiurl: '/v1/timekeeping/setup/adjustment_rules',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'expirationDate'
                }

            ],
            'apiMap': function(d) {


                var y = 
{
  "effectiveDate": d.effectiveDate,
  "expirationDate": d.expirationDate,
  "personIdentity": {
    "personNumber": d.personNumber
  },
  "processor": d.adjustmentRule
}

                x = y
                return x
            },
        },


        {
            'type_name': 'Assign Attendance Profile',
            'apiUrl': '/v1/commons/persons/attendance_profile/multi_update',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Profile Name',
                    name: 'AttendanceProfile'
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                }

            ],
            'apiMap': function(d) {


                var y = 
[{
    "attendanceProfileAssignments": [
        {
          "effectiveDate": d.effectiveDate,
          "profileName": d.AttendanceProfile
        }
      ],
  "personIdentity": {
    "personNumber": d.personNumber
  }
}]

                x = y
                return x
            },
        },


        {
            'type_name': 'Work - Delete Activities',
            'apiUrl': '/v1/work/activities/multi_delete',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Activity Name',
                    name: 'activityName'
                }

            ],
            'apiMap': function(d) {


                var y = 
                {
                    "where": {
                        "activities": {
                            "refs": [
                                { "qualifier": d.activityName }
                            ]
                        }
                    }
                }


                x = y
                return x
            },
        },



        {
            'type_name': 'Assign Personal OT Rules',
            'apiUrl': '/v1/commons/persons/multi_update',
            'data':[
            ["90106","2020-01-01","3000-01-01","Weekly","false","8","2","","","","","","",""],
            ["90106","2020-01-01","3000-01-01","Daily","false","","","8:00|0:00","8:00|0:00","8:00|0:00","8:00|0:00","8:00|0:00","8:00|0:00","8:00|0:00"],
            ["90106","2020-01-01","3000-01-01","Daily","true","","","","","","","","",""]],
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personNumber'
                },
                {
                    visible: true,
                    data: 'Start Date',
                    name: 'effectiveDate',
                    tooltip:'YYYY-MM-DD'
                },
                {
                    visible: true,
                    data: 'End Date',
                    name: 'expirationDate',
                    tooltip:'YYYY-MM-DD'
                },
                {
                    visible: true,
                    data: 'OvertimeLevel',
                    name: 'otLevel'
                },
                {
                    visible: true,
                    data: 'Type',
                    name: 'resetType',
                    datasource:["Weekly","Daily","Pay Period"]
                },
                {
                    visible: true,
                    data: 'Amount From Schedule',
                    name: 'source',
                    datasource:["false","true"]
                },
                {
                    visible: true,
                    data: 'Amount',
                    name: 'amount',
                    tooltip:'h:mm'
                },
                {
                    visible: true,
                    data: 'Minimum Over',
                    name: 'minAmount',
                    tooltip:'h:mm'
                },
                {
                    visible: true,
                    data: 'Monday',
                    name: 'monday',
                    tooltip:'h:mm|h:mm'
                },
                {
                    visible: true,
                    data: 'Tuesday',
                    name: 'tuesday',
                    tooltip:'h:mm|h:mm'
                },
                {
                    visible: true,
                    data: 'Wednesday',
                    name: 'wednesday',
                    tooltip:'h:mm|h:mm'
                },
                {
                    visible: true,
                    data: 'Thursday',
                    name: 'thursday',
                    tooltip:'h:mm|h:mm'
                },
                {
                    visible: true,
                    data: 'Friday',
                    name: 'friday',
                    tooltip:'h:mm|h:mm'
                },
                {
                    visible: true,
                    data: 'Saturday',
                    name: 'saturday',
                    tooltip:'h:mm|h:mm'
                },
                {
                    visible: true,
                    data: 'Sunday',
                    name: 'sunday',
                    tooltip:'h:mm|h:mm'
                },


            ],
            'apiMap': function(d) {
                console.log(JSON.stringify(d))
                d.source = JSON.parse(d.source)
                AmountTypeName = ""
                if (d.resetType == "Weekly" && d.source == true){AmountTypeName = "WEEKLY"}
                else if (d.resetType == "Daily" && d.source == true){AmountTypeName = "DAILY_FROM_SCHEDULE"}
                else if (d.resetType == "Pay Period" && d.source == true){AmountTypeName = "PAYPERIOD"}
                else if (d.resetType == "Weekly" && d.source == false){AmountTypeName = "WEEKLY"}
                else if (d.resetType == "Daily" && d.source == false){AmountTypeName = "DAILY"}
                else if (d.resetType == "Pay Period" && d.source == false){AmountTypeName = "PAYPERIOD"}

                //console.log(AmountTypeName)

                DailyOverrides = []
                if (d.monday != "" && d.monday != null){DailyOverrides.push({"amount":d.monday.split('|')[0],"minimumAmount":d.monday.split('|')[1],"personalOvertimeAmountTypeName":"MONDAY"})}
                if (d.tuesday != "" && d.tuesday != null){DailyOverrides.push({"amount":d.tuesday.split('|')[0],"minimumAmount":d.tuesday.split('|')[1],"personalOvertimeAmountTypeName":"TUESDAY"})}
                if (d.wednesday != "" && d.wednesday != null){DailyOverrides.push({"amount":d.wednesday.split('|')[0],"minimumAmount":d.wednesday.split('|')[1],"personalOvertimeAmountTypeName":"WEDNESDAY"})}
                if (d.thursday != "" && d.thursday != null){DailyOverrides.push({"amount":d.thursday.split('|')[0],"minimumAmount":d.thursday.split('|')[1],"personalOvertimeAmountTypeName":"THURSDAY"})}
                if (d.friday != "" && d.friday != null){DailyOverrides.push({"amount":d.friday.split('|')[0],"minimumAmount":d.friday.split('|')[1],"personalOvertimeAmountTypeName":"FRIDAY"})}
                if (d.saturday != "" && d.saturday != null){DailyOverrides.push({"amount":d.saturday.split('|')[0],"minimumAmount":d.saturday.split('|')[1],"personalOvertimeAmountTypeName":"SATURDAY"})}
                if (d.sunday != "" && d.sunday != null){DailyOverrides.push({"amount":d.sunday.split('|')[0],"minimumAmount":d.sunday.split('|')[1],"personalOvertimeAmountTypeName":"SUNDAY"})}

                var y = 
                [
                    {
                        "personIdentity": {
                            "personNumber": d.personNumber
                        },
                        "jobAssignment": {
                            "personalOvertimeAssignments": [
                                {
                                    "effectiveDate": d.effectiveDate,
                                    "expirationDate": d.expirationDate,
                                    "overtimeLevel": d.otLevel,
                                    "overtimeTypeName": d.resetType,
                                    "personalOvertimeRule": {
                                        "personalOvertimeLimits": [
                                            {
                                                "amount": d.amount,
                                                "minimumAmount": d.minAmount,
                                                "personalOvertimeAmountTypeName": AmountTypeName
                                            }
                                        ],
                                        "useScheduleFlag": d.source
                                    },
                                    "stopOvertimeFlag": false
                                }
                            ]
                        }
                    }
                ]


                if (d.resetType == 'Daily' && d.source == false){
                    y[0].jobAssignment.personalOvertimeAssignments[0].personalOvertimeRule.personalOvertimeLimits = DailyOverrides
                
                }

                console.log(y)
                x = y
                return x
            },
        },


        
        {
            'type_name': 'Assign Process Profile',
            'apiUrl': '/v1/commons/persons/process_profiles/multi_update',
            'async': false,
            'cdata': [{
                visible: true,
                data: 'Person Number',
                name: 'personNumber'
            },
            {
                visible: true,
                data: 'Employee Profile Name',
                name: 'EmployeeProfile'
            },
            {
                visible: true,
                data: 'Employee Profile Name',
                name: 'ManagerProfile'
            }

            ],
            'apiMap': function (d) {


                var y =
                    [{
                        "employeeProcessProfileName": d.EmployeeProfile,
                        "managerProcessProfileName": d.ManagerProfile,
                        "personIdentity": {
                            "personNumber": d.personNumber
                        }
                    }]

                x = y
                return x
            },
        },





        {
            'type_name': 'Employee Basic Shifts',
            'apiUrl': '/v1/scheduling/schedule/shifts',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Employee Number',
                    name: 'employee'
                },
                {
                    visible: true,
                    data: 'Shift Start Date',
                    name: 'startDate'
                },
                {
                    visible: true,
                    data: 'Shift Start Time',
                    name: 'startTime'
                },
                {
                    visible: true,
                    data: 'Shift End Date',
                    name: 'endDate'
                },
                {
                    visible: true,
                    data: 'Shift End Time',
                    name: 'endTime'
                },
                {
                    visible: true,
                    data: 'Label',
                    name: 'label'
                }

            ],
            'apiMap': function(d) {


                var y = {
                    "startDateTime": d.startDate + 'T' + d.startTime,
                    "endDateTime": d.endDate + 'T' + d.endTime,
                    "label": d.label,
                    "generated": true,
                    "employee": {
                        "qualifier": d.employee
                    },
                    "segments": [{
                        "startDateTime": d.startDate + 'T' + d.startTime,
                        "endDateTime": d.endDate + 'T' + d.endTime
                    }]
                }
                if (d.label == '') delete y.label

                x = y
                return x
            },
        },


        {
            'type_name': 'Delete Shifts',
            'apiUrl': '/v1/scheduling/schedule/shifts/multi_delete',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'ShiftID CSV',
                    name: 'shiftID'
                },
                     ],
            'apiMap': function(d) {
                
                var y = {"where": {"shiftIds": d.shiftID.split(',')
            
            }}
                x = y
                return x
            },
        },



        //WILL FAIL UNLESS YOU COME UP WITH SOME METHOD TO SEND ONLY 1 RECORD FOR THE JOBS API
        {
            'type_name': 'Jobs',
            'apiUrl': '/v1/commons/jobs',
            'allowableErrors': [{
                errorCode: 'WCO-103011',
                errorColor: 'blue',
                errorMessage: 'The node has previously been loaded'
            }],
            'cdata': [{
                    visible: true,
                    data: 'Job Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Job Full Name',
                    name: 'fullName'
                },
                {
                    visible: true,
                    data: 'Job Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Display Order',
                    name: 'displayOrder'
                },
                {
                    visible: true,
                    data: 'Effective Date',
                    name: 'effectiveDate'
                },
                {
                    visible: true,
                    data: 'Expiration Date',
                    name: 'expirationDate'
                },
                {
                    visible: true,
                    data: 'Color',
                    name: 'color'
                },
                {
                    visible: true,
                    data: 'Job Code',
                    name: 'code'
                },
                {
                    visible: false,
                    data: 'firstRevision',
                    name: 'firstRevision'
                },
                {
                    visible: false,
                    data: 'lastRevision',
                    name: 'lastRevision'
                }
            ],
            'apiMap': function(d) {
                var x = {
                    //"id": 1,
                    "code": d.code,
                    "color": d.color,
                    "description": d.description,
                    "displayOrder": d.displayOrder,
                    "effectiveDate": dateAdjust(d.effectiveDate),
                    "expirationDate": dateAdjust(d.expirationDate),
                    "firstRevision": false,
                    "fullName": d.name,
                    "lastRevision": false,
                    "name": d.name
                }
                if (x.color == '') delete x['color']
                //TODO: CHECK TO SEE IF CERTAIN FIELDS ARE NULL not passing if null
                return x
            },
            'removeExisting': {
                datasource: {
                    apiurl: '/v1/commons/jobs/multi_read',
                    pdata: {
                        "where": {
                            "forDate": {
                                "date": new Date().toISOString().split('T')[0]
                            }
                        }
                    }
                },
                curDataPoint: function(o) {
                    return o.name
                },
                stgDataPoint: function(o) {
                    return o.name
                }
            }
            //,'data' : [["Muff Test","Muff Test","Description","1192","1900-01-01","3000-01-01","#FFFF00","999"]]
        },
        {

            'type_name': 'Employee Groups',
            'apiUrl': '/v1/commons/employee_groups/multi_create',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Labor Category Profile',
                    name: 'laborCategoryProfile',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Organisational Set',
                    name: 'organisationalSet',
                    datasource: {
                        apiurl: '/v1/commons/location_sets/multi_read',
                        tag: 'name',
                        pdata: {
                            "where": {
                                "context": "ORG",
                                "date": "2019-01-01",
                                "types": {
                                    "ids": [
                                        1
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    visible: true,
                    data: 'Cost Center Pattern',
                    name: 'costCenterPattern'
                }

            ],
            'apiMap': function(d) {

                var y = [{
                    "costCenterPattern": d.costCenterPattern,
                    "laborCategoryProfileRef": {
                        "qualifier": d.laborCategoryProfile
                    },
                    "name": d.name,
                    "orgMapGroupRef": {
                        "qualifier": d.organisationalSet
                    }
                }]

                if (d.laborCategoryProfile == ''||d.laborCategoryProfile == null) delete y[0].laborCategoryProfileRef
                if (d.costCenterPattern == '' || d.costCenterPattern == null) delete y[0].costCenterPattern

                x = y

                return x
            }
        },
        
        {

            'type_name': 'Employee Groups -Update',
            'apiUrl': '/v1/commons/employee_groups/multi_update',
            'async': false,
            'cdata': [
                {
                    visible: true,
                    data: 'ID',
                    name: 'id'
                },
                {
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Labor Category Profile',
                    name: 'laborCategoryProfile',
                    datasource: {
                        apiurl: '/v1/commons/labor_category_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Organisational Set',
                    name: 'organisationalSet',
                    datasource: {
                        apiurl: '/v1/commons/location_sets/multi_read',
                        tag: 'name',
                        pdata: {
                            "where": {
                                "context": "ORG",
                                "date": "2019-01-01",
                                "types": {
                                    "ids": [
                                        1
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    visible: true,
                    data: 'Cost Center Pattern',
                    name: 'costCenterPattern'
                }

            ],
            'apiMap': function(d) {

                var y = [{
                    "costCenterPattern": d.costCenterPattern,
                    "id":d.id,
                    "laborCategoryProfileRef": {
                        "qualifier": d.laborCategoryProfile
                    },
                    "name": d.name,
                    "orgMapGroupRef": {
                        "qualifier": d.organisationalSet
                    }
                }]

                if (d.laborCategoryProfile == ''||d.laborCategoryProfile == null) delete y[0].laborCategoryProfileRef
                if (d.costCenterPattern == '' || d.costCenterPattern == null) delete y[0].costCenterPattern

                x = y

                return x
            }
        },
        
        
        
        {

            'type_name': 'Labor Category Lists',
            'apiUrl': '/v1/commons/labor_category_lists/multi_create',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Labor Category',
                    name: 'laborCategory',
                    datasource: {
                        apiurl: '/v1/commons/labor_categories',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Labor Category Entries CSV',
                    name: 'laborCategoryEntries'
                },
                {
                    visible: true,
                    data: 'Wild Card',
                    name: 'wildCard'
                }



            ],
            'apiMap': function(d) {

                var entryArr = d.laborCategoryEntries.split(',')
                var entryArrMap = entryArr.map(function(x) {
                    return {
                        qualifier: x
                    }
                })
                console.log(entryArrMap)

                var y = [{
                    "name": d.name,
                    "description": d.description,
                    "entryList": entryArrMap,
                    "entryListWildcard": d.wildCard,
                    "laborCategory": {
                        "qualifier": d.laborCategory
                    },
                    "systemAllEntriesList": false
                }]

                if (y.description == '') delete y.description
                if (y.entryArrMap == '') delete y.entryArrMap
                if (y.wildCard == '') delete y.wildCard

                x = y
                console.log(y)
                return x
            }
        },
/*
        {
            'type_name': 'Import Volume',
            'apiUrl': '/v1/forecasting/actual_volume/import',
            'cdata': [
		{
                    visible: true,
                    data: 'Site',
                    name: 'site'
                },
                {
                    visible: true,
                    data: 'Driver',
                    name: 'Driver'
                },
                {
                    visible: true,
                    data: 'Label',
                    name: 'Label'
                },
                {
                    visible: true,
                    data: 'As Of Date',
                    name: 'asOfDate'
                },
                {
                    visible: true,
                    data: 'Actual Date',
                    name: 'actualDate'
                },
                {   visible: true,data: '00:00 until 00:15',name: '00:00 until 00:15'},
{   visible: true,data: '00:15 until 00:30',name: '00:15 until 00:30'},
{   visible: true,data: '00:30 until 00:45',name: '00:30 until 00:45'},
{   visible: true,data: '00:45 until 01:00',name: '00:45 until 01:00'},
{   visible: true,data: '01:00 until 01:15',name: '01:00 until 01:15'},
{   visible: true,data: '01:15 until 01:30',name: '01:15 until 01:30'},
{   visible: true,data: '01:30 until 01:45',name: '01:30 until 01:45'},
{   visible: true,data: '01:45 until 02:00',name: '01:45 until 02:00'},
{   visible: true,data: '02:00 until 02:15',name: '02:00 until 02:15'},
{   visible: true,data: '02:15 until 02:30',name: '02:15 until 02:30'},
{   visible: true,data: '02:30 until 02:45',name: '02:30 until 02:45'},
{   visible: true,data: '02:45 until 03:00',name: '02:45 until 03:00'},
{   visible: true,data: '03:00 until 03:15',name: '03:00 until 03:15'},
{   visible: true,data: '03:15 until 03:30',name: '03:15 until 03:30'},
{   visible: true,data:����'03:30 until 03:45',name: '03:30 until 03:45'},
{   visible: true,data: '03:45 until 04:00',name: '03:45 until 04:00'},
{   visible: true,data: '04:00 until 04:15',name: '04:00 until 04:15'},
{   visible: true,data: '04:15 until 04:30',name: '04:15 until 04:30'},
{   visible: true,data: '04:30 until 04:45',name: '04:30 until 04:45'},
{   visible: true,data: '04:45 until 05:00',name: '04:45 until 05:00'},
{   visible: true,data: '05:00 until 05:15',name: '05:00 until 05:15'},
{   visible: true,data: '05:15 until 05:30',name: '05:15 until 05:30'},
{   visible: true,data: '05:30 until 05:45',name: '05:30 until 05:45'},
{   visible: true,data: '05:45 until 06:00',name: '05:45 until 06:00'},
{   visible: true,data: '06:00 until 06:15',name: '06:00 until 06:15'},
{   visible: true,data: '06:15 until 06:30',name: '06:15 until 06:30'},
{   visible: true,data: '06:30 until 06:45',name: '06:30 until 06:45'},
{   visible: true,data: '06:45 until 07:00',name: '06:45 until 07:00'},
{   visible: true,data: '07:00 until 07:15',name: '07:00 until 07:15'},
{   visible: true,data: '07:15 until 07:30',name: '07:15 until 07:30'},
{   visible: true,data: '07:30 until 07:45',name: '07:30 until 07:45'},
{   visible: true,data: '07:45 until 08:00',name: '07:45 until 08:00'},
{   visible: true,data: '08:00 until 08:15',name: '08:00 until 08:15'},
{   visible: true,data: '08:15 until 08:30',name: '08:15 until 08:30'},
{   visible: true,data: '08:30 until 08:45',name: '08:30 until 08:45'},
{   visible: true,data: '08:45 until 09:00',name: '08:45 until 09:00'},
{   visible: true,data: '09:00 until 09:15',name: '09:00 until 09:15'},
{   visible: true,data: '09:15 until 09:30',name: '09:15 until 09:30'},
{   visible: true,data: '09:30 until 09:45',name: '09:30 until 09:45'},
{   visible: true,data: '09:45 until 10:00',name: '09:45 until 10:00'},
{   visible: true,data: '10:00 until 10:15',name: '10:00 until 10:15'},
{   visible: true,data: '10:15 until 10:30',name: '10:15 until 10:30'},
{   visible: true,data: '10:30 until 10:45',name: '10:30 until 10:45'},
{   visible: true,data: '10:45 until 11:00',name: '10:45 until 11:00'},
{   visible: true,data: '11:00 until 11:15',name: '11:00 until 11:15'},
{   visible: true,data: '11:15 until 11:30',name: '11:15 until 11:30'},
{   visible: true,data: '11:30 until 11:45',name: '11:30 until 11:45'},
{   visible: true,data: '11:45 until 12:00',name: '11:45 until 12:00'},
{   visible: true,data: '12:00 until 12:15',name: '12:00 until 12:15'},
{   visible: true,data: '12:15 until 12:30',name: '12:15 until 12:30'},
{   visible: true,data: '12:30 until 12:45',name: '12:30 until 12:45'},
{   visible: true,data: '12:45 until 13:00',name: '12:45 until 13:00'},
{   visible: true,data: '13:00 until 13:15',name: '13:00 until 13:15'},
{   visible: true,data: '13:15 until 13:30',name: '13:15 until 13:30'},
{   visible: true,data: '13:30 until 13:45',name: '13:30 until 13:45'},
{   visible: true,data: '13:45 until 14:00',name: '13:45 until 14:00'},
{   visible: true,data: '14:00 until 14:15',name: '14:00 until 14:15'},
{   visible: true,data: '14:15 until 14:30',name: '14:15 until 14:30'},
{   visible: true,data: '14:30 until 14:45',name: '14:30 until 14:45'},
{   visible: true,data: '14:45 until 15:00',name: '14:45 until 15:00'},
{   visible: true,data: '15:00 until 15:15',name: '15:00 until 15:15'},
{   visible: true,data: '15:15 until 15:30',name: '15:15 until 15:30'},
{   visible: true,data: '15:30 until 15:45',name: '15:30 until 15:45'},
{   visible: true,data: '15:45 until 16:00',name: '15:45 until 16:00'},
{   visible: true,data: '16:00 until 16:15',name: '16:00 until 16:15'},
{   visible: true,data: '16:15 until 16:30',name: '16:15 until 16:30'},
{   visible: true,data: '16:30 until 16:45',name: '16:30 until 16:45'},
{   visible: true,data: '16:45 until 17:00',name: '16:45 until 17:00'},
{   visible: true,data: '17:00 until 17:15',name: '17:00 until 17:15'},
{   visible: true,data: '17:15 until 17:30',name: '17:15 until 17:30'},
{   visible: true,data: '17:30 until 17:45',name: '17:30 until 17:45'},
{   visible: true,data: '17:45 until 18:00',name: '17:45 until 18:00'},
{   visible: true,data: '18:00 until 18:15',name: '18:00 until 18:15'},
{   visible: true,data: '18:15 until 18:30',name: '18:15 until 18:30'},
{   visible: true,data: '18:30 until 18:45',name: '18:30 until 18:45'},
{   visible: true,data: '18:45 until 19:00',name: '18:45 until 19:00'},
{   visible: true,data: '19:00 until 19:15',name: '19:00 until 19:15'},
{   visible: true,data: '19:15 until 19:30',name: '19:15 until 19:30'},
{   visible: true,data: '19:30 until 19:45',name: '19:30 until 19:45'},
{   visible: true,data: '19:45 until 20:00',name: '19:45 until 20:00'},
{   visible: true,data: '20:00 until 20:15',name: '20:00 until 20:15'},
{   visible: true,data: '20:15 until 20:30',name: '20:15 until 20:30'},
{   visible: true,data: '20:30 until 20:45',name: '20:30 until 20:45'},
{   visible: true,data: '20:45 until 21:00',name: '20:45 until 21:00'},
{   visible: true,data: '21:00 until 21:15',name: '21:00 until 21:15'},
{   visible: true,data: '21:15 until 21:30',name: '21:15 until 21:30'},
{   visible: true,data: '21:30 until 21:45',name: '21:30 until 21:45'},
{   visible: true,data: '21:45 until 22:00',name: '21:45 until 22:00'},
{   visible: true,data: '22:00 until 22:15',name: '22:00 until 22:15'},
{   visible: true,data: '22:15 until 22:30',name: '22:15 until 22:30'},
{   visible: true,data: '22:30 until 22:45',name: '22:30 until 22:45'},
{   visible: true,data: '22:45 until 23:00',name: '22:45 until 23:00'},
{   visible: true,data: '23:00 until 23:15',name: '23:00 until 23:15'},
{   visible: true,data: '23:15 until 23:30',name: '23:15 until 23:30'},
{   visible: true,data: '23:30 until 23:45',name: '23:30 until 23:45'},
{   visible: true,data: '23:45 until 00:00',name: '23:45 until 00:00'}
            ],
            'apiMap': function(d) {
            data.splice(5,95).join(',')
            
                var x = 
                {
                    "actualVolumes": [
                      {
                        "actualVolumesPerDay": [
                          {
                            "date": d.actualDate,
                            "intervalAmounts": "INTERVALAMOUNTS"
                          }
                        ],
                        "driver": {
                          "qualifier": d.Label
                        },
                        "externalLabel": {
                          "qualifier": d.driver
                        }
                      }
                    ],
                    "asOfDate": d.asOfDate,
                    "site": {
                      "qualifier": d.site
                    }
                  }
                return x
            },
        },

*/
{
    'type_name': 'Forecast Category Profiles',
    'apiUrl': '/v1/forecasting/category_profiles',
    
    'cdata': [{
            visible: true,
            data: 'Name',
            name: 'name'
        },
        {
            visible: true,
            data: 'Description',
            name: 'description'
        },
        {
            visible: true,
            data: 'Effective Date',
            name: 'effDate'
        },
        {
            visible: true,
            data: 'Categories CSV',
            name: 'categoriesCSV'
        }


    ],
    'apiMap': function(data) {
        if (data.categoriesCSV != "" && data.categoriesCSV != null){
        CategoriesList = data.categoriesCSV.split(',').map(function(xo){return {   "qualifier": xo } })
        }
        else {CategoriesList = []}
        var x = 
        
            {
              "active": true,
              "categories": CategoriesList,
              "description": data.description,
              "effectiveDate": data.effDate,
              "name":data.name
            }
          
        return x
    },
},


{
            'type_name': 'Cost Center',
            'apiUrl': '/v1/commons/cost_centers/multi_create',
            'allowableErrors': [{
                errorCode: 'laborcategory-common:2',
                errorColor: 'blue',
                errorMessage: 'The Cost Center has previously been loaded'
            }],
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Inactive',
                    name: 'inactive'
                }
            ],
            'apiMap': function(data) {
                //console.log(data)
                inactive = false
                if (data.inactive) {
                    if (data.inactive.toUpperCase().indexOf('T') > -1) inactive = true
                }
                var x = {
                    "description": data.description,
                    //"id": 1,
                    "inactive": inactive,
                    "name": data.name,
                    "version": 1
                }
                return x
            },
        },
        {
            'type_name': 'Labor Category',
            'apiUrl': '/v1/commons/labor_entries/multi_create',
            'allowableErrors': [{
                errorCode: 'laborcategory-common:2',
                errorColor: 'blue',
                errorMessage: 'The Labor Category has previously been loaded'
            }],
            'cdata': [{
                    visible: true,
                    data: 'Labor Category Name',
                    name: 'laborcategoryname',
                    datasource: {
                        apiurl: '/v1/commons/labor_categories',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Entry Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Entry Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Inactive',
                    name: 'inactive'
                }
            ],
            'apiMap': function(data) {
                //console.log(data)
                inactive = false
                if (data.inactive) {
                    if (data.inactive.toUpperCase().indexOf('T') > -1) inactive = true
                }
                var x = {
                    "description": data.description,
                    "inactive": inactive,
                    "laborCategory": {

                        "qualifier": data.laborcategoryname.toString(),
                        "sortOrder": 1
                    },
                    "name": data.name,
                    "version": 1
                }

                return x
            },
        },


            {
                'type_name': 'Labor Category Entry Update',
                'apiUrl': '/v1/commons/labor_entries/multi_update',
                'allowableErrors': [{
                    errorCode: 'laborcategory-common:2',
                    errorColor: 'blue',
                    errorMessage: 'The Labor Category has previously been loaded'
                }],
                'cdata': [
                    {
                        visible: true,
                        data: 'Entry Id',
                        name: 'id'
                    },
                    {
                        visible: true,
                        data: 'Labor Category Name',
                        name: 'laborcategoryname',
                        datasource: {
                            apiurl: '/v1/commons/labor_categories',
                            tag: 'name'
                        }
                    },
                    {
                        visible: true,
                        data: 'Entry Name',
                        name: 'name'
                    },

                    {
                        visible: true,
                        data: 'Entry Description',
                        name: 'description'
                    },
                    {
                        visible: true,
                        data: 'Inactive',
                        name: 'inactive'
                    }
                ],
                'apiMap': function(data) {
                    //console.log(data)
                    inactive = false
                    if (data.inactive) {
                        if (data.inactive.toUpperCase().indexOf('T') > -1) inactive = true
                    }
                    var x = {
                        "description": data.description,
                        "inactive": inactive,
                        "laborCategory": {
    
                            "qualifier": data.laborcategoryname.toString(),
                            "sortOrder": 1
                        },
                        "name": data.name,
                        "id": data.id,
                        "version":1
                       
                    }
    
                    return [x]
                },

            //,data: [["CC1","CC1 Description"]],
        },
        {
            'type_name': 'Delete Labor Category',
            'apiUrl': '/v1/commons/labor_entries/multi_delete',
            'cdata': [
                {
                    visible: true,
                    data: 'Entry ID',
                    name: 'name'
                }
            ],
            'apiMap': function(data) {
                //console.log(data)
               // inactive = false
               // if (data.inactive) {
               //     if (data.inactive.toUpperCase().indexOf('T') > -1) inactive = true
               // }
                var x =   [{
                    "id": parseFloat(data.name,10)
                  }]

                return x
            },

            //,data: [["CC1","CC1 Description"]],
        },



        {
            'type_name': 'Volume Driver Assignments',
            'apiUrl': '/v1/forecasting/volume_driver_assignments/multi_upsert',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Forecast Path',
                    name: 'fcpathtxt'
                },
                {
                    visible: true,
                    data: 'Forecast Date',
                    name: 'forecastWeekDate'
                },
                {
                    visible: true,
                    data: 'POS Label',
                    name: 'poslabel'
                }, {
                    visible: true,
                    data: 'Driver 1',
                    name: 'vdriver1'
                }, {
                    visible: true,
                    data: 'Driver 2',
                    name: 'vdriver2'
                }, {
                    visible: true,
                    data: 'Driver 3',
                    name: 'vdriver3'
                }, {
                    visible: true,
                    data: 'Driver 4',
                    name: 'vdriver4'
                }, {
                    visible: true,
                    data: 'Driver 5',
                    name: 'vdriver5'
                }, {
                    visible: true,
                    data: 'Driver 6',
                    name: 'vdriver6'
                }, {
                    visible: true,
                    data: 'Driver 7',
                    name: 'vdriver7'
                }, {
                    visible: true,
                    data: 'Driver 8',
                    name: 'vdriver8'
                }, {
                    visible: true,
                    data: 'Driver 9',
                    name: 'vdriver9'
                }, {
                    visible: true,
                    data: 'Driver 10',
                    name: 'vdriver10'
                }, {
                    visible: true,
                    data: 'Driver 11',
                    name: 'vdriver11'
                }, {
                    visible: true,
                    data: 'Driver 12',
                    name: 'vdriver12'
                }, {
                    visible: true,
                    data: 'Driver 13',
                    name: 'vdriver13'
                }, {
                    visible: true,
                    data: 'Driver 14',
                    name: 'vdriver14'
                }, {
                    visible: true,
                    data: 'Driver 15',
                    name: 'vdriver15'
                }, {
                    visible: true,
                    data: 'Driver 16',
                    name: 'vdriver16'
                }, {
                    visible: true,
                    data: 'Driver 17',
                    name: 'vdriver17'
                }, {
                    visible: true,
                    data: 'Driver 18',
                    name: 'vdriver18'
                }, {
                    visible: true,
                    data: 'Driver 19',
                    name: 'vdriver19'
                }, {
                    visible: true,
                    data: 'Driver 20',
                    name: 'vdriver20'
                }, {
                    visible: true,
                    data: 'Driver 21',
                    name: 'vdriver21'
                }, {
                    visible: true,
                    data: 'Driver 22',
                    name: 'vdriver22'
                }, {
                    visible: true,
                    data: 'Driver 23',
                    name: 'vdriver23'
                }, {
                    visible: true,
                    data: 'Driver 24',
                    name: 'vdriver24'
                }, {
                    visible: true,
                    data: 'Driver 25',
                    name: 'vdriver25'
                }, {
                    visible: true,
                    data: 'Driver 26',
                    name: 'vdriver26'
                }, {
                    visible: true,
                    data: 'Driver 27',
                    name: 'vdriver27'
                }, {
                    visible: true,
                    data: 'Driver 28',
                    name: 'vdriver28'
                }, {
                    visible: true,
                    data: 'Driver 29',
                    name: 'vdriver29'
                }, {
                    visible: true,
                    data: 'Driver 30',
                    name: 'vdriver30'
                }
            ],
            'apiMap': function(data) {
                var x = {
                    "category": {
                        "qualifier": data.fcpathtxt
                    },
                    "effectiveDate": data.forecastWeekDate,
                    "volumeDrivers": [],
                    "volumeLabel": data.poslabel
                }

                if (data.vdriver1 != '' && data.vdriver1 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver1
                })
                if (data.vdriver2 != '' && data.vdriver2 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver2
                })
                if (data.vdriver3 != '' && data.vdriver3 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver3
                })
                if (data.vdriver4 != '' && data.vdriver4 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver4
                })
                if (data.vdriver5 != '' && data.vdriver5 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver5
                })
                if (data.vdriver6 != '' && data.vdriver6 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver6
                })
                if (data.vdriver7 != '' && data.vdriver7 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver7
                })
                if (data.vdriver8 != '' && data.vdriver8 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver8
                })
                if (data.vdriver9 != '' && data.vdriver9 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver9
                })
                if (data.vdriver10 != '' && data.vdriver10 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver10
                })
                if (data.vdriver11 != '' && data.vdriver11 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver11
                })
                if (data.vdriver12 != '' && data.vdriver12 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver12
                })
                if (data.vdriver13 != '' && data.vdriver13 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver13
                })
                if (data.vdriver14 != '' && data.vdriver14 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver14
                })
                if (data.vdriver15 != '' && data.vdriver15 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver15
                })
                if (data.vdriver16 != '' && data.vdriver16 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver16
                })
                if (data.vdriver17 != '' && data.vdriver17 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver17
                })
                if (data.vdriver18 != '' && data.vdriver18 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver18
                })
                if (data.vdriver19 != '' && data.vdriver19 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver19
                })
                if (data.vdriver20 != '' && data.vdriver20 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver20
                })
                if (data.vdriver21 != '' && data.vdriver21 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver21
                })
                if (data.vdriver22 != '' && data.vdriver22 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver22
                })
                if (data.vdriver23 != '' && data.vdriver23 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver23
                })
                if (data.vdriver24 != '' && data.vdriver24 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver24
                })
                if (data.vdriver25 != '' && data.vdriver25 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver25
                })
                if (data.vdriver26 != '' && data.vdriver26 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver26
                })
                if (data.vdriver27 != '' && data.vdriver27 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver27
                })
                if (data.vdriver28 != '' && data.vdriver28 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver28
                })
                if (data.vdriver29 != '' && data.vdriver29 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver29
                })
                if (data.vdriver30 != '' && data.vdriver30 != null) x.volumeDrivers.push({
                    "qualifier": data.vdriver30
                })

                if (data.poslabel == '') delete x.volumeLabel
                if (data.forecastWeekDate == '') delete x.forecastWeekDate
                //if (x.volumeDrivers.length == 0) delete x.volumeDrivers

                //console.log('sourcedata',data)
                //console.log(JSON.stringify(data))
                //console.log('apirequest',x)
                return x
            },

            //,data: [["CC1","CC1 Description"]],
        },
        {
            'type_name': 'Punch',
            'apiUrl': '/v1/timekeeping/punches/import',
            'allowableErrors': [{
                errorCode: 'WTK-120127"',
                errorColor: 'blue',
                errorMessage: 'The punch has previously been loaded'
            }],
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personnum'
                },
                {
                    visible: true,
                    data: 'Punch DTM',
                    name: 'punchdtm'
                },
                {
                    visible: true,
                    data: 'Override Type',
                    name: 'override',
                    datasource: ['In Punch', 'New Shift', 'Out Punch']
                },
                //{ visible: true,data: 'Job Path',name: 'jobpath'},
                { visible: true,data: 'Workrule',name: 'workrule'},
                /*{ visible: true,data: 'Cost Center',name: 'costcenter', datasource:{apiurl:'/v1/commons/cost_centers',tag:'name'}},
                { visible: true,data: 'Labor Categories',name: 'laborcats', }
                */
            ],

            'apiMap': function(d) {
                d.punchdtm = d.punchdtm.replace(' ', 'T')

                //tString = d.jobpath + ';' + d.workrule + ';' + d.costcenter + ';' + d.laborcats
                var x = {
                    "accrualValidationRequired": true,
                    "managerRole": true,
                    "punches": [{
                        "punchDtm": d.punchdtm,
                        "employee": {
                            "qualifier": d.personnum
                        },
                        "typeOverride": {
                            "id": ""
                        },
                        "workRule": {
                            "qualifier": d.workrule
                          }
                          
                    }]
                }
                punchOverrideTypes = [{
                        vname: 'In Punch',
                        poid: 2
                    },
                    {
                        vname: 'New Shift',
                        poid: 3
                    },
                    {
                        vname: 'Out Punch',
                        poid: 4
                    },
                ]
                let poid
                $(punchOverrideTypes).each(function(k, v) {
                    if (d.override == v.vname) poid = v.poid
                })

                if (d.workrule == '' || d.workrule == null){delete x.punches[0].workRule}

                //if (tString == ';;;') delete x.punches[0].transfer
                if (poid) x.punches[0].typeOverride.id = poid
                else delete x.punches[0].typeOverride

                //if (x.color == '') delete x['color']
                //TODO: CHECK TO SEE IF CERTAIN FIELDS ARE NULL not passing if null
                return x
            },
            limit: 10000,
            limitCheck: function(tdata) {
                emessage = ""
                elist = []
                tdata.forEach(function(v, k) {
                    if (v[0]) elist.push(v[0])
                })
                elist = elist.filter((value, index, self) => {
                    return self.indexOf(value) === index
                })

                if (elist.length > this.limit) emessage = "You are attempting to import too many records (Distinct Employees = " + elist.length + " | Limit = " + this.limit + ")"
                console.log(emessage)
                return emessage
            }
            /*
            ,'data' : [
                ["20329","2019-09-11 08:00"],
                ["20320","2019-09-11 08:00"],
                ["20321","2019-09-11 08:00"]
            ]
            */
        },

        {
            'type_name': 'Punch',
            'apiUrl': '/v1/timekeeping/punches/import',
            'allowableErrors': [{
                errorCode: 'WTK-120127"',
                errorColor: 'blue',
                errorMessage: 'The punch has previously been loaded'
            }],
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personnum'
                },
                {
                    visible: true,
                    data: 'Punch DTM',
                    name: 'punchdtm'
                },
                {
                    visible: true,
                    data: 'Override Type',
                    name: 'override',
                    datasource: ['In Punch', 'New Shift', 'Out Punch']
                },
                { visible: true,data: 'Workrule',name: 'workrule'},
            ],

            'apiMap': function(d) {
                d.punchdtm = d.punchdtm.replace(' ', 'T')

                //tString = d.jobpath + ';' + d.workrule + ';' + d.costcenter + ';' + d.laborcats
                var x = {
                    "accrualValidationRequired": true,
                    "managerRole": true,
                    "punches": [{
                        "punchDtm": d.punchdtm,
                        "employee": {
                            "qualifier": d.personnum
                        },
                        "typeOverride": {
                            "id": ""
                        },
                        "workRule": {
                            "qualifier": d.workrule
                          }
                          
                    }]
                }
                punchOverrideTypes = [{
                        vname: 'In Punch',
                        poid: 2
                    },
                    {
                        vname: 'New Shift',
                        poid: 3
                    },
                    {
                        vname: 'Out Punch',
                        poid: 4
                    },
                ]
                let poid
                $(punchOverrideTypes).each(function(k, v) {
                    if (d.override == v.vname) poid = v.poid
                })

                if (d.workrule == '' || d.workrule == null){delete x.punches[0].workRule}

                //if (tString == ';;;') delete x.punches[0].transfer
                if (poid) x.punches[0].typeOverride.id = poid
                else delete x.punches[0].typeOverride

                //if (x.color == '') delete x['color']
                //TODO: CHECK TO SEE IF CERTAIN FIELDS ARE NULL not passing if null
                return x
            },
        },



        {
            'type_name': 'Employee Shifts',
            'apiUrl': '/v1/scheduling/schedule/shifts',
            'async': false,
	    'data':
		[["person001","2020-01-06","9a-5p","REGULAR_SEGMENT","1","09:00","1","17:00","","","","","","","","","",""],
		["person001","2020-01-05","9a-5p 30 minute meal","REGULAR_SEGMENT","1","09:00","1","12:30","BREAK_SEGMENT","1","12:30","1","13:00","REGULAR_SEGMENT","1","13:00","1","17:00"],
		["person001","2020-01-01","5p-2a","REGULAR_SEGMENT","1","17:00","2","02:00","","","","","","","","","",""]],
            'cdata': [{
                    visible: true,
                    data: 'Employee ID',
                    name: 'employee'
                },
                {
                    visible: true,
                    data: 'Start Date',
                    name: 'startDate'
                },
                {
                    visible: true,
                    data: 'Label',
                    name: 'label'
                },
                {
                    visible: true,
                    data: 'Segment 1 Type',
                    name: 'seg1Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 1 Start Day Number',
                    name: 'seg1StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 1 Start Time',
                    name: 'seg1Start'
                },
                {
                    visible: true,
                    data: 'Segment 1 End Day Number',
                    name: 'seg1EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 1 End Time',
                    name: 'seg1End'
                },
                {
                    visible: true,
                    data: 'Segment 2 Type',
                    name: 'seg2Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 2 Start Day Number',
                    name: 'seg2StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 2 Start Time',
                    name: 'seg2Start'
                },
                {
                    visible: true,
                    data: 'Segment 2 End Day Number',
                    name: 'seg2EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 2 End Time',
                    name: 'seg2End'
                },
                {
                    visible: true,
                    data: 'Segment 3 Type',
                    name: 'seg3Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 3 Start Day Number',
                    name: 'seg3StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 3 Start Time',
                    name: 'seg3Start'
                },
                {
                    visible: true,
                    data: 'Segment 3 End Day Number',
                    name: 'seg3EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 3 End Time',
                    name: 'seg3End'
                },
                {
                    visible: true,
                    data: 'Segment 4 Type',
                    name: 'seg4Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 4 Start Day Number',
                    name: 'seg4StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 4 Start Time',
                    name: 'seg4Start'
                },
                {
                    visible: true,
                    data: 'Segment 4 End Day Number',
                    name: 'seg4EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 4 End Time',
                    name: 'seg4End'
                },
                {
                    visible: true,
                    data: 'Segment 5 Type',
                    name: 'seg5Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 5 Start Day Number',
                    name: 'seg5StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 5 Start Time',
                    name: 'seg5Start'
                },
                {
                    visible: true,
                    data: 'Segment 5 End Day Number',
                    name: 'seg5EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 5 End Time',
                    name: 'seg5End'
                }

            ],
            'apiMap': function(data) {

console.log(JSON.stringify(data))

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    date = date.toISOString().substring(0, 10);
    return date;
}

startDate = new Date(data.startDate)
var y = 

{      
        "employee": data.employee,
        "startDateTime": "",
        "endDateTime": "",
        "label": data.label,       
        "segments": [
            {               
                "segmentTypeRef": {                   
                    "qualifier": data.seg1Type
                },
                "startDateTime": startDate.addDays(data.seg1StartDay-1) +'T'  + data.seg1Start,
                "endDateTime": startDate.addDays(data.seg1EndDay-1) +'T' + data.seg1End
            },
            {               
                "segmentTypeRef": {                   
                    "qualifier": data.seg2Type
                },
                "startDateTime": startDate.addDays(data.seg2StartDay-1) +'T'  + data.seg2Start,
                "endDateTime": startDate.addDays(data.seg2EndDay-1) +'T' + data.seg2End
            },
            {               
                "segmentTypeRef": {                   
                    "qualifier": data.seg3Type
                },
                "startDateTime": startDate.addDays( data.seg3StartDay-1) +'T'  + data.seg3Start,
                "endDateTime": startDate.addDays(data.seg3EndDay-1) +'T' + data.seg3End
            },
            {               
                "segmentTypeRef": {                   
                    "qualifier": data.seg4Type
                },
                "startDateTime": startDate.addDays( data.seg4StartDay-1) +'T'  + data.seg4Start,
                "endDateTime": startDate.addDays(data.seg4EndDay-1) +'T' + data.seg4End
            },
            {               
                "segmentTypeRef": {                   
                    "qualifier": data.seg5Type
                },
                "startDateTime": startDate.addDays( data.seg5StartDay-1) +'T'  + data.seg5Start,
                "endDateTime": startDate.addDays(data.seg5EndDay-1) +'T'  + data.seg5End
            }
        ],
        "deleted": false,
        "locked": false
    }

    if (data.label == '') delete y.label
		if (data.seg1Type == ''|| data.seg1Type == null){delete y.segments[0]; y.segments.slice(0, 1);console.log('null1')}
		if (data.seg2Type =='' || data.seg2Type == null){delete y.segments[1]; y.segments.slice(1, 1);console.log('null2')}
		if (data.seg3Type =='' || data.seg3Type == null){delete y.segments[2]; y.segments.slice(2, 1);console.log('null3')}
		if (data.seg4Type =='' || data.seg4Type == null){delete y.segments[3]; y.segments.slice(3, 1);console.log('null4')}
		if (data.seg5Type =='' || data.seg5Type == null){delete y.segments[4]; y.segments.slice(4, 1);console.log('null5')}

var filteredArray = y.segments.filter(Boolean)
    y.segments = filteredArray
    y.endDateTime = y.segments[y.segments.length-1].endDateTime
    y.startDateTime = y.segments[0].startDateTime
    console.log(y)

console.log(JSON.stringify(y))

                x = y
                return x
            },
        },













{
            'type_name': 'Shift Templates',
            'apiUrl': '/v1/scheduling/shift_templates',
            'async': false,
	    'data':
		[["Example Simple Shift","Meaningful Description","9a-5p","REGULAR_SEGMENT","1","09:00","1","17:00","","","","","","","","","",""],
		["Example Shift with Meal","Meaningful Description","9a-5p 30 minute meal","REGULAR_SEGMENT","1","09:00","1","12:30","BREAK_SEGMENT","1","12:30","1","13:00","REGULAR_SEGMENT","1","13:00","1","17:00"],
		["Example Shift Midnight","Meaningful Description","5p-2a","REGULAR_SEGMENT","1","17:00","2","02:00","","","","","","","","","",""]],
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Label',
                    name: 'label'
                },
                {
                    visible: true,
                    data: 'Segment 1 Type',
                    name: 'seg1Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 1 Start Day Number',
                    name: 'seg1StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 1 Start Time',
                    name: 'seg1Start'
                },
                {
                    visible: true,
                    data: 'Segment 1 End Day Number',
                    name: 'seg1EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 1 End Time',
                    name: 'seg1End'
                },
                {
                    visible: true,
                    data: 'Segment 2 Type',
                    name: 'seg2Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 2 Start Day Number',
                    name: 'seg2StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 2 Start Time',
                    name: 'seg2Start'
                },
                {
                    visible: true,
                    data: 'Segment 2 End Day Number',
                    name: 'seg2EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 2 End Time',
                    name: 'seg2End'
                },
                {
                    visible: true,
                    data: 'Segment 3 Type',
                    name: 'seg3Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 3 Start Day Number',
                    name: 'seg3StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 3 Start Time',
                    name: 'seg3Start'
                },
                {
                    visible: true,
                    data: 'Segment 3 End Day Number',
                    name: 'seg3EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 3 End Time',
                    name: 'seg3End'
                },
                {
                    visible: true,
                    data: 'Segment 4 Type',
                    name: 'seg4Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 4 Start Day Number',
                    name: 'seg4StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 4 Start Time',
                    name: 'seg4Start'
                },
                {
                    visible: true,
                    data: 'Segment 4 End Day Number',
                    name: 'seg4EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 4 End Time',
                    name: 'seg4End'
                },
                {
                    visible: true,
                    data: 'Segment 5 Type',
                    name: 'seg5Type',
		    datasource: ['REGULAR_SEGMENT','BREAK_SEGMENT']
                },
                {
                    visible: true,
                    data: 'Segment 5 Start Day Number',
                    name: 'seg5StartDay'
                },
                {
                    visible: true,
                    data: 'Segment 5 Start Time',
                    name: 'seg5Start'
                },
                {
                    visible: true,
                    data: 'Segment 5 End Day Number',
                    name: 'seg5EndDay'
                },
                {
                    visible: true,
                    data: 'Segment 5 End Time',
                    name: 'seg5End'
                }

            ],
            'apiMap': function(data) {

console.log(JSON.stringify(data))
var y = 

{      
        "name": data.name,
        "description": data.description,
        "startDateTime": '1900-01-01T' + data.startTime,
        "endDateTime": '1900-01-01T' + data.endTime,
        "label": data.label,       
        "segments": [
            {               
                "segmentType": {                   
                    "qualifier": data.seg1Type
                },
                "startDateTime": '1900-01-0'+ data.seg1StartDay +'T'  + data.seg1Start,
                "endDateTime": '1900-01-0'+ data.seg1EndDay +'T' + data.seg1End
            },
            {               
                "segmentType": {                   
                    "qualifier": data.seg2Type
                },
                "startDateTime": '1900-01-0'+ data.seg2StartDay +'T'  + data.seg2Start,
                "endDateTime": '1900-01-0'+ data.seg2EndDay +'T' + data.seg2End
            },
            {               
                "segmentType": {                   
                    "qualifier": data.seg3Type
                },
                "startDateTime": '1900-01-0'+ data.seg3StartDay +'T'  + data.seg3Start,
                "endDateTime": '1900-01-0'+ data.seg3EndDay +'T' + data.seg3End
            },
            {               
                "segmentType": {                   
                    "qualifier": data.seg4Type
                },
                "startDateTime": '1900-01-0'+ data.seg4StartDay +'T'  + data.seg4Start,
                "endDateTime": '1900-01-0'+ data.seg4EndDay +'T' + data.seg4End
            },
            {               
                "segmentType": {                   
                    "qualifier": data.seg5Type
                },
                "startDateTime": '1900-01-0'+ data.seg5StartDay +'T'  + data.seg5Start,
                "endDateTime": '1900-01-0'+ data.seg5EndDay +'T'  + data.seg5End
            }
        ],
        "deleted": false,
        "locked": false
    }

    if (data.label == '') delete y.label
		if (data.seg1Type == ''|| data.seg1Type == null){delete y.segments[0]; y.segments.slice(0, 1);console.log('null1')}
		if (data.seg2Type =='' || data.seg2Type == null){delete y.segments[1]; y.segments.slice(1, 1);console.log('null2')}
		if (data.seg3Type =='' || data.seg3Type == null){delete y.segments[2]; y.segments.slice(2, 1);console.log('null3')}
		if (data.seg4Type =='' || data.seg4Type == null){delete y.segments[3]; y.segments.slice(3, 1);console.log('null4')}
		if (data.seg5Type =='' || data.seg5Type == null){delete y.segments[4]; y.segments.slice(4, 1);console.log('null5')}

var filteredArray = y.segments.filter(Boolean)
    y.segments = filteredArray
    y.endDateTime = y.segments[y.segments.length-1].endDateTime
    y.startDateTime = y.segments[0].startDateTime
    console.log(y)

console.log(JSON.stringify(y))

                x = y
                return x
            },
        },





{//TFS4233
    'type_name': 'R7 -Setup - Known Places Create Update',
    'apiUrl': '/v1/commons/known_places/multi_upsert',
    'async': false,
    'cdata': [{
            visible: true,
            data: 'Name*',
            name: 'name',
            tooltip: ''
        },
        {
            visible: true,
            data: 'Description',
            name: 'description',
            tooltip: ''
        },
        {
            visible: true,
            data: 'Latitude',
            name: 'latitude',
            tooltip: ''
        },
        {
            visible: true,
            data: 'Longitude',
            name: 'longitude',
            tooltip: ''
        },
        {
            visible: true,
            data: 'Radius',
            name: 'radius',
            tooltip: ''
        },
        {
            visible: true,
            data: 'Accuracy',
            name: 'accuracy',
            tooltip: ''
        },
        {
            visible: true,
            data: 'Location Path',
            name: 'locationPath',
            tooltip: ''
        }
    
    
    ],
    'apiMap': function(d) {
        var y = 
        
            {
              "accuracy": d.accuracy,
              "active": true,
              "description": d.description,
              "latitude": d.latitude,
              "locations": [
                {
                  "qualifier": d.locationPath
                }
              ],
              "longitude": d.longitude,
              "name": d.name,
              "radius": d.radius,
            }
          
if (d.accuracy == null || d.accuracy == ""){y.accuracy = 75}
if (d.description == null || d.description == ""){delete y.description}

        x = [y]
        return x
    },
},











        {

            'type_name': 'Display Profiles',
            'apiUrl': '/v1/commons/display_profiles',
            'async': false,
            'cdata': [{
                    visible: true,
                    data: 'Name',
                    name: 'name'
                },
                {
                    visible: true,
                    data: 'Description',
                    name: 'description'
                },
                {
                    visible: true,
                    data: 'Timekeeping Alert Profile',
                    name: 'alertProfile',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/timekeeping_alert_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Forecast Planner Profile',
                    name: 'forecastPlannerProfile',
                    datasource: {
                        apiurl: '/v1/forecasting/forecast_planner_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Schedule Planner Profile',
                    name: 'schedulePlannerProfile',
                    datasource: {
                        apiurl: '/v1/scheduling/setup/schedule_planner_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Schedule Period*',
                    name: 'schedulePeriod'
                },
                {
                    visible: true,
                    data: 'People Information Profile',
                    name: 'peopleInformationProfile',
                    datasource: {
                        apiurl: '/v1/commons/person_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Manager Project TC Settings',
                    name: 'managerProjectTcSettings',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/timecard_settings',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Manager Hourly TC Settings',
                    name: 'managerHourlyTcSettings',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/timecard_settings',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Employee Project TC Settings',
                    name: 'employeeProjectTcSettings',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/timecard_settings',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Employee Hourly TC Settings',
                    name: 'employeeHourlyTcSettings',
                    datasource: {
                        apiurl: '/v1/timekeeping/setup/timecard_settings',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Hyperfind Profile*',
                    name: 'hyperfindProfile',
                    datasource: {
                        apiurl: '/v1/commons/hyperfind_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Home Page*',
                    name: 'homePage'
                },
                {
                    visible: true,
                    data: 'Calendar Profile',
                    name: 'calendarProfile',
                    datasource: {
                        apiurl: '/v1/scheduling/setup/ess_calendar_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Control Centre Profile',
                    name: 'controlCentreProfile',
                    datasource: {
                        apiurl: '/v1/commons/control_center_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Dataview Profile',
                    name: 'dataviewProfile',
                    datasource: {
                        apiurl: '/v1/commons/dataview_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Workload Planner Profile',
                    name: 'workloadPlannerProfile',
                    datasource: {
                        apiurl: '/v1/scheduling/setup/workload_planner_profiles',
                        tag: 'name'
                    }
                },
                {
                    visible: true,
                    data: 'Display Shift Labels',
                    name: 'displayShiftLabels',
                    datasource: ['TRUE', 'FALSE']
                },
                {
                    visible: true,
                    data: 'Display Durations in Hours and Minutes',
                    name: 'displayDurationsInHours',
                    datasource: ['TRUE', 'FALSE']
                }




            ],
            'apiMap': function(d) {

                var y = {
                    "name": d.name,
                    "description": d.description,
                    "alertProfile": {
                        "qualifier": d.alertProfile
                    },
                    "forecastPlannerProfile": {
                        "qualifier": d.forecastPlannerProfile
                    },
                    "schedulePlannerProfile": {
                        "qualifier": d.schedulePlannerProfile
                    },
                    "schedulePeriod": {
                        "qualifier": d.schedulePeriod
                    },
                    "peopleInformationProfile": {
                        "qualifier": d.peopleInformationProfile
                    },
                    "managerProjectTimecardSetting": {
                        "qualifier": d.managerProjectTcSettings
                    },
                    "managerHourlyTimecardSetting": {
                        "qualifier": d.managerHourlyTcSettings
                    },
                    "employeeProjectTimecardSetting": {
                        "qualifier": d.employeeProjectTcSettings
                    },
                    "employeeHourlyTimecardSetting": {
                        "qualifier": d.employeeHourlyTcSettings
                    },
                    "hyperfindProfile": {
                        "qualifier": d.hyperfindProfile
                    },
                    "homePage": {
                        "qualifier": d.homePage
                    },
                    "essCalendarProfile": {
                        "qualifier": d.calendarProfile
                    },
                    "controlCenterProfile": {
                        "qualifier": d.controlCentreProfile
                    },
                    "dataViewProfile": {
                        "qualifier": d.dataviewProfile
                    },
                    "workloadPlannerProfile": {
                        "qualifier": d.workloadPlannerProfile
                    },
                    "displayShiftLabels": d.displayShiftLabels,
                    "displayDurationInHours": d.displayDurationInHours
                }

                if (d.description == '') delete y.description
                if (d.alertProfile == '') delete y.alertProfile
                if (d.forecastPlannerProfile == '') delete y.forecastPlannerProfile
                if (d.schedulePlannerProfile == '') delete y.schedulePlannerProfile
                if (d.schedulePeriod == '') delete y.schedulePeriod
                if (d.peopleInformationProfile == '') delete y.peopleInformationProfile
                if (d.managerProjectTcSettings == '') delete y.managerProjectTimecardSettings
                if (d.managerHourlyTcSettings == '') delete y.managerHourlyTimecardSettings
                if (d.employeeProjectTcSettings == '') delete y.employeeProjectTimecardSetting
                if (d.employeeHourlyTcSettings == '') delete y.employeeHourlyTimecardSettings
                if (d.hyperfindProfile == '') delete y.hyperfindProfile
                if (d.homePage == '') delete y.homePage
                if (d.calendarProfile == '') delete y.essCalendarProfile
                if (d.controlCenterProfile == '') delete y.controlCenterProfile
                if (d.dataviewProfile == '') delete y.dataViewProfile
                if (d.workloadPlannerProfile == '') delete y.workloadPlannerProfile
                if (d.displayShiftLabels == '') y.displayShiftLabels = 'true'
                if (d.displayShiftLabels == 'TRUE') y.displayShiftLabels = 'true'
                if (d.displayShiftLabels == 'FALSE') y.displayShiftLabels = 'false'
                if (d.displayDurationInHours == '') y.displayDurationInHours = 'true'
                if (d.displayDurationInHours == 'TRUE') y.displayDurationInHours = 'true'
                if (d.displayDurationInHours == 'FALSE') y.displayDurationInHours = 'false'

                x = y
                console.log(y)
                return x
            }
        },
        {
            'type_name': 'Pay Code Edit',
            'apiUrl': '/v1/timekeeping/pay_code_edits/import',
            /*
            'allowableErrors': [{
                errorCode: 'WTK-120127"',
                errorColor: 'blue',
                errorMessage: 'The punch has previously been loaded'
            }],
            */
            'cdata': [{
                    visible: true,
                    data: 'Person Number',
                    name: 'personnum'
                },
                {
                    visible: true,
                    data: 'Apply Date',
                    name: 'applydt'
                },
                {
                    visible: true,
                    data: 'Start Time',
                    name: 'stm'
                },
                {
                    visible: true,
                    data: 'Paycode',
                    name: 'paycode'
                },
                {
                    visible: true,
                    data: 'Amount',
                    name: 'amount'
                },
                {
                    visible: true,
                    data: 'Type',
                    name: 'type',
                    datasource: ['HOUR', 'DAY', 'MONEY']
                }
                /*
                { visible: true,data: 'Job Path',name: 'jobpath'},
                { visible: true,data: 'Workrule',name: 'workrule'},
                { visible: true,data: 'Cost Center',name: 'costcenter', datasource:{apiurl:'/v1/commons/cost_centers',tag:'name'}},
                { visible: true,data: 'Labor Categories',name: 'laborcats' }
                */
            ],
            'apiMap': function(d) {
                /*
                if (d.jobpath == null) d.jobpath = ""
                if (d.workrule == null) d.workrule = ""
                if (d.costcenter == null) d.costcenter = ""
                if (d.laborcats == null) d.laborcats = ""
                tString = d.jobpath + ';' + d.workrule + ';' + d.costcenter + ';' + d.laborcats
                */
                var x = {
                    "payCodeEdits": [{
                        "startDateTime": d.applydt + 'T' + d.stm,
                        "amountType": d.type,
                        "paycode": {
                            "qualifier": d.paycode
                        },
                        "moneyAmount": "",
                        "applyDate": d.applydt,
                        "employee": {
                            "qualifier": d.personnum
                        },
                        "durationInHours": "",
                        "durationInDays": ""
                        /*
                        "transfer": {
                            "transferString": tString,
                          }
                          */
                    }]
                }

                //if (tString == ';;;') delete x.payCodeEdits[0].transfer

                if (d.type == 'MONEY') x.payCodeEdits[0].moneyAmount = d.amount
                if (d.type == 'DAY') x.payCodeEdits[0].durationInDays = d.amount
                if (!d.type || d.type == 'HOUR') x.payCodeEdits[0].durationInHours = d.amount
                if (!x.payCodeEdits[0].amountType) x.payCodeEdits[0].amountType = "HOUR"

                if (!x.payCodeEdits[0].moneyAmount) delete x.payCodeEdits[0]['moneyAmount']
                if (!x.payCodeEdits[0].durationInDays) delete x.payCodeEdits[0]['durationInDays']
                if (!x.payCodeEdits[0].durationInHours) delete x.payCodeEdits[0]['durationInHours']

                //TODO: CHECK TO SEE IF CERTAIN FIELDS ARE NULL not passing if null
                return x
            },
            removeExisting: {
                datasource: {
                    apiurl: '/v1/timekeeping/timecard/multi_read',
                    pdata: {
                        "select": [],
                        "where": {
                            "dateRange": {
                                "endDate": "",
                                "startDate": ""
                            },
                            "employees": {
                                "qualifiers": []
                            }
                        }
                    }
                },
                checkExists: function(o, existRes) {
                    inExistArr = false
                    pce = o.api.payCodeEdits[0]
                    $(existRes).each(function(k, v) {
                        //console.log('compare',pce,v)
                        inExistArr = false
                        let amount
                        if (pce.amountType == 'MONEY') amount = pce.moneyAmount
                        if (pce.amountType == 'DAY') amount = pce.durationInDays
                        if (pce.amountType == 'HOUR') amount = pce.durationInHours

                        if (v.amountType == 'MONEY') v.amount = v.moneyAmount
                        if (v.amountType == 'DAY') v.amount = v.durationInDays
                        if (v.amountType == 'HOUR') v.amount = v.durationInHours

                        if (
                            pce.applyDate == v.applyDate &&
                            pce.employee.qualifier == v.employee.qualifier &&
                            pce.paycode.qualifier == v.paycode.qualifier &&
                            amount == v.amount
                        ) {
                            inExistArr = true
                            return inExistArr
                        }
                        //console.log(inExistArr,pce.employee.qualifier + '|' + pce.applyDate + '|' + pce.paycode.qualifier + '|' + pce.amount + '||' + v.employee.qualifier + '|' + v.applyDate + '|' + v.paycode.qualifier + '|' + v.amount)

                    })
                    return inExistArr
                }
            },
            updateRemoveExisting: function(da) {

                let el = Enumerable.From(da)
                    .GroupBy("$.personnum", null,
                        function(key, g) {
                            return {
                                personnum: key,
                                min_effdt: g.Min("$.applydt"),
                                max_effdt: g.Max("$.applydt")
                            }
                        })
                    .ToArray();

                let empList = []
                $(el).each(function(k, v) {
                    empList.push(v.personnum)
                })

                let mnmxEffDt = Enumerable.From(da)
                    .GroupBy("1", null,
                        function(key, g) {
                            return {
                                id: key,
                                mn_applydt: g.Min("$.applydt"),
                                mx_applydt: g.Max("$.applydt")
                            }
                        }).ToArray()

                this.removeExisting.datasource.pdata.where.dateRange.startDate = mnmxEffDt[0].mn_applydt
                this.removeExisting.datasource.pdata.where.dateRange.endDate = mnmxEffDt[0].mx_applydt
                this.removeExisting.datasource.pdata.where.employees.qualifiers = empList
            },
            removeExistingResponse: "",
            updateRemoveExistingResponse: function(res) {
                oArr = []
                $(res).each(function(k, v) {

                    if (v.hasOwnProperty('payCodeEdits')) {
                        $(v.payCodeEdits).each(function(kk, vv) {
                            oArr.push(vv)
                        })
                    }
                })
                return oArr
            },
            limit: 500,
            limitCheck: function(tdata) {
                emessage = ""
                elist = []
                tdata.forEach(function(v, k) {
                    if (v[0]) elist.push(v[0])
                })
                elist = elist.filter((value, index, self) => {
                    return self.indexOf(value) === index
                })

                if (elist.length > this.limit) emessage = "You are attempting to import too many records (Distinct Employees = " + elist.length + " | Limit = " + this.limit + ")"
                console.log(emessage)
                return emessage
            }
            /*
            ,'data' : [
                ["20329","2019-09-11","08:00","Regular",1.00,""],
                ["20321","2019-09-11","08:00","Regular",1.00,""],
                ["20323","2019-09-11","08:00","Regular",1.00,""]
            ]
            */
        }
    ]
}