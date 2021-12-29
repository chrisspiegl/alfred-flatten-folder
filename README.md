# alfred-flatten-folder

# alfred-npms

> [Alfred](https://alfredapp.com) workflow to to flatten a folder and it's contents

<img src="media/screenshot.png" style="width: 100%;">

Select one or multiple folders and flatten their contents into the parent folder.

This is useful when you just want all the files and don't care about the folder structure.

## Install

```
npm install --global alfred-flatten-folder
```

*Requires [Node.js](https://nodejs.org) 14+ and the Alfred [Powerpack](https://alfredapp.com/powerpack/).*

## Usage

*Careful: the flattening process can not be reversed!*

If you want to test if you like the result of the flattening, duplicate the folder before flattening!

1. Select a folder in the macOS Finder and then activate the Universal Actions.
2. For me this is setup to be <kbd>Command</kbd><kbd>Command</kbd>.
3. Then you can enter `Flatten Folder` and press <kbd>Enter</kbd>.
4. You will be presented with some dialog windows so you actually have to confirm!


## Related

- [alfy](https://github.com/sindresorhus/alfy) - Create Alfred workflows with ease
