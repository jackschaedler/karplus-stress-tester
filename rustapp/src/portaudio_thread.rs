extern crate karplus_string;

use karplus_string::KarplusString;
use portaudio::PortAudio;

pub enum Command {
    Pluck(usize), // the parameter is the index of the string to pluck.
}

// Change this and re-run the application to add and remove processing load.
pub static STRING_COUNT: usize = 2000;

// This code should match the code in the index.html (infoForStringIndex function)
// if you want to compare performance between the desktop app and the web version.
fn frequency_for_string_index(i: usize) -> f32 {
    let strings_in_each_set = 25;
    let string_set = (i as f32 / strings_in_each_set as f32).floor();
    let m = i  % strings_in_each_set;
    let set_f0 = 30.0 + (string_set as f32 * 10.0);
    return set_f0 + (set_f0 * m as f32);
}

pub fn run_audio(
    command_receiver: crossbeam_channel::Receiver<Command>,
    sample_rate: usize,
) {
    let mut strings: Vec<KarplusString> = Vec::new();

    for i in 0..STRING_COUNT {
        strings.push(KarplusString::new(sample_rate, frequency_for_string_index(i)));
    }

    const CHANNELS: usize = 1;
    const FRAMES_PER_BUFFER: usize = 128;
    const SAMPLES_PER_BUFFER: usize = FRAMES_PER_BUFFER * CHANNELS;

    audio_thread_priority::promote_current_thread_to_real_time(
        SAMPLES_PER_BUFFER as u32,
        sample_rate as u32,
    )
    .unwrap();

    let port_audio = PortAudio::new().unwrap();
    let settings = port_audio
        .default_output_stream_settings::<f32>(
            CHANNELS as i32,
            sample_rate as f64,
            FRAMES_PER_BUFFER as u32,
        )
        .unwrap();

    let mut stream = port_audio.open_blocking_stream(settings).unwrap();
    stream.start().unwrap();

    loop {
        while let Ok(command) = command_receiver.try_recv() {
            match command {
                Command::Pluck(index) => {
                    strings[index].pluck();
                }
            }
        }

        match stream.write(FRAMES_PER_BUFFER as u32, |output| {
            for out in output.iter_mut() {
                let mut val = 0.0;
                for string in strings.iter_mut() {
                    val += string.tick();
                }
                *out = val;
            }

        }) {
            // underflow
            _ => (),
        };
    }
}