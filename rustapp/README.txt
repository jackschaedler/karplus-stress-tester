In order to build and run this app, you'll need to have `rust` installed, as well as `portaudio` and `gtk`.

On a Mac, you can set this up as follows:

> brew install portaudio
> brew install gtk+3
> brew install pkg-config

You can then build and run the application. You'll need to link against some
frameworks like CoreAudio, AudioUnit, and AudioToolbox in order for the build to work.
That can be accomplished by using the RUSTFLAGS environment variable in conjunction with
`cargo run`:

> RUSTFLAGS='-L /usr/local/lib/ -l framework=CoreAudio -l framework=AudioUnit -l framework=AudioToolbox' cargo run --release