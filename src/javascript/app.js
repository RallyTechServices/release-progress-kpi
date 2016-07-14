Ext.define("release-progress-kpi", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "release-progress-kpi"
    },
    
    config: {
        defaultSettings: {
            baselinePoints: 150
        }
    },

    getSettingsFields: function() {
        var me = this;
        me.kanbanProcessField = 'ScheduleState';

        return  [
            {
                name: 'baselinePoints',
                xtype: 'textfield',
                fieldLabel: 'Baseline Story Points',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            }
        ];

    },

    launch: function() {
        var me = this;
        me._addSelector();
    },
      
    _addSelector: function() {
        var me = this;
        var selector_box = this.down('#selector_box');
        selector_box.removeAll();

        selector_box.add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release:',
            width:500,
            margin:10,
            showArrows : false,
            context : this.getContext(),
            growToLongestValue : true,
            defaultToCurrentTimebox : true,
            listeners: {
                scope: me,
                change: function(rcb) {
                    me.release = rcb;
                    me._calculateAndDisplayGrid();

                }
            }
        });
        //me._calculateAndDisplayGrid();
    },

    _calculateAndDisplayGrid: function(){
        //this.setLoading("Loading...");
        var me = this;
        me.setLoading(true);
        me._calculateGridValues().then({
            scope: me,
            success: function(store) {
                me.setLoading(false);
                me._displayGrid(store);
            },
            failure: function(error_message){
                me.setLoading(false);
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },

    _calculateGridValues: function(){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;
       //get all projects on current scope
       //get selected release for current project and calculate the SP /Schedule

       // Deft.Chain.parallel([
       //      me._getProjects
       //  ],me).then({

        Deft.Promise.all(me._getProjects()).then({            
            scope: me,
            success: function(records) {
                me.logger.log('Results:',records);
                //Loop thro the projects and get selected release data for each project and calculate SP /Schedule

                var promises = [];
                Ext.Array.each(records, function(record){
                    promises.push(function(){
                        return me._getCollection(record); 
                    });
                });

                Deft.Chain.sequence(promises).then({
                        success: function(results){
                            me.logger.log('_calculateGridValues',results);
                            //process the results.
                            var projects = [];
                                for (var i = 0; records && i < records.length; i++) {
                                        var project = {
                                            ProjectName: records[i].get('Name'),
                                            SPSchedules:results[i][0],
                                            Features:results[i][1],
                                            Velocity:results[i][2]
                                        }
                                        projects.push(project);
                                }
                                me.logger.log('Projects >>',projects);
                                // create custom store (call function ) combine permissions and results in to one.
                                // var store = Ext.create('Rally.data.custom.Store', {
                                //     data: projects,
                                //     scope: this
                                // });
                                // deferred.resolve(store); 

                                var store = Ext.create('Rally.data.custom.Store', {
                                    data: projects
                                });

                            deferred.resolve(store);
                           // deferred.resolve(results);
                        },
                        scope:me                   
                });
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem Loading Timebox data', msg);
            }
        });
        return deferred.promise;        

    },

    _getCollection: function(project){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var project_promises = [];

        
        project_promises.push(function(){
            return me._getSPSchedules(project); 
        });

        project_promises.push(function(){
            return me._getFeatures(project);
        });

        project_promises.push(function(){
            return me._getVelocity(project);
        });

        Deft.Chain.sequence(project_promises).then({
            success: function(results){
                me.logger.log('project_promises',results);
                deferred.resolve(results);
            },
            scope:me                   
        });

        return deferred.promise;
    },

    // 1) SP / Schedule. 
    // Measures whether the team has accepted points in accordance with a rate that would be required to finish all planned points by the end of the release. 

    // Calculation:
    // Story points accepted to date in this release / points required to be accepted by this date to finish total story point scope by end of release. 

    // Example: 
    // 90 day release. We are on day 45 (half-way mark). Team has 100 points planned for the release. They have accepted 45 points to date. 
    // 45/90 = .5  (percent of schedule complete)
    // .5 * 100 = 50 (expected points complete at this time)
    // 45/50 = 0.9 (ratio of actual to expected)


    // 4) Scope
    // This is slightly different than the others. It is not a ratio, but a percent growth. It requires manual entry of a baseline story points number to understand what the starting scope should be. This is because they may not have the stories paired to the release on day one…if it was automatic, it might break and they would have no way to fix it. 

    // Calculation: 
    // (Current story points planned to the release - baseline story points) / baseline story points. 

    // Example:
    // Current points planned to the release = 250. Baseline (manually entered setting) = 150. 
    // ((250-150) / 150) * 100 = 66.7% Scope Growth. 


    _getSPSchedules: function(project){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var release_name = me.release.rawValue;
        var project_obejctID = project.get('ObjectID');
        filters = [{property:'Project.ObjectID',value: project_obejctID},{property:'Name',value: release_name}];

        filter = Rally.data.wsapi.Filter.and(filters);
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Release',
            fetch: ['ObjectID','Name','PlanEstimate','Accepted'],
            filters: filter
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    //me.logger.log('Schedule value',records);
                    var result = {}

                    if(records[0] && records[0].get('PlanEstimate') > 0){
                        result.schedule_result = records[0].get('Accepted') / ((records[0].get('Accepted') / records[0].get('PlanEstimate')) * 100) ;

                        result.scope = ((records[0].get('PlanEstimate') - me.getSetting('baselinePoints')) / me.getSetting('baselinePoints')) * 100
                    }
                    deferred.resolve(result);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;        
    },

    // 3) Velocity. 
    // Measures whether the teams actual velocity (average of last 3 iterations) is sufficient to complete stories planned for remaining iterations. Note: effectively ignore the iteration in progress. 

    // Calculation:
    // Actual velocity (avg. of last 3 completed iterations) / (Sum of points in remaining iterations in release / number of iterations remaining in release)

    // Example:
    // 6 iterations in release. Current iteration is middle of iteration #3. Avg. Velocity = 30. Total points in remaining 4 iterations is 120. 
    // 30 / (120/4) = 1.0
    // 1.0 indicates that if team maintains velocity, they will complete all stories currently scheduled. 

    _getVelocity: function(project){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var release_name = me.release.rawValue;
        var release_start_date = me.release.valueModels[0].get('ReleaseStartDate');
        var release_end_date = me.release.valueModels[0].get('ReleaseDate');
        var project_obejctID = project.get('ObjectID');
        
        var today = new Date();

        var filters = [{property:'Project.ObjectID',value: project_obejctID},
                 //   {property:'EndDate', operator: '>', value: today},
                    {property:'EndDate', operator: '<=', value: release_end_date},
                    {property:'StartDate', operator: '>=', value:release_start_date }];

        var filter = Rally.data.wsapi.Filter.and(filters);
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Iteration',
            fetch: ['ObjectID','Name','PlanEstimate','StartDate','EndDate'],
            filters: filter,
            sorters: [{
                        property: 'EndDate',
                        direction: 'DESC'
                    }]
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    me.logger.log('_getIterations',records);
                var result = 0;
                var velocity = 0;
                var past_velocity_length = 0;
                var future_velocity_length = 0;
                var remining_plan_estimate = 0;

                Ext.Array.each(records,function(iteration){
                    if(iteration.get('EndDate') < today){
                        velocity += iteration.get('PlanEstimate') ? iteration.get('PlanEstimate') : 0;
                        past_velocity_length += 1;
                    }else{
                        remining_plan_estimate += iteration.get('PlanEstimate') ? iteration.get('PlanEstimate') : 0;
                        future_velocity_length += 1;
                    }
                });

                var avg_velocity = velocity / past_velocity_length;

                result = avg_velocity > 0 &&  remining_plan_estimate > 0 && future_velocity_length > 0 ? avg_velocity / (remining_plan_estimate/future_velocity_length) : 0;
                                
                me.logger.log('_getVelocity', result, velocity , past_velocity_length,avg_velocity,remining_plan_estimate,future_velocity_length)

                deferred.resolve(result);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;   
    },

    // _calculateVelocity: function(project){
    //     var deferred = Ext.create('Deft.Deferred');
    //     var me = this;
    //     var iteration_promises = [];

    //     iteration_promises.push(function(){
    //         return me._getPastIterations(project); 
    //     });

    //     iteration_promises.push(function(){
    //         return me._getFutureIterations(project);
    //     });

    //     Deft.Chain.sequence(iteration_promises).then({
    //         success: function(results){
    //             me.logger.log('_calculateVelocity',results);
    //             var result = 0;
    //             var velocity = 0;
    //             var remining_plan_estimate = 0;

    //             Ext.Array.each(results[0],function(iteration){
    //                 velocity += iteration.get('PlanEstimate') ? iteration.get('PlanEstimate') : 0;
    //             });

    //             Ext.Array.each(results[1],function(iteration){
    //                 remining_plan_estimate += iteration.get('PlanEstimate') ? iteration.get('PlanEstimate') : 0;
    //             });

    //             var avg_velocity = velocity / results[0].length;

    //             deferred.resolve(result);
    //         },
    //         scope:me                   
    //     });

    //     return deferred.promise;
    // },

    // _getPastIterations: function(project){
    //     var deferred = Ext.create('Deft.Deferred');
    //     var me = this;
    //     var release_name = me.release.rawValue;
    //     var release_start_date = me.release.valueModels[0].get('ReleaseStartDate');
    //     var release_end_date = me.release.valueModels[0].get('ReleaseDate');
    //     var project_obejctID = project.get('ObjectID');
        
    //     filters = [{property:'Project.ObjectID',value: project_obejctID},
    //                 {property:'EndDate', operator: '<=', value: release_end_date},
    //                 {property:'StartDate', operator: '>=', value:release_start_date }];

    //     filter = Rally.data.wsapi.Filter.and(filters);
        
    //     Ext.create('Rally.data.wsapi.Store', {
    //         model: 'Iteration',
    //         fetch: ['ObjectID','Name','PlanEstimate','PlannedVelocity'],
    //         filters: filter,
    //         sorters: [{
    //                     property: 'EndDate',
    //                     direction: 'DESC'
    //                 }]
    //         //        ,
    //         // limit: 3,
    //         // pageSize: 3
    //     }).load({
    //         callback : function(records, operation, successful) {
    //             if (successful){
    //                 me.logger.log('_getIterations',records);
    //                 deferred.resolve(records);
    //             } else {
    //                 me.logger.log("Failed: ", operation);
    //                 deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
    //             }
    //         }
    //     });
    //     return deferred.promise;        
    // },

    // _getFutureIterations: function(project){
    //     var deferred = Ext.create('Deft.Deferred');
    //     var me = this;
    //     var release_name = me.release.rawValue;
    //     var release_start_date = me.release.valueModels[0].get('ReleaseStartDate');
    //     var release_end_date = me.release.valueModels[0].get('ReleaseDate');
    //     var project_obejctID = project.get('ObjectID');
        
    //     var today = Ext.Date.format(new Date(), 'Y-m-d');

    //     var filters = [{property:'Project.ObjectID',value: project_obejctID},
    //                 {property:'EndDate', operator: '>', value: today},
    //                 {property:'EndDate', operator: '<=', value: release_end_date},
    //                 {property:'StartDate', operator: '>=', value:release_start_date }];

    //     var filter = Rally.data.wsapi.Filter.and(filters);
        
    //     Ext.create('Rally.data.wsapi.Store', {
    //         model: 'Iteration',
    //         fetch: ['ObjectID','Name','PlanEstimate'],
    //         filters: filter,
    //         sorters: [{
    //                     property: 'EndDate',
    //                     direction: 'DESC'
    //                 }]
    //     }).load({
    //         callback : function(records, operation, successful) {
    //             if (successful){
    //                 me.logger.log('_getIterations',records);
    //                 deferred.resolve(records);
    //             } else {
    //                 me.logger.log("Failed: ", operation);
    //                 deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
    //             }
    //         }
    //     });
    //     return deferred.promise;        
    // },

    // 2) Features.  
    // Measures whether the team has completed features in accordance with a rate that would be required to finish all planned features by the end of the release. 

    // Calculation:
    // Number of Features complete (100% by Story Count) to date in this release / feature count required to be complete by this date to finish all features by end of release. For “required to be complete”, always round down. For example: if by today’s date 4.7 features SHOULD be complete, treat that as 4. 

    // Example:
    // 90 day release. We are on day 45 (half-way mark). Team has 20 features planned for the release. They have finished 5 to date.
    // 45/90 = .5  (percent of schedule complete)
    // 0.5 * 20 = 10 (expected features complete at this time)
    // 5/10 = 0.5 (ratio of actual to expected)

    _getFeatures: function(project){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var release_name = me.release.rawValue;
        var project_obejctID = project.get('ObjectID');
        filters = [{property:'Project.ObjectID',value: project_obejctID},{property:'Release.Name',value: release_name}];

        var release_start_date = me.release.valueModels[0].get('ReleaseStartDate');
        var release_end_date = me.release.valueModels[0].get('ReleaseDate');
        var today = new Date();

        var project_obejctID = project.get('ObjectID');
        
        var total_release_days = Math.abs( Rally.util.DateTime.getDifference(release_start_date,release_end_date,'day') );
        var total_days_done = Math.abs( Rally.util.DateTime.getDifference(release_start_date,today,'day') );
        
        var per_sch_complete = total_days_done / total_release_days;

        console.log('total_release_days,total_days_done>>',total_release_days,total_days_done);

        filter = Rally.data.wsapi.Filter.and(filters);
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'PortfolioItem/Feature',
            fetch: ['ObjectID','Name','PercentDoneByStoryCount'],
            filters: filter
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    var feature_result = 0;
                    var total_features = records.length;
                    var accepted_count = 0;
                    
                    Ext.Array.each(records,function(rec){
                        if(1 == rec.get('PercentDoneByStoryCount')){
                            accepted_count += 1;
                        }
                    });

                    if(total_features > 0 ){
                        feature_result = accepted_count / (per_sch_complete * total_features);
                    }

                    deferred.resolve(feature_result);

                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;        
    },

    _getProjects:function(){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var project_name = this.getContext().get('project').Name;


        filters = [
             {property:'Name',  value: project_name},
             {property:'Parent.Name',  value: project_name},
             {property:'Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name},
             {property:'Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Parent.Name', value: project_name}
        ]
 
        filter = Rally.data.wsapi.Filter.or(filters);


        // Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
        //      models: ['Project'],
        //      autoLoad: true,
        //      enableHierarchy: true,
        //      filters: filter
        //   }).then({
        //     success: function(records) {
        //          deferred.resolve(records);
        //     }
        //  });

        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['ObjectID','Name'],
            //enablePostGet: true,
            filters: filter
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });

        return deferred.promise;
    },

    _fetchWsapiCount: function(model, query_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: model,
            fetch: ['ObjectID'],
            enablePostGet: true,
            filters: query_filters,
            limit: 1,
            pageSize: 1
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(operation.resultSet.totalRecords);
                } else {
                    deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store){
        this.down('#display_box').removeAll();
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn: false,            
            columnCfgs: [
                {
                    text: 'PROJECT', 
                    dataIndex: 'ProjectName',
                    flex: 2
                },                
                {
                    text: 'SP / Schedules', 
                    dataIndex: 'SPSchedules',
                    flex: 2,
                    renderer: function(SPSchedules){
                        return Ext.util.Format.number(SPSchedules.schedule_result > 0 ? SPSchedules.schedule_result : 0, "000.00");
                    }
                },                
                {
                    text: 'Features', 
                    dataIndex: 'Features',
                    flex: 2,
                    renderer: function(Features){
                        return Ext.util.Format.number(Features > 0 ? Features : 0, "000.00");
                    }
                },{
                    text: 'Velocity', 
                    dataIndex: 'Velocity',
                    flex: 2,
                    renderer: function(Velocity){
                        return Ext.util.Format.number(Velocity > 0 ? Velocity : 0, "000.00");
                    }
                },{
                    text: 'Scope', 
                    dataIndex: 'SPSchedules',
                    flex: 2,
                    renderer: function(SPSchedules){
                        return Ext.util.Format.number(SPSchedules.scope ? SPSchedules.scope : 0, "000.00")+'%';
                    }
                }


                ]
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
