# karplus-stress-tester

`karplus-stress-tester` is a web page that allows you to make noise (and maybe music) by plucking and strumming on virtual strings in your web browser. It also presents a set of options which configure the way that these virtual strings are simulated in code.

`karplus-stress-tester` can be a fun and silly way to spend 5 minutes, and it might introduce you to a classic yet simple [computer music gem](https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis). However, this project is primarily designed as a tool for software developers to better understand the tradeoffs involved in implementing custom audio signal processing algorithms and musical experiences for the web.

Play with it here: https://jackschaedler.github.io/karplus-stress-tester/

## How to use `karplus-stress-tester`

Start by pressing the `Start Audio` button in the top right-hand corner of the screen. Wait until a set of pink lines appear on the left side of the screen. These are your virtual "strings". Next, press the `Pluck`, `Swipe`, and `Strum All` buttons to make some noise. You can also click on the individual strings to "pluck" them. 

You should be hearing something that sounds like an otherworldly harp/zither/dulcimer. If you're hearing glitches, pops, or crackles, that indicates that your browser is struggling to simulate the strings. If you're not hearing anything, make sure your volume is turned up. If that doesn't work, please file an issue/bug in this repository.

> Note that this page only works in Firefox and Chrome. If you'd like this page to work in Safari as well, you can make that known in the [webkit issue tracker](https://bugs.webkit.org/show_bug.cgi?id=182506).

If you're using Chrome, you can also pluck the strings using a MIDI device like a keyboard or pad controller. Whenever you play a note, the string with the nearest frequency will be "plucked".

> Hot tip: You can also route MIDI from your DAW of choice to the page using something like the [IAC Driver on Mac OSX](https://help.ableton.com/hc/en-us/articles/209774225-How-to-setup-a-virtual-MIDI-bus).


## Information for developers

### Some background
The page uses [AudioWorklets](https://developers.google.com/web/updates/2017/12/audio-worklet) to run multiple instantiations of the [Karplus-Strong string synthesis algorithm](https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis). The page allows you to choose the number of strings that you'd like to simulate, along with a number of options for how those strings are created, managed, and simulated.

`karplus-stress-tester` can be used to stress-test AudioWorklet, and (roughly) measure the performance tradeoffs that arise when choosing between a variety of implementation strategies, specifically around the topic of cross-thread communication between the GUI and audio rendering threads. This topic is quite important if you want to create highly interactive and visually compelling musical experiences in the browser.

In broad strokes, this page will hopefully help you answer questions like:
* Is it worth using WebAssembly?
* Is it worth using `SharedArrayBuffers` instead of `MessagePorts`?
* How much overhead (roughly) is introduced by each `AudioWorklet` node?

Recommended reading/watching before digging in deeper: 
* https://hacks.mozilla.org/2020/05/high-performance-web-audio-with-audioworklet-in-firefox/
* https://developers.google.com/web/updates/2017/12/audio-worklet
* https://googlechromelabs.github.io/web-audio-samples/audio-worklet/
* https://www.youtube.com/watch?v=T2Yonjy7-g4&t=1s

### Karplus Strong
The [Karplus-Strong string synthesis algorithm](https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis) is simple enough to be comprehensible at a (long) glance, while still producing fairly interesting sonic results. This is why I've chosen this algorithm, as opposed to using something more straightforward like a variable number of pure sine tones, which isn't quite as fun sonically.

You can find the code for the JavaScript implementation in `string-processor.js`.
You can find the code for the Rust/WebAssembly implementation in `wasm/src/karplus_string.rs`.

If you're inclined to dig into the code and you find any errors or inefficiences, please submit an issue or a PR.

### How to use the page

#### Changing the string count
Click the numbered buttons on the right-hand side of the screen to add or remove strings from the simulation. This is your main lever for stressing the browser. As you increase the number of strings, you might notice that the page gets laggy or/and the audio begins to glitch. Different combinations of the other parameters will allow you to simulate more (or fewer) strings.

#### Measuring AudioWorkletNode overhead
The "String per AudioWorklet" section allows you to specify how many strings are simulated by each AudioWorklet node. This allows you to get a feel for the overhead introduced by each AudioWorklet node. Simulating many strings in a single AudioWorklet node is more performant, so you should probably keep the `100 strings per worklet` option selected.

### Cross-thread communication channel
By default, the GUI will animate each string. In order to facilitate this animation, data for each string is sent from the audio simulation (Audio rendering thread) back to the GUI (Main thread) 60 times a second. There are two options available for sending this data between threads: `MessagePorts` and `SharedArrayBuffers`. Using `MessagePorts` will allocate memory, which will in turn lead to garbage collection. Using `SharedArrayBuffers` will not cause allocations, and will in turn avoid (potentially costly) garbage collection activity. Using `SharedArrayBuffer` will allow you to visualize and simulate more strings, since the browser will be less busy collecting the garbage that is created as a by-product of using `MessagePort`.

> Note! In order to use `SharedArrayBuffers` with Firefox, you'll need to use the [Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/) build, and turn on the `bypassCOOP_COEP.insecure.enabled` flag. Make sure you turn the flag back off after viewing this site, and don't turn this flag on in a browser that you use for anything sensitive.

### Audio processing language
It's possible to write custom DSP for AudioWorklets using either JavaScript or WebAssembly. JavaScript is less performant than WebAssembly, but JavaScript is still surprisingly fast in modern browsers thanks to [just-in-time compilation](https://hacks.mozilla.org/2017/02/a-crash-course-in-just-in-time-jit-compilers/).

> Note that when using JavaScript, it might take a while for the JIT compilation to "kick in". So, you might hear glitches when playback begins, and those glitches might quickly go away once the code has been optimized/compiled by the browser.

The WebAssembly for this page was written in Rust. You can see the code inside the `wasm` folder in the root of this repository.

#### Building the WASM code

Inside the `wasm/worklet` directory, run `./build.sh`.

In order for this to work, you'll need to have Rust installed on your machine. In order to do that, you can follow the instructions here: https://www.rust-lang.org/tools/install. Once you've done that, ensure that the `wasm32-unknown-unknown` target is available on your machine by running `rustup target add wasm32-unknown-unknown`.

#### Comparing to a desktop-application

In the `rustapp` folder, there is code for a simple desktop application which uses `portaudio` and `gtk`. This app uses the same DSP code as the website, so you can (roughly) compare the difference in performance between running the DSP code in a desktop app vs. a browser-based app. If you want to change the number of strings that are simulated, you'll need to edit the code directly in `rustapp/src/portaudio_thread` and re-build. Also, I've only implemented the "pluck" button/feature in the desktop version.

## Thoughts/findings/insights

Things are constantly changing w/r/t WebAudio. Experiences which were impossible to create only months ago are now possible via a set of interrelated technologies (Worklet, WASM, etc) which are constantly being improved. So, any benchmarks/findings/measurements taken now will likely become obsolete quite quickly.

However, I've put some [initial findings](https://github.com/jackschaedler/karplus-stress-tester/wiki) in the repository wiki. More findings will be collected there as testing is carried out on a wider range of devices.


