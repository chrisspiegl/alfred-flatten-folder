# alfred-flatten-folder

Alfred workflow that flattens selected folders. Regular files in a selected folder move into the parent folder, and the selected folder is then deleted. Hidden files and symlinks inside the folder are not kept. They are removed with the original folder. This is intended. Symlinks are not followed, so a file outside the selected folder is not moved. If the parent already has that name, the moved file is kept as `name duplicate-filename 1`.

This cannot be undone. Duplicate the folder first if you want a copy.

## Requirements

- [Alfred 5](https://alfredapp.com) with the [Powerpack](https://alfredapp.com/powerpack/)
- Node.js 20+ (verified on 24)

## Install

```bash
npm install --global alfred-flatten-folder
```

## Usage

1. Select one or more folders in Finder and open Universal Actions.
2. Choose `Flatten Folder(s)` and press Enter.
3. Alfred asks you to confirm. Cancel notifies you and stops. OK runs the flatten, then posts a success notification.

## Maintainer

```bash
pnpm install
pnpm lint
pnpm test
pnpm release
```

## Release

From a clean `main` checkout, `pnpm release` prompts for the version, publishes to npm with pnpm, and creates the GitHub release. Requires npm login and a GitHub token (`GITHUB_TOKEN`) or `gh` auth.

## Related

* [More Alfred Workflows](https://github.com/chrisspiegl/alfred-workflows) - My Alfred Workflow Directory
* [alfy](https://github.com/sindresorhus/alfy) - Create Alfred workflows with ease
