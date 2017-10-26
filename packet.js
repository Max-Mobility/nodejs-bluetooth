var Binding = require('./packet_bindings');

function Packet(bytes) {
    this.initialize( bytes );
};

// LIFECYCLE

Packet.prototype.initialize = function(bytes) {
    this.destroy();

    this.instance = new Binding.Packet();
    this.instance.newPacket();
    if (bytes) {
        this.instance.processPacket( bytes );
        this.Type = this.getType();
        this.SubType = this.getSubType();
    }
};

Packet.prototype.destroy = function() {
    if (this.instance)
        this.instance.delete();
};

// BINDING WRAPPING

Packet.prototype.makePacket = function(type, subType, key, data) {
    if (this.instance == undefined) {
        this.initialize();
    }
    this.instance.Type = Binding.PacketType[type];
    this.instance[type] = Binding['Packet'+type+'Type'][subType];
    if (key && data) {
        this.instance[key] = data;
    }
};

Packet.prototype.send = function(characteristic, type, subType, key, data) {
    if (characteristic) {
        if (type && subType) {
            this.makePacket(type, subType, key, data);
        }
        var output = this.writableBuffer();
        if (output) {
            characteristic.write(output, false); // withoutResponse = false
            console.log("Sent: " + this.Type + "::" + this.SubType);
        }
    }
};

Packet.prototype.writableBuffer = function() {
    var output = null;
    if (this.instance) {
        var vectorOut = new PacketBinding.VectorInt();
        vectorOut = this.instance.format();
        output = Buffer.alloc(vectorOut.size());
        for (var i=0; i<vectorOut.size(); i++) {
            output[i] = vectorOut.get(i);
        }
        vectorOut.delete();
    }
    return output;
};

// ACCESSING FUNCTIONS

Packet.prototype.getType = function() {
    var index = 0,
        types = [ "None", "Data", "Command", "Error", "OTA" ],
        type = null;
    if (this.bytes) {
        type = types[ this.bytes[ index ] ];
    }
    return type;
};

Packet.prototype.getSubType = function() {
    var index = 1,
        subTypes = {
            "Data": [
                "MotorDistance",
                "Speed",
                "CoastTime",
                "Pushes",
                "MotorState",
                "BatteryLevel",
                "VersionInfo",
                "DailyInfo",
                "JourneyInfo",
                "MotorInfo",
                "DeviceInfo",
                "Ready",
                "BatteryInfo"
            ],
            "Command": [
                "SetAcceleration",
                "SetMaxSpeed",
                "Tap",
                "DoubleTap",
                "SetControlMode",
                "SetSettings",
                "TurnOffMotor",
                "StartJourney",
                "StopJourney",
                "PauseJourney",
                "SetTime",
                "StartOTA",
                "StopOTA",
                "OTAReady",
                "CancelOTA",
                "Wake",
                "StartGame",
                "StopGame",
                "ConnectMPGame",
                "DisconnectMPGame"
            ],
            "Error": [
                "Error"
            ],
            "OTA": [
                "SmartDrive",
                "SmartDriveBluetooth",
                "PushTracker"
            ]
        },
        subType = null;
    if (this.bytes && this.Type) {
        subType = subTypes[ this.Type ][ this.bytes[ index ] ];
    }
    return subType;
};

Packet.prototype.getPayload = function() {
};

Packet.prototype.parse = function() {
};

Packet.prototype.parseData = function(data) {
};

Packet.prototype.parseCommand = function(command) {
};

Packet.prototype.parseError = function(error) {
};

Packet.prototype.parseOTA = function(ota) {
};

module.exports = function(bytes) {
    return new Packet(bytes);
}
