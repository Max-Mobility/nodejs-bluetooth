var noble = require('noble');

var Packet = require('./packet');

var PacketBinding = require('./packet_bindings');

var smartDrive_service_UUIDs = [
    "0cd51666e7cb469b8e4d2742f1ba7723"
];

var smartDrives = {};

function characteristicDataCallback(data, isNotification) {
    var characteristic = this;
    //console.log('got data for characteristic: ' + characteristic.uuid);
    //console.log(data);
    var packetInstance = new PacketBinding.Packet();
    packetInstance.newPacket();
    var valid = packetInstance.processPacket( data );
    if (valid) {
        console.log(packetInstance.Type);
        switch (packetInstance.Type) {
        case PacketBinding.PacketType.Data:
            console.log(packetInstance.Data);
            switch (packetInstance.Data) {
            case PacketBinding.PacketDataType.MotorInfo:
                console.log(JSON.stringify(packetInstance.motorInfo));
                switch (packetInstance.motorInfo.state) {
                case PacketBinding.MotorState.Off:
                    console.log('motor state off');
                    break;
                case PacketBinding.MotorState.On:
                    console.log('motor state on');
                    break;
                case PacketBinding.MotorState.Error:
                    console.log('motor state error');
                    break;
                }
                break;
            }
            break;
        case PacketBinding.PacketType.Command:
            console.log(packetInstance.Command);
            break;
        case PacketBinding.PacketType.Error:
            //console.log(packetInstance.Error);
            break;
        case PacketBinding.PacketType.OTA:
            console.log(packetInstance.OTA);
            break;
        }
    }
    packetInstance.delete();
};

function characteristicDiscoverCallback(error, characteristics) {
    var smartDrive = this;
    if (error) {
        console.log("Couldn't get characteristics from " + smartDrive.uuid);
        console.log(error);
    }
    else {
        console.log("Discovered SmartDrive Characteristics");
        //console.log(characteristics);
        characteristics.map(function(characteristic) {
            characteristic.on(
                'data',
                characteristicDataCallback.bind(characteristic)
            );
            characteristic.subscribe();
        });
    }
}

function serviceDiscoverCallback(error, services) {
    var smartDrive = this;
    if (error) {
        console.log("Couldn't get services from " + smartDrive.uuid);
        console.log(error);
    }
    else {
        console.log("Discovered SmartDrive Service");
        //console.log(services);
        services.map(function(service) {
            if (smartDrive_service_UUIDs.indexOf(service.uuid) > -1) {
                service.discoverCharacteristics(
                    [],
                    characteristicDiscoverCallback.bind(smartDrive)
                );
            }
        });
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
