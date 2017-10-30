var Binding = require('./packet_bindings');
var Packet = require('./packet');

function bindingTypeToString( bindingType, bindingValue ) {
    var valueName = null;
    var names = Object.keys(Binding[ bindingType ]).filter(function(key) {
        if ( Binding[ bindingType ][ key ] == bindingValue ) {
            return true;
        }
    });
    if (names.length == 1)
        valueName = names[0];
    return valueName;
};

function checkSum(data, length, mask) {
    var cs = 0x00;
    for (var i=0; i<length; i++)
        cs += data[i];
    cs = (cs & mask) ^ mask;
    return cs;
};

// CONFIG FOR BLUETOOTH
var smartDrive_service_UUIDs = [
    "0cd51666e7cb469b8e4d2742f1ba7723"
];

var smartDrive_control_characteristic_UUIDs = [
    "e9add780b0424876aae1112855353cc1"
];

function getServiceUUIDs() {
    return smartDrive_service_UUIDs;
};

function isSmartDriveService(uuid) {
    return smartDrive_service_UUIDs.indexOf(uuid) > -1;
};

function isControlEndpoint(uuid) {
    return smartDrive_control_characteristic_UUIDs.indexOf(uuid) > -1;
};

function SmartDrive(peripheral) {
    this.peripheral = peripheral;
    this.initialize();
};

SmartDrive.prototype.initialize = function() {
    this.characteristic = null;

    this.settings = {
        controlMode: "Advanced",
        units: "English",
        flags: 0,
        padding: 0,
        tapSensitivity: 1.0,
        acceleration: 0.5,
        maxSpeed: 0.5,
    };

    this.state = {
        version: 0,
        motor: "Off",
        battery: 0,
        caseSpeed: 0,
        caseAccel: 0,
        motorSpeed: 0,
        motorAccel: 0,
        lastDriveDistance: 0,
        totalDistance: 0,
        driveTime: 0,
        otaReady: false
    };
};

SmartDrive.prototype.uuid = function() {
    if (this.peripheral)
        return this.peripheral.uuid;
    return null;
};

SmartDrive.prototype.address = function() {
    if (this.peripheral)
        return this.peripheral.address;
    return null;
};

SmartDrive.prototype.controlEndpoint = function(c) {
    this.characteristic = c;
};

SmartDrive.prototype.update = function( bytes ) {
    var p = new Packet( bytes );
    switch (p.Type()) {
    case "Data":
        this.updateState( p );
        break;
    case "Command":
        this.handleCommand( p );
        break;
    case "Error":
        this.handleError( p );
        break;
    }
    p.destroy();
};

SmartDrive.prototype.updateState = function(packet) {
    if (packet.Type() == "Data") {
        this.state.otaReady = false;
        switch (packet.SubType()) {
        case "DeviceInfo":
            var device = bindingTypeToString( "Device", packet.data("deviceInfo").device );
            console.log('Got device info for device: ' + device);
            console.log('                            ' + packet.data("deviceInfo").version);
            if (device == 'SmartDriveBluetooth') {
                this.sendOTA();
            }
            break;
        case "MotorDistance":
            this.state.totalDistance = this.motorTicksToMiles( packet.data("motorDistance") );
            break;
        case "MotorInfo":
            this.state.version           = packet.data("motorInfo").version;
            this.state.motor             = bindingTypeToString( "MotorState", packet.data("motorInfo").state );
            this.state.battery           = packet.data("motorInfo").batteryLevel;
            this.state.caseSpeed         = packet.data("motorInfo").speed;
            this.state.lastDriveDistance = packet.data("motorInfo").distance;
            this.state.driveTime         = packet.data("motorInfo").driveTime;
            break;
        }
        console.log("Got state for "+this.address());
        //console.log(this.state);
    }
};

SmartDrive.prototype.handleCommand = function(packet) {
    if (packet.Type() == "Command") {
        switch (packet.SubType()) {
        case "OTAReady":
            console.log('OTA Bootloader ready for FW Update!');
            this.state.otaReady = true;
            break;
        }
    }
};

SmartDrive.prototype.handleError = function(packet) {
    if (packet.Type() == "Error") {
        console.log( "Got Error: " + packet.SubType() );
        switch (packet.SubType()) {
        case "GyroRange":
            this.sendOTA();
            break;
        }
    }
};

SmartDrive.prototype.makeHeader = function(version, checksum) {
    this.header = Buffer.alloc(16);
    this.header[0] = version & 0xFF;
    this.header[4] = checksum & 0xFF;
    this.header[5] = (checksum >>> 8) & 0xFF;
    this.header[6] = (checksum >>> 16) & 0xFF;
    this.header[7] = (checksum >>> 24) & 0xFF;
};

SmartDrive.prototype.loadFirmware = function(fileName, version) {
    // loads the firmware file, computes the checksum, and makes the
    // header for sending the firmware file to the SD
    if (fileName == undefined)
        throw new String("Must provide filename!");
    if (version == undefined)
        version = 0x10;

    var fs = require('fs');
    try {
        this.firmware = fs.readFileSync(fileName);
        var cs = checkSum(this.firmware, this.firmware.length, 0xFFFFFFFF);
        this.makeHeader(version, cs);
    }
    catch (e) {
        console.error("Couldn't open: "+fileName);
        console.error(e);
    }
};

SmartDrive.prototype.startOTA = function(delay) {
    var sd = this;
    return new Promise(function(resolve) {
        if (sd.characteristic == undefined) {
            resolve();
            return;
        }

        var timeout = delay || 0;
        setTimeout(function() {
            console.log("Starting OTA");
            var p = new Packet();
            p.send( sd.characteristic, "Command", "StartOTA", "OTADevice", Binding.Device.SmartDrive );
            p.destroy();

            resolve();
        }, timeout);
    });
};

SmartDrive.prototype.stopOTA = function(delay) {
    var sd = this;
    return new Promise(function(resolve) {
        if (sd.characteristic == undefined) {
            resolve();
            return;
        }

        var timeout = delay || 0;
        setTimeout(function() {
            console.log("Stopping OTA");
            var p = new Packet();
            p.send( sd.characteristic, "Command", "StopOTA", "OTADevice", Binding.Device.SmartDrive );
            p.destroy();

            resolve();
        }, timeout);
    });
};

SmartDrive.prototype.sendOTA = function() {
    var sd = this;
    sd.startOTA();

    function waitForReady(delay, resolution) {
        if (resolution) {
            sd.waitingTimeout = setTimeout(function() {
                if (sd.peripheral.state == 'connected') {
                    if (sd.state.otaReady) {
                        resolution();
                    }
                    else {
                        sd.startOTA();
                    }
                }
                waitForReady(delay, resolution);
            }, delay);
        }
        else {
            console.log("Waiting for OTA Ready from " + sd.address());
            return new Promise(function(resolve) {
                sd.waitingTimeout = setTimeout(function() {
                    if (sd.peripheral.state == 'connected') {
                        if (sd.state.otaReady) {
                            resolve();
                        }
                        else {
                            sd.startOTA();
                        }
                    }
                    waitForReady(delay, resolve);
                }, delay);
            });
        }
    }
    
    waitForReady(500)
        .then(function() {
            clearTimeout(sd.waitingTimeout);
            return sd.sendHeader(10);
        })
        .then(function() {
            return sd.sendFirmware(1500);
        })
        .then(function() {
            return sd.stopOTA(500);
        });
};

SmartDrive.prototype.sendHeader = function(delay) {
    var sd = this;
    return new Promise(function(resolve) {
        if (sd.header == undefined || sd.characteristic == undefined) {
            resolve();
            return;
        }

        timeout = delay || 0;

        setTimeout(function() {
            console.log('Sending OTA header');

            var bytes = new Binding.VectorInt();
            var headerSize = 16;
            for (var i=0;i<headerSize;i++) {
                bytes.push_back(sd.header[i]);
            }

            var p = new Packet();
            p.send( sd.characteristic, "OTA", "SmartDrive", "bytes", bytes, headerSize);
            p.destroy();
            bytes.delete();

            resolve();
        }, timeout);
    });
};

SmartDrive.prototype.sendFirmware = function(delay) {
    var sd = this;

    console.log('Sending OTA firmware');

    return new Promise(function(resolve) {
        if (sd.firmware == undefined || sd.characteristic == undefined)
            resolve();
        
        var payloadSize = 16;
        var fileSize = sd.firmware.length;
        var index = 0;

        var startTime = process.uptime();

        var status = require('node-status');
        var ota = status.addItem('OTA', {
            label: 'OTA',
            max: fileSize,
            custom: function() {
                return `${this.count} / ${this.max}`;
            },
        });
        status.start({
            pattern: ' {spinner.cyan} | OTA: {OTA.bar} {OTA.percentage.magenta}'
        });

        var intId = -1;

        var writeFirmwareSector = function() {
            if (index < fileSize) {
                // figure out the right length
                var len = Math.min(fileSize - index, payloadSize);

                // copy the firmware section into a byte array
                var bytes = new Binding.VectorInt();
                for (var i=0;i<len;i++) {
                    bytes.push_back(sd.firmware[index+i]);
                }

                // make and send the packet
                if (intId == -1)
                    sd.characteristic.once('write', writeFirmwareSector);
                var p = new Packet();
                p.send( sd.characteristic, "OTA", "SmartDrive", "bytes", bytes, len);
                p.destroy();
                bytes.delete();

                index += payloadSize;
                ota.inc( payloadSize );
            }
            else {
                if (intId != -1)
                    clearInterval(intId);
                status.stop();
                console.log('\n');
                resolve();
            }
        }

        var interval = delay || 5;
        //intId = setInterval(writeFirmwareSector, interval);

        writeFirmwareSector();
    });
};

// BLUETOOTH HANDLER CALLBACKS

SmartDrive.prototype.connectCallback = function(error) {
    var sd = this;
    sd.initialize();
    if (error) {
        console.log("Couldn't connect to " + sd.uuid());
        console.log(error);
    }
    else {
        sd.peripheral.once('disconnect', sd.disconnectCallback.bind(sd) );
        sd.peripheral.discoverServices(
            getServiceUUIDs(),
            sd.serviceDiscoverCallback.bind( sd )
        );
    }
};

SmartDrive.prototype.disconnectCallback = function() {
    var sd = this;
    sd.initialize();
    console.log("SmartDrive " + sd.address() + " was disconnected, reconnecting...");
    sd.peripheral.connect( sd.connectCallback.bind(sd) );
};

SmartDrive.prototype.serviceDiscoverCallback = function(error, services) {
    var sd = this;
    if (error) {
        console.log("Couldn't get services from " + sd.uuid());
        console.log(error);
    }
    else {
        console.log("Discovered SmartDrive Service");
        services.map(function(service) {
            if (isSmartDriveService(service.uuid)) {
                service.discoverCharacteristics(
                    [],
                    sd.characteristicDiscoverCallback.bind(sd)
                );
            }
        });
    }
};

SmartDrive.prototype.characteristicDiscoverCallback = function(error, characteristics) {
    var sd = this;
    if (error) {
        console.log("Couldn't get characteristics from " + sd.uuid());
        console.log(error);
    }
    else {
        console.log("Discovered SmartDrive Characteristics");
        characteristics.map(function(characteristic) {
            if ( isControlEndpoint( characteristic.uuid ) ) {
                sd.controlEndpoint( characteristic );
            }
            characteristic.on(
                'data',
                sd.update.bind(sd)
            );
            characteristic.subscribe();
        });
    }
};

SmartDrive.prototype.motorTicksToMiles = function(ticks) {
    return ticks * (2.0 * 3.14159265358 * 3.8) / (265.714 * 63360.0);
};

SmartDrive.prototype.caseTicksToMiles = function(ticks) {
    return ticks * (2.0 * 3.14159265358 * 3.8) / (36.0 * 63360.0);
};

module.exports = {
    "SmartDrive": function(peripheral) {
        return new SmartDrive(peripheral);
    },
    "getServiceUUIDs": function() {
        return getServiceUUIDs();
    },
    "isSmartDriveService": function(uuid) {
        return isSmartDriveService(uuid);
    },
    "isControlEndpoint": function(uuid) {
        return isControlEndpoint(uuid);
    }
};
