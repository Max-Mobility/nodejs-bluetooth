var Binding = require('./packet_bindings');
var Packet = require('./packet');

var bindingMapping = {
    "ControlMode": {
        "Beginner": Binding.SmartDriveControlMode.Beginner,
        "Intermediate": Binding.SmartDriveControlMode.Intermediate,
        "Advanced": Binding.SmartDriveControlMode.Advanced,
        "Off": Binding.SmartDriveControlMode.Off,
    },
    "Units": {
        "English": Binding.Units.English,
        "Metric": Binding.Units.Metric,
    }
};

function SmartDrive() {
    this.settings = settings = {
        ControlMode: "Advanced",
        Units: "English",
        Flags: 0,
        Padding: 0,
        TapSensitivity: 1.0,
        Acceleration: 0.5,
        MaxSpeed: 0.5,
    };
};


SmartDrive.prototype.motorTicksToMiles = function(ticks) {
    return ticks * (2.0 * 3.14159265358 * 3.8) / (265.714 * 63360.0);
}

SmartDrive.prototype.caseTicksToMiles = function(ticks) {
    return ticks * (2.0 * 3.14159265358 * 3.8) / (36.0 * 63360.0);
}

module.exports = function() {
    return new SmartDrive();
}
