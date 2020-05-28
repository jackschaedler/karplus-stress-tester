var exports = {};

class StringProcessorWASM extends AudioWorkletProcessor {
    static get parameterDescriptors() { return []; }

    constructor(options) {
      super();
      console.log("version 5 (WASM)");

      this.f0s = options.processorOptions.f0s;
      this.stringCount = this.f0s.length;
      this.analysisCounter = 0;
      this.analysisCounterTrigger = Math.floor(sampleRate / 60);
      this.sendBackData = options.processorOptions.visualize;

      if (this.f0s.length > 100) {
        throw new Error("Each AudioWorklet node can simulate max 100 strings.");
      }

      this.port.onmessage = this.handleMessage.bind(this);
    }


    handleMessage(event) {
      if (event.data.type === "play") {
        if (this.wasm) {
          this.wasm.exports.pluck_string(event.data.stringIndex);
        }
      }
      else if (event.data.type === "shared-buffer") {
        this.parameterWriter = new ParameterWriter(new RingBuffer(event.data.buffer, Uint8Array));
      }
      else if (event.data.type === "shared-buffer-plucks") {
        this.parameterReader = new ParameterReader(new RingBuffer(event.data.buffer, Uint8Array));
      }
      else if (event.data.type === "wasm") {
        let instance = new WebAssembly.Instance(
          new WebAssembly.Module(event.data.buffer),
          {}
        );
        this.wasm = instance;
        this._buffer_size = 128;
        // This needs to be before the call to
        // alloc. If you do this afterwards, the
        // WASM heap will have grown, and the ptr
        // will be invalidated/detached.
        this.f0s.forEach(f0 => {
          this.wasm.exports.add_string(sampleRate, f0);
        });
        // See: https://github.com/padenot/wac-19-audioworklet-workshop/tree/master/wasm-audio-nogc
        this._outPtr = this.wasm.exports.alloc(this._buffer_size);
        this._outBuf = new Float32Array(
          this.wasm.exports.memory.buffer, 
          this._outPtr, 
          this._buffer_size);

        console.log(this.wasm.exports.check())
      }
    }

    process(inputs, outputs, parameters) {
      if (!this.wasm) { return true; }

      const output = outputs[0];
      const outputChannel = output[0];

      if (this.parameterReader) {
        let o = { index: 0, value: 0 };
        while (this.parameterReader.dequeue_change(o)) {
          this.wasm.exports.pluck_string(o.index);
        }
      }

      if (output.length > 1) { throw new Error("This processor only expects mono"); }

      this.wasm.exports.process(this._outPtr, this._buffer_size);
      outputChannel.set(this._outBuf);

      this.analysisCounter += outputChannel.length;

      if (this.sendBackData && this.analysisCounter >= this.analysisCounterTrigger) {
        this.analysisCounter = this.analysisCounter % this.analysisCounterTrigger;

        for (let s = 0; s < this.stringCount; s++) {
          const amplitude = this.wasm.exports.amplitude(s);
          const vibration = this.wasm.exports.vibration(s);

          if (this.parameterWriter) {
            // Send back data using SharedArrayBuffer
            this.parameterWriter.enqueue_change(s * 2, amplitude);
            this.parameterWriter.enqueue_change(s * 2 + 1, vibration);
          } else {
            // Send back data using MessagePort
            this.port.postMessage({message: 'analysis',
                                   amplitude,
                                   vibration,
                                   stringIndex: s});
          }
        }
      }

      return true;
    }
  }


  registerProcessor('string-processor-wasm', StringProcessorWASM);