//TODO: calculate the values at render so that we can show values for parents and child. 

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
    
    //grid colors
    red: '#ff9999',
    yellow: 'lightyellow',//'#ffffcc',
    green: 'lightgreen',//'#ccffcc',
    grey: '#e6e6e6',


    config: {
        defaultSettings: {
            baselinePointsFiled: 'c_BaseLinePoints',
            scheduleThresholdLow: 0.8,
            featureThresholdLow: 0.8,
            velocityThresholdLow: 0.8,
            scheduleThresholdHigh: 1.2,
            featureThresholdHigh: 1.2,
            velocityThresholdHigh: 1.2            
        }
    },

    getSettingsFields: function() {
        var me = this;
 
        return  [
            {
                name: 'baselinePointsFiled',
                xtype: 'rallyfieldcombobox',
                model: 'Release',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10                
            },
            {
                name: 'scheduleThresholdLow',
                xtype: 'textfield',
                fieldLabel: 'Schedule Threshold Low',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            },
            {
                name: 'scheduleThresholdHigh',
                xtype: 'textfield',
                fieldLabel: 'Schedule Threshold High',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            },            
            {
                name: 'featureThresholdLow',
                xtype: 'textfield',
                fieldLabel: 'Feature Threshold Low',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            },            
            {
                name: 'featureThresholdHigh',
                xtype: 'textfield',
                fieldLabel: 'Feature Threshold High',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            },
            {
                name: 'velocityThresholdLow',
                xtype: 'textfield',
                fieldLabel: 'Velocity Threshold Low',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            },
            {
                name: 'velocityThresholdHigh',
                xtype: 'textfield',
                fieldLabel: 'Velocity Threshold High',
                labelWidth: 125,
                labelAlign: 'left',
                minWidth: 50,
                margin: 10
            }                                                  
        ];
    },

    launch: function() {
        var me = this;
        me.columns = me._getColumns();
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
    },

    _calculateAndDisplayGrid: function(){
        var me = this;
        me.setLoading(true);
        me._calculateGridValues().then({
            scope: me,
            success: function(store) {
                me.setLoading(false);
                me._makeStoreAndShowGrid(store);

                //me._displayGrid(store);
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


                me._getTreeArray(records).then({
                    scope: me,
                    success:function(results){


                        // Ext.Object.each(results, function(oid,item){
                        //     item.set('SPSchedules',1);
                        //     item.set('Features',2);
                        //     item.set('Velocity',3);
                        // });

                        var promises = [];
                        Ext.Array.each(records, function(record){
                            promises.push(function(){
                                return me._getCollection(record); 
                            });
                        });

                        Deft.Chain.sequence(promises).then({
                                success: function(caclulatedResults){
                                    //process the results.


                                    for (var i = 0; records && i < records.length; i++) {

                                            results[records[i].get('ObjectID')].set('SPSchedules',caclulatedResults[i][0]);
                                            results[records[i].get('ObjectID')].set('Features',caclulatedResults[i][1]);
                                            results[records[i].get('ObjectID')].set('Velocity',caclulatedResults[i][2]);        

                                    }


                                    console.log('treeHash',results);

                                    var root_items = me.constructRootItems(results);

                                    console.log('root_items',root_items);

                                    var calculated_items = me._doColumnCalculations(root_items);

                                    var root_items_hash = me.convertModelsToHashes(calculated_items);

                                    console.log('root_items_hash',root_items_hash);
                                    
                                    deferred.resolve(root_items_hash);


                                },
                                scope:me                   
                        });

                    },
                    failure:function(error_msg){ 
                        console.log('Failed');
                    }
                });


                // //Loop thro the projects and get selected release data for each project and calculate SP /Schedule

                // var promises = [];
                // Ext.Array.each(records, function(record){
                //     promises.push(function(){
                //         return me._getCollection(record); 
                //     });
                // });

                // Deft.Chain.sequence(promises).then({
                //         success: function(results){
                //             me.logger.log('_calculateGridValues',results);
                //             //process the results.
                //             var projects = [];
                //                 for (var i = 0; records && i < records.length; i++) {
                //                         var project = {
                //                             ProjectName: records[i].get('Name'),
                //                             SPSchedules:results[i][0],
                //                             Features:results[i][1],
                //                             Velocity:results[i][2]
                //                         }
                //                         projects.push(project);
                //                 }
                //                 me.logger.log('Projects >>',projects);
                //                 // create custom store (call function ) combine permissions and results in to one.
                //                 // var store = Ext.create('Rally.data.custom.Store', {
                //                 //     data: projects,
                //                 //     scope: this
                //                 // });
                //                 // deferred.resolve(store); 

                //                 var store = Ext.create('Rally.data.custom.Store', {
                //                     data: projects
                //                 });

                //             deferred.resolve(store);
                //            // deferred.resolve(results);
                //         },
                //         scope:me                   
                // });


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
        var baselinePointsFiled = me.getSetting('baselinePointsFiled');

        filters = [{property:'Project.ObjectID',value: project_obejctID},{property:'Name',value: release_name}];

        filter = Rally.data.wsapi.Filter.and(filters);
        
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Release',
            fetch: ['ObjectID','Name','PlanEstimate','Accepted',baselinePointsFiled],
            filters: filter
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    //me.logger.log('Schedule value',records);
                    var result = {};


                    if(records[0] && records[0].get('PlanEstimate') > 0){

                        result.total = records[0].get('PlanEstimate');
                        result.accepted = records[0].get('Accepted');
                        result.expected = (records[0].get('Accepted') / records[0].get('PlanEstimate')) * 100 ;
                        result.baseline = records[0].get(baselinePointsFiled);

                        result.schedule_result = records[0].get('Accepted') / result.expected;
                        result.scope = result.baseline > 0 ? ((records[0].get('PlanEstimate') - result.baseline) / result.baseline) * 100 :0;
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
                    var velocity = {};
                    velocity.result = 0;
                    var result = 0;
                    var past_velocity = 0;
                    var past_velocity_length = 0;
                    var future_velocity_length = 0;
                    var remining_plan_estimate = 0;

                    Ext.Array.each(records,function(iteration){
                        if(iteration.get('EndDate') < today){
                            past_velocity += iteration.get('PlanEstimate') ? iteration.get('PlanEstimate') : 0;
                            past_velocity_length += 1;
                        }else{
                            remining_plan_estimate += iteration.get('PlanEstimate') ? iteration.get('PlanEstimate') : 0;
                            future_velocity_length += 1;
                        }
                    });

                    var avg_velocity = past_velocity / past_velocity_length;

                    velocity.average = avg_velocity;
                    velocity.remining_scope = remining_plan_estimate;
                    velocity.remining_sprints = future_velocity_length;

                    velocity.result = avg_velocity > 0 &&  remining_plan_estimate > 0 && future_velocity_length > 0 ? avg_velocity / (remining_plan_estimate/future_velocity_length) : 0;
                                    
                    me.logger.log('_getVelocity', result, velocity , past_velocity_length,avg_velocity,remining_plan_estimate,future_velocity_length)

                    deferred.resolve(velocity);

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
                    var feature = {};
                    feature.result = 0;
                    feature.total = records.length;
                    feature.accepted = 0;
                    feature.expected = per_sch_complete * feature.total;
                    
                    Ext.Array.each(records,function(rec){
                        if(1 == rec.get('PercentDoneByStoryCount')){
                            feature.accepted += 1;
                        }
                    });

                    if(feature.total > 0 ){
                        feature.result = feature.accepted / feature.expected;
                    }

                    deferred.resolve(feature);

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

       
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['ObjectID','Name','Parent','Children'],
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

    /* Tree Grid code */

    _getTreeArray:function(target_items) {
        var deferred = Ext.create('Deft.Deferred');

        var fetched_items_by_oid = {};
        _.each(target_items, function(rec){
            fetched_items_by_oid[rec.get('ObjectID')] = rec;
        });

        var promises = [];
        
        promises.push(this._fetchChildItems(target_items,fetched_items_by_oid));

        Deft.Promise.all(promises).then({
            scope: this,
            success: function(all_unordered_items){
                var flattened_array = Ext.Array.flatten(all_unordered_items);
                
                var all_unordered_items_hash = {};
                if ( flattened_array.length > 0 ) {
                    all_unordered_items_hash = flattened_array[0];
                }
                deferred.resolve(all_unordered_items_hash);
            },
            failure: function(error_msg) { deferred.reject(error_msg); }
        });

        return deferred;

    },

    /**
     * Given an array of models, turn them into hashes
     */
    convertModelsToHashes: function(model_array) {
        console.log('convertModelsToHashes input>>',model_array);
        var hash_array = [];
        Ext.Array.each(model_array,function(model){
            if (this.isModel(model)) {
                var model_as_hash = model.data;
                model_as_hash.expanded = false;
                model_as_hash.leaf = false;
                
                // children & parent are fields that are not a 
                // part of the model def'n so getData doesn't provide them
                if ( model.get('children') ) {
                    model_as_hash.children = this.convertModelsToHashes(model.get('children'));
                }
                if ( model.get('parent') ) {
                    if ( this.isModel(model.get('parent') ) ) {
                        model_as_hash.parent = model.get('parent').getData();
                    } else {
                        model_as_hash.parent = model.get('parent');
                    }
                }

                if (!model_as_hash.children || model_as_hash.children.length === 0 ) {
                    model_as_hash.leaf = true;
                }
                
                hash_array.push(model_as_hash);
            } else {
                hash_array.push(model);
            }
        },this);
        console.log('convertModelsToHashes output>>',hash_array);
        return hash_array;
    },
    isModel: function(model){
        return model && ( model instanceof Ext.data.Model );
    },


    constructRootItems:function(item_hash) {
        console.log('constructRootItems output>>',item_hash);        
        var root_array = [];
        Ext.Object.each(item_hash, function(oid,item){
            if ( !item.get('children') ) { item.set('children',[]); }
            var direct_parent = item.get('parent');
            if (!direct_parent && !Ext.Array.contains(root_array,item)) {
                root_array.push(item);
            } else {
                
                var parent_oid =  direct_parent.ObjectID || direct_parent.get('ObjectID');
                if (!item_hash[parent_oid]) {
                    this.logger.log("Saved parent missing: ", parent_oid);
                    if ( !Ext.Array.contains(root_array,item) ) {
                        root_array.push(item);
                    }
                } else {
                    var parent = item_hash[parent_oid];
                    if ( !parent.get('children') ) { parent.set('children',[]); }
                    var kids = parent.get('children');
                    kids.push(item);
                    parent.set('children',kids);
                }
            }
        },this);
        console.log('constructRootItems output>>',root_array);        

        return root_array;
    },

    _fetchChildItems: function(parent_items,fetched_items, deferred){
        this.logger.log('_fetchChildItems',parent_items.length);
        if ( !deferred ) {
            deferred = Ext.create('Deft.Deferred');
        }
        
       
        var promises = [];
        
        Ext.Object.each(parent_items,function(oid,parent){
            var type = parent.get('_type');
            var children_fields = ['Children']
            
            if ( children_fields ) {
                Ext.Array.each(children_fields,function(children_field) {
                    promises.push(this._fetchCollection(parent,children_field));
                },this);
            }
        },this);
        
           
        if (promises.length > 0) {
            Deft.Promise.all(promises).then({
                scope: this,
                success: function(results) {
                    var children = Ext.Array.flatten(results);
                    Ext.Array.each(children,function(child){
                        if ( fetched_items[child.get('ObjectID') ] ) {
                            var parent = this._getParentFrom(child);
                            fetched_items[child.get('ObjectID')] = child;
                        }
                    },this);
                    this._fetchChildItems(children,fetched_items,deferred);
                },
                failure: function(error_msg){ deferred.reject(error_msg); }
            });
        } else {
            this.logger.log("resolving _fetchChildItems");
            deferred.resolve(fetched_items);
        }
        return deferred.promise;
    },

 _getParentFrom:function(child){
            var parent = child.get("Parent");
            child.set('parent', parent);
            return parent;
 },

    _fetchCollection: function(parent,children_field){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log("_fetchCollection",children_field);
        
        var fields_to_fetch = ['ObjectID','_type','Name','Parent','Children'];
        
        if ( parent.get(children_field)){
            parent.getCollection(children_field,{
                autoLoad: true,
                fetch: fields_to_fetch,
                listeners: {
                    scope: this,
                    load: function(store,records,success){
                        if ( success ) {
                            deferred.resolve(records);
                        } else {
                            deferred.reject("Problem fetching collection ", children_field);
                        }
                    }
                }
            });
        } else {
            deferred.resolve([]);
        }
        return deferred.promise;
    },
  

    _doColumnCalculations:function(ordered_items){
        var me = this;
        var calculated_items = ordered_items;
        Ext.Array.each(this.columns,function(column){
            if ( column.calculator && column.dataIndex ) {
                calculated_items = me.rollup({
                    root_items: ordered_items,
                    field_name: column.dataIndex,
                    leaves_only: column.leaves_only,
                    calculator: column.calculator
                });
            }
        });
        return calculated_items;
    },

    rollup: function(config){
        Ext.Array.each(config.root_items,function(root_item){
            this._setValueFromChildren(root_item,config.field_name,config.calculator,config.leaves_only);
        },this);
        return config.root_items;
    },

    _setValueFromChildren:function(parent_item,field_name,calculator,leaves_only){
        var me = this;
        var parent_value = parent_item.get(field_name) || {};
        var children = parent_item.get('children') || [];
        
        //if ( leaves_only && children.length > 0 ) { parent_value = {}; }

        Ext.Array.each(children,function(child_item) {
            this._setValueFromChildren(child_item,field_name,calculator,leaves_only);
            var child_value = child_item.get(field_name) || {};
            parent_value =  this._addValues(parent_value,child_value);
        },this);
        console.log('field_name,parent_value',field_name,parent_value);
        parent_item.set(field_name,parent_value);
        return;
    },

    _addValues:function(parent_value,child_value){
        if(Object.keys(child_value).length === 0) return parent_value;
        Ext.Object.each(parent_value,function(key,value){ 
            parent_value[key] += child_value[key]
        });
        return parent_value;
    },


/* End tree grid code*/

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
    
    _makeStoreAndShowGrid: function(ordered_items){
        var me = this;
        var display = me.down('#display_box');
        display.removeAll();

        var store = Ext.create('Ext.data.TreeStore', {
            model: 'TSModel',
            root: {
                expanded: true,
                children: ordered_items
            }
        });
        
        display.add({
            xtype:'treepanel',
            store: store,
            itemId: 'projectTreeGrid',
            cls: 'rally-grid',
            columns: [
                { xtype:'treecolumn', dataIndex:'Name', text:'PROJECT', flex: 2, menuDisabled: true},
                {
                    text: 'SP / Schedules', 
                    dataIndex: 'SPSchedules',
                    flex: 1,
                    // calculator: true,
                    // leaves_only: true,
                    renderer: function(SPSchedules,metaData){
                        var color = 'ffffff';
                        if(SPSchedules.schedule_result < me.getSetting('scheduleThresholdLow')){
                            color =  me.red;
                        }else if (SPSchedules.schedule_result >= me.getSetting('scheduleThresholdHigh')){
                            color = me.green;
                        }else {
                            color = me.yellow;
                        }
                        metaData.style = 'padding-right:7px;text-align:right;background-color:'+color                       
                        return Ext.util.Format.number(SPSchedules.schedule_result > 0 ? SPSchedules.schedule_result : 0, "000.00");
          
                    }
                    
                },                
                {
                    text: 'Features', 
                    dataIndex: 'Features',
                    flex: 1,
                    // calculator: true,
                    // leaves_only: true,
                    renderer: function(Features,metaData){
                        var color = 'ffffff';
                        if(Features && Features.result < me.getSetting('featureThresholdLow')){
                            color =  me.red;
                        }else if (Features && Features.result >= me.getSetting('featureThresholdHigh')){
                            color = me.green;
                        }else{
                            color = me.yellow;
                        }

                        metaData.style = 'padding-right:7px;text-align:right;background-color:'+color                       
                        return Ext.util.Format.number(Features.result > 0 ? Features.result : 0, "000.00");
                    }

                },{
                    text: 'Velocity', 
                    dataIndex: 'Velocity',
                    flex: 1,
                    // calculator: true,
                    // leaves_only: true,
                    renderer: function(Velocity,metaData){
                        var color = 'ffffff';
                        if(Velocity && Velocity.result < me.getSetting('velocityThresholdLow')){
                            color =  me.red;
                        }else if (Velocity && Velocity.result >= me.getSetting('velocityThresholdHigh')){
                            color =  me.green;
                        }else{
                            color = me.yellow;
                        }     
                        metaData.style = 'padding-right:7px;text-align:right;background-color:'+color;      
                        return Ext.util.Format.number(Velocity.result > 0 ? Velocity.result : 0, "000.00");

                    }

                },{
                    text: 'Scope', 
                    dataIndex: 'SPSchedules',
                    flex: 1,
                    renderer: function(SPSchedules){
                        return Ext.util.Format.number(SPSchedules.scope ? SPSchedules.scope : 0, "000.00")+'%';
                    }
                }
            ],
            listeners: {
                itemclick: function(view, record, item, index, evt) {
                    var column = view.getPositionByEvent(evt).column;
                    
                    if (column > 0 && column < 5) {
                        var column_index = view.up().columns[column].dataIndex;
                        var column_title = view.up().columns[column].text;
                        if('SP / Schedules' == column_title || 'Features' == column_title ){
                            var column_value = record.get(column_index)
                            var html = "Total Scope: "+column_value.total +"<br>"+"Accepted: "+column_value.accepted +"<br>"+"Expected: "+Math.round(column_value.expected) +"<br>";
                        }else if('Velocity' == column_title){
                            var column_value = record.get(column_index)
                            var html = "Average Velocity: "+column_value.average +"<br>"+"Remining Scope: "+column_value.remining_scope +"<br>"+"Remining Sprints: "+column_value.remining_sprints +"<br>";
                        }else if('Scope' == column_title){
                            var column_value = record.get(column_index)
                            var html = "Total Scope: "+column_value.total +"<br>"+"Baseline Points: "+column_value.baseline +"<br>";
                        }else{
                            var html = "Value:" + record.get(column_index)
                        }

                        var popover = Ext.create('Rally.ui.popover.Popover',{
                                            target: Ext.get(evt.target),
                                            html: html,
                                            title:column_title,
                                            bodyStyle: {
                                                background: '#ADD8E6',
                                                padding: '10px',
                                                color: 'black'
                                            },  
                                            //height:150,
                                            width:250
                                        });
                        popover.show();

                        console.log("click",column_index,record, record.get(column_index));
                        
                    }
                }
            },
            rootVisible: false
        });

        me.down('#projectTreeGrid').expandAll();

    },

    _getColumns: function(){

        return [
                { xtype:'treecolumn', dataIndex:'Name', text:'PROJECT', flex: 2, menuDisabled: true},
                {
                    text: 'SP / Schedules', 
                    dataIndex: 'SPSchedules',
                    flex: 1,
                    calculator: true,
                    leaves_only: true,
                    renderer: function(SPSchedules,metaData){
                        var color = 'ffffff';
                        if(SPSchedules.schedule_result < me.getSetting('scheduleThresholdLow')){
                            color =  me.red;
                        }else if (SPSchedules.schedule_result >= me.getSetting('scheduleThresholdHigh')){
                            color = me.green;
                        }else {
                            color = me.yellow;
                        }
                        metaData.style = 'padding-right:7px;text-align:right;background-color:'+color                       
                        return Ext.util.Format.number(SPSchedules.schedule_result > 0 ? SPSchedules.schedule_result : 0, "000.00");
          
                    }
                    
                },                
                {
                    text: 'Features', 
                    dataIndex: 'Features',
                    flex: 1,
                    calculator: true,
                    leaves_only: true,
                    renderer: function(Features,metaData){
                        var color = 'ffffff';
                        if(Features && Features.result < me.getSetting('featureThresholdLow')){
                            color =  me.red;
                        }else if (Features && Features.result >= me.getSetting('featureThresholdHigh')){
                            color = me.green;
                        }else{
                            color = me.yellow;
                        }

                        metaData.style = 'padding-right:7px;text-align:right;background-color:'+color                       
                        return Ext.util.Format.number(Features.result > 0 ? Features.result : 0, "000.00");
                    }

                },{
                    text: 'Velocity', 
                    dataIndex: 'Velocity',
                    flex: 1,
                    calculator: true,
                    leaves_only: true,
                    renderer: function(Velocity,metaData){
                        var color = 'ffffff';
                        if(Velocity && Velocity.result < me.getSetting('velocityThresholdLow')){
                            color =  me.red;
                        }else if (Velocity && Velocity.result >= me.getSetting('velocityThresholdHigh')){
                            color =  me.green;
                        }else{
                            color = me.yellow;
                        }     
                        metaData.style = 'padding-right:7px;text-align:right;background-color:'+color;      
                        return Ext.util.Format.number(Velocity.result > 0 ? Velocity.result : 0, "000.00");

                    }

                },{
                    text: 'Scope', 
                    dataIndex: 'SPSchedules',
                    flex: 1,
                    renderer: function(SPSchedules){
                        return Ext.util.Format.number(SPSchedules.scope ? SPSchedules.scope : 0, "000.00")+'%';
                    }
                }
            ];

    },

    _magicRenderer: function(field,value,meta_data,record){
        var field_name = field.name || field.get('name');
        var record_type = record.get('_type');
        var model = this.models[record_type];
        // will fail fi field is not on the record
        // (e.g., we pick accepted date, by are also showing features
        try {
            var template = Rally.ui.renderer.RendererFactory.getRenderTemplate(model.getField(field_name)) || "";
            return template.apply(record.data);
        } catch(e) {
            return ".";
        }
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

function customizer(objValue, srcValue) {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}
