var Binding = require('./packet_bindings');

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

function decimalToHex(d) {
    var hex = Number(d).toString(16);
    hex = "00".substr(0, 2 - hex.length) + hex; 
    return hex.toUpperCase();
}

function Packet(bytes) {
    this.initialize( bytes );
};

// LIFECYCLE

Packet.prototype.initialize = function(bytes) {
    this.destroy();
    this.instance = new Binding.Packet();
    this.instance.newPacket();

    this._bytes = bytes;

    if (bytes) {
        this.instance.processPacket( bytes );
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

Packet.prototype.send = function(characteristic, type, subType, key, data, length) {
    if (characteristic) {
        if (type && subType) {
            this.makePacket(type, subType, key, data);
        }
        if (length)
            this.instance.length = length;
        var output = this.writableBuffer();
        if (output) {
            //console.log(output);
            characteristic.write(output, false); // withoutResponse = false
            //console.log("Sent: " + this.Type() + "::" + this.SubType());
        }
    }
};

Packet.prototype.writableBuffer = function() {
    var output = null;

    if (this.instance) {
        var vectorOut = new Binding.VectorInt();
        vectorOut = this.instance.format();
        var len = vectorOut.size();
        output = Buffer.alloc(len);
        var str = ""
        for (var i=0; i<vectorOut.size(); i++) {
            output[i] = vectorOut.get(i);
            str += "0x"+decimalToHex(vectorOut.get(i))+" ";
        }
        str += "\n";
        //console.log(str);
        vectorOut.delete();
    }
    return output;
};

// ACCESSING FUNCTIONS

Packet.prototype.Type = function(newType) {
    if (this.instance) {
        if (newType) {
            this.instance.Type = Binding.PacketType[ newType ];
        }
        else {
            return bindingTypeToString( "PacketType", this.instance.Type );
        }
    }
    else {
        return null;
    }
};

Packet.prototype.SubType = function(newSubType) {
    if (this.instance) {
        var type = this.Type();
        var bindingKey = "Packet"+type+"Type";
        if (newSubType) {
            this.instance[ this.instance.Type ] = Binding[ bindingKey ][ newSubType ];
        }
        else {
            return bindingTypeToString( bindingKey, this.instance[ type ] );
        }
    }
    else {
        return null;
    }
};

Packet.prototype.data = function(key) {
    if (this.instance) {
        return this.instance[key];
    }
    return null;
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
