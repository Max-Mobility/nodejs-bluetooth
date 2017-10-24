
function Packet(bytes) {
    this.bytes = bytes;

    this.Type = this.getType();
    this.SubType = this.getSubType();
};

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
