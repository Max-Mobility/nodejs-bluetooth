# nodejs-bluetooth
Bluetooth command and telemetry from within nodejs

To create the packet bindings (following [the emscripten guide](https://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/embind.html)):
```bash
emcc --bind -o packet_bindings.js packet.cpp
```
