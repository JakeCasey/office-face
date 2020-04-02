const { menubar } = require('menubar');

const mb = menubar({
  browserWindow: {
    height: 600,
    // added 443 for devtools width.
    width: 800,
    alwaysOnTop: true,
  },
});

mb.app.commandLine.appendSwitch(
  'disable-backgrounding-occluded-windows',
  'true'
);

mb.app.commandLine.appendSwitch('disable-renderer-backgrounding', 'true');

require('electron-reload')(__dirname);

mb.on('ready', () => {
  console.log('Menubar app is ready.');
});

mb.on('after-create-window', () => {
  mb.window.openDevTools();
});
