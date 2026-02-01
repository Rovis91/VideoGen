module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Ad Video Generator',
    executableName: 'ad-video-generator',
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ad-video-generator',
        authors: 'Ad Video Generator',
      },
      platforms: ['win32'],
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {},
      platforms: ['darwin'],
    },
  ],
};
