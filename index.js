var noble = require('noble');

var PacketBinding = require('./packet_bindings');


// CONFIG FOR BLUETOOTH
var smartDrive_service_UUIDs = [
    "0cd51666e7cb469b8e4d2742f1ba7723"
];
var smartDrive_control_characteristic_UUIDs = [
    "e9add780b0424876aae1112855353cc1"
];
var smartDriveControlCharacteristic = null;
var withoutResponse = false;

// ALL THE SMARTDRIVES WE'VE FOUND
var smartDrives = {};


// SETTINGS TO SEND TO SMARTDRIVE
// must have all the fields
var settings = {
    ControlMode: PacketBinding.SmartDriveControlMode.Advanced,
    Units: PacketBinding.Units.English,
    Flags: 0,
    Padding: 0,
    TapSensitivity: 1.0,
    Acceleration: 0.5,
    MaxSpeed: 0.5,
};

// PACKET BUILDING FUNCTIONS
function getOutput(packet) {
    var vectorOut = new PacketBinding.VectorInt();
    vectorOut = packet.format();
    var output = Buffer.alloc(vectorOut.size());
    for (var i=0; i<vectorOut.size(); i++) {
        output[i] = vectorOut.get(i);
    }
    return output;
}

function sendPacket(type, subType, key, data) {
    if (smartDriveControlCharacteristic) {
        var p = new PacketBinding.Packet();

        p.Type = PacketBinding.PacketType[type];
        p[type] = PacketBinding['Packet'+type+'Type'][subType];
        if (key && data) {
            p[key] = data;
        }
        
        var output = getOutput(p);
        smartDriveControlCharacteristic.write(output, withoutResponse);
        console.log("Sent: " + type + "::"+subType);
        p.delete();
    }
}

function characteristicDataCallback(data, isNotification) {
    var characteristic = this;
    //console.log('got data for characteristic: ' + characteristic.uuid);
    //console.log(data);

    var packetInstance = new PacketBinding.Packet();
    packetInstance.newPacket();
    var valid = packetInstance.processPacket( data );
    if (valid) {
        switch (packetInstance.Type) {
        case PacketBinding.PacketType.Data:
            switch (packetInstance.Data) {
            case PacketBinding.PacketDataType.DeviceInfo:
                console.log('GOT DEVICE INFO: '+ JSON.stringify(packetInstance.deviceInfo, null, 4));
                var device = packetInstance.deviceInfo.device;
                console.log(device);
                sendPacket("Command", "SetSettings", "settings", settings);
                break;
            case PacketBinding.PacketDataType.MotorInfo:
                console.log('GOT MOTOR INFO: ' +JSON.stringify(packetInstance.motorInfo, null, 4));
                switch (packetInstance.motorInfo.state) {
                case PacketBinding.MotorState.Off:
                    break;
                case PacketBinding.MotorState.On:
                    console.log('motor state on');
                    setTimeout(function() { sendPacket("Command", "Tap"); }, 1000);
                    break;
                case PacketBinding.MotorState.Error:
                    console.log('motor state error');
                    break;
                }
                break;
            case PacketBinding.PacketDataType.MotorDistance:
                console.log('GOT MOTOR DISTANCE: ');
                console.log('GOT MOTOR DISTANCE: '+ packetInstance.motorDistance);
                break;
            }
            break;
        case PacketBinding.PacketType.Command:
            switch(packetInstance.Command) {
            case PacketBinding.PacketCommandType.OTAReady:
                // should receive Command::OTAReady from bootloader
                // after sending Command::StartOTA
                // we then send header and then ota file
                console.log('OTA Bootloader ready for FW Update!');
                // NOW SEND HEADER
                var header = new PacketBinding.VectorChar();
                //header.resize(16);
                header.push_back(19);
                for (var i=0;i<15;i++)
                    header.push_back(0);
                sendPacket("OTA", "SmartDrive", "bytes", header);
                break;
            }
            break;
        case PacketBinding.PacketType.Error:
            console.log(packetInstance.Error);
            console.log("REBOOTING INTO OTA");
            sendPacket("Command", "StartOTA", "OTADevice", PacketBinding.Device.SmartDrive);
            setTimeout(function() { noble.startScanning(smartDrive_service_UUIDs, true); }, 1000);
            break;
        case PacketBinding.PacketType.OTA:
            //console.log(packetInstance.OTA);
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
            if (smartDrive_control_characteristic_UUIDs.indexOf(characteristic.uuid) > -1) {
                console.log('Have SD Control endpoint: ' + characteristic.uuid);
                smartDriveControlCharacteristic = characteristic;
                setTimeout(function() { sendPacket("Command", "Tap"); }, 1000);
                setTimeout(function() { sendPacket("Command", "Tap"); }, 1500);
            }
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
    /*
    if (smartDrive.state !== 'disconnected') {
        return;
    }
    */
    if (!smartDrives[smartDrive.address]) {
        console.log('Found Smart Drive DU');
        console.log('                      ' + smartDrive.address);
    }
    smartDrives[smartDrive.address] = smartDrive;

    if (smartDrive.state == 'disconnected') {
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
    //noble.state = "poweredOff";
    //noble.stopScanning();
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
