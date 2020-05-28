#!/bin/sh

set -ex

cargo build --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/karplus.wasm ../karplus.wasm

