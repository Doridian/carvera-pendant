# carvera-pendant

This application was created to allow me to use my Carvera with a pendant

It does this by setting itself up as a "man in the middle" between the Carvera controller software and the machine itself.

## Set up

1. Clone this repository (or download it as a ZIP and extract it)
1. Make sure you have NodeJS installed (I use version 20)
1. Run `npm ci` before the first run (and after every update)
1. Set `CARVERA_SERIAL_PORT` or `CARVERA_HOST_NAME` in `config.ts` or via environment variables
1. Make sure the Carvera controller software is NOT connected to the machine
1. Make sure the pendant dongle is pugged in (the pendant itself doesn't have to be on)
1. Run `npm start`
1. Wait for the line `System online!` to be printed out
1. In the menu of Carvera Controller, select `WIFI...` and then `Pendant` should show up in the drop down after a couple seconds
   ![vncviewer_m4ViRYPelW](https://github.com/Doridian/carvera-pendant/assets/631409/25b258da-3464-44d1-8455-c93cf65afb49)
1. Everything should now be ready

## Limitations

-   Only `WHB04B` style pendants supported at the moment
-   If you're using a serial connection rather than WiFi, uploading large GCode files will be slower
