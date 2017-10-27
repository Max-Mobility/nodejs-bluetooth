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
        switch (packet.SubType()) {
        case "DeviceInfo":
            var device = bindingTypeToString( "Device", packet.data("deviceInfo").device );
            console.log('Got device info for device: ' + device);
            console.log('                            ' + packet.data("deviceInfo").version);
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
        console.log("State for "+this.address()+":");
        console.log(this.state);
    }
};

SmartDrive.prototype.handleCommand = function(packet) {
    if (packet.Type() == "Command") {
        switch (packet.SubType()) {
        case "OTAReady":
            console.log('OTA Bootloader ready for FW Update!');
            this.sendHeader();
            break;
        }
    }
};

SmartDrive.prototype.handleError = function(packet) {
    if (packet.Type() == "Error") {
        console.log( "Got Error: " + packet.SubType() );
        switch (packet.SubType()) {
        case "GyroRange":
            this.startOTA();
            break;
        }
    }
};

SmartDrive.prototype.startOTA = function() {
    console.log("Starting OTA");
    var p = new Packet();
    p.send( this.characteristic, "Command", "StartOTA", "OTADevice", Binding.Device.SmartDrive );
    p.destroy();
};

SmartDrive.prototype.sendHeader = function() {
    var header = new PacketBinding.VectorChar();
    header.push_back(19);
    for (var i=0;i<15;i++)
        header.push_back(0);

    var p = new Packet();
    p.send( this.characteristic, "OTA", "SmartDrive", "bytes", header);
    p.destroy();
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
