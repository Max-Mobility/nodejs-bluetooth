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
var app_service_UUIDs = [
    "9358ac8f63434a31b4e04b13a2b45d86",
];

var app_control_characteristic_UUIDs = [
    "8489625f6c734fc08bcc735bb173a920",
];

function getServiceUUIDs() {
    return app_service_UUIDs;
};

function isAppService(uuid) {
    return app_service_UUIDs.indexOf(uuid) > -1;
};

function isControlEndpoint(uuid) {
    return app_control_characteristic_UUIDs.indexOf(uuid) > -1;
};

function App(peripheral) {
    this.peripheral = peripheral;
    this.initialize();
};

App.prototype.initialize = function() {
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

App.prototype.uuid = function() {
    if (this.peripheral)
        return this.peripheral.uuid;
    return null;
};

App.prototype.address = function() {
    if (this.peripheral)
        return this.peripheral.address;
    return null;
};

App.prototype.controlEndpoint = function(c) {
    this.characteristic = c;
};

App.prototype.update = function( bytes ) {
    console.log("APP GOT BYTES");
    console.log(bytes);
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

App.prototype.updateState = function(packet) {
    if (packet.Type() == "Data") {
        this.state.otaReady = false;
        switch (packet.SubType()) {
        case "DeviceInfo":
            var device = bindingTypeToString( "Device", packet.data("deviceInfo").device );
            console.log('Got device info for device: ' + device);
            console.log('                            ' + packet.data("deviceInfo").version);
            if (device == 'SmartDriveBluetooth') {
                //this.sendOTA();
            }
            break;
        case "MotorDistance":
            console.log("DISTANCE");
            console.log(packet._bytes);
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

App.prototype.handleCommand = function(packet) {
    if (packet.Type() == "Command") {
        switch (packet.SubType()) {
        case "OTAReady":
            console.log('OTA Bootloader ready for FW Update!');
            this.state.otaReady = true;
            break;
        }
    }
};

App.prototype.handleError = function(packet) {
    if (packet.Type() == "Error") {
        console.log( "Got Error: " + packet.SubType() );
        switch (packet.SubType()) {
        case "GyroRange":
            this.sendOTA();
            break;
        }
    }
};

// BLUETOOTH HANDLER CALLBACKS

App.prototype.connectCallback = function(error) {
    var app = this;
    app.initialize();
    if (error) {
        console.log("Couldn't connect to " + app.uuid());
        console.log(error);
    }
    else {
        app.peripheral.once('disconnect', app.disconnectCallback.bind(app) );
        app.peripheral.discoverServices(
            getServiceUUIDs(),
            app.serviceDiscoverCallback.bind( app )
        );
    }
};

App.prototype.disconnectCallback = function() {
    var app = this;
    app.initialize();
    console.log("App " + app.address() + " was disconnected, reconnecting...");
    app.peripheral.connect( app.connectCallback.bind(app) );
};

App.prototype.serviceDiscoverCallback = function(error, services) {
    var app = this;
    if (error) {
        console.log("Couldn't get services from " + app.uuid());
        console.log(error);
    }
    else {
        console.log("Discovered App Service");
        services.map(function(service) {
            if (isAppService(service.uuid)) {
                service.discoverCharacteristics(
                    [],
                    app.characteristicDiscoverCallback.bind(app)
                );
            }
        });
    }
};

App.prototype.characteristicDiscoverCallback = function(error, characteristics) {
    var app = this;
    if (error) {
        console.log("Couldn't get characteristics from " + app.uuid());
        console.log(error);
    }
    else {
        console.log("Discovered App Characteristics");
        characteristics.map(function(characteristic) {
            console.log(characteristic.uuid);
            if ( isControlEndpoint( characteristic.uuid ) ) {
                app.controlEndpoint( characteristic );
            }
            characteristic.on(
                'data',
                app.update.bind(app)
            );
            characteristic.subscribe();
        });
    }
};

App.prototype.motorTicksToMiles = function(ticks) {
    return ticks * (2.0 * 3.14159265358 * 3.8) / (265.714 * 63360.0);
};

App.prototype.caseTicksToMiles = function(ticks) {
    return ticks * (2.0 * 3.14159265358 * 3.8) / (36.0 * 63360.0);
};

module.exports = {
    "App": function(peripheral) {
        return new App(peripheral);
    },
    "getServiceUUIDs": function() {
        return getServiceUUIDs();
    },
    "isAppService": function(uuid) {
        return isAppService(uuid);
    },
    "isControlEndpoint": function(uuid) {
        return isControlEndpoint(uuid);
    }
};
