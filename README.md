# Office Face

## Description

Office Face is taskbar app that tries to help you stop touching your face, by Dirigible Studio. This app was made during the 2019-2020 COVID-19 pandemic, to leverage a bit of technology and help our remote workers at Dirigible and abroad. It was also a fun challenge to build!

## How it works

Office Face makes use of two wonderful libraries to achieve it's core functionality. The first is [handtrack.js](https://github.com/victordibia/handtrack.js/), and the second is [face-api.js](https://github.com/justadudewhohacks/face-api.js/), both of which are amazingly robust and simple to use. The idea of Office Face was to combine these two technologies in an attempt to detect when the hand was by or on the face. Both of the libraries, using the same video input, independently track and monitor the face and hands of the user, using the provided trained models. Packaging them into a nice menubar app seemed like a no-brainer.

### Adjustments

Office Face has a debug area, where you can change different settings and weights within the application itself. Here you can also see if the app is detecting things that aren't supposed to be detected! Some complicated backgrounds can confuse the models and make them think there are hands and faces where they aren't supposed to be.

## Instructions

- Clone the repository.
- Ensure `electron` is installed.
- Run `npm install`.
- Run `gulp css` to build and watch [tailwind.css](https://tailwindcss.com) for changes.
- Run `electron .` to run development mode of application.
- Package for distribution with [electron-packager](https://github.com/electron/electron-packager).

## Privacy

This app only stores three things, the amount of times you've touched your face, the amount of days you've used the application, and the minutes since your last touch. If you have any privacy concerns you can also check the [handtrack.js](https://github.com/victordibia/handtrack.js/) and [face-api.js](https://github.com/justadudewhohacks/face-api.js/) repos.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
