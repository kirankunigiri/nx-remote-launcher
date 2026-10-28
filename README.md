
![NX Remote Launcher Logo](https://i.imgur.com/GcEIFSo.png)
![Feature Banner](https://i.imgur.com/Bfbe2QF.png)

# NX Remote Launcher
A Nintendo Switch homebrew app to browse, filter, and launch Switch games from your phone.

### About

Open the app on your Switch, and scan the QR code to view your games.
- View your game library.
- Filter by genre and player count.
- View game details, trailer, and tap to launch.

### External game library connector

The Connect button can send the installed Switch game list to a compatible external library. It follows the device pairing and sync protocol proposed in [VideoGameTrackarr connectors](https://github.com/wwwescape/VideoGameTrackarr/pull/59). This feature requires that connector API to be available on the library server.

1. Create an NX Remote Launcher connector in the library's integrations settings.
2. Copy its HTTPS endpoint, ending in `/api/connect/<slug>`, into NX Remote Launcher on your phone.
3. Create a pairing code and approve the device in the library.
4. Select Sync installed games. The app sends the complete list of installed base game title IDs and names. The connector decides how to handle games no longer installed.

The device token is saved on the Switch SD card in `switch/NXRemoteLauncher/connector.json`. It is not sent to the phone browser. Disconnect removes the local token; to revoke it on the library server, remove the paired device in the connector's settings. Pair again replaces the local connection with a new approval code.

### Screenshots
<table>
  <tr align="center">
      <td colspan="3"><img src="https://i.imgur.com/aEJBxTN.jpeg"></img></td>
  </tr>
  <tr align="center">
      <td><img src="https://i.imgur.com/oCxk0tS.jpeg"></img></td>
      <td><img src="https://i.imgur.com/JS4atJz.jpeg"></img></td>
      <td><img src="https://i.imgur.com/MTkYNA9.jpeg"></img></td>
  </tr>
</table>

---
### How it works

The app uses `nx.js` with a `remix` server to serve a web app. It loads the list of games from the Switch, and the react frontend displays it. We call external API's to get metadata about the games (genre/player count).

Libraries Used
- 📖 [Remix docs](https://remix.run/docs)
- [nx.js docs](https://github.com/TooTallNate/remix-nxjs)

---
### Development - Switch

The development server mode involves running the Remix server .nro file on the Switch, while also running the "dev" script on your local machine:

1. Run the build:dev script:
```sh
bun run build:dev
```

2. Create the dev mode .nro file:
```sh
bun run nro
```

3. Upload the `.nro` file to your Switch and launch the app from the Homebrew Launcher
4. Run the `dev` script on your local machine, passing the URL to your Switch Remix app. This script monitors for file changes in the `app` directory, rebuilds the Remix app, and then uploads the new server bundle to the `/__dev` endpoint for the Switch to use for future HTTP requests:
```sh
# IMPORTANT: Replace with your own Switch's IP address
bun run dev http://192.168.86.103:8080
```

---
### Development - Web Only

You don't need to have a Switch to develop! You can run the web version which will automatically use test game data from a json file in `app/lib/test/apps.json`. All of the data fetching and UI is created in the remix react app, so you can work on most of the functionality of the app. Only the "launch game" feature requires having a switch to test.

```sh
bun run dev:web
```

---
### Generate a production `.nro`

First, run the `build` script to build your Remix app and place the client-side assets into the "romfs" directory:

```sh
bun run build
```

Then run the `nro` script to generate the final `.nro` file.

```sh
bun run nro
```

Place the `.nro` file onto your Switch's SD card inside the "switch" directory, and launch the app through the Homebrew Launcher (album menu). While the app is running, you can access your Remix application from a web browser using the IP address and port shown on the Switch screen.

### `.nro` Metadata

* Add a square `icon.jpg` file in the root of the project to customize the icon of the NRO file
* The following `package.json` values are shown on the Homebrew Launcher:
  * `name`
  * `version`
  * `author`
* Set the `titleId` property in `package.json` to a random 16 digit hex string (example: `012a792e7a730000`)
  * This allows your app to access Save Data via `localStorage` in `loader()`/`action()` functions


# NXRL Playnite Support
If you want to be able to launch games through playnite as any normal game, check out this cool project that utilises [NX Remote Launcher Support for Playnite](https://github.com/Yeetov/NXRLPlayniteSupport).
