Ext.define('TSModel', {
    extend: 'Ext.data.Model',
    fields: [
        { name: 'Name', type:'string' },
        { name: 'SPSchedules', type:'object' },
        { name: 'Features', type:'object' },
        { name: 'Velocity', type:'object' }
    ]
});