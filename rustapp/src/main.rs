use rand::Rng;
use gtk::prelude::*;
use gtk::{Orientation, Window, WindowPosition, WindowType, Button, Label};
mod portaudio_thread;
use portaudio_thread::Command;

fn main() {
    if gtk::init().is_err() {
        println!("Error initializing GTK");
        return;
    }

    let (command_sender, command_receiver) = crossbeam_channel::bounded(1024);

    let sample_rate = 44100;
    std::thread::spawn(move || { portaudio_thread::run_audio(command_receiver, sample_rate) });

    let window = Window::new(WindowType::Toplevel);
    window.set_title("Karplus-Strong stress tester");
    window.set_default_size(350, 300);
    window.set_position(WindowPosition::Center);

    window.connect_delete_event(|_, _| {
        gtk::main_quit();
        Inhibit(false)
    });

    let container = gtk::Box::new(Orientation::Vertical, 10);
    window.add(&container);

    let label = Label::new(format!("simulating {} string(s)", portaudio_thread::STRING_COUNT).as_str());
    container.pack_start(&label, true, true, 10);

    let pluck_button = Button::new_with_label("pluck a string!");
    pluck_button.connect_clicked(move |_| {
        let mut rng = rand::thread_rng();
        let index = rng.gen_range(0, std::cmp::min(portaudio_thread::STRING_COUNT, 10));
        command_sender.send(Command::Pluck(index)).unwrap();
    });
    container.pack_start(&pluck_button, false, false, 10);

    window.show_all();
    gtk::main();
}
