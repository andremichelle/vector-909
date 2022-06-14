### CSS-909

Roland TR-909 drum-machine with only html, svg & css. No sound engine.

_**The use of any trade name or trademark is for identification and educational purposes only and does not imply any association with the trademark holder of their product brand.**_

[Open](https://andremichelle.github.io/css-909/) | [Wiki](https://en.wikipedia.org/wiki/Roland_TR-909)
![alt screenshot](screenshot.png)

### Credits
Logo SVGs (Roland, TR-909 & Rhythm Composer) by [Isaac Cotec](https://subaqueous.gumroad.com/l/hmOwu?recommended_by=search&_ga=2.213635036.938996232.1655202059-1482949479.1654938206&_gl=1*yr8fvz*_ga*MTQ4Mjk0OTQ3OS4xNjU0OTM4MjA2*_ga_6LJN6D94N6*MTY1NTIwMjA3My4zLjEuMTY1NTIwMjA3OC4w)

### Build
Make sure to have sass installed and run in the console:

    sass sass/main.sass:bin/main.css --watch

Make sure to have typescript installed and run in the console:

    tsc -p ./typescript/tsconfig.json --watch