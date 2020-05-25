/*
This processor implements a simple version of the
Karplus-Strong string synthesis algorithm:

     /----------(+)--------------------------------------> Output
     |           |                            |
Noise Burst      |                            |
                 \------ LP Filter -------Delay Line

Where the Noise Burst is of length N, and the Delay Line is of
length N. The LP Filter must attenutate the signal at all frequencies.

https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis
*/
var exports = {};

class StringProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() { return []; }

    constructor(options) {
      super();
      console.log("version 3");

      // In order to be able to measure the overhead of each AudioWorkletNode,
      // this processor is written so that it can model an arbitrary number of
      // strings.
      this.filterZs = [];
      this.delayLines = [];
      this.delayLineWriteIndices = [];
      this.delayLineReadIndices  = [];
      this.excitationReadIndices = [];
      this.analysisBuffers = [];
      this.analysisWriteIndices = [];

      const f0s = options.processorOptions.f0s;

      if (f0s.length > 100) {
        throw new Error("Each AudioWorklet node can simulate max 100 strings.");
      }

      f0s.forEach(f0 => { this.createString(f0); })

      this.stringCount = f0s.length;
      this.sendBackData = options.processorOptions.visualize;

      // Noise Burst / Excitation
      this.excitation = new Array(sampleRate).fill(0);
      for (let i = 0; i < sampleRate; i++) {
          this.excitation[i] = (Math.random() - 0.5) * 1.5;
      }

      this.port.onmessage = this.handleMessage.bind(this);
    }

    createString(f0) {
      this.filterZs.push(0);
      // Delay Line
      const idealDelayLineLength = (sampleRate / f0);
      // For this to really be correct, this processor should
      // implement a fractional delay line length. Right now, the
      // string cannot be precisely tuned because of this rounding/flooring.
      const delayLineLength = Math.floor(idealDelayLineLength)
      this.delayLines.push(new Array(delayLineLength).fill(0))
      this.delayLineWriteIndices.push(delayLineLength - 1);
      this.delayLineReadIndices.push(0);

      // Noise Burst / Excitation
      this.excitationReadIndices.push(delayLineLength);
      
      // Analysis Buffer
      // 60 times a second, we report back the average amplitude
      // over the last "frame", as well as a value which allows us to
      // do a fake string vibration animation.
      const analysisBufferLength = Math.floor(sampleRate / 60);
      this.analysisBuffers.push(new Array(analysisBufferLength).fill(0));
      this.analysisWriteIndices.push(0);
    }


    handleMessage(event) {
      if (event.data.type === "play") {
        // Pluck the string
        this.excitationReadIndices[event.data.stringIndex] = 0;
      }
      else if (event.data.type === "shared-buffer") {
        this.parameterWriter = new ParameterWriter(new RingBuffer(event.data.buffer, Uint8Array));
      }
      else if (event.data.type === "shared-buffer-plucks") {
        this.parameterReader = new ParameterReader(new RingBuffer(event.data.buffer, Uint8Array));
      }
    }

    process(inputs, outputs, parameters) {
      const output = outputs[0];
      const outputChannel = output[0];

      if (this.parameterReader) {
        let o = { index: 0, value: 0 };
        while (this.parameterReader.dequeue_change(o)) {
          this.excitationReadIndices[o.index] = 0;
        }
      }

      if (output.length > 1) { throw new Error("This processor only expects mono"); }

      for (let s = 0; s < this.stringCount; ++s) {
        for (let i = 0; i < outputChannel.length; ++i) {
          const delayLineLength = this.delayLines[s].length;
          const currentExcitation = this.excitationReadIndices[s] < delayLineLength
           ? this.excitation[this.excitationReadIndices[s]]
           : 0;
  
          const currentDelayLineOutput = this.delayLines[s][this.delayLineReadIndices[s]];
          // This is a really simple low-pass filter which just (more or
          // less) averages the last value with the current value, and ensures
          // that the signal will decay.
          this.filterZs[s] = (currentDelayLineOutput * 0.499) + (this.filterZs[s] * 0.499);
  
          const sum = currentExcitation + this.filterZs[s];
          outputChannel[i] += sum;
  
          this.delayLines[s][this.delayLineWriteIndices[s]] = sum;
          this.analysisBuffers[s][this.analysisWriteIndices[s]] = sum;
  
          this.excitationReadIndices[s]++;
          this.delayLineReadIndices[s] = (this.delayLineReadIndices[s] + 1) % delayLineLength;
          this.delayLineWriteIndices[s] = (this.delayLineWriteIndices[s] + 1) % delayLineLength;

          const analysisBufferLength = this.analysisBuffers[s].length;
          this.analysisWriteIndices[s] = (this.analysisWriteIndices[s] + 1) % analysisBufferLength;
  
          if (this.sendBackData && this.analysisWriteIndices[s] === 0) {
            // This isn't the cleverest implementation of calculating an average
            // amplitude. But, this is a stress test, and the general problem of
            // needing to buffer up a bunch of audio and periodically send back
            // some analysis you perform on it is a common thing.
            let average = 0.0;
            for (let i = 0; i < analysisBufferLength; i++) {
              average += Math.abs(this.analysisBuffers[s][i]);
            }
  
            const amplitude = average / analysisBufferLength;
            const vibration = (((this.excitationReadIndices[s] / 3) % delayLineLength) / delayLineLength);
  
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
      }
      return true;
    }
  }


  registerProcessor('string-processor', StringProcessor);