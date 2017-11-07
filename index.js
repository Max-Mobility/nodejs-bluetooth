var noble = require('noble');
var SmartDrive = require('./smartDrive');
var App = require('./app');

// ALL THE SMARTDRIVES WE'VE FOUND
var smartDrives = {};
var apps = {};

noble.on('discover', function(peripheral) {
    var serviceUUID = peripheral.advertisement.serviceUuids[0];
    if (App.isAppService(serviceUUID)) {
        if (!apps[peripheral.address]) {
            console.log('Found PushTracker App');
            console.log('                      ' + peripheral.address);

            apps[peripheral.address] = App.App(peripheral);

            app = apps[peripheral.address];

            if (peripheral.state == 'disconnected') {
                peripheral.connect( app.connectCallback.bind(app) );
            }
        }
    }
    else if (SmartDrive.isSmartDriveService(serviceUUID)) {
        if (!smartDrives[peripheral.address]) {
            console.log('Found Smart Drive DU');
            console.log('                      ' + peripheral.address);

            smartDrives[peripheral.address] = SmartDrive.SmartDrive(peripheral);

            var sd = smartDrives[peripheral.address]

            sd.loadFirmware("../driveunit_mcu/src/MX2+.ota", 0x13);
            
            if (peripheral.state == 'disconnected') {
                peripheral.connect( sd.connectCallback.bind(sd) );
            }
        }
    }
});

noble.on('stateChange', function(state) {
    if (state == "poweredOn") {
        // only SD UUIDs, allow duplicates
        serviceUUIDs = SmartDrive.getServiceUUIDs().concat( App.getServiceUUIDs() );
        console.log("Scanning for service UUIDs:");
        console.log(serviceUUIDs);
        noble.startScanning( serviceUUIDs, true);
    }
    else {
        console.log(state);
    }
});

noble.on('warning', function(w) {
    console.log("GOT WARNING");
    console.log(w);
});

// NOW ACTUALLY TURN ON THE BLE ADAPTER WHICH WILL START SCANNING
noble.state = "poweredOn";
