#[macro_use]
extern crate lazy_static;
extern crate karplus_string;

use std::sync::Mutex;
use karplus_string::KarplusString;


pub struct Karplus {
    strings: Vec<KarplusString>,
}

impl Karplus {
    pub fn new() -> Karplus {
        return Karplus {
            strings: Vec::new(),
        };
    }

    pub fn check(&mut self) -> f32 {
        return 42.0;
    }

    pub fn process(&mut self, out_ptr: *mut f32, size: usize) {
        let out_buf: &mut [f32] = unsafe {std::slice::from_raw_parts_mut(out_ptr, size) };
        for out in out_buf.iter_mut() {
            *out = self.tick();
        }
    }

    pub fn tick(&mut self) -> f32 {
        let mut out = 0.0;
        for string in self.strings.iter_mut() {
            out += string.tick();
        }
        out
    }

    pub fn string_count(&mut self) -> usize {
        self.strings.len()
    }

    pub fn add_string(&mut self, sr: usize, f0: f32) {
        self.strings.push(KarplusString::new(sr, f0));
    }

    pub fn pluck_string(&mut self, i: usize) {
        self.strings[i].pluck();
    }

    pub fn amplitude(&mut self, i: usize) -> f32 {
        self.strings[i].envelope
    }

    pub fn vibration(&mut self, i: usize) -> f32 {
        let string = &self.strings[i];
        let delay_line_length = string.excitation.len();
        let a = (string.excitation_read_index as f32) / 3.0;
        let b = (a as usize) % delay_line_length;
        let c = (b as f32) / (delay_line_length as f32);
        c
    }
}

#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut f32 {
    let mut buf = Vec::<f32>::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    return ptr as *mut f32;
}

lazy_static! {
    static ref KARPLUS: Mutex<Karplus> = Mutex::new(Karplus::new());
}

#[no_mangle]
pub extern "C" fn process(out_ptr: *mut f32, size: usize) {
    let mut karplus = KARPLUS.lock().unwrap();
    karplus.process(out_ptr, size);
}

#[no_mangle]
pub extern "C" fn add_string(sr: usize, f0: f32) {
    let mut karplus = KARPLUS.lock().unwrap();
    karplus.add_string(sr, f0);
}

#[no_mangle]
pub extern "C" fn pluck_string(i: usize) {
    let mut karplus = KARPLUS.lock().unwrap();
    karplus.pluck_string(i);
}

#[no_mangle]
pub extern "C" fn amplitude(i: usize) -> f32 {
    let mut karplus = KARPLUS.lock().unwrap();
    return karplus.amplitude(i);
}

#[no_mangle]
pub extern "C" fn vibration(i: usize) -> f32 {
    let mut karplus = KARPLUS.lock().unwrap();
    return karplus.vibration(i);
}

#[no_mangle]
pub extern "C" fn check() -> f32 {
    let mut karplus = KARPLUS.lock().unwrap();
    return karplus.check();
}


#[cfg(test)]
mod tests {
    macro_rules! karplus_test {
        ($name:ident, $sr:expr, $f0:expr) => {
            #[test]
            fn $name() {
                let mut karplus = super::Karplus::new();
                assert_eq!(karplus.string_count(), 0);
                karplus.add_string($sr, $f0);
                assert_eq!(karplus.string_count(), 1);
                karplus.add_string($sr, $f0);
                assert_eq!(karplus.string_count(), 2);

                assert_eq!(karplus.tick(), 0.0);
            }
        }
    }

    karplus_test!(create, 44100, 440.0);
}