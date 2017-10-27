var noble = require('noble');
var SmartDrive = require('./smartDrive');


// ALL THE SMARTDRIVES WE'VE FOUND
var smartDrives = {};

function characteristicDiscoverCallback(error, characteristics) {
    var smartDrive = this;
    if (error) {
        console.log("Couldn't get characteristics from " + smartDrive.uuid());
        console.log(error);
    }
    else {
        console.log("Discovered SmartDrive Characteristics");
        //console.log(characteristics);
        characteristics.map(function(characteristic) {
            if ( SmartDrive.isControlEndpoint( characteristic.uuid ) ) {
                smartDrive.controlEndpoint( characteristic );
            }
            characteristic.on(
                'data',
                smartDrive.update.bind(smartDrive)
            );
            characteristic.subscribe();
        });
    }
}

function serviceDiscoverCallback(error, services) {
    var smartDrive = this;
    if (error) {
        console.log("Couldn't get services from " + smartDrive.uuid());
        console.log(error);
    }
    else {
        console.log("Discovered SmartDrive Service");
        //console.log(services);
        services.map(function(service) {
            if (SmartDrive.isSmartDriveService(service.uuid)) {
                service.discoverCharacteristics(
                    [],
                    characteristicDiscoverCallback.bind(smartDrive)
                );
            }
        });
    }
}

noble.on('discover', function(peripheral) {
    if (!smartDrives[peripheral.address]) {
        console.log('Found Smart Drive DU');
        console.log('                      ' + peripheral.address);
    }
    smartDrives[peripheral.address] = SmartDrive.SmartDrive(peripheral);

    if (peripheral.state == 'disconnected') {
        peripheral.connect(function(error) {
            if (error) {
                console.log("Couldn't connect to " + smartDrive.uuid());
                console.log(error);
            }
            else {
                peripheral.discoverServices(
                    SmartDrive.getServiceUUIDs(),
                    serviceDiscoverCallback.bind( smartDrives[peripheral.address] )
                );
            }
        });
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
