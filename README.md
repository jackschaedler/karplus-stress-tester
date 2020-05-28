# karplus-stress-tester
This is a project for stress-testing AudioWorklet, and (roughly) measuring the performance tradeoffs involved with a variety of implementation strategies, specifically around the topic of cross-thread communication between the GUI and audio rendering threads.

You can play with it here: https://jackschaedler.github.io/karplus-stress-tester/

Recommended reading/watching as background material: 
* https://hacks.mozilla.org/2020/05/high-performance-web-audio-with-audioworklet-in-firefox/
* https://developers.google.com/web/updates/2017/12/audio-worklet
* https://googlechromelabs.github.io/web-audio-samples/audio-worklet/
* https://www.youtube.com/watch?v=T2Yonjy7-g4&t=1s


## What is going on here?

The page uses [AudioWorklets](https://developers.google.com/web/updates/2017/12/audio-worklet) to run custom DSP. This custom DSP implements a basic version of the [Karplus-Strong string synthesis algorithm](https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis). The page allows you to choose a variable number of strings that you'd like to simulate, along with a number of options for how those strings are created and managed.


## How to use the page

### Making noise
Start by visting https://jackschaedler.github.io/karplus-stress-tester/. Press the `Start Audio` button in the top-right of the screen. Now, press the `Pluck`, `Swipe`, and `Strum All` buttons to make some noise. Have fun!

> Note that this page only works in Firefox and Chrome. If you'd like this page to work in Safari as well, you can make that known in the [webkit issue tracker](https://bugs.webkit.org/show_bug.cgi?id=182506). 

You should be hearing something that sounds like a harp or lute. If you're hearing glitches, pops, or crackles, that means that your browser is struggling to simulate the strings. If you're not hearing anything, make sure your volume is up, and if that doesn't work, please file an issue/bug in this repository.

### Changing the string count
Click the numbered buttons to add or remove strings from the simulation. This is the main lever for stressing the browser. As you increase the number of strings, you might notice that the page gets laggy, or the audio begins to glitch.

### Measuring AudioWorkletNode overhead
The "String per AudioWorklet" section allows you to specify how many strings are simulated by each AudioWorklet node. This allows you to get a feel for the overhead introduced by each AudioWorklet node. Bundling up many strings into a single AudioWorklet node is more performant, so you should probably keep the `100 strings per worklet` option selected.

### Cross-thread communication channel
By default, the GUI will animate each string. In order to facilitate this animation, data for each string is sent from the audio simulation (Audio rendering thread) back to the GUI (Main thread). There are two options available for sending this data between threads: `MessagePorts` and `SharedArrayBuffers`. The former will produce garbage, where the latter will not. Using `SharedArrayBuffer` will allow you to visualize and simulate more strings, since the browser will be less busy collecting the garbage that comes from using `MessagePort`.

> Note! In order to use `SharedArrayBuffers` with Firefox, you'll need to use the [Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/) build, and turn on the `bypassCOOP_COEP.insecure.enabled` flag.

### Audio processing language
It's possible to write custom DSP for AudioWorklets using either JavaScript or WebAssembly. JavaScript is less performant than WebAssembly, but JavaScript is still surprisingly fast in modern browsers thanks to Just In Time compilation.

> Note that when using JavaScript, it might take a while for the JIT compilation to "kick in". So, you might hear glitches when playback begins, and those glitches might go away once the code has been optimized by the browser.

The WebAssembly for this page was written in Rust. You can see the code inside the `wasm` folder in the root of this repository.


## Some thoughts and findings

Here's a place for the community to collect rough measurements and findings that might arise as a result of using this page.

### Thoughts and findings from 28/5/2020

On a MacbookAir (10.14.6).
Firefox Nightly 78.0a1 (2020-05-19) (64-bit).
Chrome Version 83.0.4103.61 (Official Build) (64-bit).

In general:
* `MessagePort` is not a good option for passing lots of data between threads. It makes perfect sense for passing big objects infrequently (eg. WASM code fetched from a server), but severly limits performance if it's used to frequently pass lots of (even small) values. Using `MessagePort` will introduce glitches far before you run out of DSP/rendering capacity. 
   * For example: Select 1000 strings, 100 strings per worklet, WebAssembly, and ensure that visualization is on.
   * Notice that the page is very glitchy when using MessagePort. Switching to `SharedArrayBuffer` makes the glitches go away in FireFox. Chrome performs significantly better, but still glitches a bit. 
* TODO: Add more.

## Building the WASM code

Inside the `wasm` directory, run `./build.sh`. 

In order for this to work, you'll need to have Rust installed on your machine. In order to do that, you can follow the instructions here: https://www.rust-lang.org/tools/install. Once you've done that, ensure that the `wasm32-unknown-unknown` target is available on your machine by running `rustup target add wasm32-unknown-unknown`.
