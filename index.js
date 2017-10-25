var noble = require('noble');

var PacketBinding = require('./packet_bindings');

var smartDrive_service_UUIDs = [
    "0cd51666e7cb469b8e4d2742f1ba7723"
];

var smartDrive_control_characteristic_UUIDs = [
    "e9add780b0424876aae1112855353cc1"
];

var smartDriveControlCharacteristic = null;

var smartDrives = {};

var withoutResponse = false;

function vectorIntToBuffer(vectorInt) {
    var output = Buffer.alloc(vectorInt.size());
    //console.log("VECTOR INT SIZE: "+vectorInt.size());
    for (var i=0; i<vectorInt.size(); i++) {
        output[i] = vectorInt.get(i);
    }
    return output;
}

function getOutput(packet) {
    var vectorOut = new PacketBinding.VectorInt();
    vectorOut = packet.format();
    return vectorIntToBuffer(vectorOut);
}

function sendStartOTA() {
    if (smartDriveControlCharacteristic) {
        var newPacket = new PacketBinding.Packet();

        newPacket.Type = PacketBinding.PacketType.Command;

        newPacket.Command = PacketBinding.PacketCommandType.StartOTA;

        newPacket.OTADevice = PacketBinding.DeviceType.SmartDrive;

        var output = getOutput(newPacket);
        console.log("SENDING START OTA: " + output);
        smartDriveControlCharacteristic.write(output, withoutResponse);
        newPacket.delete();
    }
}

function sendSettings() {
    if (smartDriveControlCharacteristic) {
        var newPacket = new PacketBinding.Packet();

        newPacket.Type = PacketBinding.PacketType.Command;

        newPacket.Command = PacketBinding.PacketCommandType.SetSettings;

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

        newPacket.settings = settings;

        var output = getOutput(newPacket);
        console.log("SENDING SETTINGS: " + output);
        smartDriveControlCharacteristic.write(output, withoutResponse);
        newPacket.delete();
    }
}

function sendTap() {
    if (smartDriveControlCharacteristic) {
        var newPacket = new PacketBinding.Packet();

        newPacket.Type = PacketBinding.PacketType.Command;

        newPacket.Command = PacketBinding.PacketCommandType.Tap;
        
        var output = getOutput(newPacket);
        console.log("SENDING TAP: " + output);
        smartDriveControlCharacteristic.write(output, withoutResponse);
        newPacket.delete();
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
                console.log(data);
                console.log('GOT DEVICE INFO: '+ JSON.stringify(packetInstance.deviceInfo));
                var device = packetInstance.deviceInfo.device;
                console.log(device);
                sendSettings();
                break;
            case PacketBinding.PacketDataType.MotorInfo:
                console.log('GOT MOTOR INFO: ' +JSON.stringify(packetInstance.motorInfo));
                switch (packetInstance.motorInfo.state) {
                case PacketBinding.MotorState.Off:
                    break;
                case PacketBinding.MotorState.On:
                    console.log('motor state on');
                    setTimeout(function() { sendTap(); }, 1000);
                    break;
                case PacketBinding.MotorState.Error:
                    console.log('motor state error');
                    break;
                }
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
                break;
            }
            break;
        case PacketBinding.PacketType.Error:
            console.log("REBOOTING INTO OTA");
            sendStartOTA();
            setTimeout(function() { noble.startScanning(smartDrive_service_UUIDs, true); }, 1000);
            setTimeout(function() { sendTap(); }, 5000);
            //console.log(packetInstance.Error);
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
                setTimeout(function() { sendTap(); }, 1000);
                setTimeout(function() { sendTap(); }, 1500);
                setTimeout(function() { sendTap(); }, 2000);
                setTimeout(function() { sendTap(); }, 2500);
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
