# carvera-pendant

This application was created to allow me to use my Carvera with a pendant

It does this by setting itself up as a "man in the middle" between the Carvera controller software and the machine itself.

## Set up

1. Clone this repository (or download it as a ZIP and extract it)
1. Make sure you have NodeJS installed (I use version 18)
1. Run `npm ci` before the first run (and after every update)
1. Set the environment variable `CARVERA_SERIAL_PORT` to the serial port your Carvera is using (on Windows that might be `COM3`, on Linux `/dev/ttyUSB0`, etc)
1. Make sure the Carvera controller software is NOT connected to the machine
1. Make sure your pendant is plugged in and turned on
1. Run `npm start`
1. Wait for the line `System online!` to be printed out
1. In the menu of Carvera Controller, select `WIFI...` and then `Pendant` should show up in the drop down after a couple seconds
![vncviewer_m4ViRYPelW](https://github.com/Doridian/carvera-pendant/assets/631409/25b258da-3464-44d1-8455-c93cf65afb49)
1. Everything should now be ready

## Limitations

- Most of the functionality of the Pendant only works (by design) while the Carvera Controller is connected to the pendant software
- Only `WHB04B` style pendants supported at the moment
- Uploading large GCode files might be slower than WiFi due to the serial connection
