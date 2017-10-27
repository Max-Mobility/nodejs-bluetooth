var noble = require('noble');

var SmartDrive = require('./smartDrive');

var smartDriveControlCharacteristic = null;
var withoutResponse = false;

// ALL THE SMARTDRIVES WE'VE FOUND
var smartDrives = {};

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
                var distance = packetInstance.motorDistance;
                console.log('GOT MOTOR DISTANCE: ' + distance + ' ticks');
                distance = motorTicksToMiles(distance);
                console.log('                    ' + distance + ' miles');
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
        console.log("Couldn't get services from " + smartDrive.uuid);
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
                console.log("Couldn't connect to " + smartDrive.uuid);
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
