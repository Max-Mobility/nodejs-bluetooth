var noble = require('noble');
var SmartDrive = require('./smartDrive');


// ALL THE SMARTDRIVES WE'VE FOUND
var smartDrives = {};

noble.on('discover', function(peripheral) {
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
});

noble.on('stateChange', function(state) {
    if (state == "poweredOn") {
        // only SD UUIDs, allow duplicates
        noble.startScanning(SmartDrive.getServiceUUIDs(), true);
    }
    else {
        console.log(state);
    }
});

// NOW ACTUALLY TURN ON THE BLE ADAPTER WHICH WILL START SCANNING
noble.state = "poweredOn";
