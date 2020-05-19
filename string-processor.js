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

      // String fundamental frequency
      const f0 = options.processorOptions.f0;
      this.sendBackData = options.processorOptions.visualize;

      // LP Filter
      // Single sample delay line for LP filter.
      this.filterZ = 0;

      // Delay Line
      let idealDelayLineLength = (sampleRate / f0);
      // For this to really be correct, this processor should
      // implement a fractional delay line length. Right now, the
      // string cannot be precisely tuned because of this rounding/flooring.
      this.delayLineLength = Math.floor(idealDelayLineLength);
      this.delayLine = new Array(this.delayLineLength).fill(0);
      this.delayWriteIndex = this.delayLineLength - 1;
      this.delayReadIndex = 0;

      // Noise Burst / Excitation
      this.excitation = new Array(this.delayLineLength).fill(0);
      this.excitationReadIndex = this.delayLineLength;
      for (let i = 0; i < this.delayLineLength; i++) {
          this.excitation[i] = (Math.random() - 0.5) * 1.5;
      }

      // Analysis Buffer
      // 60 times a second, we report back the average amplitude
      // over the last "frame", as well as a value which allows us to
      // do a fake string vibration animation.
      this.analysisBufferLength = Math.floor(sampleRate / 60);
      this.analysisBuffer = new Array(this.analysisBufferLength).fill(0);
      this.analysisWriteIndex = 0;

      this.port.onmessage = this.handleMessage.bind(this);
    }


    handleMessage(event) {
        if (event.data.type === "play") {
          // Pluck the string!
          this.excitationReadIndex = 0;
        }
        else if (event.data.type === "shared-buffer") {
          this.parameterWriter = new ParameterWriter(new RingBuffer(event.data.buffer, Uint8Array));
        }
      }

    process(inputs, outputs, parameters) {
      const output = outputs[0];
      const outputChannel = output[0];

      if (output.length > 1) { throw new Error("This processor only expects mono"); }

      for (let i = 0; i < outputChannel.length; ++i) {
        const currentExcitation = this.excitationReadIndex < this.delayLineLength
         ? this.excitation[this.excitationReadIndex]
         : 0;

        let currentDelayLineOutput = this.delayLine[this.delayReadIndex];
        // This is a really simple low-pass filter which just (more or
        // less) averages the last value with the current value, and ensures
        // that the signal will decay.
        this.filterZ = (currentDelayLineOutput * 0.499) + (this.filterZ * 0.499);

        let sum = currentExcitation + this.filterZ;
        outputChannel[i] = sum;

        this.delayLine[this.delayWriteIndex] = sum;
        this.analysisBuffer[this.analysisWriteIndex] = sum;

        this.excitationReadIndex++;
        this.delayReadIndex = (this.delayReadIndex + 1) % this.delayLineLength;
        this.delayWriteIndex = (this.delayWriteIndex + 1) % this.delayLineLength;
        this.analysisWriteIndex = (this.analysisWriteIndex + 1) % this.analysisBufferLength;

        if (this.analysisWriteIndex === 0 && this.sendBackData) {
          let average = 0;
          for (let i = 0; i < this.analysisBufferLength; i++) {
            average += Math.abs(this.analysisBuffer[i]);
          }

          const amplitude = average / this.analysisBufferLength;
          const vibration = (((this.excitationReadIndex / 3) % this.delayLineLength)
            / this.delayLineLength);

          if (this.parameterWriter) {
            // Send back data using SharedArrayBuffer
            this.parameterWriter.enqueue_change(0, amplitude);
            this.parameterWriter.enqueue_change(1, vibration);
          } else {
            // Send back data using MessagePort
            this.port.postMessage({message: 'analysis', amplitude, vibration});
          }
        }
      }

      return true;
    }
  }


  registerProcessor('string-processor', StringProcessor);