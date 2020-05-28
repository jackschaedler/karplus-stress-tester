/*
This struct implements a simple version of the
Karplus-Strong string synthesis algorithm:

     /----------(+)--------------------------------------> Output
     |           |                            |
Noise Burst      |                            |
                 \------ LP Filter -------Delay Line

Where the Noise Burst is of length N, and the Delay Line is of
length N. The LP Filter must attenutate the signal at all frequencies.

https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis
*/


pub struct KarplusString {
    pub delay_line: Vec<f32>,
    pub delay_line_index: usize,
    pub excitation_read_index: usize,
    pub excitation: Vec<f32>,
    pub filter_z: f32,
    pub envelope: f32,
    pub envelope_follower_coeff: f32,
    pub f0: f32,
}

impl KarplusString {
    pub fn new(sr: usize, f0: f32) -> Self {
        let ideal_delay_line_length = (sr as f32) / f0;
        let delay_line_length = ideal_delay_line_length.round() as usize;
        let mut karplus = KarplusString {
            delay_line: vec![0.0; delay_line_length],
            delay_line_index: 0,
            excitation_read_index: delay_line_length,
            excitation: vec![0.0; delay_line_length],
            filter_z: 0.0,
            envelope: 0.0,
            envelope_follower_coeff: ((0.01 as f32).ln() / (10.0 * (sr as f32) * 0.001)).exp(),
            f0: f0,
        };

        let mut rng = Rand::new(0);
        for x in karplus.excitation.iter_mut() {
            *x = (rng.rand_float() - 0.5) * 1.5;
        }

        karplus
    }

    pub fn pluck(&mut self) {
        self.excitation_read_index = 0;
    }

    pub fn tick(&mut self) -> f32 {
        let delay_line_length = self.delay_line.len();
        let current_excitation = if self.excitation_read_index < delay_line_length
            {self.excitation[self.excitation_read_index]} else {0.0};

        let current_delay_line_output = self.delay_line[self.delay_line_index];
        self.filter_z = (current_delay_line_output * 0.499) + (self.filter_z * 0.499);

        let sum = current_excitation + self.filter_z;

        self.delay_line[self.delay_line_index] = sum;
        
        let abs_sum = sum.abs();
        self.envelope = self.envelope_follower_coeff * (self.envelope - abs_sum) + abs_sum;
        self.delay_line_index = (self.delay_line_index + 1) % delay_line_length;
        self.excitation_read_index = self.excitation_read_index + 1;

        sum
    }
}


// This random number generation code is taken
// from the thread, "Random number without using the external crate?"
// on the Rust Lang forums: 
// https://users.rust-lang.org/t/random-number-without-using-the-external-crate/17260/11
//
// I'm using this because I wasn't trivial using a crate like "rand" inside WASM.
// It is entirely likely that this possible, and I was just setting up the project
// incorrectly somehow.
const KX: u32 = 123456789;
const KY: u32 = 362436069;
const KZ: u32 = 521288629;
const KW: u32 = 88675123;

pub struct Rand {
    x: u32, y: u32, z: u32, w: u32
}

impl Rand{
    pub fn new(seed: u32) -> Rand {
        Rand{
            x: KX^seed, y: KY^seed,
            z: KZ, w: KW
        }
    }

    // Xorshift 128, taken from German Wikipedia
    pub fn rand(&mut self) -> u32 {
        let t = self.x^self.x.wrapping_shl(11);
        self.x = self.y; self.y = self.z; self.z = self.w;
        self.w ^= self.w.wrapping_shr(19)^t^t.wrapping_shr(8);
        return self.w;
    }

    pub fn rand_float(&mut self) -> f32 {
        (self.rand() as f32)/(<u32>::max_value() as f32)
    }
}


#[cfg(test)]
mod tests {
    macro_rules! string_test {
        ($name:ident, $sr:expr, $f0:expr) => {
            #[test]
            fn $name() {
                let string = super::KarplusString::new($sr, $f0);
                assert_eq!(string.delay_line.len(), 100);
                assert_eq!(string.f0, $f0);
            }
        }
    }

    string_test!(create, 44100, 440.0);
}
