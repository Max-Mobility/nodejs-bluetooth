var noble = require('noble');

var smartDrive_service_UUIDs = [
    "0cd51666e7cb469b8e4d2742f1ba7723"
];

var smartDrives = {};

function serviceDiscoverCallback(error, services) {
    var smartDrive = this;
    if (error) {
        console.log("Couldn't get services from " + smartDrive.uuid);
        console.log(error);
    }
    else {
        console.log("FOUND SMART DRIVE SERVICE");
        console.log(services);
    }
}

noble.on('discover', function(smartDrive) {
    if (smartDrive.state !== 'disconnected') {
        return;
    }

    if (!smartDrives[smartDrive.address]) {
        smartDrives[smartDrive.address] = smartDrive;

        console.log('Found Smart Drive DU');
        console.log('                      ' + smartDrive.address);
        
        smartDrive.connect(function(error) {
            if (error) {
                console.log("Couldn't connect to " + smartDrive.uuid);
                console.log(error);
            }
            else {
                smartDrive.discoverServices(
                    [],
                    serviceDiscoverCallback.bind(smartDrive)
                );
            }
        });
    }
});

noble.on('stateChange', function(state) {
    if (state == "poweredOn") {
        noble.startScanning(smartDrive_service_UUIDs, true); // any service UUID, allow duplicates
    }
    else {
        console.log(state);
    }
});

/*
noble.on('scanStop', function() {
    Object.keys(smartDrives).map(function(key) {
        var smartDrive = smartDrives[key];
        smartDrive.connect(function(error) {
            if (error) {
                console.log("Couldn't connect to " + smartDrive.uuid);
                console.log(error);
            }
            else {
                smartDrive.discoverServices(
                    [],
                    serviceDiscoverCallback.bind(smartDrive)
                );
            }
        });
    });
});
*/

noble.state = "poweredOn";

setTimeout(function() {
    noble.state = "poweredOff";
    noble.stopScanning();
}, 5000); // wait for 5 seconds

///

/*
const bluetooth = require('node-bluetooth');

const device = new bluetooth.DeviceINQ();

device
    .on('finished', console.log.bind(console, 'finished'))
    .on('found', function(address, name) {
        console.log('Found: '+ address + ' with name ' + name);
    }).inquire();
*/
