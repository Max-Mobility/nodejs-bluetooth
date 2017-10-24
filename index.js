var noble = require('noble');

var smartDrive_service_UUIDs = [
    "0cd51666e7cb469b8e4d2742f1ba7723"
];

var smartDrives = {};

noble.on('discover', function(peripheral) {
    if (!smartDrives[peripheral.address]) {
        smartDrives[peripheral.address] = peripheral;

        console.log('Found Smart Drive DU');
        console.log('                      ' + peripheral.address);
    }
});

noble.on('stateChange', function(state) {
    if (state == "poweredOn") {
        noble.startScanning(smartDrive_service_UUIDs, true); // any service UUID, allow duplicates
    }
    else {
    }
});

noble.state = "poweredOn";

setTimeout(function() {
    noble.stopScanning();
    Object.keys(smartDrives).map(function(key) {
        var smartDrive = smartDrives[key];
        smartDrive.connect(function(error) {
            if (error) {
                console.log("Couldn't connect to " + smartDrive.uuid);
                console.log(error);
            }
            else {
                smartDrive.discoverServices(smartDrive_service_UUIDs, function(error, services) {
                    if (error) {
                        console.log("Couldn't get services from " + smartDrive.uuid);
                        console.log(error);
                    }
                    else {
                        console.log("FOUND SMART DRIVE SERVICE");
                        console.log(services);
                    }
                });
            }
        });
    });
}, 10000); // wait for 10 seconds

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
